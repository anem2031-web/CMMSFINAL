## Phase 1 DB Step 7 Closed / DB Step 8 Prepared — 2026-09-08

## 2026-09-08 — Phase 2 Step 2.4 + Phase 2 Close

- أضيف Scheduler engine/repository/job مستقل عن Legacy PM.
- Idempotent task generation مع snapshots وTarget revalidation.
- Scheduler runtime simulation 5/5 PASS؛ إعادة التشغيل لا تنشئ duplicates.
- Phase 2 acceptance gate 6/6 PASS؛ PM V2 standalone files 21/21 PASS.
- Phase 2 = CLOSED / PASS؛ Phase 3 = READY / NOT STARTED.


## 2026-09-08 — Phase 2 Step 2.3

- أضيف Programs/Program Targets runtime API.
- External targets validated through current adapters؛ لا Master Data مكرر.
- Program identity protected after first generated task.
- Step 2.3 contract 5/5 PASS.


## 2026-09-08 — Phase 2 Step 2.2

- اعتمدت recurrence semantics للتكرارات الستة مع Due calculator Date-only.
- أضيف end-of-month clamp وdisabled-item rule.
- لا SQL ولا Scheduler في هذه الخطوة.
- Step 2.2 recurrence contract 6/6 PASS.


## 2026-09-08 — Phase 2 Step 2.1

- بدأ Phase 2 رسميًا بعد أمر المستخدم.
- أضيف CRUD للقوائم القابلة لإعادة الاستخدام وبنودها داخل PM V2 namespace.
- أضيف Audit للقوائم والبنود عبر الخدمة الحالية.
- لا SQL ولا تعديل Legacy PM/Ticket/Purchase/Inventory workflows.
- Step 2.1 contract 6/6 PASS؛ PM V2 standalone test files 16/16 PASS.


- المستخدم نفذ `pmv2_program_targets` بنجاح: `Query OK`, 0 rows affected.
- DB Step 7 = PASS.
- جُهز DB Step 8 `pmv2_tasks` كـSchema foundation فقط.
- روابط Program/Program Target/Team داخلية بـFK، و`taskNumber` فريد.
- UNIQUE `(programId, programTargetId, dueDate)` يثبت حاجز Idempotency المجمد للScheduler.
- لا Task generation أو Scheduler behavior في هذه الخطوة؛ يبقى للمرحلة 2.

## Phase 1 DB Step 6 Closed / DB Step 7 Prepared — 2026-09-08

- المستخدم نفذ `pmv2_programs` بنجاح: `Query OK`, 0 rows affected.
- DB Step 6 = PASS.
- جُهز DB Step 7 `pmv2_program_targets` كـSchema foundation فقط.
- `programId` FK داخلية إلى PM V2؛ `siteId/sectionId/assetId` External References مفهرسة بدون Physical FK.
- Exactly One target يفرض في PM V2 write boundary مع Adapter validation، ولا نعتمد على TiDB `CHECK`.
- وظائف البرامج/الأهداف/توليد المهام والجدولة تبقى للمرحلة 2.

# Release Notes — PM V2 Documentation

## Phase 1 DB Step 5 Closed / DB Step 6 Prepared — 2026-09-08

- أكد `SHOW CREATE TABLE` أن `pmv2_checklist_items` موجود مع الـFK الداخلي والـIndexes الأساسية، وبدون `CHECK` غير فعالة.
- DB Step 5 = PASS.
- جُهز DB Step 6 `pmv2_programs` كـSchema foundation فقط، بربط داخلي إلى Team وChecklist وExternal creator reference بلا FK إلى `users`.
- لا Program CRUD/Scheduler/Target execution في هذا الجزء؛ هذه الوظائف تبقى للمرحلة 2.


> هذا الملف يلخص تغييرات التوثيق التي ما زالت ذات قيمة. التفاصيل التصميمية الملغاة أزيلت من المرجع النشط لتجنب التشتيت.


## Phase 1 TiDB CHECK Mitigation — 2026-09-08

- نفذ المستخدم DDL لـ`pmv2_checklist_items` وظهر تحذير لكل `CHECK` لأن `tidb_enable_check_constraint` معطل.
- لم يتم تغيير الإعداد GLOBAL.
- أزيلت `CHECK` من Drizzle/SQL baseline حتى يطابق Source of Truth ما تفرضه البيئة فعليًا.
- أضيف write-boundary validator مركزي لقيم Checklist Item مع اختبار Node مستقل ناجح 5/5.
- DB Step 5 يبقى تحت التحقق البنيوي قبل PASS؛ لا SQL schema تالٍ حتى ذلك.

## Phase 1 Foundation Started — 2026-09-07

- بدأت المرحلة 1 رسميًا بعد أمر المستخدم الصريح.
- أضيف Namespace مستقل لـPM V2 وتسجيل Additive في App Router.
- أضيف Security baseline وAudit wrapper يعيد استخدام Audit الحالي.
- أضيفت Adapter contracts الأساسية.
- أضيف `pmv2_specialties` إلى Drizzle schema كأول جدول من ERD.
- أُعيد تأكيد سياسة External References: Index + Adapter validation عند الكتابة + JOIN مباشر مسموح عند القراءة، بدون Physical FK إلى Master Data الحالية.
- نفذ المستخدم DB Step 1 يدويًا بنجاح: إنشاء `pmv2_specialties` (`Query OK`, 0 rows affected).
- جُهز DB Step 2 فقط: `pmv2_teams` مع FK داخلي إلى Specialty وIndexes لـWarehouse/Device User بدون External FKs.
- نفذ المستخدم DB Step 2 يدويًا بنجاح: إنشاء `pmv2_teams` (`Query OK`, 0 rows affected).
- جُهز DB Step 3 فقط: `pmv2_team_members` مع FK داخلي إلى Team، و`userId` كـIndexed External Reference بلا FK إلى `users`، وUNIQUE على `(teamId,userId)`.
- نفذ المستخدم DB Step 3 يدويًا بنجاح: إنشاء `pmv2_team_members` (`Query OK`, 0 rows affected).
- أضيف Current Users/Warehouses adapter implementation للتحقق عند الكتابة بدون Master Data موازٍ.
- أضيف Organization service/router لـSpecialties/Teams/Team Members مع Audit وMembership reactivation contract.
- أضيف Maintenance Target adapter/router لقراءة/Validation `Site | Section | Asset` مباشرة من Master Data الحالية.
- جُهز DB Step 4 فقط: `pmv2_checklists`; ثم نفذه المستخدم يدويًا بنجاح (`Query OK`, 0 rows affected).
- جُهز DB Step 5 فقط: `pmv2_checklist_items` كـSchema foundation ضمن المرحلة 1؛ وظائف Checklist/Recurrence نفسها لا تبدأ قبل المرحلة 2.
- روجعت حزمة `WAREHOUSE-ITEM-RECEIPT-FIX` واعتمدت كجزء من baseline الحالي؛ لا تعارض ملفات مع PM V2 ولا تعديل لها من PM V2.
- Legacy PM وTicket/Purchase/Inventory workflows لم تعدل.

## اعتماد خطة التنفيذ المدمجة — 2026-09-06

- أصبحت الخطة التنفيذية الرسمية بعد Phase 0 مكونة من **6 مراحل فقط**.
- أُلغي التقسيم السابق إلى 15 مرحلة من المرجع النشط لمنع التشتيت.
- محتوى المراحل القديمة لم يُفقد؛ دُمج كخطوات فرعية وبوابات قبول داخل المراحل الست.
- نقطة التوقف الحالية: قبل **المرحلة 1 — تأسيس الوحدة وربط البيانات الأساسية**.

## Phase 0 Finalization — 2026-09-06

تم إغلاق Phase 0 بعد:

- Existing Capability Audit وLive DB Reality Checks.
- Organization Freeze: `Specialty → Team → Members`.
- Maintenance Target Freeze: `Site | Section | Asset`.
- Material Recipient Attribution Freeze.
- تصحيح Purchase Source: PM V2 Material Request Item يرتبط مباشرة بـPO/PO Item عبر PM V2-owned link، دون Bridge Ticket.
- PO full existing-workflow reuse.
- Ticket existing-workflow reuse، مع A/B/C كما هي.
- Task/Task Item State Machine Freeze.
- Material Request Item State Machine + Transition Ownership Freeze.
- Final ERD Freeze.
- Documentation cleanup: إزالة الخطط القديمة والمتعارضة وتحديث جميع Checkpoints/Gates.
- Phase 0 Acceptance Gate = PASS/CLOSED.

### كود/DB

- لم يبدأ PM V2 production code.
- لا جداول/Migrations PM V2 نُفذت.
- لا DB writes نفذها المساعد.
- لا Workflow قائم عدل لأجل PM V2.

### المرحلة التالية

المرحلة 1 — تأسيس الوحدة وربط البيانات الأساسية — READY/NOT STARTED.

## ملاحظات تاريخية ضرورية

- تصحيح سجلين Asset أثناء Reality Check نفذه المستخدم يدويًا، ثم نجح فحص سلامة Site/Section/Asset.
- Legacy delivery data تحتوي حالات Name-only؛ PM V2 لا تعتمد الاسم وحده لهوية Recipient جديدة ولا تعمل Backfill تلقائيًا.
- `packageId` ثبت أنه خاص بـPurchase Packages ولا يستخدم Source field لـPM V2.
- Runtime dependencies لم تكن متاحة في بيئة فحص Phase 0؛ لذلك Runtime gates تبدأ مع التنفيذ ولا تعتبر Static inspection بديلًا عنها.


