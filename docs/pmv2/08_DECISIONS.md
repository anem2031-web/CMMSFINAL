# سجل القرارات النشطة — PM V2

> **مهم:** هذا الملف يحتوي القرارات الحالية فقط. أي تصميم استبدل لاحقًا أزيل من المرجع النشط حتى لا يحدث تضارب.

## DEC-001 — PM V2 وحدة مستقلة داخل نفس CMMS
Bounded Module/Modular Monolith، وليست تطبيقًا منفصلًا.

## DEC-002 — لا نمس Legacy PM أثناء البناء
Legacy cleanup مشروع لاحق بعد Release/Stabilization.

## DEC-003 — لا Duplicate Master Data
Users/Sites/Sections/Assets/Warehouses/Catalog/Inventory/Tickets/Purchase تبقى Source of Truth الحالية.

## DEC-004 — Organization
`Specialty → Team → Members`؛ لا Department Parent تنظيمي في baseline.

## DEC-005 — Maintenance Targets
Target = Site أو Section أو Asset، Exactly One. المكان منفصل عن Specialty/Team.

## DEC-006 — Checklist/Recurrence
Checklist reusable، والتكرار على Checklist Item في baseline.

## DEC-007 — Program ownership
Program مرتبط بفريق واحد واضح وChecklist، ويمكنه امتلاك عدة Targets.

## DEC-008 — Scheduler idempotency
Task generation يمنع duplicates وفق Unique contract المجمد في ERD.

## DEC-009 — Technician results
`ok | fixed | needs_material | needs_ticket`.

## DEC-010 — Task Item states
`pending | in_progress | waiting_material | waiting_ticket | ready_to_complete | completed`.

## DEC-011 — Task status مشتق
Task = projection من Task Items، مع `cancelled` إداري صريح.

## DEC-012 — Material Request only after Team Warehouse shortage
إذا المادة موجودة في مخزن الفريق تستخدم Inventory flow الحالي مباشرة.

## DEC-013 — Material Request Item states
`waiting_warehouse | external_purchase | received_warehouse | issued_to_team | consumed | cancelled`.

## DEC-014 — Warehouse Transfer current workflow
عند توفر المادة في المستودع الرئيسي، تستخدم آلية النقل الحالية إلى مخزن الفريق.

## DEC-015 — Inventory current workflow
PM V2 لا تخصم Stock مباشرة؛ QR/Lot/Transaction rules الحالية هي Source of Truth.

## DEC-016 — Material Recipient at actual delivery
المستودع يحدد المستلم الحقيقي عند التسليم؛ Team Device ليس Recipient ثابتًا.

## DEC-017 — PM V2 Purchase Source
`Material Request Item → pmv2_material_purchase_links → PO/PO Item`.

## DEC-018 — PO full reuse
PO الناتج من PM V2 هو PO عادي بالكامل: نفس الترقيم، الصفحة، الحالات، الاعتمادات، الموردين، Packages، receiving, inventory entry, delivery, audit والتقارير.

## DEC-019 — لا Ticket/Package fields كمصدر PM V2
لا تستخدم `ticketId/ticketItemId/packageId` لحفظ Source identity الخاصة بـPM V2.

## DEC-020 — Warehouse PO permission scoped
إذا منح Warehouse بدء/إنشاء PO من PM V2، تكون صلاحية Scoped ومحمية Server-side/Audit، لا Purchase Admin عامة تلقائيًا.

## DEC-021 — needs_ticket يعيد استخدام البلاغ الحالي
تفتح نفس نافذة البلاغ؛ ينشأ Ticket حقيقي ويربط بـ`pmv2_task_ticket_links`.

## DEC-022 — A/B/C ملك Ticket Workflow الحالي
PM V2 لا تختار ولا تنسخ مسارات البلاغ A/B/C.

## DEC-023 — External Reference Policy
Internal PM V2 relations = FKs. Existing-system references = IDs + Adapter validation، بدون Physical FK يفرض Side Effect على Workflow قائم في baseline.

**تأكيد تنفيذي 2026-09-07 بموافقة المستخدم:**
- External IDs التي تخزن داخل جداول PM V2 تحصل على Index مناسب حسب الاستعلامات.
- Adapter validation إلزامي عند create/update للتأكد من وجود المرجع وصلاحيته التشغيلية.
- يمكن للقراءة داخل نفس قاعدة `cmms` استخدام JOIN مباشر إلى الجداول الحالية عند الحاجة؛ عدم وجود FK لا يعني منع JOIN.
- لا يتحول JOIN المباشر إلى Ownership أو Cascade أو قيد دورة حياة على الوحدة المالكة.

## DEC-024 — Material Request Header بلا Status مستقل
Items هي Source of Truth، والHeader ملخص مشتق.

## DEC-025 — Closure
لا تغلق المهمة مع Task Item غير مكتمل أو Material dependency فعالة أو Ticket مفتوح أو Follow-up مطلوب.

## DEC-026 — DB writes manual
أي Schema change ينفذه المستخدم يدويًا SQL خطوة بخطوة.

## DEC-027 — Acceptance Gate mandatory
لا تنتقل مرحلة قبل Implementation/Test/Fix/Re-test/Gate المناسب.

## DEC-028 — Phase 0 CLOSED/PASS
Reality Checks + State Machines + ERD + Documentation consistency أغلقت بتاريخ 2026-09-06. المرحلة التالية هي المرحلة 1 — تأسيس الوحدة وربط البيانات الأساسية، ولم تبدأ.


## DEC-029 — الخطة التنفيذية الرسمية = 6 مراحل
التقسيم السابق إلى 15 مرحلة أُلغي من المرجع النشط بتاريخ 2026-09-06. المضمون لم يُحذف؛ دُمج كخطوات فرعية داخل ست مراحل رسمية: (1) تأسيس الوحدة وربط البيانات الأساسية، (2) إعداد خطط الصيانة وتوليد المهام، (3) تنفيذ الفني للمهمات، (4) المواد والمستودع والشراء والبلاغات، (5) المتابعة والإغلاق والإدارة، (6) الاختبار الشامل والإطلاق.


## DEC-030 — بدء المرحلة 1
بدأ التنفيذ الفعلي للمرحلة 1 بتاريخ 2026-09-07 بعد أمر المستخدم الصريح. البداية محصورة في Foundation/Schema/Security/Audit، وأي DB change يبقى SQL يدويًا واحدًا في كل مرة ينفذه المستخدم.


