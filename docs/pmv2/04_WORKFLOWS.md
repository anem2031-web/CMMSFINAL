# Workflows — PM V2

## مبدأ عام

PM V2 تنفذ منطق الصيانة داخل وحدتها، وعند الوصول إلى قدرة موجودة في البرنامج الحالي تمر عبر Adapter ولا تنشئ Workflow بديلًا.

---

## Workflow A — إعداد الهيكل التنظيمي

**القسم الحالي (مرجع) → التخصص → الفريق → الأعضاء**

- التخصص جديد في PM V2.
- الفريق جديد في PM V2.
- الأعضاء Users حاليون.
- مخزن الفريق Warehouse حالي.

---

## Workflow B — اختيار أهداف الصيانة

الإدارة تختار من بيانات البرنامج الحالية:

**Site / Section / Asset**

عبر Maintenance Target Adapter.

لا تنشئ PM V2 موقعًا موازيًا افتراضيًا.

---

## Workflow C — إنشاء Checklist

**إنشاء قالب → إضافة بنود → ضبط ترتيب → ضبط تكرار لكل بند → تفعيل**

القالب قابل لإعادة الاستخدام.

---

## Workflow D — إنشاء برنامج صيانة

**اختيار Targets → اختيار Team → اختيار Checklist → Start Date → مراجعة → تفعيل**

---

## Workflow E — توليد المهام

Scheduler:

**فحص البرامج الفعالة → حساب البنود المستحقة → تجميع حسب Target + Team → إنشاء Task واحدة → Snapshot للبنود**

يجب أن يكون Idempotent.

---

## Workflow F — تنفيذ الفني الأساسي

**مهامي اليوم → Target → ابدأ الزيارة → بند 1 → النتيجة → التالي → إنهاء الزيارة**

النتائج:

- سليم.
- تم الإصلاح.
- يحتاج صيانة.

---

## Workflow G — سليم

**سليم → حفظ Action → التالي**

---

## Workflow H — تم الإصلاح بدون مادة

**تم الإصلاح → هل استخدمت قطعة؟ لا → حفظ → التالي**

---

## Workflow I — تم الإصلاح بمادة

**تم الإصلاح → نعم → اختيار المادة والكمية → Inventory Adapter → آلية الصرف الحالية + QR/Lot → حفظ Inventory Transaction reference → التالي**

PM V2 لا تخصم Stock.

---

## Workflow J — يحتاج صيانة / سحب من مخزوني

**يحتاج صيانة → سحب من مخزوني → اختيار الصنف والكمية → Inventory Adapter → آلية المخزون الحالية → إصلاح → تم الإصلاح**

---

## Workflow K — يحتاج صيانة / طلب مواد

**يحتاج صيانة → طلب مواد → اختيار Catalog Item + الكمية → إرسال → waiting_warehouse**

يظهر في **طلبات معلقة**.

---

## Workflow L — المستودع / المادة متوفرة

**Material Request → متوفر → Warehouse Adapter → Warehouse Transfer الحالي → مخزن الفريق الفرعي → issued_to_team → ready_followup**

المقصود هنا أن المادة أصبحت في مخزن الفريق باستخدام `createWarehouseTransfer`/Batch الحالي، وليس أن PM V2 خصمتها أو سلمتها خارج Workflow المخزون.

لا تعود المهمة للفني بمجرد وصول المادة إلى المستودع.

---

## Workflow M — المستودع / المادة غير متوفرة

**Material Request → غير متوفر → بدء شراء خارجي من PM V2 → Path B Adapter → Bridge Ticket/Item**

ثم يكمل Path B الحالي بالمستخدمين المخولين.

---

## Workflow N — Path B

سلسلة الربط:

`Task → Task Item → Material Request → Bridge Ticket/Item → Purchase Order`

القواعد:

- لا تغير PM V2 Workflow Path B.
- لا تضيف صلاحية PO لـWarehouse.
- تحفظ المراجع للعودة إلى المهمة الأصلية.

---

## Workflow O — الحالات المبسطة للفني

يعرض PM V2 فقط ما يحتاجه الفني، مثل:

- بانتظار المستودع.
- قيد الشراء الخارجي.
- تم الشراء وبانتظار الاستلام.
- تم الاستلام وبانتظار الصرف.
- جاهزة للإصلاح.

---

## Workflow P — التذكير

**طلبات معلقة → تذكير → تسجيل Reminder → Notification Adapter**

لا يحتاج الفني كتابة رسالة.

---

## Workflow Q — إنهاء الزيارة

**آخر بند → رئيس المهمة → المشاركون → فني من فريق آخر اختياري → اعتماد وإنهاء الزيارة**

إنهاء الزيارة لا يعني إغلاق Task.

---

## Workflow R — عودة متابعة الإصلاح

الترتيب الصحيح:

**وصول المادة → استلام المستودع → صرف للفريق → ready_followup → مهامي اليوم / متابعة إصلاح**

---

## Workflow S — زيارة متابعة

**متابعة إصلاح → ابدأ Follow-up Visit → اختيار/تثبيت المستلم الفعلي → QR/Lot → Inventory Adapter → `issueDelivery` من مخزن الفريق → إصلاح → تسجيل المادة/النتيجة → إنهاء زيارة المتابعة**

إذا كانت المادة مشتراة عبر Path B، يحتفظ Adapter بمرجع `purchaseOrderItemId`/Bridge لربط الاستهلاك النهائي بالمادة الصحيحة دون تعديل Path B.

يمكن أن يكون Leader/Members مختلفين عن الزيارة الأولى.

---

## Workflow T — الترحيل

إذا Task `ready_followup` ولم تنفذ اليوم:

- لا تنشأ Task جديدة.
- تبقى نفس Task مفتوحة.
- تظهر في اليوم التالي.

---

## Workflow U — الإغلاق النهائي

يغلق Task فقط إذا:

- جميع Task Items محلولة.
- لا Material Request نشط.
- لا Follow-up مطلوب.
- كل الزيارات المطلوبة انتهت.

ثم:

`task = completed`

---

## Workflow V — الإشراف

Specialty Manager يرى نطاق تخصصه حسب Authorization:

**Teams → Tasks → Pending → Follow-up → Visits → KPIs**

ولا يمنح هذا الدور صلاحيات إضافية في Inventory أو Path B إلا إذا كانت موجودة أصلًا في النظام.
