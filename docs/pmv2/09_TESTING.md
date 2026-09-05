# خطة الاختبارات وAcceptance Gates — PM V2

## 1. قاعدة إلزامية

كل مرحلة تمر بـ:

**Implementation → Test → Fix → Re-test → Acceptance Gate**

ولا يبدأ Phase التالي قبل نجاح Gate الحالي.

## 2. Phase 0 — Design Gate

### Step 0.1 — Static Existing Capability Audit

- [x] جرد Sites/Sections/Assets/Users/Warehouses/Catalog/Inventory/Path B من الكود.
- [x] تحديد القدرات التي يعاد استخدامها بدل تكرارها.
- [x] تأكيد خدمات الصرف/النقل الحالية كأساس للAdapters.
- [x] توثيق قيود Path B الحالية.
- [x] توثيق المخاطر المفتوحة قبل ERD Freeze.

### Step 0.2 — DB Reality Check

- [x] Step 0.2a: تنفيذ أول Query Read-only على `INFORMATION_SCHEMA.COLUMNS` للـ`users`.
- [x] تسجيل النتيجة الفعلية: Query OK / `empty set`.
- [ ] تثبيت Database/Schema الحالية ووجود جدول `users`.
- [ ] تثبيت أعمدة/أنواع Users الفعلية.
- [ ] مطابقة Users DB مع `drizzle/schema.ts` والـMigrations.

> نتيجة `empty set` ليست Pass للSchema؛ هي نتيجة تشخيصية تستلزم تحققًا إضافيًا قبل Gate.

### Gate المتبقي

- [ ] Source of Truth لكل مفهوم محدد من الكود + DB Reality Check.
- [x] لا توجد Master Data مكررة بلا مبرر في التصميم الحالي.
- [ ] State Machine للTask معتمدة.
- [ ] State Machine للTask Item معتمدة.
- [ ] State Machine للMaterial Request معتمدة.
- [ ] Transition permissions محددة.
- [x] Adapter boundaries الأساسية محددة.
- [ ] Adapter contracts النهائية مثبتة بعد Reality Check.
- [x] External IDs المطلوبة مبدئيًا محددة.
- [ ] External ID types/وجودها مثبت من DB الفعلي.
- [ ] ERD معتمد.

## 3. Foundation Gate

- [ ] Namespace PM V2 مستقل.
- [ ] Security يعمل.
- [ ] Audit يعمل.
- [ ] لا Workflow قائم تغير.
- [ ] لا استدعاءات غير منظمة خارج Adapter boundary.
- [ ] Schema الفعلي مطابق بعد أوامر المستخدم.

## 4. Organization Gate

- [ ] إنشاء Specialty.
- [ ] تعيين Specialty Manager.
- [ ] إنشاء Team.
- [ ] ربط Users الحاليين.
- [ ] ربط Warehouse حالي.
- [ ] منع نطاقات وصلاحيات غير مسموحة.

## 5. Target Integration Gate

- [ ] قراءة Sites.
- [ ] قراءة Sections.
- [ ] قراءة Assets المطلوبة.
- [ ] عدم إنشاء Duplicate location master.
- [ ] البرنامج يحفظ المرجع الصحيح للTarget.

## 6. Checklist/Recurrence Gate

- [ ] Daily.
- [ ] Weekly.
- [ ] Monthly.
- [ ] Quarterly.
- [ ] Biannual.
- [ ] Annual.
- [ ] Disabled item لا يولد استحقاقًا.
- [ ] Checklist reusable.

## 7. Scheduler Gate

- [ ] حساب due date صحيح.
- [ ] تجميع البنود لنفس Team/Target.
- [ ] فصل الفرق المختلفة.
- [ ] تشغيل Scheduler عدة مرات لا ينشئ Duplicate.
- [ ] Snapshot صحيح.

## 8. Technician Core Gate

