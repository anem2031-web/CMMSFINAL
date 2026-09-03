# إصلاح ربط تسليم Lot/QR بطلب الشراء والبلاغ — 2026-09-02

**المشروع:** CMMS  
**الحالة:** ✅ FIXED / LIVE RUNTIME VERIFIED  
**النطاق:** Warehouse Delivery from Inventory Lot QR for ticket-linked Purchase Items

---

## 1. المشكلة المكتشفة

أثناء اختبار دورة حزمة شراء مرتبطة ببلاغ، تم استلام أصناف فعلية إلى المستودع ثم تسليم أحدها عن طريق QR للـLot.

قبل الإصلاح، مسار التسليم كان يحاول تحديد سياق البلاغ/PO Item من **سجل Inventory التجميعي** قبل أن يحسم الـLot الذي تم مسحه. عندما كانت عدة Lots/أصناف تشترك في نفس Inventory/Catalog identity، أمكن أن يفقد المسار هوية PO Item الدقيقة.

النتيجة المرصودة قبل الإصلاح على Lot صحيح للصنف `تجربة102` كانت أن وثيقة التسليم والحركة خرجتا كأنهما تسليم من المخزون العام، بدون `ticketId` وبدون `purchaseOrderItemId`، مع اسم صنف مأخوذ من Inventory تجميعي قديم (`تجربة8`).

---

## 2. السبب الجذري

في `deliverInventoryItem` كان ترتيب الحل كالتالي بصورة مبسطة:

1. استنتاج Ticket/PO context من `inventoryId`.
2. ثم حل Lot/QR للاستهلاك الفعلي.

هذا الترتيب غير مناسب عندما يكون الـLot نفسه يحمل المرجع الأدق:

- `purchaseOrderId`
- `purchaseOrderItemId`
- `supplierItemName`
- receipt identity

الـLot هو مصدر الحقيقة للدفعة الفيزيائية التي تم مسحها.

---

## 3. الإصلاح المعتمد

بعد موافقة صريحة، تم تعديل **3 ملفات فقط**:

1. `server/_core/inventory-lots.ts`
   - توسيع نتيجة حل Lot لتعيد هوية PO/PO Item واسم المورد المرتبط بنفس الـLot.

2. `server/routers/purchase/purchase-orders.router.ts`
   - حل QR/Lot أولًا.
   - إذا كان الـLot يحمل `purchaseOrderItemId`، يستخدم هذا المرجع كمصدر الحقيقة لسياق البلاغ والتسليم.
   - يبقى fallback القديم فقط إذا لم يوجد مرجع PO Item دقيق على الـLot.

3. `server/_core/db/warehouse-returns.ts`
   - وثيقة التسليم تستخدم `supplierItemName` من الـLot عندما يكون متاحًا بدل الاعتماد على اسم Inventory التجميعي فقط.

لم يتم تغيير Workflow شراء/استلام/تسليم، بل تم تصحيح **هوية المصدر** التي يمررها المسار القائم.

---

## 4. Runtime validation بعد الإصلاح

تم الاختبار على:

- Purchase Order ID: `3600185`
- PR: `PR-2026-0459`
- Ticket ID: `1860304`
- PO Item ID: `3570473`
- الصنف: `تجربة00698`
- Lot ID: `294`
- QR: `CMMS-LOT-17a4d557-3b3a-4778-b7bd-67e959573155`

بعد المسح والتسليم:

- PO Item → `delivered_to_requester`
- `deliveredAt = 2026-09-02 16:24:08`
- Delivery Number → `DLV-2026-300343`
- Inventory Transaction → `450996`
- السبب → `تسليم مادة مرتبطة ببلاغ`
- `ticketId = 1860304`
- `purchaseOrderItemId = 3570473`
- وثيقة التسليم احتوت اسم الصنف الصحيح وPO Item والبلاغ والفني/المستلم وبيانات المورد/التكلفة.
- البلاغ انتقل إلى `received_warehouse` حسب السلوك القائم.

**النتيجة:** PASS.

---

## 5. ملاحظات

- `deliveredQuantity` بقي `NULL` وفق تصميم الحقول الحالي، ولم يتم تغييره ضمن هذا الإصلاح.
- لا Backfill لوثائق تاريخية.
- لا SQL/Migration.
- لا Refactor واسع.
- الإصلاح محدود بتحديد المصدر الصحيح عند مسح الـLot.

**الحالة النهائية:** ✅ CLOSED / LIVE VERIFIED.
