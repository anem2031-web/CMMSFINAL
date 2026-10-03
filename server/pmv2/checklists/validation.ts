import { canonicalPmv2ScheduleConfigJson, legacyFrequencyForScheduleUnit, parsePmv2ScheduleConfigJson } from "./schedule-config";

export const PMV2_CHECKLIST_FREQUENCIES = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "biannual",
  "annual",
] as const;

export type Pmv2ChecklistFrequency =
  (typeof PMV2_CHECKLIST_FREQUENCIES)[number];

export interface Pmv2ChecklistItemWrite {
  checklistId: number;
  title: string;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
  frequency: Pmv2ChecklistFrequency;
  frequencyValue: number | null;
  weekday: number | null;
  monthDay: number | null;
  anchorDate: string | null;
  scheduleConfigJson?: string | null;
}

export class Pmv2ChecklistValidationError extends Error {
  readonly field: keyof Pmv2ChecklistItemWrite | "input";

  constructor(
    field: keyof Pmv2ChecklistItemWrite | "input",
    message: string,
  ) {
    super(message);
    this.name = "Pmv2ChecklistValidationError";
    this.field = field;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requirePositiveInteger(value: unknown, field: "checklistId"): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Pmv2ChecklistValidationError(field, `${field} يجب أن يكون رقمًا صحيحًا أكبر من صفر`);
  }
  return Number(value);
}

function requireNonNegativeInteger(value: unknown, field: "sortOrder"): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Pmv2ChecklistValidationError(field, `${field} يجب أن يكون رقمًا صحيحًا غير سالب`);
  }
  return Number(value);
}

function requireBoolean(value: unknown, field: "isRequired" | "isActive"): boolean {
  if (typeof value !== "boolean") {
    throw new Pmv2ChecklistValidationError(field, `${field} يجب أن تكون قيمة منطقية`);
  }
  return value;
}

function optionalPositiveInteger(
  value: unknown,
  field: "frequencyValue",
): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Pmv2ChecklistValidationError(field, "كل كم دورة يجب أن يكون رقمًا صحيحًا 1 أو أكثر");
  }
  return Number(value);
}

function optionalIntegerRange(
  value: unknown,
  field: "weekday" | "monthDay",
  min: number,
  max: number,
): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new Pmv2ChecklistValidationError(field, `${field} يجب أن يكون بين ${min} و${max}`);
  }
  return Number(value);
}

function optionalIsoDate(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Pmv2ChecklistValidationError("anchorDate", "anchorDate يجب أن يكون بتاريخ بصيغة YYYY-MM-DD");
  }

  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Pmv2ChecklistValidationError("anchorDate", "anchorDate ليس تاريخًا صالحًا");
  }
  return value;
}

/**
 * PM V2 write-boundary validation for checklist items.
 *
 * TiDB in the current CMMS environment has CHECK constraints disabled, so the
 * application service must call this function before every checklist-item
 * INSERT/UPDATE. Phase 2 also enforces the frequency-specific recurrence shape here.
 */
