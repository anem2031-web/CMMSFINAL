# PM V2 Patch Manifest

Patch: `PMV2_PATCH_041_PHASE1_SCHEMA_COMPLETE_GATE_PENDING_2026-09-08.zip`

## Purpose

Confirm DB Step 18 runtime PASS, mark all 18 frozen Schema tables complete, and execute the Phase 1 standalone acceptance checks without starting Phase 2.

## Files

- `server/tests/pmv2-phase1-acceptance-gate.node.mjs`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/07_ISSUES_AND_FIXES.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/README.md`
- `docs/pmv2/PATCH_MANIFEST.md`

## Verified

- DB Steps 1–18: PASS by user runtime confirmations.
- Standalone PM V2 Node tests: 63/63 PASS.
- Standalone Phase 1 acceptance gate: 6/6 PASS.
- Syntax/relative-import-path scan: PASS.
- Clean baseline diff: no Legacy PM/Ticket/Purchase/Inventory workflow source file modified by PM V2 patches.

## Open Gate

- Full project Typecheck: PENDING.
- Full Vitest suite: PENDING.
- Production build: PENDING.
- Full application runtime regression smoke: PENDING.

Dependencies are not present in the working copy and `npm ci --ignore-scripts --no-audit --no-fund` did not complete in the assistant environment. Therefore Phase 1 is **not closed** and Phase 2 must not start.

## Safety

- No DB write executed by assistant.
- No new SQL requested in this patch.
- No Legacy PM workflow change.
- No Ticket/Purchase/Inventory/Notification workflow change.
- No duplicate Master Data.

## PATCH 051 — Checklist item uniqueness validation — 2026-09-08
- `server/pmv2/checklists/validation.ts` — pure active-order + exact-duplicate validation.
- `server/pmv2/checklists/service.ts` — enforce validation on create/update/reactivation.
- `server/tests/pmv2-checklist-item-uniqueness.node.mjs` — 5 regression scenarios.
- PM V2 standalone suite: 79/79 PASS.
- DB hardening intentionally deferred until the existing duplicated test row is cleaned manually.

## Patch 052 — 2026-09-09
- Scheduled Maintenance manager-first usability and task-list scalability.
- Opens on tasks, adds five workload cards, dynamic active-team selector, search, task server pagination, and simple filters/pagination on other management tabs.
- No SQL. Phase 2 remains CLOSED/PASS; Phase 3 remains READY/NOT STARTED.

- **053** — Scheduled Maintenance: add **كل المهام** quick card; keep **مهام اليوم** default. No SQL.

- **054** — Scheduled Maintenance task list: 20 tasks per page with existing **السابق / التالي** navigation. No SQL.

- **055** — Scheduled Maintenance: move **تشغيل الجدولة اليدوي للاختبار** above the task results, after search/team controls. No SQL.

- **056** — Scheduled Maintenance: show **من تاريخ / إلى تاريخ** only inside **كل المهام**, with one-click **مسح الفلاتر**. Reuses existing PM V2 task-list date filters; no SQL.
- **057** — Biweekly recurrence contract verification for every-2-weeks cadence. No SQL.
- **058** — Exact existing-task biweekly backfill runtime regression + manual scheduler date helper to prevent confusing task filters with scheduler execution. No SQL.

- **059** — Historical task-item recurrence provenance: persist structured recurrence snapshots on newly generated `pmv2_task_items`, show a compact Arabic recurrence badge beside each historical item, and fall back to the current source checklist recurrence for pre-patch rows. Requires one manual `ALTER TABLE` step before applying the code patch. No Legacy PM change.

- **060** — Fix historical task-item read regression introduced by Patch 059: import the `pmv2ChecklistItems` schema table used by the fallback join and add a focused regression guard. No SQL; Patch 059 ALTER already confirmed `Query OK`. No Legacy PM change.

- **061** — Scheduled Maintenance `كل المهام`: exact same-day DATE matching, explicit auto-refresh on date changes, and visible task-query errors. No SQL.

- **062** — Programs/Targets UX: hide Sites/Sections/Assets already linked to the selected program; preserve backend duplicate guard. No SQL.

- **063** — Checklist recurrence input validation: remove UI clamping of `كل كم دورة` values, reject zero/negative/fractional values before mutation, and retain the backend positive-integer guard. No SQL.

## 064 — SIMPLE_RECURRENCE_UI_AND_CUSTOM_SCHEDULES — 2026-09-09
- Simplified manager-facing recurrence presets and custom schedule builder.
- Versioned `scheduleConfigJson` recurrence engine with backward-compatible legacy fallback.
- Historical `recurrenceLabelSnapshot` for newly generated task items.
- Manual DB prerequisite is documented in `drizzle/2026_09_09_pmv2_simple_recurrence_schedule.sql`.

- **065** — PM V2 team workload foundation: optional program estimated duration schema; one manual SQL step.

- **066** — Program edit UX + estimated task duration persistence; no additional SQL.

- **067** — Daily team workload calculation/status: read-only per-team/per-day aggregation from generated tasks and program estimated duration; explicit incomplete-estimate metadata; 8-hour baseline statuses; no SQL and no Phase 3 work.

- **068** — Simple manager-facing `حمل الفرق` weekly matrix: active teams × seven days, compact workload status cells, explicit missing-duration indicator, click-through daily task details, and cancelled-task alignment; no SQL and no Phase 3 work.

- **069** — Operational readability for `حمل الفرق`: current week defaults to today onward, full-week review toggle, highlighted today/subdued elapsed days, one active-team filter, and separate overdue unfinished-task alert with no automatic rollover; no SQL and no Phase 3 work.

- **070** — Workload overdue alert direct navigation: opens `المهام المجدولة → المتأخرة` in one click and preserves the selected workload team filter; navigation-only, no SQL, no rescheduling, and no Phase 3 work.


- **071** — Phase 2 workload acceptance checkpoint: records Patches 068–070 manual PASS results, reconciles current Phase 2 status to final hardening/acceptance, and strengthens regression coverage for populated team/day cell details. No runtime behavior change, no SQL, no Phase 3 work.

- **072** — Cross-cutting auth session stability hotfix during Phase 2 acceptance: distinguish definitive invalid-session failures from transient DB/OAuth authentication dependency failures; prevent false login redirects, stop per-request `lastSignedIn` writes, and show a retry state on temporary auth-check failure. No SQL, no session-duration/permission change, no Phase 3 work.

- **073** — Workload selected-cell detail readability: expose the existing program `estimatedDurationMinutes` on PM V2 task-list rows and show it beside each task under **مهام اليوم المختار**; no SQL, no scheduling behavior change, no Phase 3 work.

---

Patch: `PMV2_PATCH_074_AUTOMATIC_CHECKLIST_ITEM_ORDER_2026-09-12.zip`

## Purpose
Remove the confusing manual checklist-item order input discovered during final Phase 2 recurrence acceptance and make manager-created checklist items receive a stable automatic next order.

## Files
- `client/src/pages/pmv2/ScheduledMaintenance.tsx`
- `server/pmv2/checklists/service.ts`
- `server/pmv2/checklists/order.ts`
- `server/tests/pmv2-checklist-auto-order.node.mjs`
- `docs/pmv2/05_SCREENS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/07_ISSUES_AND_FIXES.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`

## Verified
- Automatic-order focused regression: 7/7 PASS.
- Patch 064 recurrence UI regression: 6/6 PASS.
- Team-workload view regression: PASS.
- Syntax transpile for changed runtime TS/TSX files: PASS.
- No SQL required.

## Patch 075 — Checklist item form reset
Purpose: prevent accidental schedule carry-over when managers add consecutive checklist items during Phase 2 recurrence acceptance.

Files:
- `client/src/pages/pmv2/ScheduledMaintenance.tsx` — reset the complete add-item form after successful create while preserving the selected checklist.
- `server/tests/pmv2-checklist-item-form-reset.node.mjs` — focused regression coverage for reset behavior and checklist preservation.
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`

No SQL. Phase 3 not started.

## Patch 076 — Manager-friendly recurrence wording
Purpose: translate recurrence configuration into maintenance-manager language consistently across daily, weekly, monthly, quarterly/half-year, and annual schedules without changing recurrence semantics.

Files:
- `client/src/pages/pmv2/ScheduledMaintenance.tsx`
- `client/src/pages/pmv2/recurrence-label.ts`
- `server/pmv2/checklists/schedule-config.ts`
- `server/tests/pmv2-manager-friendly-recurrence-ui.node.mjs`
- `server/tests/pmv2-simple-recurrence-ui-regression.node.mjs`
- `server/tests/pmv2-simple-recurrence-config.node.mjs`
- `server/tests/pmv2-task-item-recurrence-snapshot.node.mjs`
- `docs/pmv2/05_SCREENS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`

No SQL. Phase 3 not started.


## Patch 077 — Two-question recurrence UX
Purpose: remove the remaining interpretive/technical wording from custom recurrence after Patch 076 and present the setup as two direct manager questions.

Files:
- `client/src/pages/pmv2/ScheduledMaintenance.tsx`
- `server/tests/pmv2-manager-friendly-recurrence-ui.node.mjs`
- `server/tests/pmv2-simple-recurrence-ui-regression.node.mjs`
- `docs/pmv2/05_SCREENS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/07_ISSUES_AND_FIXES.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`

No SQL. No recurrence-engine behavior change. Phase 3 not started.


## Patch 078 — Optional program title
Purpose: let maintenance managers identify programs by a human title without replacing the stable PM V2 program ID.

Files:
- `drizzle/schema.ts`
- `drizzle/2026_09_12_pmv2_program_title.sql`
- `server/pmv2/programs/service.ts`
- `server/routers/pmv2/programs.ts`
- `client/src/pages/pmv2/ScheduledMaintenance.tsx`
- `server/tests/pmv2-program-title-ui.node.mjs`
- relevant PM V2 docs/checkpoint files

DB prerequisite: already manually executed and confirmed `Query OK` by the user. Do not rerun. Phase 3 not started.

## Patch 079 — Due-only manual Scheduler program scope
Purpose: make manual Scheduler acceptance safer and clearer by allowing a selected due program without changing automatic scheduling.

Files:
- `server/pmv2/scheduler/engine.ts`
- `server/pmv2/scheduler/repository.ts`
- `server/routers/pmv2/scheduler.ts`
- `client/src/pages/pmv2/ScheduledMaintenance.tsx`
- `server/tests/pmv2-manual-scheduler-program-scope.node.mjs`
- `server/tests/pmv2-manual-scheduler-date-helper.node.mjs`
- `server/tests/pmv2-phase2-scheduler.node.mjs`
- `server/tests/pmv2-phase2-scheduler-runtime.node.mjs`
- relevant PM V2 docs/checkpoint files

