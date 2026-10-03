# خطة الاختبارات وبوابات القبول — PM V2

## 1. القاعدة

كل مرحلة تنفيذية:

**Implementation → Test → Fix → Re-test → Acceptance Gate → Next Phase**

## 2. Phase 0 — Design & Integration Gate — PASS 2026-09-06

- [x] Existing Capability Audit مكتمل.
- [x] Schema التطبيق `cmms` مثبتة.
- [x] Users/Organization Reality Check مكتمل.
- [x] Organization contract = `Specialty → Team → Members`.
- [x] Maintenance Target Reality Check مكتمل.
- [x] Target contract = `Site | Section | Asset`.
- [x] Material Recipient Attribution مجمد.
- [x] Purchase Source/Handoff Reality Check مكتمل.
- [x] `packageId` ثبت أنه Purchase Packages capability وليس PM V2 source.
- [x] PO full-reuse contract مجمد.
- [x] Ticket reuse contract مجمد؛ A/B/C لا تتغير.
- [x] Task/Task Item State Machines مجمدة.
- [x] Material Request Item State Machine + Transition Ownership مجمدة.
- [x] Adapter boundaries مجمدة.
- [x] Closure rules مجمدة.
- [x] Final ERD Freeze PASS.
- [x] لا Duplicate Master Data في baseline.
- [x] لا Pending item بطلب المستخدم يمنع Phase 0.
- [x] التوثيق النشط نظف من الخطط الملغاة والمتعارضة.

**Phase 0 Acceptance Result: PASS / CLOSED.**

### State contracts under test

- Task Item: `pending | in_progress | waiting_material | waiting_ticket | ready_to_complete | completed`.
- Task: `pending | in_progress | waiting_material | waiting_ticket | ready_to_complete | completed | cancelled`.
- Material Request Item: `waiting_warehouse | external_purchase | received_warehouse | issued_to_team | consumed | cancelled`.

ملاحظة: هذا Design Gate ولا يدعي Runtime code pass؛ PM V2 code لم يبدأ بعد.

# البوابات التنفيذية الرسمية — 6 مراحل

## 3. المرحلة 1 — تأسيس الوحدة وربط البيانات الأساسية

### قاعدة البيانات والأمان

- [x] Namespace PM V2 مستقل ومسجل Additive.
- [x] Schema مطابق لـFinal ERD — DB Steps 1–18 = PASS يدويًا بواسطة المستخدم.
- [x] Internal FK/Unique للجداول التنظيمية المنفذة سليمة — Specialty→Team وTeam Member→Team ثبتا Runtime، وUNIQUE `(teamId,userId)` موجود فعليًا.
- [x] Static SQL ownership contract لـ`pmv2_teams`: FK داخلي للـSpecialty + Indexes للمراجع الخارجية + لا External FK.
- [x] Static SQL ownership contract لـ`pmv2_team_members`: FK داخلي للـTeam + Index لـ`userId` + لا FK إلى `users` + UNIQUE `(teamId,userId)`.
- [x] Security/Audit foundation wiring — policy + shared audit wrapper verified by standalone gate; full runtime integration remains part of final regression smoke.
- [x] Adapter interfaces الأساسية معرفة.
- [x] External Reference write-validation + indexes للجداول التنظيمية: Users/Warehouses عبر Adapters عند الكتابة، وIndexes موجودة بلا External FKs.
- [x] PM V2 standalone tests + Phase 1 standalone gate ينجحان؛ Production build للمشروع الكامل اكتمل. أعطال Full Vitest خارج PM V2 معزولة في `PEND-001`.

### التنظيم

- [x] Specialty CRUD/activation — implementation + static contract.
- [x] Team + Warehouse — implementation مع Warehouse Adapter validation.
- [x] Team Members من Users الحاليين — implementation مع reactivation لنفس row.
- [x] Permissions/Audit foundation wiring — standalone gate PASS; full application runtime smoke remains pending.

### أهداف الصيانة

- [x] Sites/Sections/Assets تقرأ عبر Adapter من الجداول الحالية.
- [x] Exactly-One Target contract ممثل كـdiscriminated union: Site أو Section أو Asset فقط.
- [x] Section بدون Asset مدعوم في Adapter/API.
- [x] لا Duplicate location master ولا writes إلى `sites/sections/assets` من PM V2.

### بوابة المرحلة 1

- [x] كل بنود PM V2 الخاصة بالمرحلة 1 PASS.
- [x] لا Regression منسوب إلى PM V2 في patch-isolation review؛ الأعطال العامة غير التابعة لـPM V2 موثقة منفصلة في `PEND-001`.

## 4. المرحلة 2 — إعداد خطط الصيانة وتوليد المهام

### قوائم الفحص والتكرار

- [x] Checklist create/update/list داخل PM V2 namespace.
- [x] Checklist Item create/update/list مع validation إلزامي عند الكتابة.
- [x] لا Hard Delete للقوائم أو البنود؛ التاريخ يحفظ بالتعطيل.
- [x] Shared audit يسجل mutations للقوائم والبنود.
- [x] Step 2.1 standalone contract = 6/6 PASS؛ PM V2 standalone files = 16/16 PASS.
- [x] Daily/Weekly/Monthly/Quarterly/Biannual/Annual — Step 2.2 recurrence contract PASS.
- [x] Disabled item لا يولد due.
- [x] Checklist reusable — Step 2.1 CRUD/soft activation contract PASS.
- [x] Monthly 29/30/31 يثبت إلى آخر يوم صالح في الشهر الأقصر.
- [x] Quarterly/Biannual/Annual تحفظ anchor month/day مع clamp لنهاية الشهر.
- [x] الحساب Date-only ولا يعتمد على timezone.
- [x] Step 2.2 recurrence test = 6/6 PASS.

### البرامج والجدولة

- [x] Program يربط Team + Checklist + Targets صحيحًا — Step 2.3 contract PASS.
- [x] Program Target يمر عبر Exactly-One + current Target Adapter validation.
- [x] Duplicate target rejected؛ Program identity protected after task generation.
- [x] Step 2.3 programs contract = 5/5 PASS.
- [x] Due dates صحيحة على مستوى recurrence calculator؛ Scheduler grouping ما زال Pending.
- [x] Task/Target grouping صحيح.
- [x] لا duplicate generation عند إعادة تشغيل Scheduler — runtime simulation rerun PASS.
- [x] Snapshots صحيحة.
- [x] Scheduler يعيد التحقق من External Target وقت التوليد.
- [x] Scheduler لا يولد قبل تاريخ إنشاء Program.
- [x] Scheduler overlap guard + Riyadh date-only registration.
- [x] Scheduler contract 7/7 + runtime simulation 5/5 + Phase 2 gate 6/6 PASS.

### بوابة المرحلة 2

- [x] إنشاء المهام تلقائيًا صحيح ومتكرر الاختبار — scheduler simulation + contract PASS.
- [x] لا duplicate Tasks.
- [x] لا Regression على المرحلة 1؛ PM V2 standalone files 21/21 PASS وpatch isolation PASS.

## 5. المرحلة 3 — تنفيذ الفني للمهمات — CLOSED / PASS

- [ ] **DEFERRED TO FINAL PROGRAM ACCEPTANCE (Phase 6):** Manual Mobile/Tablet responsive-layout verification. Not counted as PASS.
- [x] سليم.
- [x] تم الإصلاح.
- [x] تحتاج مواد.
- [x] تحتاج بلاغ صيانة.
- [x] Notes/images حسب contract.
- [x] Visits/Members/Leader Core behavior.
- [x] Task/Task Item transitions صحيحة.
- [x] Core Security/Audit يعملان.

Manual disclosure:
- [ ] **SKIPPED / ACCEPTED by explicit user decision:** dedicated runtime test where a *different* active teammate joins the same already-open Visit. Focused automated Step 3.2 coverage remains the accepted evidence for this branch; do not relabel it manual PASS.

### بوابة المرحلة 3 — CLOSED / PASS

- [x] السيناريوهات الأربعة تعمل من البداية للنهاية داخل PM V2 Core على النطاق المقبول.
- [x] Core stabilization/acceptance review found no additional Phase 3 runtime feature required before Phase 4.
- [x] No PM V2 regression attributable to the Phase 3 focused/manual sequence; latest focused Phase 3 regression = **53/53 PASS**. Phase 2 acceptance suite was intentionally not rerun.

**Phase 3 Acceptance Result: CLOSED / PASS by explicit user decision on 2026-09-13.** The two disclosures above remain SKIPPED/DEFERRED, not PASS.

## 6. المرحلة 4 — المواد والمستودع والشراء والبلاغات

### المواد والمخزون

- [ ] مادة موجودة بمخزن الفريق تستخدم current inventory flow.
- [ ] Main warehouse request فقط عند نقص Team warehouse.
- [ ] Warehouse Transfer الحالي عند التوفر.
- [ ] QR/Lot/stock validation الحالية.
- [ ] لا Stock mutation مباشر من PM V2.
- [ ] `issued_to_team` فقط بعد النقل الحقيقي.
- [ ] `consumed` فقط بعد usage حقيقية.

### الشراء

- [ ] إنشاء PO عادي من PM V2 source.
- [ ] `pmv2_material_purchase_links` trace إلى PO/PO Item صحيح.
- [ ] نفس PO workflow والصفحة/approval/packages/receiving/delivery الحالية.
- [ ] لا PM V2 IDs داخل ticket/package fields.
- [ ] Warehouse scoped permission — إن طبقت — محمية server-side.
- [ ] PO غير PM V2 يعمل كما كان.

### البلاغات

- [ ] `needs_ticket` يفتح نفس نافذة البلاغ الحالية.
- [ ] `pmv2_task_ticket_links` يحفظ المصدر.
- [ ] النظام الحالي يحدد A/B/C دون تدخل PM V2.
- [ ] Ticket غير PM V2 يعمل كما كان.
- [ ] إغلاق Ticket ينعكس على Task Item حسب contract.

### بوابة المرحلة 4

- [ ] تكامل المخزون/المستودع/الشراء/البلاغات كامل دون Workflow موازٍ.
- [ ] Existing PO/Ticket/Inventory flows لا تتغير ولا تنكسر.

## 7. المرحلة 5 — المتابعة والإغلاق والإدارة

### الإغلاق والمتابعة

- [ ] لا إغلاق مع بند غير مكتمل.
- [ ] لا إغلاق مع Material dependency فعالة.
- [ ] لا إغلاق مع Ticket مفتوح.
- [ ] Follow-up visit تعمل.
- [ ] `ready_to_complete` تعرض عند زوال التبعية.

### الإدارة

- [ ] Notifications/Reminders تعمل حسب العقود.
- [ ] Dashboards/Filters تعرض الحالة الصحيحة.
- [ ] KPIs قابلة للتتبع حسب Specialty/Team/Task status.
- [ ] الروابط الخارجية PO/Ticket تظهر بالحالة الصحيحة دون نسخ State Machines.

### بوابة المرحلة 5

- [ ] دورة المهمة من المتابعة حتى الإغلاق النهائي ناجحة.
- [ ] الإدارة ترى الحالة الحقيقية للمهمات والتبعيات.
- [ ] لا Regression على المراحل السابقة.

## 8. المرحلة 6 — الاختبار الشامل والإطلاق

### Regression

يجب إثبات عدم كسر:

- Users/Auth.
- Sites/Sections/Assets.
- Tickets/A-B-C.
- Inventory/Warehouses/QR/Lots.
- Purchase Orders/Packages/Receiving/Delivery.
- Legacy PM.

### UAT

سيناريو أساسي:

**Program → Scheduler → Task → Inspection → OK/Fix أو Material أو Ticket → Existing workflows → Follow-up/Resolution → Closure**.

- [ ] UAT end-to-end معتمد على الأجهزة الفعلية.
- [ ] لا Critical blockers.
- [ ] Rollback readiness موثقة ومختبرة حسب خطة الإصدار.
- [ ] Deployment checks ناجحة.
- [ ] Monitoring/Stabilization criteria ناجحة.

### بوابة المرحلة 6 النهائية

- [ ] Full Regression PASS.
- [ ] UAT PASS.
- [ ] Release PASS.
- [ ] Stabilization PASS حسب معايير الإصدار.

## 9. شرط بيئة الاختبار

نسخة Phase 0 لم تحتو Dependencies محلية كاملة. لذلك عند بدء التنفيذ، لا يغلق أي Gate برمجي بالStatic inspection فقط؛ يجب تشغيل أدوات البناء/الاختبار الفعلية في بيئة مناسبة وتوثيق النتيجة.


### تنفيذ/اختبار Patch Foundation — 2026-09-07

- [x] Static review: PM V2 namespace لا يعدل Legacy PM أو Ticket/Purchase/Inventory workflows.
- [x] Security policy unit contract أضيف إلى `server/tests/pmv2-foundation.test.ts`.
- [x] Shared audit namespace contract test أضيف.
- [x] Focused TypeScript static compile لعقود Adapter + Security policy نجح بتاريخ 2026-09-07.
- [ ] Full Vitest/Typecheck runtime: Pending لأن `node_modules` غير متاحة؛ محاولة `npm ci --prefer-offline` تجاوزت مهلة بيئة العمل. لا تعتبر المرحلة PASS قبل تشغيلها بنجاح في بيئة dependencies متاحة.
- [x] DB runtime verification حتى DB Step 5: PASS بناءً على نتائج المستخدم و`SHOW CREATE TABLE` للبنية الفعلية.


### تنفيذ/اختبار Organization + Targets — 2026-09-07

- [x] DB Step 3 runtime result: `pmv2_team_members` = PASS بناءً على `Query OK` من المستخدم.
- [x] TypeScript syntax transpile للملفات الجديدة/المعدلة = PASS.
- [x] Static ownership assertions: External reference validation + direct JOIN reads + no Master Data writes = PASS.
- [x] Static Target assertions: Site/Section/Asset فقط + Site→Section→Asset validation = PASS.
- [ ] Full Vitest / full project Typecheck = PENDING؛ `node_modules` غير متاحة ومحاولة `npm ci --ignore-scripts --prefer-offline` تجاوزت مهلة البيئة.
- [x] DB Step 4 runtime: PASS — المستخدم نفذ `pmv2_checklists` وأرسل `Query OK`, 0 rows affected.
- [x] DB Step 5 static SQL contract: Checklist internal FK + recurrence fields/checks + no external FK.
- [x] DB Step 5 runtime: PASS — DDL نُفذ ثم أُغلق بعد structure readback.


### TiDB CHECK mitigation / Checklist Item validation — 2026-09-08

