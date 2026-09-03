# تصميم قاعدة البيانات — PM V2

> الحالة: **تصميم مقترح — غير منفذ بعد**

جميع الجداول الجديدة تستخدم بادئة:

`pmv2_`

## جداول الإعداد

### pmv2_location_groups
مجموعات المواقع.

حقول أساسية:
- id
- name
- code
- sortOrder
- isActive
- createdById
- createdAt
- updatedAt

### pmv2_locations
المواقع الفعلية.

- id
- groupId
- name
- code
- sortOrder
- isActive
- existingSiteId nullable
- existingAssetId nullable
- createdById
- timestamps

### pmv2_teams
فرق الصيانة.

- id
- name
- code
- warehouseId → مخزن فرعي حالي
- tabletUserId nullable → مستخدم حالي
- isActive
- timestamps

### pmv2_team_members

- id
- teamId
- userId → users.id
- isActive
- timestamps

Unique:
`teamId + userId`

---

## جداول Checklist

### pmv2_checklists

- id
- teamId
- name
- description nullable
- isActive
- createdById
- timestamps

### pmv2_checklist_items

- id
- checklistId
- title
- sortOrder
- isRequired
- frequency
- frequencyValue
- weekday nullable
- monthDay nullable
- anchorDate nullable
- isActive
- timestamps

التكرارات المبدئية:

`daily | weekly | monthly | quarterly | biannual | annual`

---

## البرامج

### pmv2_programs

- id
- name
- teamId
- checklistId
- startDate
- isActive
- createdById
- timestamps

### pmv2_program_locations

- id
- programId
- locationId
- isActive
- timestamps

Unique:
`programId + locationId`

---

## التنفيذ

### pmv2_tasks

- id
- taskNumber
- programId
- locationId
- teamId
- dueDate
- status
- firstStartedAt nullable
- completedAt nullable
- timestamps

الحالات المقترحة:

`open | in_progress | pending_followup | ready_followup | completed | cancelled`

### pmv2_task_items

Snapshot للبنود المستحقة.

- id
- taskId
- sourceChecklistItemId
- titleSnapshot
- scheduledDate
- sortOrder
- status
- resolvedAt nullable
- timestamps

الحالات:

`pending | ok | fixed | waiting_material | ready_followup | resolved`

### pmv2_visits

كل زيارة فعلية.

- id
- taskId
- visitType
- teamId
- startedById
- startedAt
- endedAt nullable
- status
- leaderUserId nullable
- summaryNote nullable
- timestamps

visitType:
`inspection | followup_repair`

### pmv2_visit_members

- id
- visitId
- userId
- memberTeamId nullable
- role
- timestamps

role:
`leader | member | external_member`

### pmv2_item_actions

Audit trail.

- id
- taskItemId
- visitId
- action
- performedById
- note nullable
- photoUrl nullable
- createdAt

---

## المواد

### pmv2_material_requests

- id
- taskId
- taskItemId
- requestedById
- teamId
- teamWarehouseId
- status
- linkedBridgeTicketId nullable
- linkedPurchaseOrderId nullable
- timestamps

status:
`waiting_warehouse | external_purchase | received_warehouse | issued_to_team | cancelled`

### pmv2_material_request_items

- id
- requestId
- catalogItemId nullable
- inventoryId nullable
- itemNameSnapshot
- requestedQuantity
- unitSnapshot nullable
- status
- timestamps

### pmv2_material_usages

- id
- taskId
- taskItemId
- visitId
- warehouseId
- inventoryId
- quantity
- inventoryTransactionId nullable
- usedById
- createdAt

PM V2 لا تخصم المخزون بنفسها؛ تحفظ مرجع الحركة التي ينشئها النظام الحالي. الحركة نفسها يجب أن تمر عبر آلية المخزون/المستودع الحالية بكل متطلباتها، ومنها QR/Lot Tracking عندما تكون مفعلة.

### pmv2_request_reminders

- id
- materialRequestId
- sentById
- sentAt

---

## قواعد الربط والتغيير على قاعدة البيانات

- `pmv2_material_requests` يجب أن تحفظ الربط بالمهمة الأصلية وبندها، ثم معرف بلاغ الجسر ومعرف Purchase Order عند إنشائهما، بحيث لا ينقطع تتبع الطلب بين PM V2 وPath B.
- أسماء الحقول النهائية الخاصة ببلاغ الجسر/بند البلاغ وPurchase Order تثبت بعد مطابقة PK/FK الفعلية؛ لا نفترض أسماء إضافية قبل ذلك.
- أي أوامر قاعدة بيانات مستقبلية ترسل للمستخدم يدويًا **خطوة بخطوة**؛ ينفذ المستخدم كل أمر ويرسل نتيجته قبل الانتقال للأمر التالي.
- عند أي تعديل Schema، يتم تحديث ملف الـSchema في المشروع وتسليمه للمستخدم للاستبدال.

لا يتم إنشاء Migration أو جدول فعلي إلا بعد:
1. فحص Schema الحالي.
2. التأكد من أسماء PK/FK الحقيقية.
3. التأكد من أنواع IDs.
4. التأكد من المخازن الفرعية وطريقة تمثيلها.
5. توثيق أي فرق بين هذا التصميم والواقع في `08_DECISIONS.md`.
6. إرسال أوامر قاعدة البيانات للمستخدم يدويًا وتنفيذها بالتسلسل المتفق عليه.
