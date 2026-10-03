# PM V2 — Handoff Checkpoint

> **AUTHORITATIVE LATEST STATE — 2026-09-16 / Patch 109:** Phase 0 CLOSED/PASS; Phase 1 CLOSED/PASS; Phase 2 CLOSED/PASS; **Phase 3 CLOSED/PASS (final acceptance)**; **Phase 4 IN PROGRESS — Step 4.1 CLOSED/PASS; Step 4.2A CLOSED/PASS; Step 4.2B CLOSED/PASS; Team-Warehouse Issue/Delivery linkage CODE IMPLEMENTED / MANUAL ACCEPTANCE PENDING**. Step 4.1 changed-stock recheck remains SKIPPED/ACCEPTED by user decision; the partial-shortage runtime case was later executed and is PASS. Mobile/Tablet manual verification remains DEFERRED to final program acceptance (Phase 6).

## Historical checkpoints below

## Phase 2 CLOSED / PASS checkpoint — 2026-09-08

- Step 2.1 Checklists/Items = PASS.
- Step 2.2 Recurrence/Due = PASS.
- Step 2.3 Programs/Targets = PASS.
- Step 2.4 Scheduler/Task generation/Idempotency/Snapshots = PASS.
- Scheduler contract 7/7 PASS; in-memory runtime rerun simulation 5/5 PASS; Phase 2 acceptance gate 6/6 PASS.
- PM V2 standalone Node test files = 21/21 PASS.
- Patch isolation = PASS; Legacy PM workflow untouched.
- **Official next point:** Phase 3 — تنفيذ الفني للمهمات — READY / NOT STARTED. Do not start automatically.


## Phase 2 Step 2.3 checkpoint — 2026-09-08

- Programs/Program Targets runtime management = **PASS**.
- Existing Site/Section/Asset validation remains Adapter-owned.
- No duplicate Master Data and no Legacy PM dependency.
- Step 2.3 standalone contract = 5/5 PASS.
- **Next:** Step 2.4 Scheduler + Task generation + Idempotency + Snapshots.


## Phase 2 Step 2.2 checkpoint — 2026-09-08

- Recurrence/Due calculator = **PASS** للتكرارات الستة.
- Date-only deterministic؛ لا timezone dependence.
- Disabled item never due.
- End-of-month clamp موثق ومختبر.
- Step 2.2 standalone recurrence contract = 6/6 PASS.
- **Next:** Step 2.3 Programs + Program Targets runtime management.


## Phase 2 current checkpoint — 2026-09-08

- Step 2.1 Reusable Checklists + Checklist Items CRUD = **PASS**.
- API: `pmv2.checklists` registered Additive داخل PM V2 namespace.
- Mutations audited through shared CMMS audit log.
- Item writes reuse `validatePmv2ChecklistItemWrite`; TiDB CHECK remains intentionally not relied upon.
- Soft activation/deactivation only; no hard delete of checklist history.
- Standalone Step 2.1 = 6/6 PASS; all PM V2 Node test files = 16/16 PASS.
- No SQL in Step 2.1.
- **Official next point:** Step 2.2 Recurrence semantics + Due calculation. Do not start Scheduler before due calculation contract/tests pass.

## Detailed baseline / continuation record

> **التاريخ:** 2026-09-13  
> **الحالة الحالية:** Phase 0 CLOSED / PASS. Phase 1 CLOSED / PASS. Phase 2 CLOSED / PASS. **Phase 3 CLOSED / PASS — final acceptance after Patch 093. Phase 4 IN PROGRESS — Step 4.1 code-ready / manual acceptance pending after Patch 094.** Different-teammate Visit join manual runtime test = SKIPPED/ACCEPTED by user decision; Mobile/Tablet manual verification = DEFERRED to final program acceptance (Phase 6), not PASS.

## 1. نقطة التوقف الدقيقة

لا يوجد Reality Check أو ERD item مفتوح.

**Phase 1 CLOSED / PASS. Phase 2 CLOSED / PASS. Phase 3 CLOSED / PASS (final acceptance, Patch 093). Phase 4 IN PROGRESS — Step 4.1 code-ready / manual acceptance pending (Patch 094).**

نفذ المستخدم DDL لـ`pmv2_checklist_items` في DB Step 5، وأعاد TiDB تحذيرات لأن `tidb_enable_check_constraint` = OFF. تم اعتماد Service Validation بدل تفعيل الإعداد GLOBAL، وحذف `CHECK` من baseline التنفيذي. ثم أكد `SHOW CREATE TABLE` وجود الجدول والـFK الداخلي والـIndexes الأساسية وعدم وجود `CHECK` في البنية الفعلية. DB Step 5 = **PASS**.

## 2. العقود النهائية

- Architecture: Bounded Module داخل CMMS.
- Organization: `Specialty → Team → Members`.
- Targets: `Site | Section | Asset`.
- Technician results: `ok | fixed | needs_material | needs_ticket`.
- Task Item: `pending | in_progress | waiting_material | waiting_ticket | ready_to_complete | completed`.
- Task: `pending | in_progress | waiting_material | waiting_ticket | ready_to_complete | completed | cancelled`.
- Material Request Item: `waiting_warehouse | external_purchase | received_warehouse | issued_to_team | consumed | cancelled`.
- Purchase Link: `pmv2_material_purchase_links`.
- Ticket Link: `pmv2_task_ticket_links`.
- Material Request Header بلا Status مستقل.
- PO الناتج من PM V2 عادي بالكامل ويستخدم Purchase Workflow الحالي.
- Ticket الناتج من PM V2 عادي ويستخدم A/B/C الحالية.
- Material Recipient يثبت عند التسليم الفعلي بواسطة المستودع.

## 3. ERD

`15_FINAL_ERD_FREEZE.md` هو المرجع النهائي للTables/Cardinality/constraints والسياسة الخارجية.

## 4. قواعد الاستئناف

- المرحلة 1 بدأت بالفعل بعد أمر المستخدم الصريح بتاريخ 2026-09-07.
- كل DB action يبقى SQL يدويًا واحدًا في كل مرة؛ لا يرسل SQL schema التالي قبل نتيجة المستخدم.
- لا تعديل Workflow قائم.
- بعد كل خطوة تحديث Documentation + Patch ZIP.
- «أجب عليا» = نقاش فقط.
- «ذكرني لاحقًا» = `pending/PENDING_ITEMS.md` فورًا.

## 5. الهدف التنفيذي الحالي

إكمال Foundation Schema تدريجيًا طبقًا للERD المجمد مع الحفاظ على حدود الملكية. Organization (`Specialty → Team → Members`) وقراءة/Validation أهداف `Site | Section | Asset` أصبحت موجودة في PM V2 عبر Adapters، دون تعديل Master Data أو Workflows الحالية.

## Phase 1 runtime checkpoint — 2026-09-07

- DB Step 1 `pmv2_specialties` = PASS.
- DB Step 2 `pmv2_teams` = PASS.
- DB Step 3 `pmv2_team_members` = PASS.
- DB Step 4 `pmv2_checklists` = PASS.
- DB Step 5 `pmv2_checklist_items` = PASS بعد Structure Readback.
- DB Step 6 `pmv2_programs` = PASS (`Query OK`, 0 rows affected).
- DB Step 7 `pmv2_program_targets` = PASS (`Query OK`, 0 rows affected).
- DB Step 8 `pmv2_tasks` = PASS (`Query OK`, 0 rows affected).
- DB Step 9 `pmv2_task_items` = PASS (`Query OK`, 0 rows affected).
- DB Step 10 `pmv2_visits` = PASS (`Query OK`, 0 rows affected).
- DB Step 11 `pmv2_visit_members` = PASS (`Query OK`, 0 rows affected).
- DB Step 12 `pmv2_item_actions` = PASS (`Query OK`, 0 rows affected).
- DB Step 13 `pmv2_material_requests` = PASS (`Query OK`, 0 rows affected).
- DB Step 14 `pmv2_material_request_items` = PASS (`Query OK`, 0 rows affected).
- DB Step 15 `pmv2_material_purchase_links` = PASS (`Query OK`, 0 rows affected).
- DB Step 16 `pmv2_task_ticket_links` = PASS (`Query OK`, 0 rows affected).
- DB Step 17 `pmv2_material_usages` = PASS (`Query OK`, 0 rows affected).
- DB Step 18 `pmv2_request_reminders` = PASS (`Query OK`, 0 rows affected).
- Organization/Target static contract checks = PASS.
- Checklist Item service validation test = PASS (5/5)؛ لا اعتماد على TiDB `CHECK` في baseline الحالية.
- Standalone PM V2 Node tests = PASS 63/63.
- Standalone Phase 1 acceptance gate = PASS 6/6.
- Syntax/relative-import-path gate = PASS.
- Production build على المشروع الكامل اكتمل؛ Full Vitest أظهر Baseline failures خارج PM V2 موثقة كـ`PEND-001` في `pending/PENDING_ITEMS.md`.
- PM V2 standalone tests = 63/63 PASS وPhase 1 standalone gate = 6/6 PASS.
- **Phase 1 = CLOSED / PASS** على نطاق PM V2.
- لا يوجد SQL Schema آخر للمرحلة 1. **تاريخيًا عند هذا checkpoint** كانت نقطة الاستئناف Phase 2 READY / NOT STARTED؛ وقد استُبدلت الآن بالحالة الحالية: **Phase 2 CLOSED / PASS، Phase 3 READY / NOT STARTED**.