- [ ] مهامي اليوم هاتف.
- [ ] مهامي اليوم آيباد.
- [ ] بند واحد في الشاشة.
- [ ] سليم.
- [ ] تم الإصلاح بدون مادة.
- [ ] يحتاج صيانة كحالة.
- [ ] صورة اختيارية.
- [ ] ملاحظة اختيارية.
- [ ] الرجوع والتصحيح.
- [ ] رئيس المهمة.
- [ ] المشاركون.
- [ ] فني من فريق آخر.
- [ ] إنهاء Visit دون إجبار Task على الإغلاق.

## 9. Core Stabilization Gate

- [ ] Domain rules مستقرة.
- [ ] Authorization review.
- [ ] Audit review.
- [ ] Scheduler regression.
- [ ] لا Bugs حرجة مفتوحة قبل التكامل الحساس.

## 10. Inventory Gate

- [ ] المادة موجودة بمخزن الفريق.
- [ ] QR/Barcode flow مطابق للنظام الحالي.
- [ ] Lot Tracking مطابق.
- [ ] Validation الرصيد مطابق.
- [ ] Inventory Transaction تنشأ من الخدمة الحالية.
- [ ] PM V2 تحفظ المرجع.
- [ ] لا Double Deduction.
- [ ] لا خصم مباشر من PM V2.

## 11. Warehouse/Material Gate

- [ ] إنشاء Material Request مرتبط بالمهمة والبند.
- [ ] المادة متوفرة في المستودع.
- [ ] صرف/تحويل بالنظام الحالي.
- [ ] عدم الانتقال إلى ready_followup عند الاستلام فقط.
- [ ] الانتقال بعد الصرف للفريق.

## 12. Path B Gate

- [ ] إنشاء/ربط Bridge صحيح.
- [ ] PO مرتبط بالمهمة الأصلية.
- [ ] Warehouse لا يحصل على صلاحية PO إضافية.
- [ ] Workflow Path B لم يتغير.
- [ ] PO غير المرتبط بـPM V2 يعمل كما كان.

## 13. Follow-up & Closure Gate

- [ ] ظهور Pending states الصحيحة.
- [ ] Reminder.
- [ ] same Task ترحل لليوم التالي.
- [ ] Follow-up Visit مستقلة.
- [ ] فريق/Leader مختلف عند الحاجة.
- [ ] منع الإغلاق مع Task Item غير محلول.
- [ ] منع الإغلاق مع Material Request نشط.
- [ ] منع الإغلاق مع Follow-up مطلوب.
- [ ] الإغلاق فقط عند اكتمال الشروط.

## 14. Supervision Gate

- [ ] Specialty Manager يرى تخصصه فقط.
- [ ] Team filters صحيحة.
- [ ] Pending/Overdue صحيحة.
- [ ] KPIs مشتقة من بيانات حقيقية.

## 15. Full Regression

إثبات أن PM V2 لم تكسر:

- [ ] Users/Auth.
- [ ] Sites/Sections/Assets.
- [ ] البلاغات.
- [ ] المخزون.
- [ ] المستودعات.
- [ ] QR/Lots.
- [ ] المشتريات.
- [ ] Path B.
- [ ] Purchase Orders.
- [ ] الاستلام/الصرف/التحويل.
- [ ] الوحدة القديمة.
- [ ] بقية وحدات البرنامج.

## 16. UAT

سيناريو كامل:

**Program → Scheduler → Task → Inspection Visit → Issue → Material → Warehouse/Path B → Issue to Team → Follow-up → Closure**

ويجب اختباره على الجهاز المستهدف فعليًا قبل Release.

## 17. ملاحظة بيئة الاختبار — 2026-09-05

خلال Phase 0 لم تتوفر Dependencies محلية (`node_modules`) ولا pnpm قابل للتشغيل دون جلب من الشبكة، ومحاولة Corepack تعذر عليها الوصول إلى registry. لذلك:

- لم يتم تشغيل `pnpm check`.
- لم يتم تشغيل `pnpm test`.
- نتائج Phase 0 الحالية هي Static Audit وليست Runtime Test Pass.
- لا يجوز إغلاق أي Gate برمجية مستقبلًا دون تشغيل الاختبارات الفعلية في بيئة متاحة.
