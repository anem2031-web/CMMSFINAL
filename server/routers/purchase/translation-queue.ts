import { detectLanguage } from "../../services/translation/translation";
import { queueTranslation } from "../../services/translation/translationEngine";

export async function queuePurchaseTranslation(
  entityType: "PO" | "PO_ITEM" | "PO_BATCH" | "PO_COMMENT" | "PO_ITEM_HISTORY",
  entityId: number,
  fields: Array<{ fieldName: string; text?: string | null }>,
  userId: number,
): Promise<void> {
  const normalized = fields
    .map(field => ({ fieldName: field.fieldName, text: field.text?.trim() || "" }))
    .filter(field => field.text.length > 0);
  if (!normalized.length || !Number.isFinite(entityId) || entityId <= 0) return;
  const sourceLanguage = await detectLanguage(normalized[0].text).catch(() => "ar" as const);
  queueTranslation({ entityType, entityId, fields: normalized, sourceLanguage, userId })
    .catch(error => console.error(`[${entityType}] purchase translation queue failed:`, error));
}

export async function createTranslatedProcurementComment(
  db: any,
  data: Record<string, any> & { note?: string | null; userId?: number | null },
): Promise<number | null> {
  const id = await db.createProcurementComment(data);
  if (id && data.note && data.userId) {
    await queuePurchaseTranslation("PO_COMMENT", Number(id), [
      { fieldName: "note", text: data.note },
    ], Number(data.userId));
  }
  return id ? Number(id) : null;
}