## Update — 2026-09-08 — DB Step 8 PASS / DB Step 9 READY

- `pmv2_tasks` تم إنشاؤه يدويًا بواسطة المستخدم: **PASS** (`Query OK`, 0 rows affected).
- نقطة الاستئناف التالية: DB Step 9 `pmv2_task_items` فقط.
- لا Scheduler/Task generation/Technician execution يتم تشغيله في هذه الخطوة؛ هي Schema foundation فقط.
- `pmv2_task_items` يعتمد فقط على FKs داخلية إلى `pmv2_tasks` و`pmv2_checklist_items`.
- UNIQUE `(taskId, sourceChecklistItemId, scheduledDate)` هو حاجز منع duplicate generation داخل المهمة.


## Update — 2026-09-08 — DB Step 9 PASS / DB Step 10 READY

- `pmv2_task_items` تم إنشاؤه يدويًا بواسطة المستخدم: **PASS** (`Query OK`, 0 rows affected).
- نقطة الاستئناف التالية: DB Step 10 `pmv2_visits` فقط.
- Visit header يربط بالمهمة ويحفظ وقت البدء/الانتهاء فقط؛ أعضاء الزيارة والقائد يظلون في `pmv2_visit_members`.
- إنهاء Visit لا يغلق Task تلقائيًا.


## Update — 2026-09-08 — DB Step 10 PASS / DB Step 11 READY

- `pmv2_visits` تم إنشاؤه يدويًا بواسطة المستخدم: **PASS** (`Query OK`, 0 rows affected).
- نقطة الاستئناف التالية: DB Step 11 `pmv2_visit_members` فقط.
- Visit Member يربط الزيارة بالمستخدم الحالي عبر External Reference مفهرس بلا FK إلى `users`.
- UNIQUE `(visitId, userId)` يمنع تكرار نفس العضو في الزيارة.
- `isLeader` يحفظ علامة القائد؛ قواعد التشغيل الفعلية للLeader/Members تبقى للمرحلة 3.


## Update — 2026-09-08 — DB Step 11 PASS / DB Step 12 READY

- `pmv2_visit_members` تم إنشاؤه يدويًا بواسطة المستخدم: **PASS** (`Query OK`, 0 rows affected).
- نقطة الاستئناف التالية: DB Step 12 `pmv2_item_actions` فقط.
- Item Action يربط Task Item + Visit ويخزن action/result/note ومنفذ الإجراء.
- `performedById` External Reference مفهرس بلا FK إلى `users`.
- الأدلة/الصور تستخدم Attachment service الحالية، ولا يتم إنشاء Attachment storage موازٍ.
- تشغيل الفني وتغيير الحالات يبقيان للمرحلة 3.


## Update — 2026-09-08 — DB Step 12 PASS / DB Step 13 READY

- `pmv2_item_actions` تم إنشاؤه يدويًا بواسطة المستخدم: **PASS** (`Query OK`, 0 rows affected).
- نقطة الاستئناف التالية: DB Step 13 `pmv2_material_requests` فقط.
- Material Request Header لا يملك Status مستقلًا؛ الحالة التشغيلية ستشتق من البنود.
- `requestedById` و`teamWarehouseId` مراجع خارجية مفهرسة بلا FK خارجي.
- لا يتم تشغيل Material/Inventory/Purchase workflow في هذه الخطوة؛ هي Schema foundation فقط.


## Update — 2026-09-08 — DB Step 13 PASS / DB Step 14 READY

- `pmv2_material_requests` تم إنشاؤه يدويًا بواسطة المستخدم: **PASS** (`Query OK`, 0 rows affected).
- نقطة الاستئناف التالية: DB Step 14 `pmv2_material_request_items` فقط.
- Material Request Item يحتفظ بالمادة/الاسم/الكمية والحالة وكميات الاستلام والصرف التجميعية.
- `catalogItemId` External Reference مفهرس بلا FK إلى `catalog_items`.
- لا خصم مخزون ولا Purchase write؛ هذه Schema foundation فقط.
- Quantity invariants تفرض في PM V2 write boundary بسبب عدم تفعيل TiDB CHECK constraints.


## Update — 2026-09-08 — DB Step 14 PASS / DB Step 15 READY

- `pmv2_material_request_items` تم إنشاؤه يدويًا بواسطة المستخدم: **PASS** (`Query OK`, 0 rows affected).
- نقطة الاستئناف التالية: DB Step 15 `pmv2_material_purchase_links` فقط.
- الرابط يحفظ Source Link من Material Request Item إلى PO/PO Item الحاليين، ولا ينشئ Purchase Workflow موازيًا.
- `purchaseOrderId`, `purchaseOrderItemId`, `createdById` مراجع خارجية مفهرسة بلا Physical FK.
- `purchaseOrderItemId` UNIQUE داخل Link table، والكمية المرتبطة تتحقق في PM V2 write boundary.
- لا يتم تخزين حالة PO داخل PM V2؛ Purchase Workflow الحالي يبقى Source of Truth.


## Update — 2026-09-08 — DB Step 15 PASS / DB Step 16 READY

- `pmv2_material_purchase_links` تم إنشاؤه يدويًا بواسطة المستخدم: **PASS** (`Query OK`, 0 rows affected).
- نقطة الاستئناف التالية: DB Step 16 `pmv2_task_ticket_links` فقط.
- الرابط الجديد يحفظ مصدر Ticket من Task Item فقط، ولا ينسخ `taskId` أو Ticket status أو maintenance path.
- `ticketId` و`createdById` مراجع خارجية مفهرسة بلا Physical FK؛ `ticketId` UNIQUE في Link table.
- لا يتم إنشاء أو تعديل Ticket Workflow في هذه الخطوة؛ A/B/C الحالية تبقى مملوكة للنظام القائم.


## Update — 2026-09-08 — DB Step 16 PASS / DB Step 17 READY

- `pmv2_task_ticket_links` تم إنشاؤه يدويًا بواسطة المستخدم: **PASS** (`Query OK`, 0 rows affected).
- نقطة الاستئناف التالية: DB Step 17 `pmv2_material_usages` فقط.
- Material Usage يسجل Trace/Audit للاستهلاك ولا يخصم المخزون مباشرة.
- `materialRequestItemId` nullable إذا كانت المادة موجودة أصلًا في مخزن الفريق ولم ينشأ Material Request.
- Inventory/Delivery/Warehouse/Catalog/PO Item/User references تبقى External References مفهرسة بلا Physical FK.
- تشغيل الاستهلاك الفعلي يبقى للمرحلة 4 عبر الخدمات الحالية.


## Update — 2026-09-08 — DB Step 17 PASS / DB Step 18 READY

- `pmv2_material_usages` تم إنشاؤه يدويًا بواسطة المستخدم: **PASS** (`Query OK`, 0 rows affected).
- نقطة الاستئناف التالية: DB Step 18 `pmv2_request_reminders` فقط — آخر جدول في Final ERD.
- Reality Check أكد وجود Notification infrastructure حالية؛ Request Reminder يبقى Trace مرتبطًا بالطلب ويعيد استخدام الخدمة الحالية.
- لا Notification status/title/message/Scheduler موازٍ داخل PM V2.
- بعد runtime PASS للخطوة 18: تنفيذ Acceptance Gate للمرحلة 1، ولا تبدأ المرحلة 2 قبل نجاحه.


## Update — 2026-09-08 — DB Step 18 PASS / Phase 1 Gate (historical checkpoint)

- `pmv2_request_reminders` تم إنشاؤه يدويًا بواسطة المستخدم: **PASS** (`Query OK`, 0 rows affected).
- جميع جداول Final ERD الثمانية عشر أصبحت منفذة.
- Standalone PM V2 Node suite: **63/63 PASS**.
- Standalone Phase 1 acceptance gate: **6/6 PASS**.
- فحص Syntax ومسارات الاستيراد النسبية: **PASS**.
- مقارنة نظيفة مع baseline (بعد دمج إصلاح Warehouse Item Receipt في الطرفين) تثبت أن PM V2 لم تعدل ملفات Legacy PM/Ticket/Purchase/Inventory workflows؛ الملفات المشتركة المعدلة فقط هي `drizzle/schema.ts` و`server/routers/index.ts` بصورة Additive.
- في هذه النقطة التاريخية لم تكتمل فحوص المشروع العامة في بيئة المساعد. لاحقًا نفذ المستخدم Full Vitest/Build، وعُزلت الأعطال غير التابعة لـPM V2 في `PEND-001`.
- **هذا checkpoint تاريخي ومُستبدل. الحالة الحالية:** Phase 1 = `CLOSED / PASS`، Phase 2 = `CLOSED / PASS`، Phase 3 = `READY / NOT STARTED`.
- **لا تبدأ Phase 2 تلقائيًا**؛ يلزم أمر المستخدم الصريح.

