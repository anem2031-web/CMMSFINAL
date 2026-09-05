# Existing Capability Audit — PM V2

> الحالة: **Phase 0 / Step 0.1 — مكتمل من ناحية فحص الكود في النسخة الحالية**  
> التاريخ: 2026-09-05  
> لا يتضمن هذا المستند أي تغيير كود أو قاعدة بيانات.

## 1. الهدف

منع PM V2 من إعادة بناء قدرات أو Master Data موجودة أصلًا في البرنامج، وتحديد الحدود الصحيحة بين:

- ما **تملكه PM V2**.
- ما **تقرأه/تستخدمه من النظام الحالي**.
- ما **يجب أن يمر عبر Adapter**.
- ما **يجب ألا يتم تغييره**.

## 2. النتيجة المعمارية

تم تأكيد أن القرار الصحيح هو:

> **PM V2 = Bounded Module مستقلة معماريًا داخل نفس البرنامج الحالي (Modular Monolith).**

الوحدة لا تنسخ Master Data الحالية ولا تبني Workflows موازية للمخزون أو Path B، وإنما تملك منطق الصيانة اليومي/الدوري فقط وتتكامل مع القدرات الحالية عبر Adapters واضحة.

## 3. القدرات الموجودة التي يعاد استخدامها

| المجال | المصدر/الخدمة الموجودة | قرار PM V2 |
|---|---|---|
| المواقع | `sites` | Source of Truth حالي؛ لا `pmv2_sites` |
| الأقسام المكانية | `sections` مرتبطة بـSite | Source of Truth حالي؛ لا نسخة PM V2 |
| الأصول | `assets` مرتبطة بـSite/Section | تستخدم كMaintenance Target عند الحاجة |
| المستخدمون | `users` | Source of Truth للأعضاء والمسؤولين |
| الفنيون | `users` بدور technician | المرجع التشغيلي لـPM V2؛ لا يعتمد Runtime على جدول `technicians` القديم |
| القسم الوظيفي | `users.department` في الـSchema الحالي | يعرض عبر Organization Adapter؛ لا ينشأ Department Master موازٍ |
| المخازن | `warehouses` | الفريق يرتبط بمخزن حالي؛ لا مخزن PM V2 |
| الأصناف | `catalog_items` | هوية الصنف الحالية |
| المخزون | `inventory` | لا خصم مباشر من PM V2 |
| Lots | `inventory_lots` | نفس Lot Tracking الحالي |
| حركات المخزون | `inventory_transactions` | تحفظ PM V2 مرجع الحركة فقط |
| صرف مادة | `issueDelivery` في `server/_core/db/warehouse-returns.ts` | الخدمة الحالية هي أساس Adapter الصرف |
| نقل مخزون | `createWarehouseTransfer` / `createWarehouseTransferBatch` | الخدمة الحالية هي أساس نقل المادة لمخزن الفريق |
| QR/Barcode | `BarcodeScanner` ومكونات المسح الحالية | إعادة استخدام تقني |
| رفع الصور/Offline | بنية الرفع و`useOfflineUpload` | إعادة استخدام عند الملاءمة من خلال File/Image Adapter |
| Audit العام | `createAuditLog` | يمكن الربط به إضافة إلى Audit التشغيلي داخل PM V2 |
| Notifications | `createNotification` | يستخدم عبر Notification Adapter |
| البلاغات | `tickets` / `ticket_items` | تستخدم فقط عند الحاجة إلى Bridge تقني |
| Path B | Workflow حالي | يبقى كما هو |
| Purchase Orders | `purchase_orders` + items | تبقى في النظام الحالي ويحتفظ PM V2 بالمراجع |

## 4. أهداف الصيانة — لا مواقع مكررة

البرنامج يملك بالفعل التسلسل المكاني:

`Site → Section → Asset`

لذلك PM V2 لا تنشئ `pmv2_locations` أو `pmv2_location_groups` كـMaster Data موازية.

البرنامج الدوري يحتفظ بمرجع إلى Target موجود، ويكون Target واحدًا من:

- Site.
- Section.
- Asset.

التصميم المفضل في DB هو وجود FKs مباشرة في `pmv2_program_targets` مع قاعدة Exactly One، بدل `targetType + targetId` غير المحمي بـFK.

### تحقق متبقٍ