## DEC-031 — TiDB CHECK policy for PM V2
بعد تحذيرات DB Step 5 بتاريخ 2026-09-08، لا تعتمد PM V2 على `CHECK` constraints في TiDB baseline الحالية ولا تغيّر `tidb_enable_check_constraint` GLOBAL من أجل الوحدة. Domain ranges/flags الخاصة ببنود Checklist تُفرض في Service write boundary وتغطى باختبارات. Primary/Unique/Internal FK/Indexes وأنواع الأعمدة تبقى DB enforcement الفعلي. هذا قرار تنفيذ ولا يغيّر الـERD المنطقي المجمد.

## DEC-032 — Request Reminders reuse current Notification infrastructure
Reality Check التنفيذي قبل DB Step 18 أكد أن النظام الحالي يملك `notifications` وخدمات الإشعار/Web Push. لذلك `pmv2_request_reminders` هو Trace/Source Metadata تابع لـMaterial Request فقط، وليس Notification workflow جديدًا. يحتفظ بمراجع خارجية مفهرسة للمستلم/الإشعار/المنشئ عند الحاجة، ولا يكرر title/message/status أو Scheduling state. قواعد التوقيت والتصعيد والإرسال تبقى للمرحلة 5 وتستخدم الخدمات الحالية.

## DEC-033 — Phase 2 recurrence semantics

اعتمدت في Step 2.2 قواعد Date-only مستقلة عن timezone:

- `frequencyValue` = مضاعف للفترة الأساسية؛ القيمة `NULL` تعني `1`.
- Daily: كل N يوم؛ إذا N > 1 يلزم `anchorDate`.
- Weekly: يلزم `weekday` (0=Sunday..6=Saturday)؛ إذا N > 1 يلزم `anchorDate` لمحاذاة الأسابيع.
- Monthly: يلزم `monthDay`؛ اليوم 29/30/31 يثبت إلى آخر يوم صالح عند الشهر الأقصر؛ إذا N > 1 يلزم `anchorDate` لمحاذاة الأشهر.
- Quarterly/Biannual/Annual: يلزم `anchorDate`، وتكون الدورة كل 3/6/12 شهر × N مع حفظ يوم الارتكاز وClamp لنهاية الشهر عند الحاجة.
- لا يولد Item معطل (`isActive=0`) أي Due.
- لا تعتمد الحسابات على timezone أو وقت اليوم؛ تستخدم تواريخ `YYYY-MM-DD` فقط.


## DEC-034 — Phase 2 Scheduler execution policy

- PM V2 Scheduler مستقل عن Legacy PM automation ويُسجل Additive في bootstrap فقط.
- يعتمد تاريخ الرياض `Asia/Riyadh` كتاريخ تشغيل Date-only.
- ينفذ دوريًا كل ساعة، مع guard يمنع تداخل تشغيلين.
- لا يولد قبل تاريخ إنشاء Program، ويعيد التحقق من صلاحية Site/Section/Asset عبر Adapter وقت التوليد.
- idempotency طبقتان: repository get-or-create/ensure + UNIQUE contracts المجمدة في `pmv2_tasks` و`pmv2_task_items`.
- إعادة التشغيل تصلح partial generation ولا تنشئ duplicate tasks/items.
- Task يحفظ Team snapshot، وTask Items تحفظ source/title/order/date snapshots حسب ERD المجمد.

## DEC-035 — Phase 2 CLOSED / PASS

أغلقت المرحلة 2 بتاريخ 2026-09-08 على نطاق PM V2 بعد نجاح Checklists/Recurrence/Programs/Scheduler، ونجاح runtime repository simulation لإعادة تشغيل Scheduler، وبوابة Phase 2 المستقلة. Full-project baseline failures القديمة تبقى `PEND-001` ولا تُنسب إلى PM V2 دون Root Cause مباشر.


## 2026-09-09 — Historical recurrence provenance belongs on the task item
- A historical PM V2 task item must explain the recurrence rule that made it due without requiring the manager to navigate back to the mutable checklist definition.
- New task items therefore snapshot the structured recurrence configuration at generation time (`frequency`, interval value, weekday, month-day, anchor date) alongside the existing title/order snapshots.
- The UI localizes this structured snapshot into a compact badge rather than storing Arabic presentation text in the database.
- Pre-patch rows use a read-time fallback to the current source checklist recurrence only for compatibility; this is not treated as an authoritative historical snapshot.

## DEC-036 — Initial daily team workload classification (2026-09-12)
For the first manager-facing workload implementation, PM V2 uses program estimated duration and a simple 8-hour planning-day baseline; this is planning guidance, not a task-creation blocker.

- `available / متاح`: 0–240 minutes.
- `medium / متوسط`: 241–360 minutes.
- `high / مرتفع`: 361–480 minutes.
- `conflict / تعارض`: more than 480 minutes.
- Multiple tasks for the same team/day remain valid.
- Cancelled tasks do not consume workload. Completed tasks remain counted for the historical day because the work was scheduled/performed on that day.
- A task whose program has no estimated duration contributes `0` to the numeric total but increments `unknownDurationTaskCount`; consumers must use `estimateComplete` and must not present the numeric total as complete when estimates are missing.
- Capacity thresholds are isolated in `server/pmv2/tasks/workload.ts` so a later team-specific capacity model can replace the baseline without coupling recurrence logic to workload planning.
- This is Phase 2 work. It does not start Phase 3 and requires no DB change.

## 2026-09-12 — حمل الفرق يبقى صفحة بصرية بسيطة
- قرار المستخدم: شاشة `حمل الفرق` يجب أن تكون مفهومة بصريًا وغير معقدة.
- لذلك يعتمد العرض على أسبوع واحد فقط في كل مرة، وصف لكل فريق، وخلية مختصرة لكل يوم.
- لا نضيف مخطط Gantt أو ساعات بداية/نهاية أو توزيع أعضاء أو فلاتر متقدمة في هذه الخطوة.
- تفاصيل المهام تظهر فقط عند الضغط على خلية فيها عمل، حتى تبقى الصفحة الرئيسية خفيفة وسريعة القراءة.

## DEC-037 — Current-week workload focuses on what remains (2026-09-12)
- The weekly matrix remains the primary manager view; it is not replaced by a separate daily dashboard.
- For the current week, default focus is **من اليوم وما بعده** because elapsed days are history, not remaining capacity.
- The manager may switch to **الأسبوع كامل**; when doing so, elapsed days are visually subdued and today is highlighted.
- Only one direct filter is added: active team (`كل الفرق / فريق محدد`). Avoid stacking search/status/date filters on this screen.
- Overdue work is a separate operational concern: unfinished tasks before today remain tied to their original due date and are surfaced as an overdue count, not silently added to today's estimated load.
- Patch 069 does not create a task-rescheduling workflow. Any future rescheduling action must be explicitly designed and tested rather than mutating due dates implicitly.

