import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure, ticketProcedure, ticketScopedWorkflowManagerProcedure, ticketScopedClosureProcedure, supervisorProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";
import { APP_ROLE } from "@shared/roles";
import { isPathARepairCompletionStage, isPathARepairEvidenceComplete, isPathBRepairEvidenceComplete, areAllTicketItemsComplete, getIncompleteTicketItems, summarizeSubTicketFamily } from "@shared/ticketUiRules";
import { assertPathBMaterialsDeliveredToTechnician } from "../purchase/ticket-purchase-workflow";
import { notifyTicketSupervisor } from "../_shared/router-helpers";
import { assertTicketReadable, assertTicketWorkflowManageable, canManageTicketWorkflow, isAssignedTicketTechnicianForWorkflow } from "./tickets.access";
import { pmv2TicketClosureSyncService } from "../../pmv2/tickets/closure-sync-service";
import { detectLanguage } from "../../services/translation/translation";
import { queueTranslation } from "../../services/translation/translationEngine";


async function queueRepairNotesTranslation(ticketId: number, repairNotes: string, userId: number): Promise<void> {
  const sourceLanguage = await detectLanguage(repairNotes).catch(() => "ar" as const);
  queueTranslation({
    entityType: "TICKET",
    entityId: ticketId,
    fields: [{ fieldName: "repairNotes", text: repairNotes }],
    sourceLanguage,
    userId,
  }).catch(error => console.error("[TICKET] repairNotes translation queue failed:", error));
}

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

/**
 * حارس إغلاق البلاغ متعدد البنود — المرحلة 6 (2026-08-10).
 *
 * قرار صريح من صاحب المشروع (الخيار الأصرم): البلاغ لا يُغلق إلا بعد أن تكون
 * **كل** بنوده مغلقة فعليًا باعتماد مستقل. "جاهز للإغلاق" لا تُعدّ اكتمالًا.
 *
 * ✅ توافق رجعي كامل: بلاغ ببند واحد (كل البلاغات القديمة + أي بلاغ فُرز لجهة
 * واحدة) يُستثنى صراحةً — يسلك السلوك القديم حرفيًا بلا أي فحص إضافي.
 * **الفحص يُضاف ولا يستبدل أي فحص إغلاق قائم.**
 *
 * ملاحظة: البلاغ بلا بنود إطلاقًا (حالة نادرة — أُنشئ قبل ربط tickets.create
 * بالبند التلقائي ولم يُشغَّل عليه الترحيل) لا يُمنع من الإغلاق حتى لا يُحتجز
 * إداريًا بلا سبب — لذلك الشرط `length <= 1` لا `length === 1`.
 */
async function assertAllTicketItemsClosed(ticketId: number): Promise<void> {
  const items = await db.getTicketItems(ticketId);
  if (items.length <= 1) return;
  if (areAllTicketItemsComplete(items as any)) return;

  const incomplete = getIncompleteTicketItems(items as any);
  const details = incomplete
    .map((item: any) => `بند ${item.itemNumber}${item.description ? ` (${String(item.description).slice(0, 40)})` : ""}`)
    .join("، ");
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `لا يمكن إغلاق البلاغ قبل اكتمال كل بنوده. البنود غير المكتملة: ${details}`,
  });
}