لا يمكن إغلاق Target Model بالكامل من الكود وحده؛ يجب فحص **البيانات الفعلية** في قاعدة العميل لمعرفة كيف تم تمثيل المطاعم/الألعاب/المرافق حاليًا: Site أم Section أم Asset.

## 5. القسم والتخصص والفريق

تم تأكيد وجود مفاهيم متشابهة يجب عدم خلطها:

- `sections`: قسم **مكاني** داخل Site.
- `users.department`: قسم **وظيفي/تنظيمي** حالي.
- `ticket_departments`: مفهوم خاص بتوجيه البلاغات، وليس Department Master عام.
- `PM V2 Specialty`: التخصص التنظيمي الجديد للصيانة.

الهيكل المعتمد:

**القسم الحالي → التخصص → الفريق → الأعضاء**

### ملاحظة مهمة عن Department

لا يوجد في الـSchema المفحوص Department Master عام ثابت يمكن ربطه بـFK؛ الموجود الظاهر هو `users.department` كنص.

لذلك الاتجاه غير المتداخل هو:

- Organization Adapter يعرض القيم الحالية غير الفارغة من `users.department`.
- PM V2 لا تنشئ جدول Departments موازٍ.
- إذا احتاج Specialty إلى الانتساب لقسم، يحفظ **مرجعًا نصيًا Soft Reference** بعد التحقق منه عبر Adapter، إلى أن يوجد Source of Truth معرفي (ID) حقيقي في النظام الحالي.
- تغيير اسم القسم في النظام الحالي يجب أن يظهر كHealth/Consistency warning بدل تعديل النظام الحالي من PM V2.

هذا القرار لا يغلق نهائيًا إلا بعد قراءة قاعدة البيانات الفعلية والتأكد من عدم وجود Department Master غير ظاهر في النسخة المفحوصة.

## 6. المستخدمون والفنيون

PM V2 تعتمد على `users` الحالية ولا تنشئ User/Technician بديلًا.

يوجد جدول `technicians` قديم، لكنه ليس المرجع المقترح لـPM V2.

كما توجد Migration تضيف:

- `users.specialty`
- `users.specialtyEn`
- `users.specialtyUr`

بينما تعريف `users` الحالي في `drizzle/schema.ts` لا يعرض هذه الحقول ضمن Users table.

### القرار

PM V2 **لن تعتمد على `users.specialty` لبناء هيكلها التنظيمي**. التخصص هو Master خاص بـPM V2، والأعضاء References إلى `users`.

بذلك يصبح Schema Drift المذكور خطرًا سابقًا في المشروع يجب التحقق منه، لكنه لا يجبر PM V2 على تعديل Users.

## 7. المخزون — نتائج الفحص

### 7.1 الصرف من مخزن الفريق

الخدمة الحالية `issueDelivery` تدعم الصرف من Inventory حالي، وتشمل بحسب الكود الحالي:

- التحقق من المخزون والكمية.
- QR/Lot Tracking عند تفعيله.
- استهلاك Lot داخل Transaction.
- إنشاء Inventory Transaction من نوع Delivery.
- إنشاء Delivery reference/number.
- إمكانية ربط الصرف بـPurchase Order Item/Ticket عند وجودها.

### قرار PM V2

PM V2 لا تنقص `inventory.quantity` بنفسها ولا تكتب Inventory Transaction يدويًا.

المسار يكون:

`PM V2 → Inventory Adapter → current issueDelivery → Inventory/Lot/Transaction`

وتحفظ PM V2 المراجع الناتجة اللازمة للتتبع.

### 7.2 نقل المادة إلى مخزن الفريق

الخدمات الحالية `createWarehouseTransfer` و`createWarehouseTransferBatch` تتولى النقل بين المخازن، مع احترام Lot/QR وقواعد المخزون الحالية.

لذلك عند توفير مادة للفريق من مستودع آخر يكون المسار:

`PM V2 Material Request → Warehouse Adapter → current Warehouse Transfer → Team Branch Warehouse`

ولا تنشئ PM V2 Transfer logic موازية.

## 8. Path B — نتائج الفحص

الكود الحالي يفرض على Purchase Order المرتبط ببلاغ Path B ما يلي، ضمن أمور أخرى:

