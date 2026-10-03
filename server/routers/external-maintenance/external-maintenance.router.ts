import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { APP_ROLE, MAINTENANCE_RESPONSIBLE_DEPARTMENT } from "@shared/roles";
import {
  canGateApproveExternalEntry,
  canGateApproveExternalExit,
  canWarehouseHandOverExternalAsset,
  canWarehouseReceiveExternalAsset,
} from "@shared/externalMaintenanceWorkflow";
import {
  gateSecurityProcedure,
  protectedProcedure,
  router,
  warehouseProcedure,
} from "../_shared/procedures";
import * as db from "../../_core/db";
import { assertTicketReadable } from "../tickets/tickets.access";
import { queueTranslation } from "../../services/translation/translationEngine";
import { detectLanguage } from "../../services/translation/translation";

function translateExternalDbError(error: unknown): never {
  const code = error instanceof Error ? error.message : String(error);
  const messages: Record<string, string> = {
    EXTERNAL_JOB_EXISTS: "تم تجهيز الأصل لهذا البلاغ مسبقًا",
    EXTERNAL_JOB_NOT_FOUND: "سجل الصيانة الخارجية غير موجود",
    EXTERNAL_JOB_INVALID_EXIT_STAGE: "لا يمكن اعتماد الخروج في المرحلة الحالية",
    EXTERNAL_JOB_INVALID_ENTRY_STAGE: "لا يمكن اعتماد الدخول قبل اكتمال دورة الصيانة الخارجية",
    EXTERNAL_JOB_INVALID_RECEIPT_STAGE: "لا يمكن للمستودع استلام الأصل قبل موافقة الحراسة على الدخول",
    EXTERNAL_JOB_INVALID_HANDOVER_STAGE: "لا يمكن تسليم الأصل للفني قبل تسجيل استلامه في المستودع",
    EXTERNAL_JOB_DELEGATE_REQUIRED: "يجب تحديد المندوب المسؤول قبل خروج الأصل",
    EXTERNAL_TICKET_INVALID_EXIT_STAGE: "البلاغ ليس جاهزًا لخروج الأصل في المسار C",
    EXTERNAL_TICKET_ASSIGNED_TECHNICIAN_REQUIRED: "يجب وجود فني مسند للبلاغ قبل تسليم الأصل لإعادة التركيب",
  };
  throw new TRPCError({
    code: code.includes("EXISTS") ? "CONFLICT" : "BAD_REQUEST",
    message: messages[code] || "تعذر تنفيذ إجراء الصيانة الخارجية",
  });
}


async function queueExternalJobTranslation(
  jobId: number,
  fields: Array<{ fieldName: string; text?: string | null }>,
  userId?: number,
) {
  const normalized = fields
    .map(field => ({ fieldName: field.fieldName, text: (field.text || "").trim() }))
    .filter(field => field.text.length > 0);
  if (!normalized.length) return;
  const sourceLanguage = await detectLanguage(normalized[0].text).catch(() => "ar" as const);
  await queueTranslation({
    entityType: "EXTERNAL_MAINTENANCE_JOB",
    entityId: jobId,
    fields: normalized,
    sourceLanguage,
    userId,
  });
}

async function assertActiveUserWithRole(userId: number, allowedRoles: string[], message: string) {
  const user = await db.getUserById(userId);
  if (!user || user.isActive === 0 || !allowedRoles.includes(user.role)) {
    throw new TRPCError({ code: "BAD_REQUEST", message });
  }
  return user;
}

