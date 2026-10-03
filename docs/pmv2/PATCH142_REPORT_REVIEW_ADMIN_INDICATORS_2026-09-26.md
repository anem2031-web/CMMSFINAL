# PATCH142 — Daily report review + additional management indicators

Date: 2026-09-26

## Goal
Complete the remaining PM V2 development items before deferred UAT:
1. let maintenance management record that a team's daily Scheduled Maintenance report was reviewed;
2. extend owner/management indicators without changing any external workflow;
3. keep SLA thresholds configurable and unset until Operations chooses actual values.

## Daily report review
- Review is scoped to **report date + PM V2 team** because PM V2 assignment truth is team-level.
- Stores reviewer user ID, review timestamp and optional manager note.
- Technician-filtered views remain analysis views; marking review is allowed only on the whole-team report view.
- Review can be cleared and re-recorded if required.
- New PM V2-only table: `pmv2_daily_report_reviews`.
- Migration: `drizzle/2026_09_26_pmv2_daily_report_reviews.sql`.

## Additional management indicators
PATCH139/140 owner indicators are extended with:
- open tasks by specialty;
- open tasks by task status;
- average current responsibility duration by role in addition to oldest duration;
- last-30-days scheduled completion counts/rates by specialty;
- last-30-days scheduled completion counts/rates by team.

These are descriptive PM V2 workload/completion indicators. They are not employee scoring and do not classify a role/person as late unless an explicit SLA exists.

## Boundaries
- PM V2 only.
- No writes to Purchase, Inventory, Tickets, Accounting or Legacy PM.
- No invented SLA values.
- Deferred runtime/UAT items remain deferred.
