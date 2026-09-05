# Phase 0 — Design & Integration Freeze

> هذا الملف هو قائمة الإغلاق الرسمية للمرحلة 0.  
> الحالة الحالية: **مفتوحة — Step 0.1 مكتملة، وStep 0.2 DB Reality Check بدأت. أول Query على `users` أعادت `empty set` ويجري الآن تثبيت سياق قاعدة البيانات الفعلي**.

## 1. حدود الوحدة — FROZEN

PM V2 هي Bounded Module داخل نفس البرنامج.

### تملك PM V2

- Specialty / Team / Membership.
- Checklists / Recurrence.
- Programs / Target references.
- Tasks / Task Items.
- Visits / Participants.
- Item Actions.
- Material Request lifecycle and links.
- Follow-up / Closure.

### لا تملك PM V2

- Users.
- Sites / Sections / Assets.
- Warehouses.
- Catalog / Inventory / Lots / Transactions.
- Tickets / Path B / Purchase Orders.

هذه تستخدم عبر Adapters.

## 2. State Machines — التصميم المرشح للإغلاق

### 2.1 Task

`open → in_progress → waiting_followup → ready_followup → in_progress → completed`

حالات مساعدة:

- `cancelled` — بإجراء إداري مصرح وسبب موثق.

قواعد:

- `open`: مهمة مولدة ولم تبدأ زيارة تنفيذية بعد.
- `in_progress`: توجد/بدأت زيارة أو تنفيذ فعلي.
- `waiting_followup`: انتهت زيارة اليوم لكن توجد مشكلة تنتظر مادة/جهة خارجية.
- `ready_followup`: أصبح تنفيذ الإصلاح ممكنًا للفريق.
- `completed`: جميع شروط الإغلاق النهائي ناجحة.
- لا تنشأ Task جديدة عند ترحيل Follow-up لليوم التالي.

> Task status هو Lifecycle تشغيلي وليس بديلًا عن حالات البنود التفصيلية.

### 2.2 Task Item

نفصل **Lifecycle Status** عن **Inspection/Repair Result** لتجنب خلط النتيجة بالحالة.

Lifecycle Status:

`pending → in_progress → waiting_material → ready_followup → resolved`

Result/Outcome:

`ok | fixed | needs_maintenance`

قواعد:

- `ok` يؤدي إلى `resolved`.
- `fixed` يؤدي إلى `resolved` بعد نجاح أي Material Usage مطلوبة.
- `needs_maintenance` يبقي البند غير محلول، ثم ينتقل إما إلى `waiting_material` أو مسار إصلاح مباشر.
- بعد Follow-up ناجح تصبح النتيجة النهائية `fixed` والحالة `resolved` مع الاحتفاظ بتاريخ Actions السابق.

### 2.3 Visit

Visit Type:

`inspection | followup_repair`

Visit Status:

`in_progress | completed | cancelled`

قواعد:

- إنهاء Visit لا يغلق Task تلقائيًا.
- Leader/Members تحفظ لكل Visit بصورة مستقلة.
- Follow-up Visit يمكن أن تنفذ بأشخاص مختلفين.

### 2.4 Material Request Item

الحالات التشغيلية المرشحة:

`waiting_warehouse | external_purchase | received_warehouse | issued_to_team | consumed | cancelled`

المعنى:

- `waiting_warehouse`: الطلب وصل للمستودع ولم يحسم مصدر التوفير بعد.
- `external_purchase`: دخل مسار الشراء الخارجي عبر Bridge/Path B.
- `received_warehouse`: وصلت المادة المشتراة للمستودع ولكن لم تصل لمخزن الفريق بعد.
- `issued_to_team`: أصبحت المادة في مخزن الفريق/عهدته التشغيلية حسب Contract المعتمد.
- `consumed`: صرفت فعليًا في Follow-up/Repair وسجلت حركة الاستخدام.

Material Request header يمكن أن يكون Aggregate مشتقًا من Items بدل تكرار الحقيقة عند الإمكان؛ القرار النهائي في ERD.

## 3. Transition Ownership — التصميم المرشح