## Checkpoint — 2026-09-08 — Scheduled Maintenance UI ready for manual Phase 1–2 verification

- نقطة الدخول الجديدة في السايدبار: **الصيانة المجدولة**.
- URL: `/scheduled-maintenance`.
- Legacy PM يبقى على `/preventive` ولم يُعدّل.
- المستخدم يستطيع الآن يدويًا اختبار: Specialties/Teams/Members، Checklists/Recurrence، Programs/Targets، ثم تشغيل Scheduler لتاريخ محدد ومشاهدة Tasks/Task Items المولدة.
- إعادة تشغيل Scheduler لنفس التاريخ متاحة لاختبار idempotency من الواجهة.
- المهام في الواجهة Read-only؛ Phase 3 technician execution غير مفعّل.
- Standalone PM V2 regression: **71/71 PASS**.
- الحالة الرسمية لا تتغير: Phase 1 = CLOSED/PASS، Phase 2 = CLOSED/PASS، Phase 3 = READY/NOT STARTED.

### Latest checkpoint — 2026-09-08 manual acceptance regression
- Phase 1: CLOSED / PASS.
- Phase 2: CLOSED / PASS.
- Manual acceptance found and fixed scheduler generation under a disabled Specialty.
- Scheduler now requires Program, Specialty, Team, Checklist, and Checklist Item eligibility as applicable.
- No SQL is required for this fix.
- Phase 3 remains READY / NOT STARTED.

### Latest checkpoint — 2026-09-09 — Patch 058
The apparent 2026-09-21 biweekly failure was traced to manual-test flow, not recurrence logic: filtering `كل المهام` to a date does not change or execute the separate manual scheduler date. Exact runtime regression proves that rerunning existing 2026-09-21 tasks after adding `فحص كل أسبوعين` backfills one due item per target. The UI now makes this separation explicit and can copy a one-day search filter to the scheduler date. Next manual step: filter 2026-09-21, click **استخدام تاريخ البحث**, run scheduler once, then open `PMV2-20260921-P1-T1`; expected historical list includes `فحص كل أسبوعين`. Phase 3 remains NOT STARTED.

### 2026-09-09 — Patch 059 checkpoint
- User approved adding recurrence provenance beside each historical task item before continuing Phase 2 manual acceptance tests.
- Patch 059 adds structured recurrence snapshots to new `pmv2_task_items` and compact Arabic recurrence badges in the management UI.
- One additive PM V2 DB ALTER is required manually before applying/running the code patch.
- Pre-patch rows use source-checklist fallback for display; post-patch generated rows carry authoritative recurrence snapshots.
- Resume point after DB + patch: open the known 2026-09-21 task and confirm labels such as `يومي`, `أسبوعي • الاثنين`, and `كل أسبوعين • الاثنين`, then continue the duplicate-target manual test.

### 2026-09-09 — Patch 060 checkpoint
- User manually confirmed the Patch 059 ALTER succeeded (`Query OK`).
- A fresh 2026-10-05 scheduler run created `2` tasks and `12` task items, proving generation succeeded.
- Historical-item display then failed because `server/pmv2/tasks/read-service.ts` used `pmv2ChecklistItems` in its join/fallback expressions without importing it.
- Patch 060 fixes that import and adds a regression guard. No SQL.
- Resume manual acceptance by opening an already-created `PMV2-20261005-*` task after applying Patch 060; do **not** rerun scheduler first. Expected: task items display with recurrence badges.

### Patch 061 checkpoint — 2026-09-09
- Manual test found `كل المهام` exact-date browsing could show zero for `2026-10-05` despite two existing tasks.
- Patch 061 uses exact same-day due-date matching, explicit date-filter refetch, and visible task-query errors.
- Next manual check: filter `2026-10-05` to `2026-10-05`; expect the two existing tasks without rerunning scheduler.

### Patch 062 checkpoint — 2026-09-09
- Manual acceptance confirmed backend duplicate-target protection works, then user requested a simpler UX: do not offer already-linked targets in the dropdown at all.
- Patch 062 filters Site/Section/Asset options against the selected program's current target list, refreshes immediately after linking, and clears stale selection when switching programs.
- Resume manual acceptance by selecting Program #1, choosing a target type, confirming already-linked targets are absent, then link one fresh target and confirm it disappears from that same selector.
- No SQL. Phase 3 remains NOT STARTED.

### Patch 063 checkpoint — 2026-09-09
- Manual acceptance proved `كل كم دورة = 0` and `-1` could be saved from the UI because the form silently clamped them to `1` before calling PM V2.
- Patch 063 removes that normalization and aligns UI validation with the existing service rule: integer `>= 1` only.
- Focused regression: 7/7 PASS. No SQL.
- Resume manual acceptance by attempting a fresh checklist item with `كل كم دورة = 0`; expected rejection with no created row. Then verify a negative value is also rejected. Existing test rows `12` and `13` should remain untouched until the regression is confirmed, then may be disabled manually.
- Phase 3 remains NOT STARTED.

## Checkpoint after Patch 064 preparation — 2026-09-09
- Current acceptance topic: checklist recurrence usability.
- Patch 064 redesign is prepared and tested locally.
- Database prerequisite: add `pmv2_checklist_items.scheduleConfigJson` and `pmv2_task_items.recurrenceLabelSnapshot` before applying Patch 064 files.
- Old recurrence data remains supported; no destructive cleanup or migration is required.
- Phase 3 must not start until the user explicitly requests it after Phase 1/2 acceptance testing finishes.


## Patch 065 checkpoint
Approved workload UX implementation has started. Current DB step: add `pmv2_programs.estimatedDurationMinutes`. Do not start Phase 3. Next steps after DB confirmation: program duration UI/service, daily team-load calculation, then the simple workload view.

### Patch 066 checkpoint
After Patch 065 DB success, the program edit UX was completed: selected programs now have a clear edit action and optional estimated duration. Next approved workload work remains daily team-load calculation and the simple `حمل الفرق` view. Do not start Phase 3 without explicit instruction.

### Patch 067 checkpoint — 2026-09-12
- Patch 066 manual acceptance is complete/PASS: readable duration conversion plus team/checklist historical protection were confirmed by the user.
- Implemented the next approved Phase 2 workload step: daily team-load calculation/status only.
- New read-only surface: `pmv2.tasks.dailyWorkload({ dateFrom, dateTo, teamId? })`.
- Aggregation = generated non-cancelled tasks grouped by team + due date, summing program `estimatedDurationMinutes`.
- Baseline statuses: `متاح` <=4h, `متوسط` >4h..6h, `مرتفع` >6h..8h, `تعارض` >8h.
- Missing estimates are reported explicitly (`unknownDurationTaskCount`, `estimateComplete=false`).
- No DB change and no visible workload screen yet.
- Resume point: implement the simple manager-facing **حمل الفرق** view on top of this endpoint, then manually verify one team/day cell. Do not start Phase 3.

### Patch 068 checkpoint — 2026-09-12
- Implemented the agreed simple manager-facing **حمل الفرق** view inside Phase 2.
- View is deliberately compact: current week by default, previous/current/next navigation, active teams × seven days, and one concise status cell per team/day.
- A populated cell shows task count + estimated duration + status; incomplete duration data is shown as `مدة ناقصة`.
- Clicking a populated cell opens a simple list of that team's non-cancelled tasks for the day.
- No SQL, no start/end-time conflict scheduling, no individual member allocation, and Phase 3 remains NOT STARTED.
- Resume point: manually open `الصيانة المجدولة → حمل الفرق` and verify the weekly matrix renders; then test one populated cell only after that passes.

### Patch 069 checkpoint — 2026-09-12
- User confirmed the workload page must remain simple but asked that it reflect daily operational reality inside the weekly view.
- Implemented current-week default focus on **today onward**, with optional **full week** review.
- Today is highlighted; elapsed current-week days are subdued in full-week mode; future days remain visually primary.
- Added one active-team filter only.
- Added a separate unfinished-overdue count. Overdue tasks remain on their original due date and are not automatically rolled into today's workload.
- No task rescheduling mutation was introduced, no SQL is required, and Phase 3 remains NOT STARTED.
- Resume point: manually open `الصيانة المجدولة → حمل الفرق` and verify that the current-week default starts with today's column and shows only today through Saturday. Give only that test first.