No SQL. Automatic PM V2 Scheduler remains unchanged. Phase 3 not started.


## Patch 080 — Phase 2 final acceptance closure
Purpose: make the final 2026-09-12 acceptance state authoritative and auditable without changing runtime behavior.

Files:
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`
- `server/tests/pmv2-phase2-final-closure.node.mjs`

Verified:
- Final Phase 2 closure documentation consistency test PASS.
- Focused Phase 2 regression/checkpoint suite rerun on the current Patch 079 runtime baseline: **62 checks PASS / 0 product failures**.
- Two explicitly skipped manual recurrence runtime checks are preserved as SKIPPED, not PASS.

No SQL. No runtime behavior change. Phase 3 remains READY / NOT STARTED.


## Patch 081 — Phase 3 Step 3.1 technician read foundation
Purpose: start Phase 3 with the smallest read-only technician slice before any execution-state mutation or sensitive integration.

Files:
- `drizzle/schema.ts` — snapshot consistency repair only: restore already-existing `pmv2_programs.title` declaration from Patch 078.
- `shared/roles.ts`
- `server/pmv2/security/policy.ts`
- `server/pmv2/security/procedures.ts`
- `server/pmv2/technician/read-service.ts`
- `server/routers/pmv2/technician.ts`
- `server/routers/pmv2/index.ts`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `client/src/App.tsx`
- `client/src/components/layout/DashboardLayout.tsx`
- `client/src/i18n/ar.ts`
- `client/src/i18n/en.ts`
- `client/src/i18n/ur.ts`
- `server/tests/pmv2-phase3-step3-1-technician-read.node.mjs`
- relevant PM V2 plan/status/decision/testing/release/handoff/readme docs.

Verified:
- New focused contract/source checks: **6/6 PASS**.
- Changed TS/TSX syntax transpile: **13/13 PASS**.
- Full-project typecheck not runnable from supplied ZIP because dependencies are not installed; not marked PASS.

Apply:
1. Extract this patch at the project root and replace files by path.
2. **Do not run SQL** for `pmv2_programs.title`; the column was already verified in the live DB from Patch 078.
3. Restart/redeploy the normal application runtime.
4. Perform the single manual Step 3.1 test documented in `09_TESTING.md`.

Rollback:
- Restore the pre-Patch-081 versions of the files listed above and remove the three new files (`server/pmv2/technician/read-service.ts`, `server/routers/pmv2/technician.ts`, `client/src/pages/pmv2/Pmv2MyTasks.tsx`) plus the focused test file.
- No database rollback is required because Patch 081 contains no DB change.

No SQL. No Legacy PM/Ticket/Purchase/Inventory workflow change. Phase 3 = IN PROGRESS; Step 3.1 implementation complete; manual runtime acceptance is recorded by Patch 082.


## Patch 082 — Phase 3 Step 3.1 manual acceptance closure
Purpose: record the completed clean manual acceptance of the read-only technician slice without changing runtime behavior.

Files:
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Manual verification recorded:
- Assigned active technician sees `PMV2-20260913-P5-T13` with correct team/target, `0/2` progress, and two items = PASS.
- Unassigned technician sees 0 tasks = PASS.
- Assigned technician with disabled PM V2 team membership sees 0 tasks = PASS.
- Membership restored after the test.

Apply:
1. Extract at project root and replace documentation files by path.
2. No application restart is required for this documentation-only patch.
3. Do not run SQL.

No runtime code. No SQL. Phase 3 = IN PROGRESS; Step 3.1 = CLOSED / PASS.

## Patch 083 — Phase 3 Step 3.2 Start Execution foundation
Purpose: introduce the first technician execution write without starting result/material/ticket integrations.

Files:
- `server/pmv2/audit/service.ts`
- `server/pmv2/technician/execution-service.ts`
- `server/routers/pmv2/technician.ts`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/tests/pmv2-phase3-step3-1-technician-read.node.mjs`
- `server/tests/pmv2-phase3-step3-2-start-execution.node.mjs`
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/04_WORKFLOWS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Verified:
- Step 3.1 regression + Step 3.2 focused source/contract tests = **14/14 PASS**.
- Changed TS/TSX syntax transpile = **4/4 PASS**.
- Phase 2 tests were deliberately not rerun.

Apply:
1. Extract at the project root and replace files by path.
2. **Do not run SQL**; Patch 083 uses the existing Phase 1 Visit/Member/Item Action schema.
3. Restart/redeploy the normal application runtime.
4. Execute the first manual Step 3.2 test from `09_TESTING.md`; one test per response.

No SQL. No Legacy PM/Ticket/Purchase/Inventory workflow change. Step 3.2 manual runtime acceptance is recorded by Patch 084.


## Patch 084 — Phase 3 Step 3.2 manual acceptance closure
Purpose: record the completed manual runtime acceptance for **Start Execution** without changing runtime behavior.

Files:
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Manual verification recorded:
- First pending item start changed the item + task to `in_progress`, leaving the second item pending = PASS.
- Second item start reused the same open Visit and changed the second item to `in_progress` = PASS.
- DB: one open Visit (`id=1`, Task `104`, `endedAt=NULL`) = PASS.
- DB: Visit Member `userId=19110028`, `isLeader=1` = PASS.
- DB: `start_execution` Item Actions for Task Items `437` and `438` by `19110028` = PASS.
- DB: matching `pmv2.item_start_execution` audit rows for entities `437` and `438` = PASS.
- Different-teammate join/reuse was not separately manually exercised; automated Step 3.2 contract coverage remains the evidence for that branch.

Apply:
1. Extract at project root and replace documentation files by path.
2. No application restart is required for this documentation-only patch.
3. Do not run SQL.

No runtime code. No SQL. Phase 3 = IN PROGRESS; Step 3.1 = CLOSED / PASS; Step 3.2 = CLOSED / PASS. Result submission remains NOT STARTED.


## Patch 085 — Phase 3 Step 3.3 basic `ok/fixed` result slice
Purpose: add the first dependency-free technician result writes without starting Material/Ticket integrations.

Files:
- `server/pmv2/technician/execution-service.ts`
- `server/routers/pmv2/technician.ts`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/tests/pmv2-phase3-step3-3-basic-results.node.mjs`
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/04_WORKFLOWS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Technician `submitBasicResult` supports only `ok | fixed` on `in_progress` Task Items.
- Active Team membership + exact Task/Item ownership are revalidated server-side.
- One open Visit is required; active performer joins it if not already a member.
- Item becomes `completed`; Task stays `in_progress` while an incomplete Item exists, otherwise becomes `completed`.
- `submit_result` Item Action + PM V2 Audit are atomic. Optional note max 2000 chars.
- Visit ending and `needs_material/needs_ticket` remain outside this patch.
- Focused Phase 3 regression = **23/23 PASS**; changed TS/TSX syntax transpile = **3/3 PASS**. Phase 2 tests were not rerun.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL**.
3. Restart/redeploy normal application runtime.
4. Run only the first Patch 085 manual test from `09_TESTING.md`; stop and report before the next result test.

No SQL. No Legacy PM/Inventory/Purchase/Ticket workflow change. Manual runtime acceptance pending.


## Patch 086 — Phase 3 Step 3.3 basic `ok/fixed` manual acceptance closure
Purpose: record completed manual runtime acceptance for the dependency-free Patch 085 result slice without changing runtime behavior.

Files:
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Manual verification recorded:
- UI: Item `437` submitted as `ok` -> completed, `1/2`, Task still `in_progress` = PASS.
- UI: Item `438` submitted as `fixed` -> completed, `2/2`, Task `completed` = PASS.
- DB: Task `104` and Items `437/438` reflect completed states/results; `submit_result` Actions `3/4`, saved notes, performer `19110028` = PASS.
- Audit: `pmv2.item_result_submitted` rows `7235627/7235628` for entities `437/438` by `19110028` = PASS.

Apply:
1. Extract at project root and replace documentation files by path.
2. No application restart is required for this documentation-only patch.
3. Do not run SQL.

No runtime code. No SQL. Step 3.3 remains IN PROGRESS overall; basic `ok/fixed` slice = CLOSED / PASS; `needs_material/needs_ticket` remain NOT STARTED.


## Patch 087 — Phase 3 Step 3.3B `needs_material/needs_ticket` Core result slice
Purpose: expose the remaining frozen technician outcomes inside Core PM V2 without starting Phase 4 external workflows.

Files:
- `server/pmv2/technician/execution-service.ts`
- `server/routers/pmv2/technician.ts`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/tests/pmv2-phase3-step3-2-start-execution.node.mjs`
- `server/tests/pmv2-phase3-step3-3-basic-results.node.mjs`
- `server/tests/pmv2-phase3-step3-3b-dependency-results.node.mjs`
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/04_WORKFLOWS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Add `submitDependencyResult` for `needs_material | needs_ticket` from `in_progress` Items.
- Map to `waiting_material | waiting_ticket`; preserve result/note/Visit/performer with standard `submit_result` + PM V2 Audit.
- Reproject Task state with fixed dependency priority `waiting_material > waiting_ticket`, while allowing unrelated Items to continue executing.
- Reproject basic `ok/fixed` results through the same mixed-state projection so waiting dependencies are not lost.
- **No Material Request, Ticket, Inventory, Purchase, external link, Visit end, or SQL.**
- Focused Phase 3 regression = **34/34 PASS**; changed TS/TSX syntax transpile = **3/3 PASS**. Phase 2 tests were not rerun.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. Restart/redeploy normal application runtime.
4. Run only the first Patch 087 manual `needs_material` test from `09_TESTING.md`, then stop and report.

Manual runtime acceptance pending.

## Patch 088 — Phase 3 Step 3.3B manual acceptance closure
Purpose: record manual runtime acceptance of Patch 087 dependency outcomes without changing runtime behavior.

Files:
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Manual verification recorded:
- UI: Item `439` -> `needs_material / waiting_material`; Task -> `waiting_material`; Item `440` remained executable = PASS.
- UI: Item `440` could start while material dependency remained = PASS.
- UI: Item `440` -> `needs_ticket / waiting_ticket`; Task remained `waiting_material` due to priority = PASS.
- DB: Task `105`, Items `439/440`, `submit_result` Actions `6/8`, saved notes, performer `19110028` = PASS.
- Audit: `pmv2.item_result_submitted` rows `7235641/7235643` for entities `439/440` = PASS.

Apply:
1. Extract at project root and replace documentation files by path.
2. No application restart is required for this documentation-only patch.
3. Do not run SQL.

