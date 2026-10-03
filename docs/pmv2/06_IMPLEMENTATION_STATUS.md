# حالة التنفيذ الرسمية — PM V2

> **آخر تحديث معتمد — 2026-09-22:** Phase 0–3 = **CLOSED / PASS**؛ Phase 4 = **IN PROGRESS**. ميزة **الصرف المخزني المتعدد (WIS)** المستقلة أصبحت **CLOSED / PASS** بعد قبول Runtime فعلي حتى Patch 129. الشاشات الأربع الحالية للصرف الفردي تبقى كما هي ولا تُحوَّل إلى WIS. نقطة الاستئناف التالية في Phase 4 هي **حل المادة غير الموجودة في الدليل (Unlisted / non-Catalog)** ثم إعادة تقييم المسار من الرصيد الحي. المرجع: `PHASE4_WIS_MULTI_ISSUE_CLOSURE_2026-09-22.md`.

> آخر تحديث معتمد: 2026-09-16 — Phase 2 CLOSED / PASS (final acceptance) — Phase 3 CLOSED / PASS (final acceptance, Patch 093) — Phase 4 IN PROGRESS; **Step 4.1 = CLOSED / PASS (Patch 101)**; **Step 4.2A = CLOSED / PASS (Patch 103)**; **Step 4.2B = CLOSED / PASS (Patch 108)**; **Team-Warehouse self-service full-stock path = RUNTIME PASS (Patch 114); partial-shortage warehouse handling defect found in runtime and addressed by Patch 115 = CODE-READY / BUILD PENDING**. Step 4.1 manual changed-stock recheck remains SKIPPED / ACCEPTED by explicit user decision; the partial-shortage scenario was later executed and is PASS. Mobile/Tablet manual verification remains DEFERRED to final program acceptance (Phase 6).
>
> ملاحظة: بوابة 2026-09-08 كانت إغلاقًا أوليًا قبل تحسينات القبول اللاحقة. الإغلاق النهائي المعتمد هو Patch 080 بتاريخ 2026-09-12 بعد قبول حمل الفرق، تحسينات التكرار، عنوان البرنامج، ونطاق Scheduler اليدوي. اختباران يدويان اختياريان تم تجاوزهما صراحة ويسجلان SKIPPED لا PASS.

## الحالة الحالية

**Phase 0 — CLOSED / PASS**

**المرحلة 1 — تأسيس الوحدة وربط البيانات الأساسية — CLOSED / PASS**

**المرحلة 2 — إعداد خطط الصيانة وتوليد المهام — CLOSED / PASS (final acceptance 2026-09-12)**

**المرحلة 3 — تنفيذ الفني للمهمات — CLOSED / PASS (final acceptance — Patch 093)**

**المرحلة 4 — المواد والمستودع والشراء والبلاغات — IN PROGRESS (Step 4.1 CLOSED / PASS; Step 4.2A CLOSED / PASS; Step 4.2B CLOSED / PASS)**





## Phase 2 — Step 2.4 — Scheduler / Task Generation / Idempotency — PASS

- أضيف Scheduler engine مستقل عن DB لسهولة الاختبار، وDB repository منفصل للتنفيذ الفعلي.
- أضيف Job مستقل `server/jobs/pmv2-scheduler.ts` وسجل Additive في `server/_core/index.ts` كل ساعة بدون تعديل Legacy PM job.
- التاريخ التشغيلي = Riyadh date-only.
- يولد Task واحدًا لكل Program Target + Due Date، ويجمع كل Checklist Items المستحقة في نفس Task.
- يمنع التوليد قبل Program creation date ويعيد التحقق من External Target عبر Adapter وقت التنفيذ.
- Team snapshot محفوظ على Task؛ title/order/source/date snapshots محفوظة على Task Item.
- Repository يعالج race/duplicate عبر DB UNIQUE contracts ويصلح partial generation عند إعادة التشغيل.
- Manual management endpoint `pmv2.scheduler.runForDate` متاح للتحقق المنضبط.
- Scheduler static contract = **7/7 PASS**.
- Scheduler runtime in-memory simulation = **5/5 PASS**؛ rerun = 0 duplicate tasks/items.
- Phase 2 standalone acceptance gate = **6/6 PASS**.
- جميع PM V2 standalone Node test files بعد Phase 2 = **21/21 PASS / 0 FAIL**.
- TypeScript syntax transpile gate للملفات المعدلة = **PASS**.
- Patch isolation: لا تعديل على Legacy PM/Ticket/Purchase/Inventory workflow source؛ التغيير المشترك الوحيد خارج PM V2 هو تسجيل Job جديد في bootstrap.

## Phase 2 Acceptance Gate — CLOSED / PASS

- [x] التكرارات الستة تولد Due dates الصحيحة.
- [x] Disabled item لا يولد Due.
- [x] Checklist reusable.
- [x] Program يربط Team + Checklist + Targets صحيحًا.
- [x] Task/Target grouping صحيح.
- [x] إعادة تشغيل Scheduler لا تنشئ duplicate Tasks/Items.
- [x] Team/Checklist-item snapshots صحيحة وقابلة للتتبع.
- [x] لا Regression منسوب إلى PM V2؛ Baseline الأعطال العامة يبقى PEND-001.

**الحالة الرسمية الجديدة:** Phase 2 = `CLOSED / PASS`. Phase 3 = `READY / NOT STARTED`.

## Phase 2 — Step 2.3 — Programs / Program Targets — PASS

- أضيف `server/pmv2/programs/service.ts` و`server/routers/pmv2/programs.ts`.
- Program يربط Team واحد + Checklist واحدة ويستخدم فقط PM V2 internal FKs الحالية.
- Team/Checklist يجب أن يكونا فعالين عند إنشاء/تغيير البرنامج.
- Program Target يمر عبر Exactly-One validation ثم `currentMaintenanceTargetAdapter.validateTarget` قبل الحفظ.
- Site/Section/Asset تبقى Master Data حالية بلا نسخ أو External FK.
- Duplicate Target داخل نفس Program يرفض قبل الكتابة وتدعمه قيود DB المجمدة.
- بعد وجود Task للبرنامج، يمنع تغيير Team/Checklist للحفاظ على trace؛ يمكن تعطيل البرنامج وإنشاء برنامج جديد بدل إعادة كتابة التاريخ.
- Program/Target mutations تسجل في Audit الحالي.
- لا Hard Delete للأهداف في runtime baseline الحالي.
- Step 2.3 standalone contract = **5/5 PASS**.
- **التالي:** Step 2.4 Scheduler + Task generation + Idempotency + Snapshots.

## Phase 2 — Step 2.2 — Recurrence semantics / Due calculation — PASS

- أضيف `server/pmv2/checklists/recurrence.ts` بحساب Date-only deterministic مستقل عن timezone.
- دعم فعلي للتكرارات الستة: Daily/Weekly/Monthly/Quarterly/Biannual/Annual.
- `frequencyValue` أصبح interval multiplier موثقًا؛ `NULL` = 1.
- Weekly يتطلب `weekday`، Monthly يتطلب `monthDay`، وQuarterly/Biannual/Annual تتطلب `anchorDate`.
- interval > 1 في Daily/Weekly/Monthly يتطلب `anchorDate` لضمان alignment deterministic.
- day 29/30/31 يـClamp إلى آخر يوم صالح في الشهر الأقصر؛ annual من 29-Feb يصبح 28-Feb في السنة غير الكبيسة.
- Disabled item لا يولد Due.
- `getNextPmv2DueDate` يوفر أول موعد على أو بعد تاريخ محدد؛ Scheduler لم يبدأ بعد.
- write validation حدث لرفض recurrence shapes المتعارضة قبل الحفظ.
- Step 2.2 recurrence contract = **6/6 PASS**.
- **التالي:** Step 2.3 Programs + Program Targets runtime management.

## Phase 2 — Step 2.1 — Reusable Checklists / Checklist Items — PASS

- بدأ التنفيذ بأمر المستخدم الصريح «نفذ الآن» بتاريخ 2026-09-08.
- أضيف `server/pmv2/checklists/service.ts` لإدارة Checklists وبنودها داخل حدود PM V2 فقط.
- أضيف `server/routers/pmv2/checklists.ts` وسجل داخل `pmv2` API namespace بصورة Additive.
- Checklists قابلة لإعادة الاستخدام، ولا يوجد Hard Delete؛ التعطيل/إعادة التفعيل عبر `isActive`.
- Checklist Items تستخدم write-boundary validation المركزي الموجود من Phase 1 قبل كل Create/Update، ولا تعتمد على TiDB CHECK المعطل.
- التكرارات الستة المجمدة مدعومة كبيانات إعداد: `daily | weekly | monthly | quarterly | biannual | annual`.
- Audit لكل Create/Update يعيد استخدام Audit Log الحالي؛ لا Audit master موازٍ.
- صلاحيات إعداد القوائم تعيد استخدام PM V2 management baseline الحالية؛ لا توسعة لصلاحيات الفني/المستودع.
- لا SQL جديد في هذه الخطوة؛ الجداول منفذة مسبقًا في Phase 1.
- Standalone Step 2.1 contract = **6/6 PASS**.
- جميع ملفات PM V2 Node المستقلة بعد التغيير = **16/16 test files PASS / 0 FAIL**.
- TypeScript syntax transpile check للملفات المعدلة = **PASS**.
- لم يتم تعديل Legacy PM أو Ticket/Purchase/Inventory workflows.
- **التالي:** Step 2.2 = تعريف/تنفيذ semantics حساب المواعيد للتكرارات (Due calculation) ثم Program/Target runtime حسب الترتيب؛ Scheduler لم يبدأ.

## ما تم في المرحلة 1 حتى الآن

- Namespace مستقل لـPM V2 مسجل Additive داخل App Router.
- Security baseline افتراضي مغلق لإدارة Foundation/Organization.
- PM V2 audit wrapper يعيد استخدام `audit_logs` والخدمة الحالية؛ لا Audit master موازٍ.
- Adapter contracts الأساسية للمستخدمين والمستودعات وأهداف الصيانة معرفة.
- DB Step 1 `pmv2_specialties` = PASS (`Query OK`).
- DB Step 2 `pmv2_teams` = PASS (`Query OK`) مع FK داخلي إلى Specialty وExternal indexes للمستودع/Device User.
- DB Step 3 `pmv2_team_members` = PASS (`Query OK`) مع FK داخلي إلى Team وUNIQUE `(teamId,userId)` و`userId` External Reference بلا FK.
- Organization service/router منفذ لـSpecialties/Teams/Team Members، مع soft activation/deactivation وعدم Hard Delete للتاريخ المستخدم.
- Users/Warehouses يتم التحقق منهم عبر Adapters عند الكتابة، والقراءة تستخدم JOIN مباشرًا عند الحاجة بلا Ownership جديد.
- إعادة عضو فريق سابق تعيد تفعيل نفس Membership row بدل Duplicate history row.
- Maintenance Target adapter/router منفذ لـ`Site | Section | Asset` من Master Data الحالية فقط، مع فحص Site→Section→Asset وعدم إنشاء Location master موازٍ.
- DB Step 4 `pmv2_checklists` = PASS (`Query OK`, 0 rows affected).
- المستخدم نفذ DDL لـDB Step 5 (`pmv2_checklist_items`)؛ TiDB أعاد ستة تحذيرات لأن `tidb_enable_check_constraint` = OFF. لم نفعل المتغير العام.
- أضيف `server/pmv2/checklists/validation.ts` كـwrite-boundary contract للقيم التي كانت ستعتمد على `CHECK`، مع اختبار Node مستقل = PASS (5/5).
- تم حذف `CHECK` من Drizzle/SQL baseline حتى لا يدعي Source of Truth قيودًا لم تنشأ فعليًا في TiDB.
- DB Step 5 `pmv2_checklist_items` = **PASS** بعد `SHOW CREATE TABLE`: الجدول موجود، الـFK الداخلي إلى `pmv2_checklists` والـIndexes الأساسية موجودة، و`CHECK` غير موجودة في البنية الفعلية. وظائف Checklist/Recurrence نفسها تبقى للمرحلة 2.
- لم يتم تعديل Ticket/Purchase/Inventory workflows الحالية لأجل PM V2.
- Legacy PM لم تمس.

## سياسة External References المؤكدة 2026-09-07

- Internal PM V2 relations تستخدم Physical FKs.
- مراجع `users/sites/sections/assets/warehouses` تبقى IDs بلا Physical FK.
- يوضع Index مناسب على External IDs التي تحفظ داخل PM V2.
- التحقق من وجود/صلاحية المرجع يتم عبر Adapter عند الكتابة أو التعديل.
- القراءة يمكنها استخدام JOIN مباشر داخل قاعدة `cmms`؛ FK ليس شرطًا للـJOIN.

## Phase 0 — ما تم إغلاقه

- Existing Capability Audit.
- Schema context = `cmms`.
- Users/Organization Reality Check.
- Organization hierarchy = `Specialty → Team → Members`.
- Maintenance Target Reality Check = `Site | Section | Asset`.
- Live Site/Section/Asset relationship validation بعد تصحيح البيانات اليدوي للمستخدم.
- Material Recipient Attribution.
- Purchase Source/Handoff Reality Check.
- `packageId` Reality Check.
- Ticket Workflow reuse A/B/C contract.
- Task/Task Item State Machines.
- Material Request Item State Machine + Transition Ownership.
- Adapter boundaries.
- Closure rules.
- Final ERD Freeze.
- Documentation consistency cleanup.
- Phase 0 Acceptance Gate.

## العقود المجمدة

### Organization
`Specialty → Team → Members`

### Targets
`Site | Section | Asset`

### Technician Results
`ok | fixed | needs_material | needs_ticket`

### Task Item
`pending | in_progress | waiting_material | waiting_ticket | ready_to_complete | completed`

### Task
`pending | in_progress | waiting_material | waiting_ticket | ready_to_complete | completed | cancelled`

### Material Request Item
`waiting_warehouse | external_purchase | received_warehouse | issued_to_team | consumed | cancelled`

### Purchase
`Material Request Item → pmv2_material_purchase_links → PO/PO Item`