## 2026-09-08 — Phase 1 DB Step 8 runtime confirmation / Step 9 preparation

- Confirmed user-executed `pmv2_tasks` creation: PASS.
- Prepared `pmv2_task_items` schema foundation from the frozen ERD.
- No scheduler, task generation, technician execution, Legacy PM, Ticket, Purchase, or Inventory workflow changes.


## 2026-09-08 — Phase 1 DB Step 9 runtime confirmation / Step 10 preparation

- Confirmed user-executed `pmv2_task_items` creation: PASS (`Query OK`, 0 rows affected).
- Prepared `pmv2_visits` schema foundation with an internal FK to `pmv2_tasks`.
- Visit header stores start/end timestamps only; members/leader remain normalized in `pmv2_visit_members`.
- No scheduler, technician execution, Legacy PM, Ticket, Purchase, or Inventory workflow changes.


## 2026-09-08 — Phase 1 DB Step 10 runtime confirmation / Step 11 preparation

- Confirmed user-executed `pmv2_visits` creation: PASS (`Query OK`, 0 rows affected).
- Prepared `pmv2_visit_members` schema foundation.
- Visit membership uses internal Visit FK and indexed External User reference without physical FK to `users`.
- Duplicate membership in a single Visit is blocked by UNIQUE `(visitId, userId)`.
- Leader marker is stored in PM V2; leader/member runtime behavior remains Phase 3.
- No Legacy PM, Ticket, Purchase, Inventory, or Master Data workflow changes.


## 2026-09-08 — Phase 1 DB Step 11 runtime confirmation / Step 12 preparation

- Confirmed user-executed `pmv2_visit_members` creation: PASS (`Query OK`, 0 rows affected).
- Prepared `pmv2_item_actions` schema foundation.
- Item Actions belong to a Task Item and a Visit using internal PM V2 FKs.
- Performer is an indexed External User reference without physical FK to `users`.
- Technician results reuse the four frozen values.
- Evidence continues through the current attachment service; no duplicate PM V2 attachment storage was introduced.
- No Legacy PM, Ticket, Purchase, Inventory, or Master Data workflow changes.


## 2026-09-08 — Phase 1 DB Step 12 runtime confirmation / Step 13 preparation

- Confirmed user-executed `pmv2_item_actions` creation: PASS (`Query OK`, 0 rows affected).
- Prepared `pmv2_material_requests` schema foundation from the frozen ERD.
- Material Request Header has no independent status.
- Requester and Team Warehouse remain indexed External References without physical FKs to existing Master Data.
- No Material, Inventory, Purchase, Ticket, or Legacy PM workflow behavior was activated or modified.


## 2026-09-08 — Phase 1 DB Step 13 runtime confirmation / Step 14 preparation

- Confirmed user-executed `pmv2_material_requests` creation: PASS (`Query OK`, 0 rows affected).
- Prepared `pmv2_material_request_items` schema foundation from the frozen ERD.
- Material Request Items keep `catalogItemId` as an indexed External Reference with no physical FK to current Catalog Master Data.
- Added PM V2 write-boundary quantity validation because live TiDB does not enforce CHECK constraints.
- No Inventory, Purchase, Ticket, or Legacy PM workflow behavior was activated or modified.


## 2026-09-08 — Phase 1 DB Step 14 runtime confirmation / Step 15 preparation

- Confirmed user-executed `pmv2_material_request_items` creation: PASS (`Query OK`, 0 rows affected).
- Prepared `pmv2_material_purchase_links` schema foundation from the frozen ERD.
- Purchase Order, Purchase Order Item, and creator remain indexed External References; no physical FK is imposed on the existing Purchase/User tables.
- Added uniqueness guards for PO Item source attribution and PM V2 write-boundary validation for linked quantity allocation.
- PM V2 stores only the source link; no PO status or Purchase workflow behavior is duplicated or modified.
- DB Step 15 standalone contract = PASS (6/6) and quantity validation smoke = PASS (4 cases).


## 2026-09-08 — Phase 1 DB Step 15 runtime confirmation / Step 16 preparation

- Confirmed user-executed `pmv2_material_purchase_links` creation: PASS (`Query OK`, 0 rows affected).
- Prepared `pmv2_task_ticket_links` schema foundation from the frozen ERD.
- Task Item uses an internal PM V2 FK; Ticket and creator remain indexed External References without physical FKs to existing Ticket/User tables.
- `ticketId` is UNIQUE for unambiguous PM V2 source attribution.
- PM V2 does not duplicate Ticket status, maintenance path, or `taskId`; current Ticket Workflow remains authoritative.
- DB Step 16 standalone schema contract = PASS (5/5).
- No Legacy PM, Ticket Workflow, Purchase Workflow, Inventory Workflow, or Master Data workflow was modified.


## 2026-09-08 — Phase 1 DB Step 16 runtime confirmation / Step 17 preparation

- Confirmed user-executed `pmv2_task_ticket_links` creation: PASS (`Query OK`, 0 rows affected).
- Prepared `pmv2_material_usages` schema foundation from the frozen ERD.
- Material Usage is trace/audit only and does not own stock balance or Inventory workflow state.
- Task Item/Visit/optional Material Request Item use internal PM V2 FKs; current Inventory/Delivery/Warehouse/Catalog/PO Item/User references stay external indexed IDs.
- Added PM V2 write-boundary validation for positive usage quantity because live TiDB CHECK enforcement is disabled.
- Standalone schema contract = PASS (5/5); usage validation smoke = PASS (5/5).
- No Legacy PM, Ticket Workflow, Purchase Workflow, Inventory Workflow, or Master Data workflow was modified.


## 2026-09-08 — Phase 1 DB Step 17 runtime confirmation / Step 18 preparation

- Confirmed user-executed `pmv2_material_usages` creation: PASS (`Query OK`, 0 rows affected).
- Reality Check confirmed reuse of the current `notifications` table/service and Web Push infrastructure.
- Prepared `pmv2_request_reminders` as the final Phase 1 schema-foundation table.
- Request Reminder stores source/trace metadata only; no duplicate notification title/message/status or scheduling workflow is introduced.
- Recipient/Notification/Creator are external indexed references; only Material Request uses an internal PM V2 FK.
- Standalone schema contract = PASS (5/5).
- No Legacy PM, Notification workflow, Ticket workflow, Purchase workflow, Inventory workflow, or Master Data workflow was modified.


## 2026-09-08 — Phase 1 DB Step 18 runtime confirmation / Acceptance Gate

- Confirmed user-executed `pmv2_request_reminders` creation: PASS (`Query OK`, 0 rows affected).
- All 18 PM V2 tables from the frozen ERD are now created.
- Added `server/tests/pmv2-phase1-acceptance-gate.node.mjs`.
- Standalone PM V2 Node suite = 63/63 PASS; aggregate Phase 1 gate = 6/6 PASS.
- Syntax/relative-import-path scan = PASS.
- Clean baseline diff confirms PM V2 patches did not modify Legacy PM/Ticket/Purchase/Inventory workflow source files; shared changes remain additive in `drizzle/schema.ts` and `server/routers/index.ts`.
- Full project Typecheck/Vitest/Build/runtime smoke remain blocked by unavailable dependencies in the assistant environment.
- Phase 1 stays IN PROGRESS / GATE PENDING. Phase 2 is not started.


## 2026-09-08 — Phase 1 closure + external regression baseline

- Phase 1 (PM V2) marked **CLOSED / PASS** after DB Steps 1–18 PASS, PM V2 standalone tests 63/63 PASS, standalone Phase 1 gate 6/6 PASS, and patch-isolation review.
- Phase 2 marked **READY / NOT STARTED**.
- Full-project test failures outside PM V2 were not mixed into PM V2 scope; recorded as `PEND-001` in `pending/PENDING_ITEMS.md` for later review.
- No Legacy PM/Ticket/Purchase/Inventory workflow change was introduced by this documentation closure.

## 2026-09-08 — Scheduled Maintenance UI testability patch

- Adopted the user-facing PM V2 name **الصيانة المجدولة**.
- Added a separate sidebar entry and `/scheduled-maintenance` route.
- Added management/test UI for Phase 1 organization and Phase 2 checklist/program/scheduler flows.
- Added read-only PM V2 task/task-item browsing to verify scheduler output and historical snapshots.
- Preserved Legacy PM `/preventive` unchanged.
- No DB schema change; no SQL required.
- PM V2 standalone regression after patch: 71/71 PASS.

### 2026-09-08 — Scheduler Specialty activation regression fix
- Fixed Phase 2 scheduler eligibility so an inactive PM V2 Specialty blocks task generation for its Teams.
- Root cause was a missing Specialty join/filter in the active-program repository query.
- Added dedicated regression coverage.
- No database schema change and no SQL required.

## Patch 058 — 2026-09-09 — Biweekly runtime verification and manual scheduler date clarity
- Verifies the exact every-two-weeks existing-task backfill path through the production scheduler engine.
- Clarifies that task browsing dates do not execute the scheduler.
- Adds **استخدام تاريخ البحث** for one-day `كل المهام` filters to copy that day into the manual scheduler field.
- No SQL and no Legacy PM changes.

## Patch 059 — 2026-09-09 — Historical recurrence provenance badges
- Added structured recurrence snapshots to newly generated PM V2 task items: frequency, interval, weekday, month-day, and anchor date.
- Scheduled Maintenance now shows a compact Arabic recurrence badge beside every historical task item, e.g. `يومي`, `أسبوعي • الاثنين`, `كل أسبوعين • الاثنين`, `شهري • يوم 10`, `ربع سنوي`, `نصف سنوي`, `سنوي`.
- Pre-patch task-item rows have NULL snapshot columns; the read path falls back to their current source checklist item so existing test history receives a useful label immediately. Newly generated rows preserve their recurrence configuration historically even if the source checklist is changed later.
- Requires one manual `ALTER TABLE pmv2_task_items ...` step. No Legacy PM, Ticket, Purchase, Inventory, or Master Data workflow is modified.

