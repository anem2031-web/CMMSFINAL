import { z } from "zod";
import { protectedProcedure, warehouseProcedure, router } from "../_shared/procedures";
import * as db from "../../_core/db";
import { queueTranslation } from "../../services/translation/translationEngine";
import { detectLanguage } from "../../services/translation/translation";


async function queueDeliveryDocumentTranslation(id: number, itemName?: string | null, notes?: string | null, userId?: number) {
  const fields = [
    { fieldName: "itemName", text: (itemName || "").trim() },
    { fieldName: "notes", text: (notes || "").trim() },
  ].filter(field => field.text);
  if (!fields.length) return;
  const sourceLanguage = await detectLanguage(fields[0].text).catch(() => "ar" as const);
  await queueTranslation({ entityType: "DELIVERY_DOCUMENT", entityId: id, fields, sourceLanguage, userId });
}

export const deliveryDocumentsRouter = router({

  // حفظ بيانات الوثيقة عند التسليم (بدون PDF على السيرفر)
  generate: warehouseProcedure.input(z.object({
    deliveryNumber: z.string(),
    poItemId: z.number(),
    itemName: z.string(),
    deliveredByName: z.string(),
    deliveredToName: z.string(),
    quantity: z.number(),
    unit: z.string().optional(),
    supplierName: z.string().optional(),
    actualUnitCost: z.string().optional(),
    poNumber: z.string().optional(),
    warehousePhotoUrl: z.string().optional(),
    notes: z.string().optional(),
    deliveredAt: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const inserted = await db.createDeliveryDocument({
      deliveryNumber: input.deliveryNumber,
      poItemId: input.poItemId,
      itemName: input.itemName,
      deliveredByName: input.deliveredByName,
      deliveredToName: input.deliveredToName,
      quantity: input.quantity,
      unit: input.unit,
      supplierName: input.supplierName,
      actualUnitCost: input.actualUnitCost,
      poNumber: input.poNumber,
      warehousePhotoUrl: input.warehousePhotoUrl,
      notes: input.notes,
    });
    const documentId = Number((inserted as any)?.insertId || 0);
    if (documentId > 0) {
      await queueDeliveryDocumentTranslation(documentId, input.itemName, input.notes, ctx.user.id);
    }
    return { success: true };
  }),

  // جلب كل الوثائق للتبويب
  list: protectedProcedure.query(async ({ ctx }) => {
    const documents = await db.getDeliveryDocuments();
    await Promise.all((documents as any[]).map(doc =>
      queueDeliveryDocumentTranslation(Number(doc.id), doc.itemName, doc.notes, ctx.user.id).catch(() => undefined)
    ));
    return documents;
  }),

  // رفع عداد الطباعة
  incrementPrint: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const count = await db.incrementDeliveryDocPrintCount(input.id);
    return { printCount: count };
  }),
});
