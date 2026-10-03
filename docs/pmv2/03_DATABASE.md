# تصميم قاعدة البيانات — PM V2

> **الحالة:** Baseline FROZEN في Phase 0 ويُنفذ تدريجيًا في المرحلة 1. DB Steps 1–17 = PASS يدويًا بواسطة المستخدم. SQL الحالي الوحيد هو DB Step 18: `pmv2_request_reminders`، وهو آخر جدول في Schema المرحلة 1. المرجع التفصيلي: `15_FINAL_ERD_FREEZE.md`.

## 1. PM V2-owned tables

1. `pmv2_specialties`
2. `pmv2_teams`
3. `pmv2_team_members`
4. `pmv2_checklists`
5. `pmv2_checklist_items`
6. `pmv2_programs`
7. `pmv2_program_targets`
8. `pmv2_tasks`
9. `pmv2_task_items`
10. `pmv2_visits`
11. `pmv2_visit_members`
12. `pmv2_item_actions`
13. `pmv2_material_requests`
14. `pmv2_material_request_items`
15. `pmv2_material_purchase_links`
16. `pmv2_task_ticket_links`
17. `pmv2_material_usages`
18. `pmv2_request_reminders`

## 2. External Master/Workflow data — لا تكرر

`users`, `sites`, `sections`, `assets`, `warehouses`, `catalog_items`, Inventory/Lots/Transactions, Tickets, Purchase Orders/Items/Packages.

سياسة التنفيذ المؤكدة:
- لا Physical FK من PM V2 إلى هذه الجداول في baseline.
- External IDs المخزنة داخل PM V2 تفهرس حسب الحاجة.
- Adapter validation إلزامي عند الكتابة/التعديل.
- JOIN مباشر مسموح عند القراءة داخل نفس قاعدة `cmms`; FK ليس شرطًا للـJOIN.

## 3. Organization tables

### `pmv2_specialties`

- `id` PK
- `code` UNIQUE
- names/descriptions حسب UI contract
- `managerUserId` nullable external ref → `users.id`
- `isActive`
- audit timestamps/actor

**DB Step 1:** تم إنشاء الجدول يدويًا بواسطة المستخدم في `cmms` بنجاح بتاريخ 2026-09-07 (`Query OK`, 0 rows affected).

### `pmv2_teams`

- `id` PK
- `specialtyId` internal FK → `pmv2_specialties.id` مع Delete/Update Restrict
- `code` UNIQUE
- `warehouseId` external ref → `warehouses.id` + Index، بلا Physical FK
- `deviceUserId` nullable external ref → `users.id` + Index، بلا Physical FK
- `isActive`

**DB Step 2:** PASS — نفذه المستخدم يدويًا في `cmms` بتاريخ 2026-09-07 (`Query OK`, 0 rows affected).

### `pmv2_team_members`

- `teamId` internal FK → `pmv2_teams.id` مع Delete/Update Restrict
- `userId` external ref → `users.id` + Index، بلا Physical FK؛ يتحقق عبر Users Adapter عند الكتابة
- `isActive`, `joinedAt`, `leftAt` لحالة العضوية وتاريخها
- UNIQUE `(teamId,userId)`؛ إعادة العضو تعيد تفعيل نفس السجل بدل إنشاء Duplicate

**DB Step 3:** PASS — نفذه المستخدم يدويًا في `cmms` بتاريخ 2026-09-07 (`Query OK`, 0 rows affected).

## 4. Checklist / Programs

### `pmv2_checklists` / `pmv2_checklist_items`
Reusable templates. Recurrence محفوظة على Checklist Item حسب التصميم المجمد.

**DB Step 4:** PASS — نفذه المستخدم يدويًا في `cmms` بتاريخ 2026-09-07 (`Query OK`, 0 rows affected). Header يستخدم `name/description/isActive/createdById/timestamps`، و`createdById` Indexed External Reference بلا FK إلى `users`.