- البلاغ/البند يجب أن يكون على `maintenancePath = B`.
- الحالة المناسبة لإنشاء PO جديد هي `work_approved` (مع استثناء محدود لإرسال Draft قائم في `needs_purchase`).
- يوجد منع لطلب شراء نشط متعارض لنفس البلاغ/البند.
- أدوار إنشاء PO المرتبط ببلاغ هي الأدوار الحالية المعرفة في Path B، ولا تشمل Warehouse.

### القرار

يبقى القرار السابق صحيحًا:

- Warehouse يبدأ الحاجة للشراء من PM V2.
- PM V2 تنشئ/تدير Bridge تقني من داخل حدودها.
- Path B نفسه لا يتغير.
- Warehouse لا يحصل على صلاحية PO جديدة.
- PM V2 تحفظ `ticketId`, `ticketItemId`, `purchaseOrderId` والمراجع اللازمة.

## 9. نقطة تكامل Path B مع مخزن الفريق

الكود الحالي لـPath B يعتبر المادة وصلت للمستفيد النهائي عندما يصل PO Item إلى حالة `delivered_to_requester`؛ مجرد وصولها للمستودع لا يكفي.

بينما قرار PM V2 التشغيلي هو:

**وصول → استلام → صرف/نقل للفريق → ready_followup**

### اتجاه التكامل المقترح

للحفاظ على النظامين بدون تغيير أي Workflow قائم:

1. تصل المادة المشتراة إلى المستودع الحالي وفق Path B.
2. تنقل بنفس خدمة Warehouse Transfer الحالية إلى مخزن الفريق الفرعي.
3. PM V2 تعتبر بند الصيانة `ready_followup` لأن المادة أصبحت تحت مخزن الفريق.
4. عند زيارة المتابعة، يصرف الفني المادة فعليًا من مخزن الفريق باستخدام `issueDelivery` الحالي.
5. إذا كانت المادة مشتراة من Path B، يمرر Adapter مرجع `purchaseOrderItemId`/Bridge المناسب لكي يكتمل مسار التسليم الحالي بصورة طبيعية.

### حالة القرار

**اتجاه تقني قوي لكنه يحتاج Freeze نهائيًا في Phase 0** بعد التحقق من البيانات الفعلية وهوية المستلم في سيناريو حساب جهاز الفريق.

## 10. حساب جهاز الفريق ومسؤولية استلام المادة

يوجد مفهوم `deviceUserId` للفريق في التصميم، لكن الصرف الفعلي للمادة يحتاج Attribution واضحًا لمن استلم/استخدم المادة.

لا يجوز افتراض أن حساب الجهاز هو دائمًا المستلم الفعلي دون توثيق.

يجب في Design Freeze تحديد أحد النموذجين:

- حساب الجهاز يمثل Custody مقبولة رسميًا للفريق، أو
- عند الصرف يختار الفني/المستلم الفعلي سريعًا من أعضاء الفريق ويستخدم `deliveredToId` الحقيقي.

حتى يتم الحسم، هذه نقطة Phase 0 مفتوحة وليست سببًا لتغيير Workflow المخزون الحالي.

## 11. ما تملكه PM V2 فعليًا بعد هذا الجرد

PM V2 تحتاج أن تملك فقط ما يخص Domain الصيانة الجديد، وأهمه:

- Specialties.
- Teams / Team Members.
- Checklists / Recurrence.
- Programs / Program Targets references.
- Tasks / Task Items.
- Visits / Visit Members.
- Item Actions.
- Material Request lifecycle/links.
- Follow-up / Closure.
- PM V2 audit/reminders.

## 12. نتيجة Step 0.1

**Existing Capability Audit من ناحية الكود: مكتمل.**

لم يتم اكتشاف سبب يبرر إعادة بناء Users/Sites/Sections/Assets/Warehouses/Inventory/Path B داخل PM V2.

يبقى قبل إغلاق Phase 0:

1. Reality Check من قاعدة البيانات الفعلية.
2. تثبيت Source of Truth للقسم الحالي.
3. تثبيت Target model على البيانات الحقيقية.
4. تثبيت State Machines والPermissions النهائية.
5. تثبيت Material/Path B handoff semantics.
6. تثبيت هوية مستلم المادة عند استخدام Team Device.
7. تثبيت External IDs/ERD النهائي.
