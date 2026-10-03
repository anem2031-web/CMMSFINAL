const WHOLE_NUMBER_UNIT_ALIASES = new Set([
  // Arabic countable/package units.
  "قطعة",
  "قطع",
  "حبة",
  "حبات",
  "وحدة",
  "وحدات",
  "علبة",
  "علب",
  "لفة",
  "لفات",
  "كيس",
  "اكياس",
  "كرتون",
  "كرتونة",
  "كراتين",
  "رول",
  "رولات",
  "باكيت",
  "باكيتات",
  "عبوة",
  "عبوات",
  "طقم",
  "اطقم",
  "زوج",
  "ازواج",
  "مجوز",
  "حزمة",
  "حزم",
  "لوح",
  "الواح",
  "زجاجة",
  "زجاجات",
  "قنينة",
  "قناني",
  "درزن",
  "دزينة",

  // Common English aliases used by existing / imported catalog data.
  "pc",
  "pcs",
  "piece",
  "pieces",
  "unit",
  "units",
  "box",
  "boxes",
  "bag",
  "bags",
  "roll",
  "rolls",
  "pack",
  "packs",
  "packet",
  "packets",
  "carton",
  "cartons",
  "set",
  "sets",
  "pair",
  "pairs",
  "bottle",
  "bottles",
]);

export function normalizePmv2MaterialUnit(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ة")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * PM V2 quantity policy for countable units.
 *
 * Unknown/free-text units are intentionally NOT assumed to be countable because
 * they may represent legitimate divisible measurements (for example litres,
 * metres, kilograms, square metres, gallons, etc.). The server still enforces
 * the known count-unit aliases below, while Catalog governance remains the
 * source of truth for the unit text itself.
 */
export function pmv2MaterialUnitRequiresWholeQuantity(
  unit: string | null | undefined,
): boolean {
  return WHOLE_NUMBER_UNIT_ALIASES.has(normalizePmv2MaterialUnit(unit));
}

export function getPmv2MaterialQuantityValidationMessage(
  quantity: number,
  unit: string | null | undefined,
): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "الكمية المطلوبة يجب أن تكون أكبر من صفر";
  }
  if (pmv2MaterialUnitRequiresWholeQuantity(unit) && !Number.isInteger(quantity)) {
    return "هذه الوحدة لا تقبل الكسور؛ أدخل عددًا صحيحًا.";
  }
  return null;
}