**DB Step 5:** نفذ المستخدم DDL بتاريخ 2026-09-08، وأعاد TiDB ستة تحذيرات `tidb_enable_check_constraint is off`. النتيجة المهنية المعتمدة: لا نفعّل هذا المتغير العام لأجل PM V2، ولا نعتبر `CHECK` طبقة حماية في baseline الحالية. ملف SQL وDrizzle يمثلان البنية المدعومة فعليًا بدون `CHECK`، بينما يتم فرض حدود `sortOrder/isRequired/isActive/frequencyValue/weekday/monthDay` عند write boundary عبر `server/pmv2/checklists/validation.ts`. CRUD/Scheduler/Recurrence behavior يبقى للمرحلة 2. حالة الجدول: **PASS** بعد `SHOW CREATE TABLE` بتاريخ 2026-09-08؛ ثبت وجود الجدول والـFK الداخلي والـIndexes المطلوبة وعدم وجود `CHECK` في البنية الفعلية.

### TiDB CHECK enforcement policy — 2026-09-08

- `tidb_enable_check_constraint` في البيئة الحالية = OFF وفق تحذير DDL الفعلي.
- لا تغيّر PM V2 إعدادًا عامًا على مستوى TiDB لتلبية احتياج محلي للوحدة.
- لا يعتمد تصميم PM V2 على `CHECK` كحاجز سلامة في هذه البيئة.
- القيود المنطقية التي كانت مكتوبة كـ`CHECK` أصبحت Service Validation إلزامية قبل أي INSERT/UPDATE لبند Checklist.
- `NOT NULL`, `ENUM`, Primary/Unique/Internal FK/Indexes تبقى طبقة DB بحسب دعم TiDB الفعلي.
- أي write path للـChecklist Items في المرحلة 2 يجب أن يستدعي `validatePmv2ChecklistItemWrite()` قبل DB write، ويثبت ذلك باختبار.

### `pmv2_programs`
- `title` optional manager-facing program title (`VARCHAR(200) NULL`); no FK and no operational-history effect
- `teamId` internal FK → `pmv2_teams.id`
- `checklistId` internal FK → `pmv2_checklists.id`
- `isActive` + audit fields
- `createdById` External Reference إلى `users.id` مع Index وبدون Physical FK

**DB Step 6:** PASS — نفذه المستخدم يدويًا في `cmms` بتاريخ 2026-09-08 (`Query OK`, 0 rows affected). Schema فقط؛ تشغيل البرامج/الأهداف/الجدولة يبقى للمرحلة 2.

### `pmv2_program_targets`
- `programId` internal FK
- `siteId | sectionId | assetId` external refs مع Indexes وبدون Physical FK
- Exactly One فقط، يفرض عند PM V2 write boundary لأن baseline الحالية لا تعتمد على TiDB `CHECK`
- Adapter validation إلزامي للهدف الخارجي قبل الكتابة
- منع Duplicate target داخل Program عبر UNIQUE منفصل لكل نوع

**DB Step 7:** PASS — نفذه المستخدم يدويًا في `cmms` بتاريخ 2026-09-08 (`Query OK`, 0 rows affected). Schema foundation فقط؛ لا Task generation أو Scheduler في هذه الخطوة.

## 5. Tasks

### `pmv2_tasks`

- `programId`
- `programTargetId`
- `teamId` snapshot assignment
- `taskNumber` UNIQUE
- `dueDate`
- `status` cached projection من Task Items
- UNIQUE `(programId, programTargetId, dueDate)` للScheduler idempotency

Task states:

`pending | in_progress | waiting_material | waiting_ticket | ready_to_complete | completed | cancelled`

**DB Step 8:** PASS — أنشأ المستخدم `pmv2_tasks` يدويًا في `cmms` بتاريخ 2026-09-08 (`Query OK`, 0 rows affected). `programId/programTargetId/teamId` علاقات داخلية بـFK، و`taskNumber` UNIQUE، وUNIQUE `(programId, programTargetId, dueDate)` هو حاجز منع التوليد المكرر. تشغيل Scheduler وتوليد المهام يبقى للمرحلة 2.

