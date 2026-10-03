export type Pmv2DailyWorkloadStatus = "available" | "medium" | "high" | "conflict";

/**
 * Initial manager-facing workload baseline for Phase 2.
 * No team-specific capacity model exists yet, so workload is measured against
 * one standard 8-hour planning day. This is intentionally isolated here so a
 * later capacity setting can replace it without changing recurrence or tasks.
 */
export const PMV2_DAILY_TEAM_CAPACITY_MINUTES = 8 * 60;
export const PMV2_DAILY_WORKLOAD_AVAILABLE_THROUGH_MINUTES = 4 * 60;
export const PMV2_DAILY_WORKLOAD_MEDIUM_THROUGH_MINUTES = 6 * 60;
export const PMV2_DAILY_WORKLOAD_HIGH_THROUGH_MINUTES = PMV2_DAILY_TEAM_CAPACITY_MINUTES;

export function classifyPmv2DailyWorkload(totalEstimatedMinutes: number): Pmv2DailyWorkloadStatus {
  const minutes = Math.max(0, Math.trunc(Number(totalEstimatedMinutes) || 0));
  if (minutes > PMV2_DAILY_WORKLOAD_HIGH_THROUGH_MINUTES) return "conflict";
  if (minutes > PMV2_DAILY_WORKLOAD_MEDIUM_THROUGH_MINUTES) return "high";
  if (minutes > PMV2_DAILY_WORKLOAD_AVAILABLE_THROUGH_MINUTES) return "medium";
  return "available";
}
