# CMMS — Handoff: Purchase Packages, Lot Delivery, PR Numbering

**التاريخ:** 2026-09-02  
**الحالة:** Production / Live Client  
**Current stop:** بعد نجاح نشر عداد PR واختبار `PR-2026-0472` على Railway.

---

## قواعد العمل الملزمة

- النظام يعمل لدى عميل فعلي.
- لا تغيير Workflow/State Transition/علاقات تشغيلية بدون موافقة صريحة على التغيير المحدد.
- افحص الواقع الحالي أولًا، ثم اشرح التغيير، ثم احصل على الموافقة، ثم نفذ أقل تعديل ممكن.
- SQL على Live DB: **أمر واحد فقط في كل مرة**؛ صاحب المشروع ينفذه ويرسل النتيجة.
- لا تعِد تشغيل Migration سبق تطبيقها يدويًا على Live DB.
- بعد أي تعديل Code، الحزمة التصحيحية تكون صغيرة وتحافظ على بنية المشروع.

---

## 1. مصدر النشر الحالي

المشروع المحلي المعتمد عند صاحب المشروع:

`C:\Users\mh\Desktop\CMMSFINAL`

مستودع GitHub الحالي:

`https://github.com/anem2031-web/CMMSFINAL`

تم رفع `main` حتى commit:

`22940f6 — Implement purchase order batches and package workflows`

Railway تم نقله إلى المستودع الجديد، وتم إثبات أن النسخة المنشورة تستخدم عداد PR الجديد عبر إنشاء `PR-2026-0472`.

---

## 2. Purchase Packages — الحالة الحالية

- الحزمة الأساسية مثل `PB-2026-00006` تضم عدة PRs.
- كل إرسال من المندوب ينشئ `purchase_package_submission` مستقلة مثل `PB-2026-00006-1`.
- Pricing Batch تبقى مستقلة لكل PR، وتربط جميعها بنفس Submission.
- العهدة قيمة واحدة لكل Submission.
- اعتماد الحسابات على مستوى Submission.
- اعتماد الإدارة على مستوى Submission.
- بعد اعتماد الإدارة يعود التنفيذ التشغيلي إلى مستوى PR/الصنف للشراء والاستلام والتسليم.

Runtime evidence:

- Package `PB-2026-00006` / ID 9.
- PR-2026-0457 + PR-2026-0458.
- Submission ID 13 / `PB-2026-00006-1`.
- `totalEstimatedCost = 11.00`.
- `custodyBalance = 1.35`.
- الحالة النهائية `approved`.

راجع:

- `CMMS_PURCHASE_PACKAGES_CURRENT_WORKFLOW_REVIEW_AND_RUNTIME_CLOSURE_2026-09-02.md`

---

## 3. Lot/QR Ticket Delivery Fix

تم إصلاح فقدان PO Item/Ticket identity عند التسليم من Lot QR في حالة مشاركة عدة Lots لنفس Inventory identity.

الملفات المعدلة كانت فقط:

- `server/_core/inventory-lots.ts`
- `server/routers/purchase/purchase-orders.router.ts`
- `server/_core/db/warehouse-returns.ts`

Runtime validation نجح على:

- PR-2026-0459 / PO 3600185
- item 3570473
- Lot 294
- Delivery `DLV-2026-300343`
- transaction 450996
- ticketId 1860304

راجع:

- `CMMS_LOT_QR_TICKET_DELIVERY_LINK_FIX_2026-09-02.md`

---

## 4. PR Numbering — مغلق تشغيليًا

Root cause القديم:

- `getNextPONumber()` كان non-atomic read-last+1.
- لا `UNIQUE` على `poNumber`.

تم:

1. إنشاء `purchase_order_number_counter`.
2. ضبط `AUTO_INCREMENT = 471` بعد حجز 0460–0470 للتنظيف.
3. تعديل `getNextPONumber()` ليحجز عبر `INSERT` ويستخدم `insertId`.
4. إعادة ترقيم 11 سجلًا مكررًا إلى `0460–0470`.
5. duplicate check = `empty set`.
6. إضافة `UNIQUE INDEX uq_purchase_orders_po_number (poNumber)`.
7. اختبار `PR-2026-0471` على نفس Live DB.
8. اختبار `PR-2026-0472` بعد نشر Railway.

راجع:

- `CMMS_PR_NUMBERING_ATOMIC_COUNTER_AND_DUPLICATE_CLEANUP_2026-09-02.md`

---

## 5. مهام معلقة — لا تنفذ تلقائيًا

### A. Annual Number Reset قبل 2027

العداد الحالي Atomic وآمن من التكرار، لكنه Global AUTO_INCREMENT ولا يعيد الجزء الرقمي إلى `0001` تلقائيًا عند تغير السنة.

يشمل المراجعة:

- PR counter.
- Purchase Package counter (PB) لأنه يستخدم نفس النمط العالمي.

راجع:

- `CMMS_PURCHASE_NUMBERING_ANNUAL_RESET_DEFERRED_2026-09-02.md`

### B. Purchase Package Grouping Hardening — غير حاجب

ملاحظات Source Review فقط، بلا عطل Runtime مثبت:

- Atomic transaction لإنشاء رأس الحزمة + ربط PRs.
- Distinct validation لـ `orderIds` في API.
- تحسين concurrency/retry لرقم `purchase_package_submissions.subNumber`؛ الـUNIQUE الحالي يمنع التكرار لكنه قد يرفض أحد إرسالين متزامنين.

لا تنفذ أي نقطة منها بدون موافقة صريحة.

---

## 6. نقطة التوقف الحالية

**لا توجد مشكلة تشغيلية مفتوحة في PR numbering حاليًا.**

آخر إثبات Production:

- `PR-2026-0471` → counter id 471.
- `PR-2026-0472` → counter id 472 بعد Railway deployment.

الخطوة القادمة ليست Coding تلقائيًا. عند فتح جلسة جديدة:

1. اقرأ هذا Handoff.
2. راجع `PENDING_TASKS.md`.
3. لا تغيّر Workflow الحزم أو الترقيم إلا بطلب/موافقة جديدة.