| Transition | من يملكه داخل PM V2 | التكامل الخارجي |
|---|---|---|
| إنشاء/تفعيل Specialty/Team/Checklist/Program | PM V2 Admin/Manager policy | Users/Targets validation عبر Adapters |
| توليد Task | Scheduler service | Target/User validation read-only |
| بدء Visit | عضو فريق مصرح أو Team Device policy | Users Adapter |
| تسجيل OK/FIXED/NEEDS_MAINTENANCE | منفذ Visit مصرح | Inventory Adapter فقط إذا استخدمت مادة |
| إنشاء Material Request | منفذ Visit مصرح | Catalog Adapter |
| حسم توفر المادة بالمستودع | مستخدم Warehouse الحالي | Warehouse/Inventory Adapter |
| بدء External Purchase | Warehouse من شاشة PM V2 | Path B Adapter يبدأ Bridge؛ PO يكمله الدور الحالي المخول |
| انتقال issued_to_team | نتيجة ناجحة لخدمة النقل الحالية | Warehouse Transfer service |
| بدء Follow-up Visit | عضو فريق مصرح | Users Adapter |
| استهلاك المادة في Follow-up | منفذ مصرح + مستلم فعلي | current `issueDelivery` |
| إغلاق Task | PM V2 Closure Service فقط | يتحقق من عدم وجود External/Pending dependencies |

> لا تمنح هذه السياسة أي دور صلاحية جديدة داخل Inventory أو Path B؛ PM V2 تفحص صلاحياتها ثم تستدعي الخدمة الحالية ضمن Contract مسموح.

## 4. Adapter Contracts — FROZEN من حيث الحدود

### UsersAdapter

- getActiveUser(id)
- listEligibleTechnicians(filters)
- validateTeamMember(userId)
- بيانات عرض فقط؛ لا إنشاء مستخدم.

### OrganizationAdapter

- listCurrentDepartments()
- validateDepartmentReference(value)
- مصدره النهائي يثبت بعد DB Reality Check.

### MaintenanceTargetAdapter

- getTarget(type/id)
- listSites(active only)
- listSections(siteId, active only)
- listAssets(filters, active/allowed only)
- validateTargetReference()

### WarehouseAdapter

- listEligibleTeamWarehouses()
- validateTeamWarehouse()
- transferToTeamWarehouse() عبر الخدمة الحالية.

### InventoryAdapter

- listTeamWarehouseStock()
- validateCatalog/Inventory mapping()
- issueFromTeamWarehouse() عبر `issueDelivery` الحالي.
- يعيد external transaction/delivery/lot references.

### PathBAdapter

- createOrResolveBridge()
- getBridgeState()
- getLinkedPurchaseOrder()/items
- لا ينشئ صلاحية PO جديدة ولا يغير Path B state rules.

### NotificationAdapter

- sendReminder()/system notification عبر البنية الحالية.

### FileImageAdapter

- upload/queue image using current file/offline infrastructure where compatible.
- PM V2 يحتفظ بعلاقة الصورة داخل Domain الخاص به إذا كان تعديل attachment allowlist العام غير ضروري.

## 5. External IDs التي يجب أن يدعمها ERD

المراجع الخارجية المطلوبة مبدئيًا:

- `users.id`
- `sites.id`
- `sections.id`
- `assets.id`
- `warehouses.id`
- `catalog_items.id`
- `inventory.id`
- `inventory_lots.id` عند الحاجة للتتبع
- `inventory_transactions.id`
- Delivery reference/number عند توفره
- `tickets.id`
- `ticket_items.id`
- `purchase_orders.id`
- `purchase_order_items.id`

### قرار مهم

يجب أن يحفظ Material Request Item مرجع `purchaseOrderItemId` عند وجود شراء خارجي، لأن التسليم/الاستهلاك النهائي يرتبط على مستوى مادة PO وليس رأس PO فقط.

## 6. Department Reference — OPEN حتى Reality Check

الـSchema المفحوص يظهر `users.department` كنص ولا يظهر Department Master عام.

الاقتراح غير المتداخل:

- `pmv2_specialties.sourceDepartmentName` nullable كSoft Reference.
- القيمة لا تعتبر Master Data جديدة.
- تنشأ/تعدل فقط بعد validation عبر OrganizationAdapter.
- في حال اختفاء القيمة من المصدر تظهر Consistency Warning.