## DEC-038 — Overdue alert is a navigation shortcut, not a rescheduler (2026-09-12)
- Approved UX: the overdue count inside `حمل الفرق` is clickable and opens `المهام المجدولة → المتأخرة` directly.
- If a team is selected in workload, preserve that team filter in the destination task list.
- This action must not change `dueDate`, move workload to today, or create a separate overdue workflow. It is only a manager navigation shortcut over the existing PM V2 task-list filters.


## 2026-09-12 — DEC: حمل الفرق لا يحتاج تعقيدًا إضافيًا قبل قبول Phase 2
- بعد الاختبارات اليدوية لـPatches 069–070، لا يضاف الآن أي فلتر جديد أو ترحيل تلقائي للمتأخرات أو توزيع أفراد أو أوقات بداية/نهاية.
- يبقى العرض الأسبوعي + التركيز على اليوم وما بعده + فلتر فريق واحد + تنبيه المتأخرات هو النطاق المعتمد لهذه المرحلة.
- الميزة الموجودة منذ Patch 068 لفتح تفاصيل خلية فريق/يوم يجب فقط أن تُختبر يدويًا قبل إغلاق قبول `حمل الفرق`.
- حالة Phase 2 الحالية: **IN PROGRESS — final hardening/acceptance**؛ Phase 3 لم تبدأ.

## DEC-039 — Checklist item order is manager-automatic (2026-09-12)
- `sortOrder` remains an internal PM V2 ordering/snapshot field, but normal manager UX must not ask the user to type it.
- New checklist items created without an explicit order receive `max(existing sortOrder across the checklist) + 1`, with an empty checklist starting at `1`.
- Inactive rows are included when choosing the next automatic number so a historical/visible number is not silently reused.
- The checklist management UI displays human ordinal positions starting from `1`; this also keeps pre-Patch-074 test rows with internal `0` from exposing a confusing zero to the manager.
- Existing explicit API/update compatibility and active-item logical uniqueness remain in place; no DB migration is required.

## DEC-040 — Recurrence wording is operational, not technical (2026-09-12)
Manager-facing recurrence UI must translate internal schedule units/intervals into plain operational Arabic instead of exposing implementation terminology.

- Custom form uses **التكرار حسب** and **فترة التكرار** with a live plain-language meaning.
- Day/week/month/year intervals read naturally (`يوميًا`, `كل أسبوعين`, `كل شهرين`, `كل سنتين`, etc.).
- Quarter/half-year intervals are presented as their practical month/year span (`كل 3 أشهر`, `كل 6 أشهر`, `كل سنة`) rather than `N أرباع/أنصاف سنة`.
- The UI explicitly states when one or multiple execution days/dates can be added inside a due cycle.
- Internal `scheduleConfigJson` semantics remain unchanged and continue to be the recurrence source of truth.
- Existing persisted historical recurrence-label snapshots are not rewritten; newly generated labels use the improved wording.


## DEC-041 — Custom recurrence is expressed as two manager questions (2026-09-12)
For normal maintenance-manager use, custom recurrence must not require understanding fields named `التكرار حسب`, `فترة التكرار`, cycle count, or anchor date.

The interaction is:
1. **متى يتكرر الفحص؟** — normal presets or custom.
2. For custom: **يتكرر الفحص كل [رقم] [وحدة]**, with an immediate human result such as **كل 6 أشهر**.
3. **متى يتم التنفيذ؟** — show only the weekday/day/date controls relevant to the selected unit.
4. If a start reference is required for intervals greater than one, call it **يبدأ هذا النمط من**.

Internal `scheduleConfigJson`, scheduler due logic, and historical snapshots remain unchanged.


## DEC-042 — Program title is optional descriptive metadata (2026-09-12)
- Maintenance managers may give a PM V2 program a human title to distinguish programs as their count grows.
- The title is optional, limited to 200 characters, and blank values normalize to `NULL`.
- Untitled programs keep the stable fallback `برنامج #N`; program ID remains visible as a reference when a title exists.
- Program title is safe to edit after tasks exist because it does not change team/checklist/target ownership or historical generation semantics.
- Search includes the title. No title is copied into generated-task identity or used by the scheduler.

## DEC-043 — Manual Scheduler may target one due program; production Scheduler remains global (2026-09-12)
- The normal PM V2 Scheduler continues to inspect all eligible programs for its run date and generate only what is due.
- The manager-facing **manual test** panel may optionally run one selected program to make acceptance/debugging unambiguous.
- A program selector must not show the whole program catalog; it shows only active programs with at least one due active checklist item on the chosen date.
- Default manual scope is **كل البرامج المستحقة**. Specific scope is explicitly labeled **برنامج محدد**.
- This is test/management targeting only; it does not change recurrence semantics, task identity/idempotency, or the automatic job.


## DEC-044 — Phase 2 final acceptance is closed with explicit skipped-test disclosure (2026-09-12)
- The user explicitly approved closing Phase 2 after the current manual acceptance sequence.
- Manual checks that were completed are recorded as PASS; tests the user chose not to execute are recorded as **SKIPPED**, never silently promoted to PASS.
- The two skipped optional checks at closure are:
  - custom `كل 3 أيام` anchor-date Scheduler runtime due/non-due check;
  - Scheduler runtime check for a custom recurrence containing multiple dates in one cycle.
- Program-title search was subsequently tested manually and is PASS.
- Phase 2 is now **CLOSED / PASS (final acceptance)**. Phase 3 remains **READY / NOT STARTED** and is not started by this closure decision.


## DEC-045 — Technician access is role-scoped and team-membership-scoped (2026-09-13)
- Phase 3 technician execution permission is separate from PM V2 management permission; adding technician execution must not broaden management endpoints.
- The current execution role is the existing application `technician` role.
- A technician may read a PM V2 Task only when an **active** `pmv2_team_members` row links the logged-in user to that Task's `teamId`.
- Task Item reads re-check the same membership server-side; client navigation is not treated as an authorization boundary.
- `مهامي اليوم` uses Riyadh date-only and is read-only in Step 3.1. Execution mutations begin only in a later explicit Phase 3 step.
- Existing Tasks are not hidden merely because a Team later becomes inactive; access is based on the technician's active membership in the Task's snapshotted Team.