PO يعيد استخدام Purchase Workflow الحالي بالكامل.

### Ticket
`Task Item → pmv2_task_ticket_links → Ticket`

Ticket يعيد استخدام Workflow الحالي ومسارات A/B/C بالكامل.

## Acceptance Gate Phase 0

**PASS** للأسباب التالية:

- Source of Truth محددة لكل مجال.
- لا Duplicate Master Data في ERD النهائي.
- Reality Checks المطلوبة للقرارات التصميمية مكتملة.
- State/Ownership/Adapter contracts مجمدة.
- ERD/Cardinality/External Reference policy مجمدة.
- لا بند Pending بطلب المستخدم يمنع الإغلاق.
- لا يوجد تصميم قديم متعارض في المرجع الرسمي بعد Cleanup.

ملاحظة: Phase 0 Design Gate لا تدعي نجاح Runtime build/tests؛ لم يبدأ كود PM V2 أصلًا. Runtime gates تبدأ مع مراحل التنفيذ.

## نقطة توقف تاريخية بعد Phase 1 — SUPERSEDED

**في ذلك الوقت: Phase 1 — CLOSED / PASS.**

**في ذلك الوقت: Phase 2 — READY / NOT STARTED.**

> هذه النقطة تاريخية فقط. الحالة الحالية المعتمدة أعلى الملف: **Phase 2 — CLOSED / PASS، Phase 3 — READY / NOT STARTED.**

- DB Steps 1–5 = **PASS**.
- الخطوتان المدمجتان Organization وربط Targets منفذتان على مستوى الكود والعقود الساكنة.
- DB Step 5 (`pmv2_checklist_items`) = **PASS** بعد readback فعلي للبنية.
- DB Step 6 (`pmv2_programs`) = **PASS** (`Query OK`, 0 rows affected).
- DB Step 7 `pmv2_program_targets` = **PASS** (`Query OK`, 0 rows affected)؛ Exactly One target يفرض في PM V2 write boundary، والمراجع الخارجية بلا FK.
- DB Step 8 `pmv2_tasks` = **PASS** (`Query OK`, 0 rows affected).
- DB Step 9 `pmv2_task_items` = **PASS** (`Query OK`, 0 rows affected)؛ لا Technician execution أو state transitions تشغيلية في هذه الخطوة.
- DB Step 10 `pmv2_visits` = **PASS** (`Query OK`, 0 rows affected)؛ Visit لا تغلق Task تلقائيًا.
- DB Step 11 `pmv2_visit_members` = **PASS** (`Query OK`, 0 rows affected)؛ `userId` External Reference مفهرس بلا FK إلى `users`، وUNIQUE يمنع تكرار العضو داخل الزيارة.
- DB Step 12 `pmv2_item_actions` = **PASS** (`Query OK`, 0 rows affected)؛ internal FKs إلى Task Item/Visit، و`performedById` External Reference مفهرس بلا FK إلى `users`.
- DB Step 13 `pmv2_material_requests` = **PASS** (`Query OK`, 0 rows affected)؛ Header بلا Status مستقل، مع internal FKs إلى Task Item/Visit/Team، و`requestedById`/`teamWarehouseId` External References مفهرسة بلا FK خارجي.
- DB Step 14 `pmv2_material_request_items` = **PASS** (`Query OK`, 0 rows affected)؛ internal FK إلى Material Request، و`catalogItemId` External Reference مفهرس بلا FK خارجي. Quantity invariants تفرض في PM V2 validation بسبب TiDB CHECK policy الحالية.
- DB Step 15 `pmv2_material_purchase_links` = **PASS** (`Query OK`, 0 rows affected)؛ internal FK إلى Material Request Item، بينما PO/PO Item/Creator مراجع خارجية مفهرسة بلا Physical FK. لا Purchase Workflow write من PM V2.
- DB Step 16 `pmv2_task_ticket_links` = **PASS** (`Query OK`, 0 rows affected)؛ internal FK إلى Task Item، بينما Ticket/Creator مراجع خارجية مفهرسة بلا Physical FK. لا Ticket status/path duplication ولا Ticket Workflow write.
- DB Step 17 `pmv2_material_usages` = **PASS** (`Query OK`, 0 rows affected)؛ internal FKs إلى Task Item/Visit وnullable Material Request Item، بينما Inventory/Delivery/Warehouse/Catalog/PO Item/User references تبقى خارجية مفهرسة بلا Physical FK. الجدول Trace/Audit فقط ولا يخصم Stock.
- DB Step 18 `pmv2_request_reminders` = **PASS** (`Query OK`, 0 rows affected)؛ آخر جدول Schema في المرحلة 1. internal FK إلى Material Request، بينما Recipient/Notification/Creator مراجع خارجية مفهرسة بلا Physical FK. يعيد استخدام Notification service الحالية ولا يملك Notification status/workflow.
- جميع 18 جدولًا في Final ERD أصبحت **PASS** على مستوى التنفيذ اليدوي المؤكد من المستخدم.
- Standalone PM V2 Node suite = **PASS 63/63**، وPhase 1 standalone acceptance gate = **PASS 6/6**.
- فحص Syntax/relative-import paths للملفات الجديدة = **PASS**.
- Diff isolation check: لا ملفات Legacy PM/Ticket/Purchase/Inventory workflow عُدلت لصالح PM V2؛ التعديل على الملفات المشتركة محصور في `drizzle/schema.ts` وإضافة `pmv2` إلى App Router.
- Full Vitest / full project Typecheck / Build ما زالت **PENDING** بسبب عدم توفر `node_modules` وعدم اكتمال `npm ci` في بيئة العمل؛ لذلك **Phase 1 Acceptance Gate لم تُغلق بعد**.


### Current DB checkpoint — 2026-09-08

- DB Step 6 runtime confirmed on 2026-09-08: `pmv2_programs` = PASS (`Query OK`, 0 rows affected).
- DB Step 7 runtime confirmed on 2026-09-08: `pmv2_program_targets` = PASS (`Query OK`, 0 rows affected).
- DB Step 8 runtime confirmed on 2026-09-08: `pmv2_tasks` = PASS (`Query OK`, 0 rows affected).
- DB Step 9 runtime confirmed on 2026-09-08: `pmv2_task_items` = PASS (`Query OK`, 0 rows affected).
- DB Step 10 runtime confirmed on 2026-09-08: `pmv2_visits` = PASS (`Query OK`, 0 rows affected).
- DB Step 11 runtime confirmed on 2026-09-08: `pmv2_visit_members` = PASS (`Query OK`, 0 rows affected).
- DB Step 12 runtime confirmed on 2026-09-08: `pmv2_item_actions` = PASS (`Query OK`, 0 rows affected).
- DB Step 13 runtime = PASS: `pmv2_material_requests`.
- DB Step 14 runtime = PASS: `pmv2_material_request_items`.
- DB Step 15 runtime = PASS: `pmv2_material_purchase_links`.
- DB Step 16 runtime = PASS: `pmv2_task_ticket_links`.
- DB Step 17 runtime = PASS: `pmv2_material_usages`.
- DB Step 18 runtime = PASS: `pmv2_request_reminders` (last Phase 1 schema table).
- Program Target standalone validation test = PASS (5/5).
- Task schema standalone contract test = PASS (4/4): internal FKs, unique task number, scheduler idempotency key, frozen states.
- Task Item schema standalone contract test = PASS (5/5): internal FKs, frozen snapshots, generation uniqueness, frozen states/results.
- Visit schema standalone contract test = PASS (4/4): internal Task FK, start/end timestamps, no external Master Data FK.
- No external FK to `sites/sections/assets`; Exactly One target is a PM V2 write-boundary invariant plus Adapter validation.


### DB Step 10 PASS / DB Step 11 preparation — 2026-09-08

- DB Step 10 `pmv2_visits` runtime confirmed by user: PASS (`Query OK`, 0 rows affected).
- DB Step 11 `pmv2_visit_members` prepared as Schema foundation only.
- Internal FK: `visitId → pmv2_visits.id`.
- `userId` remains an indexed External Reference with no FK to `users`; validation uses the existing Users Adapter when runtime write paths are implemented.
- UNIQUE `(visitId, userId)` prevents duplicate membership in the same Visit.
- `isLeader` stores the leader marker; leader-selection runtime rules remain Phase 3.
- Standalone schema contract = PASS (5/5).


### DB Step 11 PASS / DB Step 12 preparation — 2026-09-08

- DB Step 11 `pmv2_visit_members` runtime confirmed by user: PASS (`Query OK`, 0 rows affected).
- DB Step 12 `pmv2_item_actions` prepared as Schema foundation only.
- Internal FKs: `taskItemId → pmv2_task_items.id` and `visitId → pmv2_visits.id`.
- `performedById` remains an indexed External Reference with no FK to `users`.
- Frozen technician result values are represented exactly.
- Evidence reuses the existing `attachments` service; no PM V2 attachment master/table is introduced.
- Standalone schema contract = PASS (5/5).


### DB Step 12 PASS / DB Step 13 preparation — 2026-09-08

- DB Step 12 `pmv2_item_actions` runtime confirmed by user: PASS (`Query OK`, 0 rows affected).
- DB Step 13 `pmv2_material_requests` prepared as Schema foundation only.
- Header stores no independent Status; request state remains derived from Material Request Items.
- Internal FKs: `taskItemId → pmv2_task_items.id`, `visitId → pmv2_visits.id`, `teamId → pmv2_teams.id`.
- `requestedById` and `teamWarehouseId` remain indexed External References with no physical FK to `users` or `warehouses`.
- Multiple historical Material Requests for the same Task Item remain allowed.
- Standalone schema contract = PASS (5/5).


### DB Step 13 PASS / DB Step 14 preparation — 2026-09-08

- User runtime confirmation: `pmv2_material_requests` = **PASS** (`Query OK`, 0 rows affected).
- Prepared `pmv2_material_request_items` Schema foundation only.
- `requestId` uses internal PM V2 FK; `catalogItemId` remains indexed External Reference with no physical FK to `catalog_items`.
- Frozen Material Request Item states are represented exactly.
- `requestedQuantity > 0` and non-negative received/issued projections are enforced by PM V2 write-boundary validation because TiDB CHECK enforcement is disabled in the live environment.
- No Inventory/Purchase workflow writes or state transitions are activated in this step.


### DB Step 14 PASS / DB Step 15 preparation — 2026-09-08

- User runtime confirmation: `pmv2_material_request_items` = **PASS** (`Query OK`, 0 rows affected).
- Prepared `pmv2_material_purchase_links` Schema foundation only.
- `materialRequestItemId` uses an internal PM V2 FK.
- `purchaseOrderId`, `purchaseOrderItemId`, and `createdById` remain indexed External References without physical FKs to existing Purchase/User tables.
- `purchaseOrderItemId` is UNIQUE in the link table; `(materialRequestItemId, purchaseOrderItemId)` is also UNIQUE.
- `linkedQuantity > 0` and aggregate allocation `<= requestedQuantity` are PM V2 write-boundary invariants because current TiDB CHECK enforcement is disabled.
- Purchase Adapter must verify that the PO Item belongs to the referenced PO before persistence.
- No PO state is copied into PM V2 and no Purchase workflow is executed or modified by this schema step.
- DB Step 15 standalone schema contract = PASS (6/6)؛ quantity validation smoke = PASS (4 cases).


### DB Step 15 PASS / DB Step 16 preparation — 2026-09-08

- User runtime confirmation: `pmv2_material_purchase_links` = **PASS** (`Query OK`, 0 rows affected).
- Prepared `pmv2_task_ticket_links` Schema foundation only.
- `taskItemId` uses an internal FK to `pmv2_task_items.id`.
- `ticketId` and `createdById` remain indexed External References without physical FKs to existing Ticket/User tables.
- `ticketId` is UNIQUE so one existing Ticket has one unambiguous PM V2 source.
- `taskId` is intentionally not duplicated because it is derived from `taskItemId`.
- PM V2 stores no Ticket status or maintenance path; existing Ticket Workflow remains Source of Truth.
- Domain rule “no more than one active open Ticket per Task Item” remains Adapter/runtime validation because Ticket status is externally owned.
- DB Step 16 standalone schema contract = PASS (5/5).


### DB Step 16 PASS / DB Step 17 preparation — 2026-09-08

- User runtime confirmation: `pmv2_task_ticket_links` = **PASS** (`Query OK`, 0 rows affected).
- Prepared `pmv2_material_usages` Schema foundation only.
- Internal FKs: `taskItemId → pmv2_task_items.id`, `visitId → pmv2_visits.id`, and nullable `materialRequestItemId → pmv2_material_request_items.id`.
- `materialRequestItemId` stays nullable when the consumed material existed already in Team Warehouse and no PM V2 Material Request was needed.
- Warehouse/Catalog/Inventory Transaction/Lot/Delivery Document/PO Item/Recorder remain indexed External References without physical FKs to existing-system tables.
- `usedQuantity > 0` is a PM V2 write-boundary invariant because live TiDB CHECK enforcement remains disabled.
- Material Usage is Trace/Audit only; PM V2 performs no direct stock decrement and stores no Inventory workflow status.
- DB Step 17 standalone schema contract = PASS (5/5); usage write-boundary validation smoke = PASS (5/5).


### DB Step 17 PASS / DB Step 18 preparation — 2026-09-08

- User runtime confirmation: `pmv2_material_usages` = **PASS** (`Query OK`, 0 rows affected).
- Reality Check: the current system already owns `notifications` plus notification/Web Push services.
- Prepared `pmv2_request_reminders` as trace/source metadata only; no parallel notification workflow or duplicate title/message/status.
- Internal FK: `requestId → pmv2_material_requests.id`.
- `recipientUserId`, nullable `notificationId`, nullable `createdById` are indexed External References with no physical external FKs.
- `reminderType` is a flexible `VARCHAR(50)` implementation label, not an ENUM; Phase 5 owns final reminder rules and scheduling.
- Multiple historical reminders for a Material Request remain allowed.
- DB Step 18 standalone schema contract = PASS (5/5).
- After DB Step 18 runtime PASS: run Phase 1 Acceptance Gate; do not start Phase 2 automatically.


