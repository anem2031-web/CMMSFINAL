# قواعد العمل الملزمة — PM V2

## 1. حماية النظام الحالي

- PM V2 تتكيف مع النظام الحالي، وليس العكس.
- لا يعدل Ticket Workflow الحالي أو مسارات A/B/C لأجل PM V2.
- لا يعدل Purchase Workflow الحالي أو Purchase Packages/Receiving/Delivery لأجل PM V2.
- لا يعدل Inventory/QR/Lot workflow لأجل PM V2.
- لا تنشأ Master Data بديلة للمستخدمين أو المواقع أو الأصول أو المخازن أو الكتالوج.
- الوحدة الوقائية القديمة لا تمس أثناء بناء PM V2.

## 2. النموذج المعماري

PM V2 هي **Bounded Module داخل نفس التطبيق**:

- Namespace واضح للFrontend/Backend/Domain/DB.
- منطقها وبياناتها الجديدة تحت `pmv2_*`.
- التكامل مع الوحدات الحالية عبر Adapters واضحة.

## 3. Source of Truth

PM V2 تعيد استخدام:

- Users: `users`.
- Targets: `sites / sections / assets`.
- Warehouses: `warehouses`.
- Catalog: `catalog_items`.
- Inventory/Lots/Transactions/QR: النظام الحالي.
- Tickets: النظام الحالي، بما فيه A/B/C.
- Purchase Orders/Packages/Receiving/Delivery: النظام الحالي.

لا تنسخ حالة PO أو Ticket أو Stock داخل PM V2 كSource of Truth.

## 4. Organization

الهيكل المجمد:

**Specialty → Team → Members**

- Specialty كيان PM V2.
- Team كيان PM V2 وتربط بمخزن حالي.
- Members references إلى `users` الحاليين.
- `users.department` Metadata وصفي فقط.
- `sections` مفهوم مكاني وليس Specialty.

## 5. Integration Adapters

الحدود المعتمدة:

- `UsersAdapter`
- `MaintenanceTargetAdapter`
- `WarehouseAdapter`
- `InventoryAdapter`
- `TicketAdapter`
- `PurchaseAdapter`
- `NotificationAdapter`
- `FileImageAdapter`

لا تستدعي Services PM V2 وحدات النظام الحالي بشكل عشوائي خارج هذه الحدود.

## 6. قاعدة المواد والمخزون

- PM V2 لا تخصم Stock مباشرة.
- المادة المتوفرة في مخزن الفريق تستخدم خدمات الصرف الحالية.
- عند نقص مخزن الفريق، يرسل Material Request للمستودع الرئيسي.
- إذا المادة متوفرة في المستودع الرئيسي يستخدم Warehouse Transfer الحالي إلى مخزن الفريق.
- إذا غير متوفرة، ينشأ PO عادي من مصدر PM V2 ويكمل Purchase Workflow الحالي بالكامل.
- PM V2 تحفظ روابط الحركات/PO Items اللازمة للتتبع فقط.

## 7. قاعدة البلاغات

عند اختيار الفني **تحتاج بلاغ صيانة**:

- تفتح نفس نافذة إنشاء البلاغ الحالية.
- ينشأ Ticket حقيقي مرتبط بـTask Item عبر `pmv2_task_ticket_links`.
- النظام الحالي وحده يحدد A/B/C ويكمل Workflow البلاغ.
- PM V2 تقرأ الحالة والإغلاق عبر `TicketAdapter` ولا تنسخ State Machine البلاغ.

## 8. قاعدة الشراء

- PO الناتج من PM V2 هو PO عادي بالكامل.
- لا تستخدم `ticketId / ticketItemId / packageId` كSource IDs لـPM V2.
- الربط يتم عبر `pmv2_material_purchase_links` إلى PO + PO Item.
- صلاحية Warehouse لبدء PO من PM V2 — إن طبقت — تكون Scoped ومحمية Server-side/Audit، وليست Purchase Admin عامة تلقائيًا.

## 9. Material Recipient

- PM V2 لا تختار Recipient مسبقًا ولا تربط Team Device بفني ثابت.
- عند التسليم الفعلي: مستخدم المستودع هو منفذ الحركة، والمستلم الحقيقي يحدده المستودع في Workflow الحالي.
- لا Backfill تلقائي لسجلات Legacy Name-only.

## 10. Acceptance Gates

كل مرحلة تمر بـ:

**Implementation → Test → Fix → Re-test → Acceptance Gate → Next Phase**

Phase 0 نجحت وأغلقت. الخطة التنفيذية الرسمية بعدها 6 مراحل فقط حسب `01_PLAN.md`. لا تغلق أي مرحلة برمجية مستقبلية دون Runtime/Regression/UAT المناسب لها.

## 11. أوامر المستخدم

### «أجب عليا»
نقاش وإجابة فقط، بلا تعديل ملفات/كود/DB.

### «نفذ الآن»
يسمح بالتنفيذ ضمن نطاق الطلب الحالي فقط.

### «ذكرني لاحقًا»
يسجل فورًا في `pending/PENDING_ITEMS.md`.

## 12. قاعدة قاعدة البيانات

أي DB write:

1. يجهز المساعد SQL لخطوة واحدة.
2. المستخدم ينفذه يدويًا.
3. المستخدم يرسل النتيجة.
4. تتم المراجعة.
5. بعدها فقط ترسل الخطوة التالية.
6. عند Schema change يحدث ملف Schema/التوثيق ويسلم Patch.

المساعد لا ينفذ DB writes مباشرة.

## 13. التوثيق والحزم

- بعد كل خطوة تنفيذية يحدث التوثيق المتأثر.
- Patch ZIP يحتوي الملفات الجديدة/المعدلة فقط مع نفس هيكل المشروع.
- القرارات الملغاة لا تبقى كخطة نشطة؛ التاريخ الضروري يحفظ فقط في Issues/Release Notes دون أن يناقض المرجع الحالي.

## 14. Legacy Cleanup

خارج خطة بناء PM V2، ولا يبدأ إلا بعد Release واستقرار واعتماد مستقل.