## Patch 060 — 2026-09-09 — Historical task-item read regression fix
- Manual acceptance after Patch 059 showed scheduler generation succeeded (`2` tasks / `12` task items) while the selected task displayed no historical items.
- Root cause: the read service joined/referenced `pmv2ChecklistItems` without importing the schema symbol.
- Added the missing import and a regression guard that asserts the joined schema table is present in the import block.
- No scheduler/recurrence production logic change and no SQL required for this patch.

## Patch 061 — 2026-09-09 — Exact-date auto-filter fix
- Hardened `كل المهام` same-day date filtering with exact DATE equality.
- Date-field changes explicitly refresh the task result set.
- Task-list read errors are now visible instead of looking like `0` matches.
- No SQL and no Legacy PM changes.

## Patch 062 — 2026-09-09 — Hide already-linked program targets
- Simplified **البرامج والأهداف** so the target selector only offers unlinked Sites/Sections/Assets for the selected program.
- Newly linked targets disappear from the selector immediately after refresh.
- The empty selector clearly states when there are no unlinked targets of that type.
- Server duplicate protection remains in place.
- No SQL and no Legacy PM changes.

## Patch 063 — 2026-09-09 — Checklist recurrence interval input validation
- Fixed Scheduled Maintenance silently converting invalid `كل كم دورة` values (`0`, negative) to `1` before checklist-item creation.
- Values must now be whole numbers `>= 1`; invalid values are blocked in the UI and remain rejected by the PM V2 service boundary.
- Existing invalid manual-test rows are not automatically altered.
- No SQL and no Legacy PM changes.

## Patch 064 — Simple recurrence for maintenance managers
- Simplifies checklist recurrence setup into direct maintenance-language choices instead of technical cycle/anchor terminology.
- Adds multi-day custom weekly schedules, multi-date monthly schedules, custom quarterly dates, and multiple yearly dates.
- Adds a live sentence preview explaining when the check will run.
- Preserves backward compatibility with all existing PM V2 recurrence rows.
- Adds durable human-readable recurrence snapshots to newly generated task items.
- Requires one manual PM V2 database step before patch files are applied; no Legacy PM objects are changed.


## Patch 065 — Workload foundation
Added the schema foundation for an optional program-level estimated duration (`estimatedDurationMinutes`). No conflict blocking is introduced: multiple tasks for the same team/day remain allowed.

## Patch 066 — Program edit UX + estimated duration
- Added a clear `تعديل البرنامج` action to the selected PM V2 program.
- The edit panel exposes team, checklist, and manager-facing estimated task duration in minutes.
- Duration is shown back in a readable form (for example `120` → `ساعتان`).
- Program create/update APIs now accept the optional `estimatedDurationMinutes` field already added by Patch 065.
- Existing protection against changing team/checklist after task generation remains unchanged; duration itself can still be updated.
- PM V2 only; no Legacy PM change; Phase 3 remains not started.

## Patch 067 — Daily team workload calculation/status
- Added the read-only PM V2 calculation layer for daily team workload, grouped by team and due date.
- Sums program estimated duration across non-cancelled tasks without blocking multiple tasks on the same day.
- Initial 8-hour planning baseline: available through 4h, medium through 6h, high through 8h, conflict above 8h.
- Exposes incomplete-estimate metadata so tasks without duration are not hidden by a misleading total.
- No SQL, no Legacy PM changes, and Phase 3 remains not started.

## Patch 068 — Simple team workload view
- Added a compact **حمل الفرق** tab designed for quick visual planning rather than a complex scheduling screen.
- Weekly matrix shows team/day task count, estimated time, and `متاح / متوسط / مرتفع / تعارض` using Patch 067 data.
- Missing estimated durations are labeled `مدة ناقصة` so the manager is not shown a false complete status.
- Clicking a workload cell reveals that team's non-cancelled tasks for the chosen day.
- No SQL and no Phase 3 work.

## Patch 069 — Operational workload readability
- Refined **حمل الفرق** without adding screen complexity: current week opens focused on today + remaining days.
- Added a simple **الأسبوع كامل / من اليوم وما بعده** switch for the current week only.
- Highlighted today and subdued elapsed days in full-week mode so old load does not visually dominate future planning.
- Added one active-team selector and a separate overdue-task alert that follows the selected team.
- Overdue tasks are not automatically counted against today's load; they remain visible through the existing overdue task view.
- No SQL, no automatic rescheduling, and no Phase 3 work.

## Patch 070 — Direct overdue navigation from workload
- Made the overdue warning in **حمل الفرق** clickable.
- One click now opens **المهام المجدولة** already focused on **المتأخرة**.
- When a workload team is selected, the same team filter is preserved in the overdue task list.
- This is navigation/filter state only: no automatic rescheduling, no SQL, and no Phase 3 work.


## Patch 071 — Phase 2 workload acceptance checkpoint
- Recorded the successful manual checks for Patches 068–070.
- Reconciled the authoritative Phase 2 status with the continuation handoff: Phase 2 remains in final hardening/acceptance until the current improvements are accepted; Phase 3 is still not started.
- Strengthened the workload regression test around the already-existing team/day detail query.
- No runtime behavior change, no SQL, no Legacy PM change.

## Patch 073 — Workload task-duration detail
- Added the program estimated duration to the PM V2 task-list read model used by workload cell details.
- Each task shown under **مهام اليوم المختار** now displays its readable estimated duration (for example `100` minutes → `1 س 40 د`).
- Tasks without an estimate display **غير محددة**, matching the existing `مدة ناقصة` workload concept.
- No workload thresholds, scheduling behavior, database schema, or Phase 3 scope changed.

## Patch 074 — Automatic checklist item ordering
- Removed the manager-facing manual `الترتيب` field from checklist-item creation.
- New items created through the normal UI now receive the next stable order from the PM V2 service, starting at `1`.
- Automatic numbering considers all existing rows in the checklist so inactive/historical positions are not silently reused.
- The manager list displays simple ordinal positions from `1`, so old test rows internally stored with `sortOrder=0` no longer expose a confusing zero in the UI.
- Existing recurrence behavior, scheduler snapshots, and active-item uniqueness guards are preserved.
- No SQL, no Legacy PM change, and Phase 3 remains NOT STARTED.

## Patch 075 — Reset checklist-item add form after save
- Fixed a Phase 2 manager UX issue discovered during recurrence acceptance: after successfully adding a checklist item, the form previously kept the last recurrence/custom selections and only cleared the title.
- Successful create now resets the complete add-item form to the normal safe defaults while keeping the currently selected checklist open.
- Clears stale custom weekdays/month-days/quarter/year dates and resets custom interval/start helper values so the next item cannot accidentally inherit the prior item's schedule.
- Existing saved checklist items, recurrence semantics, scheduler behavior, and historical snapshots are unchanged.
- No SQL, no Legacy PM change, and Phase 3 remains NOT STARTED.

## Patch 076 — Manager-friendly recurrence wording (2026-09-12)
- Simplified the custom recurrence builder wording for maintenance managers across days, weeks, months, quarters, and years.
- Added a live **المعنى** explanation so numeric intervals are translated immediately (for example, two quarter units display as **كل 6 أشهر**).
- Replaced quarter/half-year technical interval labels with practical month/year spans in both saved checklist labels and newly generated recurrence snapshots.
- Added contextual guidance explaining that multiple execution days/dates may be added within the applicable cycle.
- No SQL and no recurrence-engine behavior change; Phase 3 remains NOT STARTED.


## Patch 077 — Two-question custom recurrence UX (2026-09-12)
- Simplified the manager custom-recurrence form again after manual acceptance showed that **فترة التكرار** still required explanation.
- Custom schedules now read naturally as **يتكرر الفحص كل [رقم] [وحدة]** with an immediate human **النتيجة**.
- Execution-date controls are grouped under one second question: **متى يتم التنفيذ؟**.
- The optional interval start field is now **يبدأ هذا النمط من**.
- No recurrence-engine, scheduler, persistence, SQL, Legacy PM, or Phase 3 change.


## Patch 078 — Optional program title (2026-09-12)
- Added optional human title to PM V2 programs after the manual DB ALTER succeeded.
- New and existing programs can be titled/renamed; untitled programs retain `برنامج #N`.
- Program cards, selected-program detail, and program search use the title.
- Title changes remain allowed after task generation and do not alter scheduling/history.
- No additional SQL is required beyond the already-confirmed manual statement; Phase 3 remains not started.

## Patch 079 — Due-only manual Scheduler targeting (2026-09-12)
- Improved the existing manual Scheduler test panel without changing production scheduling.
- Manager chooses a date, then **كل البرامج المستحقة** or **برنامج محدد**.
- Specific-program dropdown contains only programs whose active checklist has work due on the selected date.
- Manual endpoint accepts an optional program ID; automatic hourly Scheduler still runs all eligible programs exactly as before.
- Empty dates show a clear no-due-program state and disable execution.
- No SQL and Phase 3 remains not started.


