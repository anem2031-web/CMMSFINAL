# المعمارية وحدود التكامل — PM V2

## 1. القرار المعماري

PM V2 هي **Bounded Module مستقلة معماريًا داخل نفس البرنامج الحالي**.

التصنيف الأنسب حاليًا:

**Modular Monolith**

وليس:

- تطبيقًا منفصلًا.
- Microservice منفصلة.
- أو مجموعة تغييرات مبعثرة داخل الوحدات الحالية.

## 2. الهدف من هذا القرار

تحقيق ثلاثة أمور معًا:

1. استقلال منطق PM V2 وقابليته للاختبار والصيانة.
2. إعادة استخدام بيانات وخدمات البرنامج الحالية بدل تكرارها.
3. منع PM V2 من فرض تغييرات على Workflows النظام الحالي.

## 3. حدود الملكية

### داخل PM V2

- Specialties.
- Teams.
- Team Membership.
- Specialty Manager assignment.
- Checklists / Checklist Items.
- Recurrence rules.
- Maintenance Programs.
- Program Targets references.
- Tasks / Task Items.
- Visits / Visit Members.
- Item Actions / operational audit.
- Material Requests state.
- Follow-up / Closure rules.

### خارج PM V2 — Source of Truth مشترك

- Users.
- Sites.
- Sections.
- Assets.
- Warehouses.
- Catalog.
- Inventory / Lots / Transactions.
- Tickets.
- Path B.
- Purchase Orders.

PM V2 لا تنسخ هذه الكيانات كـMaster Data.

## 4. Maintenance Targets

البرنامج الحالي يملك بالفعل:

`sites → sections → assets`

لذلك التصميم الجديد لا يعتبر `pmv2_locations` مصدر حقيقة مستقلًا.

PM V2 ستربط برنامج الصيانة بأحد أهداف النظام الحالي حسب الحاجة:

- Site.
- Section.
- Asset.

الشكل النهائي لعلاقات DB يثبت في Phase 0 بعد فحص البيانات الفعلية وأنواع IDs.

## 5. الفرق بين المسميات المتشابهة

### Site
موقع رئيسي موجود في `sites`.

### Section
قسم مكاني داخل Site موجود في `sections`.

### Department
القسم الوظيفي/التنظيمي الموجود أصلًا في البرنامج، ومصدره النهائي يثبت في Phase 0.

### Specialty
تخصص صيانة جديد داخل PM V2 مثل كهرباء/سباكة.

### Team
فريق صيانة تابع للتخصص.

### Team Members
Users حاليون مرتبطون بالفريق.

## 6. الهيكل التنظيمي

**القسم الحالي → التخصص → الفريق → الأعضاء**

مع أدوار منفصلة:

- Specialty Manager.
- Team Member.
- Visit/Task Leader.

Task Leader مرتبط بزيارة، ولا يحل محل Specialty Manager.

## 7. Integration Adapters

### Users Adapter

المسؤولية:

- قراءة المستخدمين الحاليين.
- التحقق من الفعالية والدور حسب القاعدة المعتمدة.
- توفير بيانات العرض اللازمة لـPM V2.

لا ينشئ PM V2 مستخدمين جدد.

### Organization Adapter

عند الحاجة لعرض/ربط القسم الحالي دون نسخ Master Data.

لا يعتمد التصميم على اسم `department` فقط قبل تثبيت Source of Truth الفعلي.

### Maintenance Target Adapter

قراءة وتوحيد أهداف الصيانة من:

- `sites`
- `sections`
- `assets`

بحيث تتعامل طبقة PM V2 مع Contract موحد دون نسخ السجلات.

### Warehouse Adapter

- قراءة المخازن الفرعية الحالية.
- التحقق من المخزن المرتبط بالفريق.
- نقل المادة إلى مخزن الفريق عبر الخدمات الحالية `createWarehouseTransfer` / `createWarehouseTransferBatch`.
- لا ينشئ PM V2 منطق Transfer موازيًا.

### Inventory Adapter

- قراءة الأصناف والأرصدة المناسبة.
- تمرير الصرف/الاستخدام الفعلي إلى خدمة `issueDelivery` الحالية.
- احترام QR/Lot/Token/Validation الحالية.
- إعادة مراجع Delivery / Inventory Transaction / Lot اللازمة إلى PM V2.
- عند وجود شراء خارجي يحتفظ Contract بمرجع Purchase Order Item اللازم لاستمرار التتبع.

PM V2 لا تعدل الرصيد مباشرة ولا تنشئ Inventory Transaction بنفسها.

### Path B Adapter

- إنشاء/ربط Bridge Ticket/Item عند الحاجة.
- متابعة الربط مع Purchase Order.
- قراءة الحالة المطلوبة لعرضها داخل PM V2.

لا يغير Workflow أو Roles الخاصة بـPath B.

### Notification Adapter

إعادة استخدام البنية الحالية للإشعارات عندما تكون مناسبة، مع إبقاء منطق "متى نرسل" داخل PM V2.

### File/Image Adapter

إعادة استخدام خدمة الرفع/Offline Upload أو المكونات المشتركة المناسبة، مع عدم تعديل Allowlist/Workflow قائم دون حاجة معتمدة.

## 8. قاعدة الاتصال بين الوحدات

القاعدة:

> PM V2 Domain لا يعرف تفاصيل جداول أو Routers النظام الحالي أكثر مما يحتاجه Contract الـAdapter.

مثال:

```text
Technician Workflow
        ↓
PM V2 Inventory Port
        ↓
Inventory Adapter
        ↓
Current Inventory/Warehouse Services
        ↓
Inventory Transaction
```

## 9. تنظيم الكود المبدئي

المسارات النهائية تثبت بعد مطابقة Structure المشروع، لكن المبدأ:

```text
client/src/.../pmv2/
server/.../pmv2/
  domain/
  services/
  repositories/
  adapters/
  routers/
  jobs/
docs/pmv2/
```

إذا كان Structure الحالي يفرض Naming مختلفًا، نتكيف معه مع الحفاظ على Boundary.

## 10. قاعدة عدم التغيير خارج الوحدة

التغييرات خارج PM V2 تكون فقط Additive/Registration عند الحاجة، مثل:

- تسجيل Router.
- Menu entry.
- route registration.
- import محدود.

إذا تطلب التكامل تغيير سلوك نظام قائم:

1. نتوقف.
2. نوثق المشكلة.
3. نبحث عن Adapter-side solution.
4. نناقش المستخدم قبل أي قرار خارج PM V2.

## 11. Department Integration Limitation

الفحص الحالي لا يظهر Department Master عام ثابت؛ `users.department` ظاهر كنص، بينما `sections` مفهوم مكاني و`ticket_departments` خاص بالبلاغات.

لذلك لا تنشئ PM V2 جدول Departments موازٍ. Organization Adapter هو المسؤول عن تقديم/التحقق من مرجع القسم الحالي، والتصميم النهائي للربط ينتظر DB Reality Check في Phase 0.

## 12. Core First, Integration by Contract

نحدد Contracts من البداية، لكن نؤجل التكامل الحساس حتى يستقر قلب PM V2.

الترتيب:

- Phase 0: Contracts.
- Phases 1–8: Foundation/Core/Stabilization.
- Phase 9+: Inventory/Warehouse/Path B integrations.

هذا يمنع بناء وحدة عمياء عن البرنامج، ويمنع كذلك تشابكها معه قبل استقرارها.