- [x] تم تسجيل تحذيرات DB Step 5 وعدم اعتبار `CHECK` حماية فعلية.
- [x] `validatePmv2ChecklistItemWrite()` يرفض `sortOrder < 0`.
- [x] يرفض قيمًا غير منطقية لـ`isRequired/isActive`.
- [x] يرفض `frequencyValue <= 0` عند تحديدها.
- [x] يرفض `weekday` خارج 0..6.
- [x] يرفض `monthDay` خارج 1..31.
- [x] يرفض القيم غير الصحيحة للحقول الأساسية ويثبت تاريخ `anchorDate` عند تحديده بدون تعريف Scheduler behavior مبكرًا.
- [x] اختبار مستقل قابل للتشغيل بدون Dependencies المشروع: `node --experimental-strip-types --test server/tests/pmv2-checklist-validation.node.mjs` = PASS، 5/5.
- [x] DB Step 5 structural readback: PASS؛ تم تأكيد FK/Indexes والبنية الفعلية.
- [ ] Full Vitest / project Typecheck: ما زال PENDING حسب ISSUE-009.

## Phase 1 DB Step 5 structure readback — 2026-09-08

- [x] `SHOW CREATE TABLE pmv2_checklist_items` يؤكد وجود الجدول.
- [x] Internal FK `checklistId → pmv2_checklists.id` موجود.
- [x] Indexes: checklist / active / frequency موجودة.
- [x] لا `CHECK` في البنية الفعلية، بما يطابق baseline التنفيذي بعد معالجة TiDB.
- [x] DB Step 5 = PASS.
- [x] DB Step 6 `pmv2_programs` runtime = PASS (`Query OK`, 0 rows affected).
- [x] DB Step 7 `pmv2_program_targets` runtime = PASS (`Query OK`, 0 rows affected).
- [x] DB Step 8 `pmv2_tasks` runtime = PASS — user execution confirmed (`Query OK`, 0 rows affected).

## Phase 1 DB Step 6 preparation — 2026-09-08

- [x] Static SQL contract: Program يرتبط داخليًا بـTeam وChecklist فقط.
- [x] `createdById` Indexed External Reference بلا FK إلى `users`.
- [x] لا Program CRUD أو Scheduler behavior في هذا الجزء.
- [x] DB Step 6 runtime: PASS — user execution confirmed 2026-09-08.


## Phase 1 DB Step 7 preparation — 2026-09-08

- [x] DB Step 6 runtime confirmed by user: `pmv2_programs` = PASS (`Query OK`, 0 rows affected).
- [x] Program Target SQL contract: internal FK to `pmv2_programs`.
- [x] Site/Section/Asset are indexed External References with no physical FKs.
- [x] Duplicate target of the same type within one Program blocked by UNIQUE keys.
- [x] Exactly One Site | Section | Asset enforced by PM V2 write-boundary validation, not TiDB `CHECK`.
- [x] Standalone Program Target validation/SQL contract: `node --experimental-strip-types --test server/tests/pmv2-program-target-validation.node.mjs` = PASS, 5/5.
- [x] DB Step 7 runtime: PASS — user execution confirmed 2026-09-08 (`Query OK`, 0 rows affected).


## Phase 1 DB Step 8 preparation — 2026-09-08

- [x] DB Step 7 runtime confirmed: `pmv2_program_targets` = PASS.
- [x] `pmv2_tasks` uses internal FKs to Program, Program Target, and Team only.
- [x] `taskNumber` is UNIQUE.
- [x] Scheduler idempotency barrier is UNIQUE `(programId, programTargetId, dueDate)`.
- [x] Frozen Task states represented exactly; default = `pending`.
- [x] Standalone schema contract: `node --test server/tests/pmv2-task-schema.node.mjs` = PASS, 4/4.
- [ ] DB Step 8 runtime: PENDING user execution.
- [ ] Scheduler/Task generation behavior: NOT STARTED; remains Phase 2.


## 2026-09-08 — DB Step 9 Task Item schema contract

- Standalone Node contract: `server/tests/pmv2-task-item-schema.node.mjs`.
- Expected: 5/5 PASS.
- Covers internal-only FKs, frozen snapshot fields, unique generation key, Task Item states, technician result values.
- Full Vitest/full project Typecheck remain pending while project dependencies are unavailable in this working environment.


## Phase 1 DB Step 9 runtime / DB Step 10 preparation — 2026-09-08

- [x] DB Step 9 `pmv2_task_items` runtime = PASS — user execution confirmed (`Query OK`, 0 rows affected).
- [x] `pmv2_visits` has internal FK `taskId → pmv2_tasks.id`.
- [x] Visit header stores start time and optional end time only; Visit completion does not imply Task closure.
- [x] No physical FK from Visit header to `users/sites/sections/assets/warehouses`.
- [x] Standalone Visit schema contract: `node server/tests/pmv2-visits-schema.node.mjs` = PASS, 4/4.
- [x] DB Step 10 runtime: PASS — user execution confirmed (`Query OK`, 0 rows affected).
- [ ] Visits/Members/Leader runtime behavior remains Phase 3; this step is Schema foundation only.


## Phase 1 DB Step 10 runtime / DB Step 11 preparation — 2026-09-08

- [x] DB Step 10 `pmv2_visits` runtime = PASS — user execution confirmed (`Query OK`, 0 rows affected).
- [x] `pmv2_visit_members` uses internal FK `visitId → pmv2_visits.id`.
- [x] `userId` is indexed External Reference; no Physical FK to `users`.
- [x] UNIQUE `(visitId, userId)` blocks duplicate membership in one Visit.
- [x] `isLeader` stored without relying on TiDB `CHECK`; runtime leader/member rules remain Phase 3.
- [x] Standalone Visit Member schema contract: `node server/tests/pmv2-visit-members-schema.node.mjs` = PASS, 5/5.
- [ ] DB Step 11 runtime: PENDING user execution.
- [ ] Full Vitest / project Typecheck remains PENDING while project dependencies are unavailable.


## Phase 1 DB Step 11 runtime / DB Step 12 preparation — 2026-09-08

- [x] DB Step 11 `pmv2_visit_members` runtime = PASS — user execution confirmed (`Query OK`, 0 rows affected).
- [x] `pmv2_item_actions` has internal FK `taskItemId → pmv2_task_items.id`.
- [x] `pmv2_item_actions` has internal FK `visitId → pmv2_visits.id`.
- [x] Frozen technician results are present exactly: `ok | fixed | needs_material | needs_ticket`.
- [x] `performedById` is indexed External Reference with no physical FK to `users`.
- [x] Evidence stays on the existing attachment service; no parallel PM V2 attachment table is created.
- [x] Standalone contract: `node --test server/tests/pmv2-item-actions-schema.node.mjs` = PASS, 5/5.
- [ ] DB Step 12 runtime: PENDING user execution.
- [ ] Technician execution/state transitions: NOT STARTED; remains Phase 3.


## 2026-09-08 — DB Step 13 Material Request Header contract

- `server/tests/pmv2-material-requests-schema.node.mjs` = PASS (5/5).
- يتحقق من العلاقات الداخلية إلى Task Item/Visit/Team.
- يتحقق من أن Requester وTeam Warehouse مراجع خارجية مفهرسة بلا FK خارجي.
- يتحقق من عدم وجود Status مستقل في Header.
- يتحقق من السماح بأكثر من طلب تاريخي لنفس Task Item.
- Full Vitest / project Typecheck يبقيان PENDING لعدم توفر Dependencies المحلية.


## 2026-09-08 — DB Step 13 runtime / DB Step 14 Material Request Item schema/validation contract

- [x] DB Step 13 `pmv2_material_requests` runtime = PASS — user execution confirmed (`Query OK`, 0 rows affected).
- [x] `pmv2_material_request_items.requestId` uses an internal FK to `pmv2_material_requests.id`.
- [x] `catalogItemId` is an indexed External Reference without physical FK to `catalog_items`.
- [x] Frozen states represented exactly: `waiting_warehouse | external_purchase | received_warehouse | issued_to_team | consumed | cancelled`.
- [x] Quantities use `DECIMAL(12,3)`; no ineffective TiDB `CHECK` constraints are declared.
- [x] Write-boundary validation rejects requested quantity `<= 0` and negative received/issued projections.
- [x] Standalone schema contract: `node --test server/tests/pmv2-material-request-items-schema.node.mjs` = PASS (6/6).
- [x] Runtime validation smoke check with Node type stripping = PASS (5/5).
- [x] DB Step 14 runtime: PASS — user execution confirmed (`Query OK`, 0 rows affected).
- [ ] Material/Inventory/Purchase runtime transitions: NOT STARTED; remain Phase 4.
- Full-project regression status at this intermediate checkpoint is superseded by the final Phase 1 gate section below.


## 2026-09-08 — DB Step 14 runtime / DB Step 15 Purchase Link schema contract

- [x] DB Step 14 `pmv2_material_request_items` runtime = PASS — user execution confirmed (`Query OK`, 0 rows affected).
- [x] `pmv2_material_purchase_links.materialRequestItemId` uses an internal FK to `pmv2_material_request_items.id`.
- [x] `purchaseOrderId`, `purchaseOrderItemId`, and `createdById` remain indexed External References without physical FKs.
- [x] `purchaseOrderItemId` is UNIQUE in the link table; pair `(materialRequestItemId, purchaseOrderItemId)` is also UNIQUE.
- [x] `linkedQuantity` uses `DECIMAL(12,3)` and no ineffective TiDB `CHECK`.
- [x] Write-boundary validation owns `linkedQuantity > 0` and total allocation `<= requestedQuantity`.
- [x] Purchase Adapter ownership is explicit: it must verify PO Item belongs to PO; no Purchase workflow state is copied or mutated.
- [x] Standalone schema contract: `node --test server/tests/pmv2-material-purchase-links-schema.node.mjs` = PASS (6/6).
- [x] Write-boundary quantity validation smoke: PASS (4 cases: 1 valid + 3 rejected invalid cases).
- [x] DB Step 15 runtime: PASS — user execution confirmed (`Query OK`, 0 rows affected).
- Full-project regression status at this intermediate checkpoint is superseded by the final Phase 1 gate section below.


## 2026-09-08 — DB Step 15 runtime / DB Step 16 Ticket Link schema contract

- [x] DB Step 15 `pmv2_material_purchase_links` runtime = PASS — user execution confirmed (`Query OK`, 0 rows affected).
- [x] `pmv2_task_ticket_links.taskItemId` uses an internal FK to `pmv2_task_items.id`.
- [x] `ticketId` and `createdById` are indexed External References without physical FKs to `tickets/users`.
- [x] `ticketId` is UNIQUE in the link table.
- [x] No duplicate `taskId`, Ticket status, or maintenance path is stored in the link.
- [x] Standalone schema contract: `node --test server/tests/pmv2-task-ticket-links-schema.node.mjs` = PASS (5/5).
- [x] DB Step 16 runtime: PASS — user execution confirmed (`Query OK`, 0 rows affected).
- [ ] Ticket creation/open-ticket runtime rules remain NOT STARTED; they belong to Phase 4 and the current Ticket Adapter/Workflow.
- Full-project regression status at this intermediate checkpoint is superseded by the final Phase 1 gate section below.


## 2026-09-08 — DB Step 16 runtime / DB Step 17 Material Usage schema/validation contract

- [x] DB Step 16 `pmv2_task_ticket_links` runtime = PASS — user execution confirmed (`Query OK`, 0 rows affected).
- [x] `pmv2_material_usages` uses internal FKs to Task Item and Visit.
- [x] `materialRequestItemId` is nullable and, when present, uses an internal FK to `pmv2_material_request_items`.
- [x] Warehouse/Catalog/Inventory Transaction/Lot/Delivery Document/PO Item/Recorder are indexed External References with no physical external FK.
- [x] `usedQuantity` uses `DECIMAL(12,3)` with PM V2 write-boundary validation for `> 0`; no ineffective TiDB `CHECK` is declared.
- [x] Schema contains no PM V2 stock balance or Inventory workflow status.
- [x] Standalone schema contract: `node --test server/tests/pmv2-material-usages-schema.node.mjs` = PASS (5/5).
- [x] Usage validation smoke: `node --experimental-strip-types --test server/tests/pmv2-material-usage-validation.node.mjs` = PASS (5/5).
- [x] DB Step 17 runtime: PASS — user execution confirmed (`Query OK`, 0 rows affected).
- [ ] Inventory/consumption runtime behavior remains Phase 4 and must call the existing Inventory/Delivery services.
- Full-project regression status at this intermediate checkpoint is superseded by the final Phase 1 gate section below.


## 2026-09-08 — DB Step 17 runtime / DB Step 18 Request Reminder schema contract

- [x] DB Step 17 `pmv2_material_usages` runtime = PASS — user execution confirmed (`Query OK`, 0 rows affected).
- [x] Final ERD relationship preserved: Material Request `1→N` Request Reminders.
- [x] `requestId` uses an internal FK to `pmv2_material_requests.id`.
- [x] Recipient/Notification/Creator are indexed External References; no physical FK to `users` or `notifications`.
- [x] Existing Notification service remains authoritative; reminder table stores no duplicate title/message/status.
- [x] `reminderType` remains flexible VARCHAR; Phase 5 owns scheduling/rules and can evolve without an enum migration.
- [x] Multiple historical reminders are allowed.
- [x] Standalone schema contract: `node --test server/tests/pmv2-request-reminders-schema.node.mjs` = PASS (5/5).
- [x] DB Step 18 runtime: PASS — user execution confirmed (`Query OK`, 0 rows affected).
- [x] Phase 1 Acceptance Gate: CLOSED / PASS لـPM V2 بتاريخ 2026-09-08. External project-wide baseline failures tracked as `PEND-001`.
- Full-project regression status at this intermediate checkpoint is superseded by the final Phase 1 gate section below.


## Phase 1 final schema + acceptance-gate run — 2026-09-08