## Patch 080 — Phase 2 final acceptance closure (2026-09-12)
- Closed the current Phase 2 hardening/acceptance cycle after explicit user approval.
- Reconciled authoritative docs to **Phase 2 CLOSED / PASS (final acceptance)** and **Phase 3 READY / NOT STARTED**.
- Recorded completed manual acceptance for workload, recurrence UX, optional program title/search, and manual Scheduler due-program targeting/idempotency.
- Recorded two optional recurrence runtime checks as **SKIPPED by user decision**, not PASS.
- Corrected the duplicate decision identifier for the manual Scheduler scope (`DEC-043`) and added the final closure decision (`DEC-044`).
- Focused standalone regression/checkpoint rerun: **62 checks PASS / 0 product failures** on the current Patch 079 runtime baseline.
- Documentation/test-checkpoint patch only: no runtime code, no SQL, no Legacy PM change, and no Phase 3 work.


## Patch 081 — Phase 3 Step 3.1 technician read foundation — 2026-09-13
- Phase 3 is now **IN PROGRESS** after explicit user approval; Phase 2 remains CLOSED/PASS and was not reopened.
- Added read-only technician access to `مهامي اليوم`, scoped server-side by active PM V2 team membership.
- Added technician-only PM V2 authorization separate from management authorization and protected direct routes accordingly.
- Added task progress/item read surface for mobile/tablet without Visits, result submission, state mutation, materials, tickets, or purchase integration.
- Repaired the project Drizzle snapshot by restoring `pmv2_programs.title`, which already exists in the live DB from Patch 078. No SQL.
- New focused test = 6/6 PASS; changed-source syntax transpile = 13/13 PASS; runtime/manual acceptance subsequently completed in Patch 082.


## Patch 082 — Phase 3 Step 3.1 manual acceptance closure — 2026-09-13
- Documentation-only checkpoint; no runtime code and no SQL.
- Verified assigned active technician can read the expected due-today task and both task items in **مهامي اليوم**.
- Verified a technician outside the task team sees no task.
- Verified disabling the assigned technician's team membership removes the task from **مهامي اليوم**; membership was reactivated afterward.
- Step 3.1 is now **CLOSED / PASS**. Phase 3 remains **IN PROGRESS**; execution mutations have not started.

## Patch 083 — Phase 3 Step 3.2 Start Execution — 2026-09-13
- Added the first PM V2 technician execution mutation: **بدء التنفيذ** for a pending Task Item.
- Start is protected by the existing technician role guard plus active Team membership revalidation at the write boundary.
- Start is atomic per Task: Task row lock, one open Visit reuse/create, Visit Member/Leader registration, Task Item + Task `in_progress`, Item Action `start_execution`, and `audit_logs` record.
- UI refreshes the Task and Item state after a successful start.
- Results/material/ticket/closure remain outside this patch.
- No SQL and no Legacy PM/Ticket/Purchase/Inventory workflow changes.
- Focused Phase 3 source/contract tests = 14/14 PASS; changed-file syntax transpile = 4/4 PASS. Manual runtime acceptance is recorded as CLOSED / PASS by Patch 084.


## Patch 084 — Phase 3 Step 3.2 manual acceptance closure — 2026-09-13
- Documentation-only patch; no runtime code and no SQL.
- Manual UI flow passed for both test items on `PMV2-20260913-P5-T13`.
- Live DB trace confirmed one open Visit, the initiating technician as Leader, two `start_execution` Item Actions, and two matching PM V2 audit records.
- Same-technician Visit reuse was manually verified; different-teammate join/reuse was not separately exercised manually and remains covered by focused automated checks.
- Step 3.2 is now **CLOSED / PASS**. Phase 3 remains **IN PROGRESS**.
- Result submission, Visit ending, and task completion remain NOT STARTED.


## Patch 085 — Phase 3 Step 3.3 basic results first slice — 2026-09-13
- Added technician **سليم** (`ok`) and **تم الإصلاح** (`fixed`) actions for Task Items already `in_progress`.
- Added optional execution note (max 2000 chars) stored on the Item Action.
- Result submission is atomic and revalidates active Team membership, exact ownership, and the single open Visit; active teammates can be joined to the Visit before recording a result.
- `ok/fixed` completes the Task Item. The Task remains `in_progress` until every Item is complete, then becomes `completed`.
- Result Item Action + PM V2 Audit are recorded in the same transaction.
- Visit ending, images/attachments, `needs_material`, `needs_ticket`, Inventory/Purchase/Ticket integration are deliberately outside this patch.
- No SQL/schema change. Focused Phase 3 regression = **23/23 PASS**; changed-source syntax transpile = **3/3 PASS**. Manual runtime acceptance pending.


## Patch 086 — Phase 3 Step 3.3 basic results manual acceptance closure — 2026-09-13
- Documentation-only closure for the Patch 085 `ok/fixed` slice; no runtime code and no SQL.
- Manual UI PASS: Item `437` -> `ok` / completed / progress `1/2` while Task stayed `in_progress`; Item `438` -> `fixed` / completed / progress `2/2` and Task became `completed`.
- Live DB PASS: Task `104`, Items `437/438`, `submit_result` Item Actions `3/4`, saved notes, performer `19110028`.
- Audit PASS: `pmv2.item_result_submitted` rows for entities `437` and `438` by technician `19110028`.
- Step 3.3 remains IN PROGRESS overall: `needs_material`, `needs_ticket`, Visit ending, attachments/images, and external integrations are still NOT STARTED.


## Patch 087 — Phase 3 Step 3.3B Core dependency outcomes — 2026-09-13
- Added technician **تحتاج مواد** (`needs_material`) and **تحتاج بلاغ صيانة** (`needs_ticket`) actions for `in_progress` PM V2 Task Items.
- Core state only: Item becomes `waiting_material` or `waiting_ticket`; result/note are recorded using the existing `submit_result` Item Action and PM V2 Audit boundary.
- Task cached status now supports mixed dependency projection with fixed priority **materials before ticket**, without blocking execution of unrelated Items in the same Task.
- Updated accepted `ok/fixed` projection so it preserves existing waiting dependencies.
- No Material Request, Inventory, Purchase, Ticket creation/link, Visit ending, Legacy PM, or SQL change.
- Focused Phase 3 regression: **34/34 PASS**. Changed TS/TSX syntax transpile: **3/3 PASS**. Manual runtime acceptance pending.

## Patch 088 — Phase 3 Step 3.3B manual acceptance closure — 2026-09-13
- Documentation-only closure for Patch 087; no runtime code and no SQL.
- Manual UI PASS on Task `PMV2-20260913-P6-T14`: `needs_material -> waiting_material`, then another Item remained executable, then `needs_ticket -> waiting_ticket`.
- Mixed Task status correctly remained `waiting_material`, confirming **materials before ticket** priority.
- Live DB PASS: Task `105`, Items `439/440`, `submit_result` Item Actions `6/8`, saved notes, performer `19110028`.
- Audit PASS: `pmv2.item_result_submitted` rows `7235641/7235643` for entities `439/440` by technician `19110028`.
- No Material Request/Ticket/Inventory/Purchase integration was activated.
- Step 3.3 basic result outcomes (`ok | fixed | needs_material | needs_ticket`) are now **CLOSED / PASS**. Phase 3 remains IN PROGRESS; Visit ending and remaining Phase 3 core work are still pending.



## Patch 089 — Phase 3 Step 3.4 Visit ending — CODE-READY / MANUAL ACCEPTANCE PENDING (2026-09-13)
- Phase 2 remains **CLOSED / PASS**; its two explicitly skipped runtime checks remain SKIPPED and were not rerun.
- Phase 3 remains **IN PROGRESS**. Steps 3.1, 3.2, and 3.3 basic outcomes remain CLOSED/PASS.
- Added active-Visit state read for the selected technician Task, still scoped by active Team membership.
- Added `endVisit` as a technician write boundary. The Task row is locked, exactly one open Visit is required, and the current user must be the recorded Visit Leader and an active member of the Task team.
- Visit ending is blocked while any Task Item is still `in_progress`; the technician must submit that Item result first.
- Successful ending sets only `pmv2_visits.endedAt`, then records same-transaction `pmv2.visit_ended` Audit. Task status and Task Item status/result are not forced or rewritten.
- Repeated Visit ending is rejected because no open Visit remains. A later pending Item can start a new Follow-up Visit through the existing Step 3.2 path.
- UI shows **إنهاء الزيارة** only to the current Visit Leader; it is disabled while an Item is `in_progress`. Non-leader members receive no end action.
- No SQL/schema change. No Material Request/Ticket/Inventory/Purchase integration.
- Focused Phase 3 tests = **43/43 PASS**; changed TS/TSX syntax transpile = **5/5 PASS**. Full dependency-based project typecheck is not recorded in this packaged workspace.
- Step 3.4 runtime/manual acceptance is **PENDING**.


## Patch 090 — Phase 3 Step 3.4 manual acceptance closure (2026-09-13)
- Documentation-only acceptance checkpoint for Patch 089.
- Manual UI confirmed Leader-only Visit ending on Task `PMV2-20260913-P6-T14` without forcing Task/Item state changes.
- Live DB confirmed Visit `2` / Task `105` ended at `2026-09-13 11:42:05`.
- Audit confirmed `pmv2.visit_ended` row `7235645` for Visit `2` by user `19110028`.
- Step 3.4 is now **CLOSED / PASS**. Phase 3 remains IN PROGRESS.
- No runtime code, SQL/schema change, or Phase 4 external workflow integration in Patch 090.


