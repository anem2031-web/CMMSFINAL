# المعمارية وحدود التكامل — PM V2

## 1. القرار المعماري

PM V2 = **Bounded Module / Modular Monolith داخل نفس CMMS**.

لها Domain/DB/Backend/Frontend واضح، لكنها تستخدم الخدمات والبيانات الحالية عبر Adapters بدل نسخها.

## 2. ما تملكه PM V2

- Specialties / Teams / Team Members.
- Checklists / Recurrence.
- Programs / Program Targets.
- Tasks / Task Items.
- Visits / Members / Item Actions.
- Material Requests / Items.
- Purchase Source Links.
- Ticket Source Links.
- Material Usage trace.
- Reminders/Audit الخاص بالوحدة.

## 3. ما لا تملكه

- Users/Auth.
- Sites/Sections/Assets.
- Warehouses/Catalog.
- Inventory/Lots/Transactions/QR.
- Ticket Workflow/A-B-C.
- Purchase Orders/Packages/Receiving/Delivery workflow.

## 4. Organization

`Specialty → Team → Members`

- `users.department` Metadata فقط.
- `sections` مكانية.
- Specialty/Team مملوكان لـPM V2.
- Members references إلى Users الحاليين.

## 5. Maintenance Targets

Program Target = نوع واحد فقط من:

- Site
- Section
- Asset

Target يحدد **مكان/موضوع الصيانة**، وTeam/Specialty يحدد **من ينفذ العمل**.

## 6. Adapters

### UsersAdapter
قراءة المستخدمين النشطين والتحقق من IDs.

### MaintenanceTargetAdapter
قراءة/Validation لـSite/Section/Asset وعلاقاتها.

### WarehouseAdapter
قراءة المخازن وتنفيذ Warehouse Transfer عبر الخدمة الحالية.

### InventoryAdapter
الصرف/QR/Lot/Transactions عبر الخدمات الحالية؛ لا Stock mutation مباشر من PM V2.

### TicketAdapter
فتح نفس Ticket creation flow، حفظ/قراءة Ticket ID/status/closure؛ لا إدارة A/B/C داخل PM V2.

### PurchaseAdapter
إنشاء PO عادي من PM V2 source، ثم قراءة PO/PO Item state من Purchase Workflow الحالي.

### NotificationAdapter / FileImageAdapter
إعادة استخدام الخدمات الحالية المناسبة.

## 7. Purchase integration

`Task Item → Material Request Item → pmv2_material_purchase_links → Purchase Order / Purchase Order Item`

- لا Source IDs داخل `ticketId/ticketItemId/packageId`.
- PO يصبح PO عاديًا بكل وظائف النظام الحالي.

## 8. Ticket integration

`Task Item → pmv2_task_ticket_links → Ticket`

- نفس نافذة إنشاء البلاغ الحالية.
- Ticket Workflow الحالي يحدد A/B/C.
- PM V2 تعرض الرابط والحالة ولا تنسخ State Machine البلاغ.

## 9. External Reference Policy

- العلاقات داخل `pmv2_*` تستخدم Physical FKs.
- المراجع إلى الجداول الحالية تحفظ كIDs وتتحقق عبر Adapters عند الكتابة/التعديل.
- External IDs المفهرسة يمكن استخدامها في JOIN مباشر عند القراءة داخل نفس قاعدة البيانات؛ FK ليس شرطًا للـJOIN.
- لا يفرض PM V2 FK خارجيًا إذا قد يغير Delete/Workflow للوحدة المالكة.
- Snapshot fields للتاريخ/العرض فقط، وليست Master Data موازية.

## 10. قاعدة عدم التغيير خارج الوحدة

أي تغيير خارج PM V2 يجب أن يكون Additive ومحدودًا (registration/menu/adapter hook أو صلاحية Scoped معتمدة)، ولا يغير Workflow أو State ownership القائم.