### `pmv2_task_items`

- `taskId`
- `sourceChecklistItemId`
- snapshot title/order/scheduledDate
- `status`
- `result` = `ok | fixed | needs_material | needs_ticket`
- UNIQUE `(taskId, sourceChecklistItemId, scheduledDate)`

Task Item states:

`pending | in_progress | waiting_material | waiting_ticket | ready_to_complete | completed`

**DB Step 9:** PASS — أنشأ المستخدم `pmv2_task_items` يدويًا في `cmms` بتاريخ 2026-09-08 (`Query OK`, 0 rows affected). `taskId` و`sourceChecklistItemId` علاقات داخلية بـFK، والـsnapshot يحفظ العنوان والترتيب وتاريخ الجدولة، وUNIQUE `(taskId, sourceChecklistItemId, scheduledDate)` يمنع التوليد المكرر داخل المهمة. تنفيذ الفني والـtransitions التشغيلية تبقى للمرحلة 3.

## 6. Visits / Actions

### `pmv2_visits`
Task `1→N` Visits.

- `taskId` internal FK → `pmv2_tasks.id`.
- `startedAt` وقت بدء الزيارة.
- `endedAt` nullable وقت إنهائها؛ إنهاء Visit لا يغلق Task تلقائيًا.
- timestamps.

**DB Step 10:** PASS — أنشأ المستخدم `pmv2_visits` يدويًا في `cmms` بتاريخ 2026-09-08 (`Query OK`, 0 rows affected). Visit Header يحفظ المهمة ووقت البدء/الانتهاء فقط، ولا يغلق Task تلقائيًا.

### `pmv2_visit_members`

- `visitId` NOT NULL internal FK → `pmv2_visits.id`.
- `userId` NOT NULL indexed external ref → `users.id` بلا Physical FK.
- `isLeader` يحدد قائد الزيارة؛ قاعدة وجود/اختيار القائد تفرض في PM V2 write boundary عند تشغيل Visits في المرحلة 3.
- UNIQUE `(visitId, userId)` يمنع تكرار نفس المستخدم داخل الزيارة.
- `createdAt`.

**DB Step 11:** PASS — أنشأ المستخدم `pmv2_visit_members` يدويًا في `cmms` بتاريخ 2026-09-08 (`Query OK`, 0 rows affected).

### `pmv2_item_actions`

- `taskItemId` NOT NULL internal FK → `pmv2_task_items.id`.
- `visitId` NOT NULL internal FK → `pmv2_visits.id`.
- `action` NOT NULL كتوصيف للحدث التنفيذي؛ دلالات التشغيل التفصيلية تبقى للمرحلة 3.
- `result` nullable حسب القيم المجمدة: `ok | fixed | needs_material | needs_ticket`.
- `note` nullable.
- `performedById` indexed external ref → `users.id` بلا Physical FK.
- `createdAt`.
- الأدلة/الصور لا تنسخ داخل جدول PM V2؛ تستخدم خدمة `attachments` الحالية بربط Entity إلى Item Action.
- Audit mutations يستخدم خدمة `audit_logs` الحالية عبر PM V2 Audit wrapper.

**DB Step 12:** PASS — أنشأ المستخدم `pmv2_item_actions` يدويًا في `cmms` بتاريخ 2026-09-08 (`Query OK`, 0 rows affected). لا Technician execution/state transitions تشغيلية في هذه الخطوة.

## 7. Material Requests

### `pmv2_material_requests`

Header بلا Status مستقل:

- `taskItemId`
- `visitId`
- `requestedById`
- `teamId`
- `teamWarehouseId` snapshot external ref
- timestamps

Header status = derived summary من Items.

**DB Step 13:** PASS — أنشأ المستخدم `pmv2_material_requests` يدويًا في `cmms` بتاريخ 2026-09-08 (`Query OK`, 0 rows affected). `taskItemId`/`visitId`/`teamId` علاقات داخل PM V2، بينما `requestedById` و`teamWarehouseId` مراجع خارجية مفهرسة بلا FK إلى `users`/`warehouses`.

