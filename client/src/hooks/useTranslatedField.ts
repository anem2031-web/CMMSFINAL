import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

type SupportedLanguage = "ar" | "en" | "ur";

// ✅ إصلاح: drizzle/schema.ts (بعد المزامنة مع قاعدة الإنتاج) يسمّي كل حقل
// مترجَم بصيغة camelCase كاملة (مثال: itemNameAr) بدل الصيغة القديمة بشرطة
// سفلية (itemName_ar) — اسم العمود الحقيقي بقاعدة البيانات لم يتغيّر، فقط
// اسم الخاصية اللي يستخدمها الكود. كانت كل الدوال بهذا الملف تبني المفتاح
// القديم، فتفشل صامتة بإيجاد أي ترجمة بردود الـAPI الحالية منذ مزامنة الـSchema.
function buildTranslatedKey(fieldName: string, lang: string): string {
  return `${fieldName}${lang.charAt(0).toUpperCase()}${lang.slice(1)}`;
}

export function useTranslatedField() {
  const { language } = useLanguage();

  /**
   * المسار A: قراءة من الأعمدة المباشرة في السجل
   * يُستخدم للـ entities التي تكتب في Ar/En/Ur مباشرة
   */
  function getField(record: Record<string, any>, fieldName: string): string {
    if (!record) return "";

    // 1. جرب العمود المباشر للغة الحالية
    const translatedKey = buildTranslatedKey(fieldName, language);
    const translatedValue = record[translatedKey];
    if (translatedValue && translatedValue.trim().length > 0) {
      return translatedValue;
    }

    // 2. سقط على النص الأصلي
    return record[fieldName] || "";
  }

  function getFieldForLang(record: Record<string, any>, fieldName: string, lang: SupportedLanguage): string {
    if (!record) return "";
    const translatedKey = buildTranslatedKey(fieldName, lang);
    const translatedValue = record[translatedKey];
    if (translatedValue && translatedValue.trim().length > 0) {
      return translatedValue;
    }
    return record[fieldName] || "";
  }

  function hasTranslation(record: Record<string, any>, fieldName: string): boolean {
    if (!record) return false;
    const langs: SupportedLanguage[] = ["ar", "en", "ur"];
    return langs.some((lang) => {
      const key = buildTranslatedKey(fieldName, lang);
      return record[key] && record[key].trim().length > 0;
    });
  }

  function getAllTranslations(record: Record<string, any>, fieldName: string): Record<SupportedLanguage, string> {
    return {
      ar: record[buildTranslatedKey(fieldName, "ar")] || record[fieldName] || "",
      en: record[buildTranslatedKey(fieldName, "en")] || record[fieldName] || "",
      ur: record[buildTranslatedKey(fieldName, "ur")] || record[fieldName] || "",
    };
  }

  return {
    language,
    getField,
    getFieldForLang,
    hasTranslation,
    getAllTranslations,
  };
}

/**
 * المسار B: قراءة من entity_translations عبر الـ Engine
 * يُستخدم للـ entities التي تكتب في entity_translations (الطريق الجديد)
 * هذا هو TranslationResolver الموحد للمستقبل
 */
export function useResolvedTranslation(
  entityType: string,
  entityId: number | undefined,
  record: Record<string, any> | null | undefined,
  originalLanguage?: string
) {
  const { language } = useLanguage();

  const shouldFetch = !!entityId && (!originalLanguage || originalLanguage !== language);

  const { data, isLoading } = trpc.translation.getEntityTranslations.useQuery(
    {
      entityType,
      entityId: entityId!,
      languageCode: language as SupportedLanguage,
    },
    { enabled: shouldFetch }
  );

  return useMemo(() => {
    /**
     * getField: ينظر في entity_translations أولاً،
     * ثم يسقط على الأعمدة المباشرة، ثم على النص الأصلي
     */
    function getField(fieldName: string, fallback?: string): string {
      const originalValue = record?.[fieldName] || fallback || "";

      // 1. إذا لا يحتاج ترجمة (نفس اللغة) — أرجع مباشرة
      if (!shouldFetch) {
        const directKey = buildTranslatedKey(fieldName, language);
        return record?.[directKey] || originalValue;
      }

      // 2. جرب entity_translations (Engine الجديد + manualOverride)
      if (data) {
        const engineResult = (data as any)[fieldName];
        if (engineResult?.text && engineResult.text.trim().length > 0) {
          return engineResult.text;
        }
      }

      // 3. سقط على الأعمدة المباشرة (النظام القديم)
      const directKey = buildTranslatedKey(fieldName, language);
      if (record?.[directKey] && record[directKey].trim().length > 0) {
        return record[directKey];
      }

      // 4. سقط على النص الأصلي
      return originalValue;
    }

    return { getField, isLoading: shouldFetch ? isLoading : false };
  }, [data, shouldFetch, isLoading, record, language]);
}

/**
 * Get localized name for records with nameEn/nameUr fields (sites, sections, technicians)
 * Falls back to name if translation not available
 */
export function getLocalizedName(
  record: { name: string; nameEn?: string | null; nameUr?: string | null } | null | undefined,
  language: string
): string {
  if (!record) return "";
  if (language === "en" && record.nameEn) return record.nameEn;
  if (language === "ur" && record.nameUr) return record.nameUr;
  return record.name;
}