## Phase 1 Acceptance Gate checkpoint — 2026-09-08

- [x] DB Steps 1–18 runtime confirmed PASS by user.
- [x] Final ERD table count = 18/18 represented in Drizzle schema and DDL patches.
- [x] Organization boundary implemented: Specialty → Team → Members.
- [x] Site | Section | Asset adapter read/validation boundary implemented without duplicate Master Data.
- [x] Security policy is explicit/default-deny for Phase 1 management endpoints.
- [x] Audit wiring reuses the current `audit_logs` service with `pmv2.*` namespace.
- [x] Standalone PM V2 tests: 63/63 PASS.
- [x] Standalone Phase 1 acceptance gate: 6/6 PASS.
- [x] Syntax/relative-import-path gate: PASS.
- [x] Patch isolation review: no Legacy PM/Ticket/Purchase/Inventory workflow source file changed by PM V2 patches.
### Project-wide baseline checks — non-blocking for PM V2 Phase 1 closure

- [ ] Full project Typecheck — no result supplied in the 2026-09-08 pasted run.
- [x] Full Vitest suite executed — `531 passed / 20 failed`; failures are outside PM V2 and tracked as `PEND-001`.
- [x] Production build completed successfully, with non-PMV2 warnings tracked under `PEND-001`.
- [ ] Full application runtime regression smoke — deferred with the project-wide baseline review; no PM V2-attributed regression identified in patch isolation.

**Gate result:** `CLOSED / PASS` لـPM V2.

قرار الإغلاق يعتمد على PM V2-scoped evidence: DB Steps 1–18 = PASS، standalone PM V2 tests = 63/63 PASS، standalone Phase 1 gate = 6/6 PASS، patch isolation = PASS، وProduction build للمشروع اكتمل. أعطال Full Vitest العامة خارج PM V2 تم عزلها وتوثيقها في `pending/PENDING_ITEMS.md` كـ`PEND-001` للمراجعة لاحقًا، ولا تُنسب إلى PM V2 ولا تمنع إغلاق Phase 1.

**هذه كانت نتيجة بوابة Phase 1 في ذلك الوقت: Phase 2 = READY / NOT STARTED. وهي مستبدلة بالحالة الحالية: Phase 2 = CLOSED / PASS، Phase 3 = READY / NOT STARTED.**

## Post-Phase 2 testability UI — 2026-09-08 — Scheduled Maintenance

- الاسم المعتمد في السايدبار: **الصيانة المجدولة**.
- أضيف مسار مستقل `/scheduled-maintenance` بدون تعديل `/preventive` الخاص بـLegacy PM.
- أضيفت لوحة إدارة/اختبار للمرحلتين 1–2 بأربع تبويبات:
  1. التخصصات والفرق والأعضاء وربط المستودع الحالي.
  2. قوائم الصيانة وبنودها وإعدادات التكرار.
  3. برامج الصيانة وربط Site | Section | Asset من Master Data الحالية.
  4. تشغيل Scheduler يدويًا لتاريخ محدد وعرض المهام وبنودها التاريخية Read-only.
- أضيف `pmv2.tasks` read-only router لعرض المهام المولدة وبنودها؛ لا توجد Mutation لتغيير Task/Task Item في هذه الواجهة.
- لا يوجد SQL جديد ولا Schema change.
- لا توجد كتابة إلى Legacy PM/Ticket/Purchase/Inventory workflows.
- PM V2 standalone suite بعد التعديل: **71/71 PASS**.
- Phase 2 تبقى `CLOSED / PASS`، وPhase 3 تبقى `READY / NOT STARTED`.

### 2026-09-08 — Phase 2 manual regression fix: disabled Specialty must stop scheduling
- Manual UI acceptance testing exposed a real defect: disabling a Specialty did not stop new tasks while its Team remained active.
- Root Cause: `Pmv2DbSchedulerRepository.listActivePrograms()` filtered active Program, Team, and Checklist but did not join/filter `pmv2_specialties`.
- Fix: scheduler eligibility now joins `pmv2_specialties` through `pmv2_teams.specialtyId` and requires `pmv2_specialties.isActive = 1`.
- Scope remains PM V2 only. No Legacy PM, Ticket, Purchase, or Inventory workflow changed.
- Historical test tasks created while reproducing the defect are not auto-deleted.
- Phase 2 remains CLOSED / PASS after regression validation.
- Post-fix standalone PM V2 regression suite: 23/23 test files PASS, 0 FAIL.

### 2026-09-09 — Patch 058: biweekly runtime/backfill verification + manual-date clarity
- Investigated the manual `frequencyValue = 2` weekly case (`weekday=Monday`, `anchorDate=2026-06-01`) after an existing 2026-09-21 task showed only its older historical snapshots.
- Root cause of the observed manual result: the task browser date filter was changed to 2026-09-21, but the manual scheduler `runDate` is a separate control and had not been rerun for that date after the biweekly item was added.
- Production recurrence/scheduler logic was verified with an exact existing-task backfill runtime regression: rerunning 2026-09-21 adds the due biweekly item to both existing target tasks; 2026-09-14 remains non-due for the biweekly item.
- No recurrence production-code change was required.
- UI now states that scheduler execution date is independent from task-list filters and offers **استخدام تاريخ البحث** when `كل المهام` has one exact date selected.
- Phase 2 remains CLOSED/PASS; Phase 3 remains READY / NOT STARTED pending explicit execution.

### 2026-09-09 — Patch 059: task-item recurrence provenance snapshot
- Manual acceptance testing showed that historical task-item cards were hard to interpret because they displayed only title/order/status without the recurrence rule that caused the item to be due.
- Decision: store structured recurrence snapshots on `pmv2_task_items` for all newly generated task items and render a small recurrence badge in Scheduled Maintenance.
- Snapshot fields: `frequencySnapshot`, `frequencyValueSnapshot`, `weekdaySnapshot`, `monthDaySnapshot`, `anchorDateSnapshot`.
- Existing pre-patch rows remain compatible: when their snapshot is NULL, the read service falls back to the current source checklist item for display. This fallback is explicitly best-effort; new rows are the authoritative historical snapshot.
- Database change is additive and isolated to PM V2. One manual ALTER is required; Phase 2 remains CLOSED/PASS and Phase 3 remains READY/NOT STARTED.

### 2026-09-09 — Patch 060: historical task-item read fix
- Patch 059 generation path was confirmed to create new task items, but the historical read path failed because `pmv2ChecklistItems` was referenced without being imported.
- Patch 060 adds only the missing schema import plus regression coverage; no scheduler/recurrence behavior is changed.
- Patch 059 database ALTER is already confirmed `Query OK`; Patch 060 requires no SQL.
- Phase 2 remains CLOSED/PASS; Phase 3 remains READY/NOT STARTED.

### Patch 061 — exact-date browsing reliability (2026-09-09)
- `كل المهام` exact-day filtering hardened after manual evidence of a false zero-result state for an existing task date.
- Query errors are no longer silently rendered as empty data.
- Phase 2 remains CLOSED / PASS; Phase 3 remains READY / NOT STARTED.

### Patch 062 — program target option simplification (2026-09-09)
- The Program target selector now removes Sites/Sections/Assets already linked to the currently selected PM V2 program.
- Filtering is per-program only; the same Master Data target may still be linked to another program when valid.
- A successful link refetches the program and the newly linked target disappears immediately from the selector.
- Switching programs clears a stale target selection and recomputes availability.
- Backend duplicate validation remains unchanged as a safety guard.
- No SQL. Phase 2 remains CLOSED/PASS; Phase 3 remains READY / NOT STARTED.

### Patch 063 — checklist recurrence interval validation (2026-09-09)
- Manual acceptance exposed a UI/service-boundary mismatch: the backend validator already rejected supplied `frequencyValue <= 0`, but Scheduled Maintenance used `Math.max(1, Number(frequencyValue))`, silently converting `0` and negative values to `1` before the request reached the service.
- Removed the silent clamp. The UI now requires a whole number `>= 1`, blocks submit with a clear Arabic message, and preserves the existing `1 => NULL` storage convention.
- Backend validation remains authoritative and now emits the same user-facing Arabic message for invalid supplied values.
- Existing invalid rows created during manual testing are left untouched; they may be disabled manually after verification. No automatic cleanup and no SQL.
- Phase 2 remains CLOSED/PASS; Phase 3 remains READY / NOT STARTED.

## Patch 064 — simplified recurrence UX and custom schedules (2026-09-09)
- Acceptance hardening inside official Phase 2; Phase 3 remains **READY / NOT STARTED**.
- Replaced the manager-facing `frequency + كل كم دورة + تاريخ الارتكاز` form with plain-language presets:
  - يوميًا، كل أسبوع، كل أسبوعين، كل شهر، ربع سنوي، نصف سنوي، سنوي، مخصص.
- Normal presets hide technical cycle/anchor fields and show only the information the manager needs (day/week/month placement).
- Custom recurrence supports:
  - multiple weekdays;
  - multiple month days plus explicit last-day-of-month;
  - multiple dates inside each calendar quarter;
  - multiple dates during the year;
  - configurable interval and a plain `ابدأ التكرار من` date only when interval > 1.
- New schedules persist a versioned `scheduleConfigJson` while legacy recurrence columns remain for backward compatibility.
- Generated task items now persist `recurrenceLabelSnapshot`, so historical task details keep the human-readable schedule that produced the item.
- Existing legacy checklist items and historical task items continue to render using the old snapshot fields when the new fields are null.


## Patch 065 — Team workload foundation (2026-09-10)
Execution started for the approved simple workload design. Step 1 adds an optional estimated duration in minutes to PM V2 programs. This remains Phase 2 hardening/extension; Phase 3 is not started. The duration will later drive daily team-load indicators without blocking multiple tasks for the same team/day.

### Patch 066 — workload foundation UX
Program estimated duration is now editable from a clear manager-facing `تعديل البرنامج` panel. The API persists the optional duration field introduced in Patch 065. Daily workload calculation/view is still pending inside Phase 2 acceptance hardening; Phase 3 has not started.

## Patch 067 — Daily team workload calculation/status (2026-09-12)
- Phase 2 workload hardening continues; Phase 3 is still **READY / NOT STARTED**.
- Added a PM V2-only daily workload calculation over already-generated tasks, grouped by `teamId + dueDate`.
- Workload uses each task's program `estimatedDurationMinutes`; multiple tasks for the same team/day remain allowed and are summed rather than blocked.
- Initial planning baseline is one 8-hour day: `متاح` through 4h, `متوسط` above 4h through 6h, `مرتفع` above 6h through 8h, `تعارض` above 8h.
- Cancelled tasks are excluded. Completed tasks remain part of the day's workload history.
- Missing duration values are not silently invented: the API returns `unknownDurationTaskCount` and `estimateComplete=false` when a daily total is incomplete.
- Added read-only `pmv2.tasks.dailyWorkload` with date range + optional team filter. No SQL and no Legacy PM/Ticket/Purchase/Inventory workflow changes.
- Patch 066 manual acceptance is now PASS: duration display (`120` → `ساعتان`, `100` → `1 س 40 د`) and historical team/checklist protection were both manually confirmed.
- Next approved Phase 2 step after Patch 067 is the simple manager-facing **حمل الفرق** view consuming this calculation.

## Patch 068 — Simple team workload view (2026-09-12)
- Added the manager-facing **حمل الفرق** tab on top of Patch 067 daily workload calculations.
- Default view is one week (Sunday–Saturday) with one row per active team and one compact cell per team/day.
- Each populated cell shows task count, total estimated duration, and the existing workload status; incomplete estimates are explicitly shown as `مدة ناقصة`.
- Week navigation is intentionally limited to previous/current/next week to keep the page simple.
- Clicking a populated cell shows that team's non-cancelled tasks for the selected day below the matrix.
- Added an `excludeCancelled` task-list read filter only to keep cell details aligned with workload totals.
- No SQL, no recurrence change, no individual-member allocation, no Legacy PM change, and Phase 3 remains NOT STARTED.

## Patch 069 — Operational workload readability (2026-09-12)
- Kept **حمل الفرق** as a simple weekly matrix while making the current week operationally useful.
- Current-week default is now **من اليوم وما بعده**; the manager can switch to **الأسبوع كامل** without leaving the page.
- Today is visually highlighted; elapsed current-week days are subdued when full-week history is shown; future days remain prominent.
- Added one simple active-team filter and reused the existing optional `teamId` workload filter; no new backend endpoint or SQL was required.
- Added a separate overdue count using the existing task-list query (`overdueBefore=today`, unfinished only). Overdue tasks remain on their original due date and are not rolled automatically into today's workload.
- Previous/future weeks continue to show all seven days; no advanced filters, time slots, member allocation, or rescheduling mutation were added.
- Phase 3 remains NOT STARTED.

## Patch 070 — Direct overdue navigation from workload (2026-09-12)
- Manual acceptance for Patch 069 is PASS for the current-week focus, full-week review, active-team filter, and visible overdue alert.
- Made the overdue alert in **حمل الفرق** directly actionable.
- Clicking it opens **المهام المجدولة** with the existing **المتأخرة** scope active.
- If a workload team filter is selected, the same team is carried into the task-list filter so only that team's overdue tasks are shown.
- Reuses existing task-list filters only; no due-date mutation, no automatic rollover, no backend/SQL change, and Phase 3 remains NOT STARTED.


## Patch 071 — Phase 2 workload acceptance checkpoint (2026-09-12)
- نتائج الاختبار اليدوي الموثقة حتى Patch 070 أصبحت PASS: عرض اليوم وما بعده، الأسبوع كامل، فلتر فريق واحد، تنبيه المتأخرات، والانتقال المباشر للمتأخرة مع الاحتفاظ بالفريق.
- مراجعة التنفيذ لم تجد حاجة لإضافة فلتر أو منطق تخطيط جديد قبل الإغلاق؛ هدف الشاشة يبقى النظرة الأسبوعية السريعة مع تفاصيل عند الطلب.
- لا توجد إضافة Runtime أو SQL في هذا الباتش؛ التغيير هو توحيد حالة التوثيق + تشديد اختبار الانحدار لتفاصيل خلية اليوم.
- يبقى اختبار يدوي واحد مرتبط بميزة موجودة منذ Patch 068 قبل اعتبار نطاق `حمل الفرق` مقبولًا بالكامل: الضغط على خلية ممتلئة والتحقق من تفاصيل نفس الفريق/اليوم.
- Phase 3 تبقى **READY / NOT STARTED** ولا تبدأ تلقائيًا.

