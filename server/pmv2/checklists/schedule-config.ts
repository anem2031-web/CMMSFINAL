export type Pmv2ScheduleUnit = "day" | "week" | "month" | "quarter" | "halfyear" | "year";
export type Pmv2DaySpec = number | "last";

export interface Pmv2QuarterDateSpec {
  monthInQuarter: number;
  day: Pmv2DaySpec;
}

export interface Pmv2HalfYearDateSpec {
  monthInHalf: number;
  day: Pmv2DaySpec;
}

export interface Pmv2YearDateSpec {
  month: number;
  day: Pmv2DaySpec;
}

export interface Pmv2ScheduleConfigV1 {
  version: 1;
  unit: Pmv2ScheduleUnit;
  interval: number;
  startDate: string | null;
  weekdays: number[];
  monthDays: Pmv2DaySpec[];
  quarterDates: Pmv2QuarterDateSpec[];
  halfYearDates: Pmv2HalfYearDateSpec[];
  yearDates: Pmv2YearDateSpec[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const weekdayLabels: Record<number, string> = {
  0: "الأحد",
  1: "الاثنين",
  2: "الثلاثاء",
  3: "الأربعاء",
  4: "الخميس",
  5: "الجمعة",
  6: "السبت",
};
const monthLabels: Record<number, string> = {
  1: "يناير",
  2: "فبراير",
  3: "مارس",
  4: "أبريل",
  5: "مايو",
  6: "يونيو",
  7: "يوليو",
  8: "أغسطس",
  9: "سبتمبر",
  10: "أكتوبر",
  11: "نوفمبر",
  12: "ديسمبر",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("تاريخ بداية التكرار غير صالح");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("تاريخ بداية التكرار غير صالح");
  }
  return date;
}

function optionalDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("تاريخ بداية التكرار غير صالح");
  parseDateOnly(value);
  return value;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${label} يجب أن يكون رقمًا صحيحًا 1 أو أكثر`);
  }
  return Number(value);
}

function uniqueSortedIntegers(values: unknown, min: number, max: number, label: string): number[] {
  if (values == null) return [];
  if (!Array.isArray(values)) throw new Error(`${label} غير صالحة`);
  const result = values.map((value) => {
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
      throw new Error(`${label} غير صالحة`);
    }
    return Number(value);
  });
  return [...new Set(result)].sort((a, b) => a - b);
}

function normalizeDaySpec(value: unknown, label: string): Pmv2DaySpec {
  if (value === "last") return "last";
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 31) {
    throw new Error(`${label} يجب أن يكون بين 1 و31 أو آخر يوم`);
  }
  return Number(value);
}

function normalizeDaySpecs(values: unknown, label: string): Pmv2DaySpec[] {
  if (values == null) return [];
  if (!Array.isArray(values)) throw new Error(`${label} غير صالحة`);
  const normalized = values.map((value) => normalizeDaySpec(value, label));
  const unique: Pmv2DaySpec[] = [];
  for (const value of normalized) {
    if (!unique.includes(value)) unique.push(value);
  }
  unique.sort((a, b) => {
    if (a === "last") return 1;
    if (b === "last") return -1;
    return a - b;
  });
  return unique;
}

function normalizeQuarterDates(values: unknown): Pmv2QuarterDateSpec[] {
  if (values == null) return [];
  if (!Array.isArray(values)) throw new Error("مواعيد الربع السنوي غير صالحة");
  const normalized = values.map((value) => {
    if (!isRecord(value)) throw new Error("مواعيد الربع السنوي غير صالحة");
    const monthInQuarter = positiveInteger(value.monthInQuarter, "الشهر داخل الربع");
    if (monthInQuarter > 3) throw new Error("الشهر داخل الربع يجب أن يكون من 1 إلى 3");
    return { monthInQuarter, day: normalizeDaySpec(value.day, "يوم التنفيذ") };
  });
  const seen = new Set<string>();
  return normalized.filter((item) => {
    const key = `${item.monthInQuarter}:${item.day}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeHalfYearDates(values: unknown): Pmv2HalfYearDateSpec[] {
  if (values == null) return [];
  if (!Array.isArray(values)) throw new Error("مواعيد النصف السنوي غير صالحة");
  const normalized = values.map((value) => {
    if (!isRecord(value)) throw new Error("مواعيد النصف السنوي غير صالحة");
    const monthInHalf = positiveInteger(value.monthInHalf, "الشهر داخل النصف");
    if (monthInHalf > 6) throw new Error("الشهر داخل النصف يجب أن يكون من 1 إلى 6");
    return { monthInHalf, day: normalizeDaySpec(value.day, "يوم التنفيذ") };
  });
  const seen = new Set<string>();
  return normalized.filter((item) => {
    const key = `${item.monthInHalf}:${item.day}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeYearDates(values: unknown): Pmv2YearDateSpec[] {
  if (values == null) return [];
  if (!Array.isArray(values)) throw new Error("مواعيد السنة غير صالحة");
  const normalized = values.map((value) => {
    if (!isRecord(value)) throw new Error("مواعيد السنة غير صالحة");
    const month = positiveInteger(value.month, "الشهر");
    if (month > 12) throw new Error("الشهر يجب أن يكون من 1 إلى 12");
    return { month, day: normalizeDaySpec(value.day, "يوم التنفيذ") };
  });
  const seen = new Set<string>();
  return normalized.filter((item) => {
    const key = `${item.month}:${item.day}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parsePmv2ScheduleConfigJson(value: unknown): Pmv2ScheduleConfigV1 | null {
  if (value == null || value === "") return null;
  let raw: unknown = value;
  if (typeof value === "string") {
    if (value.length > 12000) throw new Error("إعداد التكرار المخصص كبير جدًا");
    try {
      raw = JSON.parse(value);
    } catch {
      throw new Error("إعداد التكرار المخصص غير صالح");
    }
  }
  if (!isRecord(raw) || raw.version !== 1) throw new Error("إعداد التكرار المخصص غير صالح");

  const units: Pmv2ScheduleUnit[] = ["day", "week", "month", "quarter", "halfyear", "year"];
  if (typeof raw.unit !== "string" || !units.includes(raw.unit as Pmv2ScheduleUnit)) {
    throw new Error("وحدة التكرار غير صالحة");
  }

  const config: Pmv2ScheduleConfigV1 = {
    version: 1,
    unit: raw.unit as Pmv2ScheduleUnit,
    interval: positiveInteger(raw.interval ?? 1, "فترة التكرار"),
    startDate: optionalDate(raw.startDate),
    weekdays: uniqueSortedIntegers(raw.weekdays, 0, 6, "أيام الأسبوع"),
    monthDays: normalizeDaySpecs(raw.monthDays, "أيام الشهر"),
    quarterDates: normalizeQuarterDates(raw.quarterDates),
    halfYearDates: normalizeHalfYearDates(raw.halfYearDates),
    yearDates: normalizeYearDates(raw.yearDates),
  };

  if (config.unit === "week" && config.weekdays.length === 0) {
    throw new Error("اختر يومًا واحدًا على الأقل من أيام الأسبوع");
  }
  if (config.unit === "month" && config.monthDays.length === 0) {
    throw new Error("اختر يومًا واحدًا على الأقل من أيام الشهر");
  }
  if (config.unit === "quarter" && config.quarterDates.length === 0) {
    throw new Error("أضف موعدًا واحدًا على الأقل داخل الربع");
  }
  if (config.unit === "halfyear" && config.halfYearDates.length === 0) {
    throw new Error("أضف موعدًا واحدًا على الأقل داخل النصف السنوي");
  }
  if (config.unit === "year" && config.yearDates.length === 0) {
    throw new Error("أضف موعدًا واحدًا على الأقل خلال السنة");
  }
  if (config.interval > 1 && !config.startDate) {
    throw new Error("تاريخ بداية التكرار مطلوب عندما تكون الفترة أكبر من 1");
  }

  return config;
}

export function canonicalPmv2ScheduleConfigJson(value: unknown): string | null {
  const config = parsePmv2ScheduleConfigJson(value);
  return config ? JSON.stringify(config) : null;
}

export function legacyFrequencyForScheduleUnit(unit: Pmv2ScheduleUnit) {
  return {
    day: "daily",
    week: "weekly",
    month: "monthly",
    quarter: "quarterly",
    halfyear: "biannual",
    year: "annual",
  }[unit] as "daily" | "weekly" | "monthly" | "quarterly" | "biannual" | "annual";
}

function lastDayOfMonth(year: number, monthZeroBased: number): number {
  return new Date(Date.UTC(year, monthZeroBased + 1, 0)).getUTCDate();
}

function daySpecMatches(target: Date, spec: Pmv2DaySpec): boolean {
  const last = lastDayOfMonth(target.getUTCFullYear(), target.getUTCMonth());
  const expected = spec === "last" ? last : Math.min(spec, last);
  return target.getUTCDate() === expected;
}

function startOfWeekSunday(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - date.getUTCDay()));
}

function monthIndex(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function quarterIndex(date: Date): number {
  return date.getUTCFullYear() * 4 + Math.floor(date.getUTCMonth() / 3);
}

function halfYearIndex(date: Date): number {
  return date.getUTCFullYear() * 2 + Math.floor(date.getUTCMonth() / 6);
}

export function isPmv2ScheduleConfigDueOnDate(config: Pmv2ScheduleConfigV1, date: string): boolean {
  const target = parseDateOnly(date);
  const start = config.startDate ? parseDateOnly(config.startDate) : null;
  if (start && target.getTime() < start.getTime()) return false;

  if (config.unit === "day") {
    if (config.interval === 1) return true;
    if (!start) return false;
    const days = Math.floor((target.getTime() - start.getTime()) / DAY_MS);
    return days >= 0 && days % config.interval === 0;
  }

  if (config.unit === "week") {
    if (!config.weekdays.includes(target.getUTCDay())) return false;
    if (config.interval === 1) return true;
    if (!start) return false;
    const weeks = Math.floor((startOfWeekSunday(target).getTime() - startOfWeekSunday(start).getTime()) / (7 * DAY_MS));
    return weeks >= 0 && weeks % config.interval === 0;
  }

  if (config.unit === "month") {
    if (!config.monthDays.some((spec) => daySpecMatches(target, spec))) return false;
    if (config.interval === 1) return true;
    if (!start) return false;
    const months = monthIndex(target) - monthIndex(start);
    return months >= 0 && months % config.interval === 0;
  }

  if (config.unit === "quarter") {
    const monthInQuarter = (target.getUTCMonth() % 3) + 1;
    const matchesDate = config.quarterDates.some(
      (spec) => spec.monthInQuarter === monthInQuarter && daySpecMatches(target, spec.day),
    );
    if (!matchesDate) return false;
    if (config.interval === 1) return true;
    if (!start) return false;
    const quarters = quarterIndex(target) - quarterIndex(start);
    return quarters >= 0 && quarters % config.interval === 0;
  }

  if (config.unit === "halfyear") {
    const monthInHalf = (target.getUTCMonth() % 6) + 1;
    const matchesDate = config.halfYearDates.some(
      (spec) => spec.monthInHalf === monthInHalf && daySpecMatches(target, spec.day),
    );
    if (!matchesDate) return false;
    if (config.interval === 1) return true;
    if (!start) return false;
    const halves = halfYearIndex(target) - halfYearIndex(start);
    return halves >= 0 && halves % config.interval === 0;
  }

  const matchesYearDate = config.yearDates.some(
    (spec) => spec.month === target.getUTCMonth() + 1 && daySpecMatches(target, spec.day),
  );
  if (!matchesYearDate) return false;
  if (config.interval === 1) return true;
  if (!start) return false;
  const years = target.getUTCFullYear() - start.getUTCFullYear();
  return years >= 0 && years % config.interval === 0;
}

function intervalText(unit: Pmv2ScheduleUnit, intervalValue: number) {
  const interval = Math.max(1, Math.trunc(Number(intervalValue) || 1));
  if (unit === "day") return interval === 1 ? "يوميًا" : interval === 2 ? "كل يومين" : `كل ${interval} أيام`;
  if (unit === "week") return interval === 1 ? "كل أسبوع" : interval === 2 ? "كل أسبوعين" : `كل ${interval} أسابيع`;
  if (unit === "month") return interval === 1 ? "كل شهر" : interval === 2 ? "كل شهرين" : `كل ${interval} أشهر`;
  if (unit === "year") return interval === 1 ? "سنويًا" : interval === 2 ? "كل سنتين" : `كل ${interval} سنوات`;

  const monthsPerUnit = unit === "quarter" ? 3 : unit === "halfyear" ? 6 : 0;
  const months = interval * monthsPerUnit;
  if (months === 12) return "كل سنة";
  if (months === 24) return "كل سنتين";
  if (months > 24 && months % 12 === 0) return `كل ${months / 12} سنوات`;
  return `كل ${months} أشهر`;
}

function ordinalMonthLabel(value: number) {
  return ({ 1: "الأول", 2: "الثاني", 3: "الثالث", 4: "الرابع", 5: "الخامس", 6: "السادس" } as Record<number, string>)[value] ?? String(value);
}

function formatDaySpec(spec: Pmv2DaySpec) {
  return spec === "last" ? "آخر يوم" : `يوم ${spec}`;
}

function joinArabic(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} و${values[1]}`;
  return `${values.slice(0, -1).join("، ")} و${values[values.length - 1]}`;
}

export function formatPmv2ScheduleConfigLabel(config: Pmv2ScheduleConfigV1): string {
  const base = intervalText(config.unit, config.interval);
  if (config.unit === "day") return base;
  if (config.unit === "week") {
    return `${base} • ${joinArabic(config.weekdays.map((day) => weekdayLabels[day] ?? String(day)))}`;
  }
  if (config.unit === "month") {
    const numericDays = config.monthDays.filter((day) => day !== "last").map((day) => String(day));
    const parts: string[] = [];
    if (numericDays.length) parts.push(`${numericDays.length === 1 ? "يوم" : "أيام"} ${joinArabic(numericDays)}`);
    if (config.monthDays.includes("last")) parts.push("آخر يوم من الشهر");
    return parts.length ? `${base} • ${joinArabic(parts)}` : base;
  }
  if (config.unit === "quarter") {
    const dates = config.quarterDates.map((item) => `الشهر ${ordinalMonthLabel(item.monthInQuarter)}، ${formatDaySpec(item.day)}`);
    return `${base} • ${joinArabic(dates)}`;
  }
  if (config.unit === "halfyear") {
    const dates = config.halfYearDates.map((item) => `الشهر ${ordinalMonthLabel(item.monthInHalf)}، ${formatDaySpec(item.day)}`);
    return `${base} • ${joinArabic(dates)}`;
  }
  const dates = config.yearDates.map((item) => `${item.day === "last" ? "آخر يوم من" : item.day} ${monthLabels[item.month] ?? item.month}`);
  return `${base} • ${joinArabic(dates)}`;
}

export function formatLegacyPmv2RecurrenceLabel(input: {
  frequency: string;
  frequencyValue?: number | null;
  weekday?: number | null;
  monthDay?: number | null;
}) {
  const interval = Math.max(1, Number(input.frequencyValue ?? 1));
  const unit = ({ daily: "day", weekly: "week", monthly: "month", quarterly: "quarter", biannual: "halfyear", annual: "year" } as Record<string, Pmv2ScheduleUnit>)[input.frequency];
  if (!unit) return input.frequency;
  const parts = [intervalText(unit, interval)];
  if (input.frequency === "weekly" && input.weekday != null) parts.push(weekdayLabels[Number(input.weekday)] ?? `اليوم ${input.weekday}`);
  if (input.frequency === "monthly" && input.monthDay != null) parts.push(Number(input.monthDay) === 31 ? "يوم 31 (نهاية الشهر عند الحاجة)" : `يوم ${input.monthDay}`);
  return parts.join(" • ");
}

export function formatPmv2ChecklistScheduleLabel(input: {
  scheduleConfigJson?: string | null;
  frequency: string;
  frequencyValue?: number | null;
  weekday?: number | null;
  monthDay?: number | null;
}): string {
  const config = parsePmv2ScheduleConfigJson(input.scheduleConfigJson ?? null);
  return config ? formatPmv2ScheduleConfigLabel(config) : formatLegacyPmv2RecurrenceLabel(input);
}