### `pmv2_material_request_items`

- `requestId`
- `catalogItemId` nullable external ref
- `itemNameSnapshot`
- `requestedQuantity > 0`
- `unitSnapshot`
- `status`
- `receivedWarehouseQuantity`
- `issuedToTeamQuantity`

States:

`waiting_warehouse | external_purchase | received_warehouse | issued_to_team | consumed | cancelled`

**DB Step 14:** PASS — أنشأ المستخدم `pmv2_material_request_items` يدويًا في `cmms` بتاريخ 2026-09-08 (`Query OK`, 0 rows affected). `requestId` علاقة داخل PM V2، و`catalogItemId` External Reference مفهرس بلا FK إلى `catalog_items`. بسبب بيئة TiDB الحالية لا نعتمد على `CHECK` للكمية؛ `requestedQuantity > 0` وكون كميات الاستلام/الصرف غير سالبة تفرض إلزاميًا في PM V2 write-boundary validation.

## 8. Purchase source link

### `pmv2_material_purchase_links`

- `materialRequestItemId` internal FK
- `purchaseOrderId` external ref
- `purchaseOrderItemId` external ref
- `linkedQuantity > 0`
- `createdById/createdAt`

Rules:

- Material Request Item `1→0..N` links.
- كل link يصل إلى PO Item محدد.
- `purchaseOrderItemId` UNIQUE داخل link table في baseline.
- UNIQUE `(materialRequestItemId,purchaseOrderItemId)`.
- مجموع linked quantity لا يتجاوز requested quantity دون تعديل مصرح.



**DB Step 15:** PASS — أنشأ المستخدم `pmv2_material_purchase_links` يدويًا في `cmms` بتاريخ 2026-09-08 (`Query OK`, 0 rows affected). `materialRequestItemId` علاقة داخل PM V2 بـFK، بينما `purchaseOrderId`, `purchaseOrderItemId`, `createdById` مراجع خارجية مفهرسة بلا Physical FK. لا يتم تخزين PO status ولا تنفيذ Purchase workflow من PM V2.

## 9. Ticket source link

### `pmv2_task_ticket_links`

- `taskItemId` internal FK
- `ticketId` external ref
- `createdById/createdAt`

Rules:

- Task Item `1→0..N` tickets تاريخيًا.
- `ticketId` UNIQUE داخل link table.
- لا أكثر من Ticket مفتوح فعّال لنفس Task Item في الوقت نفسه كDomain rule baseline.

**DB Step 16:** PASS — أنشأ المستخدم `pmv2_task_ticket_links` يدويًا في `cmms` بتاريخ 2026-09-08 (`Query OK`, 0 rows affected). `taskItemId` FK داخلية، بينما `ticketId` و`createdById` مراجع خارجية مفهرسة بلا Physical FK. لا Ticket status/path duplication ولا تغيير في Ticket Workflow الحالي.

## 10. Material Usage

### `pmv2_material_usages`
Trace/Audit للاستهلاك وليس Stock ledger.

يربط Task Item/Visit ومراجع Inventory/Delivery/Lot/PO Item التي تعيدها الخدمات الحالية. `materialRequestItemId` nullable عندما استخدمت مادة كانت موجودة أصلًا في مخزن الفريق.

**DB Step 17:** PASS — أنشأ المستخدم `pmv2_material_usages` يدويًا في `cmms` بتاريخ 2026-09-08 (`Query OK`, 0 rows affected). `taskItemId` و`visitId` و`materialRequestItemId` (nullable) علاقات داخل PM V2. `warehouseId`, `catalogItemId`, `inventoryTransactionId`, `inventoryLotId`, `deliveryDocumentId`, `purchaseOrderItemId`, `recordedById` مراجع خارجية مفهرسة بلا Physical FK. `usedQuantity > 0` يفرض في PM V2 write-boundary validation بسبب سياسة TiDB الحالية. الجدول Trace/Audit فقط ولا يخصم Stock ولا يملك Workflow status.