- [x] DB Step 18 `pmv2_request_reminders` runtime = PASS (`Query OK`, 0 rows affected).
- [x] All 18 frozen PM V2 tables are now runtime-confirmed created.
- [x] `node --experimental-strip-types --test server/tests/pmv2-*.node.mjs` = **63/63 PASS** before adding the aggregate gate.
- [x] `node --test server/tests/pmv2-phase1-acceptance-gate.node.mjs` = **6/6 PASS**.
- [x] TypeScript syntax + relative import path scan over PM V2/PM V2 routers/shared touched files = PASS.
- [x] Diff isolation against the project baseline with Warehouse Item Receipt fix applied on both sides: no existing Legacy PM/Ticket/Purchase/Inventory workflow source file changed by PM V2 patches.
- [ ] `npm run check` — no result present in the user-supplied run; retain as project-wide follow-up.
- [x] `npm test` — executed on the complete user project: `531 passed / 20 failed`; all observed failures are outside PM V2 scope and are tracked as `PEND-001`.
- [x] `npm run build` — completed successfully (`vite` build completed), with warnings outside PM V2 tracked as `PEND-001`.
- [ ] Full application runtime regression smoke — deferred to the project-wide baseline review; patch-isolation review found no PM V2-attributed Legacy PM/Ticket/Purchase/Inventory workflow regression.

**Phase 1 Gate (historical):** CLOSED / PASS لـPM V2. Full-project failures التي لم تُنسب إلى PM V2 تم عزلها في `PEND-001` للمراجعة لاحقًا. **الحالة الحالية:** Phase 2 = CLOSED / PASS، Phase 3 = READY / NOT STARTED.

## 2026-09-08 — Scheduled Maintenance UI / manual test surface

- [x] Sidebar contains a separate `الصيانة المجدولة` PM V2 section/path.
- [x] Legacy `/preventive` route remains present and unchanged.
- [x] UI exposes Organization, Checklists, Programs/Targets, and Scheduled Tasks tabs.
- [x] New UI calls `trpc.pmv2.*` only; no direct Legacy PM/Ticket/Purchase/Inventory API calls.
- [x] Generated task browser is read-only and protected by the PM V2 management procedure.
- [x] Manual scheduler run can be repeated for the same date to verify idempotency.
- [x] TypeScript syntax transpile check for all touched UI/backend files = PASS.
- [x] `node --experimental-strip-types --test server/tests/pmv2-*.node.mjs` = **71/71 PASS**.

### Manual Phase 1–2 entry point

Open **الصيانة المجدولة** from the sidebar (route `/scheduled-maintenance`). Do not use the old **الصيانة الوقائية/الدورية** screen at `/preventive` when testing PM V2.

### Regression — disabled Specialty scheduler eligibility (2026-09-08)
Manual acceptance scenario:
1. Active Program + active Checklist + active Team + active Specialty generates due tasks.
2. Disable the Specialty while leaving the Team active.
3. Run scheduler for a new due date.
4. Expected after fix: `createdTasks = 0`, `createdTaskItems = 0`.

Automated guards:
- `server/tests/pmv2-phase2-scheduler.node.mjs` asserts the Specialty join and active filter.
- `server/tests/pmv2-specialty-disable-scheduler-regression.node.mjs` fails if the eligibility query stops enforcing active Program + Specialty + Team + Checklist.

Regression rerun result after Specialty scheduler fix:
- Full standalone PM V2 suite reconstructed through Patch 047: 23/23 test files PASS, 0 FAIL.

## 2026-09-09 — Patch 058 biweekly existing-task runtime regression
- Added `server/tests/pmv2-biweekly-existing-task-backfill.node.mjs` using the production recurrence + validation + scheduler engine.
- Exact case: program already has 2026-09-21 tasks with three historical daily items; then active item `فحص كل أسبوعين` is added with `frequency=weekly`, `frequencyValue=2`, `weekday=1`, `anchorDate=2026-06-01`.
- Rerun 2026-09-21: `createdTasks=0`, `existingTasks=2`, `createdTaskItems=2`, errors=0; one new biweekly item per target task.
- 2026-09-14 remains non-due for the biweekly item; normal due items may still be generated for that date.
- Added `server/tests/pmv2-manual-scheduler-date-helper.node.mjs` to lock the UI helper that copies an exact `كل المهام` search date to manual scheduler execution.

### Patch 059 — historical recurrence provenance
- [x] DDL contract adds five nullable structured recurrence snapshot columns to `pmv2_task_items`.
- [x] Scheduler engine passes the due checklist item's recurrence configuration into task-item generation.
- [x] Scheduler runtime simulation confirms recurrence snapshots are stored together with title/order snapshots.
- [x] Historical task-item read path prefers persisted snapshots and falls back to source checklist recurrence for pre-patch rows.
- [x] Arabic recurrence label formatter covers daily, weekly, every-two-weeks, monthly/day-10, month-end, quarterly, biannual, and annual labels.
- [x] Scheduled Maintenance renders the recurrence badge beside each historical task item.
- [x] Focused snapshot contract test: 5/5 PASS.
- [x] Phase 2 scheduler runtime regression: 5/5 PASS.
- [x] Modified TS/TSX syntax transpilation: PASS.
- [ ] Manual DB ALTER runtime confirmation: PENDING user execution.
- [ ] Manual UI confirmation of recurrence badges on existing and newly generated task items: PENDING after DB ALTER + patch application.

### Patch 060 — historical task-item read regression
- [x] Manual evidence: scheduler created `2` tasks and `12` task items for 2026-10-05, but historical-item UI returned no rows after Patch 059.
- [x] Root cause isolated to missing `pmv2ChecklistItems` schema import in `server/pmv2/tasks/read-service.ts`.
- [x] Focused recurrence snapshot/read contract now includes an import/join regression guard: **6/6 PASS**.
- [ ] Manual UI recheck after Patch 060: open one of the already-created 2026-10-05 tasks and confirm historical items + recurrence badges display. Do not rerun the scheduler for this verification.

### Patch 061 — exact-date task filtering / hidden-error regression
- [x] Manual evidence: two tasks existed for `2026-10-05`, while the same-day `كل المهام` date filter later rendered `0 مهمة`.
- [x] Same-day range now uses exact `dueDate = date` matching.
- [x] Real ranges retain inclusive `dateFrom/dateTo` bounds.
- [x] All-tasks date changes explicitly refresh the task query.
- [x] Task-query failures are surfaced visibly instead of being rendered as an empty list.
- [x] Focused regression: **5/5 PASS**.
- [ ] Manual UI recheck: select `2026-10-05` in both date fields and confirm the two existing tasks appear automatically.

### Patch 062 — already-linked target dropdown filtering
- [x] Selected program targets are converted to linked target IDs for the active target type.
- [x] Already-linked Site/Section/Asset rows are excluded from the dropdown.
- [x] Program refetch after successful linking refreshes available options immediately.
- [x] Switching programs clears stale target selection.
- [x] Empty availability state shows a clear Arabic message.
- [x] Focused UI regression: **5/5 PASS**.
- [ ] Manual UI check: link a fresh target, confirm it disappears from the same program dropdown, and confirm it remains available in another program where it is not already linked.

### Patch 063 — `كل كم دورة` zero/negative regression
Manual evidence before fix:
- `كل كم دورة = 0` was accepted and created checklist item order `12`.
- `كل كم دورة = -1` was accepted and created checklist item order `13`.
- Root cause was client-side normalization to `1`, not a missing service-boundary rule.

Automated regression:
- [x] backend rejects `frequencyValue = 0`.
- [x] backend rejects `frequencyValue = -1`.
- [x] backend rejects fractional `frequencyValue`.
- [x] backend accepts `frequencyValue = 1`.
- [x] UI no longer contains the `Math.max(1, ...)` clamp.
- [x] UI blocks submit with a clear Arabic validation message.
- [x] number input declares minimum `1`, integer step `1`, and an invalid state.
- Focused regression result: **7/7 PASS**.
- [ ] Manual recheck after Patch 063: try `0`, then a negative value; neither item may be created.

## Patch 064 recurrence UX regression coverage — 2026-09-09
- Functional recurrence checks cover multiple weekdays, biweekly alternation, multiple monthly dates + month end, custom quarterly dates, and multiple annual dates.
- Validation checks confirm the new schedule JSON can drive quarterly recurrence without a legacy anchor while rejecting frequency/config mismatches.
- UI regression checks confirm the normal form no longer shows `كل كم دورة` or `تاريخ الارتكاز`, exposes the custom multi-date options, and displays a plain-language preview.
- Snapshot regression checks confirm scheduler -> repository -> task read path includes `recurrenceLabelSnapshot`.
- Local verification for Patch 064:
  - TypeScript recurrence modules compile to CommonJS: PASS.
  - Functional recurrence assertions: PASS.
  - UI + snapshot static regression tests: 9/9 PASS.
  - TypeScript/TSX syntax transpile for all changed TS/TSX files: PASS.


## Patch 065 test — program estimated duration schema
Run `node server/tests/pmv2-program-estimated-duration-schema.node.mjs`. Expected: PASS. Manual DB step is intentionally one ALTER only.

## Patch 066 manual acceptance
1. Open الصيانة المجدولة → البرامج والأهداف.
2. Select an existing program and press `تعديل البرنامج`.
3. Confirm the edit panel shows الفريق، قائمة الصيانة، والمدة التقديرية للمهمة.
4. Enter `120`, save, and confirm the program shows `ساعتان`.

Automated regression: `server/tests/pmv2-program-duration-edit-ui.node.mjs`.

### Patch 066 manual acceptance result — PASS (2026-09-12)
- [x] Existing Program #1 duration `120` saved and rendered as `ساعتان`.
- [x] Duration `100` rendered as `1 س 40 د`.
- [x] Attempt to change the team after generated tasks was rejected with the historical-safety message.
- [x] Attempt to change the checklist after generated tasks was rejected with the same historical-safety rule.

## Patch 067 — daily team workload calculation/status
Automated regression: `server/tests/pmv2-daily-team-workload.node.mjs`.

Coverage:
- [x] 8-hour capacity baseline = 480 minutes.
- [x] Status boundaries: 240=`available`, 241=`medium`, 360=`medium`, 361=`high`, 480=`high`, 481=`conflict`.
- [x] Read service aggregates by team + due date using `pmv2_programs.estimatedDurationMinutes`.
- [x] Cancelled tasks are excluded from workload.
- [x] Missing estimates are surfaced with `unknownDurationTaskCount` + `estimateComplete`.
- [x] Read-only `pmv2.tasks.dailyWorkload` validates ISO date range and optional team filter.
- [ ] Manual manager-facing verification intentionally waits for the next simple `حمل الفرق` view step; Patch 067 itself adds no visible UI.

## Patch 068 — Simple team workload view
Automated regression coverage:
- `server/tests/pmv2-team-workload-view.node.mjs`
- Guards the new `حمل الفرق` tab, weekly navigation, four workload labels, incomplete-duration indicator, daily detail panel, and cancelled-task exclusion alignment.

Manual acceptance — one step at a time:
1. Open `الصيانة المجدولة → حمل الفرق` and confirm the weekly matrix opens clearly with active teams as rows and Sunday–Saturday as columns. Stop and report the result before testing a cell.

## Patch 069 — Operational workload readability
Automated regression coverage:
- `server/tests/pmv2-team-workload-view.node.mjs`
- Guards the current-week default (`من اليوم وما بعده`), full-week toggle, active-team filter wiring, overdue unfinished-task count, explicit no-auto-rollover message, and visual past/today distinction hooks.

Manual acceptance — one step at a time:
1. Open `الصيانة المجدولة → حمل الفرق` during the current week and confirm the default visible day columns start at **اليوم** and continue through Saturday, with **من اليوم وما بعده** selected. Stop and report the result before testing the full-week toggle or team filter.

## Patch 070 — Direct overdue navigation from workload
Automated regression coverage:
- `server/tests/pmv2-team-workload-view.node.mjs`
- Guards the clickable overdue alert, controlled main-tab navigation, overdue task scope handoff, and preservation of the selected team filter.

Manual acceptance — one step at a time:
1. With `كل الفرق` selected in `الصيانة المجدولة → حمل الفرق`, click the overdue alert and confirm the screen opens `المهام المجدولة` with **المتأخرة** selected automatically.
2. After that passes, repeat from `حمل الفرق` with one team selected and confirm the destination keeps the same team filter.


## Patch 071 — workload acceptance checkpoint
Manual results already confirmed by user on 2026-09-12:
- [x] Patch 068 weekly workload tab opens normally.
- [x] Patch 069 current week defaults to `من اليوم وما بعده`.
- [x] `الأسبوع كامل` shows all seven days with elapsed days visually subdued and today highlighted.
- [x] Team filter can isolate `TEST-02` (or another selected active team).
- [x] Separate overdue alert is visible and follows the selected team.
- [x] Patch 070 overdue alert opens `المهام المجدولة → المتأخرة` directly.
- [x] Same selected team is preserved in the overdue destination filter.

Focused regression strengthened in `server/tests/pmv2-team-workload-view.node.mjs` to guard the existing populated-cell detail wiring: exact `teamId`, exact single-day `dateFrom/dateTo`, and cancelled-task exclusion.

Remaining manual workload acceptance — one test only:
- [ ] Click one **populated** team/day workload cell. Expected: the detail panel opens for the same team + same date and lists that day's non-cancelled tasks. Do not start Phase 3 after this test; first record the result and run the final Phase 2 acceptance decision.

## Patch 072 — authentication/session stability hotfix
Context before the hotfix:
- [x] Patch 071 populated team/day cell manual acceptance passed: clicking a populated cell showed that day's tasks for the selected team.
- Repeated apparent logout behavior interrupted further Phase 2 acceptance.

Automated regression:
- [x] `node server/tests/auth-session-stability.node.mjs` => PASS.
- [x] Changed TS/TSX files pass isolated TypeScript syntax transpilation.
- [x] `server/tests/pmv2-team-workload-view.node.mjs` remains PASS after the auth changes.

Manual acceptance — one test only:
- [x] User manually confirmed session stability after normal PM V2 navigation/refresh: no repeated spontaneous logout was observed.

## Patch 073 — Workload task-duration detail
Automated regression:
- [x] `server/tests/pmv2-team-workload-view.node.mjs` verifies `estimatedDurationMinutes` is returned by the task list and rendered in the selected team/day detail panel.
- [x] Modified TS/TSX files pass isolated TypeScript syntax transpilation.

Manual acceptance — one test only:
- [ ] Open one populated **حمل الفرق** cell and confirm every listed task shows **المدة التقديرية** in readable hours/minutes, while the task count/details remain unchanged.

## Patch 074 — automatic checklist item ordering
Automated regression: `server/tests/pmv2-checklist-auto-order.node.mjs`.

Coverage:
- [x] Empty checklist automatic order starts at `1`.
- [x] A legacy `0` row does not cause a new item to receive `0`.
- [x] Automatic create takes the next number after the highest existing order.
- [x] Manager UI no longer exposes the manual `الترتيب` input.
- [x] Manager create request omits `sortOrder` so the service is authoritative.
- [x] Checklist UI renders human ordinal positions starting from `1`.
- [x] Focused regression: `7/7 PASS`.
- [x] Patch 064 simple recurrence UI regression: `6/6 PASS` after the change.
- [x] Team-workload UI regression: PASS after the change.
- [x] TypeScript/TSX syntax transpile for the three changed runtime TS/TSX files: PASS.

