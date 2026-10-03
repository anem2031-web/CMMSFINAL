import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure, ticketProcedure, ticketManagerProcedure, ticketScopedWorkflowManagerProcedure, ticketTriageProcedure } from "../_shared/procedures";
import { translateFields, detectLanguage } from "../../services/translation/translation";
import * as db from "../../_core/db";
import { APP_ROLE, MAINTENANCE_INSPECTION_WORKFLOW_STATUS } from "@shared/roles";
import { canStartTicketRepair, canSubmitStandardRepair } from "@shared/ticketUiRules";
import { assertPathBMaterialsDeliveredToTechnician, assertPathBMaterialsDeliveredToTechnicianForItem } from "../purchase/ticket-purchase-workflow";
import { notifyTicketSupervisor } from "../_shared/router-helpers";
import { assertTicketWorkflowManageable, canManageTicketWorkflow, assertTicketItemWorkflowManageable, canManageTicketItemWorkflow, isAssignedTicketTechnicianForWorkflow } from "./tickets.access";

const executionManagerRoles = new Set<string>([
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
  APP_ROLE.IT_MANAGER,
  APP_ROLE.ADMIN,
  APP_ROLE.OWNER,
]);

async function assertAssignedTechnicianOrScopedManager(user: { id: number; role: string }, ticket: any) {
  if (user.role === APP_ROLE.TECHNICIAN) {
    if (!(await isAssignedTicketTechnicianForWorkflow(user, ticket))) {
      throw new TRPCError({ code: "FORBIDDEN", message: "البلاغ غير مسند إليك" });
    }
    return;
  }
  if (executionManagerRoles.has(user.role) && canManageTicketWorkflow(user, ticket)) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية تنفيذ إجراء الفني على هذا البلاغ" });
}