export function validatePmv2ChecklistItemWrite(
  input: unknown,
): Pmv2ChecklistItemWrite {
  if (!isRecord(input)) {
    throw new Pmv2ChecklistValidationError("input", "بيانات بند قائمة الصيانة غير صالحة");
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > 300) {
    throw new Pmv2ChecklistValidationError(
      "title",
      "عنوان البند مطلوب ويجب ألا يتجاوز 300 حرف",
    );
  }

  if (
    typeof input.frequency !== "string" ||
    !PMV2_CHECKLIST_FREQUENCIES.includes(
      input.frequency as Pmv2ChecklistFrequency,
    )
  ) {
    throw new Pmv2ChecklistValidationError("frequency", "نوع التكرار غير صالح");
  }

  const frequency = input.frequency as Pmv2ChecklistFrequency;
  const frequencyValue = optionalPositiveInteger(input.frequencyValue, "frequencyValue");
  const weekday = optionalIntegerRange(input.weekday, "weekday", 0, 6);
  const monthDay = optionalIntegerRange(input.monthDay, "monthDay", 1, 31);
  const anchorDate = optionalIsoDate(input.anchorDate);
  let scheduleConfigJson: string | null = null;
  let scheduleConfig = null;
  try {
    scheduleConfigJson = canonicalPmv2ScheduleConfigJson(input.scheduleConfigJson ?? null);
    scheduleConfig = parsePmv2ScheduleConfigJson(scheduleConfigJson);
  } catch (error) {
    throw new Pmv2ChecklistValidationError(
      "scheduleConfigJson",
      error instanceof Error ? error.message : "إعداد التكرار غير صالح",
    );
  }
  const interval = frequencyValue ?? 1;

  if (scheduleConfig) {
    const expectedFrequency = legacyFrequencyForScheduleUnit(scheduleConfig.unit);
    if (frequency !== expectedFrequency) {
      throw new Pmv2ChecklistValidationError(
        "frequency",
        "نوع التكرار لا يطابق إعداد الجدول",
      );
    }
  } else if (frequency === "daily") {
    if (weekday !== null || monthDay !== null) {
      throw new Pmv2ChecklistValidationError(
        weekday !== null ? "weekday" : "monthDay",
        "التكرار اليومي لا يستخدم يوم الأسبوع أو يوم الشهر",
      );
    }
    if (interval > 1 && !anchorDate) {
      throw new Pmv2ChecklistValidationError(
        "anchorDate",
        "تاريخ الارتكاز مطلوب عند التكرار اليومي كل أكثر من يوم",
      );
    }
  }

  else if (frequency === "weekly") {
    if (weekday === null) {
      throw new Pmv2ChecklistValidationError("weekday", "يوم الأسبوع مطلوب للتكرار الأسبوعي");
    }
    if (monthDay !== null) {
      throw new Pmv2ChecklistValidationError("monthDay", "التكرار الأسبوعي لا يستخدم يوم الشهر");
    }
    if (interval > 1 && !anchorDate) {
      throw new Pmv2ChecklistValidationError(
        "anchorDate",
        "تاريخ الارتكاز مطلوب عند التكرار كل أكثر من أسبوع",
      );
    }
  }

  else if (frequency === "monthly") {
    if (monthDay === null) {
      throw new Pmv2ChecklistValidationError("monthDay", "يوم الشهر مطلوب للتكرار الشهري");
    }
    if (weekday !== null) {
      throw new Pmv2ChecklistValidationError("weekday", "التكرار الشهري لا يستخدم يوم الأسبوع");
    }
    if (interval > 1 && !anchorDate) {
      throw new Pmv2ChecklistValidationError(
        "anchorDate",
        "تاريخ الارتكاز مطلوب عند التكرار كل أكثر من شهر",
      );
    }
  }

  else if (["quarterly", "biannual", "annual"].includes(frequency)) {
    if (!anchorDate) {
      throw new Pmv2ChecklistValidationError(
        "anchorDate",
        "تاريخ الارتكاز مطلوب للتكرار الربع سنوي أو النصف سنوي أو السنوي",
      );
    }
    if (weekday !== null || monthDay !== null) {
      throw new Pmv2ChecklistValidationError(
        weekday !== null ? "weekday" : "monthDay",
        "هذا التكرار يعتمد على تاريخ الارتكاز ولا يستخدم يوم الأسبوع أو يوم الشهر",
      );
    }
  }

  return {
    checklistId: requirePositiveInteger(input.checklistId, "checklistId"),
    title,
    sortOrder: requireNonNegativeInteger(input.sortOrder ?? 0, "sortOrder"),
    isRequired: requireBoolean(input.isRequired ?? true, "isRequired"),
    isActive: requireBoolean(input.isActive ?? true, "isActive"),
    frequency,
    frequencyValue,
    weekday,
    monthDay,
    anchorDate,
    scheduleConfigJson,
  };
}


export interface Pmv2ChecklistExistingItem extends Pmv2ChecklistItemWrite {
  id?: number;
}

function normalizedTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function recurrenceSignature(item: Pmv2ChecklistItemWrite): string {
  if (item.scheduleConfigJson) return item.scheduleConfigJson;
  return JSON.stringify([
    item.frequency,
    item.frequencyValue ?? 1,
    item.weekday,
    item.monthDay,
    item.anchorDate,
  ]);
}

/**
 * Active checklist items must have a unique sort order within one checklist.
 * Titles may repeat, but an exact active duplicate with the same normalized title
 * and the same recurrence shape is rejected as an accidental duplicate.
 */
export function assertPmv2ChecklistItemLogicalUniqueness(
  candidate: Pmv2ChecklistItemWrite,
  existingItems: readonly Pmv2ChecklistExistingItem[],
  excludeItemId?: number,
): void {
  if (!candidate.isActive) return;

  const peers = existingItems.filter(
    (item) =>
      item.checklistId === candidate.checklistId &&
      item.isActive &&
      (excludeItemId == null || item.id !== excludeItemId),
  );

  if (peers.some((item) => item.sortOrder === candidate.sortOrder)) {
    throw new Pmv2ChecklistValidationError(
      "sortOrder",
      `الترتيب ${candidate.sortOrder} مستخدم بالفعل داخل قائمة الصيانة`,
    );
  }

  const title = normalizedTitle(candidate.title);
  const recurrence = recurrenceSignature(candidate);
  if (
    peers.some(
      (item) =>
        normalizedTitle(item.title) === title &&
        recurrenceSignature(item) === recurrence,
    )
  ) {
    throw new Pmv2ChecklistValidationError(
      "title",
      "يوجد بند فعال بنفس العنوان وإعدادات التكرار داخل هذه القائمة",
    );
  }
}
