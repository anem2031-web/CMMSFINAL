# تنفيذ دور الحسابات في دفعات طلبات الشراء — 2026-08-31

## النطاق المعتمد

تم تنفيذ اعتماد الحسابات على مستوى **دفعة الإرسال الواحدة** بعد موافقة صريحة، مع إبقاء مسار اعتماد طلب الشراء/دفعة التسعير المفردة القديم دون تعديل.

## السلوك الجديد للحزم

- دفعة الإرسال تظهر برقم مركب مثل `PB-2026-00010-1`.
- يظهر حقل واحد فقط باسم **إجمالي رصيد العهد التي على المندوب** على مستوى دفعة الإرسال.
- لا تُكرر العهدة على طلبات الشراء أو دفعات التسعير التابعة.
- زر الحسابات هو **اعتماد وإرسال للإدارة** على مستوى دفعة الإرسال.
- رفض الصنف يبقى على مستوى الصنف ويستدعي نفس الإجراء القائم `rejectAccountingBatchItem`.
- إذا رُفضت دفعة تسعير كاملة نتيجة رفض أصنافها، يمكن لبقية دفعات التسعير التي ما زالت بانتظار الحسابات الانتقال مع دفعة الإرسال.
- إذا كانت إحدى دفعات التسعير قد انتقلت مسبقًا إلى مرحلة أخرى (`pending_management` أو `approved`) يمنع الاعتماد الجماعي لتجنب الكتابة الجزئية غير المقصودة.

## الذرية

الدالة `approvePackageSubmissionAccountingAtomic` تنفذ الكتابات الحرجة داخل معاملة قاعدة بيانات واحدة:

1. تحجز سجل دفعة الإرسال بشرط أنه لم يُعتمد سابقًا، لمنع الاعتماد المتزامن المكرر.
2. تتحقق أن دفعات التسعير المؤهلة ما زالت `pending_accounting`.
3. تتحقق من وجود أصناف فعالة قبل الاعتماد.
4. تنقل دفعات التسعير المؤهلة إلى `pending_management`.
5. تحدّث حالة طلب الشراء إلى `pending_management` فقط عندما لا تبقى له دفعة تسعير أخرى بانتظار الحسابات.
6. تسجل إجمالي قيمة الأصناف الفعالة، وإجمالي رصيد العهد، وبيانات اعتماد الحسابات على `purchase_package_submissions`.

لا يتم تغيير حالة أي صنف في اعتماد دفعة الإرسال من الحسابات.

## ما لم يتغير

- `approveAccountingBatch` القديم لم يتم تعديل أي سطر في منطقه.
- لا تغيير على شراء الأصناف.
- لا تغيير على الاستلام أو التسليم.
- لا تغيير على علاقات `purchaseOrderId` أو `batchId` أو `purchasePackageSubmissionId`.
- لا إعادة هيكلة لـ `PurchaseOrderDetail.tsx`.
- لا توجد أوامر قاعدة بيانات إضافية؛ حقول `purchase_package_submissions` اللازمة أضيفت في المرحلة الأولى بالفعل.

## PDF

عند تصدير PDF لدفعة إرسال (`submissionId`) أصبح المستند يقرأ:

- معتمد الحسابات من `purchase_package_submissions.accountingApprovedById`.
- العهدة من `purchase_package_submissions.custodyBalance`.
- المصطلح المعروض: **إجمالي رصيد العهد التي على المندوب**.

المسار القديم لملف PDF الخاص بدفعة تسعير مفردة يبقى يستخدم `po_pricing_batches.custodyAmount` كما كان.

## الأرشفة المالية التلقائية

لم تتم إعادة استخدام أرشفة PDF المنفردة لكل Pricing Batch في مسار الحزمة الجديد، لأن ذلك سيكرر عهدة دفعة الإرسال على عدة مستندات طلبات ويعطي معنى ماليًا غير صحيح. تصدير PDF الموحد لدفعة الإرسال متاح من شاشة الحزمة. دعم أرشفة مستند مالي موحد للحزمة يحتاج قرارًا مستقلاً في مركز المستندات، ولم يُفرض ضمن هذا التغيير.

## ملفات التنفيذ

- `client/src/pages/purchase/PurchaseBatchDetail.tsx`
- `server/routers/purchase/purchase-packages.router.ts`
- `server/_core/db/purchase.ts`
- `server/services/export/exportService.ts`
- `server/tests/purchasePackageAccountingSubmissionPhase2.test.ts`

## الاختبارات المطلوبة بعد التركيب

```cmd
npm run check 2>&1 | findstr /I "PurchaseBatchDetail purchase-packages.router purchase.ts exportService"
```

ثم:

```cmd
npx vitest run server/tests/purchasePackageAccessPhase1.test.ts server/tests/purchasePackageAccountingSubmissionPhase2.test.ts
```

ثم اختبار يدوي بدور الحسابات على بيانات تجريبية للحزم قبل الاستخدام الفعلي.
