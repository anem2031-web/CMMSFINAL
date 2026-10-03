import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, warehouseProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";
import { isInventoryLotsEnabled, resolveInventoryLotForSupplierReturn } from "../../_core/inventory-lots";

export const returnsRouter = router({

  // جلب كل المرتجعات
  list: warehouseProcedure
    .input(z.object({
      purchaseOrderId: z.number().optional(),
      inventoryId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.getWarehouseReturns(input);
    }),

  // البحث عن صنف للإرجاع
  search: warehouseProcedure
    .input(z.object({
      query: z.string().min(1),
    }))
    .query(async ({ input }) => {
      // البحث بـ internalCode أو manufacturerBarcode أو اسم الصنف
      return db.getInventoryBySearch(input.query);
    }),

  // مصادر الإرجاع المحتملة لصنف معيّن (سندات الاستلام السابقة له) — DTO
  // جاهز للعرض مباشرة بالواجهة بلا أي معالجة إضافية
  getReturnSources: warehouseProcedure
    .input(z.object({ inventoryId: z.number() }))
    .query(async ({ input }) => {
      return db.getReturnSources(input.inventoryId);
    }),

  // Phase 5.2 — Resolve an exact original Delivery document for
  // Recipient → Warehouse Return. The delivery number is the explicit source
  // link; old/unlinked deliveries are rejected rather than backfilled silently.
  resolveRecipientReturnSource: warehouseProcedure
    .input(z.object({
      deliveryNumber: z.string().trim().min(1, "رقم سند الصرف الأصلي مطلوب"),
    }))
    .mutation(async ({ input }) => {
      try {
        return await db.resolveRecipientReturnSource(input.deliveryNumber);
      } catch (error: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error?.message || "تعذر التحقق من سند الصرف الأصلي" });
      }
    }),

  // Phase 5.2 — approved Recipient → Warehouse policy:
  // same original Lot + original issue cost + original Delivery link +
  // partial/over-return guards + atomic posting.
  createRecipientReturn: warehouseProcedure
    .input(z.object({
      sourceDeliveryDocumentId: z.number().int().positive(),
      returnedQuantity: z.number().min(1),
      reason: z.string().trim().min(1, "سبب الإرجاع مطلوب"),
    }))
    .mutation(async ({ input, ctx }) => {
      let result: any;
      try {
        result = await db.createRecipientWarehouseReturn({
          sourceDeliveryDocumentId: input.sourceDeliveryDocumentId,
          returnedQuantity: input.returnedQuantity,
          reason: input.reason,
          returnedById: ctx.user.id,
        });
      } catch (error: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error?.message || "تعذر تنفيذ مرتجع الجهة إلى المخزن" });
      }

      const managers = await db.getManagerUsers();
      for (const mgr of managers) {
        await db.createNotification({
          userId: mgr.id,
          title: `↩️ مرتجع جهة ${result.returnNumber}`,
          message: `أُعيد ${result.returnedQuantity} ${result.unit || "وحدة"} من "${result.itemName}" إلى ${result.warehouseName || "المخزن"}` +
            ` — عكس سند ${result.sourceDeliveryNumber}` +
            (result.lotCode ? ` — الدفعة ${result.lotCode}` : ""),
          type: "info",
        });
      }

      await db.createAuditLog({
        userId: ctx.user.id,
        action: "recipient_warehouse_return",
        entityType: "inventory",
        entityId: result.inventoryId,
        newValues: {
          returnNumber: result.returnNumber,
          sourceDeliveryDocumentId: result.sourceDeliveryDocumentId,
          sourceDeliveryNumber: result.sourceDeliveryNumber,
          returnedQuantity: result.returnedQuantity,
          reason: input.reason,
          lotId: result.lotId,
          lotCode: result.lotCode,
          originalIssueUnitCost: result.originalIssueUnitCost,
          returnValue: result.returnValue,
          inventoryQuantityAfter: result.inventoryQuantityAfter,
          inventoryValueAfter: result.inventoryValueAfter,
        },
      });

      return result;
    }),

  // 2B-8 — هوية الدفعة هي مصدر الحقيقة لمرتجع المورد. يمكن مسح QR أو إدخال رقم اللوت، ولا نطلب من المستخدم
  // اختيار الصنف/المورد/الفاتورة عندما يكون نظام Lots مفعلاً؛ الخادم يحلها
  // من trackingToken ويمنع Opening Balance Lots من مسار مرتجع المورد.
  resolveReturnLot: warehouseProcedure
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
        const lot = await resolveInventoryLotForSupplierReturn({
          tx: database,
          trackingToken: input.trackingToken,
          warehouseId: input.warehouseId,
        });
        const item = await db.getInventoryItemById(lot.inventoryId);
        if (!item) throw new Error("سجل المخزون المرتبط بالدفعة غير موجود");

        const inventoryCatalogItemId = (item as any).linkedItemId == null
          ? null
          : Number((item as any).linkedItemId);
        if (
          lot.catalogItemId != null &&
          inventoryCatalogItemId != null &&
          lot.catalogItemId !== inventoryCatalogItemId
        ) {
          throw new Error("هوية الكتالوج للدفعة لا تطابق هوية الصنف في المخزون");
        }

        const receipt = await db.getWarehouseReceiptById(lot.receiptId!);
        if (!receipt) throw new Error("سند الاستلام الأصلي للدفعة غير موجود");

        const purchaseOrderId = lot.purchaseOrderId ?? receipt.purchaseOrderId ?? null;
        const po = purchaseOrderId ? await db.getPurchaseOrderById(purchaseOrderId) : null;
        const inventoryQuantity = Number((item as any).quantity || 0);
        const availableQuantity = Math.min(lot.balanceQuantity, lot.remainingQuantity, inventoryQuantity);
        if (!(availableQuantity > 0)) throw new Error("لا يوجد رصيد متاح للإرجاع من هذه الدفعة");

        return {
          lotId: lot.lotId,
          lotCode: lot.lotCode,
          trackingToken: lot.trackingToken,
          sourceType: lot.sourceType,
          catalogItemId: lot.catalogItemId,
          inventoryId: lot.inventoryId,
          warehouseId: lot.warehouseId,
          warehouseName: (warehouse as any).nameAr ?? (warehouse as any).nameEn ?? `#${input.warehouseId}`,
          availableQuantity,
          remainingQuantity: lot.remainingQuantity,
          item: {
            id: (item as any).id,
            itemName: (item as any).itemName,
            internalCode: (item as any).internalCode,
            unit: (item as any).unit,
            quantity: inventoryQuantity,
            linkedItemId: inventoryCatalogItemId,
          },
          source: {
            receiptId: lot.receiptId,
            receiptNumber: (receipt as any).receiptNumber ?? null,
            receiptDate: (receipt as any).invoiceDate ?? (receipt as any).receivedAt ?? (receipt as any).createdAt ?? null,
            invoiceNumber: (receipt as any).invoiceNumber ?? null,
            vendorName: (receipt as any).vendorName ?? null,
            purchaseOrderId,
            purchaseOrderItemId: lot.purchaseOrderItemId,
            poNumber: (po as any)?.poNumber ?? null,
          },
        };
      } catch (error: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error?.message || "QR الدفعة أو رقم اللوت غير صالح لمرتجع المورد" });
      }
    }),

  // إرجاع صنف للمندوب
  create: warehouseProcedure
    .input(z.object({
      // اختيارية عمداً: الصنف قد يكون "مستقلاً" (استلام بلا طلب شراء عبر 0035)
      // أو بلا سجل استلام مرتبط أصلاً — بهذي الحالة يُسجَّل مرتجع عام بلا مصدر
      receiptId: z.number().optional(),
      purchaseOrderId: z.number().optional(),
      purchaseOrderItemId: z.number().optional(),
      inventoryId: z.number().optional(),
      // 2B-8: عند تفعيل Lots يكون هذا هو المدخل الوحيد الموثوق لتحديد الصنف/المصدر.
      lotTrackingToken: z.string().trim().min(1).optional(),
      warehouseId: z.number().int().positive().optional(),
      returnedQuantity: z.number().min(1),
      reason: z.string().min(1, "سبب الإرجاع مطلوب"),
      recipientName: z.string().optional(), // من استلم الصنف المرتجَع (توقيع الوثيقة)
    }))
    .mutation(async ({ input, ctx }) => {
      // 2B-8: عند التفعيل، QR/Lot هو مصدر الحقيقة الكامل. نتجاهل أي receipt/PO/
      // inventory ids قد يرسلها العميل ونحلها من الـLot داخل Transaction ذرية.
      if (isInventoryLotsEnabled()) {
        const trackingToken = String(input.lotTrackingToken || "").trim();
        if (!trackingToken) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "يجب مسح QR الدفعة أو إدخال رقم اللوت قبل تأكيد مرتجع المورد" });
        }
        if (!input.warehouseId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "يجب اختيار المستودع قبل تأكيد مرتجع المورد" });
        }

        let result: any;
        try {
          result = await db.createLotAwareSupplierReturn({
            trackingToken,
            warehouseId: input.warehouseId,
            returnedQuantity: input.returnedQuantity,
            reason: input.reason,
            recipientName: input.recipientName,
            returnedById: ctx.user.id,
          });
        } catch (error: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error?.message || "تعذر تنفيذ مرتجع المورد من الدفعة" });
        }

        const managers = await db.getManagerUsers();
        for (const mgr of managers) {
          await db.createNotification({
            userId: mgr.id,
            title: `↩️ مرتجع ${result.returnNumber}`,
            message: `تم إرجاع ${result.returnedQuantity} ${result.unit || "وحدة"} من "${result.itemName}"` +
              ` — الدفعة ${result.lotCode}` +
              (result.invoiceNumber ? ` — فاتورة ${result.invoiceNumber}` : ""),
            type: "warning",
            relatedPoId: result.purchaseOrderId ?? undefined,
          });
        }

        await db.createAuditLog({
          userId: ctx.user.id,
          action: "warehouse_return",
          entityType: result.purchaseOrderId ? "purchase_order" : "inventory",
          entityId: result.purchaseOrderId ?? result.inventoryId,
          newValues: {
            returnNumber: result.returnNumber,
            returnedQuantity: result.returnedQuantity,
            reason: input.reason,
            lotId: result.lotId,
            lotCode: result.lotCode,
            receiptId: result.receiptId,
            invoiceNumber: result.invoiceNumber,
            unitCostUsed: result.unitCostUsed,
            returnValue: result.returnValue,
          },
        });

        return result;
      }

      if (!input.inventoryId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "الصنف مطلوب لإنشاء المرتجع" });
      }

      // Phase 5.2: نحافظ على واجهة ومسار Legacy الحاليين، لكن التنفيذ الداخلي
      // أصبح Transactional حتى لا يبقى رأس مرتجع/حركة/PO/وثيقة بصورة جزئية.
      let result: any;
      try {
        result = await db.createLegacySupplierReturn({
          receiptId: input.receiptId,
          purchaseOrderId: input.purchaseOrderId,
          purchaseOrderItemId: input.purchaseOrderItemId,
          inventoryId: input.inventoryId,
          returnedQuantity: input.returnedQuantity,
          reason: input.reason,
          recipientName: input.recipientName,
          returnedById: ctx.user.id,
        });
      } catch (error: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error?.message || "تعذر تنفيذ مرتجع المورد" });
      }

      // الإشعارات والـAudit تبقى آثارًا لاحقة بعد نجاح الترحيل الأساسي. لا
      // ندخل Workflow جديد ولا نربط نجاح حركة المخزون بنجاح إشعار خارجي.
      const managers = await db.getManagerUsers();
      for (const mgr of managers) {
        await db.createNotification({
          userId: mgr.id,
          title: `↩️ مرتجع ${result.returnNumber}`,
          message: `تم إرجاع ${result.returnedQuantity} ${result.unit || "وحدة"} من "${result.itemName}"` +
            (result.poNumber ? ` - طلب الشراء ${result.poNumber}` : " - بلا طلب شراء مرتبط"),
          type: "warning",
          relatedPoId: result.purchaseOrderId ?? undefined,
        });
      }

      await db.createAuditLog({
        userId: ctx.user.id,
        action: "warehouse_return",
        entityType: result.purchaseOrderId ? "purchase_order" : "inventory",
        entityId: result.purchaseOrderId ?? result.inventoryId,
        newValues: {
          returnNumber: result.returnNumber,
          returnedQuantity: result.returnedQuantity,
          reason: input.reason,
          receiptId: result.receiptId,
          invoiceNumber: result.invoiceNumber,
          unitCostUsed: result.unitCostUsed,
          returnValue: result.returnValue,
        },
      });

      return result;
    }),
});
