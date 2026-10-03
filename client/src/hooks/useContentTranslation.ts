/**
 * Hook for dynamic content translation
 * Fetches translated content from the translation engine for entities
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage, type SupportedLanguage } from "@/contexts/LanguageContext";

type TranslationResult = Record<string, { text: string | null; status: string; isOriginal: boolean }>;
type BatchTranslationResult = Record<number, Record<string, { text: string | null; status: string; isOriginal: boolean }>>;

/**
 * Get translated fields for a single entity
 */
export function useEntityTranslation(
  entityType: string,
  entityId: number | undefined,
  fieldNames?: string[],
  originalLanguage?: string
) {
  const { language } = useLanguage();

  // Entities created before the central translation layer (and several workflow
  // child entities) do not persist originalLanguage. In that case we still query
  // the engine for the viewer's language and fall back to the original value.
  const shouldFetch = !!entityId && (!originalLanguage || originalLanguage !== language);

  const { data, isLoading } = trpc.translation.getEntityTranslations.useQuery(
    {
      entityType,
      entityId: entityId!,
      languageCode: language as SupportedLanguage,
      fieldNames,
    },
    { enabled: shouldFetch }
  );

  return useMemo(() => {
    if (!shouldFetch || !data) {
      return { translations: {} as Record<string, string>, isTranslated: false, isLoading: false };
    }

    const result = data as TranslationResult;
    const translations: Record<string, string> = {};
    for (const key of Object.keys(result)) {
      if (result[key].text) {
        translations[key] = result[key].text!;
      }
    }

    return {
      translations,
      isTranslated: Object.keys(translations).length > 0,
      isLoading,
    };
  }, [data, shouldFetch, isLoading]);
}

/**
 * Get translated fields for multiple entities (batch)
 */
export function useBatchTranslation(
  entityType: string,
  entityIds: number[],
  fieldNames?: string[],
  originalLanguages?: Record<number, string>
) {
  const { language } = useLanguage();

  // Filter to only entities that need translation
  const idsNeedingTranslation = useMemo(() => {
    if (!originalLanguages) return entityIds;
    return entityIds.filter(id => !originalLanguages[id] || originalLanguages[id] !== language);
  }, [entityIds, originalLanguages, language]);

  const shouldFetch = idsNeedingTranslation.length > 0;

  const { data, isLoading } = trpc.translation.getBatchTranslations.useQuery(
    {
      entityType,
      entityIds: idsNeedingTranslation,
      languageCode: language as SupportedLanguage,
      fieldNames,
    },
    { enabled: shouldFetch }
  );

  return useMemo(() => {
    if (!shouldFetch || !data) {
      return { translationsMap: {} as Record<number, Record<string, string>>, isLoading: false };
    }

    const batchResult = data as BatchTranslationResult;
    const translationsMap: Record<number, Record<string, string>> = {};
    for (const entityIdStr of Object.keys(batchResult)) {
      const entityId = Number(entityIdStr);
      translationsMap[entityId] = {};
      const fields = batchResult[entityId];
      for (const fieldName of Object.keys(fields)) {
        if (fields[fieldName].text) {
          translationsMap[entityId][fieldName] = fields[fieldName].text!;
        }
      }
    }

    return { translationsMap, isLoading };
  }, [data, shouldFetch, isLoading]);
}

/**
 * Helper to get a translated field value with fallback to original
 */
export function getTranslatedField(
  translations: Record<string, string> | undefined,
  fieldName: string,
  originalValue: string
): string {
  return translations?.[fieldName] || originalValue;
}

/**
 * Get a localized field from an entity that has direct translated columns
 * e.g. item.itemName_en / item.itemName_ar / item.itemName_ur
 * Falls back to the original field if no translation exists
 */
export function getLocalizedItemField(
  item: Record<string, any>,
  fieldName: string,
  language: string
): string {
  // ✅ إصلاح: نفس مشكلة useTranslatedField.ts — الخاصية الآن camelCase
  // (مثال: itemNameAr) بدل الصيغة القديمة بشرطة سفلية (itemName_ar).
  const langSuffix = language.charAt(0).toUpperCase() + language.slice(1);
  const translated = item[`${fieldName}${langSuffix}`];
  if (translated && typeof translated === "string" && translated.trim().length > 0) {
    return translated.trim();
  }

  // Some purchase/inventory JOIN queries still expose historical snake-case
  // aliases (itemName_ar/itemName_en/itemName_ur). Keep them readable during
  // the transition without changing the API contract.
  const legacyTranslated = item[`${fieldName}_${language}`];
  if (legacyTranslated && typeof legacyTranslated === "string" && legacyTranslated.trim().length > 0) {
    return legacyTranslated.trim();
  }

  return item[fieldName] || "";
}

/**
 * Helper to get translated status/priority/category labels
 * These use the static i18n system, not the dynamic translation engine
 */
export function useStaticLabels() {
  const { t } = useLanguage();

  return {
    getStatusLabel: (status: string) => (t.ticketStatus as any)[status] || status,
    getPOStatusLabel: (status: string) => (t.poStatus as any)[status] || status,
    getPOItemStatusLabel: (status: string) => (t.poItemStatus as any)[status] || status,
    getPriorityLabel: (priority: string) => (t.priority as any)[priority] || priority,
    getCategoryLabel: (category: string) => (t.category as any)[category] || category,
    getRoleLabel: (role: string) => (t.roles as any)[role] || role,
  };
}
