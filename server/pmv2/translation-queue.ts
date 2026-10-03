import { detectLanguage } from "../services/translation/translation";
import { queueTranslation } from "../services/translation/translationEngine";

export type Pmv2TranslatableField = { fieldName: string; text?: string | null };

/**
 * Queue PM V2 user-authored content for the existing translation engine.
 * The original text remains the source of truth; translated rows are only a
 * localized read model and callers always retain an original-text fallback.
 */
export async function queuePmv2Translation(
  entityType: string,
  entityId: number,
  fields: Pmv2TranslatableField[],
  userId: number,
): Promise<void> {
  const normalized = fields
    .map(field => ({ fieldName: field.fieldName, text: field.text?.trim() || "" }))
    .filter(field => field.text.length > 0);
  if (!normalized.length || !Number.isFinite(entityId) || entityId <= 0) return;

  const sourceLanguage = await detectLanguage(normalized[0].text).catch(() => "ar" as const);
  queueTranslation({ entityType, entityId, fields: normalized, sourceLanguage, userId })
    .catch(error => console.error(`[${entityType}] translation queue failed:`, error));
}
