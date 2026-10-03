import type { SupportedLanguage } from "@/contexts/LanguageContext";

type CatalogBilingualRecord = {
  nameAr?: string | null;
  nameEn?: string | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
};

type CatalogUnitRecord = {
  id?: number | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

/**
 * Master Catalog policy:
 * - Arabic UI -> Arabic master field.
 * - English UI -> English master field.
 * - Urdu UI -> English master field (product decision), with Arabic fallback.
 *
 * Catalog taxonomy/items/units are governed master data, so we deliberately do
 * not send these labels through the dynamic LLM translation layer.
 */
export function getLocalizedCatalogName(
  record: CatalogBilingualRecord | null | undefined,
  language: SupportedLanguage | string,
): string {
  if (!record) return "";
  if (language === "ar") return String(record.nameAr || record.nameEn || "").trim();
  return String(record.nameEn || record.nameAr || "").trim();
}

export function getLocalizedCatalogDescription(
  record: CatalogBilingualRecord | null | undefined,
  language: SupportedLanguage | string,
): string {
  if (!record) return "";
  if (language === "ar") return String(record.descriptionAr || record.descriptionEn || "").trim();
  return String(record.descriptionEn || record.descriptionAr || "").trim();
}

export function resolveCatalogUnit(
  rawUnit: string | null | undefined,
  units: CatalogUnitRecord[] | null | undefined,
): CatalogUnitRecord | null {
  const value = String(rawUnit || "").trim();
  if (!value || !units?.length) return null;
  return units.find((unit) => {
    const ar = String(unit.nameAr || "").trim();
    const en = String(unit.nameEn || "").trim();
    return value === ar || value === en;
  }) || null;
}

export function getLocalizedCatalogUnitName(
  rawUnit: string | null | undefined,
  units: CatalogUnitRecord[] | null | undefined,
  language: SupportedLanguage | string,
): string {
  const unit = resolveCatalogUnit(rawUnit, units);
  if (!unit) return String(rawUnit || "").trim();
  if (language === "ar") return String(unit.nameAr || unit.nameEn || rawUnit || "").trim();
  return String(unit.nameEn || unit.nameAr || rawUnit || "").trim();
}