Manual acceptance — one step at a time:
1. Reopen `قائمة صيانة اختبارية 2` and confirm the previously visible `0.` is now shown as `1.` and there is no manual `الترتيب` field in the add-item form. Stop and report before creating the next recurrence test item.

## Patch 075 — reset checklist-item form after successful create
Automated regression: `server/tests/pmv2-checklist-item-form-reset.node.mjs`.

Coverage:
- [x] Successful checklist-item create invokes one explicit form-reset helper.
- [x] Item title is cleared after success.
- [x] Normal recurrence default returns to `شهري` with day `1` and no `آخر يوم` selection.
- [x] Custom month/quarter/year selections are cleared.
- [x] Custom interval/start helpers return to safe defaults.
- [x] The currently selected checklist remains open; only the add-item form is reset.
- [x] Focused reset regression: `6/6 PASS`.
- [x] Patch 074 automatic-order regression: `7/7 PASS`.
- [x] Team-workload UI regression: PASS.
- [x] `ScheduledMaintenance.tsx` isolated TypeScript/TSX syntax transpile: PASS.

Manual acceptance — one step at a time:
1. In the currently open checklist, save one checklist item with non-default custom recurrence (for example `مخصص → أشهر → آخر يوم`). Expected after success: the saved item remains in the list, the checklist stays selected, and the add-item form resets to a blank title + normal monthly default with no old custom selections carried over. Stop and report the result before resuming the remaining recurrence acceptance tests.

## Patch 076 — manager-friendly recurrence wording
Automated focused coverage:
- `server/tests/pmv2-manager-friendly-recurrence-ui.node.mjs`
  - verifies technical custom labels are removed from the manager form;
  - verifies day/week/month/quarter/year plain-language interval conversions;
  - verifies `2 quarters` is displayed as `كل 6 أشهر` and `4 quarters` as `كل سنة`;
  - verifies client and server recurrence labels agree.
- `server/tests/pmv2-simple-recurrence-ui-regression.node.mjs`: 6/6 PASS after wording changes.
- `server/tests/pmv2-task-item-recurrence-snapshot.node.mjs`: 6/6 PASS after manager-readable fallback label updates.
- `server/tests/pmv2-checklist-item-form-reset.node.mjs`: 6/6 PASS; Patch 075 reset behavior preserved.
- Syntax/transpile check for changed TS/TSX runtime files: 3/3 PASS.

Manual acceptance — next single test only:
- Open a custom quarterly schedule, set **فترة التكرار = 2**. Expected live meaning: **كل 6 أشهر**. Add two execution appointments inside the target quarter and confirm the final preview remains plain-language and lists both appointments. Do not run Scheduler in this test.


## Patch 077 — two-question recurrence UX
Automated focused coverage:
- `server/tests/pmv2-manager-friendly-recurrence-ui.node.mjs`: 3/3 PASS.
  - verifies the manager sees **متى يتكرر الفحص؟**, **يتكرر الفحص كل**, **النتيجة**, and **متى يتم التنفيذ؟**;
  - verifies old `التكرار حسب`, `فترة التكرار`, and `المعنى` labels are absent;
  - keeps the existing plain-Arabic interval conversion checks.
- `server/tests/pmv2-simple-recurrence-ui-regression.node.mjs`: 6/6 PASS after the wording/layout change.
- `server/tests/pmv2-checklist-item-form-reset.node.mjs`: 6/6 PASS; Patch 075 reset behavior remains intact.
- `ScheduledMaintenance.tsx` isolated TypeScript/TSX syntax transpilation: PASS.

Manual acceptance — next single test only:
- Open **مخصص**, choose a non-default interval such as `2` with **أسبوع**. Expected: the form reads as **يتكرر الفحص كل 2 أسبوع**, the live **النتيجة** says **كل أسبوعين**, and the second section is **متى يتم التنفيذ؟** with weekday choices. Do not run Scheduler in this test.


## Patch 078 — optional program title
Automated focused coverage: `server/tests/pmv2-program-title-ui.node.mjs`.

Coverage:
- [x] Drizzle schema contains nullable `title` length 200.
- [x] Recorded migration matches the single manually executed SQL statement.
- [x] Create/update APIs accept optional trimmed title up to 200 chars.
- [x] Service returns, creates, and updates title with blank-to-NULL normalization.
- [x] UI supports create/edit title, title-aware search, and `برنامج #N` fallback.
- [x] Title editing remains independent of the historical team/checklist lock.

Manual acceptance — next single test only:
1. Edit existing **برنامج #3**, enter a clear title such as `برنامج اختبار التكرار المخصص`, save, and confirm the card/detail show the title while preserving `برنامج #3` as the reference. Do not run Scheduler in this test.

Patch 078 verification result (2026-09-12):
- `pmv2-program-title-ui.node.mjs`: 2/2 PASS.
- `pmv2-program-duration-edit-ui.node.mjs`: PASS.
- `pmv2-phase2-programs.node.mjs`: 5/5 PASS.
- `pmv2-scheduled-maintenance-usability.node.mjs`: 6/6 PASS.
- Isolated TS/TSX syntax transpile for schema/service/router/ScheduledMaintenance: 4/4 PASS.

## Patch 079 — manual Scheduler due-program scope
Automated focused coverage: `server/tests/pmv2-manual-scheduler-program-scope.node.mjs`.

Coverage:
- [x] Due-program discovery returns only active programs due on the selected date and excludes a program created after that date.
- [x] Manual `runForDate(date, programId)` generates only for the selected due program.
- [x] Normal `runForDate(date)` still generates for all due programs.
- [x] Router exposes due-program query + optional positive `programId`.
- [x] Manager UI labels **كل البرامج المستحقة / برنامج محدد**, due-only selector, empty-date message, and dynamic run button.
- [x] Existing **استخدام تاريخ البحث** helper resets any stale selected program when copying the date.
- [x] Phase 2 Scheduler contract regression: `7/7 PASS`.
- [x] Scheduler runtime/idempotency regression: `5/5 PASS` after updating its local transpile harness for the current schedule-config import.

Manual acceptance — next single test only:
1. In **المهام المجدولة → تشغيل الجدولة اليدوي للاختبار**, choose `2026-09-12`, then choose **برنامج محدد**. Expected: the dropdown shows only programs due on that date, including the titled Program #3 (`برنامج اختبار التكرار المخصص`) because its checklist now has the saved daily test item. Do not press Run yet; report the dropdown contents first.


## Patch 080 — Phase 2 final acceptance closure
Final manual acceptance record (2026-09-12):

