# المعلقات — PM V2

> آخر تحديث: 2026-09-08

## مفتوحة

#### PEND-001 — أعطال الاختبارات العامة خارج PM V2
- **تاريخ الإضافة:** 2026-09-08
- **طلب المستخدم:** توثيق أعطال الاختبارات العامة الموجودة خارج PM V2 لمراجعتها لاحقًا ووضعها ضمن المعلقات.
- **السبب:** تشغيل Full Vitest على المشروع الكامل أظهر Baseline failures في وحدات أخرى، بينما اختبارات PM V2 المستقلة وبوابة Phase 1 الخاصة بها نجحت. لا نخلط إصلاح هذه الأعطال مع PM V2 ولا نعدل Workflows قائمة بسببها.
- **الأولوية:** متوسطة
- **مرتبط بـ:** Testing / Regression / Existing Modules
- **متى نراجعه:** في جلسة مستقلة لصيانة المشروع العام، أو قبل Phase 6 / الإطلاق الشامل، وأي وقت نعمل على الوحدة المتأثرة نفسها.
- **الحالة:** مفتوح — **لا يمنع إغلاق Phase 1 الخاصة بـPM V2**.

**Baseline المسجل من تشغيل 2026-09-08:**

- Test Files: `31 failed | 61 passed (92)`.
- Tests: `20 failed | 531 passed (551)`.
- Production build: اكتمل بنجاح، مع warnings خارج PM V2.
- مجموعات الأعطال الظاهرة في السجل تشمل:
  - `catalogRelationshipGovernance.test.ts` — عقد واجهة/حوكمة الكتالوج.
  - `inventorySettlementPhase4Step2Inputs.test.ts` — عقد مدخلات تسوية المخزون.
  - `reportCenterFoundationActionsPhase6Step1.test.ts` — توقعات مركز التقارير.
  - `splitMaintenanceRoles.test.ts` — عدة توقعات خاصة بتقسيم أدوار الصيانة/الشراء.
  - `ticketMaterialDeliveryWorkflow.test.ts` — عقد تسليم مواد البلاغ.
  - `ticketUiIntegrationContract.test.ts` — تكامل واجهة البلاغ/الشراء.
  - `translation-system.test.ts` — مجموعة اختبارات متأثرة بـ`Invalid environment variables`.
  - `unifiedReportExportReviewPhase6Step2_3.test.ts` — اختلاف صيغة locale (`ar-SA` مقابل `ar-SA-u-nu-latn`).
- Build warnings الظاهرة تشمل Duplicate `placeholder` في شاشات استلام المخزون، وتحذيرات exports مفقودة لوظائف Vendors، وتحذير حجم chunks.

**قاعدة العزل:** لا يتم إصلاح أي عنصر من PEND-001 داخل PM V2 إلا إذا أثبت اختبار/Root Cause مباشر أن PM V2 سبب المشكلة.

## تم الإغلاق

لا يوجد.

## قاعدة الاستخدام

هذا الملف يستخدم فقط عندما يقول المستخدم صراحة **«ذكرني لاحقًا»**. لا تسجل فيه خطوات الخطة العادية أو اختبارات المراحل.

### قالب الإضافة

#### PEND-000 — العنوان
- **تاريخ الإضافة:**
- **طلب المستخدم:**
- **السبب:**
- **الأولوية:** عالية / متوسطة / منخفضة
- **مرتبط بـ:** Screen / Workflow / Database / Integration / Testing
- **متى نراجعه:**
- **الحالة:** مفتوح