## Patch 072–074 acceptance hardening — 2026-09-12
- Patch 072 session-stability hotfix manually passed; repeated Scheduled Maintenance navigation/refresh no longer produced the reported false logout during the smoke test.
- Patches 068–073 workload manual acceptance is complete: weekly navigation, today-forward focus, team filter, overdue navigation, cell detail switching, count/duration agreement, and task-duration detail all passed. `حمل الفرق` is accepted for current Phase 2 scope.
- Acceptance then returned to Patch 064 custom recurrence. The first multi-weekday custom item saved correctly, but exposed a manager UX defect: checklist item order displayed as `0` because the UI supplied the schema default directly.
- Patch 074 removes manual order entry and makes normal checklist-item creation auto-ordered from `1`; no SQL is required.
- Phase 2 remains **IN PROGRESS — final hardening/acceptance** until the remaining recurrence manual checks finish. Phase 3 remains **READY / NOT STARTED**.

## Patch 075 — checklist-item form reset after successful save (2026-09-12)
- Phase 2 remains **IN PROGRESS — final hardening/acceptance**; Phase 3 remains **READY / NOT STARTED**.
- Fixed the checklist-item add form so successful creation resets all item-specific recurrence controls instead of retaining the previous schedule configuration.
- The selected checklist remains open and is refetched after create; only the add-item form state resets.
- Default reset state is the existing normal monthly schedule (`شهري`, day `1`), with all custom arrays/selections cleared and custom interval restored to `1`.
- No backend, database, scheduler, Legacy PM, or historical snapshot change.

## Patch 076 — manager-friendly recurrence wording (2026-09-12)
- Phase 2 remains **IN PROGRESS — final hardening/acceptance**; Phase 3 remains **READY / NOT STARTED**.
- Replaced technical custom-schedule wording with manager-facing `التكرار حسب` + `فترة التكرار` and a live `المعنى` explanation.
- Humanized interval labels consistently across client/server schedule labels: daily/weekly/monthly/yearly plus quarter/half-year values expressed as understandable month/year spans (`2 quarters` → `كل 6 أشهر`, `4 quarters` → `كل سنة`).
- Added contextual guidance that weekly/monthly/quarterly/yearly custom schedules may contain one or several execution dates inside each due cycle.
- Quarterly appointment chips and saved summaries now use ordinal month wording (`الشهر الأول/الثاني/الثالث`) instead of numeric technical positions.
- No scheduler/due-date semantics, DB schema, historical-row rewrite, or Legacy PM workflow change.


## Patch 077 — Two-question recurrence UX (2026-09-12)
- Phase 2 remains **IN PROGRESS — final hardening/acceptance**; Phase 3 remains **READY / NOT STARTED**.
- Simplified custom recurrence to two manager questions: **متى يتكرر الفحص؟** then **متى يتم التنفيذ؟**.
- Replaced the separate `التكرار حسب` / `فترة التكرار` / `المعنى` presentation with one readable sentence: **يتكرر الفحص كل [رقم] [وحدة]** plus a plain **النتيجة**.
- Renamed the optional anchor-facing field to **يبدأ هذا النمط من**.
- No scheduler, due-date, `scheduleConfigJson`, database, historical snapshot, or Legacy PM behavior changed.


## Patch 078 — Optional manager-facing program title (2026-09-12)
- Added nullable `pmv2_programs.title` after the user manually confirmed the one SQL statement with `Query OK`.
- Create/edit program UX now accepts an optional title, program cards/detail use it when present, and program search includes it.
- Existing programs with no title continue to display `برنامج #N`; no backfill is required.
- Title remains editable after task generation because it does not change team/checklist historical ownership.
- Phase 2 remains **IN PROGRESS — final hardening/acceptance**; Phase 3 remains **READY / NOT STARTED**.

## Patch 079 — Due-only manual Scheduler program scope (2026-09-12)
- Added read-only `pmv2.scheduler.duePrograms(date)` using the same active-program/checklist recurrence checks as the production engine.
- Manual `runForDate` now accepts an optional `programId`; when omitted, behavior remains the existing all-active-program scheduler run.
- The manager test panel can choose **كل البرامج المستحقة** or **برنامج محدد**, and the specific-program list is populated only from programs due on the selected date.
- Automatic hourly scheduler behavior is unchanged because its call still omits `programId`.
- No SQL, no Legacy PM change, and Phase 3 remains **READY / NOT STARTED**.


## Patch 080 — Phase 2 final acceptance closure (2026-09-12)
- **Phase 2 is officially CLOSED / PASS** after the user completed the current manual acceptance path and explicitly approved closure.
- `حمل الفرق` is accepted for the current Phase 2 scope: weekly/current-day focus, team filter, overdue navigation, populated-cell details, duration reconciliation, and workload states all passed manually.
- Custom recurrence manager UX is accepted: multi-weekday weekly patterns, multi-day monthly patterns, annual multi-date setup, daily custom intervals, and the two-question wording all passed manual UI checks.
- Program title create/edit/display/search passed manually; Program #3 title search was explicitly confirmed working.
- Patch 079 manual Scheduler scope passed: due-only program selector, selected-program run, all-due-program run, correct generated date visibility, and rerun idempotency were manually verified.
- Two additional optional runtime checks were explicitly **SKIPPED by user decision**, not counted as PASS:
  1. `كل 3 أيام` anchor-date Scheduler due/non-due runtime check.
  2. Scheduler runtime check for one custom schedule containing multiple dates in the same cycle.
- These skipped checks do not block the user-approved Phase 2 closure because the underlying recurrence/Scheduler contracts and regressions remain covered by automated tests and prior runtime acceptance; the skip is preserved transparently in `09_TESTING.md`.
- No SQL is required for Patch 080. No runtime behavior changes. Phase 3 remains **READY / NOT STARTED** and must not begin without an explicit new execution instruction.


## Patch 081 — Phase 3 Step 3.1 technician read foundation (2026-09-13)
- Phase 3 started only after the user's explicit execution instruction; Phase 2 remains CLOSED/PASS and its two skipped runtime checks remain SKIPPED.
- Restored the missing Drizzle declaration `pmv2_programs.title` so the project schema matches the already-confirmed live DB column from Patch 078. **No SQL** was executed or generated for this repair.
- Added a PM V2 technician permission separate from PM V2 management permission. Current technician execution role is the existing application role `technician`.
- Added server-side active-team-membership scoping: a technician sees today's task only when an active `pmv2_team_members` row links that user to the task team. Task-item reads repeat the membership check to prevent cross-team ID access.
- Added read-only `pmv2.technician.today` and `pmv2.technician.items` endpoints. Today uses the existing Riyadh date-only helper; cancelled tasks are excluded.
- Added mobile/tablet-oriented `الصيانة المجدولة → مهامي اليوم` showing task number, target hierarchy, due status, team, progress, and task items. There are **no technician mutations** in Step 3.1.
- Management route remains restricted to the Phase 1–2 PM V2 management roles; technician direct access is scoped to `/scheduled-maintenance/my-tasks`.
- Focused static contract test: **6/6 PASS**. Syntax transpile of changed TS/TSX sources: **13/13 PASS**. Full project `tsc --noEmit` was not runnable in the supplied ZIP environment because `node_modules` is absent and `pnpm` is unavailable.
- Step 3.1 runtime/manual acceptance completed successfully on 2026-09-13: assigned active technician saw the expected due-today task and its two items; an unassigned technician saw 0 tasks; deactivating the assigned technician membership also produced 0 tasks; membership was then reactivated. Step 3.1 = **CLOSED / PASS**.
- Visits, Visit Members, Item Actions, result selection, and Task/Task Item state mutations remain intentionally **not started**. The next Phase 3 step requires a separate explicit execution instruction.


## Patch 082 — Phase 3 Step 3.1 manual acceptance closure (2026-09-13)
- Documentation-only acceptance checkpoint; no runtime code and no SQL.
- Clean runtime scenario used task `PMV2-20260913-P5-T13`, team `PMV2-TEAM-01`, two due-today items, and the dedicated technician test accounts.
- Active assigned technician: task visible with correct target/team, `0/2` progress, and both task items = **PASS**.
- Unassigned technician: `0` tasks = **PASS**.
- Assigned technician with team membership disabled: `0` tasks = **PASS**.
- Membership reactivated after the isolation test.
- Authoritative state: Phase 2 remains **CLOSED / PASS**; Phase 3 remains **IN PROGRESS**; Step 3.1 = **CLOSED / PASS**. No later Phase 3 execution step has started.

## Patch 083 — Phase 3 Step 3.2 Start Execution foundation (2026-09-13)
- **Phase 2 remains CLOSED / PASS**; its two explicitly skipped runtime tests remain SKIPPED and were not rerun.
- **Phase 3 = IN PROGRESS. Step 3.1 = CLOSED / PASS. Step 3.2 = code-ready / manual runtime acceptance pending.**
- Added a technician `startItem` mutation for `pending` Task Items only.
- Server-side write access rechecks active `pmv2_team_members` membership and exact Task/Task Item ownership.
- Start writes are atomic: one transaction locks the Task row, reuses a single open Visit or creates one, creates/joins Visit Member, updates Item/Task to `in_progress`, inserts Item Action `start_execution`, and writes `audit_logs`.
- First technician on a new Visit is Leader. A later active Team member joins the existing open Visit rather than creating a duplicate Visit.
- UI adds **بدء التنفيذ** only beside pending items in `مهامي اليوم`; result buttons are intentionally not present yet.
- No SQL/schema change. No Visit ending, results, material, ticket, purchase, inventory, or closure workflow started.
- Focused Phase 3 tests: Step 3.1 regression + Step 3.2 = **14/14 PASS**. Changed TS/TSX syntax transpile = **4/4 PASS**. Full-project dependency-based typecheck is not recorded as PASS in this packaged environment.


## Patch 084 — Phase 3 Step 3.2 manual acceptance closure (2026-09-13)
- Documentation-only acceptance checkpoint; **no runtime code and no SQL**.
- Manual UI acceptance on task `PMV2-20260913-P5-T13`:
  - starting Task Item `437` changed that item and the Task to `in_progress` while the second item remained pending = **PASS**;
  - starting Task Item `438` changed the second item to `in_progress` while the Task remained `in_progress` = **PASS**.
- Live DB verification:
  - exactly one open Visit for Task `104`: `pmv2_visits.id = 1`, `endedAt = NULL` = **PASS**;
  - Visit member `userId = 19110028` exists on Visit `1` with `isLeader = 1` = **PASS**;
  - two `pmv2_item_actions` rows exist for Task Items `437` and `438`, both `action = start_execution`, `performedById = 19110028` = **PASS**;
  - two matching `audit_logs` rows exist with `action = pmv2.item_start_execution`, `entityType = pmv2.task_item`, and entity IDs `437`, `438` = **PASS**.
- The same technician started both test items. Reuse of the single open Visit is therefore runtime-confirmed; teammate join/reuse remains covered by the focused automated contract but was **not separately manually exercised** in this acceptance.
- Authoritative state: Phase 2 remains **CLOSED / PASS**; Phase 3 remains **IN PROGRESS**; Step 3.1 = **CLOSED / PASS**; Step 3.2 = **CLOSED / PASS**.
- Result choices (`ok | fixed | needs_material | needs_ticket`), Visit ending, and task completion remain **NOT STARTED**.


## Patch 085 — Phase 3 Step 3.3 basic results first slice (2026-09-13)
- **Phase 2 remains CLOSED / PASS**; its two explicitly skipped runtime tests remain SKIPPED and were not rerun.
- **Phase 3 = IN PROGRESS. Step 3.1 = CLOSED/PASS. Step 3.2 = CLOSED/PASS. Step 3.3 = IN PROGRESS.**
- Added technician result submission for `ok` (**سليم**) and `fixed` (**تم الإصلاح**) only, and only from Task Item `in_progress`.
- Result writes recheck active Team membership + exact Task/Task Item ownership, lock the Task row, require exactly one open Visit, and join the active technician to that Visit if needed.
- The Task Item becomes `completed`; `pmv2_item_actions` stores `action = submit_result`, the frozen result, optional note, performer, and Visit. PM V2 Audit is written in the same DB transaction.
- Cached Task status remains `in_progress` while any Task Item is incomplete, and becomes `completed` when all Task Items are completed.
- Visit ending is intentionally not introduced here. `needs_material`, `needs_ticket`, attachments/images, Ticket/Inventory/Purchase integration remain NOT STARTED in this slice.
- No SQL/schema change. Focused Phase 3 regression (`Step 3.1 + 3.2 + 3.3`) = **23/23 PASS**; changed TS/TSX syntax transpile = **3/3 PASS**. Phase 2 tests were deliberately not rerun.
- Patch 085 manual runtime acceptance was completed and is recorded by Patch 086; the basic `ok/fixed` slice is **CLOSED / PASS**. `needs_material` and `needs_ticket` remain NOT STARTED.


## Patch 086 — Phase 3 Step 3.3 basic `ok/fixed` manual acceptance closure (2026-09-13)
- Documentation-only acceptance checkpoint; **no runtime code and no SQL**.
- Manual UI acceptance on Task `PMV2-20260913-P5-T13`:
  - Item `437` submitted as **سليم** -> Item `completed`, result `ok`, progress `1/2`, Task remained `in_progress`, Item `438` remained `in_progress` = **PASS**.
  - Item `438` submitted as **تم الإصلاح** -> Item `completed`, result `fixed`, progress `2/2`, Task became `completed` = **PASS**.
