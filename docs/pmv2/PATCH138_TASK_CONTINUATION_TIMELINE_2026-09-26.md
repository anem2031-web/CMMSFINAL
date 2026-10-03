# PATCH138 — Task Continuation + Responsibility Timeline — 2026-09-26

## الهدف

إكمال الحلقة التشغيلية بعد زوال سبب تعليق مهمة PM V2، مع الحفاظ على **نفس المهمة الأصلية** وتاريخها، وبناء طبقة قراءة زمنية توضّح:

- متى بدأ التنفيذ ومتى توقف ومتى استؤنف؛
- سبب الانتظار الحالي؛
- الجهة صاحبة الإجراء الآن؛
- الشخص المسؤول فعليًا عندما يوفّر النظام المصدر تعيينًا صريحًا؛
- مدة كل مرحلة مسجلة؛
- عمر المهمة ووقت التنفيذ ووقت انتظار المواد/البلاغ والاستئناف.

PATCH138 لا ينشئ Task بديلة، ولا يغيّر State Machine للمخزون أو المشتريات أو البلاغات. الأنظمة الحالية تبقى مصدر الحقيقة، وPM V2 يقرأ ويربط ويعرض فقط.

## Baseline المعتمد

`32qw76.zip` بعد PATCH137 هو مصدر الحقيقة الذي بُني فوقه PATCH138.

## 1) استكمال نفس المهمة بعد وصول المواد

عندما يكون Task Item في:

- `status = ready_to_complete`
- `result = needs_material`

تظهر للفني **استكمال العمل**.

عند الضغط:

1. يعاد التحقق من عضوية الفني النشطة في Team ومن ملكية Task Item للمهمة.
2. إذا توجد Visit مفتوحة لنفس Task يعاد استخدامها.
3. إذا لا توجد Visit مفتوحة، ينشأ صف جديد في `pmv2_visits` **لنفس taskId**؛ هذه زيارة استكمال لنفس المهمة وليست Task جديدة.
4. يسجل الفني في `pmv2_visit_members` وفق قواعد القائد/العضوية الحالية.
5. ينتقل Item من `ready_to_complete` إلى `in_progress` مع بقاء `result = needs_material` حتى تسجيل النتيجة النهائية.
6. يسجل `pmv2_item_actions.action = resume_execution`.
7. عند **تم الإصلاح — حفظ الاستخدام** يستمر مسار الاستهلاك/المرتجع الموجود أصلًا ثم يغلق البند بالطريقة الحالية.

لا يوجد جدول جديد ولا Migration؛ `pmv2_visits` و`pmv2_visit_members` و`pmv2_item_actions` الحالية كافية.

## 2) Timeline المهمة

أضيفت خدمة PM V2 read-only:

`server/pmv2/tracking/timeline-service.ts`

تقرأ من PM V2 ومن مصادر الحقيقة الحالية بدون أي كتابة عليها:

- PM V2 Visits / Item Actions / Material Requests / Purchase Links / Ticket Links؛
- Purchase Order + Purchase Order Item + Audit Logs؛
- Ticket + Ticket Status History؛
- Users لعرض الاسم عندما يوجد تعيين فعلي.

الأحداث المعروضة تشمل بحسب البيانات المتوفرة:

- بدء/إنهاء زيارة؛
- بدء تنفيذ بند؛
- احتياج مواد؛
- إنشاء طلب المواد؛
- إنشاء طلب شراء PM V2؛
- مراجعة طلب الشراء؛
- مندوب المشتريات؛
- الحسابات؛
- الإدارة العليا؛
- تأكيد الشراء/الوصول للمستودع؛
- جاهزية المادة للفني؛
- استكمال العمل؛
- احتياج بلاغ وتغيرات حالة البلاغ؛
- إغلاق البلاغ المتزامن مع إكمال PM V2؛
- إكمال البند.

## 3) المسؤول الحالي

لكل Item مفتوح تشتق الخدمة:

- `reason`
- `stageKey / stageLabel`
- `roleKey / roleLabel`
- `responsibleUserId / responsibleUserName` إن كان المصدر يملك تعيينًا صريحًا
- `since`
- مصدر الحالة ورقم PO/Ticket عند توفره.

أمثلة:

