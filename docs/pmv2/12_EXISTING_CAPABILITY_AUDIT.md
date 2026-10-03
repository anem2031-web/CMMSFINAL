# Existing Capability Audit — PM V2

> **الحالة:** COMPLETE / FROZEN — Phase 0.

## 1. النتيجة المعمارية

PM V2 لا تعيد بناء قدرات موجودة. Existing CMMS يبقى Source of Truth للMaster Data وللTicket/Purchase/Inventory workflows.

## 2. Master Data المعاد استخدامها

- Users: `users`.
- Sites/Sections/Assets: أهداف الصيانة.
- Warehouses.
- Catalog Items.
- Inventory/Lots/Transactions/QR.

## 3. Organization Audit

الSchema الحية لم تثبت Organization/Department Master عام صالح لـPM V2، و`users.department` ليس Contract تنظيميًا موثوقًا.

**القرار:** `Specialty → Team → Members` داخل PM V2، وUsers references من النظام الحالي.

## 4. Maintenance Target Reality Check

ثبت وجود العلاقات المنطقية Site→Section→Asset في البيانات الحالية، وعدم وجود Physical FKs معلنة بينها في Schema الحالية.

بعد تصحيح المستخدم لسجلين Asset غير مربوطين وإعادة التحقق:

- كل Assets المفحوصة مرتبطة بـSite/Section صالحين.
- لا invalid site/section refs.
- لا site-section mismatch.
- توجد Sites/Sections بدون Assets، ولذلك Site وSection Targets مستقلة ذات معنى.

**القرار:** Target = `Site | Section | Asset`، وSection لا يتطلب Asset.

## 5. Inventory/Warehouse Audit

النظام الحالي يوفر:

- Warehouse Transfer.
- Delivery/Issue.
- Inventory Transactions.
- QR/Lot validation.

**القرار:** PM V2 لا تنقص Stock مباشرة، وتستخدم هذه القدرات عبر Adapters.

## 6. Material Recipient Audit

ثبت أن النظام يفرق بين منفذ الحركة والمستلم الفعلي، كما توجد سجلات Legacy تعتمد الاسم فقط.

**القرار:** PM V2 لا تربط Team Device بمستلم ثابت. المستودع يحدد Recipient الحقيقي وقت التسليم في Workflow الحالي.

## 7. Purchase Audit

الجداول الحالية توفر Purchase Orders/Items وPurchase Packages ودورة الاستلام/التسليم.

Reality Check أثبت أن حقول Ticket/Package لها دلالات خاصة بالWorkflows الحالية وليست Source fields عامة لـPM V2.

**القرار:**

`Material Request Item → pmv2_material_purchase_links → PO/PO Item`

والـPO الناتج يستخدم كل وظائف Purchase Workflow الحالي.

## 8. Ticket Audit

النظام الحالي يملك Ticket lifecycle ومسارات A/B/C.

**القرار:** عند `needs_ticket` تنشئ PM V2 Ticket حقيقيًا عبر نفس واجهة/Service الحالية، وتحفظ Source Link فقط. A/B/C لا تتغير ولا تنسخ.

## 9. ما تملكه PM V2 بعد الجرد

- Organization الخاص بها.
- Checklists/Recurrence.
- Programs/Targets.
- Tasks/Visits/Actions.
- Material Request state من منظور PM V2.
- Links إلى Purchase/Ticket.
- Material usage trace/Reminders/Audit.

## 10. نتيجة Audit

**PASS.** لا توجد Capability قائمة يجب نسخها داخل PM V2، ولا يوجد Reality Check مفتوح يمنع المرحلة 1 — تأسيس الوحدة وربط البيانات الأساسية.