No runtime code. No SQL. Step 3.3 basic outcomes are CLOSED / PASS; Phase 3 remains IN PROGRESS. No real Material Request/Ticket/Inventory/Purchase integration is part of this patch.



## Patch 089 — Phase 3 Step 3.4 Leader-only Visit ending
Purpose: allow the active Visit Leader to end field Visit execution without forcing Task/Task Item closure.

Files:
- `server/pmv2/audit/service.ts`
- `server/pmv2/technician/read-service.ts`
- `server/pmv2/technician/execution-service.ts`
- `server/routers/pmv2/technician.ts`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/tests/pmv2-phase3-step3-3-basic-results.node.mjs`
- `server/tests/pmv2-phase3-step3-3b-dependency-results.node.mjs`
- `server/tests/pmv2-phase3-step3-4-end-visit.node.mjs`
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/04_WORKFLOWS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Read current open Visit/Leader state for a technician-owned Task.
- Add Leader-only `endVisit` mutation under the existing PM V2 technician permission and active-team membership boundary.
- Serialize on Task row; require exactly one open Visit; block when any Item remains `in_progress`.
- Set `pmv2_visits.endedAt` and write `pmv2.visit_ended` Audit atomically.
- Keep Task and Task Item states/results unchanged; Visit end is not Task closure.
- UI exposes **إنهاء الزيارة** only to the Leader and disables it while an Item is still active.
- **No SQL/schema change and no Phase 4 external workflow integration.**
- Focused Phase 3 regression = **43/43 PASS**; changed TS/TSX syntax transpile = **5/5 PASS**. Phase 2 tests were not rerun.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. Restart/redeploy normal application runtime.
4. Run only the first Patch 089 manual Visit-end UI test from `09_TESTING.md`, then stop and report.

Manual runtime acceptance pending.


## Patch 090 — Phase 3 Step 3.4 manual acceptance closure
Purpose: record completed manual runtime acceptance for Patch 089 Visit ending without changing runtime behavior.

Files:
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Manual verification recorded:
- UI: Leader ended Visit for Task `PMV2-20260913-P6-T14`; Task/Item dependency states remained unchanged = PASS.
- DB: Visit `2` / Task `105`, `endedAt = 2026-09-13 11:42:05` = PASS.
- Audit: row `7235645`, `pmv2.visit_ended`, entity `pmv2.visit` / `2`, user `19110028` = PASS.

Apply:
1. Extract at project root and replace documentation files by path.
2. No application restart is required for this documentation-only patch.
3. Do not run SQL.

No runtime code. No SQL. Step 3.4 is CLOSED / PASS; Phase 3 remains IN PROGRESS.


## Patch 091 — Phase 3 Step 3.5 optional execution images/evidence
Purpose: implement the remaining Phase 3 Core notes/images contract by reusing the existing attachment service and linking evidence to Item Actions.

Files:
- `server/pmv2/technician/evidence-access.ts`
- `server/pmv2/technician/read-service.ts`
- `server/routers/uploads/attachments.access.ts`
- `server/routers/uploads/attachments.router.ts`
- `server/routers/pmv2/technician.ts`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/tests/pmv2-phase3-step3-5-execution-evidence.node.mjs`
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/04_WORKFLOWS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- No SQL/schema change; reuse the current `attachments` table/service and upload/storage route.
- Add explicit `pmv2_item_action` attachment entity type, matching the frozen PM V2 evidence-to-Item-Action contract.
- Read protection: active Task-Team technician membership; PM V2 managers may read for review.
- Write protection: technician only, active Task-Team membership, same technician as Item Action performer, and owning Visit must still be open.
- PM V2 evidence is image-only and optional in this slice.
- Add technician evidence query that aggregates all Item-Action attachments for a Task Item and returns a safe current upload target.
- `مهامي اليوم` uploads via `/api/upload` + `attachments.add`, renders thumbnails, and refreshes evidence after Start/Result/Visit mutations.
- Existing attachment audit remains `add_attachment` with `entityType = pmv2_item_action`; no duplicate PM V2 attachment audit stream.
- No Material Request/Ticket/Inventory/Purchase/Legacy PM workflow changes.
- Focused Phase 3 regression = **53/53 PASS**; changed TS/TSX syntax = **6/6 PASS**. Phase 2 tests were not rerun.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. Restart/redeploy normal application runtime.
4. Run only the first Patch 091 manual image-upload/thumbnail check from `09_TESTING.md`, then stop and report.

Manual runtime acceptance pending.


## Patch 092 — Phase 3 Step 3.5 manual acceptance closure
Purpose: record completed manual runtime acceptance for Patch 091 execution images/evidence without changing runtime behavior.

Files:
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Manual verification recorded:
- UI: image uploaded to Task Item `437`, thumbnail rendered, and evidence persisted after refresh = PASS.
- DB: attachment `3000641`, `entityType = pmv2_item_action`, Item Action `3`, Task Item `437`, uploader `19110028` = PASS.
- Post-Visit: evidence remained readable after Visit end while new upload was blocked/hidden = PASS.
- Audit: existing `add_attachment` event for `pmv2_item_action` evidence = PASS.

Apply:
1. Extract at project root and replace documentation files by path.
2. No application restart is required for this documentation-only patch.
3. Do not run SQL.

No runtime code. No SQL. Step 3.5 is CLOSED / PASS; Phase 3 remains IN PROGRESS pending Core stabilization / acceptance-gate review.

## Patch 093 — Phase 3 final acceptance closure
Purpose: close the official Phase 3 acceptance gate without changing runtime behavior, while preserving explicit skipped/deferred test disclosure.

Files:
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Acceptance recorded:
- Steps 3.1–3.5 = CLOSED / PASS on their accepted Core scopes.
- Different active teammate joining the same existing open Visit: dedicated manual runtime test = **SKIPPED / ACCEPTED by explicit user decision**; focused automated Step 3.2 coverage remains the accepted evidence.
- Mobile/Tablet responsive manual verification = **DEFERRED TO FINAL PROGRAM ACCEPTANCE (Phase 6)**; not relabeled PASS.
- Final Phase 3 decision = **CLOSED / PASS**.
- Next official state = **Phase 4 READY / NOT STARTED**.

Apply:
1. Extract at project root and replace documentation files by path.
2. No application restart is required for this documentation-only patch.
3. Do not run SQL.
4. Do not start Phase 4 automatically; wait for a separate explicit execution instruction.

No runtime code. No SQL. No Phase 4 integration.


## Patch 094 — Phase 4 Step 4.1 material intake
Purpose: start Phase 4 with the smallest material-need integration slice while preserving the frozen rule that PM V2 never mutates inventory directly.

Files:
- `server/pmv2/adapters/contracts.ts`
- `server/pmv2/adapters/current-system.ts`
- `server/pmv2/audit/service.ts`
- `server/pmv2/materials/request-service.ts`
- `server/routers/pmv2/technician.ts`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/tests/pmv2-phase4-step4-1-material-intake.node.mjs`
- `server/tests/pmv2-phase3-step3-4-end-visit.node.mjs` (test-only compatibility update for the extended Audit entity union)
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Reuse active current Catalog items and Team Warehouse.
- Read current Team-Warehouse inventory availability; when Lot tracking is active, sum current positive Lot balances.
- If requested quantity is fully available, create no PM V2 Material Request and return current Inventory/Delivery handoff metadata.
- If availability is short, create PM V2 Material Request + one Item for shortage only, state `waiting_warehouse`.
- Reuse frozen Material Request Item validation and reject active duplicates/ambiguous inventory rows.
- Record PM V2 Audit for route/request decision.
- No Stock mutation, Warehouse Transfer, Purchase Order, Ticket integration, Legacy PM modification, or SQL/schema change.
- Focused Step 4.1 tests = **15/15 PASS**; combined Phase 3 regression + Step 4.1 = **68/68 PASS**; changed-source syntax = **6/6 PASS**.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. Restart/redeploy the normal application runtime.
4. Run only the first Patch 094 UI-presence check from `09_TESTING.md`, then stop and report.

Manual runtime acceptance pending. Phase 4 remains IN PROGRESS.


## Patch 095 — Phase 4 Step 4.1 Team Warehouse balance preview refinement
Purpose: refine Step 4.1 before acceptance so technicians can see Team Warehouse stock while choosing a material and understand the shortage calculation before recording the need.

Files:
- `server/pmv2/adapters/contracts.ts`
- `server/pmv2/adapters/current-system.ts`
- `server/pmv2/materials/request-service.ts`
- `server/routers/pmv2/technician.ts`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/tests/pmv2-phase4-step4-1-material-intake.node.mjs`
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Batch-load read-only Team Warehouse availability for Catalog options through the existing Inventory adapter.
- Show current Team Warehouse balance beside each material option.
- Show **requested / available / shortage** preview before submit.
- Keep operational need distinct from physical issue: need may exceed local stock; PM V2 requests shortage only; actual issue remains in Inventory/Delivery and remains stock constrained there.
- Server submit still rechecks availability. No reservation, Stock mutation, Transfer, PO, Ticket, Legacy PM change, or SQL/schema change.
- Step 4.1 focused tests = **18/18 PASS**; combined Phase 3 regression + Step 4.1 = **71/71 PASS**; changed TS/TSX syntax = **5/5 PASS**; Node test syntax = PASS.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. Restart/redeploy the normal application runtime.
4. Run only the Patch 095 balance-preview check from `09_TESTING.md`; do not resubmit Catalog Item `300042` on Item `439` because active Request `#1` already exists.

Manual runtime acceptance remains pending. Phase 4 remains IN PROGRESS.


## Patch 096 — Phase 4 Step 4.1 technician open-task carry-over visibility correction
Purpose: preserve technician execution continuity across date boundaries after a live Step 4.1 acceptance session exposed exact-today-only task visibility.