export const externalMaintenanceRouter = router({
  getByTicket: protectedProcedure.input(z.object({ ticketId: z.number() })).query(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.ticketId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    await assertTicketReadable(ctx.user, ticket as any);
    return db.getExternalMaintenanceJobByTicketId(input.ticketId);
  }),

  listForWarehouse: warehouseProcedure.query(async () => {
    const [waitingPreparation, jobs] = await Promise.all([
      db.listPathCTicketsWaitingWarehousePreparation(),
      db.listExternalMaintenanceJobs([
        "waiting_gate_exit",
        "purchase_cycle",
        "waiting_gate_entry",
        "waiting_warehouse_receipt",
        "waiting_technician_handover",
        "delivered_for_reinstall",
        "reinstall_in_progress",
        "ready_for_closure",
        "closed",
      ]),
    ]);
    return { waitingPreparation, jobs };
  }),

  listForGate: gateSecurityProcedure.query(async () => {
    return db.listExternalMaintenanceJobs([
      "waiting_gate_exit",
      "purchase_cycle",
      "waiting_gate_entry",
      "waiting_warehouse_receipt",
      "waiting_technician_handover",
      "delivered_for_reinstall",
      "reinstall_in_progress",
      "ready_for_closure",
      "closed",
    ]);
  }),

  prepareByWarehouse: warehouseProcedure.input(z.object({
    ticketId: z.number(),
    // بند البلاغ المستهدف — الخطوة 5 (2026-08-08). اختياري: إن أُغفل، يُستخدم
    // البند الأول تلقائيًا (البلاغ أحادي البند — الأغلبية الساحقة — لا يحتاج
    // الواجهة القديمة تمرير هذا الحقل إطلاقًا، فيسلك نفس السلوك القديم حرفيًا).
    ticketItemId: z.number().optional(),
    assetName: z.string().trim().min(1, "اسم الأصل مطلوب"),
    assetBeforePhotoUrl: z.string().trim().min(1, "صورة الأصل قبل الخروج مطلوبة"),
    assetBeforeCondition: z.string().trim().min(1, "وصف حالة الأصل قبل الخروج مطلوب"),
    delegateId: z.number(),
    warehouseNotes: z.string().trim().optional(),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.ticketId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });

    let ticketItemId = input.ticketItemId;
    if (!ticketItemId) {
      const items = await db.getTicketItems(input.ticketId);
      const primary = items.find((i: any) => i.itemNumber === 1) ?? items[0];
      if (!primary) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يوجد بند لهذا البلاغ" });
      ticketItemId = primary.id;
    }
    const item = await db.getTicketItemById(ticketItemId);
    if (!item || item.ticketId !== input.ticketId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "بند البلاغ غير مطابق لهذا البلاغ" });
    }
    if (item.maintenancePath !== "C" || item.status !== "work_approved") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "البند ليس في مرحلة تجهيز أصل المسار C" });
    }
    await assertActiveUserWithRole(input.delegateId, [APP_ROLE.DELEGATE], "يجب اختيار مندوب صالح");

    try {
      const result = await db.prepareExternalMaintenanceJob({
        ticketId: input.ticketId,
        ticketItemId,
        assetName: input.assetName,
        assetBeforePhotoUrl: input.assetBeforePhotoUrl,
        assetBeforeCondition: input.assetBeforeCondition,
        delegateId: input.delegateId,
        warehouseNotes: input.warehouseNotes,
        warehousePreparedById: ctx.user.id,
      });
      await queueExternalJobTranslation(result.jobId, [
        { fieldName: "assetName", text: input.assetName },
        { fieldName: "assetBeforeCondition", text: input.assetBeforeCondition },
        { fieldName: "warehouseNotes", text: input.warehouseNotes },
      ], ctx.user.id);
      const gateUsers = await db.getUsersByRole(APP_ROLE.GATE_SECURITY);
      for (const gateUser of gateUsers) {
        await db.createNotification({
          userId: gateUser.id,
          title: "🚪 أصل بانتظار موافقة الخروج",
          message: `تم تجهيز الأصل للبلاغ ${ticket.ticketNumber}. وثيقة الخروج ${result.exitDocumentNumber} بانتظار موافقة الحراسة.`,
          type: "warning",
          relatedTicketId: ticket.id,
        });
      }
      await db.createNotification({
        userId: input.delegateId,
        title: "تم اختيارك لمهمة صيانة خارجية",
        message: `تم اختيارك لمتابعة الأصل المرتبط بالبلاغ ${ticket.ticketNumber}. ستظهر المهمة بعد موافقة الحراسة على الخروج.`,
        type: "info",
        relatedTicketId: ticket.id,
      });
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "prepare_external_maintenance_asset",
        entityType: "ticket",
        entityId: ticket.id,
        newValues: { delegateId: input.delegateId, exitDocumentNumber: result.exitDocumentNumber },
      });
      return result;
    } catch (error) {
      translateExternalDbError(error);
    }
  }),

  approveGateExit: gateSecurityProcedure.input(z.object({
    jobId: z.number(),
    carrierName: z.string().trim().min(2, "اسم الشخص الذي أخرج الأصل مطلوب"),
    notes: z.string().trim().optional(),
  })).mutation(async ({ input, ctx }) => {
    const job = await db.getExternalMaintenanceJobById(input.jobId);
    if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "سجل الصيانة الخارجية غير موجود" });
    if (!canGateApproveExternalExit(job.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن اعتماد الخروج في المرحلة الحالية" });
    }
    try {
      const result = await db.approveExternalMaintenanceGateExit({
        jobId: input.jobId,
        gateUserId: ctx.user.id,
        carrierName: input.carrierName,
        notes: input.notes,
      });
      await queueExternalJobTranslation(input.jobId, [
        { fieldName: "gateExitNotes", text: input.notes },
      ], ctx.user.id);
      if (result.job.delegateId) {
        await db.createNotification({
          userId: result.job.delegateId,
          title: "🔧 مهمة صيانة خارجية جاهزة للتسعير",
          message: `وافقت الحراسة على خروج الأصل للبلاغ ${result.ticket.ticketNumber}. الطلب ${result.poNumber} جاهز للتسعير بنفس دورة طلب الشراء.`,
          type: "success",
          relatedTicketId: result.ticket.id,
          relatedPoId: result.purchaseOrderId,
        });
      }
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "external_gate_exit_approved",
        entityType: "external_maintenance_job",
        entityId: input.jobId,
        newValues: { carrierName: input.carrierName, purchaseOrderId: result.purchaseOrderId },
      });
      return { success: true, purchaseOrderId: result.purchaseOrderId, poNumber: result.poNumber };
    } catch (error) {
      translateExternalDbError(error);
    }
  }),

  approveGateEntry: gateSecurityProcedure.input(z.object({
    jobId: z.number(),
    carrierName: z.string().trim().min(2, "اسم الشخص الذي أعاد الأصل مطلوب"),
    notes: z.string().trim().optional(),
  })).mutation(async ({ input, ctx }) => {
    const job = await db.getExternalMaintenanceJobById(input.jobId);
    if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "سجل الصيانة الخارجية غير موجود" });
    if (!canGateApproveExternalEntry(job.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن اعتماد الدخول قبل اكتمال الصيانة الخارجية" });
    }
    try {
      const result = await db.approveExternalMaintenanceGateEntry({
        jobId: input.jobId,
        gateUserId: ctx.user.id,
        carrierName: input.carrierName,
        notes: input.notes,
      });
      await queueExternalJobTranslation(input.jobId, [
        { fieldName: "gateEntryNotes", text: input.notes },
      ], ctx.user.id);
      const ticket = await db.getTicketById(result.ticketId);
      const warehouseUsers = await db.getUsersByRole(APP_ROLE.WAREHOUSE);
      for (const warehouseUser of warehouseUsers) {
        await db.createNotification({
          userId: warehouseUser.id,
          title: "📦 أصل عائد بانتظار استلام المستودع",
          message: `وافقت الحراسة على دخول الأصل المرتبط بالبلاغ ${ticket?.ticketNumber || result.ticketId}.`,
          type: "info",
          relatedTicketId: result.ticketId,
        });
      }
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "external_gate_entry_approved",
        entityType: "external_maintenance_job",
        entityId: input.jobId,
        newValues: { carrierName: input.carrierName },
      });
      return { success: true };
    } catch (error) {
      translateExternalDbError(error);
    }
  }),

  receiveByWarehouse: warehouseProcedure.input(z.object({
    jobId: z.number(),
    assetAfterReturnPhotoUrl: z.string().trim().min(1, "صورة الأصل بعد العودة مطلوبة"),
    returnCondition: z.string().trim().min(1, "حالة الأصل عند العودة مطلوبة"),
    workshopReportUrl: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  })).mutation(async ({ input, ctx }) => {
    const job = await db.getExternalMaintenanceJobById(input.jobId);
    if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "سجل الصيانة الخارجية غير موجود" });
    if (!canWarehouseReceiveExternalAsset(job.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن استلام الأصل قبل موافقة الحراسة على الدخول" });
    }
    try {
      const result = await db.receiveExternalMaintenanceAsset({
        ...input,
        warehouseUserId: ctx.user.id,
      });
      await queueExternalJobTranslation(input.jobId, [
        { fieldName: "returnCondition", text: input.returnCondition },
        { fieldName: "warehouseReturnNotes", text: input.notes },
      ], ctx.user.id);
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "receive_external_asset_by_warehouse",
        entityType: "external_maintenance_job",
        entityId: input.jobId,
        newValues: { returnDocumentNumber: result.returnDocumentNumber },
      });
      return { success: true, returnDocumentNumber: result.returnDocumentNumber };
    } catch (error) {
      translateExternalDbError(error);
    }
  }),

  handoverByWarehouse: warehouseProcedure.input(z.object({
    jobId: z.number(),
    actualRecipientId: z.number(),
    notes: z.string().trim().optional(),
  })).mutation(async ({ input, ctx }) => {
    const job = await db.getExternalMaintenanceJobById(input.jobId);
    if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "سجل الصيانة الخارجية غير موجود" });
    if (!canWarehouseHandOverExternalAsset(job.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "الأصل غير جاهز للتسليم للفني" });
    }
    const recipient = await assertActiveUserWithRole(
      input.actualRecipientId,
      [
        APP_ROLE.TECHNICIAN,
        APP_ROLE.SUPERVISOR,
        APP_ROLE.MAINTENANCE_MANAGER,
        APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
        APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
        APP_ROLE.IT_MANAGER,
        APP_ROLE.ADMIN,
        APP_ROLE.OWNER,
      ],
      "يجب اختيار فني أو مسؤول صالح لاستلام الأصل",
    );
    if (recipient.role === APP_ROLE.IT_MANAGER) {
      const ticket = await db.getTicketById(job.ticketId);
      if (
        !ticket ||
        ticket.maintenanceResponsibleDepartment !== MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT ||
        ticket.maintenanceResponsibleManagerId !== recipient.id ||
        ticket.assignedToId !== recipient.id
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "مدير تقنية المعلومات يمكنه استلام الأصل فقط لبلاغ IT المسند إليه",
        });
      }
    }
    try {
      const result = await db.handoverExternalMaintenanceAsset({
        ...input,
        warehouseUserId: ctx.user.id,
      });
      await queueExternalJobTranslation(input.jobId, [
        { fieldName: "handoverNotes", text: input.notes },
      ], ctx.user.id);
      const recipients = new Set<number>(
        [result.ticket.assignedToId, input.actualRecipientId].filter(
          (recipientId): recipientId is number => typeof recipientId === "number" && recipientId > 0,
        ),
      );
      for (const recipientId of recipients) {
        await db.createNotification({
          userId: recipientId,
          title: "🔧 أصل جاهز لإعادة التركيب",
          message: `تم تسليم الأصل المرتبط بالبلاغ ${result.ticket.ticketNumber} إلى ${recipient.name || "المستلم"}. يمكن الآن بدء إعادة التركيب.`,
          type: "success",
          relatedTicketId: result.ticket.id,
        });
      }
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "handover_external_asset_for_reinstall",
        entityType: "external_maintenance_job",
        entityId: input.jobId,
        newValues: {
          assignedTechnicianId: result.ticket.assignedToId,
          actualRecipientId: input.actualRecipientId,
          handoverDocumentNumber: result.handoverDocumentNumber,
        },
      });
      return { success: true, handoverDocumentNumber: result.handoverDocumentNumber };
    } catch (error) {
      translateExternalDbError(error);
    }
  }),
});
