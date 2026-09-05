# Release Notes — PM V2

## Documentation Baseline — 2026-09-03

تم إنشاء التوثيق الأساسي لـPM V2 قبل التنفيذ.

### كود البرنامج

لا توجد تغييرات برمجية.

---

## Documentation Update 001 — 2026-09-03

تم توثيق:

- استخدام نفس آلية الصرف/التحويل الحالية مع QR/Lot.
- عدم الخصم المباشر من PM V2.
- Bridge إلى Path B.
- استمرار صلاحيات Path B الحالية.
- الربط بين Task وMaterial Request وBridge وPO.
- تنفيذ SQL يدويًا بواسطة المستخدم خطوة بخطوة.

### كود البرنامج

لا توجد تغييرات برمجية.

### قاعدة البيانات

لا توجد تغييرات منفذة.

---

## Documentation Update 002 — 2026-09-05

### السبب

إعادة تحليل المشروع قبل التنفيذ لمنع تكرار قدرات وMaster Data موجودة أصلًا.

### القرارات الجديدة

- اعتماد PM V2 كـBounded Module مستقل معماريًا داخل نفس البرنامج.
- اعتماد Modular Monolith بدل تطبيق/Microservice منفصل.
- اعتماد Existing Capability Audit كجزء إلزامي من Phase 0.
- اعتماد عدم تكرار Sites/Sections/Assets/Users/Warehouses/Catalog/Inventory.
- إلغاء `pmv2_locations` و`pmv2_location_groups` كتصميم افتراضي.
- اعتماد Maintenance Targets مرتبطة بـSite/Section/Asset الحالية.
- اعتماد الهيكل: القسم الحالي → التخصص → الفريق → الأعضاء.
- اعتماد Specialty Manager كدور منفصل عن Task/Visit Leader.
- اعتماد Adapter Boundary إلزامية لكل Integration.
- اعتماد Acceptance Gate لكل Phase.
- إضافة Core Stabilization Gate قبل Inventory/Path B.
- توثيق Schema Drift المحتمل الخاص بـUsers Specialty fields.
- إعادة صياغة مراحل التنفيذ إلى 0–15.

### كود البرنامج

**لا توجد تغييرات برمجية.**

### قاعدة البيانات

**لا توجد تغييرات أو Migrations منفذة.**

---

## Phase 0 Update 003 — 2026-09-05

### ما تم

- بدء Phase 0 رسميًا بعد أمر المستخدم "نفذ الآن".
- إغلاق Step 0.1: Existing Capability Audit من الكود.
- تأكيد إعادة استخدام `issueDelivery` للصرف وWarehouse Transfer الحالي للنقل.
- توثيق حدود Adapters الفعلية.
- توثيق قيود Path B الحالية ودور PO Item في الربط.
- فصل Task Item lifecycle عن Result في التصميم المرشح.
- توثيق Department limitation وTeam Device attribution كمسائل Phase 0.
- إضافة `12_EXISTING_CAPABILITY_AUDIT.md`.
- إضافة `13_PHASE0_DESIGN_FREEZE.md`.
- تسجيل تعذر Runtime baseline tests في بيئة الفحص الحالية بسبب عدم توفر Dependencies/Network.

### كود البرنامج

**لا توجد تغييرات برمجية.**

### قاعدة البيانات

**لا توجد تغييرات أو Migrations منفذة.**

### حالة Phase 0

**مفتوحة.** الخطوة التالية DB Reality Check يدوي Read-only قبل ERD Freeze.



## Phase 0 Update 004 — 2026-09-05

### ما تم

- بدء Step 0.2: DB Reality Check.
- تنفيذ أول استعلام Read-only للتحقق من أعمدة `users`.
- الاستعلام نجح تقنيًا وأعاد `empty set`.
- تسجيل النتيجة كIssue مفتوحة بدل افتراض سبب غير مثبت.
- إبقاء Users/Department/Specialty وERD Freeze مفتوحة لحين تثبيت Database/Schema الفعلية.

### كود البرنامج

**لا توجد تغييرات برمجية.**

### قاعدة البيانات

**لا توجد أي تغييرات. تم تنفيذ Query قراءة فقط بواسطة المستخدم.**