Files:
- `server/pmv2/technician/read-service.ts`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/tests/pmv2-phase3-step3-1-technician-read.node.mjs` (test-only compatibility update for the evolved feed contract)
- `server/tests/pmv2-phase4-step4-1-material-intake.node.mjs`
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Technician task read uses Riyadh `dueDate <= today`.
- Previous-date Tasks carry forward only while non-final; cancelled and previous completed Tasks are excluded.
- Preserve original `dueDate`; no rescheduling or duplicate Task generation.
- Return `isCarryOver` plus today/carry-over counts.
- Separate **مهام اليوم** and **مهام سابقة مفتوحة** in the technician UI and display original due date.
- Keep active Team membership authorization unchanged.
- No SQL/schema, Inventory mutation, Material Request routing change, Warehouse Transfer, PO, Ticket, or Legacy PM change.
- Step 4.1 tests = **21/21 PASS**; combined Phase 3 regression + Step 4.1 = **74/74 PASS**; changed TS/TSX syntax = **2/2 PASS**; Node syntax = **2/2 PASS**.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. Restart/redeploy the normal application runtime.
4. Run only the Patch 096 carry-over visibility check from `09_TESTING.md`; do not submit another material request for Item `439`.

Manual runtime acceptance remains pending. Step 4.1 remains open.


## Patch 097 — Phase 4 Step 4.1 unlisted-material fallback
Purpose: allow a technician to record a material need even when the item is absent from the current Catalog, without creating or duplicating Master Data.

Files:
- `server/pmv2/materials/request-service.ts`
- `server/routers/pmv2/technician.ts`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/tests/pmv2-phase4-step4-1-material-intake.node.mjs`
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Add explicit **مادة غير موجودة في الدليل** technician mode.
- Persist with existing nullable `catalogItemId = NULL` and free-text `itemNameSnapshot`; no SQL.
- Do not guess Team Warehouse availability for an unlisted item; route full need to `waiting_warehouse` for warehouse/Catalog resolution.
- Prevent active duplicate free-text needs by normalized name on the same Task Item.
- Preserve existing Catalog item balance/shortage routing unchanged.
- No Catalog creation, Stock mutation, Transfer, PO, Ticket, or Legacy PM change.
- Step 4.1 tests = **26/26 PASS**; Phase 3 regression + Step 4.1 = **79/79 PASS**; changed TS/TSX syntax = **3/3 PASS**.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. Restart/redeploy the normal application runtime.
4. Run only the first Patch 097 UI check from `09_TESTING.md`; do not submit yet.

Manual runtime acceptance remains pending. Step 4.1 remains open.

## Patch 098 — Phase 4 Step 4.1 post-submit intake reset + duplicate UX guard
Purpose: remove accidental repeat-submit affordance after Material Request creation while preserving legitimate multiple-material needs on one Task Item.

Files:
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/tests/pmv2-phase4-step4-1-material-intake.node.mjs`
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Clear and collapse material intake after successful Material Request creation.
- Keep saved requests visible and expose explicit **إضافة مادة أخرى** for another distinct material.
- Disable/label active duplicate Catalog options as **مطلوب بالفعل**.
- Warn/disable active duplicate unlisted names using normalized-name comparison; keep existing server-side duplicate rejection unchanged.
- No service/schema/SQL change and no Inventory mutation, Transfer, PO, Ticket, or Legacy PM integration.
- Step 4.1 tests = **29/29 PASS**; combined Phase 3 regression + Step 4.1 = **82/82 PASS**.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. Restart/redeploy the normal application runtime.
4. Run only the first Patch 098 manual check from `09_TESTING.md`, then stop and report.

Manual runtime acceptance remains pending. Step 4.1 remains open.



## Patch 099 — Phase 4 Step 4.1 count-unit quantity integrity
Purpose: prevent invalid fractional operational needs for countable/package units while preserving decimal quantities for divisible measurements.

Files:
- `shared/pmv2MaterialQuantity.ts`
- `server/pmv2/materials/request-service.ts`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/tests/pmv2-phase4-step4-1-material-intake.node.mjs`
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Shared Client/Server classifier for known count-unit aliases.
- Reject fractional quantities for count units before Team Warehouse routing or request persistence.
- UI `step/min`, inline error, preview suppression, and submit disable use the same shared policy.
- Preserve decimal quantities for divisible or unknown/free-text measurement units.
- No SQL, Inventory mutation/reservation, Transfer, PO, Ticket, or Legacy PM change.
- Step 4.1 tests = **32/32 PASS**; combined Phase 3 regression + Step 4.1 = **85/85 PASS**; syntax = **3/3 PASS**.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. Restart/redeploy the normal application runtime.
4. Run only the first Patch 099 manual check from `09_TESTING.md`, then stop and report.

Manual runtime acceptance remains pending. Step 4.1 remains open.


## Patch 100 — Phase 4 Step 4.1 persistent Team-Warehouse handoff
Purpose: persist the full-stock routing decision and remove the repeat-click/transient-state gap discovered during manual acceptance.

Files:
- `server/pmv2/materials/request-service.ts`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/tests/pmv2-phase4-step4-1-material-intake.node.mjs`
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/04_WORKFLOWS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Persist Catalog material routing as append-only `pmv2_item_actions.action = material_route_decision` with a structured snapshot in `note`.
- Restore latest Catalog route in `materialState`; latest `team_inventory` route becomes a persistent ready-to-issue handoff.
- Close/clear the technician intake after full-stock success; display **جاهز للصرف من مخزن الفريق** and **إعادة التحقق من الرصيد**.
- Block the same Catalog Item from duplicate need entry while its latest route is ready-to-issue.
- Record material-request route decisions as well so a later shortage route supersedes an older ready snapshot.
- No SQL/schema, no Inventory mutation/reservation, no Transfer, PO, Ticket, Material Usage write, or Legacy PM change.
- Step 4.1 tests = **35/35 PASS**; combined Phase 3 regression + Step 4.1 = **88/88 PASS**; changed TS/TSX syntax = **2/2 PASS**.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. Restart/redeploy the normal application runtime.
4. Run only the first Patch 100 manual check from `09_TESTING.md`, then stop and report.

Manual runtime acceptance remains pending. Step 4.1 remains open.


## Patch 101 — Phase 4 Step 4.1 final acceptance closure + Step 4.2 review
Purpose: close the accepted material-intake slice without changing runtime, preserve skipped-test disclosure, and record the reviewed starting boundary for Step 4.2.

Files:
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Documentation-only **Step 4.1 CLOSED / PASS** acceptance record.
- Record changed-stock recheck and dedicated partial-shortage manual cases as **SKIPPED / ACCEPTED**, never manual PASS.
- Retain Patch 100 automated evidence: 35/35 Step 4.1, 88/88 combined Phase 3 regression + Step 4.1, syntax 2/2.
- Record Step 4.2 review: current Warehouse Transfer is authoritative; first runtime slice is warehouse queue + read-only Main-Warehouse availability decision.
- No runtime code, SQL/schema, Inventory mutation, Warehouse Transfer, PO, Ticket, or Legacy PM change.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. No application restart is required for runtime behavior because this patch is documentation-only.
4. Do not start Step 4.2 runtime until a new explicit execution instruction.


## Patch 102 — Phase 4 Step 4.2A warehouse queue + Main-Warehouse availability
Purpose: start the warehouse side of Phase 4 with a read-only `waiting_warehouse` work queue and authoritative Main-Warehouse availability decision, without duplicating the current Warehouse Transfer workflow.

Files:
- `shared/roles.ts`
- `server/pmv2/security/policy.ts`
- `server/pmv2/security/procedures.ts`
- `server/pmv2/adapters/contracts.ts`
- `server/pmv2/adapters/current-system.ts`
- `server/pmv2/materials/warehouse-queue-service.ts`
- `server/routers/pmv2/warehouse.ts`
- `server/routers/pmv2/index.ts`
- `client/src/pages/pmv2/Pmv2WarehouseQueue.tsx`
- `client/src/App.tsx`
- `client/src/components/layout/DashboardLayout.tsx`
- `client/src/i18n/ar.ts`
- `client/src/i18n/en.ts`
- `client/src/i18n/ur.ts`
- `server/tests/pmv2-phase4-step4-2a-warehouse-queue.node.mjs`
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/04_WORKFLOWS.md`
- `docs/pmv2/05_SCREENS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Dedicated warehouse-role PM V2 queue for `waiting_warehouse` items.
- Dynamic exactly-one active Main Warehouse resolution through adapter; no hard-coded external ID.
- Lot-aware Main-Warehouse availability read through current Inventory adapter.
- Explicit unlisted/Catalog/Inventory/unit-integrity states.
- Read-only UI/API; no Transfer, PO, PM V2 status mutation, Inventory mutation, Ticket, or Legacy PM write.
- No SQL/schema change.
- Automated: Step 4.2A **15/15 PASS**; combined Phase 3 + Step 4.1 + Step 4.2A **103/103 PASS**; changed TS/TSX syntax **14/14 PASS**.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. Restart/redeploy the normal application runtime.
4. Run only the first Step 4.2A manual warehouse queue check from `09_TESTING.md`, then stop and report.

Manual runtime acceptance remains pending. Do not start Warehouse Transfer integration yet.

## Patch 103 — Phase 4 Step 4.2A Catalog operator identity UX
Purpose: replace the internal Catalog database ID in the warehouse queue with operator-meaningful Catalog item code and taxonomy path before starting Warehouse Transfer integration.

Files:
- `server/pmv2/adapters/contracts.ts`
- `server/pmv2/adapters/current-system.ts`
- `server/pmv2/materials/warehouse-queue-service.ts`
- `client/src/pages/pmv2/Pmv2WarehouseQueue.tsx`
- `server/tests/pmv2-phase4-step4-2a-warehouse-queue.node.mjs`
- `docs/pmv2/05_SCREENS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Record Patch 102 warehouse queue manual acceptance as PASS; Step 4.2A functional scope CLOSED/PASS.
- Extend current Catalog adapter read model with batched taxonomy-path projection for queue materials.
- Show `catalog_items.code` as **كود الصنف** and Catalog tree path as **التصنيف**.
- Hide user-facing `Catalog #<catalogItemId>`; retain `catalogItemId` internally only.
- No SQL/schema, Warehouse Transfer, PO, Inventory mutation, PM V2 status write, Ticket, or Legacy PM change.
- Automated: Step 4.2A **18/18 PASS**; combined Phase 3 + Step 4.1 + Step 4.2A **106/106 PASS**; targeted TS/TSX syntax **3/3 PASS**.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. Restart/redeploy the normal application runtime.
4. Run the single Patch 103 visual smoke from `09_TESTING.md`, then stop and report. Do not start a Warehouse Transfer yet.

## Patch 104 — Phase 4 pre-Step 4.2B contract freeze
Purpose: document the accepted Warehouse Transfer and future Purchase boundaries before any Step 4.2B runtime change.