## Patch 091 — Phase 3 Step 3.5 optional execution evidence (2026-09-13)
- Added optional image evidence to `مهامي اليوم` without a new DB table.
- Reused the current upload/storage + generic `attachments` service; PM V2 evidence is stored as `pmv2_item_action` attachments, so it remains tied to the immutable execution event instead of duplicating the image on Task Item.
- Added a PM V2 evidence authorization boundary: active Team membership for technician reads; manager review reads; writes only to the logged-in technician's own Item Action while its Visit remains open.
- Added per-Item evidence read aggregation across all Item Actions and image thumbnails in the mobile/tablet technician surface.
- PM V2 attachment registration is image-only for Step 3.5 and keeps the existing `add_attachment` Audit path.
- No SQL/schema change, no state transition change, and no Material/Ticket/Inventory/Purchase/Legacy PM workflow change.
- Focused Phase 3 regression **53/53 PASS**; syntax transpile **6/6 PASS**. Manual runtime acceptance pending.


## Patch 092 — Phase 3 Step 3.5 manual acceptance closure (2026-09-13)
- Documentation-only acceptance checkpoint for Patch 091.
- Manual UI confirmed image evidence upload, thumbnail rendering, and persistence after refresh on Task Item `437`.
- Live DB confirmed attachment `3000641` as `pmv2_item_action` evidence linked through Item Action `3` to Task Item `437`, uploaded by technician `19110028`.
- After Visit end, existing evidence remained readable while new upload was no longer offered.
- Audit confirmed the existing `add_attachment` path for the PM V2 evidence mutation.
- Step 3.5 is now **CLOSED / PASS**. Phase 3 remains **IN PROGRESS** for Core stabilization / acceptance-gate review.
- No runtime code, SQL/schema change, or Phase 4 external workflow integration in Patch 092.

## 2026-09-13 — Patch 093 — Phase 3 final acceptance closure

- Phase 3 is officially **CLOSED / PASS** after the accepted Step 3.1–3.5 sequence.
- Different-teammate same-Visit join manual runtime test is recorded **SKIPPED / ACCEPTED by user decision**, with focused automated coverage retained; it is not labeled manual PASS.
- Manual Mobile/Tablet responsive verification is **DEFERRED to final program acceptance (Phase 6)** and is not labeled PASS.
- No new runtime code, SQL, schema, or Phase 4 integration is introduced by this closure patch.
- **Phase 4 = READY / NOT STARTED** and must not start without an explicit user instruction.


## Patch 094 — Phase 4 Step 4.1 material intake — 2026-09-13
- Phase 4 started with the smallest material integration slice only.
- Added technician material selection (current catalog item + quantity + unit) for `waiting_material / needs_material` Task Items.
- Added read-only Team Warehouse availability adapter using current Inventory and current positive Lot balances when Lot tracking is enabled.
- Full Team-Warehouse availability returns an Inventory/Delivery handoff and creates no PM V2 Material Request.
- Zero/partial availability creates PM V2 Material Request rows for the shortage only with initial `waiting_warehouse` state and duplicate-active-request protection.
- Added material routing/request Audit without direct Inventory mutation.
- No Warehouse Transfer, Purchase Order, Ticket integration, Legacy PM modification, or SQL/schema change.
- Step 4.1 tests **15/15 PASS**; combined focused Phase 3 regression + Step 4.1 **68/68 PASS**; syntax **6/6 PASS**. Manual runtime acceptance pending.


## Patch 095 — Phase 4 Step 4.1 balance preview refinement — 2026-09-14
- Refined the technician material-intake UX before Step 4.1 acceptance.
- Catalog items now carry current read-only Team Warehouse availability and display the balance beside the material name.
- Selecting a material now shows **requested / available / shortage** before submit.
- The operational requirement may exceed Team Warehouse stock; PM V2 still requests only the shortage. Actual issue remains in the current Inventory/Delivery workflow and remains stock-limited there.
- Availability is server-rechecked during submit; the preview does not reserve or mutate stock.
- No Warehouse Transfer, PO, Ticket integration, Legacy PM change, or SQL/schema change.
- Focused Step 4.1 tests **18/18 PASS**; combined Phase 3 regression + Step 4.1 **71/71 PASS**; changed TS/TSX syntax **5/5 PASS**; Node test syntax PASS. Manual acceptance remains pending.


## Patch 096 — Phase 4 Step 4.1 open-task carry-over visibility correction — 2026-09-14
- Fixed technician execution continuity across calendar days: prior-date Tasks that are still non-final now remain visible instead of disappearing from the exact-today feed.
- Preserves original `dueDate`; no reschedule and no duplicate Task generation.
- Historical completed/cancelled Tasks are not carried forward; current-day behavior remains intact.
- `مهامي اليوم` now separates **مهام اليوم** and **مهام سابقة مفتوحة**, with the original due date visible on each card.
- Existing active Team membership authorization is unchanged.
- No SQL, Stock mutation, Material Request routing change, Warehouse Transfer, Purchase, Ticket, or Legacy PM change.
- Step 4.1 focused suite = **21/21 PASS**; combined Phase 3 regression + Step 4.1 = **74/74 PASS**; TS/TSX syntax = **2/2 PASS**; Node test syntax = **2/2 PASS**.
- Manual runtime acceptance remains pending on the known Task `PMV2-20260913-P6-T14`.


## Patch 097 — Phase 4 Step 4.1 unlisted-material intake (2026-09-14)
- Added technician fallback when the needed material is not present in the current Catalog selector.
- Unlisted material stores `catalogItemId = NULL` and the technician-entered `itemNameSnapshot`, quantity, and unit in the existing PM V2 Material Request schema.
- Full need is routed to `waiting_warehouse` because PM V2 cannot safely infer Team Warehouse stock without Catalog identity.
- No technician-side Catalog creation, no duplicate Master Data, no Stock mutation, and no SQL.
- Added normalized duplicate protection for active free-text needs and a visible **غير موجود في الدليل** label on saved requests.
- Automated: Step 4.1 **26/26 PASS**; Phase 3 regression + Step 4.1 **79/79 PASS**; changed TS/TSX syntax **3/3 PASS**. Manual acceptance remains pending.

## Patch 098 — Step 4.1 material intake post-submit cleanup (2026-09-14)
- Material Request success now clears and collapses the intake form, leaving the newly saved request visible instead of leaving a repeatable submit state.
- Added explicit **إضافة مادة أخرى** to reopen a clean form when another distinct material is genuinely required.
- Active duplicate Catalog materials are disabled and labeled **مطلوب بالفعل**; duplicate unlisted names show an immediate normalized-name warning.
- Existing server duplicate rejection remains unchanged/authoritative. No SQL, Inventory mutation, Transfer, PO, Ticket, or Legacy PM change.
- Automated: Step 4.1 **29/29 PASS**; Phase 3 + Step 4.1 regression **82/82 PASS**. Manual runtime acceptance pending.



## Patch 099 — Step 4.1 count-unit quantity integrity (2026-09-14)
- Fixed acceptance defect where fractional quantity such as `2.5 قطعة` was accepted by the generic positive-decimal rule.
- Added a shared PM V2 material quantity policy used by both technician UI and server write boundary.
- Count/package units require whole numbers; divisible/unknown units continue to permit valid decimals.
- UI displays the validation error and blocks submit; server independently rejects the same invalid quantity before routing/persistence.
- No SQL, Stock mutation, Transfer, Purchase, Ticket, or Legacy PM change.
- Automated: Step 4.1 **32/32 PASS**; Phase 3 + Step 4.1 regression **85/85 PASS**; syntax **3/3 PASS**. Manual runtime acceptance pending.


## Patch 100 — Step 4.1 persistent Team Warehouse ready-to-issue handoff (2026-09-14)
- Manual Patch 099 acceptance confirmed the full-stock decision itself is correct: stocked pen `2 requested / 5 available / 0 shortage`; submit created no PM V2 request; DB stayed at quantity `5`, request count `0`.
- Fixed the remaining UX/state gap: full-stock routing is now persisted as `pmv2_item_actions.action = material_route_decision` instead of living only in mutation response/toast state.
- Material state reconstructs latest Catalog route and technician UI renders **جاهز للصرف من مخزن الفريق** across Refresh.
- Successful full-stock routing clears/collapses intake. The same Catalog Item is marked/blocked as **جاهز للصرف**, while **إعادة التحقق من الرصيد** allows a fresh availability decision before physical issue.
- Material Request decisions also append a route decision, so a newer shortage decision can supersede an earlier ready-to-issue snapshot for the same Catalog Item.
- No SQL/schema, no stock reservation/mutation, no Transfer/PO/Ticket change, and no direct Material Usage row before actual Inventory/Delivery evidence.
- Automated: **35/35** Step 4.1, **88/88** combined Phase 3 + Step 4.1, syntax **2/2 PASS**.


## 2026-09-14 — Patch 101 — Phase 4 Step 4.1 final acceptance closure + Step 4.2 review
- Documentation-only patch. **Step 4.1 = CLOSED / PASS** after manual UI/DB acceptance of shortage intake, balance preview, carry-over, unlisted materials, duplicate UX/server guards, count-unit validation, full-stock no-request routing, persistent ready-to-issue handoff, and unchanged-stock recheck.
- Manual changed-stock recheck and dedicated partial-shortage runtime case are explicitly **SKIPPED / ACCEPTED**, not PASS.
- Retained automated evidence: Step 4.1 35/35; combined Phase 3 + Step 4.1 88/88; syntax 2/2. No Phase 2 rerun.
- Step 4.2 was reviewed only. Existing Warehouse Transfer remains authoritative (`inventory.transfers.createBatch`, QR/Lot/stock rules, transfer audit). First recommended runtime slice is a warehouse `waiting_warehouse` queue + read-only Main-Warehouse availability decision.
- No runtime code, SQL, Inventory mutation, Transfer, PO, Ticket, or Legacy PM change in Patch 101.