- Live DB verification confirmed Task `104` completed, Task Items `437/438` completed with results `ok/fixed`, Item Actions `3/4` with `action = submit_result`, saved execution notes, and `performedById = 19110028` = **PASS**.
- Audit verification confirmed `pmv2.item_result_submitted` rows `7235627/7235628` for `pmv2.task_item` entities `437/438`, by `userId = 19110028` = **PASS**.
- Authoritative state: Step 3.3 remains **IN PROGRESS overall**; its dependency-free `ok/fixed` slice is **CLOSED / PASS**. `needs_material`, `needs_ticket`, Visit ending, attachments/images, and external integrations remain NOT STARTED.


## Patch 087 — Phase 3 Step 3.3B dependency results Core slice (2026-09-13)
- **Phase 2 remains CLOSED / PASS**; skipped Phase 2 runtime checks were not rerun.
- **Phase 3 = IN PROGRESS. Step 3.1 = CLOSED/PASS. Step 3.2 = CLOSED/PASS. Step 3.3A `ok/fixed` = CLOSED/PASS. Step 3.3B = code-ready / manual runtime acceptance pending.**
- Added technician result submission for `needs_material` (**تحتاج مواد**) and `needs_ticket` (**تحتاج بلاغ صيانة**) only from Task Item `in_progress`.
- Core-only transitions: `needs_material → waiting_material`, `needs_ticket → waiting_ticket`; result, optional note, Visit, performer, `submit_result` Item Action, and PM V2 Audit are stored atomically.
- Server revalidates active Team membership + exact Task/Item ownership, serializes on the Task row, requires exactly one open Visit, and may join the active teammate to that Visit.
- Cached Task projection now preserves mixed dependency states with fixed priority **waiting_material > waiting_ticket > in_progress > ready_to_complete**, while all-completed still yields `completed`. Pending/other Items remain executable while the Task summary is waiting on another dependency.
- Basic `ok/fixed` submission now uses the same projection so completing another Item cannot erase an existing material/ticket waiting summary.
- **No Material Request, Inventory mutation, Purchase action, Ticket creation/link, or Visit ending is introduced.** Those external integrations remain Phase 4/later explicit work.
- No SQL/schema change. Focused Phase 3 source/contract regression = **34/34 PASS**; changed TS/TSX syntax transpile = **3/3 PASS**. Full dependency-based project typecheck is not claimed because the supplied project snapshot has no installed `node_modules`.

## Patch 088 — Phase 3 Step 3.3B manual acceptance closure (2026-09-13)
- Documentation-only acceptance checkpoint; **no runtime code and no SQL**.
- Manual UI acceptance on fresh Task `PMV2-20260913-P6-T14` / Task `105`:
  - Item `439` submitted as **تحتاج مواد** -> `waiting_material` / `needs_material`; Task summary became `waiting_material` while Item `440` remained executable = **PASS**.
  - Item `440` then started successfully while the Task summary was waiting on material, proving another Item can continue = **PASS**.
  - Item `440` submitted as **تحتاج بلاغ صيانة** -> `waiting_ticket` / `needs_ticket` while Item `439` stayed `waiting_material` = **PASS**.
  - Mixed Task projection remained `waiting_material`, confirming priority **waiting_material > waiting_ticket** = **PASS**.
- Live DB verification confirmed Item Actions `6` and `8` with `action = submit_result`, saved notes, results/states, and `performedById = 19110028` = **PASS**.
- Audit verification confirmed `pmv2.item_result_submitted` rows `7235641` and `7235643` for entities `439` and `440` by technician `19110028` = **PASS**.
- No real Material Request or Ticket was created by this slice; Inventory/Purchase/Ticket workflows remain untouched and are reserved for Phase 4 integration.
- Authoritative state: Phase 2 remains **CLOSED / PASS**; Phase 3 remains **IN PROGRESS**; Step 3.1 = **CLOSED / PASS**; Step 3.2 = **CLOSED / PASS**; Step 3.3 basic outcomes (`ok | fixed | needs_material | needs_ticket`) = **CLOSED / PASS**. Visit ending and remaining Phase 3 core scope are still pending.



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


## Patch 090 — Phase 3 Step 3.4 Visit ending — CLOSED / PASS (2026-09-13)
- Patch 089 manual runtime acceptance completed successfully; Patch 090 records acceptance only.
- UI on Task `PMV2-20260913-P6-T14` confirmed the Visit Leader could end the Visit after no Items remained `in_progress`; dependency states remained `waiting_material` / `waiting_ticket`, and the Task summary remained `waiting_material`.
- Live DB confirmed Visit `2` for Task `105` with `startedAt = 2026-09-13 10:59:05` and non-null `endedAt = 2026-09-13 11:42:05` = **PASS**.
- Audit confirmed row `7235645`, action `pmv2.visit_ended`, entity `pmv2.visit` / `2`, user `19110028`, at `2026-09-13 11:42:05` = **PASS**.
- Step 3.4 = **CLOSED / PASS**. Task/Task Item state was not force-mutated by Visit ending.
- Phase 3 remains **IN PROGRESS**; remaining Phase 3 core scope must be reviewed before the next implementation step. External Material/Ticket/Inventory/Purchase integration remains Phase 4.
- Patch 090 contains documentation only. No SQL/schema change and no runtime code.


## Patch 091 — Phase 3 Step 3.5 optional execution images/evidence (2026-09-13)
- **Phase 2 remains CLOSED / PASS**; its skipped runtime checks were not rerun.
- **Phase 3 = IN PROGRESS. Steps 3.1–3.4 = CLOSED / PASS. Step 3.5 = CODE-READY / MANUAL RUNTIME ACCEPTANCE PENDING.**
- Reuses the existing `attachments` table/service; no PM V2 attachment table and no SQL/schema change. Evidence is linked by `entityType = pmv2_item_action` and `entityId = pmv2_item_actions.id`, matching the Phase 1 frozen DB contract.
- Technician evidence reads recheck exact Task/Task Item ownership through active `pmv2_team_members`. PM V2 managers may read evidence for review.
- Evidence write requires technician role + active Task-Team membership + an Item Action performed by the same technician + the owning Visit still open. A Visit conflict or ended Visit produces no upload target; server-side generic attachment access repeats the same boundary.
- PM V2 evidence in this slice is image-only and optional. UI uploads through existing `/api/upload`, records through existing `attachments.add`, renders all evidence for the Task Item across its Item Actions, and refreshes evidence after Start/Result/Visit transitions.
- Existing attachment Audit remains authoritative for evidence mutations (`add_attachment`, entity type `pmv2_item_action`). No Task/Item state transition, Material Request, Ticket, Inventory, Purchase, or Legacy PM change is introduced.
- Focused Phase 3 regression = **53/53 PASS**. Changed TS/TSX syntax transpile = **6/6 PASS**. Full dependency-based project typecheck is not recorded because packaged `node_modules` are unavailable.


## Patch 092 — Phase 3 Step 3.5 manual acceptance closure (2026-09-13)
- Documentation-only acceptance checkpoint; **no runtime code and no SQL**.
- Manual UI acceptance on Task `PMV2-20260913-P5-T13`, Task Item `437`:
  - **إضافة صورة / دليل** was available while the technician-owned Visit was open; one image uploaded and its thumbnail appeared under the same Item = **PASS**.
  - after refresh, the same thumbnail remained visible = **PASS**.
  - after ending the Visit, the existing evidence remained readable while the upload action disappeared = **PASS**.
- Live DB verification confirmed attachment `3000641` with `entityType = pmv2_item_action`, linked through Item Action `3` to Task Item `437`, uploaded by technician `19110028` = **PASS**.
- Audit verification confirmed the existing `add_attachment` path for `pmv2_item_action` evidence = **PASS**.
- Evidence remains optional and reuses the existing attachment/storage infrastructure; no PM V2 image table was created.
- Authoritative state: Phase 2 remains **CLOSED / PASS**; Phase 3 remains **IN PROGRESS**; Steps 3.1, 3.2, 3.3 basic outcomes, 3.4, and 3.5 are **CLOSED / PASS**. Remaining Phase 3 work is Core stabilization / acceptance-gate review before any Phase 4 integration.

## Patch 093 — Phase 3 final acceptance closure (2026-09-13)

- **Phase 3 = CLOSED / PASS — final acceptance.**
- Steps 3.1–3.5 are all CLOSED / PASS on their accepted scopes.
- Core technician outcomes `ok | fixed | needs_material | needs_ticket`, Task/Task Item transitions, Visits/Members/Leader, notes/images evidence, server-side membership security, and Audit paths were accepted through the Phase 3 implementation/manual sequence.
- Different active teammate joining the same open Visit was not manually rerun. The user explicitly accepted that branch based on the focused automated Step 3.2 coverage; record it as **SKIPPED / ACCEPTED**, not manual PASS.
- Manual Mobile/Tablet layout verification is explicitly **DEFERRED TO FINAL PROGRAM ACCEPTANCE (Phase 6)** by user decision. It is not counted as a Phase 3 manual PASS and does not reopen Phase 3 unless the user explicitly chooses to revisit it.
- Latest focused Phase 3 regression from Patch 091 remains **53/53 PASS**; Phase 2 acceptance tests were deliberately not rerun.
- No runtime code, no SQL, and no Phase 4 Material/Ticket/Inventory/Purchase integration in Patch 093.
- **Next official state:** Phase 4 = `READY / NOT STARTED`. Do not start automatically; explicit user execution instruction is required.


## Patch 094 — Phase 4 Step 4.1 material intake — CODE-READY / MANUAL ACCEPTANCE PENDING (2026-09-13)
- Phase 0–3 remain **CLOSED / PASS**; Phase 4 is now **IN PROGRESS**.
- Added technician material-need intake only for Task Items already `waiting_material / needs_material`.
- Reuses active `catalog_items`, the Team's current Warehouse, and current Inventory/Lot balances through PM V2 adapters; no duplicate Master Data.
- Availability check is read-only. If Team Warehouse can fulfill the whole requested quantity, PM V2 creates **no Material Request** and returns an explicit handoff to the current Inventory/Delivery path.
- If Team Warehouse is short, PM V2 creates `pmv2_material_requests` + one `pmv2_material_request_items` row for the **shortage quantity only**, initial state `waiting_warehouse`.
- Active duplicate request for the same Task Item + Catalog Item is rejected. Ambiguous inventory rows are rejected rather than guessed.
- No stock mutation, no warehouse transfer, no purchase order, no Ticket integration, and no Legacy PM change. No SQL/schema change.
- New Step 4.1 focused source/contract tests = **15/15 PASS**. Combined Phase 3 regression + Step 4.1 focused suite = **68/68 PASS**. Changed TS/TSX syntax transpile = **6/6 PASS**. Phase 2 tests were not rerun.
- Full dependency-based project typecheck is not claimed because packaged `node_modules` are unavailable.
- Manual runtime acceptance is **PENDING**.


## Patch 095 — Phase 4 Step 4.1 Team Warehouse balance preview refinement — CODE-READY / MANUAL ACCEPTANCE PENDING (2026-09-14)
- User clarified the expected UX: the technician should see the current Team Warehouse balance while selecting a material, and should see **requested / available / shortage** before recording the need.
- Catalog search is now task-scoped and enriches each active Catalog item with read-only Team Warehouse availability. Availability is batched by Warehouse/Catalog IDs; when Lot tracking is enabled it sums positive Lot balances.
- The material selector shows the Team Warehouse balance beside each material. Selecting a material displays requested, available, and shortage values before submit.
- A requirement larger than Team Warehouse stock is still valid as an **operational need**; PM V2 does not block entry at the available balance. Instead it requests only the shortage. This is intentionally distinct from actual Inventory/Delivery issuance, which remains constrained by the current Inventory workflow and actual stock.
- No stock reservation, no stock mutation, no Warehouse Transfer, no PO, no Ticket integration, no Legacy PM change, and no SQL/schema change.
- Manual runtime evidence already recorded before this refinement: Request `#1` for Task Item `439` / Catalog Item `300042` saved `1111` in `waiting_warehouse`, with received/issued quantities `0`; a direct Team Warehouse `30002` inventory lookup for that Catalog Item returned empty set, confirming zero available stock for that test. This proves the zero-stock shortage path but does **not** close Step 4.1 after the UX refinement.
- Updated Step 4.1 focused tests = **18/18 PASS**. Combined Phase 3 focused regression + Step 4.1 = **71/71 PASS**. Changed TS/TSX syntax transpile = **5/5 PASS**; changed Node test syntax = PASS. Phase 2 tests were not rerun.
- Manual acceptance remains **PENDING**; first post-Patch-095 check is the visible balance/preview on the existing `needs_material` Item without creating another request.


## Patch 096 — Phase 4 Step 4.1 technician open-task carry-over visibility correction — CODE-READY / MANUAL ACCEPTANCE PENDING (2026-09-14)
- Runtime issue found during Step 4.1 acceptance: `مهامي اليوم` previously filtered exact `dueDate = today`, so Task `PMV2-20260913-P6-T14` disappeared on 2026-09-14 while still `waiting_material`.
- Technician feed now includes `dueDate <= Riyadh today`, excludes cancelled Tasks, and carries historical Tasks only while they are not `completed`. Today's completed Tasks retain the existing same-day visibility behavior.
- API returns `isCarryOver`, `todayCount`, and `carryOverCount`; no Task date/status mutation is used to achieve visibility.
- UI separates **مهام اليوم** and **مهام سابقة مفتوحة**, shows the original due date, and states explicitly that the date is not rewritten.
- Active Team membership security remains unchanged; no SQL, Inventory mutation, request duplication, Warehouse Transfer, PO, Ticket, or Legacy PM change.
- Updated Step 4.1 focused suite = **21/21 PASS**; combined Phase 3 regression + Step 4.1 = **74/74 PASS**. Changed TS/TSX syntax transpile = **2/2 PASS**; changed Node test syntax = **2/2 PASS**. Phase 2 tests were not rerun.
- **Manual acceptance pending:** after deployment on 2026-09-14, `PMV2-20260913-P6-T14` must appear under **مهام سابقة مفتوحة** with its original due date and existing `waiting_material` state.