Files:
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/04_WORKFLOWS.md`
- `docs/pmv2/05_SCREENS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Record Patch 103 visual smoke PASS and Step 4.2A CLOSED/PASS.
- Freeze Step 4.2B as existing Main→Team Warehouse Transfer handoff only.
- Allow partial transfer; preserve shortage on the same Material Request Item; count only confirmed real Transfers.
- Defer PO/Purchase/Receiving to later Phase 4 work.
- Freeze future over-purchase rule: PM V2 links only its shortage quantity; any purchased excess remains general stock.
- Documentation-only: no Runtime, SQL, schema, Inventory/Purchase/Ticket/Legacy PM change.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. No restart is required for runtime behavior; this patch changes documentation only.
4. Do not start Step 4.2B or Purchase integration until a new explicit execution instruction.


## Patch 105 — Phase 4 Step 4.2B existing Warehouse Transfer handoff
Purpose: use current Main-Warehouse stock for a PM V2 material need through the existing Warehouse Transfer workflow, then project only confirmed real Transfers back into the same PM V2 Material Request Item.

Files:
- `server/pmv2/adapters/contracts.ts`
- `server/pmv2/adapters/current-system.ts`
- `server/pmv2/materials/warehouse-queue-service.ts`
- `server/pmv2/materials/warehouse-transfer-handoff-service.ts`
- `server/routers/pmv2/warehouse.ts`
- `client/src/pages/pmv2/Pmv2WarehouseQueue.tsx`
- `client/src/pages/inventory/WarehouseTransfer.tsx`
- `server/tests/pmv2-phase4-step4-2a-warehouse-queue.node.mjs`
- `server/tests/pmv2-phase4-step4-2b-warehouse-transfer-handoff.node.mjs`
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/04_WORKFLOWS.md`
- `docs/pmv2/05_SCREENS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Fresh server-side handoff recheck for listed `waiting_warehouse` need and current Main availability.
- Queue uses outstanding need and shows requested / supplied / remaining / available / transferable now.
- Reuse existing Warehouse Transfer `createBatch`; preserve current QR/Lot/stock/audit ownership.
- Lock PM V2 handoff route/Inventory and cap total quantity across Lot rows.
- Read-only adapter validates already-created transfer rows; trace links in existing PM V2 Item Actions.
- Project `issuedToTeamQuantity` from unique confirmed real Transfers only; partial remains `waiting_warehouse`, full becomes `issued_to_team`.
- Idempotent same-request retry, cross-request Transfer protection, stale-handoff freeze, and link-only recovery after stock movement.
- No Purchase/PO/Receiving, no new table, no SQL/schema.
- Automated: Step 4.2B **25/25 PASS**; combined Phase 3 + Step 4.1 + Step 4.2A + Step 4.2B **131/131 PASS**; changed TS/TSX syntax **7/7 PASS**.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. Restart/redeploy the normal application runtime.
4. Run only the first Step 4.2B manual queue/handoff visibility check from `09_TESTING.md`, then stop and report; do not perform the physical Transfer in that first check.

Manual runtime acceptance remains pending. Purchase integration remains deferred.

## Patch 106 — Deferred technician material-picker UX contract
Purpose: record the user-approved follow-up for technician material selection without changing the current Step 4.2B runtime test.

Files:
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/05_SCREENS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Smart default technician material list after Step 4.2B acceptance.
- Keep full active-Catalog search by name/item code.
- Show operator item code + taxonomy path + Team-Warehouse balance.
- Specialty relevance only through explicit existing Master Data mapping; no heuristic mapping or duplicated Master Data.
- Documentation only; Step 4.2B remains CODE-READY / MANUAL ACCEPTANCE PENDING.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. No runtime restart is required for this documentation-only patch.
4. Continue the current Step 4.2B manual acceptance from the existing stopping point.


## Patch 107 — Step 4.2B warehouse quantity-context clarification
Purpose: fix the warehouse-card quantity semantics discovered during manual Step 4.2B acceptance without changing stock movement or request quantities.

Files:
- `server/pmv2/materials/warehouse-queue-service.ts`
- `client/src/pages/pmv2/Pmv2WarehouseQueue.tsx`
- `server/tests/pmv2-phase4-step4-2b-warehouse-transfer-handoff.node.mjs`
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/05_SCREENS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Read existing `material_route_decision` snapshots to recover the technician's total task need and Team-Warehouse balance at the original decision.
- Display **احتياج المهمة / المتاح في مخزن الفريق وقت الطلب / المطلوب من المستودع الرئيسي / المتبقي للتحويل**.
- Keep current Main availability live and keep `transferableNow` as the server-authoritative button quantity.
- No SQL/schema/Inventory/Transfer/Purchase mutation change.
- Manual partial-shortage case = PASS (`6 / 5 / 1`); physical Transfer acceptance remains pending.
- Automated: Step 4.2B **25/25 PASS**; combined focused regression **131/131 PASS**.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. Restart/redeploy the normal runtime because server/client runtime files changed.
4. Refresh **طلبات مواد PM V2** and verify the PRIMA card shows `6 / 5 / 1 / 1` under the four clarified labels; stop and report before physical Transfer.


## Patch 108 — Step 4.2B final manual acceptance closure
Purpose: record the successful real Warehouse Transfer + PM V2 DB linkage verification, close Step 4.2B, and correct the verification identifier from Batch `TRB` to per-row Transfer `TRF`.

Files:
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/04_WORKFLOWS.md`
- `docs/pmv2/05_SCREENS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Close **Step 4.2B = CLOSED / PASS**.
- Record real test evidence: Batch `TRB-2026-090001`, linked transfer `TRF-2026-090001`, Lot `LOT-2026-00315`, quantity `1`.
- Record final DB proof: `linkedQuantity=1`, `requestedQuantity=1`, `issuedToTeamQuantity=1`, `status=issued_to_team`.
- Clarify that PM V2 links `warehouse_transfers.transferNumber` (`TRF`) while `TRB` identifies the `createBatch` header.
- Correct stale status text that still showed 4.2B pending and partial-shortage as skipped.
- Documentation only: no runtime code, no SQL/schema, no Inventory mutation, no Purchase/PO/Receiving implementation.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. No runtime restart is required; this patch changes documentation only.
4. Do not start Purchase/PO/Receiving automatically; review the next Phase 4 slice separately before implementation.


## Patch 109 — Phase 4 Team-Warehouse Issue/Delivery linkage
Purpose: connect actual issue from Team Warehouse to the existing PM V2 material need without creating a parallel stock workflow.

Files:
- `server/pmv2/adapters/contracts.ts`
- `server/pmv2/adapters/current-system.ts`
- `server/pmv2/materials/team-issue-handoff-service.ts`
- `server/routers/pmv2/warehouse.ts`
- `server/_core/db/warehouse-returns.ts`
- `server/routers/purchase/purchase-orders.router.ts`
- `client/src/pages/inventory/Inventory.tsx`
- `server/tests/pmv2-phase4-team-warehouse-issue-delivery.node.mjs`
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/04_WORKFLOWS.md`
- `docs/pmv2/05_SCREENS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/14_HANDOFF_CHECKPOINT.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Reuse current Inventory/Delivery for the real Team-Warehouse issue; PM V2 only prechecks optional task context and links confirmed Delivery evidence.
- Track full task need and real `pmv2_material_usages`, including split attribution between original Team stock and shortage-request supply.
- Move Material Request Item to `consumed` only from request-attributed usage after `issued_to_team`; move Task Item to `ready_to_complete` only after all known material usage is satisfied.
- Support idempotent Delivery linking and link-only retry after a posted physical issue.
- No SQL/schema, no Purchase/PO/Receiving, no Ticket/Legacy PM, and no Phase 5 technician resume.

Verification:
- Focused Patch 109 tests: **27/27 PASS**.
- Phase 3 + Phase 4 focused regression: **158/158 PASS**.
- Changed TS/TSX syntax transpile: **7/7 PASS**.

Apply:
1. Extract at project root and replace files by path.
2. **Do not run SQL.**
3. Restart/redeploy the normal runtime because server/client files changed.
4. First manual check only: open `SUB-1` → item `152-97` → **تسليم للفني** and confirm PM V2 task `PMV2-20260914-P5-T13` appears as `required 6 / used 0 / issuable 6`. Do not confirm delivery yet.

## Patch 110 — Programmatic Team-Warehouse issue + actual consumption/return
Purpose: simplify warehouse execution by carrying the PM V2 task/material/quantity/Lot context programmatically, then separate physical issue from actual technician consumption and real warehouse return.

Files:
- `server/pmv2/adapters/contracts.ts`
- `server/pmv2/adapters/current-system.ts`
- `server/pmv2/materials/team-issue-handoff-service.ts`
- `server/pmv2/technician/execution-service.ts`
- `server/routers/pmv2/warehouse.ts`
- `server/routers/pmv2/technician.ts`
- `client/src/pages/pmv2/Pmv2WarehouseQueue.tsx`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `client/src/pages/inventory/Inventory.tsx`
- `server/routers/purchase/purchase-orders.router.ts`
- `server/tests/pmv2-phase4-step4-1-material-intake.node.mjs`
- `server/tests/pmv2-phase4-team-warehouse-issue-delivery.node.mjs`
- `docs/pmv2/04_WORKFLOWS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/PATCH_MANIFEST.md`

Scope:
- Remove manual PM V2 selection from generic Inventory delivery.
- PM V2 queue resolves full remaining quantity and automatic Lot allocation, then reuses existing Inventory/Delivery writes.
- Default actual recipient to the material requester; allow another active technician from the same Team.
- Track physical issue separately from actual technician use; create pending return for unused quantity.
- Single-Lot return = confirmation only; multi-Lot return = allocation only among original issue Lots.
- Reuse existing recipient-to-warehouse return workflow for the real stock restoration.
- Preserve re-link-only recovery after a posted Delivery so stock is never re-issued just to repair a PM V2 link.
- No SQL/schema and no Purchase/PO/Receiving.

Verification:
- Focused Phase 3 + Phase 4 regression: **155/155 PASS**.
- Broad PM V2 run shows the same 18 unrelated failures on both Patch 109 baseline and Patch 110 working tree; no new failure signature.
- TypeScript full compile is unavailable in the isolated dependency snapshot; no TS parse diagnostics were produced by the available no-resolve syntax pass.

Apply:
1. Extract at project root over Patch 109/current project files.
2. **Do not run SQL.**
3. Restart/redeploy because server and client runtime files changed.
4. First manual check only: open **طلبات مواد PM V2** and verify the PRIMA `T13` ready-to-issue card shows `required 6 / issued 0 / issue now 6`, requester selected, and `LOT-2026-00315 = 6`. Do not confirm issue yet.


## Patch 111 — Preserve explicit Visit closure after Task completion
Purpose: fix the runtime-discovered case where a prior-due Task becomes `completed` after its last Item result and disappears from the technician feed while its Visit is still open.

