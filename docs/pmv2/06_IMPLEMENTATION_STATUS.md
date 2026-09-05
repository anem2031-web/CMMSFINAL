# حالة التنفيذ — PM V2

> يجب تحديث هذا الملف بعد كل تنفيذ أو قرار تصميمي جوهري.

## الحالة العامة

**المرحلة الحالية: Phase 0 — Existing Capability Audit + Design & Integration Freeze**

آخر تحديث: 2026-09-05

## تنفيذ Phase 0

**بدأ رسميًا بأمر المستخدم: "نفذ الآن" بتاريخ 2026-09-05.**

تم تنفيذ Step 0.1: Existing Capability Audit من الكود وتوثيق نتائجها.

بدأ Step 0.2: DB Reality Check. أول استعلام قراءة فقط على `users` نجح تقنيًا لكنه أعاد `empty set`، لذلك لا تعتبر بنية `users` الفعلية مثبتة بعد.

## التنفيذ البرمجي

**لم يبدأ كود PM V2 بعد، وهذا مقصود لأن Phase 0 لم تغلق.**

- لا توجد ملفات كود PM V2 منفذة.
- لا توجد جداول `pmv2_*` منفذة.
- لا توجد Migration PM V2 منفذة.
- لا يوجد تعديل Workflow قائم.
- الوحدة القديمة لم تمس.

## ما تم إنجازه في التصميم

- مراجعة ملف التسليم والتوثيق الرسمي.
- إعادة فحص المشروع لتحديد القدرات الموجودة التي يجب عدم تكرارها.
- اعتماد PM V2 كوحدة مستقلة معماريًا داخل نفس البرنامج.
- اعتماد Modular Monolith / Bounded Module بدل تطبيق مستقل أو دمج متشابك.
- اعتماد إعادة استخدام Master Data الحالية عبر Adapters.
- اكتشاف أن `sites / sections / assets` موجودة بالفعل، وبالتالي إلغاء افتراض إنشاء مواقع PM V2 مستقلة.
- اعتماد الهيكل:
  **القسم الحالي → التخصص → الفريق → الأعضاء**.
- اعتماد الفصل بين Specialty Manager وTask/Visit Leader.
- اعتماد الصرف من مخزن الفريق عبر نفس Workflow المخزون الحالي وQR/Lot.
- اعتماد Bridge إلى Path B مع حفظ الربط بالمهمة الأصلية.
- اعتماد عدم توسيع صلاحيات Warehouse لإنشاء PO.
- اعتماد Acceptance Gate لكل مرحلة.
- اعتماد SQL اليدوي خطوة بخطوة لأي تغيير DB.

## Existing Capabilities المعروفة حتى الآن

| المجال | الموجود في البرنامج | اتجاه PM V2 |
|---|---|---|
| المواقع | `sites` | إعادة استخدام |
| أقسام المواقع | `sections` | إعادة استخدام |
| الأصول | `assets` | إعادة استخدام عند كونها Target |
| المستخدمون | `users` | إعادة استخدام |
| فنيون قدامى | `technicians` | لا يعتمد عليه PM V2 افتراضيًا؛ القرار النهائي بعد Phase 0 |
| القسم الوظيفي | `users.department` ظاهر في Schema | لا يكرر؛ يحتاج تثبيت دلالة/Source of Truth |
| المخازن | `warehouses` | إعادة استخدام |
| الكتالوج | `catalog_items` | إعادة استخدام |
| المخزون/الحركات/Lots | موجود | Adapter |
| QR Scanner | Component موجود | إعادة استخدام تقني |
| Offline image upload | بنية موجودة | إعادة استخدام عند الملاءمة |
| Path B / PO | موجود | Adapter/Bridge |

## نقطة تحتاج تحقق قبل التنفيذ

هناك Migration تضيف `specialty/specialtyEn/specialtyUr` إلى `users`، بينما تعريف `users` في `drizzle/schema.ts` بالنسخة المفحوصة لا يحتويها.

هذا **Schema Drift محتمل** ويجب التحقق منه في Phase 0 قبل الاعتماد على هذه الحقول.

## ما تم في Phase 0 / Step 0.1

- تأكيد Source of Truth للكود الخاص بـSites/Sections/Assets/Users/Warehouses/Catalog/Inventory.
- تأكيد أن `issueDelivery` هي خدمة الصرف الحالية المناسبة كأساس Inventory Adapter.
- تأكيد أن Warehouse Transfer الحالي (`createWarehouseTransfer` / Batch) هو مسار نقل المادة لمخزن الفريق.
- تأكيد قيود Path B الحالية وعدم وجود Warehouse ضمن أدوار إنشاء PO المرتبط ببلاغ.
- توثيق State Machines المرشحة وTransition ownership وExternal IDs.
- توثيق عدم الاعتماد على `users.specialty` لبناء تنظيم PM V2.
- إنشاء `12_EXISTING_CAPABILITY_AUDIT.md` و`13_PHASE0_DESIGN_FREEZE.md`.

## الخطوة التالية

استكمال Phase 0 فقط، بدءًا بـDB Reality Check يدوي/read-only:

1. استكمال التحقق من Users schema الفعلي وSpecialty fields بعد نتيجة `empty set` في أول استعلام Reality Check.
2. فحص القسم الحالي وبيانات Sites/Sections/Assets الفعلية.
3. تثبيت Department reference.
4. تثبيت هوية مستلم المادة عند Team Device.
5. تثبيت Path B / PO Item handoff.
6. ERD Freeze النهائي.
7. لا تبدأ Phase 1 قبل إغلاق Gate Phase 0.


## Phase 0 / Step 0.2 — DB Reality Check

### Step 0.2a — أول استعلام Users Schema

- **التاريخ:** 2026-09-05
- **النوع:** Read-only.
- **الاستعلام:** `INFORMATION_SCHEMA.COLUMNS` للجدول `users` داخل `DATABASE()`.
- **النتيجة:** Query OK / `empty set`.
- **الاستنتاج المسموح حاليًا:** الاستعلام لم يجد الأعمدة المطلوبة داخل سياق قاعدة البيانات الحالية؛ لا يجوز الاستنتاج بعد أن جدول `users` غير موجود أو أن الأعمدة غير موجودة قبل التحقق من قاعدة البيانات/Schema المتصلة فعليًا.
- **الحالة:** Step 0.2 مستمرة؛ Phase 0 غير مغلقة.