## DEC-046 — Step 3.2 uses one open Visit per Task and an atomic start boundary (2026-09-13)
- User explicitly approved Phase 3 Step 3.2 after Step 3.1 manual acceptance.
- `بدء التنفيذ` is available only for a Task Item in `pending`; this step implements only `pending → in_progress` and does **not** add technician results yet.
- The write boundary rechecks active Team membership and exact Task/Task Item ownership server-side.
- All start mutations run in one DB transaction and lock the Task row (`FOR UPDATE`) so concurrent starts for the same Task serialize.
- At most one Visit may be open for a Task at the PM V2 write boundary. The first starter creates the Visit and becomes Leader; later active Team members join that same open Visit as Members.
- The start event is recorded as `pmv2_item_actions.action = start_execution` and also written as `audit_logs.action = pmv2.item_start_execution` / `entityType = pmv2.task_item` through the PM V2 audit wrapper in the same transaction.
- Step 3.2 changes Task status from `pending` to `in_progress` on the first started item. Full projection for later waiting/ready/completed states remains for subsequent explicit steps.
- No SQL/schema change. No material, ticket, purchase, inventory, result-selection, Visit-ending, or Task-closing behavior is introduced here.


## DEC-047 — Step 3.3 starts with the dependency-free `ok/fixed` result slice (2026-09-13)
- The first Step 3.3 runtime slice implements only `ok` (**سليم**) and `fixed` (**تم الإصلاح**), because both close the Task Item inside Core PM V2 without invoking external Material/Ticket workflows.
- Result submission is allowed only from Task Item `in_progress`, under active Team membership and exact Task/Item ownership revalidation.
- The write runs in one Task-serialized transaction and requires exactly one open Visit; an active teammate may join that Visit before recording the result.
- The result event is `pmv2_item_actions.action = submit_result` with the frozen `result`, optional `note`, Visit, and performer; audit uses `pmv2.item_result_submitted` / `pmv2.task_item`.
- `ok/fixed → completed` for the Task Item. Task status is recalculated as `in_progress` while any Item remains incomplete, otherwise `completed`.
- This slice does not end the Visit and does not implement `needs_material`, `needs_ticket`, attachments, Inventory, Purchase, or Ticket workflow integration. No SQL/schema change.


## DEC-048 — Step 3.3B records dependency outcomes in Core PM V2 without starting external workflows (2026-09-13)
- User explicitly approved Step 3.3B after the dependency-free `ok/fixed` slice was CLOSED/PASS.
- `needs_material` and `needs_ticket` may be submitted only for a Task Item already `in_progress`, with the same active Team membership, exact ownership, Task-row serialization, and single-open-Visit requirements used by the accepted result boundary.
- Core transitions are `needs_material → waiting_material` and `needs_ticket → waiting_ticket`. The standard `submit_result` Item Action and `pmv2.item_result_submitted` Audit record store the result and optional note.
- This decision **does not create** `pmv2_material_requests`, inventory movements, Purchase records, Tickets, or `pmv2_task_ticket_links`; those integrations remain in Phase 4 and must reuse existing workflows.
- Task cached projection uses fixed mixed-dependency priority requested by the user: **waiting_material before waiting_ticket**. Active work remains `in_progress` after those dependency priorities; item-level states remain visible independently.
- A Task summary in `waiting_material` or `waiting_ticket` does not freeze unrelated pending/in-progress Items; technicians may continue Core execution on those Items while the dependency remains unresolved.
- No SQL/schema change. Visit ending remains outside this slice.


## Phase 3 Step 3.4 — Visit ending baseline (Patch 089)
- One open Visit per Task remains the write-boundary invariant.
- Only the **recorded Leader of the currently open Visit** may end that Visit, and the user must still be an active member of the Task team at end time.
- A Visit cannot be ended while any Task Item remains `in_progress`; the active Item must receive a result first.
- Ending a Visit is not Task closure: only `pmv2_visits.endedAt` is changed. Task and Task Item states/results remain authoritative and unchanged by the Visit-end action.
- `pending`, `waiting_material`, `waiting_ticket`, `ready_to_complete`, or `completed` Items do not by themselves block Visit ending.
- Visit end is audited as `pmv2.visit_ended` / entity `pmv2.visit`; repeated end attempts are rejected when no open Visit exists.
- A later pending Item may open a Follow-up Visit through the existing Start Execution path.


## DEC-050 — Step 3.5 uses existing Attachments linked to Item Actions (2026-09-13)
- Execution images/evidence remain **optional** in Phase 3; no new mandatory photo rule is invented for `ok`, `fixed`, `needs_material`, or `needs_ticket`.
- The frozen Phase 1 contract is followed literally: evidence uses the existing `attachments` service/table and links to the execution event as `entityType = pmv2_item_action`, `entityId = pmv2_item_actions.id`. No PM V2 attachment table and no SQL.
- Technician read is allowed only with active membership in the Task's snapshotted Team and exact Task/Task Item ownership; PM V2 management roles may read for review.
- Technician write is narrower: the Item Action must belong to the same technician and its Visit must still be open. This prevents a teammate from attaching evidence to somebody else's action and freezes evidence writes when the Visit is ended.
- Patch 091 accepts **images only** for PM V2 execution evidence. The existing shared upload/storage path is reused; the existing attachment Audit record (`add_attachment`) is retained instead of creating a duplicate audit stream.
- Evidence upload/read never changes Task/Task Item status/result and does not start Phase 4 Material/Ticket/Inventory/Purchase integrations.

## DEC-051 — Patch 093 — Phase 3 final acceptance closure with explicit deferred/skipped disclosure (2026-09-13)
- The user explicitly approved closing Phase 3 after Steps 3.1–3.5 were accepted on their implemented Core scopes.
- The different-active-teammate join/reuse branch for an already open Visit is **not** silently recorded as manual PASS. Its dedicated manual runtime test is **SKIPPED / ACCEPTED by user decision**, with the focused Step 3.2 automated contract retained as evidence.
- Manual Mobile/Tablet responsive-layout verification is **DEFERRED TO FINAL PROGRAM ACCEPTANCE (Phase 6)** by user decision. It is not relabeled PASS and does not block Phase 3 closure.
- This closure does not start Phase 4 and does not add Material Request, Ticket, Inventory, Purchase, or other external workflow integration.
- **Phase 3 = CLOSED / PASS (final acceptance). Phase 4 = READY / NOT STARTED** and requires a separate explicit execution instruction.