## 2026-09-14 — Patch 102 — Phase 4 Step 4.2A warehouse queue + Main-Warehouse availability
- Added a dedicated PM V2 warehouse work queue at `/scheduled-maintenance/warehouse-requests` for `warehouse | owner | admin`.
- Queue shows only `waiting_warehouse` Material Request Items with task/team/destination/material/quantity context.
- Added strict dynamic Main-Warehouse adapter resolution (exactly one active `type=main`) and read-only, Lot-aware Inventory availability checks.
- Added explicit outcomes for available/insufficient/unlisted plus Catalog/Inventory/unit integrity exceptions.
- No Warehouse Transfer, PO, PM V2 status mutation, Inventory/Stock mutation, Ticket, Legacy PM change, or SQL/schema.
- Verification: Step 4.2A **15/15 PASS**; combined Phase 3 + Step 4.1 + Step 4.2A **103/103 PASS**; changed TS/TSX syntax **14/14 PASS**.
- Step 4.2A remains **MANUAL ACCEPTANCE PENDING**.

## 2026-09-14 — Patch 103 — Step 4.2A Catalog operator identity UX
- Recorded Patch 102 manual queue acceptance as PASS; Step 4.2A functional scope is CLOSED/PASS.
- Replaced the warehouse-facing `Catalog #<database id>` presentation with the actual Catalog item code (`catalog_items.code`).
- Added current Catalog taxonomy path from `catalog_nodes` to each listed material card.
- Catalog Master Data remains external/read-only through the PM V2 adapter; no taxonomy copy or PM V2 persistence was introduced.
- Unlisted material remains explicitly unlisted with no fake code/category.
- No SQL/schema, Warehouse Transfer, PO, Inventory mutation, PM V2 request-state mutation, Ticket, or Legacy PM change.
- Verification: Step 4.2A **18/18 PASS**; combined Phase 3 + Step 4.1 + Step 4.2A **106/106 PASS**; targeted TS/TSX syntax **3/3 PASS**.

## 2026-09-14 — Patch 104 — Step 4.2B contract freeze
- Documentation-only checkpoint before Warehouse Transfer integration.
- Recorded Patch 103 visual smoke as PASS and Step 4.2A as CLOSED/PASS.
- Froze Step 4.2B to existing Main→Team Warehouse Transfer only; partial transfer is allowed and any remainder stays on the same PM V2 Material Request Item.
- PM V2 counts supply only after a confirmed real Transfer and may aggregate multiple confirmed Transfers for one need.
- Purchase/PO/Receiving remain deferred.
- Frozen future purchase rule: purchasing more than the PM V2 shortage is allowed; only the shortage-linked quantity belongs to PM V2 and excess remains general stock.
- No runtime files, SQL, schema, Inventory, Purchase, Ticket, or Legacy PM behavior changed.


## 2026-09-14 — Patch 105 — Step 4.2B Warehouse Transfer handoff
- Added **بدء تحويل المتاح** from the PM V2 warehouse queue after a fresh server-side availability/remaining check.
- Reuses the existing Warehouse Transfer page/engine; Main source, Team destination, exact source Inventory, and PM V2 quantity cap are carried as handoff context. Existing QR/Lot/stock/audit behavior remains authoritative.
- Added read-only Warehouse Transfer adapter and PM V2 confirmation endpoint that accepts only already-created successful transfer numbers and validates their route/Catalog/unit.
- Confirmed Transfers are traced in `pmv2_item_actions` as `material_transfer_linked`; `issuedToTeamQuantity` and status are projected from unique real Transfers only. Partial remains `waiting_warehouse`; full becomes `issued_to_team`.
- Added stale-context protection after a physical transfer and a safe PM V2 link-retry path that does not repeat stock movement.
- No Purchase/PO/Receiving, no new table, and no SQL/schema change.
- Verification: Step 4.2B **25/25 PASS**; combined focused regression **131/131 PASS**; changed TS/TSX syntax **7/7 PASS**. Manual runtime acceptance pending.

## 2026-09-14 — Patch 106 — deferred technician material-picker UX contract
- Documentation-only: recorded the agreed post-4.2B improvement for the technician Catalog picker.
- Future no-search state should be a smart operational list rather than the first arbitrary Catalog page, prioritizing Team-Warehouse stock and evidence-based relevance where available.
- Full active-Catalog search remains available by name/item code; results should expose item code, taxonomy path, and Team-Warehouse balance.
- Specialty-based ranking/filtering is permitted only through explicit existing Master Data mapping; no inferred/duplicated mapping.
- Step 4.2B manual acceptance remains in progress. No runtime or SQL/schema change.


## 2026-09-14 — Patch 107 — Step 4.2B warehouse quantity-context clarification
- Fixed an operator-facing ambiguity found during manual 4.2B testing: the shortage-only Material Request quantity was labeled as if it were the technician's original need.
- Warehouse queue now reads the existing Step 4.1 `material_route_decision` action snapshot and exposes total task need plus Team-Warehouse availability at decision time.
- Card labels now separate **احتياج المهمة**, **المتاح في مخزن الفريق وقت الطلب**, **المطلوب من المستودع الرئيسي**, and **المتبقي للتحويل**; current Main availability remains separate.
- Legacy requests without a usable snapshot show unknown snapshot fields as `—` rather than fabricated values.
- Manual partial-shortage evidence upgraded from previously skipped to PASS: `6 needed / 5 Team / 1 Main request`. Positive Main handoff visibility also PASS (`89 Main / 1 transferable`).
- No SQL/schema/stock mutation/Purchase behavior change. Step 4.2B physical Transfer acceptance remains pending.
- Verification: Step 4.2B **25/25 PASS**; combined focused regression **131/131 PASS**.


## 2026-09-16 — Patch 108 — Step 4.2B final manual acceptance closure
- Closed **Step 4.2B = PASS** after successful real Main→Team Warehouse Transfer and final DB linkage verification.
- Test Batch/header: `TRB-2026-090001`; PM V2-linked transfer row: `TRF-2026-090001`; Lot: `LOT-2026-00315`; quantity: `1`.
- Final projection verified `linkedQuantity = 1`, `requestedQuantity = 1`, `issuedToTeamQuantity = 1`, `status = issued_to_team`.
- Clarified identifier semantics only: `TRB` is the batch/header number; `TRF` is the per-transfer row identity consumed by the PM V2 adapter/link.
- Documentation-only closure; no runtime code, SQL/schema, stock mutation, or Purchase/PO/Receiving implementation.


## 2026-09-16 — Patch 109 — Team-Warehouse Issue/Delivery linkage
- Added optional PM V2 context to the existing Inventory **تسليم للفني** workflow; no parallel stock-issue workflow was created.
- PM V2 now derives full task material remaining from persisted route decisions + real usage trace, validates the actual task-team technician, then links the already-posted Delivery Document into `pmv2_material_usages`.
- Preserved source attribution for partial-shortage cases: a Delivery of `6` after `5` original Team stock + `1` PM V2 shortage is traced as `5` general Team stock + `1` request-linked usage, not `6` against the shortage request.
- Material Request `consumed` and Task Item `ready_to_complete` are now evidence-driven by actual Delivery usage.
- Added link-only retry when physical issue succeeds but PM V2 projection fails.
- No SQL/schema, Purchase/PO/Receiving, Ticket, Legacy PM, or Phase 5 technician-resume implementation.
- Verification: focused **27/27 PASS**; combined focused regression **158/158 PASS**; changed syntax **7/7 PASS**.

## 2026-09-16 — Patch 110 — Programmatic PM V2 issue, actual use, and warehouse return
- Replaced Patch 109's manual PM V2 matching in generic Inventory delivery with a PM V2-driven ready-to-issue queue.
- Server resolves the task requirement, locked issue quantity, Team Warehouse inventory, beneficiary target, and automatic Lot split; warehouse staff normally only review/choose the actual recipient and confirm.
- The requesting technician is defaulted; another active technician from the same Team may receive. Delivery evidence records the actual recipient while the original requester/requirement remains traceable.
- Added explicit `Issued / Used / To Return / Returned` lifecycle. Technician completion asks only for actual used quantity; unused quantity becomes a pending return rather than silently reappearing in stock.
- Warehouse return confirmation restores the exact original Lot through the existing recipient-return workflow. Single-Lot return is automatic; multi-Lot return is allocated only among original issue Lots.
- Added persistent link-only recovery when a physical Delivery posts but PM V2 linking fails, preventing duplicate stock issue.
- No SQL/schema and no Purchase/PO/Receiving. Current live return documents are integer-quantity only, so fractional pending returns are blocked explicitly.
- Focused regression: **155/155 PASS**. Manual runtime acceptance pending.


## 2026-09-19 — Patch 111 — Preserve explicit Visit closure after completed prior Task
- Fixed the technician-feed gap found during real Patch 110 acceptance: a prior-due Task that became `completed` could disappear while its Visit was still open, removing the Leader's **إنهاء الزيارة** action.
- Completed carry-over Tasks now remain visible only while an open Visit exists; after the Leader ends the Visit, the normal refetch removes the Task.
- Added a simple completed/open-Visit message for Leader/non-Leader users; no extra screen was added.
- Task completion semantics and Leader-only explicit Visit closure remain unchanged; no automatic Visit end or Task reopening.
- No SQL/schema, Inventory mutation, Purchase/PO/Receiving, Ticket, Legacy PM, or handoff-file change.
- Verification: targeted regression **53/53 PASS**; broad PM V2 comparison keeps the same **18 baseline failures** (untouched **251/269**, Patch 111 **254/272**); changed TS/TSX syntax transpile **2/2 PASS**. `npm run build` cannot complete in this attached source snapshot (`vite: not found` because `node_modules` is absent); rerun the production build in the real project after applying.


