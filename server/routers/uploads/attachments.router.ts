import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";
import { assertCanAccessAttachments } from "./attachments.access";
import { APP_ROLE } from "@shared/roles";

export const attachmentsRouter = router({
  /**
   * قائمة مجمَّعة لكل مرفقات نوع بعينه — لعرض "الوثائق المالية المعتمدة"
   * بمركز المستندات (2026-08-10). **مقيَّد صراحةً** بأدوار مالية (لا يستخدم
   * assertCanAccessAttachments العام لأن هذا استعلام مجمَّع بلا entityId
   * واحد يمكن فحص ملكيته — القيد هنا على مستوى الدور مباشرة).
   */
  listByType: protectedProcedure.input(z.object({
    entityType: z.enum(["po_financial_batch", "delegate_pricing_documents"]),
  })).query(async ({ input, ctx }) => {
    if (input.entityType === "delegate_pricing_documents") {
      // وثائق التسعير الصادرة من المندوبين: المندوب يرى مستنداته فقط،
      // والمالك/مدير النظام يريان جميع المستندات. لا تُمنح لبقية الأدوار.
      const allowedRoles = [APP_ROLE.DELEGATE, APP_ROLE.OWNER, APP_ROLE.ADMIN];
      if (!allowedRoles.includes(ctx.user.role as any)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية للاطلاع على وثائق تسعير المندوبين" });
      }

      const rows = await db.getDelegatePricingAttachmentsWithDelegate();
      if (ctx.user.role === APP_ROLE.DELEGATE) {
        return rows.filter((row: any) => Number(row.delegateId) === Number(ctx.user.id));
      }
      return rows;
    }

    // الوثائق المالية المعتمدة تبقى بصلاحياتها الحالية دون تغيير.
    const financialRoles = [APP_ROLE.ACCOUNTANT, APP_ROLE.SENIOR_MANAGEMENT, APP_ROLE.OWNER, APP_ROLE.ADMIN];
    if (!financialRoles.includes(ctx.user.role as any)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية للاطلاع على الوثائق المالية" });
    }
    return db.getFinancialBatchAttachmentsWithDelegate();
  }),

  list: protectedProcedure.input(z.object({
    entityType: z.string(),
    entityId: z.number(),
  })).query(async ({ input, ctx }) => {
    // ✅ إصلاح IDOR: كان أي مستخدم مسجّل دخول يقدر يستعرض مرفقات أي كيان
    // بتخمين الرقم، بدون أي تحقق من علاقته به.
    await assertCanAccessAttachments(ctx.user, input.entityType, input.entityId);
    return db.getAttachments(input.entityType, input.entityId);
  }),

  add: protectedProcedure.input(z.object({
    entityType: z.string(),
    entityId: z.number(),
    fileName: z.string(),
    fileUrl: z.string(),
    fileKey: z.string(),
    mimeType: z.string().optional(),
    fileSize: z.number().optional(),
  })).mutation(async ({ input, ctx }) => {
    // ✅ إصلاح IDOR: نفس الفحص المطبَّق بـlist — يمنع رفع مرفقات لكيان لا
    // يملك المستخدم صلاحية الوصول إليه، أو لنوع كيان غير مدعوم أصلًا.
    await assertCanAccessAttachments(ctx.user, input.entityType, input.entityId, "write");
    const id = await db.createAttachment({
      entityType: input.entityType,
      entityId: input.entityId,
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      fileKey: input.fileKey,
      mimeType: input.mimeType || null,
      fileSize: input.fileSize || null,
      uploadedById: ctx.user.id,
    });
    await db.createAuditLog({
      userId: ctx.user.id,
      action: "add_attachment",
      entityType: input.entityType,
      entityId: input.entityId,
      newValues: { fileName: input.fileName, mimeType: input.mimeType },
    });
    return { id };
  }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const attachment = await db.getAttachmentById(input.id);
    if (!attachment) throw new TRPCError({ code: "NOT_FOUND", message: "المرفق غير موجود" });
    // Verify entity access first, then allow the matching manager role or uploader.
    await assertCanAccessAttachments(ctx.user, attachment.entityType, attachment.entityId, "write");
    const managerRoles = attachment.entityType === "ticket"
      ? ["owner", "admin", "maintenance_manager", "general_maintenance_manager", "construction_procurement_manager"]
      : ["owner", "admin", "maintenance_manager", "general_maintenance_manager", "construction_procurement_manager"];
    const canDelete = managerRoles.includes(ctx.user.role) || attachment.uploadedById === ctx.user.id;
    if (!canDelete) throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لحذف هذا المرفق" });
    await db.deleteAttachment(input.id);
    await db.createAuditLog({
      userId: ctx.user.id,
      action: "delete_attachment",
      entityType: attachment.entityType,
      entityId: attachment.entityId,
      oldValues: { fileName: attachment.fileName, mimeType: attachment.mimeType },
    });
    return { success: true };
  }),
});
