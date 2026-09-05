# تصميم قاعدة البيانات — PM V2

> الحالة: **تصميم مبدئي محدث — غير منفذ — لا يعتبر ERD نهائيًا قبل إغلاق Phase 0**.

## 1. قاعدة أساسية

جداول PM V2 الجديدة تحمل بادئة:

`pmv2_`

لكن هذا لا يعني إنشاء نسخة من كل كيان تستخدمه الوحدة.

**القاعدة: نخزن فقط البيانات التي تملكها PM V2، ونحتفظ بمراجع إلى Master Data الحالية.**

## 2. Master Data لا تعاد داخل PM V2

لا ينشأ حاليًا بديل لـ:

- `sites`
- `sections`
- `assets`
- `users`
- `warehouses`
- `catalog_items`
- `inventory`
- `inventory_lots`
- `inventory_transactions`
- `tickets`
- `purchase_orders`

وبالتالي التصميم السابق لـ:

- `pmv2_location_groups`
- `pmv2_locations`

**ملغى كتصميم افتراضي** ولا يعاد إدخاله إلا إذا أثبت Phase 0 حاجة لا تغطيها الكيانات الحالية.

## 3. جداول التنظيم الخاصة بـPM V2

### `pmv2_specialties`

يمثل التخصص التنظيمي للصيانة.

حقول مبدئية:

- id
- code
- name
- nameEn nullable
- nameUr nullable
- managerUserId nullable → `users.id`
- sourceDepartmentName nullable — Soft Reference إلى القسم الحالي إذا أكد Reality Check أن المصدر هو `users.department`
- isActive
- createdById
- createdAt
- updatedAt

ملاحظة:

القسم الحالي لا يكرر هنا. الفحص الحالي لا يظهر Department Master عام؛ إذا أكد Reality Check أن `users.department` هو المصدر، يستخدم `sourceDepartmentName` كSoft Reference بعد validation عبر Organization Adapter، وليس كMaster Data جديد.

### `pmv2_teams`

- id
- specialtyId
- code
- name
- warehouseId → `warehouses.id`
- deviceUserId nullable → `users.id`
- isActive
- createdById
- createdAt
- updatedAt

قواعد:

- `warehouseId` يجب أن يشير إلى مخزن صالح حسب قواعد النظام الحالية.
- PM V2 لا تنشئ Warehouse.

### `pmv2_team_members`

- id
- teamId
- userId → `users.id`
- isActive
- joinedAt nullable
- leftAt nullable
- createdAt
- updatedAt

Unique مبدئي:

`teamId + userId` حسب سياسة التاريخ النهائي.

## 4. Checklists

### `pmv2_checklists`

- id
- name
- description nullable
- defaultSpecialtyId nullable
- isActive
- createdById
- createdAt
- updatedAt

ربط Checklist بالفريق ليس إلزاميًا على مستوى القالب إذا قرر Phase 0 أن القالب reusable بين فرق التخصص نفسه؛ يثبت القرار النهائي قبل التنفيذ.

### `pmv2_checklist_items`

- id
- checklistId
- title
- sortOrder
- isRequired
- frequency
- frequencyValue nullable
- weekday nullable
- monthDay nullable
- anchorDate nullable
- isActive
- createdAt
- updatedAt

التكرارات المبدئية:

`daily | weekly | monthly | quarterly | biannual | annual`

## 5. Programs

### `pmv2_programs`

- id
- name
- teamId
- checklistId
- startDate
- isActive
- createdById
- createdAt
- updatedAt

### `pmv2_program_targets`

الهدف: ربط البرنامج بـMaster Data الحالية دون نسخها.

التصميم المفضل مبدئيًا للحفاظ على FK integrity:

- id
- programId
- siteId nullable → `sites.id`
- sectionId nullable → `sections.id`
- assetId nullable → `assets.id`
- isActive
- createdAt
- updatedAt

قاعدة مطلوبة:

**Exactly one of `siteId / sectionId / assetId` must be non-null.**

شكل الـCHECK/FK النهائي يعتمد على ما يدعمه Schema الحالي وطريقة المشروع في فرض القيود.

بديل polymorphic `targetType + targetId` لا يعتمد إلا إذا كان أفضل تقنيًا بعد Phase 0، لأنه يضعف FK المباشر.

## 6. Tasks

### `pmv2_tasks`

- id
- taskNumber
- programId
- teamId
- dueDate
- status
- firstStartedAt nullable
- completedAt nullable
- createdAt
- updatedAt

يجب أن تحتفظ المهمة بمرجع Target واضح، إما:

- عبر `programTargetId`

أو Snapshot reference معتمد في ERD النهائي.

الحالات لا تثبت نهائيًا قبل State Machine Freeze، والمبدئي:

`open | in_progress | pending_followup | ready_followup | completed | cancelled`

