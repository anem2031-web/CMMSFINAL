import type { Pmv2ChecklistFrequency } from "./validation";
import {
  isPmv2ScheduleConfigDueOnDate,
  parsePmv2ScheduleConfigJson,
} from "./schedule-config";

export interface Pmv2RecurrenceConfig {
  frequency: Pmv2ChecklistFrequency;
  frequencyValue: number | null;
  weekday: number | null;
  monthDay: number | null;
  anchorDate: string | null;
  scheduleConfigJson?: string | null;
  isActive?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date-only value: ${value}`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date-only value: ${value}`);
  }
  return date;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(year: number, monthZeroBased: number): number {
  return new Date(Date.UTC(year, monthZeroBased + 1, 0)).getUTCDate();
}

function clampedDay(year: number, monthZeroBased: number, requestedDay: number) {
  return Math.min(requestedDay, lastDayOfMonth(year, monthZeroBased));
}

function monthDistance(from: Date, to: Date): number {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth())
  );
}

function startOfWeekSunday(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - date.getUTCDay(),
    ),
  );
}

function effectiveInterval(config: Pmv2RecurrenceConfig): number {
  return config.frequencyValue ?? 1;
}

function isOnOrAfterAnchor(target: Date, anchorDate: string | null) {
  return !anchorDate || target.getTime() >= parseDateOnly(anchorDate).getTime();
}

/**
 * Returns whether one active checklist item is due on an exact CMMS date.
 * This is date-only logic (UTC internally) and must not depend on browser/server timezone.
 */
export function isPmv2RecurrenceDueOnDate(
  config: Pmv2RecurrenceConfig,
  date: string,
): boolean {
  if (config.isActive === false) return false;

  if (config.scheduleConfigJson) {
    const scheduleConfig = parsePmv2ScheduleConfigJson(config.scheduleConfigJson);
    if (scheduleConfig) return isPmv2ScheduleConfigDueOnDate(scheduleConfig, date);
  }

  const target = parseDateOnly(date);
  if (!isOnOrAfterAnchor(target, config.anchorDate)) return false;
  const interval = effectiveInterval(config);

  switch (config.frequency) {
    case "daily": {
      if (interval === 1 && !config.anchorDate) return true;
      const anchor = parseDateOnly(config.anchorDate!);
      const days = Math.floor((target.getTime() - anchor.getTime()) / DAY_MS);
      return days >= 0 && days % interval === 0;
    }

    case "weekly": {
      if (target.getUTCDay() !== config.weekday) return false;
      if (interval === 1 && !config.anchorDate) return true;
      if (!config.anchorDate) return true;
      const anchor = parseDateOnly(config.anchorDate);
      const anchorWeek = startOfWeekSunday(anchor);
      const targetWeek = startOfWeekSunday(target);
      const weeks = Math.floor((targetWeek.getTime() - anchorWeek.getTime()) / (7 * DAY_MS));
      return weeks >= 0 && weeks % interval === 0;
    }

    case "monthly": {
      const requestedDay = config.monthDay!;
      const targetDay = clampedDay(
        target.getUTCFullYear(),
        target.getUTCMonth(),
        requestedDay,
      );
      if (target.getUTCDate() !== targetDay) return false;
      if (interval === 1 && !config.anchorDate) return true;
      if (!config.anchorDate) return true;
      const anchor = parseDateOnly(config.anchorDate);
      const months = monthDistance(anchor, target);
      return months >= 0 && months % interval === 0;
    }

    case "quarterly":
    case "biannual":
    case "annual": {
      const anchor = parseDateOnly(config.anchorDate!);
      const baseMonths =
        config.frequency === "quarterly" ? 3 : config.frequency === "biannual" ? 6 : 12;
      const stepMonths = baseMonths * interval;
      const months = monthDistance(anchor, target);
      if (months < 0 || months % stepMonths !== 0) return false;
      const expectedDay = clampedDay(
        target.getUTCFullYear(),
        target.getUTCMonth(),
        anchor.getUTCDate(),
      );
      return target.getUTCDate() === expectedDay;
    }
  }
}

/** Finds the first due date on or after the requested date, bounded to 25 years. */
export function getNextPmv2DueDate(
  config: Pmv2RecurrenceConfig,
  onOrAfter: string,
): string | null {
  let cursor = parseDateOnly(onOrAfter);
  const maxDays = 366 * 25;
  for (let i = 0; i <= maxDays; i += 1) {
    const candidate = formatDateOnly(cursor);
    if (isPmv2RecurrenceDueOnDate(config, candidate)) return candidate;
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return null;
}