### Patch 070 checkpoint — 2026-09-12
- Patch 069 manual checks passed: today-onward default, full-week mode, team filter, and overdue alert all rendered as intended.
- User approved direct access from the overdue alert to the existing overdue task list.
- Implemented the alert as a navigation shortcut to `المهام المجدولة → المتأخرة`; selected workload team is carried into the destination filter.
- No rescheduling mutation, no SQL, and Phase 3 remains NOT STARTED.
- Resume point: manually click the overdue alert with `كل الفرق` selected and confirm the tasks tab opens with **المتأخرة** active. Give only that test first.


### Patch 071 checkpoint — 2026-09-12
- Patch 070 manual navigation passed for both `كل الفرق` and a selected team.
- Current workload UX is intentionally frozen for Phase 2 acceptance: weekly matrix, today-forward focus, full-week review, one team filter, separate overdue alert, direct overdue navigation.
- No additional manager-facing filter or automatic overdue rollover is approved/needed now.
- Documentation status is reconciled to **Phase 2 IN PROGRESS — final hardening/acceptance**; older `CLOSED/PASS` text is historical from the pre-hardening 2026-09-08 gate.
- Remaining manual workload test: click one populated team/day cell and confirm the detail panel lists the same team's tasks for that exact day (cancelled excluded).
- After that result, decide the final Phase 2 acceptance/closure explicitly. Do not start Phase 3 automatically.

### Patch 072 checkpoint — 2026-09-12 — cross-cutting auth session stability hotfix
- Patch 071 remaining workload-cell manual test is now PASS: a populated team/day cell showed that day's tasks correctly.
- Before the final Phase 2 acceptance decision, the user reported repeated application logout behavior.
- Root cause inspection found a cross-cutting auth weakness outside PM V2: transient `authenticateRequest()` dependency failures were collapsed to `user = null`, which could produce canonical `UNAUTHORIZED` and a client login redirect.
- Patch 072 separates definitive session failures from DB/OAuth dependency failures, prevents false `UNAUTHORIZED`, removes the per-request `lastSignedIn` write, hardens the client redirect condition, and shows a retry state when the auth check is temporarily unavailable.
- No SQL, no session-duration change, no permission change, and no Phase 3 work.
- Resume point: manually verify session stability first. Only after that PASS, return to the final Phase 2 acceptance/closure decision.

### Patch 073 checkpoint — 2026-09-12
- Patch 072 session-stability manual smoke test is PASS.
- User requested the selected team/day detail panel show each task's estimated duration so the daily workload total can be visually understood.
- Added `estimatedDurationMinutes` to the existing PM V2 task-list projection and rendered it as a compact readable duration in **مهام اليوم المختار**.
- Missing estimates render as `غير محددة`; no estimate is invented.
- No SQL, no workload threshold change, no automatic scheduling/rescheduling change, and Phase 3 remains NOT STARTED.
- Resume point: manually open one populated workload cell and confirm each listed task shows its estimated duration. Give only that test first.

### Patch 074 checkpoint — 2026-09-12
- `حمل الفرق` manual acceptance is complete for the agreed Phase 2 scope, and acceptance returned to the remaining Patch 064 recurrence checks.
- User created `اختبار أسبوعي متعدد الأيام` successfully, but noticed the checklist row displayed `0.` because the manager form exposed/sent the internal `sortOrder` default.
- User approved automatic manager ordering.
- Patch 074 removes the manual order field, leaves `sortOrder` assignment to the service for normal creates, starts empty checklists at `1`, and uses the next number after the highest existing checklist order.
- Manager list renders human ordinal positions starting at `1`, so pre-existing test rows with internal `0` no longer show a confusing zero without requiring data cleanup or SQL.
- No recurrence semantics, scheduler behavior, or historical task snapshots were changed.
- Resume point: open `قائمة صيانة اختبارية 2` and confirm the existing test item now displays as `1.` and the add form has no `الترتيب` input. Only after that PASS continue the previously planned `كل أسبوعين • الاثنين` manual recurrence test.
- Phase 2 remains final hardening/acceptance; Phase 3 remains NOT STARTED.

### Patch 075 checkpoint — 2026-09-12
- Patch 074 manual acceptance passed: the old visible `0.` now renders as `1.` and the manager-facing manual order field is gone.
- Remaining Patch 064 recurrence acceptance continued successfully through custom weekly multi-day, biweekly Monday, monthly multi-day, and monthly last-day item creation.
- During the monthly last-day check, the user noticed the add-item form retained the previous recurrence selections after a successful save.
- User approved a small UX correction before continuing acceptance.
- Patch 075 resets the entire checklist-item add form only after successful create, while preserving the selected checklist and the saved item list.
- No recurrence engine/scheduler semantics changed; no SQL; Phase 3 remains NOT STARTED.
- Resume point: save one non-default custom item and verify the form resets to blank title + normal monthly defaults without carrying the previous custom selection. Give only that manual test first.

### Patch 076 checkpoint — 2026-09-12
- Patch 075 manual reset acceptance passed.
- While continuing custom-quarter recurrence acceptance, the user correctly noted that wording such as `كرر كل 2 أرباع سنة` is too technical and does not explain that several execution dates may exist inside the repeating pattern.
- User approved applying the same manager-language rule consistently to days, weeks, months, quarters, and years.
- Patch 076 changes presentation only: `التكرار حسب`, `فترة التكرار`, live `المعنى`, multi-date guidance, and human interval labels (`2 quarters` → `كل 6 أشهر`).
- Client/server label formatters were aligned; recurrence engine/storage contracts are unchanged and no SQL is required.
- Existing historical label snapshots are preserved; only fallback/new labels use the improved wording.
- Resume point: manually test one custom quarterly item with interval `2`, confirm **المعنى: كل 6 أشهر**, add two appointments, and confirm the final preview lists both in plain Arabic. One test only; do not start Phase 3.


### Patch 077 checkpoint — 2026-09-12
- During annual custom-recurrence manual acceptance, the user reported that **فترة التكرار** remained unclear even after Patch 076.
- User approved a stronger simplification: manager recurrence is explained as two questions only.
- Patch 077 changes the custom form to **يتكرر الفحص كل [رقم] [وحدة]** + live **النتيجة**, followed by **متى يتم التنفيذ؟**.
- `التكرار حسب`, `فترة التكرار`, and `المعنى` are no longer shown in the custom manager form.
- Optional recurrence start wording is **يبدأ هذا النمط من**.
- Recurrence engine/storage remain unchanged; no SQL; Phase 3 remains NOT STARTED.
- Resume point: manually test one custom `2 × أسبوع` item and confirm the sentence/result + weekday section are immediately understandable. One test only.


### Patch 078 checkpoint — 2026-09-12
- During final Phase 2 recurrence acceptance, the user created Program #3 and requested a human program title.
- User manually executed the one SQL statement adding nullable `pmv2_programs.title VARCHAR(200)` and confirmed `Query OK`. Do not ask to run it again.
- Patch 078 wires the optional title through schema/service/router/create/edit/search/display. Untitled rows fall back to `برنامج #N`.
- Title is descriptive metadata and may be edited after generated tasks; the existing team/checklist history lock remains unchanged.
- Resume point: manually edit Program #3, set a title, save, and confirm title + program-number reference render correctly. One test only. Phase 3 remains NOT STARTED.
- Patch 078 automated verification: title focused 2/2 PASS; program contract 5/5 PASS; duration edit regression PASS; Scheduled Maintenance usability 6/6 PASS; changed TS/TSX syntax 4/4 PASS.

### Patch 079 checkpoint — 2026-09-12
- While preparing Scheduler runtime acceptance for titled Program #3, the user requested a safer manual-test workflow: choose date first, then run all due programs or one due program only.
- Patch 079 adds due-program discovery and optional selected-program execution to the **manual test panel only**.
- The dropdown intentionally lists only programs due on the chosen date, using production recurrence validation; automatic hourly scheduling remains global and unchanged.
- No SQL; Phase 2 remains final hardening/acceptance; Phase 3 remains NOT STARTED.
- Resume point: choose `2026-09-12` in the manual Scheduler panel, switch to **برنامج محدد**, and confirm titled Program #3 appears in the due-only dropdown. Do not run it until that selector check passes.


### Patch 080 final Phase 2 closure checkpoint — 2026-09-12
- User explicitly approved the final Phase 2 closure after completing the current acceptance path.
- **Authoritative status:** Phase 0 = CLOSED/PASS; Phase 1 = CLOSED/PASS; Phase 2 = **CLOSED/PASS (final acceptance)**; Phase 3 = **READY / NOT STARTED**.
- `حمل الفرق` is accepted for the current scope.
- Manager-friendly custom recurrence UX is accepted for the tested daily/weekly/monthly/annual scenarios.
- Optional Program #3 title and title search are manually PASS.
- Patch 079 selected due-program execution, all-due execution, generated-date visibility, and idempotent rerun are manually PASS.
- Explicitly skipped by user and **not marked PASS**:
  1. `كل 3 أيام` anchor-date Scheduler due/non-due runtime check.
  2. Multi-date custom-cycle Scheduler runtime check.