## 2026-09-19 — Patch 112 — Simpler technician material search/selection
- Replaced the two-step **search field + separate dropdown** in `Pmv2MyTasks` with one searchable combobox.
- Technician now clicks one control and types material name/item code; server-backed Catalog matches appear immediately in the same list.
- Each result shows operational item identity and Team-Warehouse balance while preserving duplicate/ready blocking.
- Existing Step 4.1 business behavior is unchanged: quantity validation, availability preview, shortage routing, persistent ready-to-issue handoff, and unlisted-material fallback all remain intact.
- No server/API/schema/SQL, Inventory mutation, Purchase/PO/Receiving, Ticket, Legacy PM, or handoff change.
- Verification: focused **39/39 PASS**; broad PM V2 **258/276 PASS with the same 18 baseline failures**; changed TSX syntax **1/1 PASS**.
- Patch 111 manual runtime retest and real-project production build were both confirmed **PASS** before this UX patch.


## 2026-09-19 — Patch 113 — Shorter technician material-submit label
- Renamed the catalog-material action from **تحقق من التوفر وسجّل الاحتياج** to **تسجيل الاحتياج** after runtime UX review.
- Availability preview and server-side availability recheck are unchanged; this is a wording-only UX simplification.
- Pending-state and unlisted-material wording remain unchanged.
- No server/API/schema/SQL, Inventory mutation, Purchase/PO/Receiving, Ticket, Legacy PM, or handoff change.
- Verification: focused **40/40 PASS**; broad PM V2 **259/277 PASS with the same 18 baseline failures**; changed TSX syntax **1/1 PASS**.

## Patch 114 — Technician self-service receipt from Team Warehouse (2026-09-19)

- Removed the routine warehouse-user bottleneck when a PM V2 material need is fully available in the maintenance Team Warehouse.
- Technician now receives full-stock material through **استلام المواد من مخزن الفريق** with a small confirmation; the existing Inventory/Delivery workflow remains the physical stock Source of Truth and records the technician as recipient.
- Partial-stock needs do not issue partially by default. PM V2 records the total need and requests only the shortage; after replenishment, the technician receives the full remaining need in one action.
- Added technician ready-receipt projection for both original Team stock and replenished shortage routes.
- Automatic Lot/Multi-Lot allocation, issue costing, retry/relink safety, actual consumption, and Pending Return are preserved.
- No SQL/schema and no Purchase/PO implementation.
- Automated: **74/74 focused PASS**; broad PM V2 **266/284 PASS** with unchanged 18 baseline failures; syntax **5/5 PASS**. Production build must be run on the real project after patch application.

## 2026-09-19 — Patch 115 — Warehouse shortage clarity + Purchase handoff
- Corrected the runtime defect found after Patch 114 partial-shortage acceptance: warehouse no longer sees a waiting shortage as if it should issue the full task need.
- Warehouse card now distinguishes task need, Team-Warehouse snapshot, shortage request, remaining shortage, and live Main-Warehouse stock.
- Main can cover the shortage → handoff to existing Warehouse Transfer for the whole shortage. Main cannot cover → handoff to existing Purchase Order page for only the currently uncovered amount.
- PM V2 does not own PO creation/approval/receiving; it stores only the existing frozen PO/PO-Item link and caps linked quantity so purchase overage remains general stock.
- Confirmed Warehouse Receipt truth is read when calculating remaining in-flight purchase coverage.
- Shortage-routed full needs stay out of ready issue/receipt until the shortage reaches Team Warehouse; Patch 114 technician self-service then resumes.
- No SQL/schema and no Legacy PM changes.
- Verification: focused **120/120 PASS**; broad PM V2 **277/295 PASS with unchanged 18 baseline failures**; changed-file syntax **10/10 PASS**. Real-project production build pending after patch application.

## 2026-09-19 — Patch 116 — Auto-fill PM V2 Purchase unit from existing Master Data
- Fixed the Patch 115 runtime UX defect where the existing Purchase Order page opened with the correct PM V2 item/quantity but a blank disabled Unit field.
- PM V2 now resolves the active Catalog Unit and passes its stable ID plus canonical unit name into the existing Purchase page.
- Purchase locks the PM V2-bound Unit only when resolution succeeds; otherwise it leaves the field editable and requires an explicit active-unit selection before save/submit.
- Arabic/English names that belong to the same Catalog Unit are treated as equivalent during PO-item linking.
- No SQL/schema, no new Purchase workflow, no Master Data duplication, and no change to approval/receiving/transfer/self-service/consumption/return behavior.
- Verification: focused **90/90 PASS**; broad PM V2 **282/300 PASS with unchanged 18 baseline failures**; changed-file syntax **3/3 PASS**. Real-project production build **PASS**, and manual Unit prefill check **PASS** (`PIECE / قطعة`).

## 2026-09-19 — Patch 117 — PM V2-linked Purchase single-item/reference mode
- Added an explicit **مرتبط بمهمة صيانة مجدولة PM V2** reference block to the existing Purchase form when launched from a PM V2 shortage.
- The block exposes the maintenance task, shortage reason, linked item, task need, Team-Warehouse snapshot, exact quantity to purchase, and PM V2 material-request references.
- PM V2-linked Purchase now allows exactly one bound Catalog item and fixes its quantity to the shortage handed off by PM V2; unrelated items cannot be added to the same request.
- The generic **إضافة** action remains unchanged for every ordinary Purchase request outside PM V2 linked mode.
- Patch 116 unit prefill/fallback remains intact, and all normal Purchase approvals, PO processing, receiving, and Inventory entry remain in the existing Purchase workflow.
- No SQL/schema, no new Purchase workflow, no Master Data duplication, and no Legacy PM change.
- Verification: focused **29/29 PASS**; broad PM V2 **288/306 PASS with unchanged 18 baseline failures**; changed TSX syntax **2/2 PASS**. Real-project production build pending after patch application.


## 2026-09-19 — Patch 118 — Purchase Unit Master-Data precedence
- Fixed the runtime case where a PM V2-linked Purchase stayed blank for Unit even though the linked Catalog Item already had an active unit in Master Data.
- Root cause: the Purchase handoff could stop at an older PM V2 operational unit snapshot (for example `حبة`) and fail to continue to the current Catalog Item unit (for example `PIECE / قطعة`).
- Unit resolution now checks the current Catalog Item Master Data first, then current Main-Warehouse Inventory unit, then the PM V2 snapshot as fallback; successful resolution still passes the stable Catalog Unit ID into the existing Purchase form.
- PO-item linking now validates against the same resolved Catalog Item unit, so a canonical Purchase unit is not rejected merely because an older PM V2 snapshot used a different free-text label.
- Patch 117 single-item/reference mode is unchanged; ordinary Purchase requests remain unchanged. No SQL/schema, no new Purchase workflow, no Master Data duplication, and no Legacy PM change.
- Verification: focused Patch 114–118 regression **75/75 PASS**; broad PM V2 **291/309 PASS with unchanged 18 baseline failures**; changed TypeScript syntax **1/1 PASS**. Real-project production build pending after patch application.

## 2026-09-19 — Patch 119 — Manual Purchase unit fallback + existing PO relink
- Corrected the runtime edge case exposed after submitting the Duracell PM V2 Purchase: the Purchase Order was created successfully, but PM V2 linking rejected the manually selected active unit because it was compared against the older PM V2 free-text snapshot (`حبة`).
- Catalog Item → active Catalog Unit is now the only authoritative Purchase-unit lock. Inventory/PM V2 unit text remains operational context only and does not silently create a Master Data relationship.
- If the Catalog Item has no active unit linkage, the buyer must select an active Purchase unit manually; that unit is accepted for that PO Item only and is **not** written back to Catalog/Master Data.
- If the Catalog Item does have an active unit linkage, the existing strict unit-identity check remains in force.
- Purchase Order Detail now recognizes the standard PM V2 material-request reference already stored in the created order notes and exposes **ربط / إعادة ربط PM V2**. This calls the existing idempotent link endpoint only and never creates another Purchase Order.
- Patch 117 one-shortage/one-item behavior and the existing Purchase approval/PO/Receiving workflow remain unchanged. No SQL/schema, Master Data mutation, new Purchase workflow, or Legacy PM change.
- Verification: focused Patch 115–119/warehouse regression **72/72 PASS**; broad PM V2 **295/313 PASS with the same 18 baseline failures**; changed TS/TSX syntax **3/3 PASS**. Real-project production build pending after patch application.


## 2026-09-22 — Patches 124–129 — Warehouse Multi-Issue (WIS) closure

- Added standalone **الصرف المخزني المتعدد** with its own WIS numbering, history, Documents Center presence, open/print flow, and multi-material grid.
- Added Site/Section/optional Asset beneficiary context and print visibility.
- Restricted WIS to multi-line use only; existing four single-issue screens remain unchanged.
- Added safe repeated-Lot behavior for different beneficiary targets while blocking identical duplicates and cumulative over-issue.
- Runtime acceptance completed with `WIS-2026-000004` and final print verification.
- **Status: CLOSED / PASS.** No further WIS blocker remains before returning to Phase 4 Unlisted-material work.