## DEC-052 — Step 4.1 material intake uses read-only Team Warehouse availability and requests shortage only (2026-09-13)
- Phase 4 starts with the smallest material slice only; it does not start warehouse transfer, purchase, or Ticket integration.
- Material selection reuses current active `catalog_items`; Team Warehouse comes from the PM V2 Team's existing `warehouseId`. No duplicate catalog/warehouse master data is introduced.
- PM V2 checks current Team Warehouse availability **read-only**. When Lot tracking is enabled, positive current Lot balances are the availability source; PM V2 never mutates Inventory/Lot balances in this step.
- If available quantity is enough for the full technician request, **no PM V2 Material Request is created**. The response explicitly directs fulfillment to the existing Inventory/Delivery workflow, including its current QR/Lot rules.
- If availability is zero or partial, create a PM V2 Material Request only for `requested - available`; its first Material Request Item state is `waiting_warehouse`. Existing Team-Warehouse quantity is not duplicated in the request.
- An active request for the same Task Item + Catalog Item is not duplicated. Multiple current inventory rows for the same catalog item/warehouse are treated as ambiguous and rejected rather than guessed.
- Patch 094 adds no SQL/schema change and no direct Stock mutation, Warehouse Transfer, PO, Ticket, or Legacy PM workflow modification.


## DEC-053 — Step 4.1 separates material need quantity from actual Team Warehouse issue limits (2026-09-14)
- Technician material intake records the **total operational need**, not a direct stock issue transaction. Therefore the technician may state a needed quantity larger than the current Team Warehouse balance.
- The UI must show the Team Warehouse balance beside the Catalog item and preview **requested / available / shortage** before submit.
- PM V2 requests only the shortage from the main warehouse when Team Warehouse stock is insufficient. If Team Warehouse stock fully covers the need, no PM V2 Material Request is created.
- The actual issue/withdrawal from Team Warehouse remains in the existing Inventory/Delivery workflow and must obey its current stock/QR/Lot controls; PM V2 Step 4.1 never permits or performs an over-issue.
- Availability display is advisory until submit; the server rechecks current availability during `submitMaterialNeed`, so a stale UI balance cannot force an invalid routing decision.
- No stock reservation or mutation is introduced by this decision. No SQL/schema change.


## DEC-054 — Open technician Tasks carry forward visibly without changing due date (2026-09-14)
- A PM V2 technician Task may remain operationally open across calendar days, especially in `waiting_material` / `waiting_ticket`; therefore exact-today-only visibility is not an acceptable execution surface.
- Technician task feed includes today's Tasks plus prior-date Tasks that are still non-final, under the same active Team membership authorization.
- Historical `completed` and `cancelled` Tasks are not carried forward. The original `dueDate` is preserved and no replacement Task is generated.
- UI must distinguish **مهام اليوم** from **مهام سابقة مفتوحة** and show the original due date so carry-over does not masquerade as a rescheduled Task.
- This is a visibility/read correction only: no SQL, Task date mutation, Inventory mutation, or Material Request routing change.


## DEC-055 — Unlisted material need is captured without technician-created Master Data (2026-09-14)
- If a technician cannot find the required material in the current active Catalog, PM V2 must not force a wrong Catalog match and must not let the technician create Catalog Master Data.
- The technician may switch to **مادة غير موجودة في الدليل** and enter a free-text material name, quantity, and unit.
- The existing frozen `pmv2_material_request_items.catalogItemId` is nullable, so the request is persisted with `catalogItemId = NULL` and the technician-entered name in `itemNameSnapshot`; no schema/SQL change is required.
- With no Catalog identity, PM V2 does **not** claim a Team Warehouse availability check and does not guess an Inventory record. The full stated need is routed to `waiting_warehouse` for warehouse review/resolution.
- Warehouse/Catalog resolution remains a later Phase 4 workflow: link to an existing Catalog item when appropriate, otherwise use the current authorized Catalog creation/approval workflow. PM V2 does not create duplicate Master Data.
- Active duplicate free-text requests on the same Task Item are rejected when their normalized names match.

## DEC-056 — Successful material-need submission closes the entry form and duplicate needs are blocked in the UI as well as the server (2026-09-14)
- A successful Material Request must leave the technician with the saved request, not a still-populated submit form that invites an accidental second click.
- After Material Request creation, PM V2 clears the material-entry values and collapses the form. **إضافة مادة أخرى** is the explicit way to start a separate additional need.
- An active request does not prevent a different material from being added to the same Task Item; it only prevents the same active material need from being duplicated.
- Catalog items with an active request on the same Task Item are disabled in the selector and marked **مطلوب بالفعل**. Free-text/unlisted duplicates are detected in the UI by normalized name.
- Existing server-side duplicate enforcement remains authoritative and still rejects bypass/retry attempts. No SQL/schema or external workflow change.



## DEC-057 — Countable material units require whole-number quantities in Step 4.1 (2026-09-14)
- A technician material need may be decimal only when its unit is operationally divisible. Count/package units such as **قطعة، حبة، علبة، لفة، كيس، وحدة** must not accept fractions.
- PM V2 uses one shared Client/Server classifier for known count-unit aliases so the UI and write boundary cannot diverge.
- The server is authoritative: fractional count-unit quantities are rejected before inventory availability routing or Material Request persistence.
- Unknown/free-text units are not automatically treated as countable because they may be legitimate divisible measurements; this avoids blocking valid units such as litres, metres, kilograms, square metres, gallons, etc. Catalog/unit governance remains responsible for the unit text itself.
- UI `step=1` is a usability aid, not the security/data-integrity boundary; server validation remains mandatory.
- Existing `DECIMAL(12,3)` schema stays unchanged; no SQL is required.


## DEC-058 — Full Team-Warehouse availability is persisted as a routing decision, not as Stock state (2026-09-14)
- A successful full-stock availability check must not remain only as a transient toast/UI flag; the technician needs a durable **جاهز للصرف من مخزن الفريق** handoff after Refresh.
- PM V2 persists this as an append-only `pmv2_item_actions` Domain Event: `action = material_route_decision`, with a structured snapshot in `note` containing route, Catalog Item, requested quantity/unit, Team Warehouse, Inventory reference, availability snapshot, shortage, Lot flag, and optional Material Request references.
- Latest routing decision per Catalog Item is authoritative for the Step 4.1 handoff surface. `team_inventory` means ready to issue; a later `material_request` decision supersedes that ready state.
- This record is **not** a reservation, issue, usage, or Stock ledger entry. No Inventory/Lot quantity changes occur. Actual issue remains in existing Inventory/Delivery; actual PM V2 consumption trace remains `pmv2_material_usages` only after external Inventory/Delivery evidence exists.
- After `team_inventory` success the entry form closes/clears, same Catalog Item is blocked from duplicate need entry, and **إعادة التحقق من الرصيد** is available because stock can change before physical issue.
- No SQL/schema change is required because `pmv2_item_actions.action` is flexible varchar and `note` is nullable text under the frozen Phase 1 contract.