- `بانتظار مراجعة طلب الشراء` → مدير الصيانة.
- `بانتظار التسعير من المندوب` أو `بانتظار الشراء من المندوب` → مندوب المشتريات + اسم المندوب إذا كان `delegateId` موجودًا.
- `بانتظار اعتماد الحسابات` → الحسابات.
- `بانتظار اعتماد الإدارة العليا` → الإدارة العليا.
- `تم الشراء — بانتظار استكمال المستودع` → المستودع.
- `المواد جاهزة — بانتظار استكمال الفني` → الفني/الفريق.
- Ticket قيد التنفيذ → قسم البلاغات/الصيانة + assigned user إن وجد.

إذا كانت المرحلة قائمة على Role جماعي ولا يملك النظام الأساسي تعيينًا لشخص محدد، يعرض PM V2 الدور فقط ولا يخترع اسمًا.

## 4) الأزمنة

يعيد Timeline:

- `totalAgeMinutes`
- `actualWorkMinutes`
- `waitingMaterialMinutes`
- `waitingTicketMinutes`
- `waitingResumeMinutes`
- `stageSegments` لكل مرحلة مسجلة، مع البداية والنهاية والمدة والجهة/المسؤول
- `responsibilityDurations` تجميع مدة الإجراء حسب الجهة/الشخص.

هذه المدد **ليست حكمًا بالتأخير**. PATCH138 لا يعرّف SLA ولا يصف أي شخص أو جهة بأنها متأخرة. لاحقًا فقط، إذا تم اعتماد SLA واضح لكل مرحلة، يمكن مقارنة المدة الفعلية به.

## 5) واجهة الفني

داخل المهمة المختارة في `Pmv2MyTasks` أضيف:

- **مسار المهمة والزمن**؛
- العالق الآن؛
- الجهة؛
- المسؤول إن كان معينًا؛
- منذ متى؛
- عمر المهمة / التنفيذ الفعلي / انتظار المواد / انتظار البلاغ / جاهز ولم يستكمل؛
- الوقت حسب الجهة/المسؤول؛
- تفصيل مدد مراحل المهمة؛
- الخط الزمني الكامل.

ويظهر زر **استكمال العمل** فقط للبند `ready_to_complete + needs_material`، ثم تظهر واجهة الاستخدام/المرتجع الحالية بعد الاستكمال.

## حدود المصدر التاريخي

- **الحالة والمسؤول الحالي** يقرآن من الحالة/التعيين الحالي في النظام المصدر.
- الاسم التاريخي الدقيق يظهر عندما يكون المصدر قد سجل actor/assignee يمكن ربطه بالمرحلة.
- بعض مراحل الاعتماد ذات المسؤولية الجماعية لا تملك assignee مسبقًا؛ في هذه الحالة يعرض الدور، بينما يظهر منفذ الانتقال بعد حدوثه من Audit/History.
- Timeline مشتق من السجلات القائمة؛ PATCH138 لا ينسخ State Machine خارجيًا ولا ينشئ سجلات تاريخية وهمية.

## عدم المساس بالأنظمة الأخرى

لا توجد تغييرات في منطق أو ملفات تشغيل:

- Inventory / Warehouse stock movement
- Purchase approvals / delegate workflow
- Ticket workflow
- Accounting / senior management workflow
- Legacy PM

خدمة Timeline تقرأ جداولها read-only فقط. الكتابة الجديدة الوحيدة هي داخل PM V2: Visit/Visit Member/Item Action/Task Item state لاستكمال نفس Task.

## قاعدة البيانات

- **لا SQL جديد**.
- **لا Schema change**.
- `resume_execution` محفوظ في `pmv2_item_actions.action` الموجود أصلًا (`varchar`).
- Visits المتعددة لنفس Task مدعومة أصلًا بواسطة `pmv2_visits`.

## التحقق الآلي

- PATCH138 regression: **9/9 PASS**.
- Focused PM V2 including PATCH122/123, PATCH134–138, Phase 3 execution/visit, and Phase 4 issue/consumption/return: **99/99 PASS**.
- Broad PM V2 baseline (`32qw76`): **336/355 PASS, 19 fail**.
- Broad PM V2 after PATCH138: **345/364 PASS, 19 fail**.
- مجموعة أسماء الإخفاقات الـ19 متطابقة: **0 failures introduced by PATCH138**.
- TS/TSX syntax transpile for the four changed runtime files: **PASS**.
- Production build/full typecheck: غير موثق في بيئة التنفيذ لأن source snapshot لا يحتوي `node_modules`.

## ملفات Runtime المعدلة

- `server/pmv2/technician/execution-service.ts`
- `server/pmv2/tracking/timeline-service.ts` (new)
- `server/routers/pmv2/technician.ts`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`

## Test جديد

- `server/tests/pmv2-patch138-task-continuation-timeline.node.mjs`
