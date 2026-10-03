import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, warehouseProcedure, inventoryReadProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";
import { isInventoryLotsEnabled, resolveInventoryLotForWarehouseTransfer } from "../../_core/inventory-lots";

// ============================================================
// transfers.router.ts — التحويل الفعلي بين المخازن (رئيسي↔فرعي، فرعي↔فرعي)
// أُعيد بناؤه بالكامل بتاريخ 2026-08-05 (كان مسجَّلاً بالخادم يستدعي دالتين
// غير موجودتين إطلاقاً بطبقة قاعدة البيانات). في نفس اليوم أُضيف مفهوم
// "العملية المجمَّعة" (createBatch): حتى 20 صنفاً تحت رقم عملية واحد وبطاقة
// واحدة بالواجهة، بدل ظهور كل صنف كعملية منفصلة. راجع
// docs/CHANGELOG_TECHNICAL.md لتفاصيل الإصلاح الكامل قبل أي تعديل هنا.
// ============================================================
export const transfersRouter = router({
  // 2B-8 — هوية الدفعة هي مصدر الحقيقة عند التحويل. يمكن مسح QR أو إدخال رقم اللوت بعد
  // اختيار المخزن المصدر، أو التحقق من أنه يخص صنفاً تم اختياره يدوياً.
  resolveLot: warehouseProcedure
    .input(z.object({
      fromWarehouseId: z.number(),
      trackingToken: z.string().trim().min(1, "QR الدفعة أو رقم اللوت مطلوب"),
      fromInventoryId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      if (!isInventoryLotsEnabled()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "تتبع الدفعات غير مفعّل تشغيليًا بعد" });
      }
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الاتصال بقاعدة البيانات" });
      try {
        const lot = await resolveInventoryLotForWarehouseTransfer({
          tx: database,
          trackingToken: input.trackingToken,
          fromWarehouseId: input.fromWarehouseId,
          fromInventoryId: input.fromInventoryId,
        });
        const item = await db.getInventoryItemById(lot.inventoryId);
        if (!item) throw new Error("صنف المخزون المرتبط بالدفعة غير موجود");
        return {
          lotId: lot.lotId,
          lotCode: lot.lotCode,
          trackingToken: lot.trackingToken,
          sourceType: lot.sourceType,
          catalogItemId: lot.catalogItemId,
          inventoryId: lot.inventoryId,
          itemName: item.itemName,
          internalCode: item.internalCode ?? null,
          unit: item.unit ?? null,
          availableQuantity: lot.balanceQuantity,
          remainingQuantity: lot.remainingQuantity,
        };
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err?.message || "QR الدفعة أو رقم اللوت غير صالح للتحويل" });
      }
    }),

  // ── عملية تحويل مجمَّعة: حتى 20 صنفاً برقم عملية واحد ──────────────
  createBatch: warehouseProcedure
    .input(z.object({
      fromWarehouseId: z.number(),
      toWarehouseId: z.number(),
      notes: z.string().optional(),
      items: z.array(z.object({
        fromInventoryId: z.number(),
        quantity: z.number().min(0.001, "الكمية يجب أن تكون أكبر من صفر"),
        lotTrackingToken: z.string().trim().min(1).optional(),
        notes: z.string().optional(),
      })).min(1, "أضف صنفاً واحداً على الأقل").max(20, "الحد الأقصى 20 صنفاً بالعملية الواحدة"),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.fromWarehouseId === input.toWarehouseId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن التحويل لنفس المخزن" });
      }
      if (isInventoryLotsEnabled() && input.items.some(item => !String(item.lotTrackingToken || "").trim())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "يجب مسح QR أو إدخال رقم اللوت لكل بند تحويل قبل تنفيذ العملية" });
      }
      try {
        const result = await db.createWarehouseTransferBatch({
          ...input,
          createdById: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "warehouse_transfer_batch",
          entityType: "warehouse_transfer_batch",
          entityId: result.batchId,
          newValues: {
            fromWarehouseId: input.fromWarehouseId,
            toWarehouseId: input.toWarehouseId,
            notes: input.notes,
            items: input.items.map(({ lotTrackingToken: _token, ...item }) => item),
            batchNumber: result.batchNumber,
          },
        });
        return result;
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
      }
    }),

  // ── بطاقات العمليات (بطاقة واحدة لكل عملية مهما كان عدد أصنافها) ──
  listCards: inventoryReadProcedure
    .input(z.object({ warehouseId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      return db.getWarehouseTransferBatchCards({ warehouseId: input?.warehouseId });
    }),

  // ── تفاصيل عملية واحدة (كل أصنافها) عبر مفتاح البطاقة ──
  getBatchDetail: inventoryReadProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const detail = await db.getWarehouseTransferBatchDetail(input.key);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "العملية غير موجودة" });
      return detail;
    }),
});