- [x] Patch 066 estimated-duration display/edit and historical team/checklist lock: PASS.
- [x] Patches 068–073 `حمل الفرق` manager acceptance: PASS.
- [x] Patch 074 automatic checklist-item ordering: PASS.
- [x] Patch 075 add-item form reset: PASS.
- [x] Patches 076–077 manager-friendly/two-question recurrence UX: PASS.
- [x] Patch 078 program title create/edit/display: PASS.
- [x] Patch 078 program-title search: PASS (`المخصص` returned titled Program #3).
- [x] Patch 079 due-only program dropdown for selected date: PASS.
- [x] Patch 079 selected-program run: PASS.
- [x] Patch 079 rerun idempotency on the same date: PASS (`0 new / 1 existing / 0 new items` in the tested Program #3 case).
- [x] Patch 079 all-due-program manual scope and generated next-day task visibility: PASS.
- [ ] **SKIPPED by explicit user decision:** custom `كل 3 أيام` with anchor date — Scheduler due/non-due runtime check.
- [ ] **SKIPPED by explicit user decision:** Scheduler runtime check for a custom recurrence with multiple dates inside one cycle.

Skipped items above are intentionally **not counted as PASS**.

Final closure decision:
- **Phase 2 = CLOSED / PASS (final acceptance, 2026-09-12).**
- **Phase 3 = READY / NOT STARTED.**
- No additional manual Phase 2 test is required before the next explicitly approved phase.

Patch 080 automated/focused verification on the current Patch 079 runtime baseline:
- **62 focused checks PASS / 0 product failures** across closure consistency, recurrence UI wording, checklist auto-order/reset, programs/title/duration, Scheduler contract/runtime/manual scope/date helper, workload, and Scheduled Maintenance usability.
- Full dependency-based project suite was not rerun in this packaged workspace because `node_modules` is not present; Patch 080 contains no runtime code changes.


## Patch 081 — Phase 3 Step 3.1 technician read foundation
Automated focused coverage (new only; Phase 2 acceptance suite was **not rerun**):
- `server/tests/pmv2-phase3-step3-1-technician-read.node.mjs` = **6/6 PASS**.
- Confirms the Patch 078 `pmv2_programs.title` Drizzle declaration is present without introducing new SQL.
- Confirms technician execution permission remains separate from PM V2 management.
- Confirms today's task query is restricted by logged-in `userId` + active team membership + Riyadh date and excludes cancelled tasks.
- Confirms Task Item read repeats the membership check and maps unauthorized/cross-team IDs to `NOT_FOUND`.
- Confirms PM V2 router registration, dedicated technician route, technician-only sidebar item, and read-only UI (`useQuery` only; no mutation).
- Changed TS/TSX syntax transpile using the installed TypeScript compiler API = **13/13 PASS**.
- Full-project `tsc --noEmit` = **NOT RUN in this ZIP environment** because dependencies are not installed (`node_modules` absent; `pnpm` unavailable). This is not recorded as PASS.

Manual acceptance — completed 2026-09-13:
1. Clean task generated for today: `PMV2-20260913-P5-T13`, team `PMV2-TEAM-01`, two due-today items = **PASS**.
2. Active assigned technician opened **الصيانة المجدولة → مهامي اليوم** and saw exactly the expected task, target/team, `0/2` progress, and both task items = **PASS**.
3. Separate technician not assigned to `PMV2-TEAM-01` saw `0` tasks = **PASS**.
4. The assigned technician's PM V2 team membership was disabled temporarily; the same account then saw `0` tasks = **PASS**.
5. Membership was reactivated after the isolation check = **PASS / cleanup complete**.

**Step 3.1 manual runtime acceptance = CLOSED / PASS.** No Visit, Item Action, result submission, or Task/Task Item mutation was exercised or started.


## Patch 082 — Step 3.1 acceptance record
- Documentation-only checkpoint recording the completed manual runtime acceptance above.
- Phase 2 skipped runtime checks remain SKIPPED and were not rerun.
- No SQL and no additional Phase 3 mutation coverage.

## Patch 083 — Phase 3 Step 3.2 Start Execution
Automated focused verification (Phase 2 suite deliberately not rerun):
- `server/tests/pmv2-phase3-step3-1-technician-read.node.mjs` + `server/tests/pmv2-phase3-step3-2-start-execution.node.mjs` = **14/14 PASS**.
- Confirms per-Task transaction/`FOR UPDATE`, active membership + Task/Item ownership checks, one-open-Visit reuse, Leader/Member behavior, `pending → in_progress`, `start_execution` Item Action, same-transaction PM V2 audit, and the pending-only **بدء التنفيذ** UI.
- Changed TS/TSX syntax transpile = **4/4 PASS**.
- Phase 2 acceptance tests were not rerun.

Manual runtime acceptance — **CLOSED / PASS (2026-09-13)**:
1. Assigned technician started Task Item `437`: Item + Task became `قيد التنفيذ` while Item `438` remained pending = **PASS**.
2. Same technician started Task Item `438`: both Items and the Task remained `قيد التنفيذ` = **PASS**.
3. DB trace confirmed exactly one open Visit for Task `104`: Visit `1`, `endedAt = NULL` = **PASS**.
4. DB trace confirmed Visit Member `userId = 19110028`, `isLeader = 1` on Visit `1` = **PASS**.
5. DB trace confirmed two Item Actions: Task Items `437` and `438`, both `start_execution`, both by `19110028` = **PASS**.
6. DB trace confirmed two matching audit rows: `pmv2.item_start_execution` for `pmv2.task_item` entities `437` and `438` = **PASS**.

Manual scope note:
- The same technician started both items. Single-open-Visit reuse is runtime-confirmed.
- A *different* active teammate joining the existing Visit was **not separately manually tested**; that branch remains covered by the focused Step 3.2 automated contract.
- `سليم`, `تم الإصلاح`, `تحتاج مواد`, and `تحتاج بلاغ` were not tested because those result mutations are not implemented yet.

**Step 3.2 manual runtime acceptance = CLOSED / PASS.**


## Patch 084 — Step 3.2 acceptance record
- Documentation-only checkpoint recording the completed manual runtime acceptance above.
- No runtime code and no SQL.
- Phase 2 tests were not rerun; the two explicitly skipped Phase 2 recurrence runtime checks remain SKIPPED.
- Phase 3 Step 3.2 = **CLOSED / PASS**.
- Step 3.3/result submission remains **NOT STARTED**.


## Patch 085 — Phase 3 Step 3.3 basic `ok/fixed` results
Automated focused verification (Phase 2 suite deliberately not rerun):
- `server/tests/pmv2-phase3-step3-1-technician-read.node.mjs` + `server/tests/pmv2-phase3-step3-2-start-execution.node.mjs` + `server/tests/pmv2-phase3-step3-3-basic-results.node.mjs` = **23/23 PASS**.
- New Step 3.3 contract verifies active membership/ownership, Task-row serialization, exactly one open Visit, optional Visit join, `in_progress → completed`, `submit_result` Item Action, optional note, Task completion projection, same-transaction Audit, and UI exposing only **سليم / تم الإصلاح** in this slice.
- `needs_material` and `needs_ticket` are intentionally not exposed or mutated by Patch 085.
- Changed TS/TSX syntax transpile = **3/3 PASS**. No SQL/schema change. Full dependency-based project typecheck remains outside this packaged workspace when dependencies are unavailable.

Manual runtime acceptance — **CLOSED / PASS (2026-09-13)**:
1. Assigned technician `pmv2tech01` submitted **سليم** on Item `437`: Item became `completed` with result `ok`, progress became `1/2`, Task remained `in_progress`, and Item `438` remained `in_progress` = **PASS**.
2. The same technician submitted **تم الإصلاح** on Item `438`: Item became `completed` with result `fixed`, progress became `2/2`, and Task became `completed` = **PASS**.
3. DB verification for Task `104` / `PMV2-20260913-P5-T13`: Items `437/438` both `completed`, results `ok/fixed`, result Item Actions `3/4` both `submit_result`, saved notes match the UI submissions, performer `19110028` = **PASS**.
4. Audit verification: rows `7235627/7235628`, action `pmv2.item_result_submitted`, entity type `pmv2.task_item`, entity IDs `437/438`, user `19110028` = **PASS**.

**Step 3.3 basic `ok/fixed` slice manual runtime acceptance = CLOSED / PASS.**

Scope boundary remains explicit: `needs_material`, `needs_ticket`, Visit ending, attachments/images, and external Inventory/Purchase/Ticket integration were not tested because they are not implemented in this slice.


## Patch 086 — Step 3.3 basic `ok/fixed` acceptance record
- Documentation-only checkpoint recording the completed Patch 085 manual runtime acceptance above.
- No runtime code and no SQL.
- Phase 2 tests were not rerun; the two explicitly skipped Phase 2 recurrence runtime checks remain SKIPPED.
- Step 3.3 overall remains IN PROGRESS; only the `ok/fixed` slice is CLOSED / PASS.


## Phase 3 — Patch 087 / Step 3.3B dependency results Core slice

Automated/source-contract verification:
- Step 3.1 + Step 3.2 + Step 3.3A + Step 3.3B focused Node suite = **34/34 PASS**.
- Changed TS/TSX syntax transpile = **3/3 PASS**.
- Confirms frozen `needs_material/needs_ticket` enums and waiting states are reused with **no SQL/schema change**.
- Confirms active Team membership + Task/Item ownership revalidation, Task `FOR UPDATE`, exactly one open Visit, optional Visit join, and `in_progress`-only dependency result submission.
- Confirms `needs_material → waiting_material` and `needs_ticket → waiting_ticket`, `submit_result` Item Action, optional note, performer, and same-transaction `pmv2.item_result_submitted` Audit.
- Confirms cached Task priority `waiting_material > waiting_ticket`, and that existing dependency summaries are not erased when another Item later completes `ok/fixed`.
- Confirms Task summaries in waiting states still permit unrelated pending/in-progress Item execution.
- Confirms no Material Request/Ticket/Inventory/Purchase creation and no Visit ending in this patch.
- Phase 2 tests were not rerun.

Manual runtime acceptance: **PENDING**.

First manual check only after deploying Patch 087:
1. Prepare a fresh due-today PM V2 test Task for `PMV2-TEAM-01` with at least two Items, start both Items, then on the first Item submit **تحتاج مواد** with an optional note. Confirm that Item becomes `بانتظار المواد`, the Task summary becomes `بانتظار المواد`, and the second Item remains actionable. Stop and report before testing `تحتاج بلاغ`.

## Phase 3 — Patch 088 / Step 3.3B manual acceptance closure

Manual runtime acceptance: **PASS**.

Verified on fresh Task `PMV2-20260913-P6-T14` / Task `105` with technician `19110028`:
1. Started Item `439`, submitted **تحتاج مواد** with note `يحتاج مادة أو قطعة لاستكمال العمل`; UI showed Item `بانتظار المواد`, Task `بانتظار المواد`, and Item `440` remained actionable = **PASS**.
2. Started Item `440` while Item `439` was still waiting for material = **PASS**.
3. Submitted **تحتاج بلاغ صيانة** on Item `440` with note `يوجد تلف يحتاج بلاغ صيانة ومتابعة`; UI showed Item `بانتظار البلاغ` while Item `439` remained `بانتظار المواد` = **PASS**.
4. Task summary remained `waiting_material`, confirming fixed mixed dependency priority `waiting_material > waiting_ticket` = **PASS**.
5. Live DB: Item `439` = `waiting_material / needs_material`, Action `6`; Item `440` = `waiting_ticket / needs_ticket`, Action `8`; both `submit_result`, notes saved, performer `19110028` = **PASS**.
6. Audit: rows `7235641` and `7235643`, `action = pmv2.item_result_submitted`, entities `439/440`, user `19110028` = **PASS**.

Acceptance boundary:
- No real Material Request, Ticket, Inventory, or Purchase write was expected or performed.
- Patch 088 changes documentation only; no SQL and no runtime code.
- Phase 2 tests were not rerun; the two explicitly skipped Phase 2 recurrence runtime checks remain SKIPPED.
- Step 3.3 basic Core outcomes are now **CLOSED / PASS**. Phase 3 remains IN PROGRESS because Visit ending and remaining Phase 3 core acceptance are not yet closed.



## Phase 3 — Patch 089 / Step 3.4 Visit ending

Automated/source-contract verification (Phase 2 suite deliberately not rerun):
- Step 3.1 + Step 3.2 + Step 3.3A + Step 3.3B + Step 3.4 focused Node suite = **43/43 PASS**.
- Changed TS/TSX syntax transpile = **5/5 PASS**.
- Confirms active Team membership revalidation, Task-row serialization, exactly one open Visit, Leader-only authorization, rejection while any Item is `in_progress`, `endedAt` update, same-transaction `pmv2.visit_ended` Audit, repeated-end rejection, and no forced Task/Task Item mutation.
- Confirms the technician UI reads open Visit/Leader state, shows **إنهاء الزيارة** only to the Leader, and disables it while an Item is `in_progress`.
- Confirms no SQL/schema change and no Material Request/Ticket/Inventory/Purchase integration.

Manual runtime acceptance: **PENDING**.

First manual check only after deploying Patch 089:
1. Sign in as the Leader technician `pmv2tech01`, open Task `PMV2-20260913-P6-T14`, and confirm the **إنهاء الزيارة** action is visible and enabled while Item `439` is `waiting_material` and Item `440` is `waiting_ticket`. Click **إنهاء الزيارة** once. Confirm the success message appears, the end action disappears, Task remains `بانتظار المواد`, Item `439` remains `بانتظار المواد`, and Item `440` remains `بانتظار البلاغ`. Stop and report before DB/Audit verification.


## Phase 3 — Patch 090 / Step 3.4 manual acceptance closure

Manual runtime acceptance of Patch 089 = **CLOSED / PASS**.

Verified in order:
1. UI: Leader technician `pmv2tech01` ended the open Visit for Task `PMV2-20260913-P6-T14`; the end action disappeared, while Item `439` remained `waiting_material`, Item `440` remained `waiting_ticket`, and the Task remained `waiting_material` = **PASS**.
2. Live DB: Visit `2` / Task `105` retained `startedAt = 2026-09-13 10:59:05` and received `endedAt = 2026-09-13 11:42:05` = **PASS**.
3. Audit: row `7235645` recorded `pmv2.visit_ended` for `entityType = pmv2.visit`, `entityId = 2`, `userId = 19110028`, `createdAt = 2026-09-13 11:42:05` = **PASS**.
4. No SQL/schema change, no Material Request/Ticket/Inventory/Purchase integration, and no Phase 2 test rerun occurred.

**Step 3.4 Visit ending = CLOSED / PASS.** Phase 3 remains IN PROGRESS pending review/acceptance of the remaining Phase 3 core scope.


## Phase 3 — Patch 091 / Step 3.5 execution images/evidence
Automated focused contract/regression result: **53/53 PASS** across Phase 3 Steps 3.1–3.5. Changed TS/TSX syntax transpile: **6/6 PASS**. Phase 2 tests were not rerun.

Verified by focused source contracts:
- [x] Existing `attachments` table is reused; no PM V2 evidence/attachment table is introduced.
- [x] Evidence entity is `pmv2_item_action`, matching the frozen DB contract that images/evidence belong to Item Action.
- [x] Read: exact Task Item + active Task-Team membership; PM V2 management review read remains allowed.
- [x] Write: technician role + active Task-Team membership + same `performedById` + Visit still open.
- [x] More than one open Visit produces no upload target. Ended Visit blocks writes.
- [x] PM V2 evidence is image-only in this slice; upload uses existing `/api/upload` and `attachments.add`.
- [x] UI renders all evidence for the Item across its Item Actions, so an image attached during `start_execution` remains visible after a later `submit_result` action.
- [x] Existing attachment Audit remains active as `add_attachment` / `pmv2_item_action`.
- [x] No Task/Task Item state mutation and no Phase 4 external integration is introduced.

**Manual runtime acceptance pending.** First manual check only: on an Item with an open Visit and at least one Item Action performed by the logged-in technician, upload one image using **إضافة صورة / دليل** and confirm the thumbnail appears under the same Item. Stop and report before DB/Audit verification.


## Phase 3 — Patch 092 / Step 3.5 manual acceptance closure
Manual runtime acceptance of Patch 091 = **CLOSED / PASS**.

Verified in order:
1. UI upload: technician `pmv2tech01` uploaded one execution image under Task `PMV2-20260913-P5-T13`, Item `437`; the thumbnail appeared under the same Item = **PASS**.
2. Persistence: after **تحديث**, the image remained visible = **PASS**.
3. Live DB: attachment `3000641` is registered as `entityType = pmv2_item_action`, linked to Item Action `3` / Task Item `437`, uploaded by `19110028` = **PASS**.
4. Post-Visit read/write boundary: after ending the Visit, the image remained visible while **إضافة صورة / دليل** disappeared, proving ended Visit blocks new evidence writes but not evidence reads = **PASS**.
5. Audit: existing attachment Audit recorded `add_attachment` for the `pmv2_item_action` evidence by technician `19110028` = **PASS**.
6. No SQL/schema change and no Phase 4 Material/Ticket/Inventory/Purchase integration occurred.

**Step 3.5 execution images/evidence = CLOSED / PASS.** Phase 3 remains IN PROGRESS pending Core stabilization / acceptance-gate review.

## Patch 093 — Phase 3 final acceptance closure

Final acceptance decision (2026-09-13):
- [x] Steps 3.1–3.5 accepted on their documented scopes.
- [x] Four Core technician outcomes accepted: `ok | fixed | needs_material | needs_ticket`.
- [x] Task/Task Item state projection, Visit lifecycle baseline, optional execution evidence, membership security, and Audit paths accepted.
- [ ] **SKIPPED / ACCEPTED:** separate manual runtime run for a second active teammate joining the same open Visit. Automated Step 3.2 coverage is accepted by user decision.
- [ ] **DEFERRED:** manual Mobile/Tablet responsive-layout check moves to the final program acceptance in Phase 6.
- [x] Patch 093 itself is documentation-only; no SQL and no runtime behavior change.

**Final Phase 3 result: CLOSED / PASS. Phase 4 = READY / NOT STARTED.**


## Phase 4 — Patch 094 / Step 4.1 material intake
Automated focused result: **15/15 PASS** for Step 4.1. Combined Phase 3 focused regression + Step 4.1 = **68/68 PASS**. Changed TS/TSX syntax transpile = **6/6 PASS**. Phase 2 tests were not rerun.

Verified by focused source/contract tests:
- [x] Active catalog is reused through an adapter; no PM V2 material master is created.
- [x] Team Warehouse is the existing Team warehouse and is revalidated active.
- [x] Current inventory availability is read-only and Lot-aware when Lot tracking is active.
- [x] Ambiguous inventory rows are rejected; no arbitrary inventory record is chosen.
- [x] Write requires active Team membership, exact Task/Item ownership, and `waiting_material / needs_material`.
- [x] The material need inherits the accepted `needs_material` execution Visit for traceability.
- [x] Full Team-Warehouse availability creates **no Material Request** and returns current Inventory/Delivery handoff metadata.
- [x] Partial/zero availability creates request rows for the shortage only, initial item state `waiting_warehouse`.
- [x] Frozen PM V2 Material Request Item validation is reused.
- [x] Active duplicate Task Item + Catalog Item request is rejected.
- [x] No Inventory/Lot update, Warehouse Transfer, Purchase, Ticket, or Legacy PM mutation is introduced.
- [x] PM V2 Audit records the material routing/request decision.
- [x] Technician router exposes catalog search, material state read, and submit-material-need under technician authorization.
- [x] `مهامي اليوم` shows material intake only for `waiting_material / needs_material`.

**Manual runtime acceptance pending.** First manual check only: after applying Patch 094 and restarting, log in as `pmv2tech01`, open Task `PMV2-20260913-P6-T14`, and confirm Item `439` (the accepted `needs_material` Item) now shows the material-intake panel with Team Warehouse, material selector, quantity, and unit. Do not submit a material need yet; stop and report the UI result.


## Phase 4 — Patch 095 / Step 4.1 balance-preview refinement
Automated focused result: **18/18 PASS** for Step 4.1 after the balance-preview refinement. Combined Phase 3 focused regression + Step 4.1 = **71/71 PASS**. Changed TS/TSX syntax transpile = **5/5 PASS**; changed Node test syntax = PASS. Phase 2 tests were not rerun.

Coverage added/updated:
1. [x] Catalog options are enriched with Team Warehouse availability through the existing Inventory adapter.
2. [x] Availability lookup is scoped to the selected Task/Task Item and active Team membership.
3. [x] Batch availability remains Warehouse/Catalog scoped and frozen inventory rows are excluded.
4. [x] Lot-enabled mode uses positive Lot balances for the displayed/decision availability.
5. [x] Material selector renders a balance label beside each material.
6. [x] Selected material renders **requested / available / shortage** preview before submit.
7. [x] Full availability preview explains that no PM V2 request is created and actual issue stays in Inventory/Delivery.
8. [x] Partial/zero availability preview explains that only the shortage will be requested.
9. [x] Server-side submit still rechecks availability and does not trust UI preview.
10. [x] No Stock mutation/reservation, Warehouse Transfer, PO, Ticket integration, or SQL was added.

Manual runtime evidence already completed before Patch 095:
- [x] `waiting_material` panel rendered for Task `PMV2-20260913-P6-T14` / Item `439`.
- [x] A deliberately exaggerated requirement created Material Request `#1` for Catalog Item `300042` with requested shortage `1111`, status `waiting_warehouse`, received `0`, issued `0`.
- [x] Direct Inventory lookup in Team Warehouse `30002` for Catalog Item `300042` returned empty set, confirming availability = `0` for that test.

**Manual acceptance remains pending after Patch 095.** First post-refinement test only: reopen the same Item, search/select Catalog Item `300042` (`1.5" 90 كوع حديد سن خارجي`), and confirm the selector shows Team Warehouse balance `0` and the preview shows requested/available/shortage before submit. **Do not submit again**, because an active request already exists for this Item + Catalog Item.


## Patch 096 — Phase 4 Step 4.1 open-task carry-over visibility correction

Automated verification:
- `server/tests/pmv2-phase4-step4-1-material-intake.node.mjs` = **21/21 PASS** after adding carry-over assertions.
- Combined Phase 3 focused regression + Step 4.1 = **74/74 PASS**.
- Updated Step 3.1 contract test no longer requires exact-today-only filtering; it verifies active Team membership plus the Riyadh date upper bound/carry-over rule.
- Changed TS/TSX syntax transpile (`read-service.ts`, `Pmv2MyTasks.tsx`) = **2/2 PASS**.
- Changed Node test syntax = **2/2 PASS**.
- Phase 2 tests were not rerun.

Contract verified:
- [x] `dueDate <= Riyadh today`; future Tasks are not exposed.
- [x] `cancelled` Tasks are excluded.
- [x] Previous-date `completed` Tasks are not carried forward.
- [x] Previous-date non-final Tasks remain visible and are marked `isCarryOver`.
- [x] No `dueDate` mutation or replacement Task is used.
- [x] UI separates **مهام اليوم** from **مهام سابقة مفتوحة** and displays the original due date.

**Manual runtime acceptance pending — one check only:** sign in as `pmv2tech01` on 2026-09-14 and open **الصيانة المجدولة → مهامي اليوم**. Confirm Task `PMV2-20260913-P6-T14` appears under **مهام سابقة مفتوحة**, still shows its original 2026-09-13 due date and `بانتظار المواد` state. Do not submit another material request.


## Patch 097 — Phase 4 Step 4.1 unlisted-material branch
Automated verification:
- Step 4.1 focused source/contract tests = **26/26 PASS**.
- Combined Phase 3 focused regression + Step 4.1 = **79/79 PASS**.
- Changed TS/TSX syntax transpile (`request-service.ts`, `technician.ts`, `Pmv2MyTasks.tsx`) = **3/3 PASS**.
- Phase 2 tests were not rerun.

Coverage added:
- [x] Technician can explicitly choose **مادة غير موجودة في الدليل** instead of selecting an incorrect Catalog item.
- [x] Unlisted request requires free-text item name, quantity, and unit.
- [x] `catalogItemId = NULL` + `itemNameSnapshot` reuse the existing frozen schema; no SQL.
- [x] No Catalog creation/master-data duplication from technician UI.
- [x] No Inventory availability is guessed for an unlisted item; full need is sent to `waiting_warehouse` for resolution.
- [x] Audit distinguishes unlisted request and records availability as not checked.
- [x] Active duplicate unlisted request by normalized name on the same Task Item is rejected.
- [x] Existing Catalog-item shortage/full-stock paths remain unchanged.

**Manual runtime acceptance pending — one check first:** on an existing `waiting_material` Item, click **سجلها كمادة غير موجودة في الدليل** and confirm the free-text material-name + quantity + unit form appears. Do not submit until that UI is reported.

## Patch 098 — Step 4.1 post-submit reset / duplicate UX acceptance
Automated source/contract verification:
- Step 4.1 focused suite: **29/29 PASS**.
- Phase 3 focused regression + Step 4.1: **82/82 PASS**.
- Phase 2 acceptance tests were not rerun.

Manual acceptance — perform one action at a time:
1. On the existing `waiting_material` Item after applying Patch 098, confirm the saved active requests are visible but the old populated intake form is **not** left open; an **إضافة مادة أخرى** button is shown instead.
2. Only after step 1 passes, press **إضافة مادة أخرى** and verify a clean/empty form opens.
3. Verify an already-active Catalog material is marked **مطلوب بالفعل** and is not selectable.
4. In unlisted mode, type the exact active free-text material name again (extra spaces/case differences may be used); verify the UI shows the active-duplicate warning and submit is disabled.
5. Do not create another duplicate request. Server-side duplicate protection remains the final boundary if the UI is bypassed.

Manual acceptance remains **PENDING** until these checks are recorded.



## Patch 099 — Step 4.1 count-unit fractional-quantity guard
Automated verification:
- Step 4.1 focused suite = **32/32 PASS**.
- Combined Phase 3 focused regression + Step 4.1 = **85/85 PASS**.
- Changed TS/TSX syntax transpile (`shared/pmv2MaterialQuantity.ts`, `request-service.ts`, `Pmv2MyTasks.tsx`) = **3/3 PASS**.
- Changed Node test syntax = **PASS**.
- Phase 2 tests were not rerun.

Coverage added:
1. [x] Known count units include Arabic and common English aliases such as `قطعة`, `حبة`, `علبة`, `لفة`, `كيس`, `وحدة`, `piece`, `box`, `roll`, `pack`.
2. [x] Shared policy rejects fractional quantity for a count unit with **هذه الوحدة لا تقبل الكسور؛ أدخل عددًا صحيحًا.**
3. [x] Service uses the shared policy before availability routing or request persistence.
4. [x] UI uses the same policy, switches number input step/min to whole values, displays inline error, and disables submit.
5. [x] Divisible/unknown units retain decimal capability instead of being silently forced to whole numbers.
6. [x] No SQL or external workflow mutation is added.

**Manual runtime acceptance — one check only:** on the existing `waiting_material` Item, select the stocked pen whose issue unit is `قطعة`, enter `2.5`, and confirm the UI shows **هذه الوحدة لا تقبل الكسور؛ أدخل عددًا صحيحًا.**, disables submit, and does not show a valid shortage decision. Do not submit until this check passes.


## Patch 100 — Step 4.1 persistent ready-to-issue Team Warehouse handoff
Automated verification:
- Step 4.1 focused suite = **35/35 PASS**.
- Combined Phase 3 focused regression + Step 4.1 = **88/88 PASS**.
- Changed TS/TSX syntax transpile (`request-service.ts`, `Pmv2MyTasks.tsx`) = **2/2 PASS**.
- Changed Node test syntax = **PASS**.
- Phase 2 tests were not rerun.

Live evidence already accepted before Patch 100:
1. [x] `2.5 قطعة` is rejected and cannot route.
2. [x] Stocked pen with Team Warehouse quantity `5` and need `2` previews **2 / 5 / 0**.
3. [x] Full-stock submit creates no PM V2 Material Request and does not mutate stock; live DB returned `teamWarehouseQuantity = 5`, `pmv2RequestCount = 0`.
4. [x] UX issue identified: the full-stock verification button stayed active because the success was not persisted as Domain state.

Coverage added by Patch 100:
1. [x] Full-stock routing writes `material_route_decision` Item Action in the same transaction as PM V2 audit.
2. [x] Material state reads routing events and restores latest Catalog route after Refresh.
3. [x] Full-stock success closes/clears intake and shows persistent **جاهز للصرف من مخزن الفريق** card.
4. [x] Same Catalog Item is blocked from duplicate need selection while ready-to-issue handoff is current.
5. [x] **إعادة التحقق من الرصيد** reruns the server availability boundary; no stock mutation is introduced.

**Manual runtime acceptance — one check only:** after applying Patch 100, reopen the existing `waiting_material` Item. Because the Patch 099 full-stock click predates the new routing event, press **إضافة مادة أخرى**, select the stocked PRIMA pen, enter `2 قطعة`, and submit once. Confirm the form closes and a persistent **جاهز للصرف من مخزن الفريق** card appears. Stop and report before Refresh/recheck.


### Step 4.1 Final Acceptance — CLOSED / PASS — Patch 101 (2026-09-14)

Manual PASS evidence:
- [x] zero/unavailable Team Warehouse route creates Material Request for the shortage and starts `waiting_warehouse`; live Request `1` / Item `1` for Task Item `439` persisted `1111` with received/issued `0`.
- [x] Team Warehouse balance is shown beside Catalog items with requested/available/shortage preview.
- [x] previous-date non-final technician Task remains visible without changing its original `dueDate`.
- [x] unlisted material can be captured with `catalogItemId = NULL` without technician-created Catalog Master Data.
- [x] active duplicate Catalog/free-text needs are blocked; successful request submit collapses/clears intake and requires explicit **إضافة مادة أخرى**.
- [x] count units reject fractional quantity (`2.5 قطعة`), with UI and server using the same policy.
- [x] full Team Warehouse availability (`requested 2 / available 5 / shortage 0`) creates no PM V2 Material Request and performs no Stock mutation; live DB confirmed Team Warehouse quantity remained `5` and request count for Catalog `1140273` remained `0`.
- [x] full-stock route is persisted as `material_route_decision`; Action `30001` restores **جاهز للصرف من مخزن الفريق** after Refresh.
- [x] recheck with unchanged stock remains `team_inventory` and does not create a request.

Manual disclosure:
- [ ] **SKIPPED / ACCEPTED by explicit user decision:** change stock after the persisted `team_inventory` decision, then recheck to demonstrate live fallback to shortage.
- [ ] **SKIPPED / ACCEPTED by explicit user decision:** dedicated partial-shortage runtime case (for example requested `5`, available `2`, request only `3`). The shortage formula/routing boundary is covered by focused automated tests but is not recorded as manual PASS.

Automated evidence retained from Patch 100: Step 4.1 **35/35 PASS**; combined Phase 3 regression + Step 4.1 **88/88 PASS**; changed TS/TSX syntax **2/2 PASS**. Phase 2 tests intentionally not rerun.

**Step 4.1 Acceptance Result: CLOSED / PASS by explicit user decision on 2026-09-14.**

### Step 4.2 Review — READY / NOT STARTED
- [x] Existing Warehouse Transfer capability inspected: `inventory.transfers.createBatch`, `warehouseProcedure`, current QR/Lot validation, stock validation/mutation, transfer batch numbering/audit.
- [x] Frozen PM V2 contract rechecked: `waiting_warehouse`; real Warehouse Transfer owns movement; `issuedToTeamQuantity` is a projection from confirmed transfer; `issued_to_team` requires issued quantity >= requested quantity.
- [x] First runtime slice implemented: warehouse-facing `waiting_warehouse` queue — Patch 102 code-ready.
- [x] Main-Warehouse availability read via Adapter; no mutation.
- [x] Unlisted request clearly flagged for Catalog resolution; no stock guess.
- [ ] Warehouse Transfer integration/handoff — later explicit slice only.
- [ ] External purchase transition — later explicit slice only.


### Step 4.2A Runtime Slice — CODE-READY / MANUAL ACCEPTANCE PENDING — Patch 102 (2026-09-14)

Automated verification:
- Focused Step 4.2A source/contract tests = **15/15 PASS**.
- Combined Phase 3 focused regression + Step 4.1 + Step 4.2A = **103/103 PASS**.
- Changed TS/TSX syntax transpile = **14/14 PASS**.
- New Node test syntax = **PASS**.
- Full project `tsc --noEmit` could not run meaningfully in the isolated patch copy because `@types/node` / `vite/client` type definitions are absent from that dependency snapshot; no PM V2 TypeScript diagnostic was produced by that command.

Coverage:
1. [x] Main Warehouse resolved dynamically by active `warehouses.type = main`, exactly one; no ID `1` hard-code.
2. [x] Queue reads only `pmv2_material_request_items.status = waiting_warehouse`.
3. [x] Known Catalog identities use current Main-Warehouse Inventory/Lot availability in one batch.
4. [x] `catalogItemId = NULL` stays **غير موجود في الدليل**; no free-text stock guessing.
5. [x] Catalog unavailable, ambiguous Inventory identity, and unit mismatch are integrity exceptions rather than false availability.
6. [x] Warehouse server/client access is scoped to `warehouse | owner | admin` and does not grant PM V2 manager/technician surfaces.
7. [x] UI displays Request/Task/Task Item/Team/Team Warehouse/material/quantity and Main-Warehouse availability.
8. [x] No mutation endpoint/UI exists in this slice; no Transfer/PO/status/stock write.

**Manual runtime acceptance — one check only:** log in as a `warehouse` user, open **الصيانة المجدولة → طلبات مواد PM V2**, and confirm the existing `waiting_warehouse` requests appear with Main Warehouse header and each request shows its destination Team Warehouse plus an availability badge. Do not start or perform a transfer yet.

### Step 4.2A manual acceptance + Patch 103 operator-identity UX (2026-09-14)

Patch 102 manual runtime evidence — **PASS**:
- [x] warehouse-role user opened **الصيانة المجدولة → طلبات مواد PM V2**.
- [x] active Main Warehouse was shown as the source availability context.
- [x] two `waiting_warehouse` requests appeared.
- [x] known Catalog material was evaluated as insufficient against Main-Warehouse stock.
- [x] free-text/unlisted material was shown as **غير موجود في الدليل** without guessed Inventory identity.
- [x] no Transfer/PO/write action was exposed.

Patch 103 automated evidence:
- Step 4.2A suite = **18/18 PASS**.
- Combined Phase 3 + Step 4.1 + Step 4.2A = **106/106 PASS**.
- Changed TS/TSX syntax transpile = **3/3 PASS**; changed Node test syntax = PASS.

**Patch 103 visual smoke result = PASS:** the known listed request showed **كود الصنف `0032-2-1-7`** and **التصنيف** as the Catalog tree path, and no `Catalog #300042` was shown. No Warehouse Transfer was started.

### Patch 104 documentation checkpoint before Step 4.2B (2026-09-14)

Patch 103 visual smoke result = **PASS**:
- Known warehouse request displayed Catalog item code `0032-2-1-7`.
- Catalog taxonomy path displayed under **التصنيف**.
- Internal `Catalog #300042` was absent from the operator UI.
- Unlisted request remained explicitly unlisted.

No runtime test is added by Patch 104 because it is documentation-only. When Step 4.2B is implemented later, manual acceptance must separately prove at least: full transfer, partial transfer with remainder preserved, zero-availability no-transfer, unlisted no-transfer, and PM V2 quantity projection only after confirmed real Warehouse Transfer.


### Patch 105 — Step 4.2B automated gate + manual acceptance plan (2026-09-14)

Automated evidence:
- [x] Step 4.2B focused source/contract suite = **25/25 PASS**.
- [x] Combined Phase 3 + Step 4.1 + Step 4.2A + Step 4.2B = **131/131 PASS**.
- [x] Changed TS/TSX transpile syntax = **7/7 PASS**.
- [x] New Step 4.2B Node test syntax = PASS.
- [x] No SQL/schema change; no Purchase/PO/Receiving implementation.

Covered automated contracts include:
- [x] server-side recheck before handoff; outstanding quantity and current Main availability determine `transferableNow`.
- [x] existing Warehouse Transfer engine remains authoritative for stock/QR/Lot/audit.
- [x] source/destination/Catalog/unit validation of confirmed transfer rows before PM V2 projection.
- [x] unique real Transfer trace, cross-request duplicate protection, idempotent retry.
- [x] partial fulfillment stays `waiting_warehouse`; full confirmed fulfillment becomes `issued_to_team`.
- [x] stale handoff freeze after physical transfer; link retry does not repeat stock movement.

**Manual runtime acceptance — one action at a time:** first create/identify one `waiting_warehouse` **listed** material whose Main Warehouse balance is > 0, then verify the queue shows **بدء تحويل المتاح** with the expected remaining/available/transferable quantities. Do not execute the Transfer in the same first check. Subsequent manual checks must separately prove the real Transfer + PM V2 link, partial remainder behavior where applicable, and refresh/recheck before a second transfer.


### Patch 107 — quantity-context clarification + manual evidence (2026-09-14)
Manual evidence captured during the active Step 4.2B walkthrough:
- [x] Partial shortage formerly SKIPPED is now **PASS**: technician need = `6` pieces, Team Warehouse available = `5`, PM V2 created only `1` piece in `waiting_warehouse`.
- [x] Positive Main-Warehouse queue/handoff visibility check = **PASS** before physical transfer: PRIMA Main available = `89`, shortage remaining = `1`, transferableNow = `1`, and **بدء تحويل المتاح — 1 قطعة** appeared.
- [x] UX defect identified: `المطلوب الأصلي = 1` was semantically misleading because total task need was `6`.
- [x] Patch 107 source contract fixes the display via the persisted `material_route_decision` snapshot; no SQL/schema.
- [x] Step 4.2B focused suite remains **25/25 PASS**.
- [x] Combined Phase 3 + Step 4.1 + Step 4.2A + Step 4.2B remains **131/131 PASS**.
- [x] After applying Patch 107, the PRIMA card showed `6 / 5 / 1 / 1` for task need / Team-at-request / requested-from-Main / remaining-transfer.
- [x] Physical Warehouse Transfer + PM V2 link = **PASS**: Batch `TRB-2026-090001`; linked transfer row `TRF-2026-090001`; Lot `LOT-2026-00315`; quantity `1`.


### Patch 108 — Step 4.2B final runtime/DB acceptance (2026-09-16)
- [x] PM V2 quantity guard rejected `2` when `transferableNow = 1`; changing back to `1` cleared the validation.
- [x] Real Warehouse Transfer succeeded for quantity `1` from `LOT-2026-00315`.
- [x] Batch/header identity = `TRB-2026-090001`.
- [x] Per-item Warehouse Transfer identity linked by PM V2 = `TRF-2026-090001`.
- [x] Returning to PM V2 removed the fulfilled request from the `waiting_warehouse` queue.
- [x] Final DB verification for `TRF-2026-090001`: `linkedQuantity = 1`, `requestedQuantity = 1`, `issuedToTeamQuantity = 1`, `status = issued_to_team`.
- [x] **Step 4.2B = CLOSED / PASS.**

Identifier clarification: `transfers.createBatch` has a Batch/header number (`TRB-...`) and successful item rows have their own `warehouse_transfers.transferNumber` (`TRF-...`). PM V2 intentionally links the latter. The first STOP verification returned an empty set only because it searched `note.transferNumber` with the Batch `TRB` value.


### Patch 109 — Team-Warehouse Issue/Delivery integration (2026-09-16)
Automated evidence:
- [x] Patch 109 focused source/contract suite = **27/27 PASS**.
- [x] Phase 3 + Step 4.1 + Step 4.2A + Step 4.2B + Patch 109 focused regression = **158/158 PASS**.
- [x] Changed TS/TSX syntax transpile = **7/7 PASS**.
- [x] No SQL/schema change.

Covered contracts:
- [x] exact Team-Warehouse Inventory/Catalog match and server-side live availability recheck.
- [x] active Team technician is required as actual recipient for a PM V2-linked issue.
- [x] existing Inventory/Delivery owns stock, QR/Lot, transaction, cost allocation and Delivery Document.
- [x] PM V2 links only confirmed Delivery evidence into `pmv2_material_usages`; same Delivery is idempotent and cross-task reuse is rejected.
- [x] original Team stock and shortage-request supply are not conflated in usage attribution.
- [x] `consumed` requires request-attributed usage after `issued_to_team`; `ready_to_complete` requires all known material usage complete.
- [x] posted stock issue + PM V2 link failure exposes link-only recovery and does not request another physical issue.
- [x] normal non-PMV2 Inventory delivery remains optional/unmodified at the PM V2 boundary.

**Manual acceptance — one check at a time. First check only:** after applying/restarting Patch 109, open the same PRIMA item (`152-97`) in Team Warehouse `SUB-1`, press **تسليم للفني**, and confirm the new PM V2 selector lists task `PMV2-20260914-P5-T13` with **required 6 / used 0 / issuable now 6**. Do **not** confirm the delivery in this first check.

Phase 5 follow-up/resume from `ready_to_complete` is outside this Patch and must not be marked PASS by the Phase 4 material test.

## Patch 110 — Team-Warehouse issue / consumption / return verification

Automated contract coverage now verifies:
- PM V2 warehouse queue is the issue entry point; generic Inventory no longer asks the operator to match a PM V2 task.
- remaining task need and automatic Lot allocation are server-derived;
- requester default recipient + alternate active same-Team recipient;
- one logical requirement may post multiple existing Delivery Documents by Lot;
- physical issue trace is separate from actual consumption;
- all requirements issued → `ready_to_complete`;
- technician records only actual used quantity; remainder becomes pending return without stock mutation;
- single-Lot automatic return identity and multi-Lot restricted allocation;
- real recipient-return workflow is reused before stock comes back;
- final `pmv2_material_usages` represent net actual consumption;
- physical Delivery link failure is recoverable by re-link only and blocks duplicate issue;
- fractional pending return is rejected while the live return-document quantity remains integer-only;
- PM V2 orchestration contains no direct Inventory/Lot balance update and adds no migration.

Result: focused Phase 3 + Phase 4 regression **155/155 PASS**. A broad run of `server/tests/pmv2-*.node.mjs` has the same 18 legacy/baseline failures when run on the Patch 109 baseline, so they are not classified as Patch 110 regressions.

Manual acceptance must proceed one check at a time. First check after applying Patch 110: verify the PRIMA requirement appears under **مواد PM V2 الجاهزة للصرف للمهمة** with task need `6`, issued `0`, issue-now `6`, requester preselected, and automatic Lot allocation. Do not post the issue until that screen is reviewed.


## Patch 111 — Completed Task / open Visit closure visibility regression

Runtime defect reproduced during the Patch 110 real PRIMA acceptance on 2026-09-19:
- [x] Prior task `PMV2-20260914-P5-T13` completed all Task Items.
- [x] Task status became `completed` as designed.
- [x] The Visit remained open because Visit closure is an explicit Leader action.
- [x] The prior completed Task disappeared from the technician feed before the Leader could press **إنهاء الزيارة**.

Patch 111 automated checks:
- [x] completed carry-over Task is retained when an open Visit exists;
- [x] cancelled Tasks remain excluded and the original due date is not mutated;
- [x] `endVisit` remains a Visit-only mutation and does not rewrite Task/Item status;
- [x] the Leader keeps one simple **إنهاء الزيارة** action;
- [x] completed/open Visit cue is explicit for Leader and non-Leader;
- [x] focused regression command covering Patch 111 + Step 3.1 + Step 3.4 + Step 4.1 = **53/53 PASS**;
- [x] changed TypeScript/TSX syntax transpile = **2/2 PASS**;
- [x] broad PM V2 source-contract comparison = untouched project **251/269 PASS, 18 fail** vs Patch 111 **254/272 PASS, 18 fail**; the same 18 baseline failures remain and Patch 111 introduces no new failure signature.

No SQL is required. `npm run build` was attempted in the attached source snapshot and stopped at `vite: not found` because it contains no `node_modules`; production build must be rerun in the real project after applying the patch.

**Manual retest — one check at a time. First check only:** after applying Patch 111 and restarting the real project, log in as the same technician and open **مهامي اليوم**. Verify that prior Task `PMV2-20260914-P5-T13` is visible again despite status `completed`, with the open-Visit cue and **إنهاء الزيارة** available to the Visit Leader. Do not press it until the screen is reviewed.


## Patch 112 — Technician material searchable-combobox UX verification

Runtime usability issue observed during the real Multi-Lot setup: the technician typed `PRIMA` into the material search box, but results remained hidden behind a separate selector. Patch 112 collapses those two controls into one searchable combobox.

Automated checks:
- [x] one `role="combobox"` control owns material search/selection;
- [x] `CommandInput` drives the existing server `materialCatalog` search and results render in the same popover;
- [x] result rows expose item code + Team-Warehouse balance/unit;
- [x] active/ready duplicate items remain disabled;
- [x] selection still sets Catalog item + preferred unit and preserves the existing availability/shortage workflow;
- [x] unlisted-material fallback remains available and explicit;
- [x] Patch 112 + Phase 4 Step 4.1 focused run = **39/39 PASS**;
- [x] broad `pmv2-*.node.mjs` run = **258/276 PASS, 18 fail**, exactly the same baseline failure count as Patch 111 plus four new passing Patch 112 tests;
- [x] changed TSX syntax transpile = **1/1 PASS**; changed Node test syntax = PASS.

Patch 111 manual retest is now **PASS**: the completed/open-Visit task remained visible, Leader ended the Visit successfully, and the task disappeared afterward. Real-project production build after Patch 111 also **PASS**.

**Patch 112 manual check — PASS:** on 2026-09-19 the technician opened **تحتاج مواد**, typed `PRIMA`, and matching Catalog results appeared directly in the same control with code/balance. Real-project production build after Patch 112 also **PASS** (`vite` 44.06s; server bundle completed).


## Patch 113 — Technician material submit-label verification

Reason: runtime UX review found the label **تحقق من التوفر وسجّل الاحتياج** unnecessarily verbose because availability is already shown in the preview. The action still performs the same server-side recheck; only the technician-facing label is simplified.

Automated checks:
- [x] catalog-material submit label is **تسجيل الاحتياج**;
- [x] pending label remains **جارٍ تسجيل الاحتياج...**;
- [x] old verbose label is absent;
- [x] Patch 112 combobox behavior remains intact;
- [x] Step 4.1 material-routing contract remains intact;
- [x] focused run = **40/40 PASS**;
- [x] broad `pmv2-*.node.mjs` = **259/277 PASS, 18 fail**, same baseline failure count;
- [x] changed TSX syntax transpile = **1/1 PASS**.

**Manual check — one check only:** after apply/build, open the active technician material form and verify the action button reads **تسجيل الاحتياج**. Do not submit the test need until the label is reviewed.

## Patch 114 — Technician Team-Warehouse self-service receipt

Automated acceptance:

- [x] Route-decision Action ID is returned for exact immediate issue linkage.
- [x] Self-service persists the PM V2 need before invoking Inventory/Delivery.
- [x] Logged-in technician is the actual recipient and must be an active technician on the same Team.
- [x] Full stock shows **استلام المواد من مخزن الفريق** plus explicit confirmation.
- [x] Shortage shows **تسجيل الاحتياج وطلب النقص** and does not issue the available quantity partially by default.
- [x] Replenished shortage becomes visible on the technician task as **جاهز للاستلام من مخزن الفريق**.
- [x] Lot allocation stays automatic, including Multi-Lot.
- [x] Existing physical-issue/link retry safety remains in use.
- [x] Focused regression = **74/74 PASS**.
- [x] Broad PM V2 Node suite = **266/284 PASS** with the same **18 baseline failures**.
- [x] Changed TS/TSX syntax transpile = **5/5 PASS**.

Manual runtime acceptance after applying/building Patch 114:

1. Use one fresh listed-material need with full Team-Warehouse stock and prove the technician sees **استلام المواد من مخزن الفريق**, confirms once, and the real stock/Delivery decreases without a warehouse-user issue click.
2. Separately use a partial-stock need and prove **no partial issue** occurs; only the shortage request is created. After the shortage reaches Team Warehouse, prove the technician can receive the full remaining need.
3. Continue to verify actual consumption and Pending Return exactly as Patch 110; receipt must not become automatic consumption.

## Patch 115 — Warehouse shortage / Purchase handoff verification

Automated acceptance:
- [x] Waiting card retains full task need and Team-Warehouse snapshot but action quantity is shortage only.
- [x] Shortage-routed full requirement is suppressed from ready issue/receipt while request status is still `waiting_warehouse`.
- [x] New transfer handoff rejects default partial Main→Team transfer when Main does not cover the full remaining shortage.
- [x] Existing Warehouse Transfer PM V2 context requires total Lot/cart quantity to equal the whole shortage before posting.
- [x] Existing Purchase page receives Catalog identity + minimum uncovered quantity; overbuy is allowed.
- [x] PM V2 never creates/mutates Purchase rows; it links the authoritative PO Item only.
- [x] Linked quantity is capped to the actual PM V2 uncovered shortage.
- [x] Pending linked purchase coverage is reconciled against confirmed Warehouse Receipt quantity before combining it with live Main Inventory.
- [x] Focused regression **120/120 PASS**.
- [x] Broad PM V2 suite **277/295 PASS, 18 fail** — same 18 baseline failures, no new failure signature.
- [x] Changed TS/TSX syntax transpile **10/10 PASS**.

**First manual check after apply/build — one check only:** open **طلبات مواد PM V2** for `PMV2-20260919-P6-T14` and review the Duracell card. Do not click transfer or purchase yet. It must explain task need `7`, Team stock-at-request `5`, shortage `2`, and must not show a ready-to-issue full-`7` action while the shortage is still waiting.

## Patch 116 — Purchase unit prefill verification

Runtime trigger: the Patch 115 PM V2 → Purchase handoff opened the correct item/quantity but the Purchase Unit control was blank and disabled.

Automated acceptance:
- [x] handoff resolves an active Catalog Unit from existing Master Data and returns its stable ID;
- [x] warehouse handoff sends `pmv2UnitId` and canonical unit text to the existing Purchase form;
- [x] Purchase resolves by Unit ID first and writes the canonical active Arabic unit name into the PM V2-bound item;
- [x] the Unit control is locked only after successful Master Data resolution;
- [x] unresolved unit remains manually selectable and save/submit is blocked until a unit is chosen;
- [x] Arabic/English aliases of the same Catalog Unit ID are accepted as equivalent when linking the PO item back to PM V2;
- [x] focused Phase 4/Patch 114–116 regression = **90/90 PASS**;
- [x] broad `pmv2-*.node.mjs` = **282/300 PASS, 18 fail**, same baseline failures;
- [x] changed TS/TSX syntax transpile = **3/3 PASS**.

**Manual check — PASS (2026-09-19):** the PM V2 Duracell Purchase handoff displayed the Unit automatically as `PIECE / قطعة`; real-project `npm run build` also PASS.

## Patch 117 — PM V2-linked Purchase single-item/reference verification

Runtime trigger: after Patch 116, Unit prefill was correct (`PIECE / قطعة`), but the PM V2-linked Purchase screen still exposed the generic **إضافة** action.

Automated acceptance:
- [x] warehouse handoff forwards total task need + Team-Warehouse stock-at-request context for display only;
- [x] Purchase shows a visible **مرتبط بمهمة صيانة مجدولة PM V2** reference block with task, reason, item, task need, Team stock snapshot, exact purchase quantity, and PM V2 request/item references;
- [x] linked Purchase is constrained to one Catalog item only;
- [x] linked quantity is exact and disabled, not a minimum/overbuy field;
- [x] resolved Catalog Unit stays locked under Patch 116 rules; unresolved unit fallback remains explicit;
- [x] **إضافة صنف** is hidden only for PM V2 linked mode; normal Purchase creation keeps the existing multi-item action;
- [x] save/submit payload defensively emits only the single PM V2-bound item;
- [x] focused Patch 114–117 regression = **29/29 PASS**;
- [x] broad `pmv2-*.node.mjs` = **288/306 PASS, 18 fail**, same baseline failures;
- [x] changed TSX syntax transpile = **2/2 PASS**.

**First manual check after apply/build — one check only:** reopen the Duracell PM V2 Purchase handoff for `PMV2-20260919-P6-T14` and confirm the reference block is visible and the **إضافة** action is absent. Do not submit the Purchase request yet.


## Patch 118 — PM V2 Purchase Unit Master-Data precedence verification

Runtime trigger: after Patch 117, the linked Purchase correctly remained single-item and showed its PM V2 reference, but the Unit field was blank with the unresolved-unit warning.

Automated acceptance:
- [x] Purchase handoff resolves active unit from the current Catalog Item Master Data before falling back to Inventory/snapshot text;
- [x] the resolved stable Unit ID continues to flow into the existing Purchase form;
- [x] authoritative PO-item linking validates against the same resolved Catalog Item unit instead of rejecting canonical unit text because of an older PM V2 snapshot label;
- [x] Patch 117 linked single-item restrictions remain intact;
- [x] focused Patch 114–118 regression = **75/75 PASS**;
- [x] broad `pmv2-*.node.mjs` = **291/309 PASS, 18 fail**, same baseline failures;
- [x] changed TypeScript syntax transpile = **1/1 PASS**.

**First manual check after apply/build — one check only:** reopen the same Duracell PM V2 Purchase handoff for `PMV2-20260919-P6-T14` and confirm the Unit is auto-filled from Master Data (expected `PIECE / قطعة`) with no unresolved-unit warning. Do not submit yet.

## Patch 119 — manual Purchase unit + existing-order relink verification

Runtime trigger:
- PM V2 Purchase reference/single-item mode = PASS;
- Catalog Item had no authoritative Catalog Unit linkage, so buyer selected `PIECE / قطعة` manually = expected fallback;
- **إرسال** created the Purchase Order, then PM V2 link failed because the selected Purchase unit was compared to the older PM V2 snapshot text (`حبة`).

Automated acceptance:
- [x] only Catalog Item → active Catalog Unit can lock/prefill the Purchase unit;
- [x] free-text PM V2/Inventory unit labels cannot create an implicit Master Data unit relationship;
- [x] when Catalog unit linkage is absent, a manually selected active Purchase unit is accepted for the PO Item;
- [x] when Catalog unit linkage exists, a genuinely different active Purchase unit is rejected;
- [x] Purchase Detail detects the stable PM V2 request/item reference already stored in the existing order notes;
- [x] **ربط / إعادة ربط PM V2** calls the existing idempotent link endpoint with the existing Purchase Order/Item IDs only;
- [x] no Purchase create/save mutation is part of the relink action.

Verification: focused Patch 115–119/warehouse regression **72/72 PASS**; broad PM V2 **295/313 PASS, same 18 baseline failures**; syntax **3/3 PASS**.

**First manual check after apply/build — one check only:** open the Purchase Order that was already created by the failed-link attempt and confirm the PM V2 reference card exposes **ربط / إعادة ربط PM V2**. Do not create or submit another Purchase Order.


## 2026-09-22 — WIS multi-issue runtime acceptance gate — PASS

Manual acceptance evidence:

- WIS screen/Sidebar label = **الصرف المخزني المتعدد**.
- One-line WIS cannot be submitted; submit becomes available after a second line is added.
- Same Lot + different Site/Section/Asset target is accepted.
- Real multi-issue submission succeeded as `WIS-2026-000004`.
- Same Lot + identical Site/Section/Asset target is rejected.
- Sum of repeated same-Lot quantities above available balance is rejected.
- `WIS-2026-000004` final print test completed successfully with no issue reported.
- Existing single-issue screens were intentionally left unchanged.

**Gate result: WIS multi-issue = CLOSED / PASS.** Phase 4 overall remains open for Unlisted/non-Catalog material resolution.

## Patch 134 — technician material attention verification

Automated acceptance:
- [x] persistent **مواد تحتاج انتباهك** surface exists above task cards;
- [x] attention query refreshes every 60 seconds;
- [x] identity-resolution context and material quantities are preserved;
- [x] ready material exposes open-task and confirmed technician receipt actions;
- [x] technician router exposes `materialAttention` through PM V2 technician authorization;
- [x] old unlisted route is treated as history after identity resolution;
- [x] only the requesting technician's material needs are returned and completed attention disappears.

Verification: `server/tests/pmv2-patch134-technician-material-attention.node.mjs` = **6/6 PASS**.

A later baseline comparison before Patch 135 confirmed the Patch 134 files in `eggt5.zip` were byte-for-byte identical to the original Patch 134 package. Broad PM V2 baseline at that point = **315/334 PASS, 19 fail**.

## Patch 135 — material shortage integrity verification

Automated acceptance:
- [x] full Team-Warehouse coverage remains outside warehouse-request flow;
- [x] partial Team-Warehouse coverage creates only `required - available` as the shortage;
- [x] unlisted identity resolution rechecks live Team-Warehouse stock and reroutes the same request;
- [x] server duplicate protection still blocks one active material/task-item request;
- [x] technician duplicate UX also blocks `identityResolution.resolvedCatalogItemId`;
- [x] remaining shortage is derived from initial shortage minus confirmed quantity issued to Team Warehouse;
- [x] attention UI distinguishes initial shortage, remaining shortage, Main received, and Team transferred quantities.

Verification:
- Patch 135 file = **7/7 PASS**;
- focused regression Patches 114/115/131/134/135 = **39/39 PASS**;
- broad PM V2 after Patch 135 = **322/341 PASS, 19 fail**;
- baseline before Patch 135 = **315/334 PASS, 19 fail**;
- the same 19 baseline failures remained; **no new broad-suite failure** was introduced.

Build/check status: **NOT VERIFIED in this execution environment** because `node_modules` was absent and `npm ci` did not complete within the environment timeout. Do not record this gate as PASS until the normal real-project build is run.

## Patch 136 — Warehouse queue organization (2026-09-24)

Automated acceptance:
- [x] waiting/action-required section renders before ready issue;
- [x] ready issue renders before pending returns;
- [x] existing PM V2 stock-ownership notice remains present after the operational sections;
- [x] original warehouse identity and `waiting_warehouse` information remain present in the top summary;
- [x] all six existing waiting-request quantity/destination fields remain present;
- [x] Catalog identity, maintenance detail, linked Purchase context, and identity/transfer/purchase actions remain present;
- [x] ready issue retains recipient, Lot, relink, and issue controls;
- [x] returns retain quantities, Lot allocation, and confirmation;
- [x] existing operational tRPC handoffs/mutations remain wired.

Verification results:
- Patches 134 + 135 + 136: **20/20 PASS**;
- `Pmv2WarehouseQueue.tsx` TypeScript 5.8.3 syntax transpile: **PASS**;
- production build: **NOT VERIFIED** in this source snapshot because `node_modules` is absent.

## Patch 137 — Warehouse tabs + progressive details — 2026-09-24

Added:
- `server/tests/pmv2-patch137-warehouse-tabs-progressive-details.node.mjs`

Regression coverage locks:
- exactly three operational tabs: **تحتاج معالجة / جاهزة للصرف / المرتجعات**;
- **تحتاج معالجة** as default state;
- conditional rendering of one operational section at a time;
- collapsed card details for waiting / ready / return cards;
- preservation of all important Patch 136 quantity, inventory, request, Purchase, Transfer, issue/relink, recipient, Lot, return, summary, and architecture-notice content;
- preservation of the existing server handoff hooks.

Focused command covering Patches 134/135/136/137: **27/27 PASS**.

Final verification:
- Patch 137 TSX syntax transpile using TypeScript 5.8.3: **PASS**.
- Patch 136 broad baseline: **329/348 PASS, 19 fail**.
- Patch 137 broad suite: **336/355 PASS, 19 fail**.
- Failing test names are identical between the two broad runs: **0 new broad-suite failures** from Patch 137.
- Full production build: **not verified** in this source snapshot because installed project dependencies are absent.

## Patch 138 — Task continuation + responsibility timeline — 2026-09-26

### Regression جديد
`server/tests/pmv2-patch138-task-continuation-timeline.node.mjs` — **9/9 PASS**.

يغطي:
- استكمال `ready_to_complete + needs_material` فقط؛
- استمرار نفس Task وعدم إنشاء Task بديلة؛
- إعادة استخدام/إنشاء Visit لنفس Task؛
- `resume_execution`؛
- استمرار Material usage/return settlement؛
- Router `resumeItem` + `timeline`؛
- قراءة Purchase/Ticket/Material source-of-truth؛
- عدم وجود writes على Purchase/Ticket من Timeline؛
- Current responsibility + stage durations + responsible person؛
- UI **استكمال العمل** و**مسار المهمة والزمن**؛
- عدم الحاجة إلى SQL/schema.

### Focused regression
PATCH122/123 + PATCH134/135/136/137/138 + Phase 3 start/basic/dependency/end-visit + Phase 4 Team-Warehouse issue/consumption/return: **99/99 PASS**.

### Broad comparison
- `32qw76` baseline: **336/355 PASS, 19 fail**.
- Patch 138: **345/364 PASS, 19 fail**.
- أسماء الإخفاقات الـ19 متطابقة تمامًا: **0 new broad-suite failures**.

### Syntax / Build
- TypeScript `transpileModule` syntax check للملفات Runtime الأربعة المعدلة: **PASS**.
- Full production build / `tsc --noEmit`: غير موثق لأن source snapshot المرفوع لا يحتوي `node_modules`; لم يتم الادعاء بأنه PASS.

## PATCH139 verification — 2026-09-26

- `server/tests/pmv2-patch139-management-monitoring-sla-alerts.node.mjs`: **10/10 PASS**.
- Focused PATCH122/123/131/134/135/136/137/138/139: **56/56 PASS**.
- Broad PM V2 after PATCH139: **355/374 PASS, 19 fail**.
- PATCH138 baseline before PATCH139: **345/364 PASS, 19 fail**.
- Failing test-name set remained unchanged: **0 new broad-suite failure**.
- Partial TypeScript parse produced no syntax diagnostics; full build/typecheck remains unverified in the source-only environment without `node_modules`.
- Runtime/UAT still required after applying the PATCH139 DB migration, especially SLA save, notification delivery, manager filtering and owner view.

## PATCH140 verification — 2026-09-26

- `server/tests/pmv2-patch140-manager-pending-priority-ui.node.mjs`: **6/6 PASS**.
- PATCH139 + PATCH140 compatibility: **16/16 PASS**.
- Broad PM V2 after PATCH140: **361/380 PASS, 19 fail**.
- PATCH139 baseline before PATCH140: **355/374 PASS, 19 fail**.
- Failing test-name set is identical: **0 new broad-suite failures**.
- Changed `ScheduledMaintenance.tsx` TypeScript/TSX syntax via `transpileModule`: **PASS**.
- Full production build/typecheck remains unverified because the source snapshot has no installed `node_modules`.

## PATCH141 — Daily Scheduled Maintenance Reports — 2026-09-26

Automated checks:
- dedicated reports route/navigation and management-only API surface;
- daily assignment vs completed / worked pending / not started / carry-over derivation;
- technician notes are sourced from `pmv2_item_actions.note` and rendered per task;
- open-task responsibility is read from PATCH138 Timeline;
- technician filtering does not invent individual PM V2 task assignment;
- open Visits remain visible in the management daily report;
- external Purchase/Ticket/Inventory state remains read-only.

Results:
- `pmv2-patch141-daily-maintenance-reports.node.mjs`: **7/7 PASS**.
- PATCH138 + 139 + 140 + 141: **32/32 PASS**.
- Broad PM V2: **368/387 PASS, 19 fail** vs PATCH140 **361/380 PASS, 19 fail**, identical failures and **0 new failures**.
- TS/TSX transpile syntax for changed runtime files: **PASS**.

## PATCH142 automated verification
- Added `server/tests/pmv2-patch142-report-review-admin-indicators.node.mjs`.
- Verifies PM V2-only review persistence, management guards, review UI, new specialty/status/wait indicators, 30-day completion indicators, and no external workflow writes.
- Manual/runtime UAT remains intentionally deferred.

PATCH142 result:
- PATCH138–142 focused: **39/39 PASS**.
- broad PM V2 after PATCH142: **375/394 PASS, 19 fail**.
- PATCH141 baseline: **368/387 PASS, 19 fail**; PATCH142 adds 7 passing tests and **0 new broad-suite failures**.
- changed TS/TSX syntax transpile: **PASS**.
- full Production Build remains unverified in this dependency-free source snapshot.
- user-requested runtime/UAT remains deferred.

## PATCH143 automated verification
- Dedicated smart-picker contract: **5/5 PASS**.
- Step 4.1 + PATCH143 compatibility: **40/40 PASS**.
- Focused material/PATCH131–143 regression: **114/114 PASS**.
- Broad PM V2: **380/399 PASS, 19 fail** vs PATCH142 baseline recheck **375/394 PASS, 19 fail**; identical failing names, therefore **0 new failures**.
- Changed TS/TSX syntax: **PASS** via TypeScript `transpileModule`.
- Runtime/UAT intentionally deferred by user decision to the comprehensive PM V2 end-to-end acceptance run.
