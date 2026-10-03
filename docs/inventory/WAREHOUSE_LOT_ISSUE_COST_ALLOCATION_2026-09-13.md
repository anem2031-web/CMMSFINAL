# Warehouse Lot Issue Cost Allocation — 2026-09-13

## الهدف

إضافة طبقة مستقلة لتحميل **تكلفة الصرف الفعلية حسب الـLot المصروف** على الجهة المستفيدة، بدون تغيير تقييم المخزون الحالي أو `inventory.averageCost` أو قيمة حركة المخزون الرسمية.

عند التسليم يمكن توزيع نفس كمية الصرف على جهة واحدة أو عدة جهات. كل جهة تحفظ:

- الموقع — إلزامي.
- القسم — اختياري.
- الأصل — اختياري.
- الكمية المحملة على الجهة.
- Snapshot لتكلفة وحدة الصرف في الـLot (`inventory_lots.issueUnitCost`).
- إجمالي تكلفة الجهة = الكمية × تكلفة وحدة الـLot.

مجموع كميات التوزيع يجب أن يساوي كامل كمية الصرف. التحقق يعاد على الخادم داخل نفس Transaction الخاصة بالصرف، لذلك أي خطأ في التوزيع يلغي الصرف كله.

## مثال

Lot يحتوي 7 حبات، تكلفة وحدة الـLot = 100 ريال.

- صرف 1 للموقع 1 → تكلفة محملة = 100 ريال.
- صرف 3 للموقع 3 → تكلفة محملة = 300 ريال.
- المتبقي في الـLot = 3 حبات.

يمكن أن تكون الجهتان ضمن حركة صرف واحدة إذا كانت الكمية المسلّمة 4، أو ضمن حركتين منفصلتين. لا يوجد قيد يمنع تكرار نفس `lotId` أو نفس `inventoryTransactionId` في أكثر من صف توزيع.

## حدود التغيير

- لا تغيير على `inventory.averageCost`.
- لا تغيير على `inventory.totalCostValue`.
- حركة `inventory_transactions` تستمر في استخدام متوسط التكلفة الحالي كما قبل هذه الإضافة.
- طبقة `inventory_issue_cost_allocations` مستقلة ومخصصة لتقارير تكلفة الاستهلاك حسب الجهة.
- لا Backfill تاريخي لحركات الصرف السابقة.
- لا تعديل لطريقة الاستلام أو التحويل أو الاستبعاد أو المرتجعات.

## SQL المنفذ يدويًا بنجاح

```sql
CREATE TABLE `inventory_issue_cost_allocations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `inventoryTransactionId` INT NOT NULL,
  `inventoryId` INT NOT NULL,
  `lotId` INT NOT NULL,
  `deliveryNumber` VARCHAR(50) NULL,
  `beneficiarySiteId` INT NOT NULL,
  `beneficiarySectionId` INT NULL,
  `beneficiaryAssetId` INT NULL,
  `quantity` DECIMAL(12,3) NOT NULL,
  `lotIssueUnitCostSnapshot` DECIMAL(12,4) NOT NULL,
  `allocatedCostTotal` DECIMAL(14,2) NOT NULL,
  `createdById` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_issue_cost_tx` (`inventoryTransactionId`),
  KEY `idx_issue_cost_inventory` (`inventoryId`),
  KEY `idx_issue_cost_lot` (`lotId`),
  KEY `idx_issue_cost_site_date` (`beneficiarySiteId`, `createdAt`),
  KEY `idx_issue_cost_section_date` (`beneficiarySectionId`, `createdAt`),
  KEY `idx_issue_cost_asset_date` (`beneficiaryAssetId`, `createdAt`)
);
```

نتيجة التنفيذ لدى صاحب المشروع: `Query OK` بتاريخ 2026-09-13.

## التنفيذ

- `issueDelivery()` يبقى الكاتب المركزي للصرف.
- عند تفعيل Lots تصبح بيانات تحميل التكلفة مطلوبة لأي تسليم جديد عبر المسارات الحالية.
- الخادم يحل الـLot من QR/lotCode كما كان سابقًا، ثم يأخذ `issueUnitCost` من نفس الـLot ولا يثق بأي تكلفة يرسلها العميل.
- الموقع/القسم/الأصل تتحقق من Master Data الموجودة، مع التحقق من علاقة القسم بالموقع وعلاقة الأصل بالموقع/القسم.
- إذا تم اختيار أصل له قسم ولم يرسل العميل القسم صراحة، يحفظ الخادم قسم الأصل تلقائيًا حتى تبقى تقارير القسم دقيقة.
- فروق تقريب الهلل عند تقسيم حركة واحدة على عدة جهات تُسوّى على آخر صف توزيع بحيث يساوي مجموع صفوف التكلفة إجمالي تكلفة الـLot للحركة بالضبط.
- أضيفت قراءة مستقلة `inventory.issueCostAllocations` كأساس آمن لتقارير التكلفة اللاحقة.

## الواجهة

في نافذة التسليم وبعد مسح الـLot:

1. تظهر تكلفة وحدة الـLot للقراءة فقط.
2. يوزع المستخدم الكمية على موقع/قسم/أصل.
3. يمكن إضافة أكثر من جهة داخل نفس الصرف.
4. يظهر الموزع والمتبقي وتكلفة كل جهة مباشرة.
5. لا يمكن تأكيد التسليم حتى يساوي مجموع كميات الجهات كامل كمية الصرف.

## التقارير

هذه الخطوة تنشئ **مصدر الحقيقة الجديد لتكلفة الاستهلاك حسب الجهة**. التقارير العامة القديمة لم تُعدّل في هذه الخطوة حتى لا يحدث Double Counting مع تكلفة الشراء التاريخية. أي دمج في شاشة تقارير قائمة يجب أن يستخدم `inventory_issue_cost_allocations` كمصدر تكلفة الصرف، وبقرار منفصل واضح لطريقة عرض تكلفة الشراء مقابل تكلفة الاستهلاك.