Files:
- `server/pmv2/technician/read-service.ts`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/tests/pmv2-phase3-step3-1-technician-read.node.mjs`
- `server/tests/pmv2-phase4-step4-1-material-intake.node.mjs`
- `server/tests/pmv2-patch111-completed-open-visit-feed.node.mjs`
- `docs/pmv2/04_WORKFLOWS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/07_ISSUES_AND_FIXES.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/PATCH_MANIFEST.md`

Scope:
- Keep a completed prior-due Task in the technician feed only while a PM V2 Visit for that Task still has `endedAt = NULL`.
- Preserve Task `completed` status; do not reopen, downgrade, or auto-end the Visit.
- Keep the existing Leader-only **إنهاء الزيارة** action and show a clear completed/open-Visit cue.
- After successful `endVisit`, the normal feed refetch removes the completed prior Task.
- No SQL/schema, Inventory mutation, Purchase/PO/Receiving, Ticket, Legacy PM, or handoff-file change.

Verification:
- Targeted Patch 111 + Step 3.1 + Step 3.4 + Step 4.1 regression: **53/53 PASS**.
- Broad PM V2 source-contract comparison: untouched attached project **251/269 PASS, 18 fail**; Patch 111 **254/272 PASS, 18 fail**. The same 18 baseline failures remain; no new failure signature.
- Changed TS/TSX syntax transpile: **2/2 PASS**.
- `npm run build` was attempted in the attached source snapshot and stopped at `vite: not found` because `node_modules` is absent; rerun it in the real project after apply.

Apply:
1. Extract at the project root over the current Patch 110 project.
2. **Do not run SQL.**
3. Restart/redeploy because server/client runtime files changed.
4. First manual check only: with the technician account, open **مهامي اليوم** and verify completed prior Task `PMV2-20260914-P5-T13` is visible because its Visit is still open, with **إنهاء الزيارة** available to the Visit Leader. Do not end the Visit until the screen is reviewed.


## Patch 112 — Technician material searchable combobox UX
Purpose: remove the confusing two-control material lookup from the technician **تحتاج مواد** flow without changing any material-routing or inventory behavior.

Files:
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/tests/pmv2-phase4-step4-1-material-intake.node.mjs`
- `server/tests/pmv2-patch112-material-picker-combobox.node.mjs`
- `docs/pmv2/05_SCREENS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/07_ISSUES_AND_FIXES.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/PATCH_MANIFEST.md`

Scope:
- Replace separate Catalog search input + `<select>` with one `Popover + Command` searchable combobox.
- Search remains server-backed through the existing `materialCatalog` query; no duplicate Catalog data or new API is introduced.
- Result rows show name, item code, Team-Warehouse balance/unit, and blocked state.
- Preserve preferred-unit selection, quantity validation, availability/shortage preview, duplicate guards, submit behavior, and unlisted-material fallback.
- No SQL/schema/server business change, Inventory mutation, Purchase/PO/Receiving, Ticket, Legacy PM, or handoff-file change.

Verification:
- Patch 112 + Step 4.1 focused: **39/39 PASS**.
- Broad PM V2: **258/276 PASS, 18 fail** — same 18 baseline failures as Patch 111; Patch 112 adds four passing checks and no new failure signature.
- Changed TSX syntax transpile: **1/1 PASS**; changed Node test syntax: PASS.

Apply:
1. Extract at project root over the current Patch 111 project.
2. **Do not run SQL.**
3. Run `npm run build` in the real project and restart/redeploy.
4. First manual check only: technician opens **تحتاج مواد**, opens the single material field, types `PRIMA` or `152-97`, and confirms matching results appear directly in that same control. Do not submit the need until the picker is reviewed.


## Patch 113 — Technician material submit-label simplification
Purpose: make the already-reviewed Patch 112 technician material flow clearer by shortening the submit action without changing any business logic.

Files:
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/tests/pmv2-phase4-step4-1-material-intake.node.mjs`
- `server/tests/pmv2-patch112-material-picker-combobox.node.mjs`
- `server/tests/pmv2-patch113-material-submit-label.node.mjs`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/PATCH_MANIFEST.md`

Scope:
- Change only the catalog-material submit text to **تسجيل الاحتياج**.
- Preserve server-side availability recheck, material routing, persistent ready-to-issue handoff/shortage request, quantity rules, and unlisted-material path.
- No SQL/schema/server business change, Inventory mutation, Purchase/PO/Receiving, Ticket, Legacy PM, or handoff-file change.

Verification:
- Focused Patch 113 + Patch 112 + Step 4.1: **40/40 PASS**.
- Broad PM V2: **259/277 PASS, 18 fail** — same 18 baseline failures.
- Changed TSX syntax transpile: **1/1 PASS**; changed Node test syntax: PASS.

Apply:
1. Extract at project root over the current Patch 112 project.
2. **Do not run SQL.**
3. Run `npm run build` in the real project and restart/redeploy.
4. Manual check only: open the active technician material form and verify the button reads **تسجيل الاحتياج** before submitting the current Multi-Lot test need.

## Patch 114 — Technician Team-Warehouse self-service receipt
Purpose: remove the routine warehouse-user issue bottleneck when the full PM V2 material need is already available in the maintenance Team Warehouse, while preserving the existing Inventory/Delivery workflow as the physical stock Source of Truth.

Files:
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/pmv2/materials/request-service.ts`
- `server/pmv2/materials/team-issue-handoff-service.ts`
- `server/pmv2/materials/technician-self-service.ts`
- `server/routers/pmv2/technician.ts`
- `server/tests/pmv2-phase4-step4-1-material-intake.node.mjs`
- `server/tests/pmv2-patch112-material-picker-combobox.node.mjs`
- `server/tests/pmv2-patch114-technician-team-warehouse-self-service.node.mjs`
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/04_WORKFLOWS.md`
- `docs/pmv2/05_SCREENS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/09_TESTING.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/PATCH_MANIFEST.md`
- `docs/pmv2/README.md`

Scope:
- Full listed-material availability: technician gets **استلام المواد من مخزن الفريق** with a small confirmation.
- Persist the PM V2 need first, then reuse the existing Inventory/Delivery issue path with the logged-in technician as actual recipient.
- Return the exact `material_route_decision` Action ID so immediate receipt links to the persisted requirement.
- Expose technician-scoped live ready-to-receive state for both original Team stock and shortage routes after replenishment.
- Partial stock does not issue partially by default: required `7`, available `5`, shortage `2` records total need `7`, requests only `2`, and waits until full remaining need is available before technician receipt.
- Lot/Multi-Lot allocation, issue costing, Delivery documents, retry/relink safety, actual consumption, and Pending Return continue through existing accepted boundaries.
- Warehouse queue remains available for operational/recovery use but is no longer a required click for routine full-stock Team-Warehouse receipt.
- No SQL/schema, Purchase/PO implementation, Legacy PM, or handoff-file change.

Verification:
- Focused Patch 111–114 + Step 4.1 + Patch 110 issue/return regression: **74/74 PASS**.
- Broad PM V2 Node suite: **266/284 PASS, 18 fail** — the same 18 pre-existing baseline failures; Patch 114 adds seven passing checks and no new failure signature.
- Changed TS/TSX syntax transpile: **5/5 PASS**.
- Production build is pending on the real project because the attached source snapshot has no `node_modules`.

Apply:
1. Extract at project root over the current Patch 113 project.
2. **Do not run SQL.**
3. Run `npm run build` in the real project and restart/redeploy.
4. First manual runtime check only: use a fresh PM V2 material need whose full quantity is already in the Team Warehouse; confirm the technician sees **استلام المواد من مخزن الفريق** and the confirmation dialog. Do not confirm the physical receipt until that screen is reviewed.

## Patch 115 — Warehouse shortage clarity + existing Purchase handoff
Purpose: fix the Patch 114 partial-shortage warehouse card and complete the approved Main-Warehouse/Purchase decision without duplicating Inventory or Purchase workflows.

Files:
- `client/src/pages/pmv2/Pmv2WarehouseQueue.tsx`
- `client/src/pages/purchase/CreatePurchaseOrder.tsx`
- `client/src/pages/inventory/WarehouseTransfer.tsx`
- `server/pmv2/adapters/contracts.ts`
- `server/pmv2/adapters/current-system.ts`
- `server/pmv2/materials/warehouse-queue-service.ts`
- `server/pmv2/materials/warehouse-transfer-handoff-service.ts`
- `server/pmv2/materials/team-issue-handoff-service.ts`
- `server/pmv2/materials/warehouse-purchase-handoff-service.ts` (new)
- `server/routers/pmv2/warehouse.ts`
- `server/tests/pmv2-patch115-warehouse-shortage-purchase-handoff.node.mjs` (new)
- `server/tests/pmv2-phase4-step4-2a-warehouse-queue.node.mjs`
- `server/tests/pmv2-phase4-step4-2b-warehouse-transfer-handoff.node.mjs`
- relevant PM V2 docs listed in this patch; handoff checkpoint intentionally untouched.

Scope:
- Clear shortage-only warehouse action context.
- Whole-shortage transfer when Main Warehouse fully covers the remainder; no new default partial PM V2 transfer.
- Existing Purchase workflow handoff for only uncovered quantity when Main stock is insufficient.
- Read-only Purchase/confirmed-Receipt adapter; PM V2 writes only the frozen purchase-link row/audit after authoritative PO creation.
- Purchase overage remains general stock.
- Ready issue/receipt gating until shortage physically reaches Team Warehouse.
- No SQL/schema and no Legacy PM changes.

Verification:
- Focused Phase 4/Patch 114–115 regression: **120/120 PASS**.
- Broad PM V2 Node suite: **277/295 PASS, 18 fail**, same baseline failures.
- Changed TS/TSX syntax transpile: **10/10 PASS**.
- Production build: pending in the real project.

Apply:
1. Extract at project root over the current Patch 114 project.
2. **Do not run SQL.**
3. Run `npm run build` and restart/redeploy.
4. First manual check only: open the existing `PMV2-20260919-P6-T14` warehouse shortage card and review its quantities/actions; do not execute transfer/purchase until reviewed.

## Patch 116 — PM V2 Purchase unit prefill
Purpose: fix the Patch 115 Purchase handoff so the existing Purchase Order form receives and displays the authoritative unit automatically instead of a blank disabled Unit control.

Files:
- `server/pmv2/materials/warehouse-purchase-handoff-service.ts`
- `client/src/pages/pmv2/Pmv2WarehouseQueue.tsx`
- `client/src/pages/purchase/CreatePurchaseOrder.tsx`
- `server/tests/pmv2-patch115-warehouse-shortage-purchase-handoff.node.mjs`
- `server/tests/pmv2-patch116-purchase-unit-prefill.node.mjs` (new)
- relevant PM V2 status/testing/release docs; handoff checkpoint intentionally untouched.