## DEC-059 — Step 4.1 closes with explicit manual-skip disclosure (2026-09-14)
- The user explicitly approved moving on after the implemented Step 4.1 material-intake routes were accepted on their tested scope.
- Step 4.1 is **CLOSED / PASS**; completed manual checks are PASS, while unexecuted optional/runtime branches are not silently promoted.
- Two manual branches are **SKIPPED / ACCEPTED by user decision**: (1) changing Team Warehouse stock after a persisted `team_inventory` decision then rechecking to force a shortage route; (2) a dedicated partial-shortage runtime case where local stock covers only part of the total need.
- The common server routing boundary continues to recalculate current availability and request `requested - available`; focused automated contracts remain supporting evidence, but the two branches above are not manual PASS.
- This closure does not imply physical issue, Warehouse Transfer, PO, Ticket, Material Usage, or Task dependency resolution. Those remain later Phase 4/5 work.

## DEC-060 — Step 4.2 starts with Warehouse visibility/decision before transfer mutation (2026-09-14)
- Review of the actual current system confirms Warehouse Transfer is already owned by `inventory.transfers.createBatch` behind `warehouseProcedure`, with current QR/Lot requirements, stock checks/mutation, transfer numbering, and `warehouse_transfer_batch` Audit. PM V2 must not duplicate or rewrite it.
- Therefore the first Step 4.2 runtime slice will be warehouse-facing **`waiting_warehouse` work queue + Main-Warehouse availability decision**, read-only against current Inventory/Lots.
- The queue must show the PM V2 request item, requested shortage quantity, Team Warehouse destination snapshot, Catalog identity when known, and clearly flag `catalogItemId = NULL` requests as requiring Catalog resolution rather than guessing stock.
- No Warehouse Transfer or PO is created in the first Step 4.2 slice. A later explicit slice may invoke/handoff to the current transfer workflow and update `issuedToTeamQuantity` only from a confirmed real transfer.
- `issued_to_team` remains forbidden until `issuedToTeamQuantity >= requestedQuantity`; PM V2 never marks transfer completion from a button click alone.


## DEC-061 — Step 4.2A warehouse queue is read-only and resolves exactly one active Main Warehouse (2026-09-14)
- PM V2 warehouse access is a separate permission surface: `warehouse | owner | admin`; warehouse users do not inherit PM V2 management or technician execution access.
- Main Warehouse identity is not hard-coded. PM V2 uses the current-system warehouse adapter and the same exactly-one-active-`type=main` rule used by current receiving; zero or multiple active Main Warehouses is an explicit precondition failure.
- `waiting_warehouse` is the only Material Request Item state shown by Step 4.2A. Availability uses current Inventory/Lot read logic; no write is performed.
- An unlisted material (`catalogItemId = NULL`) stays unlisted. PM V2 never searches by free-text and never guesses a Catalog/Inventory identity.
- A missing/inactive Catalog item, duplicate Inventory identity, or unit mismatch blocks a normal availability conclusion and is surfaced as an integrity exception.
- Warehouse Transfer, PO creation, PM V2 status transitions, and `issuedToTeamQuantity` projection are explicitly deferred to later Step 4.2 slices.

## DEC-062 — Warehouse users see the Catalog operator code + taxonomy path, not the database Catalog ID (2026-09-14)
- `catalogItemId` is an internal PM V2 integration reference and must not be presented as the operational material identifier in the warehouse queue.
- For a listed material, the warehouse card shows `catalog_items.code` as **كود الصنف** and the current `catalog_nodes` ancestry as **التصنيف**.
- The taxonomy path is read through the current-system Catalog adapter; PM V2 does not copy or persist Catalog tree data.
- If Catalog code/path is missing, the UI says it is not defined rather than falling back to the database ID.
- An unlisted request (`catalogItemId = NULL`) remains explicitly unlisted and receives no synthetic code/category.
- This decision is presentation/read-model only and does not change Inventory, Transfer, PO, request status, or schema.

## DEC-063 — Step 4.2B uses partial authoritative Warehouse Transfers (2026-09-14)
- Step 4.2B does not build a PM V2 stock-transfer workflow. It starts from the PM V2 warehouse request context but the real movement is owned by the existing Warehouse Transfer workflow.
- Partial fulfillment is valid: `transferableNow = min(remainingNeed, authoritativeMainWarehouseAvailable)` after server-side recheck.
- A successful real Transfer contributes to the same Material Request Item; multiple confirmed Transfers may cumulatively satisfy one item. No new PM V2 need is created for the remainder.
- Zero availability and unlisted Catalog identity are non-transferable states.
- PM V2 does not mark supply from a failed/unconfirmed Transfer.

## DEC-064 — Purchase quantity may exceed PM V2 shortage without inflating PM V2 demand (2026-09-14)
- Purchase integration is **not part of Step 4.2B**; this decision freezes the later contract only.
- PM V2 shortage is the minimum quantity that must be linked back to the maintenance need, not a maximum PO quantity.
- Example: shortage `4`, PO quantity `20` → only `4` may be linked to that PM V2 Material Request Item (`linkedQuantity=4`); `16` is general warehouse stock.
- Excess purchased quantity must never be reported as maintenance demand/usage for that Task Item.
- Existing Purchase Workflow remains authoritative for PO/approval/receiving; PM V2 stores source links only through the frozen `pmv2_material_purchase_links` contract.


## 2026-09-14 — Patch 105 / Step 4.2B implementation decisions

- Existing Warehouse Transfer remains the **only stock-movement owner**. PM V2 prepares context and later validates/links confirmed Transfer rows; it never creates `warehouse_transfers` or updates Inventory.
- Transfer fulfillment trace reuses `pmv2_item_actions` with action `material_transfer_linked` and JSON snapshot. No new PM V2 transfer-link table or SQL is introduced.
- Projection is source-derived: `issuedToTeamQuantity` is recomputed from unique confirmed Warehouse Transfer IDs linked to the request, capped at `requestedQuantity`; it is not trusted from a client-entered quantity.
- Partial transfer remains on the same Material Request Item in `waiting_warehouse`; only full confirmed fulfillment changes it to `issued_to_team`.
- A Warehouse Transfer may be linked to only one PM V2 Material Request Item. Re-linking the same Transfer to the same request is idempotent.
- After any physical Transfer succeeds, the PM V2 handoff context becomes stale and is frozen. A second transfer requires returning to the queue for a fresh server availability/remaining check.
- If physical Transfer succeeds but PM V2 linking fails, recovery is **link retry only**; never repeat the stock movement to repair PM V2 projection.
- Purchase/PO/Receiving and purchase-overage allocation remain deferred exactly as frozen in Patch 104.