## 11. External Reference Policy

- Internal PM V2 relations: FKs/Unique/Indexes/Checks.
- Existing-system refs: IDs + indexes + Adapter validation.
- لا Physical FK خارجي يفرض Side Effect على Workflow قائم إلا إذا أعيد اعتماده صراحة لاحقًا.

## 12. DB execution protocol

المرحلة 1 — تأسيس الوحدة وربط البيانات الأساسية — تحول هذا التصميم إلى SQL، لكن:

- المساعد لا ينفذ DB writes.
- SQL يرسل خطوة واحدة في كل مرة.
- المستخدم ينفذ ويرسل النتيجة.
- أي اختلاف حي مادي يوقف تلك الخطوة ويعاد Reality Check قبل تعديل التصميم.


## 11. Request reminders

### `pmv2_request_reminders`

الـFinal ERD جمّد ملكية الجدول وعلاقته `Material Request 1→N Reminders` فقط، ولم يجمّد حقولًا تفصيلية. قبل التنفيذ تم Reality Check على المشروع الحالي وثبت وجود `notifications` وخدمة الإشعارات/الدفع الحالية؛ لذلك Baseline التنفيذية الدنيا هي Trace/Source Metadata فقط ولا تنشئ Notification workflow موازيًا.

- `requestId` internal FK → `pmv2_material_requests.id`.
- `recipientUserId` indexed External Reference → `users.id` بلا Physical FK.
- `reminderType` نص قصير مرن، وليس ENUM، حتى لا نجمد أنواع التذكير قبل Phase 5.
- `notificationId` nullable indexed External Reference → `notifications.id` بلا Physical FK؛ يستخدم فقط إذا أعادت خدمة الإشعار الحالية مرجعًا قابلًا للحفظ.
- `createdById` nullable indexed External Reference → `users.id`؛ nullable لأن التذكير الآلي قد لا يملك مستخدمًا بشريًا مباشرًا.
- `createdAt`.
- لا `status`، ولا `title/message` مكررة، ولا Scheduling state داخل هذا الجدول.
- تعدد التذكيرات تاريخيًا لنفس الطلب/المستلم مسموح؛ لا UNIQUE يمنع ذلك.

**DB Step 18:** READY — آخر جدول Schema في المرحلة 1. السلوك التشغيلي للإرسال/الجدولة/التصعيد يبقى Phase 5 ويعيد استخدام خدمة الإشعارات الحالية.

## 2026-09-09 additive extension — `pmv2_task_items` recurrence snapshot
Patch 059 adds five nullable columns to `pmv2_task_items`:
- `frequencySnapshot`
- `frequencyValueSnapshot`
- `weekdaySnapshot`
- `monthDaySnapshot`
- `anchorDateSnapshot`

They are nullable to keep all pre-patch task-item rows valid. New scheduler-generated task items populate them from the due checklist item so historical tasks remain understandable even after future checklist edits. No external FK or Legacy PM table is introduced or modified.


### Patch 078 — optional program title (2026-09-12)
- User manually executed the single approved SQL statement successfully (`Query OK`): `ALTER TABLE pmv2_programs ADD COLUMN title VARCHAR(200) NULL AFTER id`.
- The column is nullable so all existing programs remain valid and continue to fall back to `برنامج #N` until titled.
- Title changes do not alter team/checklist history, recurrence, targets, or generated tasks.

## PATCH142 — `pmv2_daily_report_reviews`
PM V2-only persistence for maintenance-manager review of a team's daily report.
- unique scope: `reportDate + teamId`;
- internal FK: `teamId -> pmv2_teams.id`;
- `reviewedById` remains an indexed logical user reference through application context;
- stores `reviewedAt` and optional review note;
- no external workflow table is altered.
Migration: `drizzle/2026_09_26_pmv2_daily_report_reviews.sql`.