## Patch 097 — Phase 4 Step 4.1 unlisted-material intake — CODE-READY / MANUAL ACCEPTANCE PENDING (2026-09-14)
- Phase 0–3 remain **CLOSED / PASS**; Phase 4 remains **IN PROGRESS**.
- Manual acceptance before this patch confirmed Patch 096 carry-over visibility and Patch 095 balance preview on the prior open Task; Step 4.1 remains open because the missing-Catalog branch was discovered during acceptance.
- Added explicit **مادة غير موجودة في الدليل** path for `waiting_material / needs_material`. Technician enters free-text name + quantity + unit.
- Persists through the frozen Material Request Item contract with `catalogItemId = NULL`, `itemNameSnapshot`, full requested quantity, and initial state `waiting_warehouse`. No SQL/schema change.
- No Catalog master record is created. No Inventory availability is guessed when Catalog identity is absent; audit records availability as not checked rather than claiming zero stock.
- Active duplicate unlisted requests are rejected by normalized free-text name on the same Task Item. Existing Catalog-item behavior (Team Warehouse preview, shortage-only request, current Inventory handoff when fully stocked) is unchanged.
- No Stock mutation, Warehouse Transfer, PO, Ticket integration, or Legacy PM change.
- Focused Step 4.1 tests = **26/26 PASS**; combined Phase 3 regression + Step 4.1 = **79/79 PASS**; changed TS/TSX syntax transpile = **3/3 PASS**. Phase 2 tests were not rerun.
- Manual runtime acceptance of the new unlisted-material path remains **PENDING**.

## Patch 098 — Phase 4 Step 4.1 post-submit intake reset + duplicate UX guard — CODE-READY / MANUAL ACCEPTANCE PENDING (2026-09-14)
- Manual acceptance of Patch 097 confirmed that an unlisted need could be created, but exposed a UX risk: the completed form remained populated and clickable after success.
- After a successful `material_request` route, the intake values are now cleared and the form collapses; the saved request remains visible under **طلبات المواد الحالية**.
- When an active request exists, the normal entry form is collapsed by default and an explicit **إضافة مادة أخرى** action reopens a clean form for a genuinely additional material.
- Active Catalog items already requested on the same Task Item are disabled/labeled **مطلوب بالفعل**. Active unlisted needs are client-guarded by the same normalized-name concept as the existing server duplicate protection.
- Server-side duplicate rejection from Patch 094/097 remains unchanged and authoritative; this patch adds no new database or service write rule.
- No SQL, no Stock mutation, no Transfer, PO, Ticket, or Legacy PM change.
- Updated Step 4.1 focused tests = **29/29 PASS**; combined Phase 3 regression + Step 4.1 = **82/82 PASS**. Manual runtime acceptance remains **PENDING**.



## Patch 099 — Phase 4 Step 4.1 count-unit quantity integrity — CODE-READY / MANUAL ACCEPTANCE PENDING (2026-09-14)
- Live Step 4.1 acceptance exposed that `2.5 قطعة` could pass the generic positive-decimal quantity rule.
- Added shared `shared/pmv2MaterialQuantity.ts` policy used by both technician UI and `Pmv2MaterialRequestService`. Known count/package units require whole-number quantities; divisible/unknown units retain decimal capability.
- Client switches quantity `min/step` to `1` for count units, shows an inline validation error, disables submit, and suppresses shortage preview until quantity is valid for the unit.
- Server rejects a fractional count-unit quantity before Team Warehouse availability routing or any Material Request insert, so UI bypass cannot persist it.
- No SQL/schema change, Stock mutation/reservation, Warehouse Transfer, PO, Ticket, or Legacy PM change.
- Step 4.1 focused tests = **32/32 PASS**; combined Phase 3 focused regression + Step 4.1 = **85/85 PASS**; changed TS/TSX syntax transpile = **3/3 PASS**; Node test syntax = PASS. Phase 2 tests were not rerun.
- Manual runtime acceptance remains **PENDING**.


## Patch 100 — Phase 4 Step 4.1 persistent Team-Inventory handoff — CODE-READY / MANUAL ACCEPTANCE PENDING (2026-09-14)
- Live acceptance before this patch: `2.5 قطعة` rejected = **PASS**; stocked pen preview `requested 2 / available 5 / shortage 0` = **PASS**; submit returned Team Inventory handoff and DB confirmed quantity stayed `5` with `pmv2RequestCount = 0` = **PASS**.
- Gap discovered: full-stock success was transient UI state; the intake remained clickable and the result could not be reconstructed after Refresh.
- Added append-only `pmv2_item_actions.action = material_route_decision` with structured JSON snapshot in `note` for each Catalog routing decision. No SQL/schema change.
- `materialState` reconstructs the latest route per Catalog Item; latest `team_inventory` decisions return as `teamInventoryHandoffs`. A later `material_request` decision supersedes an older ready handoff for the same Catalog Item.
- Technician UI now clears/collapses the intake after full availability, displays **جاهز للصرف من مخزن الفريق**, blocks duplicate selection of that Catalog Item, and exposes **إعادة التحقق من الرصيد**.
- This is routing state only: no stock reservation/mutation, no Transfer/PO/Ticket change, and no misuse of `pmv2_material_usages` before actual Inventory/Delivery evidence exists.
- Automated: Step 4.1 focused = **35/35 PASS**; combined Phase 3 focused regression + Step 4.1 = **88/88 PASS**; changed TS/TSX syntax transpile = **2/2 PASS**; Node test syntax = PASS. Phase 2 tests were not rerun.
- Manual runtime acceptance of the persistent ready-to-issue card remains **PENDING**.


## Patch 101 — Phase 4 Step 4.1 final acceptance closure + Step 4.2 review (2026-09-14)
- Documentation-only closure/review patch; **no runtime code and no SQL**.
- **Step 4.1 = CLOSED / PASS.** Manual acceptance covered zero-stock shortage request, balance preview, open-task carry-over, unlisted material intake, duplicate protections, post-submit reset, count-unit integer guard, full-stock no-request route, persistent `team_inventory` handoff after refresh, and unchanged-stock recheck.
- Live DB anchors: Request `1` / Request Item `1` / Task Item `439` / Catalog `300042` = `waiting_warehouse`, requested `1111`, received/issued `0`; PRIMA Catalog `1140273` remained Team Warehouse qty `5` with PM V2 request count `0`; `material_route_decision` Action `30001` records requested `2`, available `5`, shortage `0`, Team Warehouse `30002`, no Material Request IDs.
- **SKIPPED / ACCEPTED, not manual PASS:** changed-stock recheck after a previously persisted `team_inventory` decision; explicit partial-shortage runtime case. User chose to proceed; focused Step 4.1 automated contract remains supporting evidence.
- Automated evidence retained from Patch 100: Step 4.1 **35/35 PASS**; Phase 3 regression + Step 4.1 **88/88 PASS**; changed TS/TSX syntax **2/2 PASS**. Phase 2 tests were not rerun.
- Step 4.2 review found the current Warehouse Transfer workflow already authoritative: `inventory.transfers.createBatch` / `warehouseProcedure`, current QR/Lot validation, current stock mutation, current transfer batch audit. PM V2 must integrate through an adapter/handoff rather than duplicate this workflow.
- **Step 4.2 = READY / NOT STARTED.** First recommended runtime slice: warehouse-facing `waiting_warehouse` queue + read-only Main-Warehouse availability decision. Transfer mutation and PO remain later explicit slices.


## Patch 102 — Phase 4 Step 4.2A warehouse waiting queue + Main-Warehouse availability (2026-09-14)

- **Step 4.2A = CODE-READY / MANUAL ACCEPTANCE PENDING.** New warehouse-facing page/API lists only PM V2 Material Request Items in `waiting_warehouse`.
- Added a PM V2 warehouse permission family (`warehouse | owner | admin`) separate from management and technician execution; client direct-path guard matches the server guard.
- Main Warehouse is resolved dynamically through `WarehouseAdapter.requireSingleActiveMainWarehouse()` using `type = main`, active-only, exactly-one semantics matching the current receipt workflow; no hard-coded warehouse ID.
- Queue joins PM V2 Request → Task Item → Task → Team, resolves Team Warehouse destination through the external warehouse adapter, and checks known Catalog items against current Main-Warehouse Inventory/Lot availability in a batch.
- Decision states: `available`, `insufficient`, `unlisted`; integrity stop states: `catalog_unavailable`, `ambiguous_inventory`, `unit_mismatch`. Unlisted material is never guessed against Inventory.
- **Read-only boundary:** no PM V2 request status mutation, no Warehouse Transfer, no Inventory transaction/stock mutation, no PO, no Ticket, no Legacy PM change, and no SQL/schema.
- Automated: Step 4.2A focused **15/15 PASS**; combined Phase 3 + Step 4.1 + Step 4.2A **103/103 PASS**; changed TS/TSX syntax transpile **14/14 PASS**; new Node test syntax PASS.
- Full project `tsc --noEmit` was not usable in this isolated patch copy because Node/Vite type-definition packages are absent from the working dependency snapshot; this is an environment/dependency limitation, not a reported PM V2 diagnostic.
- Next gate: one manual warehouse-role UI check only. Transfer write remains a later explicit Step 4.2 slice after acceptance.

## Patch 103 — Step 4.2A warehouse Catalog operator identity UX (2026-09-14)
- The Patch 102 warehouse queue manual runtime check is **PASS**: warehouse screen loaded the active Main Warehouse, showed two `waiting_warehouse` requests, correctly separated a known insufficient Catalog material from an unlisted material, and remained read-only.
- **Step 4.2A functional acceptance = CLOSED / PASS.** Step 4.2B remains READY / NOT STARTED.
- User-facing material identity was improved before 4.2B: listed request cards now show the real Catalog item code (`catalog_items.code`) and the Arabic taxonomy path from `catalog_nodes`.
- Internal `catalogItemId` is no longer rendered as `Catalog #...`; it remains an integration key only.
- Catalog taxonomy is read through the PM V2 current-system adapter in one batch for queue items; no duplicated Master Data or PM V2 taxonomy storage.
- No SQL/schema, Warehouse Transfer, PO, request-state mutation, Inventory mutation, Ticket, or Legacy PM change.
- Automated: Step 4.2A **18/18 PASS**; combined Phase 3 + Step 4.1 + Step 4.2A **106/106 PASS**; changed TS/TSX syntax **3/3 PASS**; changed Node test syntax PASS.
- Patch 103 presentation smoke = **PASS**: listed material showed **كود الصنف `0032-2-1-7` + التصنيف** and no `Catalog #300042`.

## Patch 104 — Pre-4.2B operational contract freeze (2026-09-14)

- Patch 103 visual smoke = **PASS**: warehouse card showed real item code `0032-2-1-7` + Catalog taxonomy path, and did not expose `Catalog #300042`.
- **Step 4.2A = CLOSED / PASS.**
- **Step 4.2B = READY / NOT STARTED.** Scope frozen before coding: existing Main→Team Warehouse Transfer only, partial transfer allowed, PM V2 projection updates only after confirmed real Transfer, and multiple Transfers may satisfy one request item.
- Remaining shortage stays on the same Material Request Item and keeps the material dependency open.
- Purchase/PO/Receiving are explicitly deferred beyond 4.2B.
- Future purchase rule frozen: PM V2 shortage is the minimum linked quantity; purchasing above it is allowed and the excess is general warehouse stock, not PM V2 demand.
- Documentation-only; no runtime/schema/SQL change.


## Patch 105 — Phase 4 Step 4.2B existing Warehouse Transfer handoff (2026-09-14)

- **Step 4.2B = CODE-READY / MANUAL ACCEPTANCE PENDING.**
- Added server-side `prepareTransferHandoff` recheck for `waiting_warehouse` listed material, exact current Main/Team Warehouse identities, Catalog identity, unit integrity, and current Lot-aware availability. No write occurs during prepare.
- Warehouse queue now uses outstanding quantity (`requested - issuedToTeamQuantity`) and shows original requested, already supplied, remaining, Main available, and transferable-now quantities.
- Existing `/warehouse/transfer` receives a PM V2 handoff context but still executes the unchanged authoritative `transfers.createBatch` path with current QR/Lot/stock/audit rules. Source/destination/exact source Inventory are locked for the PM V2 context and the total handoff quantity is capped across Lot rows.
- Added read-only `WarehouseTransferAdapter` to resolve already-created `warehouse_transfers` by authoritative transfer number. PM V2 validates Main source, Team destination, Catalog identity, unit, and positive quantity before projection.
- Successful real Transfers are traced through `pmv2_item_actions.action = material_transfer_linked`; no new transfer-link table/schema was introduced.
- `issuedToTeamQuantity` is recomputed from unique linked real Transfer IDs and capped at requested quantity. Partial fulfillment remains `waiting_warehouse`; full fulfillment becomes `issued_to_team`.
- Duplicate link retry is idempotent; a real Transfer already linked to another PM V2 request is rejected.
- Safety: once a physical Transfer is posted from a PM V2 handoff, the stale handoff is frozen. Operator must return to queue for a fresh remaining/availability decision before another transfer. If PM V2 linking fails after stock moved, UI offers link retry only.
- Purchase/PO/Receiving remain out of scope and deferred. No SQL/schema change.
- Automated: Step 4.2B **25/25 PASS**; combined Phase 3 + Step 4.1 + Step 4.2A + Step 4.2B **131/131 PASS**; changed TS/TSX syntax **7/7 PASS**; Node test syntax PASS. Phase 2 tests were not rerun.
- Manual runtime acceptance is **PENDING**.

## Patch 106 — deferred technician material-picker UX contract (2026-09-14)
- Documentation-only checkpoint requested during Step 4.2B manual acceptance.
- Recorded the agreed next UX improvement: smart default technician material list, while preserving full active-Catalog search.
- Default ranking should favor Team-Warehouse-stocked materials and may use real existing usage/history evidence; it must not invent specialty-to-material relationships.
- Search results should show material name + operator item code + taxonomy path + Team-Warehouse balance.
- Explicit specialty mapping may be used only if it already exists in Master Data; otherwise full Catalog search remains the safe boundary.
- **Step 4.2B remains CODE-READY / MANUAL ACCEPTANCE PENDING.** This documentation item does not interrupt or reset the current test.
- No runtime code, SQL, schema, Inventory, Purchase, Ticket, or Legacy PM change.