export const ticketsApprovalsRouter = router({
  approve: ticketManagerProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    assertTicketWorkflowManageable(ctx.user, ticket as any);
    if (ticket.status !== "new") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "إجراء الموافقة القديم متاح فقط للبلاغات الجديدة ولا يمكن استخدامه لتجاوز الفرز أو الفحص",
      });
    }
    await db.updateTicket(input.id, { status: "approved", approvedById: ctx.user.id });
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "approved", changedById: ctx.user.id });
    // ✅ 2026-08-10: كان يبثّ لكل المشرفين بالنظام — أصبح لمشرف هذا البلاغ وحده
    // (مع سقوط احتياطي للبثّ لو لم يُفرَز بعد). راجع notifyTicketSupervisor.
    await notifyTicketSupervisor(ticket as any, {
      title: "✅ تمت الموافقة على بلاغ",
      message: `تمت الموافقة على البلاغ ${ticket.ticketNumber} من قبل المدير`,
      type: "success",
      relatedTicketId: input.id,
    }, { excludeUserId: ctx.user.id });
    return { success: true };
  }),

  assign: ticketManagerProcedure.input(z.object({
    id: z.number(),
    technicianId: z.number().optional(),           // System user technician
    externalTechnicianId: z.number().optional(),   // External technician (no account)
    reassignmentReason: z.string().trim().optional(),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    assertTicketWorkflowManageable(ctx.user, ticket as any);
    if (!input.technicianId && !input.externalTechnicianId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "يجب تحديد فني لإعادة الإسناد" });
    }
    if (input.technicianId) {
      const technician = await db.getUserById(input.technicianId);
      if (!technician || technician.role !== APP_ROLE.TECHNICIAN || technician.isActive === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "الفني المختار غير موجود أو غير نشط أو لا يحمل دور فني" });
      }
    }
    const hasExistingAssignment = Boolean(ticket.assignedToId || ticket.assignedTechnicianId);
    const assignmentChanged = ticket.assignedToId !== (input.technicianId ?? null) ||
      ticket.assignedTechnicianId !== (input.externalTechnicianId ?? null);
    if (hasExistingAssignment && !assignmentChanged) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "الفني المحدد هو الفني المسند حاليًا" });
    }
    const isReassignment = hasExistingAssignment && assignmentChanged;
    if (isReassignment && !input.reassignmentReason) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "سبب إعادة تعيين الفني مطلوب" });
    }
    // Reassign is allowed from any post-triage status
    const reassignableStatuses = ["under_inspection", "work_approved", "assigned", "in_progress", "needs_purchase", "purchase_pending_estimate", "purchase_pending_accounting", "purchase_pending_management", "purchase_approved", "purchased", "received_warehouse"];
    if (!reassignableStatuses.includes(ticket.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `لا يمكن إعادة الإسناد في الحالة: ${ticket.status}` });
    }
    const updateData: Record<string, any> = {
      assignedAt: new Date(),
    };
    if (ticket.status === "under_inspection" && (isReassignment || !ticket.inspectionWorkflowStatus)) {
      updateData.inspectionWorkflowStatus = MAINTENANCE_INSPECTION_WORKFLOW_STATUS.PENDING_SUBMISSION;
      updateData.inspectionPerformedById = null;
      updateData.inspectionRecordedById = null;
      updateData.inspectionSubmittedAt = null;
      updateData.inspectionSubmittedById = null;
      updateData.inspectionApprovedAt = null;
      updateData.inspectionApprovedById = null;
      updateData.inspectionReturnedAt = null;
      updateData.inspectionReturnedById = null;
      updateData.inspectionReturnReason = null;
      updateData.inspectionNotes = null;
    }
    // ── Phase 1: Disambiguation guard ───────────────────────────────────────
    // A ticket must not have both assignedToId (internal user) and
    // assignedTechnicianId (external technician) set simultaneously.
    // When assigning an internal user, clear the external technician slot.
    // When assigning an external technician, clear the internal user slot.
    // This is backward-compatible: existing single-assignment tickets are unaffected.
    if (input.technicianId) {
      updateData.assignedToId = input.technicianId;
      updateData.assignedTechnicianId = null; // clear external slot
    }
    if (input.externalTechnicianId) {
      updateData.assignedTechnicianId = input.externalTechnicianId;
      updateData.assignedToId = null; // clear internal slot
    }
    // ──────────────────────────────────────────────────────────────────
    await db.updateTicket(input.id, updateData);
    if (ticket.status === "under_inspection" && isReassignment) {
      await db.supersedeCurrentInspectionResults(input.id);
    }
    const assignmentNote = isReassignment
      ? `إعادة تعيين الفني — السبب: ${input.reassignmentReason}`
      : "تعيين الفني المسؤول";
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: ticket.status, changedById: ctx.user.id, notes: assignmentNote });
    await db.createAuditLog({
      userId: ctx.user.id,
      action: isReassignment ? "reassign_ticket_technician" : "assign_ticket_technician",
      entityType: "ticket",
      entityId: input.id,
      oldValues: { assignedToId: ticket.assignedToId, assignedTechnicianId: ticket.assignedTechnicianId },
      newValues: { assignedToId: updateData.assignedToId, assignedTechnicianId: updateData.assignedTechnicianId, reason: input.reassignmentReason },
    });
    if (input.technicianId) {
      await db.createNotification({ userId: input.technicianId, title: "بلاغ مُسند إليك", message: `تم إسناد البلاغ ${ticket.ticketNumber} إليك`, type: "info", relatedTicketId: input.id });
    }
    return { success: true };
  }),

  assignForInspection: ticketTriageProcedure.input(z.object({
    id: z.number(),
    assignedToId: z.number(),
    triageNotes: z.string().optional(),
  })).mutation(async () => {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "استخدم إجراء الفرز المعتمد لتحديد الجهة المسؤولة قبل تعيين الفني",
    });
  }),

  startRepair: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    await assertAssignedTechnicianOrScopedManager(ctx.user, ticket);
    if (!canStartTicketRepair(true, ticket.status, ticket.maintenancePath)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `لا يمكن بدء التنفيذ في الحالة الحالية: ${ticket.status}` });
    }
    if (ticket.maintenancePath === "B") {
      await assertPathBMaterialsDeliveredToTechnician(ticket.id);
    }
    if (ticket.maintenancePath === "C") {
      const externalJob = await db.getExternalMaintenanceJobByTicketId(ticket.id);
      if (!externalJob || externalJob.status !== "delivered_for_reinstall") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن بدء إعادة التركيب قبل استلام المستودع للأصل وتسليمه للمسؤول" });
      }
      await db.updateExternalMaintenanceJob(externalJob.id, { status: "reinstall_in_progress" });
    }
    await db.updateTicket(input.id, { status: "in_progress" });
    await db.syncSingleTicketItem(input.id, { status: "in_progress" });
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "in_progress", changedById: ctx.user.id });
    // Notify managers that work has started
    const managers = await db.getTicketWorkflowManagerUsers(ticket);
    for (const mgr of managers) {
      await db.createNotification({ userId: mgr.id, title: "🔧 بدأ تنفيذ بلاغ", message: `بدأ الفني العمل على البلاغ ${ticket.ticketNumber}`, type: "info", relatedTicketId: input.id });
    }
    return { success: true };
  }),

  completeRepair: protectedProcedure.input(z.object({
    id: z.number(),
    afterPhotoUrl: z.string().optional(),
    repairNotes: z.string().trim().min(1, "ملاحظات الإصلاح مطلوبة"),
    materialsUsed: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    await assertAssignedTechnicianOrScopedManager(ctx.user, ticket);
    if (!canSubmitStandardRepair(true, ticket.status, ticket.maintenancePath)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: ticket.maintenancePath === "A"
          ? "استخدم إجراء إكمال الإصلاح الخاص بالمسار A"
          : "يجب أن يكون البلاغ قيد التنفيذ أولاً",
      });
    }
    // Auto-translate repairNotes
    let repairTranslation: Record<string, any> = {};
    if (input.repairNotes) {
      try {
        const lang = await detectLanguage(input.repairNotes);
        const translations = await translateFields({ repairNotes: input.repairNotes }, lang);
        if (translations.repairNotes) {
          repairTranslation.repairNotesAr = translations.repairNotes.ar;
          repairTranslation.repairNotesEn = translations.repairNotes.en;
          repairTranslation.repairNotesUr = translations.repairNotes.ur;
        }
      } catch (e) {
        console.error("[Ticket] RepairNotes translation failed:", e);
      }
    }
    await db.updateTicket(input.id, { status: "repaired", afterPhotoUrl: input.afterPhotoUrl, repairNotes: input.repairNotes, materialsUsed: input.materialsUsed, ...repairTranslation });
    await db.syncSingleTicketItem(input.id, {
      status: "repaired",
      afterPhotoUrl: input.afterPhotoUrl,
      repairNotes: input.repairNotes,
      materialsUsed: input.materialsUsed,
    });
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "repaired", changedById: ctx.user.id });
    const managers = await db.getTicketWorkflowManagerUsers(ticket);
    for (const mgr of managers) {
      await db.createNotification({ userId: mgr.id, title: "تم إصلاح بلاغ", message: `تم إصلاح البلاغ ${ticket.ticketNumber}`, type: "success", relatedTicketId: input.id });
    }
    return { success: true };
  }),

  // ══════════════════════════════════════════════════════════════════════
  // تنفيذ الإصلاح على مستوى البند — المرحلة 6 (2026-08-10)
  //
  // نظيرا startRepair/completeRepair أعلاه لكن لبند بعينه. إجراءا الرأس
  // ما زالا المستخدَمين للبلاغات أحادية البند، ومنذ 2026-08-12 يزامنان
  // بند التنفيذ الوحيد حتى تبقى tickets وticket_items متسقتين.
  // توافق رجعي: البند الأول (itemNumber === 1) يعكس تحديثه على أعمدة البلاغ
  // — نفس مبدأ approveWorkForItem (الخطوة 3) وsyncPathBTicketItemFromItemId
  // (الخطوة 4)، فتبقى الشاشات والتقارير القائمة عاملة دون كسر.
  // ══════════════════════════════════════════════════════════════════════

  /** التحقق أن المستخدم فني هذا البند أو مدير مخوّل بإدارته. */
  startRepairForItem: protectedProcedure.input(z.object({ ticketItemId: z.number() })).mutation(async ({ input, ctx }) => {
    const item = await db.getTicketItemById(input.ticketItemId);
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "بند البلاغ غير موجود" });
    const ticket = await db.getTicketById(item.ticketId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });

    // الفني المسند للبند تحديدًا، أو مدير مخوّل (بالبلاغ أو بالبند).
    if (ctx.user.role === APP_ROLE.TECHNICIAN) {
      if (item.assignedToId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "هذا البند غير مسند إليك" });
      }
    } else {
      assertTicketItemWorkflowManageable(ctx.user, ticket as any, item as any);
    }

    if (!canStartTicketRepair(true, item.status, item.maintenancePath)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `لا يمكن بدء التنفيذ لهذا البند في الحالة الحالية: ${item.status}` });
    }
    if (item.maintenancePath === "B") {
      // ✅ إصلاح 2026-08-10: كانت هذه الفحص مفقودًا — بند مسار B كان يستطيع
      // بدء التنفيذ بلا تحقق من وصول مواده الفعلي. راجع ticket-purchase-workflow.ts.
      await assertPathBMaterialsDeliveredToTechnicianForItem(item.id);
    }
    if (item.maintenancePath === "C") {
      const externalJob = await db.getExternalMaintenanceJobByTicketItemId(item.id);
      if (!externalJob || externalJob.status !== "delivered_for_reinstall") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن بدء إعادة التركيب قبل استلام المستودع للأصل وتسليمه للمسؤول" });
      }
      await db.updateExternalMaintenanceJob(externalJob.id, { status: "reinstall_in_progress" });
    }

    await db.updateTicketItem(item.id, { status: "in_progress" });
    if (item.itemNumber === 1) {
      await db.updateTicket(item.ticketId, { status: "in_progress" });
    }
    await db.addTicketStatusHistory({
      ticketId: item.ticketId,
      fromStatus: item.status,
      toStatus: "in_progress",
      changedById: ctx.user.id,
      notes: `بند ${item.itemNumber} — بدء التنفيذ`,
    });

    const managers = await db.getTicketWorkflowManagerUsers(ticket);
    for (const mgr of managers) {
      await db.createNotification({ userId: mgr.id, title: "🔧 بدأ تنفيذ بند", message: `بدأ الفني العمل على بند ${item.itemNumber} ضمن البلاغ ${ticket.ticketNumber}`, type: "info", relatedTicketId: item.ticketId });
    }
    return { success: true };
  }),

  completeRepairForItem: protectedProcedure.input(z.object({
    ticketItemId: z.number(),
    afterPhotoUrl: z.string().optional(),
    repairNotes: z.string().trim().min(1, "ملاحظات الإصلاح مطلوبة"),
    materialsUsed: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const item = await db.getTicketItemById(input.ticketItemId);
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "بند البلاغ غير موجود" });
    const ticket = await db.getTicketById(item.ticketId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });

    if (ctx.user.role === APP_ROLE.TECHNICIAN) {
      if (item.assignedToId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "هذا البند غير مسند إليك" });
      }
    } else {
      assertTicketItemWorkflowManageable(ctx.user, ticket as any, item as any);
    }

    if (item.status !== "in_progress") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "يجب بدء تنفيذ البند أولاً" });
    }

    await db.updateTicketItem(item.id, {
      status: "ready_for_closure",
      afterPhotoUrl: input.afterPhotoUrl,
      repairNotes: input.repairNotes,
      materialsUsed: input.materialsUsed,
    });
    if (item.itemNumber === 1) {
      await db.updateTicket(item.ticketId, {
        status: "ready_for_closure",
        afterPhotoUrl: input.afterPhotoUrl,
        repairNotes: input.repairNotes,
        materialsUsed: input.materialsUsed,
      });
    }
    await db.addTicketStatusHistory({
      ticketId: item.ticketId,
      fromStatus: item.status,
      toStatus: "ready_for_closure",
      changedById: ctx.user.id,
      notes: `بند ${item.itemNumber} — اكتمل التنفيذ، بانتظار الاعتماد`,
    });

    const managers = await db.getTicketWorkflowManagerUsers(ticket);
    for (const mgr of managers) {
      await db.createNotification({ userId: mgr.id, title: "بند جاهز للاعتماد", message: `اكتمل تنفيذ بند ${item.itemNumber} ضمن البلاغ ${ticket.ticketNumber} — بانتظار اعتماد الإغلاق`, type: "success", relatedTicketId: item.ticketId });
    }
    return { success: true };
  }),

  /**
   * اعتماد إغلاق بند بعينه — القرار الصريح لصاحب المشروع (الخيار الأصرم):
   * كل بند يُعتمَد ويُغلق مستقلًا، والبلاغ لا يُغلق إلا بعد اكتمالها جميعًا
   * (يفرضه assertAllTicketItemsClosed بـtickets.closure.ts).
   */
  closeTicketItem: ticketScopedWorkflowManagerProcedure.input(z.object({ ticketItemId: z.number() })).mutation(async ({ input, ctx }) => {
    const item = await db.getTicketItemById(input.ticketItemId);
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "بند البلاغ غير موجود" });
    const ticket = await db.getTicketById(item.ticketId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });

    assertTicketItemWorkflowManageable(ctx.user, ticket as any, item as any);

    if (item.status !== "ready_for_closure") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "البند ليس جاهزاً للإغلاق" });
    }
    if (!item.repairNotes?.trim()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إغلاق البند دون ملاحظات الإصلاح" });
    }

    await db.updateTicketItem(item.id, { status: "closed", closedAt: new Date() });
    await db.addTicketStatusHistory({
      ticketId: item.ticketId,
      fromStatus: item.status,
      toStatus: "closed",
      changedById: ctx.user.id,
      notes: `بند ${item.itemNumber} — تم اعتماد الإغلاق`,
    });
    await db.createAuditLog({ userId: ctx.user.id, action: "close_ticket_item", entityType: "ticket_item", entityId: item.id });

    // إشعار: هل بقيت بنود غير مكتملة؟ يُبيّن للمدير الوضع بعد إغلاق هذا البند.
    const allItems = await db.getTicketItems(item.ticketId);
    const remaining = allItems.filter((i: any) => !["closed", "verified", "requester_confirmed"].includes(i.status));
    if (remaining.length === 0 && item.assignedToId) {
      await db.createNotification({ userId: item.assignedToId, title: "✅ اكتملت كل بنود البلاغ", message: `اكتملت كل بنود البلاغ ${ticket.ticketNumber} — أصبح جاهزاً للإغلاق النهائي`, type: "success", relatedTicketId: item.ticketId });
    }
    return { success: true, remainingItems: remaining.length };
  }),
});