لا ينفذ هذا التصميم قبل التحقق من قاعدة البيانات الفعلية.

## 7. Team Warehouse Semantics — FROZEN

- `pmv2_teams.warehouseId` يشير إلى Warehouse حالي.
- الفريق لا يملك Stock table خاصًا بـPM V2.
- نقل مادة من مستودع آخر إلى الفريق يستخدم Warehouse Transfer الحالي.
- استخدام مادة من مخزن الفريق يستخدم `issueDelivery` الحالي.
- PM V2 تحفظ روابط الحركة ولا تعدل Stock مباشرة.

## 8. Path B / Follow-up Handoff — OPEN جزئيًا

المبدأ ثابت:

`PM Task → Task Item → Material Request Item → Bridge Ticket/Item → PO/PO Item`

المسار التقني المرشح:

1. Purchase receipt داخل النظام الحالي.
2. Transfer إلى Team Branch Warehouse.
3. PM V2 = ready_followup.
4. Follow-up repair يصرف المادة من Team Warehouse.
5. Adapter يمرر PO Item / Bridge references عند الحاجة لإكمال Path B `delivered_to_requester` طبيعيًا.

المتبقي قبل Freeze النهائي:

- التحقق من شكل البيانات الفعلي ومسار PO Item في قاعدة العميل.
- تثبيت هوية `deliveredToId` في حالة Team Device.

## 9. Team Device Attribution — OPEN

يجب ألا يخفي حساب الجهاز هوية من استلم المادة فعليًا.

الخيار المفضل تقنيًا حاليًا:

> عند عملية صرف مادة فعلية، يتم اختيار/تثبيت **المستلم الفعلي من أعضاء الفريق** بسرعة، حتى لو كانت الجلسة مفتوحة بحساب جهاز الفريق.

هذا يحافظ على سهولة الجهاز مع Audit ومساءلة المخزون.

لا يعتبر Frozen حتى يتم اعتماده ضمن Phase 0.

## 10. Closure Rules — FROZEN

لا تصبح Task `completed` إلا إذا:

- كل Task Items = `resolved`.
- لا Material Request Item في حالة نشطة أو انتظار.
- لا Task Item = `waiting_material` أو `ready_followup`.
- لا Follow-up Visit مطلوبة وغير منتهية.
- لا عملية Inventory/Path B مطلوبة لتسوية بند ما زالت غير مكتملة.

إنهاء Visit لا يتجاوز هذه القواعد.

## 11. Phase 0 Gate

### مكتمل

- [x] Existing Capability Audit من الكود.
- [x] حدود ملكية PM V2 مقابل النظام الحالي.
- [x] Adapter boundaries الأساسية.
- [x] إعادة استخدام Inventory issue/transfer services الحالية.
- [x] عدم تكرار Sites/Sections/Assets/Users/Warehouses.
- [x] فصل Task Item lifecycle عن result في التصميم المرشح.
- [x] قائمة External IDs المطلوبة مبدئيًا.

### متبقٍ

- [ ] DB Reality Check لـUsers specialty/schema drift. **بدأت؛ Step 0.2a أعادت `empty set` ولم تحسم الـSchema بعد.**
- [ ] DB Reality Check للأقسام الحالية.
- [ ] DB Reality Check لبيانات Sites/Sections/Assets.
- [ ] تثبيت Department reference النهائي.
- [ ] تثبيت Team Device material recipient attribution.
- [ ] تثبيت Path B/PO Item handoff النهائي على البيانات الحقيقية.
- [ ] ERD Freeze النهائي.
- [ ] موافقة Gate وإغلاق Phase 0 قبل أي Migration/كود Phase 1.


## 12. DB Reality Check Log

### Step 0.2a — Users columns probe

- **التاريخ:** 2026-09-05
- **Query type:** Read-only.
- **Scope:** `INFORMATION_SCHEMA.COLUMNS` + `TABLE_SCHEMA = DATABASE()` + `TABLE_NAME = 'users'`.
- **Result:** `Query OK` / `empty set`.
- **Freeze impact:** Users/Department/Specialty references تبقى OPEN.
- **Next proof required:** تثبيت اسم Database الحالية ووجود `users` في نفس Schema قبل إعادة فحص الأعمدة.