Scope:
- Resolve existing active Catalog Unit by Master Data identity and pass `pmv2UnitId` + canonical text to `/purchase-orders/new`.
- Canonicalize and lock the PM V2-bound Purchase unit only when resolution succeeds.
- Keep manual active-unit fallback when resolution is impossible, with validation preventing a blank unit.
- Compare Purchase/PM V2 units by Catalog Unit identity where available, so Arabic/English aliases of one unit remain compatible.
- No SQL/schema, Purchase workflow rewrite, Master Data duplication, or Legacy PM change.

Verification:
- Focused Patch 114–116/Phase 4 regression: **90/90 PASS**.
- Broad PM V2 Node suite: **282/300 PASS, 18 fail**, same baseline failures.
- Changed TS/TSX syntax transpile: **3/3 PASS**.
- Production build: pending in the real project.

Apply:
1. Extract at project root over the current Patch 115 project.
2. **Do not run SQL.**
3. Run `npm run build` and restart/redeploy.
4. First manual check only: reopen the existing PM V2 Duracell shortage Purchase handoff and confirm the Unit field is auto-filled before taking any Purchase action.

## Patch 117 — PM V2-linked Purchase single-item/reference mode
Purpose: make a Purchase request launched from one PM V2 shortage visibly traceable and prevent unrelated Purchase items from being mixed into that linked request, without changing normal Purchase behavior.

Files:
- `client/src/pages/pmv2/Pmv2WarehouseQueue.tsx`
- `client/src/pages/purchase/CreatePurchaseOrder.tsx`
- `server/tests/pmv2-patch115-warehouse-shortage-purchase-handoff.node.mjs`
- `server/tests/pmv2-patch117-purchase-linked-single-item-mode.node.mjs` (new)
- relevant PM V2 workflow/screen/decision/status/testing/release docs; handoff checkpoint intentionally untouched.

Scope:
- pass task-need and Team-Warehouse snapshot context into the existing Purchase page for display/reference only;
- show explicit **مرتبط بمهمة صيانة مجدولة PM V2** context;
- lock the PM V2-linked Catalog identity and exact shortage quantity;
- keep Patch 116 unit resolution/fallback behavior;
- hide generic **إضافة صنف** only in PM V2 linked mode;
- defensively submit/save only the single linked item;
- leave ordinary multi-item Purchase requests, approvals, PO, Receiving, Inventory, Legacy PM, and schema unchanged.

Verification:
- focused Patch 114–117 regression: **29/29 PASS**;
- broad PM V2 Node suite: **288/306 PASS, 18 fail**, same baseline failures;
- changed TSX syntax transpile: **2/2 PASS**;
- production build: pending in the real project.

Apply:
1. Extract at project root over the current Patch 116 project.
2. **Do not run SQL.**
3. Run `npm run build` and restart/redeploy.
4. First manual check only: reopen the PM V2-linked Duracell Purchase request and confirm the PM V2 reference card is visible and **إضافة** is not available. Do not submit yet.


## Patch 118 — PM V2 Purchase Unit Master-Data precedence
Purpose: fix the remaining PM V2-linked Purchase Unit resolution gap by making the linked Catalog Item's current Master Data unit authoritative before older PM V2 snapshot text.

Files:
- `server/pmv2/materials/warehouse-purchase-handoff-service.ts`
- `server/tests/pmv2-patch118-purchase-unit-masterdata-precedence.node.mjs` (new)
- relevant PM V2 status/testing/release docs; handoff checkpoint intentionally untouched.

Scope:
- resolve the active Catalog Unit from current Catalog Item Master Data first;
- retain current Inventory unit and PM V2 snapshot only as secondary/fallback unit sources;
- keep passing canonical unit text + stable Catalog Unit ID to `/purchase-orders/new`;
- validate the authoritative created PO item against the same resolved Catalog Unit identity;
- preserve Patch 117 one-shortage/one-Purchase-item mode and ordinary Purchase behavior;
- no SQL/schema, Purchase workflow rewrite, Master Data duplication, or Legacy PM change.

Verification:
- focused Patch 114–118 regression: **75/75 PASS**;
- broad PM V2 Node suite: **291/309 PASS, 18 fail**, same baseline failures;
- changed TypeScript syntax transpile: **1/1 PASS**;
- production build: pending in the real project.

Apply:
1. Extract at project root over the current Patch 117 project.
2. **Do not run SQL.**
3. Run `npm run build` and restart/redeploy.
4. First manual check only: reopen the same linked Duracell Purchase request and confirm Unit auto-fill (`PIECE / قطعة`) with no unresolved-unit warning. Do not submit yet.

## Patch 119 — Manual Purchase unit fallback + existing PO relink
Purpose: accept the buyer's active Purchase unit when the Catalog Item has no authoritative Catalog Unit relationship, and recover a failed PM V2 link against the Purchase Order that already exists.

Files:
- `server/pmv2/materials/warehouse-purchase-handoff-service.ts`
- `client/src/pages/purchase/CreatePurchaseOrder.tsx`
- `client/src/pages/purchase/PurchaseOrderDetail.tsx`
- `server/tests/pmv2-patch116-purchase-unit-prefill.node.mjs`
- `server/tests/pmv2-patch118-purchase-unit-masterdata-precedence.node.mjs`
- `server/tests/pmv2-patch119-purchase-manual-unit-existing-po-relink.node.mjs` (new)
- relevant PM V2 workflow/screen/decision/status/testing/release docs; handoff checkpoint intentionally untouched.

Scope:
- Catalog Item unit linkage is the only authoritative automatic Purchase-unit lock;
- unlinked Catalog item → explicit active unit selection in Purchase, no Master Data write-back;
- no free-text PM V2 snapshot comparison when Catalog has no authoritative unit relationship;
- existing Purchase Order Detail can safely link/relink the already-created order to the referenced PM V2 request item;
- no Purchase creation in the relink action and no duplicate physical/business transaction;
- Patch 117 single-item restriction and ordinary Purchase behavior remain unchanged;
- no SQL/schema or Legacy PM change.

Verification:
- focused Patch 115–119/warehouse regression: **72/72 PASS**;
- broad PM V2 Node suite: **295/313 PASS, 18 fail**, same baseline failures;
- changed TS/TSX syntax transpile: **3/3 PASS**;
- production build: pending in the real project.

Apply:
1. Extract at project root over the current Patch 118 project.
2. **Do not run SQL.**
3. Run `npm run build` and restart/redeploy.
4. First manual check only: open the Purchase Order that was already created and confirm **ربط / إعادة ربط PM V2** is available. Do not create another Purchase Order.

## Patch 134 — Technician material attention
Purpose: keep unresolved/ready PM V2 material needs persistently visible to the requesting technician instead of allowing them to disappear among a large number of task cards.

Files:
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/routers/pmv2/technician.ts`
- `server/pmv2/materials/technician-attention-service.ts`
- `server/tests/pmv2-patch134-technician-material-attention.node.mjs`
- PM V2 documentation updated retroactively on 2026-09-24.

Scope:
- add **مواد تحتاج انتباهك** above the technician task feed;
- refresh material attention every 60 seconds and with the existing page refresh;
- prioritize ready-to-receive material and preserve waiting identity/warehouse/purchase/transfer states;
- allow open-task or existing technician self-service receipt from the attention card;
- scope every attention item to the requesting technician;
- after unlisted-material identity resolution, treat the old route as history and display the resolved operational route;
- drop consumed/cancelled/completed attention states after no technician action remains;
- no SQL/schema and no new Inventory/Purchase workflow.

Verification:
- focused Patch 134: **6/6 PASS**;
- later baseline integrity check: the four Patch 134 files in `eggt5.zip` matched the original Patch 134 package byte-for-byte;
- broad PM V2 baseline before Patch 135: **315/334 PASS, 19 fail**;
- production build not re-verified in the execution environment because dependencies were unavailable.

Reference: `PATCH134_TECHNICIAN_MATERIAL_ATTENTION_2026-09-24.md`.

## Patch 135 — Material shortage integrity
Purpose: prevent duplicate selection after warehouse identity resolution and show the technician the live remaining shortage instead of a stale original shortage snapshot.

Files:
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/pmv2/materials/technician-attention-service.ts`
- `server/tests/pmv2-patch135-material-shortage-integrity.node.mjs`
- PM V2 documentation files.

Scope:
- duplicate blocking includes both direct `catalogItemId` and `identityResolution.resolvedCatalogItemId`;
- expose initial shortage, warehouse-requested, Main-received, Team-issued, and current remaining-shortage quantities;
- calculate current remaining shortage from confirmed quantity issued into Team Warehouse;
- distinguish **النقص عند التسجيل** from **المتبقي من النقص** and show Main-received / Team-transferred progress;
- preserve and regression-test the already-existing true-shortage route: full Team stock → no request; partial stock → request only `required - available`; identity resolution → recheck live Team stock;
- no SQL/schema and no rewrite of Purchase/Transfer/Inventory ownership.

Verification:
- Patch 135 tests: **7/7 PASS**;
- focused Patches 114/115/131/134/135: **39/39 PASS**;
- broad PM V2 after Patch 135: **322/341 PASS, 19 fail** versus baseline **315/334 PASS, 19 fail**; no new broad-suite failure;
- build/check not verified in this environment because dependencies were absent and `npm ci` timed out.

Reference: `PATCH135_MATERIAL_SHORTAGE_INTEGRITY_2026-09-24.md`.

## Patch 136 — Warehouse request page organization
Purpose: reorganize `/scheduled-maintenance/warehouse-requests` for warehouse operators without deleting any existing information, action, status, or recovery path.

Files:
- `client/src/pages/pmv2/Pmv2WarehouseQueue.tsx`
- `server/tests/pmv2-patch136-warehouse-queue-organization.node.mjs`
- PM V2 documentation files.

Scope:
- consolidate warehouse identity and queue counts into one summary surface;
- place waiting/action-required requests first, ready-to-issue second, pending returns third;
- preserve the existing PM V2 stock-ownership notice and move it after operational work;
- group waiting-request content as quantities, inventory/destination, request/status details, linked purchases, and action;
- retain all existing identity resolution, transfer, purchase, issue/relink, Lot, recipient, and return controls;
- no server API, shortage logic, Inventory, Purchase, SQL/schema, or Legacy PM change.

Verification:
- focused Patches 134/135/136: **20/20 PASS**;
- PATCH136 TSX syntax transpile: **PASS**;
- production build not verified in the delivered source snapshot because dependencies are absent.