## DEC-065 — Technician material picker uses a smart default list while preserving full-Catalog search (2026-09-14)
- The current Step 4.1 selector is functionally correct but its no-search state is not an ideal technician experience because it returns the first limited set of active Catalog items rather than an operationally prioritized list.
- Deferred Phase 4 UX follow-up: the technician picker should show a **smart default list** first, prioritizing materials actually stocked in the Team Warehouse and/or demonstrably relevant from existing usage/history data when such evidence is available.
- **Full Catalog search must remain available at all times** by material name and operator item code; the UX must never hard-block a technician from selecting a valid material merely because it is outside the default list.
- Each result should expose operator-facing identity: **material name + `catalog_items.code` + Catalog taxonomy path + current Team-Warehouse balance**.
- Specialty-based prioritization may be used **only when an explicit Master Data mapping exists** between specialties and Catalog materials/categories. PM V2 must not infer such mapping from category names, free text, or heuristics and must not duplicate that Master Data.
- Existing active-request / ready-to-issue duplicate indicators remain authoritative (`مطلوب بالفعل` / `جاهز للصرف`).
- This was frozen as a deferred UX improvement and did not reopen Step 4.1.
- **Implemented by Patch 143 (2026-09-26):** Team-Warehouse stock + real PM V2 usage history now drive the default ordering; full Catalog search and taxonomy identity remain available; no SQL/schema or external workflow write.


## 2026-09-14 — Warehouse request card must distinguish total task need from shortage request
**Decision:** A PM V2 Material Request Item stores only the shortage that must come from Main Warehouse, so the warehouse UI must not label that number as the technician's original need. The operator view shows the Step 4.1 route-decision snapshot as **احتياج المهمة** and **المتاح في مخزن الفريق وقت الطلب**, while the Material Request Item quantity is labeled **المطلوب من المستودع الرئيسي** and its outstanding amount **المتبقي للتحويل**. Current Main balance stays a live value. If a legacy request lacks the snapshot, show unknown snapshot fields as `—`; never infer historical values. No duplicate Master Data or schema is introduced.


## DEC-065 — Actual Team-Warehouse issue is the material-completion evidence (2026-09-16)
- Warehouse Transfer to the Team Warehouse is supply movement only; it does not prove technician/task consumption.
- The existing Inventory/Delivery workflow remains the sole owner of QR/Lot validation, stock decrement, Inventory Transaction, Delivery Document, recipient, and operational Lot-cost attribution. PM V2 links only confirmed evidence afterward into `pmv2_material_usages`.
- Full task need, not shortage request quantity, is the consumption target. Therefore a physical Delivery may produce more than one PM V2 usage trace row when it combines original Team stock with shortage-supplied stock.
- `materialRequestItemId` stays `NULL` for the original Team-stock portion and is populated only for the quantity logically attributable to the fulfilled shortage request, bounded by its confirmed `issuedToTeamQuantity`.
- A Material Request Item becomes `consumed` only after request-attributed real usage reaches its request quantity and its prior state is `issued_to_team`.
- A Task Item becomes `ready_to_complete` only after all known material requirements have real usage evidence. Technician follow-up/resume from `ready_to_complete` remains Phase 5 and is not implemented by this Phase 4 slice.
- If Inventory issue succeeds but PM V2 linking fails, recovery is link-only; the physical issue must never be repeated just to repair PM V2 projection.

## DEC-061 — Team-Warehouse material is technician self-received when the full need is available (2026-09-19)

- A Team Warehouse is part of the maintenance team's operating stock; routine full-stock PM V2 needs should not wait for a separate warehouse user to click issue.
- **Full availability:** technician confirms **استلام المواد من مخزن الفريق**; PM V2 persists the need and orchestrates the existing Inventory/Delivery issue with that technician as actual recipient.
- **Partial availability:** do not issue the available part by default. Persist the total need and request only the shortage from Main Warehouse. When the full remaining need becomes available in the Team Warehouse, enable the technician receipt action.
- The physical issue remains authoritative Inventory/Delivery activity. PM V2 does not duplicate inventory accounting, Lot consumption, or Delivery documents.
- Receipt remains distinct from actual consumption. Pending-return rules from Patch 110 remain unchanged.
- This decision supersedes the operational assumption that every ready Team-Warehouse PM V2 need requires a warehouse-user issue click, while preserving the warehouse queue as an operational/recovery surface.

## 2026-09-19 — Warehouse shortage action is whole-shortage transfer or Purchase of the uncovered part
- This later runtime decision supersedes DEC-063 **as the default action for new PM V2 shortage handoffs**. Historical partial transfer projection/retry support remains valid for already-created transfers.
- A waiting Material Request Item represents only the Main-Warehouse shortage, while the warehouse UI also shows the original full task need and Team-Warehouse snapshot for context.
- New default: if Main Warehouse covers the entire remaining shortage, transfer that whole shortage to Team Warehouse; do not ask the technician to receive the already-present Team quantity separately.
- If Main Warehouse does not cover the entire remaining shortage, do not start a default partial transfer. Purchase only the currently uncovered part after considering live Main stock and active linked purchase coverage; then wait until Main can cover the whole shortage and transfer it once.
- Purchase remains authoritative outside PM V2. PM V2 prepares context and stores only `pmv2_material_purchase_links`; purchase overage remains general stock exactly as frozen in DEC-064.
- Purchase coverage is considered still in flight until its PM V2-linked quantity has been represented by confirmed Warehouse Receipt quantity (or the purchase is cancelled/rejected/finalized without that stock). Current Main Inventory remains the final availability source for transfer.

## Decision — PM V2 shortage Purchase uses one linked item per request (Patch 117)

When Purchase is opened from a PM V2 shortage, that Purchase request is a traceable continuation of one maintenance-material shortage, not a generic shopping basket. Therefore:
- one PM V2 shortage handoff maps to one Purchase item;
- Catalog item identity and shortage quantity are fixed in the linked screen;
- the page shows an explicit PM V2 maintenance reference;
- ordinary Purchase requests remain multi-item and are not affected;
- PM V2 does not bypass or replace Purchase approvals/PO/Receiving and still stores only the authoritative PO-Item link after creation.

This supersedes Patch 115's temporary UI allowance for increasing/adding general-stock items inside a PM V2-launched Purchase request. General-stock purchasing remains available through the normal Purchase flow instead.

## Decision — Unlinked Catalog unit uses explicit Purchase-item unit; PM V2 does not infer Master Data (Patch 119)

For a PM V2 shortage Purchase, Catalog Item → active Catalog Unit is the only authoritative relationship that may lock the Purchase unit automatically.

