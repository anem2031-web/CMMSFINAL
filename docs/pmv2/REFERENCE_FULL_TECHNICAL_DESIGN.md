# PM V2 — المرجع الفني المجمع

> هذا المرجع يلخص التصميم الحالي بعد إعادة تحليل البرنامج في 2026-09-05. عند التعارض، تكون القرارات الأحدث في `08_DECISIONS.md` وحالة التنفيذ في `06_IMPLEMENTATION_STATUS.md` هي المرجع.

## 1. القرار المعماري

PM V2 هي **وحدة مستقلة معماريًا داخل نفس البرنامج الحالي**.

النمط:

**Modular Monolith / Bounded Module**

وليست Microservice مستقلة.

الغرض هو عزل منطق PM V2 دون إعادة بناء بيانات أو Workflows موجودة.

## 2. قاعدة Source of Truth

PM V2 تملك فقط بياناتها التشغيلية الجديدة.

### تعيد استخدام

- `sites`
- `sections`
- `assets`
- `users`
- `warehouses`
- `catalog_items`
- inventory/lots/transactions
- tickets عند Bridge
- Path B
- purchase orders

### تملك

- specialties
- teams
- team membership
- checklists
- recurrence
- programs
- program target links
- tasks/task items
- visits/members/actions
- material request lifecycle
- follow-up/closure

## 3. التنظيم

**القسم الحالي → التخصص → الفريق → الأعضاء**

- Department الحالي لا يكرر.
- Section = قسم مكاني داخل Site، وليس Department/Specialty.
- Specialty = كيان PM V2.
- Team = كيان PM V2.
- Members = Users حاليون.
- Specialty Manager منفصل عن Visit Leader.

## 4. أهداف الصيانة

لا ننشئ Locations موازية بصورة افتراضية.

Program يربط بأهداف موجودة:

- Site
- Section
- Asset

عبر Maintenance Target Adapter.

شكل DB النهائي يثبت في Phase 0 بعد فحص البيانات الفعلية.

## 5. Checklist والتكرار

Checklist reusable.

كل Item له تكراره الخاص:

- يومي
- أسبوعي
- شهري
- ربع سنوي
- نصف سنوي
- سنوي

Scheduler يحسب الاستحقاق ويجمع البنود المستحقة لنفس Team/Target في Task واحدة.

## 6. تجربة الفني

**مهامي اليوم → Target → بند واحد → سليم / تم الإصلاح / يحتاج صيانة → التالي → إنهاء الزيارة**

الكتابة اختيارية قدر الإمكان.

## 7. الزيارات

كل تنفيذ فعلي يسجل Visit.

- inspection
- followup_repair

كل Visit لها:

- leader
- members
- team
- timestamps

إنهاء Visit لا يساوي إغلاق Task.

## 8. المخزون

PM V2 لا تنفذ Stock mutation مباشرة.

- نقل المادة إلى مخزن الفريق: Warehouse Adapter → `createWarehouseTransfer` / Batch الحالية.
- الصرف/الاستهلاك الفعلي من مخزن الفريق: Inventory Adapter → `issueDelivery` الحالية.
- QR/Lot/Validation تبقى من النظام الحالي.
- PM V2 تحفظ مراجع Delivery/Inventory Transaction/Lot فقط.

## 9. طلب المواد

عند عدم توفر المادة مع الفريق:

**Material Request → waiting_warehouse**

إذا توفرت في المستودع:

**current Warehouse Transfer → Team Branch Warehouse → issued_to_team → ready_followup**

وعند Follow-up يتم الاستهلاك الفعلي عبر `issueDelivery`.

لا تصبح المهمة جاهزة بمجرد الاستلام فقط.

## 10. Path B

عند عدم توفر المادة:

`Task → Task Item → Material Request Item → Bridge Ticket/Item → Purchase Order / Purchase Order Item`

- لا تغير PM V2 Path B.
- لا تزيد صلاحية Warehouse.
- المستخدم المخول حاليًا يكمل PO.

## 11. المتابعة

بعد صرف المادة للفريق:

- تظهر Task كمتابعة إصلاح.
- إذا لم تنفذ اليوم تبقى نفس Task لليوم التالي.
- لا Duplicate Task.
- Follow-up Visit مستقلة.

## 12. الإغلاق

Task تغلق فقط إذا:

- كل Items محلولة.
- لا Material Request نشط.
- لا Follow-up مطلوب.
- كل Visits المطلوبة منتهية.

## 13. Adapters

الحد الأدنى المتوقع:

- Users Adapter
- Organization Adapter
- Maintenance Target Adapter
- Warehouse Adapter
- Inventory Adapter
- Path B Adapter
- Notification Adapter
- File/Image Adapter

## 14. قاعدة الاختبار

كل Phase لها Acceptance Gate.

الاختبار النهائي Regression/UAT لا يلغي اختبارات المراحل.

## 15. مراحل التنفيذ

0. Existing Capability Audit + Design & Integration Freeze
1. PM V2 Foundation + Database + Security/Audit
2. Organization Model
3. Maintenance Targets Integration
4. Checklists + Recurrence
5. Maintenance Programs
6. Due Engine + Scheduler + Task Generation
7. Technician Core Workflow
8. Core Stabilization Gate
9. Team Inventory Integration + QR/Lot
10. Material Requests + Warehouse Flow
11. Path B Bridge + Purchase Order Linking
12. Follow-up Repairs + Final Closure + Notifications
13. Supervision & Management
14. Full System Integration + Regression + UAT
15. Release & Stabilization

Legacy Cleanup خارج الخطة.

## 16. قاعدة DB

أي تغيير DB يرسل SQL يدويًا للمستخدم خطوة بخطوة. المستخدم ينفذ ويرسل النتيجة، وبعد اكتمال التغيير يتم تحديث Schema وتسليمه.

## 17. حالة التنفيذ الحالية

بدأ Phase 0 رسميًا في 2026-09-05 بعد أمر المستخدم "نفذ الآن".

تم إغلاق **Step 0.1 — Existing Capability Audit من الكود** وتوثيقها في:

- `12_EXISTING_CAPABILITY_AUDIT.md`
- `13_PHASE0_DESIGN_FREEZE.md`

لم يبدأ كود PM V2 ولا Migration حتى الآن لأن Gate Phase 0 ما زالت مفتوحة. الخطوة التالية هي DB Reality Check يدوي Read-only ثم ERD Freeze.