Reference: `PATCH136_WAREHOUSE_QUEUE_ORGANIZATION_2026-09-24.md`.

## Patch 137 — Warehouse tabs + progressive details
Purpose: further simplify `/scheduled-maintenance/warehouse-requests` while preserving every existing field, action, status, explanation, and recovery path.

Files:
- `client/src/pages/pmv2/Pmv2WarehouseQueue.tsx`
- `server/tests/pmv2-patch137-warehouse-tabs-progressive-details.node.mjs`
- PM V2 documentation files.

Scope:
- add exactly three operational tabs: **تحتاج معالجة / جاهزة للصرف / المرتجعات**;
- default to **تحتاج معالجة** and display only one operational section at a time;
- preserve the existing warehouse summary and PM V2 architecture notice;
- keep existing card headers visible and collapse detailed card content by default;
- expose the same content/actions through **عرض التفاصيل والإجراء / الصرف / الاستلام** and **إخفاء التفاصيل**;
- retain all Patch 136 fields, Transfer/Purchase handoffs, issue/relink, recipient, Lot, and return controls;
- no server/API/business logic, Inventory, Purchase, SQL/schema, or Legacy PM change.

Verification:
- focused Patches 134/135/136/137: **27/27 PASS**;
- Patch 137 TSX syntax transpile: **PASS**;
- broad PM V2 after Patch 137: **336/355 PASS, 19 fail** versus Patch 136 **329/348 PASS, 19 fail** with identical failing test names and **0 new broad-suite failures**;
- production build not verified in the delivered source snapshot because installed dependencies are absent.

Reference: `PATCH137_WAREHOUSE_TABS_PROGRESSIVE_DETAILS_2026-09-24.md`.

## Patch 138 — Task continuation + responsibility timeline
Purpose: resume a material-blocked PM V2 Task Item as a continuation of the same Task and expose where the Task is waiting, who currently owns the action, and how long recorded stages took.

Files:
- `server/pmv2/technician/execution-service.ts`
- `server/pmv2/tracking/timeline-service.ts` (new)
- `server/routers/pmv2/technician.ts`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/tests/pmv2-patch138-task-continuation-timeline.node.mjs`
- PM V2 documentation files.

Scope:
- add **استكمال العمل** for `ready_to_complete + needs_material` without creating another Task;
- create/reuse a Visit on the same Task and record `resume_execution` in the existing Item Action log;
- preserve existing material consumption/return settlement when the resumed Item is completed;
- add a read-only PM V2 Timeline over existing PM V2, Purchase, Ticket, Audit and User source data;
- derive current role/person, stage start, stage durations and responsibility durations;
- show task age, actual execution, material/ticket waiting, waiting-to-resume and full history to the technician;
- do not call a role/person "late" without a future approved SLA;
- no SQL/schema and no external workflow mutation.

Verification:
- Patch 138: **9/9 PASS**;
- focused cross-patch regression: **99/99 PASS**;
- broad baseline: **336/355 PASS, 19 fail**;
- broad Patch 138: **345/364 PASS, 19 fail**, identical 19 failure names and **0 new failures**;
- changed TS/TSX syntax: **PASS**;
- full build/typecheck not re-verified because the source snapshot contains no `node_modules`.

Reference: `PATCH138_TASK_CONTINUATION_TIMELINE_2026-09-26.md`.

## Patch 139 — Management monitoring + owner indicators + SLA + alerts
Purpose: expose PM V2 open-task responsibility to maintenance management and owner, classify delay only after an explicit SLA is configured, and send deduplicated PM V2 reminders through the existing notification system.

Files:
- `client/src/pages/pmv2/ScheduledMaintenance.tsx`
- `server/pmv2/tracking/timeline-service.ts`
- `server/pmv2/monitoring/{service,sla-service,alert-service,alert-scheduler}.ts`
- `server/routers/pmv2/monitoring.ts`
- `server/routers/pmv2/index.ts`
- `drizzle/schema.ts`
- `drizzle/2026_09_26_pmv2_monitoring_sla_alerts.sql`
- `server/tests/pmv2-patch139-management-monitoring-sla-alerts.node.mjs`
- PM V2 documentation files.

Scope:
- manager list: why task is waiting, current stage/role/person, elapsed current responsibility, task age and SLA state;
- management Timeline detail reuses the same PATCH138 timeline engine;
- owner-only executive indicators inside the PM V2 management UI;
- configurable SLA/reminder minutes per PM V2 responsibility role; unset SLA never means late;
- periodic PM V2 alert sweep every five minutes, deduplicated in `pmv2_alert_deliveries`, using the existing notification service;
- no write to Purchase/Ticket/Inventory workflow state.

Database:
- new PM V2-only tables `pmv2_sla_rules` and `pmv2_alert_deliveries`;
- apply `drizzle/2026_09_26_pmv2_monitoring_sla_alerts.sql`.

Verification:
- Patch 139: **10/10 PASS**;
- focused cross-patch: **56/56 PASS**;
- broad after Patch 139: **355/374 PASS, 19 fail**, same 19 baseline failures and **0 new failures**.

Reference: `PATCH139_MANAGEMENT_MONITORING_SLA_ALERTS_2026-09-26.md`.

## Patch 140 — Manager pending-work priority UI
Purpose: simplify the PATCH139 manager monitoring surface so intervention-worthy work is visible first while retaining all existing monitoring facts and controls.

Files:
- `client/src/pages/pmv2/ScheduledMaintenance.tsx`
- `server/tests/pmv2-patch140-manager-pending-priority-ui.node.mjs`
- PM V2 documentation files.

Scope:
- manager summary becomes **المهام المعلقة / تحتاج تدخلك الآن / تجاوز SLA / أقدم تعليق**;
- **تحتاج تدخلك الآن** = explicit Maintenance Manager responsibility or SLA breach only;
- replace the wide primary table with compact cards grouped into **تحتاج تدخلك الآن** then **معلقة وتحت الإجراء**;
- preserve task reason, stage, current role/person, elapsed responsibility time, age, SLA and Timeline drill-down;
- keep text search visible and retain role/person/team/SLA filters under progressive disclosure;
- retain owner indicators, Timeline detail, SLA/reminder configuration and alert sweep;
- presentation-only: no API/backend/SQL/schema/external workflow change.

Verification:
- Patch 140: **6/6 PASS**;
- Patch 139 + 140: **16/16 PASS**;
- broad after Patch 140: **361/380 PASS, 19 fail**, same 19 failure names as Patch 139 **355/374 PASS, 19 fail**, therefore **0 new broad-suite failures**;
- TSX syntax: **PASS**.

Reference: `PATCH140_MANAGER_PENDING_PRIORITY_UI_2026-09-26.md`.

## Patch 141 — Daily Scheduled Maintenance Reports
Purpose: give PM V2 management a separate daily report page that compares scheduled team work with actual execution and shows technician notes, open dependencies and current responsibility per task.

Files:
- `client/src/pages/pmv2/Pmv2MaintenanceReports.tsx`
- `client/src/App.tsx`
- `client/src/components/layout/DashboardLayout.tsx`
- `client/src/i18n/{ar,en,ur}.ts`
- `server/pmv2/reports/daily-report-service.ts`
- `server/routers/pmv2/reports.ts`
- `server/routers/pmv2/index.ts`
- `server/tests/pmv2-patch141-daily-maintenance-reports.node.mjs`
- PM V2 documentation files.

Scope:
- add `/scheduled-maintenance/reports` and sidebar item **تقارير الصيانة المجدولة**;
- compare tasks scheduled for the selected day with completed / worked-but-open / not-started outcomes;
- include current carry-over work and daily participation;
- show technician notes directly on each task card;
- show current stage/role/person and allow PATCH138 Timeline drill-down;
- preserve team-level assignment truth: technician filter shows team tasks plus actual recorded participation, never invents individual assignment;
- flag tasks with still-open Visits;
- no SQL/schema and no external workflow mutation.

Verification:
- Patch 141: **7/7 PASS**;
- Patch 138–141 focused regression: **32/32 PASS**;
- broad PM V2: **368/387 PASS, 19 fail** vs PATCH140 baseline **361/380 PASS, 19 fail**, identical 19 failure names and **0 new failures**;
- changed TS/TSX syntax: **PASS**.

Reference: `PATCH141_DAILY_MAINTENANCE_REPORTS_2026-09-26.md`.

## Patch 142 — Daily report review + additional management indicators
Purpose: finish the remaining PM V2 management-development items while deferring runtime/UAT.

Files include:
- `drizzle/schema.ts`
- `drizzle/2026_09_26_pmv2_daily_report_reviews.sql`
- `server/pmv2/reports/daily-report-service.ts`
- `server/routers/pmv2/reports.ts`
- `server/pmv2/monitoring/service.ts`
- `client/src/pages/pmv2/Pmv2MaintenanceReports.tsx`
- `client/src/pages/pmv2/ScheduledMaintenance.tsx`
- `server/tests/pmv2-patch142-report-review-admin-indicators.node.mjs`
- PM V2 documentation files.

Scope:
- persist team/day report review, reviewer, time and optional note;
- show reviewed / not-reviewed state in Scheduled Maintenance reports;
- add specialty/status/open-responsibility indicators and 30-day completion by team/specialty;
- keep SLA values unset until operationally configured;
- no external workflow writes.

Reference: `PATCH142_REPORT_REVIEW_ADMIN_INDICATORS_2026-09-26.md`.

## Patch 143 — Smart technician material picker
Purpose: close DEC-065 without changing material routing or external ownership.

Files:
- `server/pmv2/adapters/contracts.ts`
- `server/pmv2/adapters/current-system.ts`
- `server/pmv2/materials/request-service.ts`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/tests/pmv2-patch143-smart-material-picker.node.mjs`
- PM V2 documentation files.

Scope:
- smart no-search default: Team-Warehouse usable stock first;
- evidence-based same-target / same-Team ranking from existing `pmv2_material_usages`;
- unrestricted full active-Catalog search by name/code;
- Catalog taxonomy path + current Team-Warehouse balance in results;
- no inferred specialty mapping;
- no SQL/schema/external workflow write.

Verification: dedicated **5/5 PASS**; Step 4.1 + PATCH143 **40/40 PASS**; focused **114/114 PASS**; broad **380/399 PASS, 19 fail** vs PATCH142 **375/394 PASS, 19 fail**, identical failures and **0 new failures**; syntax **PASS**.

Reference: `PATCH143_SMART_MATERIAL_PICKER_2026-09-26.md`.