If the Catalog Item has no such relationship:
- PM V2 may display its historical/operational unit snapshot for context, but that text is not treated as a Catalog Unit relationship;
- the buyer selects an active unit explicitly in the existing Purchase form;
- the selected unit belongs to that Purchase Item only and is not written back to Catalog/Master Data by PM V2;
- linking validates Catalog identity, PM V2 request identity, Purchase item identity/quantity, and that the selected Purchase unit is active, but does not require textual equality with the older PM V2 snapshot.

If an authoritative Catalog Unit relationship does exist, Purchase must still use that unit identity.

If Purchase creation succeeds but PM V2 linking fails, recovery is **link-only on the existing Purchase Order**. Never create a second Purchase Order merely to repair the PM V2 link.

## Decision — Technician material attention is a persistent cross-task surface (Patch 134)

A technician-facing material dependency must not rely only on finding the original task card again. PM V2 therefore maintains a persistent **مواد تحتاج انتباهك** projection above the task feed for material states that still require awareness or action by the requesting technician.

The projection is read-only state aggregation plus entry to existing actions; it is not a new Material Request, Inventory, Purchase, or stock-accounting workflow. Once the material no longer requires technician attention, it must leave this surface rather than accumulate indefinitely.

## Decision — Current shortage is supply progress, while original shortage remains audit context (Patch 135)

The shortage captured at routing time is historical context and must not be overwritten merely to make the UI look current. The technician surface therefore distinguishes:
- original shortage at registration;
- confirmed quantity received into Main Warehouse;
- confirmed quantity issued/transferred into Team Warehouse; and
- current remaining shortage.

For the technician attention projection, current remaining shortage is `max(0, initial shortage - confirmed issued-to-Team quantity)`. Receipt into Main Warehouse alone does not make the Team shortage complete. Existing Inventory/Transfer evidence remains authoritative.

After warehouse identity resolution, the resolved Catalog identity participates in duplicate blocking exactly like a directly selected Catalog item; historical unlisted identity must not allow a second active request for the same resolved material/task item.

## Decision — Warehouse request page reorganizes information instead of hiding it (Patch 136)

The warehouse page may be visually simplified by ordering and grouping information, but operational fields and recovery controls must not be removed merely to make the page shorter. PATCH136 therefore keeps the complete Patch 115+ warehouse context while changing only presentation hierarchy.

The primary visual order is: **action-required requests → ready issue → pending returns → architecture notice**. Within a waiting request, quantities, live stock/destination, request/status context, linked Purchase information, and the current action are separate visual groups. The underlying Inventory/Purchase/Transfer ownership boundaries are unchanged.

## Decision — Patch 137 — simplify by progressive disclosure, not by deleting warehouse information

For `/scheduled-maintenance/warehouse-requests`, further simplification must not remove existing operational context. The approved presentation rule is:

1. Preserve **ملخص عمل المستودع** and the PM V2 stock-ownership notice.
2. Present the three operational queues as **تحتاج معالجة / جاهزة للصرف / المرتجعات** tabs.
3. Default to **تحتاج معالجة**.
4. Show only one operational queue at a time.
5. Keep each card header visible but collapse its detailed body by default.
6. Preserve every existing field/action inside the expandable body.

This is a UI/presentation decision only and must not be interpreted as permission to remove warehouse, Purchase, Inventory, Delivery, Lot, or Return data or behavior.

## Decision — Patch 138 — الاستكمال Visit إضافية لنفس Task وليس Task جديدة

عند زوال انتظار المواد تبقى هوية Task وTask Item الأصلية. إذا انتهت زيارة اليوم، ينشأ صف `pmv2_visits` إضافي لنفس `taskId` فقط عند ضغط **استكمال العمل**. هذا يحفظ بداية المهمة الأصلية وجميع الزيارات والمراحل بدل ترحيلها إلى Task جديدة.

## Decision — Patch 138 — PM V2 يقرأ المسؤولية الخارجية ولا يمتلك Workflow خارجيًا

Purchase/Ticket/Inventory/Accounting/Management تبقى مصادر الحقيقة. Timeline PM V2 يقرأ الحالات والتعيينات والسجلات الحالية، ولا يحدث جداولها ولا يعيد تعريف State Machine لديها.

إذا كان المصدر يملك assignee صريحًا (مثل `purchase_order_items.delegateId` أو Ticket assignee) يعرض الاسم. إذا كانت المسؤولية Role جماعية بلا assignee، يعرض الدور فقط. منفذ الانتقال التاريخي يمكن عرضه من Audit/History بعد وقوعه.

## Decision — Patch 138 — المدة ليست "تأخيرًا" بدون SLA

يُسمح بعرض `منذ` ومدة المرحلة والوقت المتراكم عند الدور/الشخص، لكن لا تستخدم تسمية **متأخر** أو حكم مسؤولية تأخير حتى تعتمد حدود SLA لكل مرحلة بصورة منفصلة.

## Decision — PATCH139 responsibility/SLA model — 2026-09-26

1. PM V2 derives current responsibility from existing source systems; it does not copy or own their State Machines.
2. A person is displayed only when the source workflow has a concrete assignment. Otherwise the accountable Role is displayed without inventing a person.
3. Elapsed responsibility time is not automatically called delay.
4. `overdue` is allowed only when an active PM V2 SLA exists for that role and the current responsibility duration exceeds it.
5. SLA applies from the start of the **current responsibility**, not from total task age.
6. PM V2 reminders reuse the existing notification subsystem and use PM V2-owned dedupe persistence.
7. Owner metrics must not infer confirmed asset downtime from the mere existence of an open PM V2 task.

## PATCH141 — لا نخترع إسنادًا فرديًا غير موجود في PM V2
PM V2 الحالي يسند `Task` إلى `Team`، وعضوية الفريق تحدد من يستطيع التنفيذ. لذلك تقرير الفني لا يغيّر نموذج البيانات ولا يدعي أن Task مسند لشخص بعينه. عند اختيار فني يعرض النظام مهام فرقته/فرقه ثم يقارنها بمشاركته الفعلية في `pmv2_visit_members` و`pmv2_item_actions`. إذا احتاج المشروع مستقبلًا Assignment فرديًا حقيقيًا، يجب أن يكون قرار نموذج بيانات مستقلًا وليس استنتاجًا داخل التقرير.

## 2026-09-26 — PATCH142 decisions
- Daily report review is keyed by **date + team**, matching PM V2 team-level assignment truth.
- A technician-filtered report is analytical only and cannot be marked as the reviewed team report.
- Review metadata belongs to PM V2; external workflow state remains read-only.
- 30-day completion indicators are descriptive counts/rates, not personnel scoring.
- No default SLA durations are invented; lateness classification remains dependent on explicit operational configuration.