## 2026-09-24 — Patch 134 — Persistent technician material attention
- Added **مواد تحتاج انتباهك** above the technician task feed so material dependencies remain visible even when many maintenance tasks exist.
- Attention cards preserve unresolved identity / warehouse / purchase / transfer states and prioritize **جاهزة للاستلام من مخزن الفريق**.
- The requesting technician can open the linked task or use the existing Team-Warehouse self-service receipt from the persistent card after confirmation.
- Unlisted-material pre-resolution history is not duplicated after warehouse identity resolution; only the resolved operational route remains actionable.
- Attention is scoped to the material requester and drops after the request is consumed/cancelled or after receipt leaves no action pending.
- No SQL/schema and no new Inventory/Purchase stock workflow.
- Verification: Patch 134 focused **6/6 PASS**; later baseline comparison confirmed the Patch 134 files in `eggt5.zip` are byte-for-byte identical to the original package.

## 2026-09-24 — Patch 135 — Material shortage integrity
- Extended technician duplicate blocking to include a Catalog identity resolved later by the warehouse, closing the gap for originally unlisted material.
- Technician attention now shows **النقص عند التسجيل**, **المتبقي من النقص**, Main-Warehouse received quantity, and Team-Warehouse transferred quantity.
- Remaining shortage is derived from the original shortage minus confirmed quantity issued into Team Warehouse; a fully supplied shortage no longer remains displayed as outstanding.
- Kept the existing true-shortage routing logic unchanged and locked it with regression tests: full Team stock creates no request, partial stock creates only the shortage, and identity resolution rechecks live Team stock.
- No SQL/schema and no Purchase/Transfer/Inventory workflow rewrite.
- Verification: Patch 135 **7/7 PASS**; focused Patches 114/115/131/134/135 **39/39 PASS**; broad PM V2 **322/341 PASS with the same 19 baseline failures**. Build/check remains unverified in this execution environment because dependencies were unavailable.

## 2026-09-24 — Patch 136 — Warehouse request page organization
- Reorganized `/scheduled-maintenance/warehouse-requests` without deleting any existing information, action, status, or recovery path.
- Added one **ملخص عمل المستودع** surface for Main Warehouse, waiting requests, ready issue, and pending returns.
- Moved **طلبات تحتاج معالجة المستودع** to the first operational section, followed by ready issue and returns.
- Grouped waiting-request details into **الكميات**, **المخزون والوجهة**, **تفاصيل الطلب والحالة**, linked purchases, and **الإجراء**.
- Preserved identity resolution, Transfer/Purchase handoffs, issue/relink, Lot handling, recipient selection, returns, and the PM V2 stock-ownership notice.
- No server/API/business logic/SQL/schema change.
- Verification: focused Patches 134/135/136 **20/20 PASS**; PATCH136 TSX syntax transpile **PASS**; production build not verified because dependencies are absent from the source snapshot.

## 2026-09-24 — Patch 137 — Warehouse tabs + progressive details

- Simplified `/scheduled-maintenance/warehouse-requests` without removing any existing content or capability.
- Converted the three existing warehouse work areas into **تحتاج معالجة / جاهزة للصرف / المرتجعات** tabs; only the selected queue is visible at once and **تحتاج معالجة** is the default.
- Kept the existing summary surface and live counts.
- Made waiting, ready-to-issue, and return cards compact by default; the same detailed content/actions are available through **عرض التفاصيل...** and can be collapsed again.
- Preserved all identity resolution, shortage quantities, Main/Team Warehouse context, linked Purchase information, Transfer/Purchase handoffs, issue/relink, recipient, Lot, return, and PM V2 ownership-note behavior.
- No server/API/business-logic/SQL/schema change.
- Focused Patches 134/135/136/137: **27/27 PASS**; Patch 137 TSX syntax: **PASS**; broad PM V2: **336/355 PASS, 19 fail**, with the same 19 failing test names as Patch 136 and no new broad-suite failure.

## 2026-09-26 — Patch 138 — Task continuation + responsibility timeline

- Added **استكمال العمل** for material-dependent Items that became `ready_to_complete` after an earlier daily Visit ended.
- Continuation remains on the same PM V2 Task; it reuses or creates a Visit for that same Task and records `resume_execution`.
- Resumed material work still uses the existing usage/return settlement and final `fixed` completion path.
- Added a PM V2 read-only Timeline over PM V2 Material/Purchase/Ticket source records, including current action owner, assigned person when available, stage times and full event history.
- Purchase stages distinguish maintenance review, delegate, accounting, senior management and warehouse; Ticket history remains sourced from the existing Ticket workflow.
- The UI reports duration/responsibility but does not label any role/person late until an SLA is defined.
- No SQL/schema and no external Inventory/Purchase/Ticket business-logic change.
- Verification: Patch 138 **9/9 PASS**; focused **99/99 PASS**; broad **345/364 PASS, 19 fail** vs baseline **336/355 PASS, 19 fail** with identical failure names and **0 new failures**; runtime syntax **PASS**.

## 2026-09-26 — PATCH139 — Management monitoring, owner indicators, SLA and alerts

- Added **متابعة المعلق** to Scheduled Maintenance management.
- Managers can see current blocking reason/stage, responsible role/person, elapsed current-responsibility time, task age and configured SLA state.
- Owner/Admin sees executive PM V2 indicators for bottlenecks, people, teams and assets with open tasks.
- Added configurable PM V2 SLA/reminder rules; no stage is called late until its SLA is explicitly configured.
- Added deduplicated responsibility/reminder/SLA notifications through the existing notification service.
- Added a PM V2-scoped five-minute alert sweep without modifying global job logic.
- Added two PM V2-only tables: `pmv2_sla_rules`, `pmv2_alert_deliveries`.
- Migration: `drizzle/2026_09_26_pmv2_monitoring_sla_alerts.sql`.
- No external Purchase/Ticket/Inventory workflow mutation.

## 2026-09-26 — PATCH140 — Manager pending-work priority UI

- Reorganized **متابعة المعلق** around the manager's daily decision order rather than a wide task table.
- Added the focused summary: **المهام المعلقة / تحتاج تدخلك الآن / تجاوز SLA / أقدم تعليق**.
- `تحتاج تدخلك الآن` contains only tasks currently owned by Maintenance Manager or explicitly over configured SLA.
- Split open work into **تحتاج تدخلك الآن** and **معلقة وتحت الإجراء** compact cards.
- Preserved reason, current stage, current role/person, elapsed responsibility time, task age, SLA and Timeline drill-down.
- Preserved all PATCH139 filters, owner indicators, SLA/reminder settings and alert sweep; advanced controls are progressively disclosed to reduce clutter.
- No backend/API/SQL/schema or external workflow change.
- Verification: PATCH140 **6/6 PASS**; PATCH139+140 **16/16 PASS**; broad **361/380 PASS, 19 fail** with the same 19 baseline failures and **0 new failures**; TSX syntax **PASS**.

## 2026-09-26 — PATCH141 — تقارير الصيانة المجدولة اليومية

- Added a separate PM V2 management page: **تقارير الصيانة المجدولة** at `/scheduled-maintenance/reports`.
- Daily comparison shows **المكلف اليوم / المنجز / بدأ ومعلق / لم يبدأ / المرحل / نسبة الإنجاز**.
- Each task shows actual participants, visit times and **ملاحظات الفني** directly on the task card.
- Open work shows its current blocking stage, responsible role/person and elapsed current responsibility using PATCH138 Timeline source truth.
- Full task Timeline is available from the report without creating another workflow or copying external states.
- Technician filter is deliberately honest about PM V2's team-level assignment model: it compares team tasks with the selected technician's actual Visit/Action participation rather than inventing a per-technician assignment.
- Tasks with an unclosed Visit are explicitly flagged.
- No SQL/schema and no Purchase/Inventory/Ticket/Accounting workflow change.
- Verification: PATCH141 **7/7 PASS**; PATCH138–141 **32/32 PASS**; broad **368/387 PASS, 19 fail** vs PATCH140 **361/380 PASS, 19 fail** with identical failures and **0 new failures**; changed TS/TSX syntax **PASS**.

## 2026-09-26 — PATCH142 — Report review + management indicators
- Added maintenance-manager review state for each team's daily Scheduled Maintenance report.
- Stores reviewer, timestamp and optional management note; review can be cleared/re-recorded.
- Added PM V2-only table `pmv2_daily_report_reviews` and migration `drizzle/2026_09_26_pmv2_daily_report_reviews.sql`.
- Added open workload indicators by specialty/status and average current responsibility duration by role.
- Added last-30-days scheduled completion counts/rates by specialty and team.
- SLA numeric values remain unset until explicitly configured by Operations.
- No Purchase/Inventory/Ticket/Accounting/Legacy PM workflow mutation.
- Verification: PATCH138–142 focused **39/39 PASS**; broad **375/394 PASS, 19 fail** vs PATCH141 **368/387 PASS, 19 fail**, therefore **0 new broad-suite failures**; changed source syntax **PASS**. Runtime/UAT remains deferred.

## 2026-09-26 — PATCH143 — Smart technician material picker
- Implemented the deferred smart default list for technician material selection.
- Current Team-Warehouse stock ranks first; real same-target and Team PM V2 usage history adds evidence-based relevance.
- Full active-Catalog search by name/code remains unrestricted.
- Result identity includes Catalog code, taxonomy path, current Team-Warehouse balance and a visible relevance label when applicable.
- Existing duplicate protections remain unchanged.
- No SQL/schema or external workflow mutation.
- Verification: PATCH143 **5/5 PASS**; focused **114/114 PASS**; broad **380/399 PASS, 19 fail**, identical 19 to PATCH142 baseline and **0 new failures**; syntax **PASS**.