- No SQL in Patch 080 and no runtime code change.
- **Resume point:** do not reopen Phase 2 or start Phase 3 automatically. Wait for an explicit user instruction for the next phase/work item.


### Patch 081 checkpoint — 2026-09-13 — Phase 3 Step 3.1 implementation
- Phase 2 remains **CLOSED / PASS**. Do not rerun its two explicitly skipped runtime checks unless the user asks.
- Phase 3 is now **IN PROGRESS** because the user explicitly authorized implementation.
- Step 3.1 adds read-only technician access only: scoped technician permission, active team-membership enforcement, `pmv2.technician.today/items`, and mobile/tablet **مهامي اليوم**.
- Cross-team Task Item IDs are blocked server-side even if a user guesses an ID.
- No Visit, Visit Member, Item Action, Task/Task Item mutation, material, ticket, or purchase workflow was started.
- Snapshot repair included: `drizzle/schema.ts` now declares the already-existing Patch 078 `pmv2_programs.title`; **do not execute SQL for it again**.
- Automated focused verification: 6/6 PASS; changed-source TypeScript syntax transpile: 13/13 PASS. Full-project typecheck was unavailable because the supplied ZIP has no installed dependencies.
- Manual runtime acceptance was completed after Patch 081 and is recorded in Patch 082.

### Patch 082 checkpoint — 2026-09-13 — Phase 3 Step 3.1 CLOSED / PASS
- Clean runtime task: `PMV2-20260913-P5-T13` on `PMV2-TEAM-01`, with two due-today items.
- Active assigned technician saw the expected task, target/team, `0/2` progress, and both items = PASS.
- Unassigned technician saw 0 tasks = PASS.
- Disabling the assigned technician's team membership caused 0 tasks = PASS; membership was reactivated afterward.
- No Visit / Visit Member / Item Action / result submission / Task or Task Item mutation was started.
- Phase 2 remains CLOSED/PASS and its two explicitly skipped runtime checks remain SKIPPED.
- **Resume point:** Phase 3 remains IN PROGRESS. Review the official plan/current files and propose the next smallest technician-execution step; do not implement it without a new explicit execution instruction.

### Patch 083 checkpoint — 2026-09-13 — Phase 3 Step 3.2 code-ready
- Authoritative state: Phase 2 = CLOSED/PASS; Phase 3 = IN PROGRESS; Step 3.1 = CLOSED/PASS; Step 3.2 = **code-ready / manual runtime acceptance pending**.
- Technician pending items now have **بدء التنفيذ**.
- Start revalidates active team membership, runs inside one transaction, serializes on the Task row, and enforces one open Visit per Task at the PM V2 write boundary.
- New Visit creator = Leader. Active teammate starting another pending item while the Visit is open joins the same Visit as a Member.
- Start records `pmv2_item_actions.action = start_execution` and an existing-system `audit_logs` entry, then changes the started Item and pending Task to `in_progress`.
- No SQL/schema changes and no results/material/ticket/purchase/inventory/visit-close/task-close behavior.
- Automated focused Phase 3 checks = 14/14 PASS; syntax transpile = 4/4 PASS.
- **Resume point:** deploy Patch 083, then perform only the first manual test: assigned technician presses **بدء التنفيذ** on one pending item and confirms Item + Task become `قيد التنفيذ` while the other item remains pending. Do not proceed to result options yet.


### Patch 084 checkpoint — 2026-09-13 — Phase 3 Step 3.2 CLOSED / PASS
- Authoritative state: Phase 2 = CLOSED/PASS; Phase 3 = IN PROGRESS; Step 3.1 = CLOSED/PASS; Step 3.2 = **CLOSED / PASS**.
- Manual runtime UI acceptance:
  - Task `PMV2-20260913-P5-T13` Item `437` start -> Item + Task `in_progress`, Item `438` still pending = PASS.
  - Starting Item `438` -> both Items `in_progress`, Task remains `in_progress` = PASS.
- Live DB acceptance:
  - one open Visit only: Visit `1` / Task `104`, `endedAt = NULL`;
  - Visit Member `19110028` on Visit `1` with `isLeader = 1`;
  - Item Actions `start_execution` for Task Items `437` and `438`, both by `19110028`;
  - Audit actions `pmv2.item_start_execution` for `pmv2.task_item` entities `437` and `438`.
- The same technician started both test items. Single-open-Visit reuse is manually confirmed; different active teammate join/reuse was not separately manually exercised and remains covered by the focused automated contract.
- No SQL, no runtime code, no Legacy PM/Ticket/Purchase/Inventory changes in Patch 084.
- **Resume point:** Phase 3 result submission is NOT STARTED. Review the official Phase 3 plan/current files and propose the smallest next result step; do not implement it without a new explicit execution instruction.


### Patch 085 checkpoint — 2026-09-13 — Phase 3 Step 3.3 basic results code-ready
- Authoritative state: Phase 2 = CLOSED/PASS; Phase 3 = IN PROGRESS; Step 3.1 = CLOSED/PASS; Step 3.2 = CLOSED/PASS; Step 3.3 = **IN PROGRESS**.
- Technician can now submit only **سليم (`ok`)** or **تم الإصلاح (`fixed`)** for a Task Item already `in_progress`.
- The mutation revalidates active Team membership + exact Task/Item ownership, serializes on the Task row, requires exactly one open Visit, and can join an active teammate to that Visit.
- Result submission records `pmv2_item_actions.action = submit_result`, result, optional note, performer, and matching PM V2 Audit; the Item becomes `completed`.
- Cached Task status remains `in_progress` until all Items are complete; then it becomes `completed`. The open Visit is not ended by this slice.
- No SQL/schema change. No Legacy PM/Inventory/Purchase/Ticket workflow change. `needs_material` / `needs_ticket` remain NOT STARTED. Focused Phase 3 regression = **23/23 PASS**; syntax transpile = **3/3 PASS**.
- **Resume point:** deploy Patch 085 and run only the first manual test: on Task `PMV2-20260913-P5-T13`, submit **سليم** for Item `437` only and confirm Item completed/result `ok`, progress `1/2`, Task still `in_progress`, Item `438` still `in_progress`.


### Patch 086 checkpoint — 2026-09-13 — Phase 3 Step 3.3 basic `ok/fixed` slice CLOSED / PASS
- Authoritative state: Phase 2 = CLOSED/PASS; Phase 3 = IN PROGRESS; Step 3.1 = CLOSED/PASS; Step 3.2 = CLOSED/PASS; Step 3.3 = IN PROGRESS overall.
- The dependency-free Step 3.3 result slice **`ok | fixed` is CLOSED / PASS** after manual UI, live DB, and Audit verification.
- Runtime task: `PMV2-20260913-P5-T13` / Task `104`.
- Item `437`: `completed`, result `ok`, `submit_result` Action `3`, note `تم الفحص والحالة سليمة`, performer `19110028`.
- Item `438`: `completed`, result `fixed`, `submit_result` Action `4`, note `تم العثور على ملاحظة بسيطة وتم إصلاحها`, performer `19110028`.
- Task reached `completed` at `2/2`. Audit rows `7235627/7235628` use `pmv2.item_result_submitted` for entities `437/438`.
- Patch 086 contains documentation only; no SQL and no runtime change.
- **Resume point:** `needs_material` and `needs_ticket` remain NOT STARTED, as do Visit ending and external Inventory/Purchase/Ticket integrations. Review the official Phase 3 plan/current files and propose the smallest next slice; do not implement without explicit `نفذ الآن`.


### Patch 087 checkpoint — 2026-09-13 — Phase 3 Step 3.3B code-ready / manual acceptance pending
- Authoritative state: Phase 2 = CLOSED/PASS; Phase 3 = IN PROGRESS; Step 3.1 = CLOSED/PASS; Step 3.2 = CLOSED/PASS; Step 3.3A `ok/fixed` = CLOSED/PASS; Step 3.3B `needs_material/needs_ticket` = **CODE-READY / MANUAL ACCEPTANCE PENDING**.
- Technician UI now exposes all four frozen Core outcomes for `in_progress` Items.
- `needs_material` stores result + note and moves the Item to `waiting_material`; `needs_ticket` moves it to `waiting_ticket`. Both use the existing open Visit, `submit_result`, and `pmv2.item_result_submitted` Audit.
- Task projection priority for mixed dependencies is **waiting_material > waiting_ticket**; unrelated Items can continue execution while the summary is waiting.
- Patch 087 intentionally creates no real Material Request or Ticket and touches no Inventory/Purchase/Ticket workflow. No SQL. Visit ending remains NOT STARTED.
- Focused Phase 3 tests = **34/34 PASS**; TS/TSX syntax = **3/3 PASS**.
- **Resume point:** deploy Patch 087 and run only the first manual `needs_material` check documented in `09_TESTING.md`; stop before `needs_ticket` until that result is reported.

