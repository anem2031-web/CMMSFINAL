import type { SupportedLanguage } from "@/contexts/LanguageContext";

export type Pmv2RecurrenceSnapshot = {
  recurrenceLabelSnapshot?: string | null;
  frequencySnapshot?: string | null;
  frequencyValueSnapshot?: number | null;
  weekdaySnapshot?: number | null;
  monthDaySnapshot?: number | null;
  anchorDateSnapshot?: string | null;
};

const weekdayLabels: Record<SupportedLanguage, Record<number, string>> = {
  ar: { 0: "الأحد", 1: "الاثنين", 2: "الثلاثاء", 3: "الأربعاء", 4: "الخميس", 5: "الجمعة", 6: "السبت" },
  en: { 0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday" },
  ur: { 0: "اتوار", 1: "پیر", 2: "منگل", 3: "بدھ", 4: "جمعرات", 5: "جمعہ", 6: "ہفتہ" },
};

const monthLabels: Record<SupportedLanguage, Record<number, string>> = {
  ar: { 1: "يناير", 2: "فبراير", 3: "مارس", 4: "أبريل", 5: "مايو", 6: "يونيو", 7: "يوليو", 8: "أغسطس", 9: "سبتمبر", 10: "أكتوبر", 11: "نوفمبر", 12: "ديسمبر" },
  en: { 1: "January", 2: "February", 3: "March", 4: "April", 5: "May", 6: "June", 7: "July", 8: "August", 9: "September", 10: "October", 11: "November", 12: "December" },
  ur: { 1: "جنوری", 2: "فروری", 3: "مارچ", 4: "اپریل", 5: "مئی", 6: "جون", 7: "جولائی", 8: "اگست", 9: "ستمبر", 10: "اکتوبر", 11: "نومبر", 12: "دسمبر" },
};

function n(value: number, language: SupportedLanguage) {
  return new Intl.NumberFormat(language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US").format(value);
}

export function formatPmv2ManagerIntervalLabel(unit: string, intervalValue: number, language: SupportedLanguage = "ar") {
  const interval = Math.max(1, Math.trunc(Number(intervalValue) || 1));
  if (language === "en") {
    const unitMap: Record<string, [string, string]> = { day: ["day", "days"], week: ["week", "weeks"], month: ["month", "months"], year: ["year", "years"] };
    if (unitMap[unit]) return interval === 1 ? `Every ${unitMap[unit][0]}` : `Every ${n(interval, language)} ${unitMap[unit][1]}`;
    const monthsPerUnit = unit === "quarter" ? 3 : unit === "halfyear" ? 6 : 0;
    if (monthsPerUnit) {
      const months = interval * monthsPerUnit;
      return months % 12 === 0 ? (months === 12 ? "Every year" : `Every ${n(months / 12, language)} years`) : `Every ${n(months, language)} months`;
    }
    return "Custom recurrence";
  }
  if (language === "ur") {
    const unitMap: Record<string, string> = { day: "دن", week: "ہفتے", month: "ماہ", year: "سال" };
    if (unitMap[unit]) return interval === 1 ? (unit === "day" ? "روزانہ" : `ہر ${unitMap[unit].replace(/ے$/, "ہ")}`) : `ہر ${n(interval, language)} ${unitMap[unit]}`;
    const monthsPerUnit = unit === "quarter" ? 3 : unit === "halfyear" ? 6 : 0;
    if (monthsPerUnit) {
      const months = interval * monthsPerUnit;
      return months % 12 === 0 ? (months === 12 ? "ہر سال" : `ہر ${n(months / 12, language)} سال`) : `ہر ${n(months, language)} ماہ`;
    }
    return "حسب ضرورت تکرار";
  }

  if (unit === "day") return interval === 1 ? "يوميًا" : interval === 2 ? "كل يومين" : `كل ${interval} أيام`;
  if (unit === "week") return interval === 1 ? "كل أسبوع" : interval === 2 ? "كل أسبوعين" : `كل ${interval} أسابيع`;
  if (unit === "month") return interval === 1 ? "كل شهر" : interval === 2 ? "كل شهرين" : `كل ${interval} أشهر`;
  if (unit === "year") return interval === 1 ? "سنويًا" : interval === 2 ? "كل سنتين" : `كل ${interval} سنوات`;
  const monthsPerUnit = unit === "quarter" ? 3 : unit === "halfyear" ? 6 : 0;
  if (monthsPerUnit) {
    const months = interval * monthsPerUnit;
    if (months === 12) return "كل سنة";
    if (months === 24) return "كل سنتين";
    if (months > 24 && months % 12 === 0) return `كل ${months / 12} سنوات`;
    return months === 2 ? "كل شهرين" : `كل ${months} أشهر`;
  }
  return "تكرار مخصص";
}

function intervalLabel(frequency: string, interval: number, language: SupportedLanguage) {
  const unit = { daily: "day", weekly: "week", monthly: "month", quarterly: "quarter", biannual: "halfyear", annual: "year" }[frequency];
  return unit ? formatPmv2ManagerIntervalLabel(unit, interval, language) : frequency;
}

function joinLocalized(values: string[], language: SupportedLanguage) {
  if (values.length <= 1) return values[0] ?? "";
  if (language === "en") return values.length === 2 ? `${values[0]} and ${values[1]}` : `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
  const conjunction = language === "ur" ? " اور " : " و";
  const comma = language === "ur" ? "، " : "، ";
  if (values.length === 2) return `${values[0]}${conjunction}${values[1]}`;
  return `${values.slice(0, -1).join(comma)}${conjunction}${values[values.length - 1]}`;
}

function ordinalMonthLabel(value: unknown, language: SupportedLanguage) {
  const i = Number(value);
  if (language === "en") return ({ 1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth", 6: "sixth" } as Record<number, string>)[i] ?? String(value);
  if (language === "ur") return ({ 1: "پہلا", 2: "دوسرا", 3: "تیسرا", 4: "چوتھا", 5: "پانچواں", 6: "چھٹا" } as Record<number, string>)[i] ?? String(value);
  return ({ 1: "الأول", 2: "الثاني", 3: "الثالث", 4: "الرابع", 5: "الخامس", 6: "السادس" } as Record<number, string>)[i] ?? String(value);
}

function daySpecLabel(value: unknown, language: SupportedLanguage) {
  if (value === "last") return language === "en" ? "last day" : language === "ur" ? "آخری دن" : "آخر يوم";
  return language === "en" ? `day ${value}` : language === "ur" ? `دن ${value}` : `يوم ${value}`;
}

export function formatPmv2ScheduleConfigJsonLabel(value?: string | null, language: SupportedLanguage = "ar"): string | null {
  if (!value) return null;
  try {
    const config = JSON.parse(value);
    if (!config || config.version !== 1 || typeof config.unit !== "string") return null;
    const interval = Math.max(1, Number(config.interval ?? 1));
    const unitFrequency = { day: "daily", week: "weekly", month: "monthly", quarter: "quarterly", halfyear: "biannual", year: "annual" } as Record<string, string>;
    const frequency = unitFrequency[config.unit];
    if (!frequency) return null;
    const base = intervalLabel(frequency, interval, language);

    if (config.unit === "day") return base;
    if (config.unit === "week") {
      const days = Array.isArray(config.weekdays) ? config.weekdays.map((day: unknown) => weekdayLabels[language][Number(day)] ?? String(day)) : [];
      return days.length ? `${base} • ${joinLocalized(days, language)}` : base;
    }
    if (config.unit === "month") {
      const values = Array.isArray(config.monthDays) ? config.monthDays : [];
      const numericDays = values.filter((day: unknown) => day !== "last").map((day: unknown) => String(day));
      const parts: string[] = [];
      if (numericDays.length) {
        const prefix = language === "en" ? (numericDays.length === 1 ? "day" : "days") : language === "ur" ? "دن" : (numericDays.length === 1 ? "يوم" : "أيام");
        parts.push(`${prefix} ${joinLocalized(numericDays, language)}`);
      }
      if (values.includes("last")) parts.push(language === "en" ? "last day of the month" : language === "ur" ? "مہینے کا آخری دن" : "آخر يوم من الشهر");
      return parts.length ? `${base} • ${joinLocalized(parts, language)}` : base;
    }
    if (config.unit === "quarter" || config.unit === "halfyear") {
      const items = config.unit === "quarter" ? config.quarterDates : config.halfYearDates;
      const prop = config.unit === "quarter" ? "monthInQuarter" : "monthInHalf";
      const dates = Array.isArray(items) ? items.map((item: any) => {
        const month = ordinalMonthLabel(item[prop], language);
        const day = daySpecLabel(item.day, language);
        return language === "en" ? `${month} month, ${day}` : language === "ur" ? `${month} مہینہ، ${day}` : `الشهر ${month}، ${day}`;
      }) : [];
      return dates.length ? `${base} • ${joinLocalized(dates, language)}` : base;
    }
    const dates = Array.isArray(config.yearDates) ? config.yearDates.map((item: any) => {
      const month = monthLabels[language][Number(item.month)] ?? item.month;
      if (item.day === "last") return language === "en" ? `last day of ${month}` : language === "ur" ? `${month} کا آخری دن` : `آخر يوم من ${month}`;
      return `${item.day} ${month}`;
    }) : [];
    return dates.length ? `${base} • ${joinLocalized(dates, language)}` : base;
  } catch {
    return null;
  }
}

export function formatPmv2ChecklistRecurrenceLabel(item: { scheduleConfigJson?: string | null; frequency?: string | null; frequencyValue?: number | null; weekday?: number | null; monthDay?: number | null }, language: SupportedLanguage = "ar"): string {
  const configured = formatPmv2ScheduleConfigJsonLabel(item.scheduleConfigJson, language);
  if (configured) return configured;
  const frequency = item.frequency;
  if (!frequency) return language === "en" ? "Recurrence unavailable" : language === "ur" ? "تکرار دستیاب نہیں" : "تكرار غير متاح";
  const interval = Math.max(1, Number(item.frequencyValue ?? 1));
  const parts = [intervalLabel(frequency, interval, language)];
  if (frequency === "weekly" && item.weekday != null) parts.push(weekdayLabels[language][Number(item.weekday)] ?? String(item.weekday));
  if (frequency === "monthly" && item.monthDay != null) {
    const day = Number(item.monthDay);
    parts.push(day === 31 ? (language === "en" ? "day 31 (month end when needed)" : language === "ur" ? "دن 31 (ضرورت پر مہینے کا اختتام)" : "يوم 31 (نهاية الشهر عند الحاجة)") : daySpecLabel(day, language));
  }
  return parts.join(" • ");
}

export function formatPmv2RecurrenceLabel(item: Pmv2RecurrenceSnapshot, language: SupportedLanguage = "ar"): string {
  // Snapshot labels from old rows can be Arabic. Prefer rebuilding from the
  // stored recurrence primitives for non-Arabic viewers when available.
  if (language === "ar" && item.recurrenceLabelSnapshot?.trim()) return item.recurrenceLabelSnapshot.trim();
  const frequency = item.frequencySnapshot;
  if (!frequency) return item.recurrenceLabelSnapshot?.trim() || (language === "en" ? "Recurrence unavailable" : language === "ur" ? "تکرار دستیاب نہیں" : "تكرار غير متاح");
  const interval = Math.max(1, Number(item.frequencyValueSnapshot ?? 1));
  const parts = [intervalLabel(frequency, interval, language)];
  if (frequency === "weekly" && item.weekdaySnapshot != null) parts.push(weekdayLabels[language][Number(item.weekdaySnapshot)] ?? String(item.weekdaySnapshot));
  if (frequency === "monthly" && item.monthDaySnapshot != null) {
    const day = Number(item.monthDaySnapshot);
    parts.push(day === 31 ? (language === "en" ? "day 31 (month end when needed)" : language === "ur" ? "دن 31 (ضرورت پر مہینے کا اختتام)" : "يوم 31 (نهاية الشهر عند الحاجة)") : daySpecLabel(day, language));
  }
  return parts.join(" • ");
}