## Patch 107 — Step 4.2B warehouse quantity-context clarification (2026-09-14)
- **Step 4.2B remains MANUAL ACCEPTANCE IN PROGRESS.**
- Fixed warehouse-card semantics discovered during manual acceptance: the old label `المطلوب الأصلي` represented the shortage request, not the technician's total need.
- Queue read model now reconstructs the Step 4.1 `material_route_decision` snapshot to expose `taskNeedQuantity` and `teamAvailableAtRequest`; no schema/SQL change.
- UI labels: **احتياج المهمة / المتاح في مخزن الفريق وقت الطلب / المطلوب من المستودع الرئيسي / المتبقي للتحويل / المتاح في الرئيسي الآن**.
- Manual partial-shortage case is now PASS: need 6, Team available 5, Main request 1.
- Positive-Main queue check also passed pre-fix: PRIMA shortage 1, Main available 89, transferable 1, handoff button visible. Physical Transfer remains not yet executed.
- Automated remains **25/25 Step 4.2B** and **131/131 focused regression**.


## Patch 108 — Step 4.2B final manual acceptance closure (2026-09-16)
- **Step 4.2B = CLOSED / PASS.**
- Real end-to-end Warehouse Transfer succeeded for quantity `1` from Lot `LOT-2026-00315`. `TRB-2026-090001` is the `warehouse_transfer_batches.batchNumber`; the PM V2-linked row identity is `warehouse_transfers.transferNumber = TRF-2026-090001`.
- Final DB verification: `material_transfer_linked` exists for `TRF-2026-090001`, `linkedQuantity = 1`, `requestedQuantity = 1`, `issuedToTeamQuantity = 1`, and request-item `status = issued_to_team`.
- The original STOP query used the Batch `TRB` value in a field that stores per-row `TRF`; this was a verification-query identifier mismatch, not a runtime linkage failure.
- Documentation-only closure patch. No runtime code, SQL/schema, Inventory mutation, Purchase/PO/Receiving, Ticket, or Legacy PM change.


## Patch 109 — Phase 4 Team-Warehouse Issue/Delivery linkage (2026-09-16)
- **CODE IMPLEMENTED / MANUAL ACCEPTANCE PENDING.**
- Added a read-only Delivery adapter and exact Inventory-identity lookup to PM V2 integration boundaries.
- Existing `deliverInventoryItem` / `issueDelivery` remains the sole stock/Lot/Delivery owner; PM V2 only prevalidates optional task context and links the confirmed Delivery afterward.
- Added `team-issue-handoff-service.ts` to compute full task material remaining, validate active Team recipient, write `pmv2_material_usages`, protect Delivery idempotency/cross-task duplication, and project Task Item/Task status after real usage.
- Partial-shortage attribution is preserved: original Team stock usage is nullable-request trace, while only the shortage-supplied portion links to `materialRequestItemId`; this prevents a shortage request for `1` from falsely carrying usage `6`.
- Request status reaches `consumed` only from `issued_to_team` after request-attributed usage fulfills its requested quantity.
- Task Item reaches `ready_to_complete` only after all known material requirements are satisfied by real usage evidence.
- Inventory UI adds optional PM V2 task selection and link-only recovery after a posted Delivery. General non-PMV2 delivery remains available unchanged.
- No schema/SQL, no new stock engine, no Purchase/PO/Receiving, no Ticket/Legacy PM change. Phase 5 technician resume/closure is intentionally not implemented.
- Automated: **27/27 focused PASS**, **158/158 combined Phase 3 + Phase 4 focused PASS**, **7/7 changed TS/TSX syntax transpile PASS**.

## Patch 110 — Programmatic Team-Warehouse issue + consumption/return — CODE-READY / MANUAL ACCEPTANCE PENDING (2026-09-16)
- Supersedes Patch 109's manual PM V2 dropdown in generic Inventory delivery. The operational entry point is now the PM V2 warehouse queue; task/material/quantity/Lot context is programmatic.
- Full remaining task need is issued through the existing Inventory/Delivery service. Lot allocation is automatic and can create multiple authoritative Delivery Documents while remaining one logical PM V2 requirement.
- Requesting technician is the default recipient; warehouse may select another active technician from the same PM V2 Team. The requirement/requester and actual recipient remain separately traceable.
- Physical issue is tracked as `material_issue_linked`; actual technician consumption is declared later. `Issued != Consumed` is now explicit.
- Technician completion records only actual used quantity. Any difference becomes a pending return; stock is not restored until warehouse confirmation through the existing recipient-return workflow.
- Single-Lot returns require confirmation only; multi-Lot returns allow allocation only across Lots from the original issue and enforce per-Lot/total limits.
- Link-failure safety remains link-only: a posted Delivery can be recovered without repeating stock movement.
- Current live recipient-return document quantity is integer-only; fractional pending returns are rejected before task completion. No SQL/schema change is included.
- No Purchase/PO/Receiving, Ticket, Legacy PM, or handoff-file change.
- Automated focused Phase 3 + Phase 4 regression: **155/155 PASS**. Broader `pmv2-*.node.mjs` comparison retains the same 18 unrelated baseline failures; Patch 110 introduces no additional failing signature.
- Manual acceptance is **PENDING**; do not mark this slice CLOSED/PASS until the real issue → technician used quantity → return path is exercised.
- Runtime acceptance on **2026-09-19** proved the real PRIMA path through issue `6`, actual use `4`, pending return `2`, no premature stock restoration, warehouse return confirmation, and Team-Warehouse balance restoration to `2`. Final Visit closure then exposed a technician-feed visibility defect: the prior-due completed Task disappeared while its Visit was still open. Patch 110 therefore remains **MANUAL ACCEPTANCE IN PROGRESS**, not CLOSED/PASS, until Patch 111 is applied and the same Visit is explicitly ended.

## Patch 111 — Completed carry-over Task remains visible until explicit Visit end — CLOSED / PASS (2026-09-19)
- Fixes the runtime-discovered PM V2 technician UX defect without changing Task completion semantics. A prior-due Task may be `completed` while its Visit still has `endedAt = NULL`; it must remain in **مهامي اليوم** until the Visit is explicitly closed.
- `listTodayTasks()` now retains completed carry-over Tasks only when an open PM V2 Visit exists. After `endVisit` sets `endedAt`, the normal refetch removes the completed prior Task automatically.
- The UI keeps the existing single **إنهاء الزيارة** action and adds a direct cue: **اكتملت جميع البنود — الزيارة ما زالت مفتوحة**. Leader sees the instruction to end the Visit; non-leader sees that the leader must end it.
- No automatic Visit end, no reopening/downgrading of the completed Task, no schema/SQL, no Inventory mutation, no Purchase/PO/Receiving, no Ticket, and no Legacy PM change.
- Targeted source-contract regression: **53/53 PASS**. Broad PM V2 source-contract run: **254/272 PASS with the same 18 baseline failures** as the untouched attached project (**251/269 PASS, 18 fail**); Patch 111 adds 3 passing tests and no new failure signature. Changed TS/TSX syntax transpile: **2/2 PASS**. `npm run build` was attempted in the attached source snapshot and stopped at `vite: not found` because `node_modules` is absent; this is an environment limitation, not a Patch 111 runtime result.
- Manual retest **PASS** on 2026-09-19: completed prior Task `PMV2-20260914-P5-T13` reappeared with the open-Visit cue, the Leader successfully pressed **إنهاء الزيارة**, success was confirmed, and the task then disappeared from the feed as intended. Real-project `npm run build` also **PASS** after applying Patch 111.


## Patch 112 — Technician material searchable combobox UX — CLOSED / PASS (2026-09-19)
- Replaces the separate material search input + separate dropdown with one searchable combobox in **مهامي اليوم → تحتاج مواد**.
- Technician clicks one field, types part of the material name or item code, and sees server-backed Catalog results directly in that same list.
- Results expose material name, operational item code, Team-Warehouse balance/unit, and duplicate/ready blocking state.
- Selecting a result preserves the existing quantity validation, Team-Warehouse availability preview, shortage calculation, and submit behavior.
- The explicit unlisted-material fallback remains secondary and does not create Catalog Master Data.
- UI-only change: no server/API/schema/SQL, Inventory mutation, Purchase/PO/Receiving, Ticket, Legacy PM, or handoff-file change.
- Automated: Patch 112 + Step 4.1 focused **39/39 PASS**; broad PM V2 **258/276 PASS, same 18 baseline failures**; changed TSX syntax transpile **1/1 PASS**.
- Manual UI check **PASS** on 2026-09-19: technician typed `PRIMA` and matching Catalog rows appeared directly in the same control with item code and Team-Warehouse balance. Real-project `npm run build` also **PASS** (`vite` built in 44.06s; server bundle completed).


## Patch 113 — Technician material submit label simplification — CODE-READY / MANUAL TEXT CHECK PENDING (2026-09-19)
- Renames the catalog-material submit action in **مهامي اليوم → تحتاج مواد** from **تحقق من التوفر وسجّل الاحتياج** to the concise **تسجيل الاحتياج**.
- Business behavior is unchanged: the server still rechecks Team-Warehouse availability at submit time and persists the same material-route decision/request as before.
- Pending state remains **جارٍ تسجيل الاحتياج...**; unlisted-material action remains unchanged.
- No server/API/schema/SQL, Inventory mutation, Purchase/PO/Receiving, Ticket, Legacy PM, or handoff-file change.
- Automated focused label + Step 4.1/combobox regression: **40/40 PASS**. Broad PM V2 source-contract run: **259/277 PASS, same 18 baseline failures**. Changed TSX syntax transpile: **1/1 PASS**.

## Patch 114 — Technician Team-Warehouse self-service receipt — IMPLEMENTED / BUILD PENDING

- Full listed-material availability now uses a technician **استلام المواد من مخزن الفريق** action with a confirmation dialog.
- Added technician-scoped ready-receipt read model and mutations. Authorization remains `pmv2TechnicianProcedure` plus active membership in the same PM V2 Team.
- Added `technician-self-service.ts` orchestration: persist the PM V2 need first, then use the existing Team-Warehouse issue/Delivery service with the technician as the actual recipient.
- `material_route_decision` creation now returns its Action ID so immediate receipt can link to the exact persisted requirement.
- Partial-stock behavior remains non-partial by default: required `7`, available `5` creates a shortage request for `2`; the `5` is not issued until the full remaining need is available.
- After transfer of the shortage, the technician task surface can detect the live ready-to-receive requirement and perform the full receipt without a warehouse issue click.
- Existing Inventory/Delivery, Lot allocation, cost attribution, duplicate/relink safety, actual consumption, and pending-return rules are reused unchanged.
- No SQL/schema; no Purchase/PO work.
- Automated focused regression: Patch 111–114 + Step 4.1 + Patch 110 issue/return = **74/74 PASS**.
- Broad PM V2 Node suite = **266/284 PASS**, with the same **18 pre-existing baseline failures** and no new Patch 114 failure.
- Changed TS/TSX syntax transpile = **5/5 PASS**.

## Patch 115 — Warehouse shortage clarity + Purchase handoff — CODE-READY / BUILD PENDING (2026-09-19)

Runtime evidence immediately before this patch:
- Patch 114 full-stock self-service: Duracell AAA `91-0007`, Team Warehouse `2/2` → technician confirmation → success → Team Warehouse balance `2 → 0`: **PASS**.
- Partial-stock setup on `PMV2-20260919-P6-T14`: task need `7`, Team Warehouse `5`, shortage `2`; technician created only shortage `2`: **PASS**.
- Warehouse queue then misleadingly showed full task need as **سيُصرف الآن 7** while only `5` Team stock existed and the Material Request Item represented shortage `2`: **FAIL / defect reproduced**. No action was executed from that bad card.

Patch 115 correction:
- waiting warehouse card now explains total need + Team snapshot + shortage + remaining shortage + live Main balance;
- shortage-routed requirements are hidden from ready-issue projection until their shortage physically reaches Team Warehouse;
- Main covers full shortage → existing Warehouse Transfer for the whole shortage only;
- Main does not cover full shortage → existing Purchase page for only the currently uncovered quantity; PM V2 links the authoritative PO Item through the existing `pmv2_material_purchase_links` table and never owns Purchase mutations;
- confirmed Warehouse Receipt quantity is read to avoid double-counting in-flight purchase coverage versus Inventory already entered;
- no SQL/schema change; no Legacy PM change; Patch 110 consumption/return and Patch 114 technician receipt remain intact.

Automated verification: focused Phase 4/Patch 114–115 regression **120/120 PASS**; broad PM V2 Node suite **277/295 PASS with the same 18 baseline failures**; changed TS/TSX syntax transpile **10/10 PASS**. Production build remains pending in the real project.

## Patch 116 — PM V2 Purchase unit prefill from Catalog Unit Master Data — CLOSED / PASS (2026-09-19)

Runtime defect reproduced after Patch 115: PM V2 opened the existing Purchase Order form with the correct Duracell item and shortage quantity `2`, but the Unit field rendered blank/disabled.

Patch 116 correction:
- Purchase handoff resolves the PM V2 unit against the existing active `catalog_units` Master Data and returns the stable Catalog Unit ID plus canonical Arabic unit name when resolvable.
- Warehouse queue passes `pmv2UnitId` into the existing `/purchase-orders/new` route without creating any new Purchase workflow.
- Purchase form resolves the unit by ID first (name alias fallback), canonicalizes the bound item to the active Catalog Unit name, and locks the field only when that resolution succeeds.
- If Master Data cannot resolve the unit, the field remains editable and PM V2 blocks save/submit until the operator chooses an active unit; no silent blank unit is accepted.
- PO-item/PM V2 link validation treats Arabic/English names of the same Catalog Unit ID as equivalent.
- No SQL/schema, no new Master Data, no Legacy PM changes, and no change to shortage quantity, Purchase approvals, receiving, transfer, technician self-service, consumption, or return behavior.