### Patch 088 checkpoint — 2026-09-13 — Phase 3 Step 3.3 basic outcomes CLOSED / PASS
- Authoritative state: Phase 2 = CLOSED/PASS; Phase 3 = IN PROGRESS; Step 3.1 = CLOSED/PASS; Step 3.2 = CLOSED/PASS; Step 3.3 basic outcomes (`ok | fixed | needs_material | needs_ticket`) = **CLOSED / PASS**.
- Patch 087 dependency outcomes were manually accepted on fresh Task `PMV2-20260913-P6-T14` / Task `105`.
- Item `439`: `waiting_material`, result `needs_material`, `submit_result` Action `6`, note `يحتاج مادة أو قطعة لاستكمال العمل`, performer `19110028`.
- Item `440`: `waiting_ticket`, result `needs_ticket`, `submit_result` Action `8`, note `يوجد تلف يحتاج بلاغ صيانة ومتابعة`, performer `19110028`.
- Task remained `waiting_material`, confirming mixed-state priority **waiting_material > waiting_ticket**; Item `440` could still be started while Item `439` waited for material.
- Audit rows `7235641/7235643` use `pmv2.item_result_submitted` for entities `439/440` by `19110028`.
- Patch 088 is documentation-only. No SQL. No Material Request or Ticket was created; external Inventory/Purchase/Ticket integration remains Phase 4.
- **Resume point:** Phase 3 remains IN PROGRESS. Review the official Phase 3 plan/current files and propose the smallest next Core step after basic result outcomes (not Phase 4 integration); do not implement without explicit `نفذ الآن`.



### Patch 089 checkpoint — 2026-09-13 — Phase 3 Step 3.4 Visit ending code-ready
- Authoritative state: Phase 2 = CLOSED/PASS; Phase 3 = IN PROGRESS; Steps 3.1/3.2/3.3 basic outcomes = CLOSED/PASS; Step 3.4 = **CODE-READY / MANUAL RUNTIME ACCEPTANCE PENDING**.
- The current open Visit can now be ended by its recorded Leader only; active Task-team membership is revalidated server-side.
- End Visit uses the same Task-row serialization boundary as Start/Result writes, requires exactly one open Visit, and refuses ending while any Item is `in_progress`.
- Successful end sets `pmv2_visits.endedAt` and writes `pmv2.visit_ended` Audit atomically. It does **not** rewrite Task status or Item status/result and does not close the Task.
- UI reads Visit/Leader state and exposes **إنهاء الزيارة** only to the Leader; the action is disabled until all currently `in_progress` Items have a result.
- No SQL/schema changes. No Material Request/Ticket/Inventory/Purchase integration. Focused Phase 3 tests = **43/43 PASS**; syntax transpile = **5/5 PASS**.
- **Resume point:** deploy Patch 089 and run only the first manual Visit-end UI check on `PMV2-20260913-P6-T14` documented in `09_TESTING.md`; do not mark Step 3.4 PASS until live DB/Audit verification is completed.


### Patch 090 checkpoint — 2026-09-13 — Phase 3 Step 3.4 Visit ending CLOSED / PASS
- Authoritative state: Phase 2 = CLOSED/PASS; Phase 3 = IN PROGRESS; Steps 3.1/3.2/3.3 basic outcomes/3.4 = **CLOSED / PASS**.
- Manual UI acceptance used Task `PMV2-20260913-P6-T14`; Leader technician ended the Visit after both Items had dependency results. Task remained `waiting_material`; Items remained `waiting_material` and `waiting_ticket`.
- Live DB: Visit `2`, Task `105`, `startedAt = 2026-09-13 10:59:05`, `endedAt = 2026-09-13 11:42:05`.
- Audit: row `7235645`, `pmv2.visit_ended`, `pmv2.visit` entity `2`, user `19110028`, `2026-09-13 11:42:05`.
- Patch 090 is documentation-only; no SQL and no runtime code. External Material/Ticket/Inventory/Purchase integration remains Phase 4.
- **Resume point:** inspect the official Phase 3 plan/current files and identify the next smallest remaining Phase 3 Core step. Do not start it without explicit execution instruction.


### Patch 091 checkpoint — 2026-09-13 — Phase 3 Step 3.5 execution evidence code-ready
- Authoritative state: Phase 2 = CLOSED/PASS; Phase 3 = IN PROGRESS; Steps 3.1/3.2/3.3 basic outcomes/3.4 = CLOSED/PASS; Step 3.5 = **CODE-READY / MANUAL RUNTIME ACCEPTANCE PENDING**.
- Optional execution images now reuse the existing `attachments` service/table and link to `pmv2_item_actions` using `entityType = pmv2_item_action`; no SQL or parallel storage.
- Technician evidence read rechecks active Task-Team membership and exact Task Item ownership. Upload additionally requires the same technician to own the target Item Action and its Visit to still be open. PM V2 management roles may read for review only.
- UI exposes **إضافة صورة / دليل** when a safe upload Item Action exists, uploads through existing `/api/upload`, registers through existing `attachments.add`, and renders all evidence for the Item.
- Existing attachment audit (`add_attachment`) remains the evidence mutation audit. No Task/Item status or result mutation and no Phase 4 integration.
- Focused Phase 3 tests = **53/53 PASS**; changed TS/TSX syntax = **6/6 PASS**.
- **Resume point:** deploy Patch 091 and run only the first manual image-upload/thumbnail check from `09_TESTING.md`; do not mark Step 3.5 PASS until DB and Audit verification are completed.


### Patch 092 checkpoint — 2026-09-13 — Phase 3 Step 3.5 execution evidence CLOSED / PASS
- Authoritative state: Phase 2 = CLOSED/PASS; Phase 3 = IN PROGRESS; Steps 3.1/3.2/3.3 basic outcomes/3.4/3.5 = **CLOSED / PASS**.
- Manual UI: one evidence image was uploaded by `pmv2tech01` to Item `437` on Task `PMV2-20260913-P5-T13`; the thumbnail rendered and remained after refresh.
- Live DB: attachment `3000641`, `entityType = pmv2_item_action`, Item Action `3`, Task Item `437`, uploader `19110028`.
- Post-Visit behavior: evidence stayed readable after Visit end; new evidence upload was no longer available.
- Audit: existing `add_attachment` event path confirmed for this PM V2 evidence write.
- Patch 092 is documentation-only; no SQL and no runtime code.
- **Resume point:** review the remaining Phase 3 Core stabilization / acceptance gate against the official plan and current files. Do not begin Phase 4 Material/Ticket/Inventory/Purchase integration automatically.

## Patch 093 checkpoint — 2026-09-13 — Phase 3 FINAL CLOSED / PASS

- Authoritative state: Phase 0 = CLOSED/PASS; Phase 1 = CLOSED/PASS; Phase 2 = CLOSED/PASS; **Phase 3 = CLOSED/PASS (final acceptance)**.
- Steps 3.1–3.5 are closed/pass on their accepted Core scopes.
- Different-active-teammate join/reuse in the same open Visit: **manual runtime test SKIPPED / ACCEPTED by explicit user decision**; focused automated coverage remains the evidence. Do not relabel it manual PASS.
- Mobile/Tablet responsive manual check: **DEFERRED TO FINAL PROGRAM ACCEPTANCE (Phase 6)** by explicit user decision; not PASS and not a Phase 3 blocker.
- Patch 093 is documentation-only: no runtime code, no SQL, no schema, no Material/Ticket/Inventory/Purchase integration.
- **Exact resume point:** Phase 4 = READY / NOT STARTED. Review Phase 4 scope/current files first and propose the first minimal Phase 4 step only. Do not execute Phase 4 without an explicit new **«نفذ الآن»** instruction.


## Patch 094 checkpoint — 2026-09-13 — Phase 4 Step 4.1 material intake code-ready
- Authoritative state: Phase 0–3 = CLOSED/PASS; **Phase 4 = IN PROGRESS**; Step 4.1 = **CODE-READY / MANUAL RUNTIME ACCEPTANCE PENDING**.
- Technician `waiting_material / needs_material` Items now expose material + quantity + unit intake using current active Catalog items.
- Team Warehouse availability is read-only through current Inventory/Lot data. Full availability creates no PM V2 Material Request and hands off to the current Inventory/Delivery workflow.
- Zero/partial availability creates PM V2 request rows for the shortage only with `waiting_warehouse` initial state and duplicate-active-request protection.
- No Stock mutation, Warehouse Transfer, PO, Ticket, Legacy PM change, or SQL/schema change.
- Focused Step 4.1 = **15/15 PASS**; combined Phase 3 regression + Step 4.1 = **68/68 PASS**; syntax = **6/6 PASS**.
- **Exact resume point:** apply Patch 094, restart runtime, then perform only the first manual UI presence check on Task `PMV2-20260913-P6-T14` / Item `439`. Do not submit the material need until that UI result is reported.