### `pmv2_task_items`

Snapshot للبنود المستحقة.

- id
- taskId
- sourceChecklistItemId
- titleSnapshot
- scheduledDate
- sortOrder
- status
- result nullable
- resolvedAt nullable
- createdAt
- updatedAt

التصميم المرشح بعد Existing Capability Audit يفصل Lifecycle عن النتيجة:

Lifecycle Status:

`pending | in_progress | waiting_material | ready_followup | resolved`

Result:

`ok | fixed | needs_maintenance`

هذا يمنع خلط نتيجة الفحص مع حالة متابعة البند. النهائي يغلق ضمن Phase 0.

## 7. Visits

### `pmv2_visits`

- id
- taskId
- visitType
- executingTeamId
- startedById
- startedAt
- endedAt nullable
- status
- leaderUserId nullable
- summaryNote nullable
- createdAt
- updatedAt

`visitType` مبدئي:

`inspection | followup_repair`

### `pmv2_visit_members`

- id
- visitId
- userId
- memberTeamId nullable
- role
- createdAt

`role` مبدئي:

`leader | member | external_member`

### `pmv2_item_actions`

Audit تشغيلي لكل إجراء على بند.

- id
- taskItemId
- visitId
- action
- performedById
- note nullable
- photoReference nullable
- createdAt

طريقة تخزين الصور/المرفقات تثبت بعد قرار File/Image Adapter؛ لا نفترض تعديل Attachments العامة الآن.

## 8. المواد

### `pmv2_material_requests`

- id
- taskId
- taskItemId
- requestedById
- teamId
- teamWarehouseId
- status
- bridgeTicketId nullable
- bridgeTicketItemId nullable
- purchaseOrderId nullable
- createdAt
- updatedAt

الحالات النهائية تتبع State Machine Phase 0.

مبدئيًا:

`waiting_warehouse | external_purchase | received_warehouse | issued_to_team | cancelled`

### `pmv2_material_request_items`

- id
- requestId
- catalogItemId nullable → `catalog_items.id`
- itemNameSnapshot
- requestedQuantity
- unitSnapshot nullable
- status
- purchaseOrderItemId nullable → `purchase_order_items.id` عند الشراء الخارجي
- receivedInventoryLotId nullable → `inventory_lots.id` عند الحاجة للتتبع
- createdAt
- updatedAt

لا نستخدم `inventoryId` كهوية الصنف الأساسية إذا كان Catalog Item هو Master identity.

مرجع `purchaseOrderItemId` مهم لأن Path B والتسليم النهائي يعملان على مستوى مادة طلب الشراء، وليس رأس PO فقط.

الحالات التشغيلية المرشحة للبند:

`waiting_warehouse | external_purchase | received_warehouse | issued_to_team | consumed | cancelled`

### `pmv2_material_usages`

- id
- taskId
- taskItemId
- visitId
- warehouseId
- catalogItemId nullable
- inventoryId nullable
- quantity
- inventoryTransactionId nullable
- inventoryLotId nullable
- deliveryReference nullable
- purchaseOrderItemId nullable
- usedById
- createdAt

PM V2 لا تخصم الرصيد. `inventoryTransactionId`/Delivery/Lot هي مراجع للحركة التي أنشأها النظام الحالي عبر `issueDelivery`.

### `pmv2_request_reminders`

- id
- materialRequestId
- sentById
- sentAt

## 9. External References

قبل تثبيت أي FK يجب التحقق يدويًا من:

- نوع `users.id`.
- نوع `sites.id`.
- نوع `sections.id`.
- نوع `assets.id`.
- نوع `warehouses.id`.
- نوع `catalog_items.id`.
- نوع Inventory Transaction ID.
- Ticket/Item IDs المستخدمة في Bridge.
- Purchase Order ID.

## 10. ملاحظة Schema Drift حالية

يوجد Migration في المشروع لإضافة:

- `users.specialty`
- `users.specialtyEn`
- `users.specialtyUr`

بينما تعريف `users` في `drizzle/schema.ts` في النسخة المفحوصة لا يتضمن هذه الحقول.

لذلك قبل أي اعتماد على هذه الأعمدة يجب مقارنة:

**قاعدة البيانات الفعلية ↔ migrations ↔ schema.ts**

ولا يتم تصحيح ذلك تلقائيًا ضمن PM V2 دون أمر ومعالجة موثقة.

## 11. بروتوكول DB

أي تعديل DB مستقبلي:

1. SQL يدوي واحد للمستخدم.
2. المستخدم ينفذ ويرسل النتيجة.
3. تتم المراجعة.
4. ثم SQL التالي.
5. عند النهاية يحدث Schema ويسلم ضمن Patch.

لا Migration فعلية ولا أوامر DB قبل قول المستخدم **نفذ الآن** للمرحلة المعنية.