export const ticketsClosureRouter = router({

  /**
   * إغلاق البلاغ الرئيسي متعدد الجهات (workflowModel = department_tasks).
   *
   * سبب وجوده: الرأس كان يعلق على `department_planning` إلى الأبد. مساراته
   * الثلاثة القائمة (close / closeBySupervisor / finalClose) تشترط كلها حالة
   * أو مسار صيانة لا يملكهما الرأس إطلاقًا (`maintenancePath = null`)، فلم يكن
   * هناك أي طريق يغلقه — حتى بعد انتهاء كل أبنائه وتأكيد مقدّم البلاغ.
   *
   * القرار المعتمد: إغلاق **يدوي بحارس** لا تلقائي — يبقى توقيع مسؤول فعلي على
   * الإغلاق في سجل التدقيق، مع تمييز بصري بالواجهة يمنع نسيانه.
   */
  closeParentTicket: ticketScopedClosureProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const parent = await db.getTicketById(input.id);
    if (!parent) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    assertTicketWorkflowManageable(ctx.user, parent as any);
    if (parent.workflowModel !== "department_tasks") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإغلاق مخصص للبلاغ الرئيسي متعدد الجهات فقط" });
    }
    if (parent.status === "closed" || parent.status === "requester_confirmed") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ الرئيسي مغلق بالفعل" });
    }

    const children = await db.getSubTicketsByParent(parent.id);
    const summary = summarizeSubTicketFamily(children as any);
    // ⚠️ قاعدة #1: summarizeSubTicketFamily تتحقق من total > 0 داخليًا، فبلاغ
    // لم تُحوَّل مهامه بعد لا يمر من هنا بدل أن يُعدّ "مكتملًا" بمصفوفة فارغة.
    if (!summary.allFinished) {
      const pending = (children as any[])
        .filter((child: any) => !["closed", "requester_confirmed"].includes(child.status))
        .map((child: any) => child.ticketNumber)
        .join("، ");
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: summary.total === 0
          ? "لا يمكن إغلاق البلاغ الرئيسي قبل تحويل مهامه إلى بلاغات فرعية"
          : `لا يمكن إغلاق البلاغ الرئيسي قبل انتهاء كل بلاغاته الفرعية. المتبقي: ${pending}`,
      });
    }

    const closedAt = new Date();
    await db.withTransaction(async (tx: any) => {
      await db.updateTicket(parent.id, { status: "closed", closedAt }, tx);
      // البند التوافقي تحت الرأس يعلق هو الآخر على department_planning؛ بدون
      // إغلاقه يرفض حارس assertAllTicketItemsClosed أي إجراء لاحق على البلاغ.
      const items = await db.getTicketItems(parent.id, tx);
      for (const item of items) {
        if (!["closed", "verified", "requester_confirmed"].includes(item.status)) {
          await db.updateTicketItem(item.id, { status: "closed", closedAt }, tx);
        }
      }
      // الجهات والمهام تبقى active/promoted بعد التحويل — نُنهيها مع الرأس حتى
      // لا تظهر جهة "قيد العمل" تحت بلاغ مغلق. القيمتان موجودتان أصلًا في enum
      // قاعدة البيانات (ticket_departments.status / ticket_tasks.status) فلا حاجة لأي migration.
      const departments = await db.getTicketDepartments(parent.id, tx);
      for (const dept of departments) {
        if (dept.status !== "completed") await db.updateTicketDepartment(dept.id, { status: "completed" }, tx);
      }
      const tasks = await db.getTicketTasks(parent.id, tx);
      for (const task of tasks) {
        if (task.status === "promoted") await db.updateTicketTask(task.id, { status: "completed" }, tx);
      }
      await pmv2TicketClosureSyncService.syncClosedTicketWithDb(tx, {
        ticketId: parent.id,
        actorUserId: ctx.user.id,
      });
    });

    await db.addTicketStatusHistory({
      ticketId: parent.id, fromStatus: parent.status, toStatus: "closed", changedById: ctx.user.id,
      notes: `إغلاق البلاغ الرئيسي بعد انتهاء ${summary.total} بلاغ فرعي (${summary.confirmed} منها بتأكيد مقدّم البلاغ)`,
    });
    await db.createAuditLog({
      userId: ctx.user.id, action: "close_parent_ticket", entityType: "ticket", entityId: parent.id,
      newValues: { subTicketCount: summary.total, confirmedCount: summary.confirmed },
    });
    if (parent.reportedById) {
      await db.createNotification({ userId: parent.reportedById, title: "🔒 تم إغلاق بلاغك الرئيسي", message: `اكتملت كل البلاغات الفرعية وأُغلق البلاغ ${parent.ticketNumber}`, type: "success", relatedTicketId: parent.id });
    }
    const managers = await db.getTicketWorkflowManagerUsers(parent);
    for (const mgr of managers) {
      if (mgr.id === ctx.user.id) continue;
      await db.createNotification({ userId: mgr.id, title: "🔒 تم إغلاق بلاغ رئيسي", message: `أُغلق البلاغ الرئيسي ${parent.ticketNumber} بعد اكتمال بلاغاته الفرعية`, type: "success", relatedTicketId: parent.id });
    }
    return { success: true, subTicketCount: summary.total };
  }),

  getConfirmation: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    await assertTicketReadable(ctx.user, ticket as any);
    const confirmation = await db.getTicketConfirmation(input.id);
    if (!confirmation) return null;
    const confirmedBy = await db.getUserById(confirmation.confirmedById);
    return {
      ...confirmation,
      confirmedByName: confirmedBy?.name || confirmedBy?.username || "غير معروف",
    };
  }),

  close: ticketScopedWorkflowManagerProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    assertTicketWorkflowManageable(ctx.user, ticket as any);
    const isLegacyRepairedTicket = ticket.status === "repaired" && !ticket.maintenancePath;
    const isReadyPathBOrC =
      ticket.status === "ready_for_closure" &&
      (ticket.maintenancePath === "B" || ticket.maintenancePath === "C");
    if (!isLegacyRepairedTicket && !isReadyPathBOrC) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ ليس جاهزاً للإغلاق في مساره المعتمد" });
    }
    if (isReadyPathBOrC && !ticket.repairNotes?.trim()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إغلاق البلاغ دون ملاحظات الإصلاح" });
    }
    if (ticket.maintenancePath === "C") {
      const externalJob = await db.getExternalMaintenanceJobByTicketId(ticket.id);
      if (!externalJob || externalJob.status !== "ready_for_closure") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "لا يمكن إغلاق المسار C قبل توثيق الخروج والدخول واستلام المستودع وتسليم الأصل وإعادة تركيبه",
        });
      }
    }
    // ⚠️ المرحلة 6 (2026-08-10): البلاغ متعدد البنود لا يُغلق قبل اكتمال كل بنوده.
    // يُفحص بعد كل الفحوصات القائمة (لا يستبدلها) — بلاغ أحادي البند غير متأثر.
    await assertAllTicketItemsClosed(input.id);

    const closedAt = new Date();
    await db.withTransaction(async (tx: any) => {
      await db.updateTicket(input.id, { status: "closed", closedAt }, tx);
      await db.syncSingleTicketItem(input.id, { status: "closed", closedAt }, tx);
      if (ticket.maintenancePath === "C") {
        await db.updateExternalMaintenanceJobByTicketId(ticket.id, { status: "closed" }, tx);
      }
      await pmv2TicketClosureSyncService.syncClosedTicketWithDb(tx, {
        ticketId: input.id,
        actorUserId: ctx.user.id,
      });
    });
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "closed", changedById: ctx.user.id });
    await db.createAuditLog({ userId: ctx.user.id, action: "close_ticket", entityType: "ticket", entityId: input.id });
    // Notify reporter and assigned technician
    if (ticket.reportedById) {
      await db.createNotification({ userId: ticket.reportedById, title: "🔒 تم إغلاق بلاغك", message: `تم إغلاق البلاغ ${ticket.ticketNumber} بنجاح. يرجى الدخول لتأكيد إتمام العمل وإرفاق صور الإصلاح`, type: "success", relatedTicketId: input.id });
    }
    if (ticket.assignedToId && ticket.assignedToId !== ticket.reportedById) {
      await db.createNotification({ userId: ticket.assignedToId, title: "🔒 تم إغلاق البلاغ", message: `تم إغلاق البلاغ ${ticket.ticketNumber} الذي كنت مسؤولاً عنه`, type: "success", relatedTicketId: input.id });
    }
    return { success: true };
  }),

  markReadyForClosure: protectedProcedure.input(z.object({
    id: z.number(),
    afterPhotoUrl: z.string().optional(),
    repairNotes: z.string().trim().min(1, "ملاحظات الإصلاح مطلوبة"),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    await assertAssignedTechnicianOrScopedManager(ctx.user, ticket);
    if (!isPathARepairCompletionStage(ticket.status, ticket.maintenancePath)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: ticket.maintenancePath !== "A"
          ? "هذا الإجراء للمسار A فقط"
          : "يجب الضغط على بدء الإصلاح قبل رفع نتيجة الإصلاح وإرسال البلاغ للإغلاق",
      });
    }
    if (!isPathARepairEvidenceComplete(input.repairNotes, input.afterPhotoUrl)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "يجب كتابة ملاحظات الإصلاح قبل إرسال البلاغ للإغلاق",
      });
    }
    await db.updateTicket(input.id, { status: "ready_for_closure", afterPhotoUrl: input.afterPhotoUrl, repairNotes: input.repairNotes });
    await db.syncSingleTicketItem(input.id, { status: "ready_for_closure", afterPhotoUrl: input.afterPhotoUrl, repairNotes: input.repairNotes });
    await queueRepairNotesTranslation(input.id, input.repairNotes, ctx.user.id);
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "ready_for_closure", changedById: ctx.user.id });
    // ✅ 2026-08-10: كان يبثّ لكل المشرفين — أصبح لمشرف هذا البلاغ وحده،
    // مع إبقاء مديري المسار كمستلمين إضافيين (بلا تكرار — الدالة تدمجهم بـMap).
    const routeManagers = await db.getTicketWorkflowManagerUsers(ticket);
    await notifyTicketSupervisor(ticket as any, {
      title: "بلاغ جاهز للإغلاق",
      message: `البلاغ ${ticket.ticketNumber} جاهز للإغلاق - المسار A`,
      type: "success",
      relatedTicketId: input.id,
    }, { excludeUserId: ctx.user.id, extraRecipients: routeManagers });
    return { success: true };
  }),

  closeBySupervisor: ticketScopedClosureProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    assertTicketWorkflowManageable(ctx.user, ticket as any);
    if (ticket.status !== "ready_for_closure") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ ليس جاهزاً للإغلاق" });
    if (ticket.maintenancePath !== "A") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "إغلاق المشرف مخصص للمسار A فقط" });
    }
    if (!ticket.repairNotes?.trim()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إغلاق البلاغ دون ملاحظات الإصلاح" });
    }
    // ⚠️ المرحلة 6 (2026-08-10): نفس حارس close — بلاغ متعدد البنود لا يُغلق قبل اكتمالها.
    await assertAllTicketItemsClosed(input.id);
    const closedAt = new Date();
    await db.withTransaction(async (tx: any) => {
      await db.updateTicket(input.id, { status: "closed", closedAt }, tx);
      await db.syncSingleTicketItem(input.id, { status: "closed", closedAt }, tx);
      await pmv2TicketClosureSyncService.syncClosedTicketWithDb(tx, {
        ticketId: input.id,
        actorUserId: ctx.user.id,
      });
    });
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "closed", changedById: ctx.user.id });
    await db.createAuditLog({ userId: ctx.user.id, action: "close_ticket", entityType: "ticket", entityId: input.id });
    // Notify managers, reporter, and technician
    const managersSup = await db.getTicketWorkflowManagerUsers(ticket);
    for (const mgr of managersSup) {
      await db.createNotification({ userId: mgr.id, title: "🔒 تم إغلاق بلاغ", message: `أغلق المشرف البلاغ ${ticket.ticketNumber}`, type: "success", relatedTicketId: input.id });
    }
    if (ticket.reportedById) {
      await db.createNotification({ userId: ticket.reportedById, title: "🔒 تم إغلاق بلاغك", message: `تم إغلاق البلاغ ${ticket.ticketNumber} بنجاح. يرجى الدخول لتأكيد إتمام العمل وإرفاق صور الإصلاح`, type: "success", relatedTicketId: input.id });
    }
    if (ticket.assignedToId && ticket.assignedToId !== ticket.reportedById) {
      await db.createNotification({ userId: ticket.assignedToId, title: "🔒 تم إغلاق البلاغ", message: `تم إغلاق البلاغ ${ticket.ticketNumber}`, type: "success", relatedTicketId: input.id });
    }
    return { success: true };
  }),

  finalClose: supervisorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    assertTicketWorkflowManageable(ctx.user, ticket as any);
    if (ticket.maintenancePath) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "الإغلاق النهائي القديم غير متاح لمسارات الصيانة A/B/C" });
    }
    if (ticket.status !== "verified") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون مُتحقق منه" });
    const closedAt = new Date();
    await db.withTransaction(async (tx: any) => {
      await db.updateTicket(input.id, { status: "closed", closedAt }, tx);
      await db.syncSingleTicketItem(input.id, { status: "closed", closedAt }, tx);
      await pmv2TicketClosureSyncService.syncClosedTicketWithDb(tx, {
        ticketId: input.id,
        actorUserId: ctx.user.id,
      });
    });
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "verified", toStatus: "closed", changedById: ctx.user.id });
    await db.createAuditLog({ userId: ctx.user.id, action: "close_ticket", entityType: "ticket", entityId: input.id });
    // Notify ticket creator and assigned technician
    if (ticket.reportedById) {
      await db.createNotification({ userId: ticket.reportedById, title: "🔒 تم إغلاق بلاغك", message: `تم إغلاق البلاغ ${ticket.ticketNumber} بنجاح. يرجى الدخول لتأكيد إتمام العمل وإرفاق صور الإصلاح`, type: "success", relatedTicketId: input.id });
    }
    if (ticket.assignedToId && ticket.assignedToId !== ticket.reportedById) {
      await db.createNotification({ userId: ticket.assignedToId, title: "🔒 تم إغلاق البلاغ", message: `تم إغلاق البلاغ ${ticket.ticketNumber} الذي كنت مسؤولاً عنه`, type: "success", relatedTicketId: input.id });
    }
    return { success: true };
  }),

  completeWithParts: protectedProcedure.input(z.object({
    id: z.number(),
    afterPhotoUrl: z.string().trim().optional(),
    repairNotes: z.string().trim().min(1, "ملاحظات الإصلاح مطلوبة"),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    await assertAssignedTechnicianOrScopedManager(ctx.user, ticket);
    if (ticket.maintenancePath !== "B" && ticket.maintenancePath !== "C") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء للمسار B أو C فقط" });
    const expectedStatus = "in_progress";
    if (ticket.status !== expectedStatus) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: ticket.maintenancePath === "B"
          ? "يجب الضغط على بدء الإصلاح بعد تسليم المواد وقبل إكمال العمل"
          : "يجب الضغط على بدء إعادة التركيب قبل إكمال المسار C",
      });
    }
    if (!isPathBRepairEvidenceComplete(input.repairNotes, input.afterPhotoUrl)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "يجب كتابة ملاحظات الإصلاح قبل إرسال البلاغ للإغلاق",
      });
    }
    if (ticket.maintenancePath === "B") {
      await assertPathBMaterialsDeliveredToTechnician(ticket.id);
    }
    await db.updateTicket(input.id, { status: "ready_for_closure", afterPhotoUrl: input.afterPhotoUrl, repairNotes: input.repairNotes });
    await db.syncSingleTicketItem(input.id, { status: "ready_for_closure", afterPhotoUrl: input.afterPhotoUrl, repairNotes: input.repairNotes });
    await queueRepairNotesTranslation(input.id, input.repairNotes, ctx.user.id);
    if (ticket.maintenancePath === "C") {
      await db.updateExternalMaintenanceJobByTicketId(ticket.id, { status: "ready_for_closure" });
    }
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "ready_for_closure", changedById: ctx.user.id });
    // إشعار المشرفين: كانت هذه الخطوة (خلافاً لـ markReadyForClosure الخاصة بالمسار A)
    // لا تنبّه أحداً، فتبقى البلاغات من المسار B/C جاهزة للإغلاق دون أن يعلم أحد.
    // ✅ 2026-08-10: كان يبثّ لكل المشرفين — أصبح لمشرف هذا البلاغ وحده،
    // مع إبقاء مديري المسار كمستلمين إضافيين.
    const routeManagersParts = await db.getTicketWorkflowManagerUsers(ticket);
    await notifyTicketSupervisor(ticket as any, {
      title: "بلاغ جاهز للإغلاق",
      message: ticket.maintenancePath === "C"
        ? `البلاغ ${ticket.ticketNumber} جاهز للإغلاق بعد إعادة تركيب الأصل العائد من الصيانة الخارجية`
        : `البلاغ ${ticket.ticketNumber} جاهز للإغلاق بعد استلام واستخدام المواد`,
      type: "success",
      relatedTicketId: input.id,
    }, { excludeUserId: ctx.user.id, extraRecipients: routeManagersParts });
    return { success: true };
  }),

  // تأكيد منشئ البلاغ إتمام العمل فعلياً بعد إغلاق البلاغ
  // فقط منشئ البلاغ نفسه أو owner/admin يستطيع تنفيذ هذا الإجراء
  //
  // ✅ 2026-08-08: الملاحظة إلزامية، والصورة أصبحت اختيارية بطلب صاحب المشروع
  // (كانت صورة واحدة على الأقل إلزامية). عمود photoUrls بقاعدة البيانات
  // NOT NULL من نوع json — مصفوفة فارغة [] تحقق NOT NULL دون أي تعديل Schema.
  confirmCompletion: ticketProcedure.input(z.object({
    id: z.number(),
    note: z.string().min(1, "الملاحظة مطلوبة"),
    photoUrls: z.array(z.string()).max(4, "الحد الأقصى 4 صور").optional().default([]),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    if (ticket.status !== "closed") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون مغلقاً أولاً" });

    const isOwnerOrAdmin = ctx.user.role === "owner" || ctx.user.role === "admin";
    if (ticket.reportedById !== ctx.user.id && !isOwnerOrAdmin) {
      throw new TRPCError({ code: "FORBIDDEN", message: "فقط منشئ البلاغ يستطيع تأكيد إتمام العمل" });
    }

    await db.createTicketConfirmation({
      ticketId: input.id,
      confirmedById: ctx.user.id,
      note: input.note,
      photoUrls: input.photoUrls,
    });
    await db.updateTicket(input.id, { status: "requester_confirmed" });
    await db.syncSingleTicketItem(input.id, { status: "requester_confirmed" });
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "closed", toStatus: "requester_confirmed", changedById: ctx.user.id });
    await db.createAuditLog({ userId: ctx.user.id, action: "confirm_ticket_completion", entityType: "ticket", entityId: input.id });

    // إشعار للمدير المسؤول والفني المكلّف بأن صاحب البلاغ أكّد إتمام العمل
    const managers = await db.getTicketWorkflowManagerUsers(ticket);
    for (const mgr of managers) {
      await db.createNotification({ userId: mgr.id, title: "✅ تأكيد إتمام العمل", message: `أكّد صاحب البلاغ ${ticket.ticketNumber} إتمام العمل فعلياً`, type: "success", relatedTicketId: input.id });
    }
    if (ticket.assignedToId) {
      await db.createNotification({ userId: ticket.assignedToId, title: "✅ تأكيد إتمام العمل", message: `أكّد صاحب البلاغ ${ticket.ticketNumber} إتمام العمل الذي قمت به`, type: "success", relatedTicketId: input.id });
    }

    return { success: true };
  }),
});