## Patch 095 checkpoint — 2026-09-14 — Phase 4 Step 4.1 balance-preview refinement code-ready
- Authoritative state: Phase 0–3 = CLOSED/PASS; **Phase 4 = IN PROGRESS**; Step 4.1 remains **CODE-READY / MANUAL RUNTIME ACCEPTANCE PENDING**.
- UX refinement requested during manual acceptance: show Team Warehouse balance beside each Catalog material and show **requested / available / shortage** before submit.
- Requirement quantity is not a direct issue transaction and may exceed the Team Warehouse balance. PM V2 requests the shortage only; actual issue remains in the existing Inventory/Delivery workflow and is stock-limited there.
- Availability is read-only, Lot-aware, task/team-scoped, and rechecked server-side at submit. No reservation or stock mutation.
- Prior live manual evidence: Request `#1` on Task Item `439`, Catalog Item `300042`, quantity `1111`, state `waiting_warehouse`, received `0`, issued `0`; Team Warehouse `30002` inventory lookup returned empty set.
- Automated: Step 4.1 = **18/18 PASS**; combined Phase 3 regression + Step 4.1 = **71/71 PASS**; changed TS/TSX syntax = **5/5 PASS**; Node test syntax = PASS.
- No SQL/schema change; no Warehouse Transfer, PO, Ticket integration, or Legacy PM change.
- **Exact resume point:** apply Patch 095 and perform only the balance-preview check on Task `PMV2-20260913-P6-T14` / Item `439`, selecting Catalog Item `300042`. Confirm balance `0` and requested/available/shortage preview; do not submit a duplicate request.


## Patch 096 checkpoint — 2026-09-14 — Step 4.1 technician open-task carry-over correction code-ready
- Authoritative state: Phase 0–3 = CLOSED/PASS; **Phase 4 = IN PROGRESS**; Step 4.1 remains **CODE-READY / MANUAL ACCEPTANCE PENDING**.
- Runtime acceptance discovered that the exact-today technician filter hid yesterday's still-open Task `PMV2-20260913-P6-T14` on 2026-09-14.
- Fix: technician feed now returns today's Tasks plus previous non-final Tasks; previous completed/cancelled Tasks do not carry forward. Original `dueDate` is never rewritten.
- UI groups carry-over work under **مهام سابقة مفتوحة** and displays the original due date. Active Team membership authorization is unchanged.
- No SQL/schema change; no Stock mutation, Warehouse Transfer, PO, Ticket, Material Request routing, or Legacy PM change.
- Automated: Step 4.1 = **21/21 PASS**; combined Phase 3 regression + Step 4.1 = **74/74 PASS**; syntax checks = PASS. Phase 2 tests were not rerun.
- **Exact resume point:** apply Patch 096, restart runtime, log in as `pmv2tech01`, and confirm `PMV2-20260913-P6-T14` appears under **مهام سابقة مفتوحة** with original due date 2026-09-13 and state `waiting_material`. Do not create another request.


## Patch 097 checkpoint — 2026-09-14 — Step 4.1 unlisted-material fallback code-ready
- Authoritative state: Phase 0–3 = CLOSED/PASS; **Phase 4 = IN PROGRESS**; Step 4.1 = **CODE-READY / MANUAL ACCEPTANCE PENDING**.
- Live acceptance already confirmed the carry-over Task is visible and the Team Warehouse balance preview works. During that acceptance, a missing-Catalog business case was identified.
- Patch 097 adds **مادة غير موجودة في الدليل**. Technician enters item name + quantity + unit; PM V2 creates no Catalog Master Data.
- Existing nullable `pmv2_material_request_items.catalogItemId` is reused: `NULL` + `itemNameSnapshot`, full need, `waiting_warehouse`. No SQL/schema change.
- Availability is intentionally **not checked/guessed** without Catalog identity; warehouse resolves/linkage later through current Catalog governance.
- Duplicate active free-text request with the same normalized name on the same Task Item is rejected.
- Automated: Step 4.1 **26/26 PASS**; combined Phase 3 regression + Step 4.1 **79/79 PASS**; syntax **3/3 PASS**. Phase 2 tests were not rerun.
- **Exact resume point:** apply Patch 097 and, on an existing `waiting_material` Item, open the unlisted-material path and verify the free-text form appears. Do not submit on the first manual check.

## Checkpoint after Patch 098 (2026-09-14)
- Phase 0–3 remain **CLOSED / PASS**. Phase 4 remains **IN PROGRESS**.
- Step 4.1 remains **MANUAL ACCEPTANCE PENDING**.
- Patch 097 unlisted-material creation was manually exercised and exposed a post-success UX issue: the populated form remained visible after Request creation.
- Patch 098 closes/clears the form after successful Material Request creation, shows saved requests, and requires explicit **إضافة مادة أخرى** for another need.
- Duplicate UX is now proactive: active Catalog requests are disabled/labeled and active unlisted duplicates warn by normalized name; existing server duplicate rejection remains authoritative.
- No SQL or external workflow transition. Automated Step 4.1 = **29/29 PASS**; combined Phase 3 + Step 4.1 = **82/82 PASS**.
- Next manual check: verify the existing saved requests appear with the intake form collapsed after deployment; do not create another duplicate request.



## Checkpoint after Patch 099 (2026-09-14)
- Phase 0–3 remain **CLOSED / PASS**. Phase 4 remains **IN PROGRESS**.
- Step 4.1 remains **CODE-READY / MANUAL ACCEPTANCE PENDING**.
- Patch 099 fixes fractional quantities for countable units: `2.5 قطعة` is invalid in both UI and server, while divisible/unknown units may remain decimal.
- Shared policy file: `shared/pmv2MaterialQuantity.ts`; server validation occurs before availability routing / request persistence.
- No SQL, Stock mutation, Transfer, PO, Ticket, or Legacy PM change.
- Automated: Step 4.1 **32/32 PASS**; combined Phase 3 + Step 4.1 **85/85 PASS**; changed TS/TSX syntax **3/3 PASS**.
- Exact manual resume point: re-open the stocked pen test in the existing `waiting_material` Item and enter `2.5 قطعة`; verify the whole-number error and blocked submit. Do not proceed to the full-stock route until that check passes.


## Checkpoint after Patch 100 (2026-09-14)
- Phase 0–3 remain **CLOSED / PASS**. Phase 4 remains **IN PROGRESS**. Step 4.1 remains **CODE-READY / MANUAL ACCEPTANCE PENDING**.
- Live Patch 099 acceptance: count-unit guard PASS; PRIMA pen availability preview `2 / 5 / 0` PASS; full-stock submit PASS; DB confirmed Team Warehouse quantity remained `5` and PM V2 request count for the pen remained `0`.
- Acceptance exposed one gap: full-stock success did not close the form or persist a ready-to-issue Domain state.
- Patch 100 adds `material_route_decision` Item Actions and restores latest route through `materialState`. Full-stock success now becomes a persistent **جاهز للصرف من مخزن الفريق** handoff, closes the entry form, blocks duplicate selection, and offers recheck.
- No SQL, no Inventory mutation/reservation, no Warehouse Transfer, PO, Ticket integration, or Legacy PM change.
- Automated: Step 4.1 **35/35 PASS**; combined Phase 3 + Step 4.1 **88/88 PASS**; changed TS/TSX syntax **2/2 PASS**.
- **Exact resume point:** apply Patch 100. On the existing carry-over Task/Item, add the stocked PRIMA pen again with `2 قطعة` and submit once. Confirm the form closes and **جاهز للصرف من مخزن الفريق** appears. Do not Refresh or recheck until that first result is reported.


## Checkpoint after Patch 101 (2026-09-14)
- Phase 0–3 remain **CLOSED / PASS**. Phase 4 remains **IN PROGRESS**.
- **Step 4.1 material intake = CLOSED / PASS.** Manual acceptance covered the zero-stock request route, balance/shortage preview, carry-over open Tasks, unlisted materials, duplicate protections, post-submit reset, count-unit integrity, full-stock no-request route, persistent `team_inventory` handoff after Refresh, and unchanged-stock recheck.
- Live DB anchors: Request `1` / Request Item `1` / Task Item `439` / Catalog `300042` = `waiting_warehouse`, requested `1111`, received/issued `0`; Team Warehouse `30002` held PRIMA Catalog `1140273` qty `5`, request count `0` for that Catalog; Item Action `30001` persisted requested `2`, available `5`, shortage `0`, no Material Request IDs.
- **SKIPPED / ACCEPTED (not manual PASS):** changed-stock recheck after a ready decision; dedicated partial-shortage runtime case. User explicitly chose to proceed.
- Automated evidence retained: Step 4.1 **35/35 PASS**, Phase 3 + Step 4.1 **88/88 PASS**, syntax **2/2 PASS**. Phase 2 tests not rerun.
- **Step 4.2 reviewed only; no runtime started.** Existing Warehouse Transfer is the source of truth (`inventory.transfers.createBatch`, warehouse permission, QR/Lot validation, stock mutation, transfer audit).
- First proposed Step 4.2 runtime slice: warehouse-facing `waiting_warehouse` queue + read-only Main-Warehouse availability decision, including explicit unlisted/Catalog-resolution state. No transfer/PO in that first slice.
- **Exact resume point:** review the proposed Step 4.2A scope with the user; do not implement until a new explicit `نفذ الآن`.


