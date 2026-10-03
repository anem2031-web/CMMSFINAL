import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, inventoryReadProcedure, warehouseProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";
import { isInventoryLotsEnabled, resolveInventoryLotForDisposal } from "../../_core/inventory-lots";

export const disposalRouter = router({

  // 2B-8 — هوية الدفعة هي مصدر الحقيقة عند الاستبعاد. نقبل QR أو رقم اللوت ولا نقبل lotId من العميل.
  // إذا كانت الدفعة موزعة على أكثر من مستودع نرفض الاختيار الصامت حتى يكون
  // للـWorkflow سياق مستودع صريح.
  resolveLot: warehouseProcedure
    .input(z.object({
      warehouseId: z.number().int().positive("المستودع مطلوب"),
      trackingToken: z.string().trim().min(1, "QR الدفعة أو رقم اللوت مطلوب"),
    }))
    .mutation(async ({ input }) => {
      if (!isInventoryLotsEnabled()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "تتبع الدفعات غير مفعّل تشغيليًا بعد" });
      }
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الاتصال بقاعدة البيانات" });

      try {
        const warehouse = await db.getWarehouseById(input.warehouseId);
        if (!warehouse || !(warehouse as any).isActive) {
          throw new Error("المستودع المحدد غير موجود أو غير مفعّل");
        }
        const lot = await resolveInventoryLotForDisposal({
          tx: database,
          trackingToken: input.trackingToken,
          warehouseId: input.warehouseId,
        });
        const item = await db.getInventoryItemById(lot.inventoryId);
        if (!item) throw new Error("صنف المخزون المرتبط بالدفعة غير موجود");

        return {
          lotId: lot.lotId,
          lotCode: lot.lotCode,
          trackingToken: lot.trackingToken,
          sourceType: lot.sourceType,
          catalogItemId: lot.catalogItemId,
          receiptId: lot.receiptId,
          inventoryId: lot.inventoryId,
          warehouseId: lot.warehouseId,
          warehouseName: (warehouse as any).nameAr ?? (warehouse as any).nameEn ?? `#${input.warehouseId}`,
          itemName: item.itemName,
          internalCode: item.internalCode ?? null,
          unit: item.unit ?? null,
          location: item.location ?? null,
          averageCost: item.averageCost ?? "0",
          inventoryQuantity: Number(item.quantity || 0),
          availableQuantity: lot.balanceQuantity,
          remainingQuantity: lot.remainingQuantity,
        };
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err?.message || "QR الدفعة أو رقم اللوت غير صالح للاستبعاد" });
      }
    }),

  // ── إنشاء عملية استبعاد جديدة ──────────────────────────────
  create: warehouseProcedure
    .input(z.object({
      operationDate: z.string().min(1, "تاريخ العملية مطلوب"),
      warehouseId:   z.number().int().positive().optional(),
      notes:         z.string().optional(),
      items: z.array(z.object({
        inventoryId:  z.number(),
        quantity:     z.number().min(0.001, "الكمية يجب أن تكون 0.001 أو أكثر"),
        reason:       z.enum(["damaged", "expired", "missing", "other"]),
        unitCost:     z.number().min(0).default(0),
        totalCost:    z.number().min(0).default(0),
        lotTrackingToken: z.string().trim().min(1).optional(),
        attachments:  z.array(z.string()).optional(),
        notes:        z.string().optional(),
      })).min(1, "يجب إضافة صنف واحد على الأقل"),
    }))
    .mutation(async ({ input, ctx }) => {
      if (isInventoryLotsEnabled()) {
        if (!input.warehouseId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "يجب اختيار المستودع قبل حفظ عملية الاستبعاد" });
        }
        if (input.items.some(item => !String(item.lotTrackingToken || "").trim())) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "يجب مسح QR أو إدخال رقم اللوت لكل بند استبعاد قبل حفظ العملية" });
        }
      }
      try {
        const result = await db.createDisposal({
          operationDate: input.operationDate,
          warehouseId:   input.warehouseId,
          notes:         input.notes,
          createdBy:     ctx.user.id,
          items:         input.items.map(i => ({
            inventoryId:  i.inventoryId,
            quantity:     i.quantity,
            reason:       i.reason,
            unitCost:     i.unitCost,
            totalCost:    i.totalCost,
            lotTrackingToken: i.lotTrackingToken,
            attachments:  i.attachments ? JSON.stringify(i.attachments) : undefined,
            notes:        i.notes,
          })),
        });
        return result;
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
      }
    }),

  // ── قائمة عمليات الاستبعاد ──────────────────────────────────
  list: inventoryReadProcedure.query(async () => {
    return db.listDisposalOperations();
  }),

  // ── تفاصيل عملية واحدة ──────────────────────────────────────
  getById: inventoryReadProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const op = await db.getDisposalById(input.id);
      if (!op) throw new TRPCError({ code: "NOT_FOUND", message: "العملية غير موجودة" });
      return op;
    }),

});