Automated verification: focused Patch 114–116/Phase 4 regression **90/90 PASS**; broad PM V2 Node suite **282/300 PASS with the same 18 baseline failures**; changed TS/TSX syntax transpile **3/3 PASS**. Patch 116 real-project production build **PASS** on 2026-09-19, and manual UI verification confirmed the Unit field auto-filled as `PIECE / قطعة`.

## Patch 117 — PM V2-linked Purchase single-item/reference mode — CODE-READY / BUILD PENDING (2026-09-19)

Runtime trigger after Patch 116: the PM V2 Purchase handoff correctly auto-filled the Duracell unit, but the generic Purchase form still exposed **إضافة** and therefore allowed unrelated items to be mixed into a shortage-specific PM V2 request.

Patch 117 correction:
- `/purchase-orders/new` enters a clearly labeled **PM V2 linked mode** only when the existing PM V2 shortage context is present.
- The page shows **مرتبط بمهمة صيانة مجدولة PM V2**, the task reference, shortage reason, linked Catalog item, total task need, Team-Warehouse stock snapshot, exact purchase quantity, and PM V2 material-request references.
- One PM V2 shortage = one Purchase item. The linked Catalog identity and exact shortage quantity are locked; the unit remains locked when Patch 116 resolves Master Data and retains the same explicit fallback only when unresolved.
- The generic **إضافة صنف** action is hidden only in PM V2 linked mode. Ordinary Purchase requests keep their existing multi-item behavior unchanged.
- Submit/save payloads also collapse PM V2 linked mode to the single bound item, so stale client state cannot append unrelated items.
- Existing Purchase create/draft/approval/PO/Receiving workflows remain authoritative. PM V2 still only links the resulting authoritative PO Item; no Purchase tables are owned or mutated by PM V2 services.
- No SQL/schema, no Master Data duplication, no Legacy PM change.

Verification: focused Patch 114–117 regression **29/29 PASS**; broad PM V2 Node suite **288/306 PASS with the same 18 baseline failures**; changed TSX syntax transpile **2/2 PASS**. Production build is pending in the real project.


## Patch 118 — Purchase Unit Master-Data precedence
- Status: implemented; real-project build/manual check pending.
- Fixes the PM V2-linked Purchase Unit remaining blank when the PM V2 material snapshot uses an older operational label while the current Catalog Item has the active Catalog Unit.
- Current Catalog Item unit is now authoritative for Purchase handoff resolution; Inventory unit and PM V2 snapshot remain fallback/context sources.
- Purchase-item linking uses the same canonical Catalog Unit identity.
- Patch 117 single-item/reference behavior and all ordinary Purchase behavior are unchanged.
- No SQL/schema, no new Purchase workflow, no Master Data duplication, no Legacy PM changes.
- Automated: focused **75/75 PASS**; broad **291/309 PASS with the same 18 baseline failures**; syntax **1/1 PASS**.

## Patch 119 — Manual Purchase unit fallback + existing PO relink — CODE-READY / BUILD PENDING (2026-09-19)

Runtime trigger: the PM V2-linked Purchase was correctly constrained to one Duracell item and the buyer manually selected active Unit `PIECE / قطعة`, but submit created the Purchase Order and the subsequent PM V2 link failed with **وحدة بند طلب الشراء لا تطابق وحدة احتياج PM V2**.

Patch 119 correction:
- authoritative Purchase-unit locking now exists only when the linked Catalog Item itself resolves to an active Catalog Unit;
- when that Catalog linkage is absent, PM V2 keeps old unit text as display/context only and requires an explicit active unit selection in Purchase;
- the selected Purchase unit is accepted for that PO Item without updating Catalog/Master Data and without comparing it to the older PM V2 free-text snapshot;
- the already-created Purchase Order can be linked/relinked from its existing detail page by reading the stable `طلب مواد #... / بند #...` PM V2 reference stored in the order notes;
- relink uses the same idempotent `linkPurchaseOrder` endpoint and never creates a new Purchase Order.

No SQL/schema, no Purchase workflow rewrite, no Catalog/Master Data mutation, and no Legacy PM change.

Automated verification: focused Patch 115–119/warehouse regression **72/72 PASS**; broad PM V2 Node suite **295/313 PASS with the same 18 baseline failures**; changed TS/TSX syntax transpile **3/3 PASS**. Production build pending in the real project.


## 2026-09-22 — WIS multi-issue official runtime closure — CLOSED / PASS

- Patches 124–129 established the standalone **الصرف المخزني المتعدد** flow.
- Final operating boundary: existing four issue screens remain unchanged for single-item issuance; WIS is for multi-line issuance only and requires at least two lines.
- One WIS uses one source warehouse and one technician recipient and may contain multiple materials/Lots.
- Cost target requires Site + Section; Asset is optional.
- Same Lot may appear more than once only when Site/Section/Asset target differs; identical-target duplication is blocked and cumulative quantity across repeated Lot lines cannot exceed live available balance.
- Runtime acceptance included successful `WIS-2026-000004`, duplicate-target rejection, over-balance rejection, and final print verification.
- **WIS = CLOSED / PASS. Phase 4 remains IN PROGRESS.** Next work: Unlisted/non-Catalog material identity resolution and live rerouting.
- Closure reference: `docs/pmv2/PHASE4_WIS_MULTI_ISSUE_CLOSURE_2026-09-22.md`.

## Patch 134 — Persistent technician material attention — IMPLEMENTED / FOCUSED PASS (2026-09-24)

Problem addressed: material needs could be technically present inside individual task cards but become difficult for a technician to notice when the task feed is large.

Implemented:
- persistent **مواد تحتاج انتباهك** surface above normal tasks;
- 60-second refresh plus normal manual refresh;
- ready-to-receive priority and explicit waiting identity / warehouse / purchase / transfer states;
- request-owner scoping;
- resolved unlisted identity replaces the historical pre-resolution route as the actionable projection;
- existing technician Team-Warehouse receipt is reachable from the attention card.

No SQL/schema and no new stock workflow. Focused Patch 134 = **6/6 PASS**. Production build not re-verified in this environment.

## Patch 135 — Material shortage integrity — IMPLEMENTED / REGRESSION PASS (2026-09-24)

Baseline: full `eggt5.zip`, confirmed to contain Patch 134 byte-for-byte.

Implemented:
- active-material duplicate UI guard now includes warehouse-resolved Catalog identity;
- technician attention exposes initial shortage and current remaining shortage separately;
- Main-Warehouse received and Team-Warehouse issued/transferred quantities are exposed for progress clarity;
- current remaining shortage is reduced only by confirmed quantity issued into Team Warehouse;
- existing full-stock/no-request, partial-stock/true-shortage, identity-reroute, and server duplicate invariants are protected by Patch 135 regression tests rather than rewritten.

No SQL/schema. Focused Patches 114/115/131/134/135 = **39/39 PASS**. Broad PM V2 = **322/341 PASS, 19 fail**, with the same 19 failures as the **315/334** baseline. Build/check remains **NOT VERIFIED** in this execution environment due unavailable dependencies / `npm ci` timeout.

## Patch 136 — Warehouse queue organization — IMPLEMENTED / FOCUSED PASS (2026-09-24)

Reorganized `Pmv2WarehouseQueue` as a presentation-only change:
- one top work summary;
- action-required warehouse requests first;
- ready-to-issue second;
- pending returns third;
- existing architecture notice preserved after operational content;
- all existing fields, status explanations, Purchase references, identity action, Transfer/Purchase handoffs, issue/relink controls, Lot handling, recipient selection, and return confirmation retained.

No server/API/SQL/schema or business-rule change. Focused Patches 134/135/136 = **20/20 PASS**. PATCH136 TSX syntax transpile = **PASS**. Production build remains **NOT VERIFIED** in this source snapshot because dependencies are absent.

## Patch 137 — Warehouse tabs + progressive details — IMPLEMENTED / FOCUSED PASS (2026-09-24)

Patch 137 is a presentation-only continuation of Patch 136. The warehouse request page now exposes the three existing work categories as tabs so only one category is shown at once, with **تحتاج معالجة** as the default. Individual cards retain their existing header and keep their detailed content collapsed until the operator opens it.

No information, action, explanation, linked Purchase context, Lot control, recipient selector, recovery path, summary content, or PM V2 architecture notice is removed. No server/API, shortage calculation, Inventory, Purchase, Transfer, Delivery, Return, SQL/schema, or Legacy PM behavior changes.

Automated focused verification for Patches 134/135/136/137: **27/27 PASS**. Patch 137 TSX syntax transpile: **PASS**. Broad PM V2: **336/355 PASS, 19 fail** versus Patch 136 **329/348 PASS, 19 fail**; the failing test-name set is identical, so Patch 137 adds **0 new broad-suite failures**. Production build remains unverified in this dependency-free source snapshot.

## Patch 138 — Task continuation + responsibility timeline — IMPLEMENTED / AUTOMATED PASS (2026-09-26)

تم إغلاق فجوة استكمال البند المعلق بالمواد بعد انتهاء الزيارة اليومية: `ready_to_complete + needs_material` يمكن استكماله الآن داخل Visit مرتبطة بنفس Task مع `resume_execution`، ثم إكمال الاستهلاك/المرتجع الحالي.

أضيفت طبقة Timeline داخل PM V2 تقرأ مصادر الحقيقة الحالية للمواد والمشتريات والبلاغات دون تعديلها، وتشتق المسؤول الحالي ومدد المراحل والجهة/الشخص عندما يملك المصدر تعيينًا فعليًا.

لا SQL/schema. لا تغيير في Inventory/Purchase/Ticket workflow. Patch 123 Ticket closure behavior يبقى كما هو؛ Timeline يتعرف على `ticket_closed_completion` وينهي مدة انتظار البلاغ عنده.

Automated: Patch 138 **9/9 PASS**؛ focused **99/99 PASS**؛ broad **345/364 PASS, 19 fail** مقابل baseline `32qw76` **336/355 PASS, 19 fail** مع نفس أسماء الـ19 وبدون إخفاق جديد. Syntax runtime files **PASS**. Production build/full typecheck غير موثق بسبب غياب dependencies من source snapshot.

## PATCH139 status update — 2026-09-26

**Implemented in source:**
- maintenance-manager open-task monitoring from PATCH138 responsibility Timeline;
- owner/admin executive PM V2 indicators;
- PM V2 SLA/reminder configuration per responsibility role;
- current responsibility SLA classification (`not_configured / within / overdue`);
- deduplicated PM V2 responsibility/reminder/SLA alerts through the existing notifications service;
- PM V2-scoped recurring alert sweep;
- management Timeline drill-down.

**Deployment prerequisite:** apply `drizzle/2026_09_26_pmv2_monitoring_sla_alerts.sql`.

**Still not accepted/closed:** runtime UAT, manual material scenarios, mobile/tablet UAT, full production build/typecheck and Phase 6 regression/release.

## PATCH140 status update — 2026-09-26

**Implemented / focused and broad-regression verified.**

PATCH140 is a PM V2 presentation-only refinement of PATCH139 management monitoring:
- intervention work is placed first;
- remaining work is separated as under action;
- compact cards preserve the same current-responsibility facts;
- search remains immediate while advanced filters are progressively disclosed;
- Timeline, owner indicators, SLA/reminder settings and alert sweep remain available;
- no backend/API/SQL/schema or external workflow change.

Automated: PATCH140 **6/6 PASS**; PATCH139+140 **16/16 PASS**; broad **361/380 PASS, 19 fail** with identical 19 failure names to PATCH139, therefore **0 new failure**. TSX syntax **PASS**. Runtime/UAT still required on the applied project.

## PATCH141 — تقارير الصيانة المجدولة — CODE IMPLEMENTED
- صفحة إدارة مستقلة للتقرير اليومي أصبحت موجودة على `/scheduled-maintenance/reports`.
- مقارنة التكليف اليومي بالتنفيذ، المعلق، غير المبدوء، المرحل، وملاحظات الفني: **IMPLEMENTED**.
- عرض المسؤول الحالي وTimeline لكل مهمة: **IMPLEMENTED** عبر PATCH138 source truth.
- مقارنة فني منفرد: **IMPLEMENTED AS TEAM-SCOPE + ACTUAL PARTICIPATION** لأن PM V2 لا يملك Assignment فرديًا للـTask.
- SQL/Schema: **NONE**.
- Runtime/UAT على نسخة المستخدم: **PENDING**.

## PATCH142 status — IMPLEMENTED IN SOURCE (2026-09-26)
Remaining management-development scope before deferred UAT is implemented:
- team/day daily-report review persistence and UI;
- reviewer/time/optional note;
- open workload by specialty/status;
- average current-responsibility duration by role;
- last-30-days completion indicators by team and specialty.

SLA numeric thresholds remain intentionally unconfigured until Operations chooses them. Runtime/UAT for PATCH135–142 remains deferred by user decision. PATCH142 adds one PM V2-only table and does not mutate external workflows.
Automated verification: PATCH138–142 **39/39 PASS**; broad PM V2 **375/394 PASS, 19 fail** vs PATCH141 **368/387 PASS, 19 fail**, same baseline failure count and **0 new failures**. Changed-source syntax **PASS**. Runtime/UAT intentionally deferred.

## PATCH143 — Smart technician material picker — IMPLEMENTED / AUTOMATED PASS (2026-09-26)
- Closed the deferred DEC-065 picker UX item.
- No-search defaults now prioritize real usable Team-Warehouse stock, then same-target / same-Team evidence from `pmv2_material_usages`, then general Catalog fill.
- Search remains full active-Catalog by name/code; taxonomy path and Team-Warehouse balance are shown per result.
- No inferred specialty mapping, no SQL/schema, and no Inventory/Purchase/Ticket workflow write.
- Automated: dedicated **5/5 PASS**; Step 4.1 + PATCH143 **40/40 PASS**; focused material/PATCH131–143 **114/114 PASS**; broad **380/399 PASS, 19 fail** vs PATCH142 baseline recheck **375/394 PASS, 19 fail** with identical failure names and **0 new failures**; changed TS/TSX syntax **PASS**.
- Runtime/UAT remains intentionally deferred to the comprehensive PM V2 acceptance pass.