## Checkpoint after Patch 102 (2026-09-14)
- **Step 4.2A implemented / code-ready; manual runtime acceptance pending.**
- Warehouse surface: `/scheduled-maintenance/warehouse-requests`; roles `warehouse | owner | admin` only. It does not grant `/scheduled-maintenance` manager access or `/my-tasks` technician access.
- Reads only `waiting_warehouse` PM V2 Material Request Items and shows Task/Task Item/Team/Team Warehouse destination/material/quantity.
- Main Warehouse is resolved dynamically as exactly one active `type=main`, matching current receipt semantics; no hard-coded ID. Availability is read through the existing Lot-aware Inventory adapter.
- `catalogItemId = NULL` is displayed as unlisted; missing/inactive Catalog identity, ambiguous Inventory rows, and unit mismatch are explicit exceptions.
- Patch 102 has **no write path**: no Warehouse Transfer, PO, PM V2 status/projection update, Inventory mutation, Ticket, Legacy PM, or SQL.
- Automated: 15/15 Step 4.2A; 103/103 combined Phase 3 + Step 4.1 + Step 4.2A; syntax 14/14.
- **Exact resume point:** apply Patch 102, restart runtime, then run the single warehouse-role queue visibility check from `09_TESTING.md`. Do not execute a transfer yet.

## Checkpoint after Patch 103 (2026-09-14)
- Phase 0–3 remain **CLOSED / PASS**; Phase 4 remains **IN PROGRESS**; Step 4.1 = CLOSED/PASS.
- Patch 102 warehouse queue manual acceptance = **PASS**; **Step 4.2A = CLOSED / PASS** functionally.
- Before Step 4.2B, Patch 103 changes only operator-facing identity: listed materials show the actual Catalog item code plus the full Arabic Catalog taxonomy path; internal `catalogItemId` is hidden from normal UI.
- Source remains current Catalog Master Data through adapter reads; no duplicate Master Data, schema/SQL, Transfer, PO, stock mutation, request-state write, Ticket, or Legacy PM change.
- Automated: Step 4.2A **18/18**, combined Phase 3 + Step 4.1 + Step 4.2A **106/106**, targeted syntax **3/3**.
- **Exact resume point:** apply Patch 103 and run one visual smoke on the known listed warehouse request: verify **كود الصنف + التصنيف** are visible and `Catalog #<id>` is absent. Do not start Step 4.2B until this smoke is reported.

## Checkpoint after Patch 104 (2026-09-14)

- Patch 103 visual smoke = PASS; **Step 4.2A = CLOSED / PASS**.
- **Step 4.2B = READY / NOT STARTED**; no runtime code for it exists yet.
- 4.2B boundary: use existing Warehouse Transfer for current Main-Warehouse stock only; allow partial transfer; update PM V2 only after confirmed real Transfer; keep remainder on the same Material Request Item.
- No transfer when available = 0 or material is unlisted/unresolved.
- Purchase/PO/Receiving are deferred to a later Phase 4 slice.
- Future purchase rule: if PM V2 shortage is `4` and warehouse buys `20`, PM V2 links only `4`; the extra `16` is general inventory. Do not inflate PM V2 requested/used quantity with purchase overage.
- **Exact resume point:** discuss/implement the first Step 4.2B runtime slice only after a new explicit `نفذ الآن`. Do not start Purchase integration as part of 4.2B.


## Checkpoint after Patch 105 (2026-09-14)

- **Step 4.2B = CODE-READY / MANUAL ACCEPTANCE PENDING.**
- Warehouse queue calculates outstanding need and `transferableNow`, then `prepareTransferHandoff` performs a fresh server-side Main/Team/Catalog/unit/availability check before navigation.
- Existing Warehouse Transfer remains the sole physical movement path (`transfers.createBatch`, QR/Lot, stock validation/mutation, transfer audit). PM V2 handoff locks Main→Team route, exact source Inventory, and maximum PM V2 quantity across Lot rows.
- After successful real transfer rows exist, PM V2 reads them through a new read-only adapter, validates route/Catalog/unit, traces unique links as `pmv2.item action material_transfer_linked`, and projects `issuedToTeamQuantity`. Partial => `waiting_warehouse`; full => `issued_to_team`.
- Same Transfer cannot satisfy another PM V2 request; same-request retry is idempotent. After stock moves, stale handoff is frozen and requires return-to-queue recheck. If projection fails, retry linking only.
- No Purchase/PO/Receiving, no new table, no SQL/schema.
- Automated: **25/25 Step 4.2B**, **131/131 combined focused regression**, **7/7 syntax**.
- **Exact resume point:** apply Patch 105, restart runtime, then perform only the first manual 4.2B queue/handoff visibility check from `09_TESTING.md`. Do not execute a physical Transfer in that first check.

## Patch 106 checkpoint — deferred technician material picker UX (2026-09-14)
- During the Step 4.2B manual test, user approved documenting a later UX improvement for technician material selection.
- Deferred requirement: smart default list prioritizing Team-Warehouse-stocked / evidence-based relevant materials; full active-Catalog search must remain available.
- Result presentation should include item name, operator Catalog code, taxonomy path, and Team-Warehouse balance.
- Do not infer specialty mappings. Use them only if explicit Master Data mapping exists.
- This does not reopen Step 4.1 and does not pause Step 4.2B acceptance. No runtime/SQL change.


## Checkpoint after Patch 107 (2026-09-14)
- Step 4.2B manual acceptance is **IN PROGRESS**, not closed.
- Manual partial-shortage test now PASS: task need `6`, Team Warehouse snapshot `5`, shortage request `1`.
- Positive Main availability/handoff button check also PASS: PRIMA Main balance `89`, transferable `1`.
- Patch 107 fixes the discovered wording/data-context issue by reading the existing `material_route_decision` snapshot; no SQL/schema. Warehouse card now distinguishes task need vs Team-at-request vs Main shortage vs remaining transfer.
- Automated gate remains **25/25 Step 4.2B** and **131/131 combined focused regression**.
- **Exact resume point:** apply Patch 107, refresh the warehouse PM V2 queue, and verify the PRIMA card shows **6 / 5 / 1 / 1** under the new four labels. Do not execute the physical Transfer until that visual smoke is reported.


## Checkpoint after Patch 108 (2026-09-16)
- **Step 4.2B = CLOSED / PASS.**
- Real test context: task `PMV2-20260914-P5-T13`; PRIMA item; task need `6`; Team-at-request `5`; Main shortage/request `1`; Main available `89`.
- Existing Warehouse Transfer enforced the PM V2 max (`2` rejected, `1` accepted), then moved `1` from Lot `LOT-2026-00315`.
- `TRB-2026-090001` is the Warehouse Transfer Batch/header number. The actual item transfer row linked by PM V2 is `TRF-2026-090001`. This matches current code: `createBatch` returns a batch plus result rows, and PM V2 passes each successful result `transferNumber` to its read-only adapter/link service.
- Final DB verification for `TRF-2026-090001` returned `linkedQuantity=1`, `requestedQuantity=1`, `issuedToTeamQuantity=1`, `status=issued_to_team`. The earlier empty-set query used `TRB` where `TRF` was required.
- No Purchase/PO/Receiving work was started by this closure.
- **Exact resume point:** Step 4.2B is closed. Before implementing the next Phase 4 runtime slice, inspect the existing Purchase workflow and the frozen `pmv2_material_purchase_links` contract; do not change Purchase/PO/Receiving without a new explicit execution instruction.


## Checkpoint after Patch 109 (2026-09-16)
- Step 4.2B remains **CLOSED / PASS**.
- New Phase 4 Team-Warehouse Issue/Delivery linkage is **CODE IMPLEMENTED / MANUAL ACCEPTANCE PENDING**.
- Existing Inventory/Delivery remains source of truth; PM V2 does not mutate Stock and writes `pmv2_material_usages` only from confirmed Delivery evidence.
- Current real scenario is ready for manual UI smoke: Task `PMV2-20260914-P5-T13`, Catalog code `152-97`, Team Warehouse `SUB-1`, current balance `6`, Lot `LOT-2026-00315`. First check is selector visibility only; do not issue until reviewed.
- Partial-shortage usage attribution contract: task requirement `6`, original Team stock `5`, request-supplied `1`; a full Delivery `6` should trace `5` with nullable request + `1` against the shortage request.
- Automated: Patch 109 **27/27 PASS**; combined focused **158/158 PASS**; syntax **7/7 PASS**.
- No SQL/schema, Purchase/PO/Receiving, or Phase 5 technician-resume implementation.
