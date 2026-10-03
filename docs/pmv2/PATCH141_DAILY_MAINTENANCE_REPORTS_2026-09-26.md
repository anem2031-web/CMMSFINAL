# PATCH141 — تقارير الصيانة المجدولة اليومية

التاريخ: 2026-09-26

## الهدف
إضافة صفحة إدارة مستقلة داخل PM V2 باسم **تقارير الصيانة المجدولة** تعرض لمدير الصيانة مقارنة واضحة بين ما كان مجدولًا للفريق في اليوم وما تم تنفيذه فعليًا، مع إظهار المهام المعلقة وسببها ومكان الإجراء الحالي وملاحظات الفني أمام كل مهمة.

## المسار
`/scheduled-maintenance/reports`

الصلاحيات: PM V2 Management فقط (`maintenance_manager`, `general_maintenance_manager`, `owner`, `admin`) عبر `pmv2ManagementProcedure` ومسار الصلاحيات الحالي.

## ما يعرضه التقرير
- اليوم + الفريق + الفني كفلاتر.
- **المكلف اليوم / المنجز / بدأ ومعلق / لم يبدأ / المهام المرحلة / نسبة الإنجاز**.
- عند اختيار فني: مقارنة مهام فريقه بمشاركته الفعلية المسجلة في Visits وItem Actions.
- المشاركون الفعليون في كل مهمة وقائد الزيارة إن وجد.
- ملاحظات الفني المسجلة في `pmv2_item_actions.note` أمام نفس المهمة مباشرة.
- بنود المهمة وحالتها ونتيجتها.
- الوضع الحالي للمهمة المفتوحة: المرحلة، الجهة صاحبة الإجراء، الشخص المسؤول إن كان معينًا، والمدة الحالية.
- فتح PATCH138 Timeline الكامل للمهمة من نفس التقرير.
- إظهار مهمة بها Visit مفتوحة حتى لا يختفي عدم إغلاق الزيارة من مراجعة اليوم.

## قرار مصدر الحقيقة
PM V2 يكلف `Task` على مستوى **الفريق** وليس على مستوى فني منفرد. لذلك PATCH141 لا يخترع حقل Assignment للفني. عند اختيار فني يعرض التقرير:
1. مهام الفرق النشطة التي ينتمي إليها الفني؛
2. هل شارك الفني فعليًا في الزيارة أو نفذ Item Action؛
3. ملاحظاته المسجلة باسمه؛
4. وقت الزيارات التي كان عضوًا فيها.

## حدود النطاق
- لا تغيير في Purchase / Inventory / Tickets / Accounting أو أي Workflow خارجي.
- لا SQL ولا Schema جديد.
- التقرير مشتق من PM V2 Tasks / Items / Visits / Visit Members / Item Actions ومن PATCH138 Timeline للقراءة فقط.
- لا ينشئ التقرير حالة تشغيلية جديدة ولا يعدل Task أو Visit.

## الملفات البرمجية
- `client/src/pages/pmv2/Pmv2MaintenanceReports.tsx`
- `client/src/App.tsx`
- `client/src/components/layout/DashboardLayout.tsx`
- `client/src/i18n/{ar,en,ur}.ts`
- `server/pmv2/reports/daily-report-service.ts`
- `server/routers/pmv2/reports.ts`
- `server/routers/pmv2/index.ts`
- `server/tests/pmv2-patch141-daily-maintenance-reports.node.mjs`

## التحقق
- PATCH141: **7/7 PASS**.
- PATCH138–141 focused: **32/32 PASS**.
- Broad PM V2: **368/387 PASS, 19 fail** vs PATCH140 **361/380 PASS, 19 fail**, same 19 failures and **0 new failures**.
- Syntax transpile للملفات TS/TSX المعدلة: **PASS**.
- لا Migration جديدة.
- Production Build الكامل يبقى بحاجة لبيئة المشروع ذات dependencies.
