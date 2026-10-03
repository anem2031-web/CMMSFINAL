# خطة التنفيذ المعتمدة — PM V2

> **الحالة:** Phase 0 CLOSED/PASS. Phase 1 CLOSED/PASS. Phase 2 CLOSED/PASS — final acceptance بتاريخ 2026-09-12. Phase 3 CLOSED/PASS — final acceptance بعد Patch 093 بتاريخ 2026-09-13. Phase 4 IN PROGRESS — **Step 4.1 = CLOSED / PASS**؛ **Step 4.2A = CLOSED / PASS بعد Patch 103**؛ **Step 4.2B = CLOSED / PASS بعد Patch 108 بتاريخ 2026-09-16**؛ **Team-Warehouse Issue/Delivery linkage = runtime-proven for self-service full stock after Patch 114; warehouse shortage + Purchase handoff = Patch 115 CODE-READY / BUILD PENDING**. اختبار تغير الرصيد بعد قرار `team_inventory` فقط يبقى **SKIPPED / ACCEPTED**؛ اختبار النقص الجزئي أصبح **PASS** أثناء قبول 4.2B؛ فحص Mobile/Tablet اليدوي = DEFERRED إلى القبول النهائي للبرنامج (Phase 6).

## مبادئ التنفيذ

- Core PM V2 يبنى داخل حدود مستقلة.
- Master Data والWorkflows الحالية يعاد استخدامها عبر Adapters.
- لا تعديل Workflow قائم لكي يناسب PM V2.
- لكل مرحلة Acceptance Gate واضح قبل الانتقال للمرحلة التالية.
- DB writes ينفذها المستخدم يدويًا خطوة بخطوة.
- الخطة التنفيذية الرسمية من الآن تتكون من **6 مراحل فقط**. التقسيم السابق إلى 15 مرحلة أُلغي من المرجع النشط، ومضمونه دُمج كخطوات فرعية داخل المراحل الست.

# Phase 0 — Existing Capability Audit + Design & Integration Freeze — CLOSED / PASS

تم إغلاق:

- Existing Capability Audit.
- Users/Organization Reality Check.
- Maintenance Target Reality Check.
- Material Recipient Attribution.
- Purchase Source/Handoff + `packageId` Reality Check.
- Ticket Workflow reuse contract.
- Task/Task Item State Machines.
- Material Request State Machine + Transition Ownership.
- Final ERD Freeze.
- Phase 0 Acceptance Gate.

لا كود أو Migration PM V2 نُفذت في Phase 0.

# المراحل التنفيذية الرسمية — 6 مراحل

## المرحلة 1 — تأسيس الوحدة وربط البيانات الأساسية — CLOSED / PASS

الهدف: إنشاء أساس PM V2 وربطها بالبيانات الرئيسية الحالية دون تكرارها.

### يشمل

- إنشاء Namespace PM V2.
- إنشاء Schema `pmv2_*` طبقًا لـ`15_FINAL_ERD_FREEZE.md`.
- Internal FKs/Unique/Indexes/Checks.
- Security/Audit foundation.
- Adapter interfaces الأساسية.
- Specialties.
- Teams.
- Team Members من `users` الحاليين.
- Team Warehouse من `warehouses` الحالية.
- ربط Maintenance Targets الحالية: `Site | Section | Asset` عبر Adapters.
- عدم إنشاء Location/User/Warehouse Master موازٍ.

DB: SQL يدوي خطوة بخطوة بواسطة المستخدم.

### بوابة القبول

- Schema مطابق للFreeze.
- Security/Audit يعملان.
- Organization يعمل حسب `Specialty → Team → Members`.
- Targets تعمل حسب `Site | Section | Asset`.
- لا Duplicate Master Data.
- PM V2-scoped Build/Typecheck/Test evidence ينجح، وأي Full-project baseline failures غير منسوبة إلى PM V2 تعزل وتوثق كمعلقات بدل خلط إصلاحها داخل المرحلة.
- لا Regression منسوب إلى PM V2 على النظام الحالي؛ Patch isolation مطلوب عند وجود Baseline failures خارج الوحدة.

## المرحلة 2 — إعداد خطط الصيانة وتوليد المهام — CLOSED / PASS

الهدف: بناء إعدادات الصيانة الدورية وتحويلها تلقائيًا إلى مهام صحيحة في موعدها.


### حالة التنفيذ الحالية

- [x] Step 2.1 — Reusable Checklists CRUD.
- [x] Step 2.1 — Checklist Items CRUD + write validation + soft activation.
- [x] Step 2.2 — Recurrence semantics + Due calculation.
- [x] Step 2.3 — Maintenance Programs + Program Targets runtime management.
- [x] Step 2.4 — Scheduler + Task generation + Idempotency + Snapshots.

### يشمل

- Reusable Checklists.
- Checklist Items.
- Recurrence: يومي/أسبوعي/شهري/ربع سنوي/نصف سنوي/سنوي حسب التصميم.
- Maintenance Programs.
- ربط Program بـTeam + Checklist + واحد أو أكثر من Targets.
- Due calculation.
- Scheduler.
- Task generation.
- Idempotency حسب Unique contract المجمد.
- Snapshots الصحيحة للفريق والTarget وبنود الفحص.

### بوابة القبول

- التكرارات تولد المواعيد الصحيحة.
- Checklist reusable ولا يولد العنصر المعطل موعدًا.
- Program/Target grouping صحيح.
- إعادة تشغيل Scheduler لا تنشئ duplicate Tasks.
- Snapshot المهمة صحيح وقابل للتتبع.

## المرحلة 3 — تنفيذ الفني للمهمات — CLOSED / PASS

الهدف: إكمال دورة الفني الأساسية على الجوال/الجهاز اللوحي بشكل مستقر قبل التكاملات الحساسة.

### حالة التنفيذ الحالية

- [x] Step 3.1 — `مهامي اليوم` + technician role/team-membership read security = CLOSED / PASS.
- [x] Step 3.2 — Start Execution + one open Visit per Task + Visit Member/Leader + `pending → in_progress` + Item Action/Audit = CLOSED / PASS.
- [x] Step 3.3 — نتائج البنود الأساسية (`ok | fixed | needs_material | needs_ticket`) = **CLOSED / PASS** after Patch 088 manual UI + live DB + Audit acceptance.
  - first slice `ok | fixed` = **CLOSED / PASS** after Patch 086.
  - Step 3.3B `needs_material | needs_ticket` = **CLOSED / PASS** after Patch 088; Core states only, without creating Material Requests or Tickets.
- [x] Step 3.4 — Leader-only Visit ending: `endedAt` + Audit, no forced Task/Item closure = **CLOSED / PASS** after Patch 090 manual UI + live DB + Audit acceptance.
- [x] Step 3.5 — Optional execution images/evidence using the existing `attachments` service, linked to `pmv2_item_actions` = **CLOSED / PASS** after Patch 092 manual UI + live DB + Audit acceptance.
- [x] Phase 3 Final Acceptance — **CLOSED / PASS** after Patch 093. Different-teammate join manual runtime test = **SKIPPED / ACCEPTED by user decision** with focused automated coverage; Mobile/Tablet manual verification = **DEFERRED TO FINAL PROGRAM ACCEPTANCE (Phase 6)** and is not relabeled PASS.
- **Next official phase:** Phase 4 = **READY / NOT STARTED**; do not start without explicit execution instruction.

### يشمل

خيارات الفني الأساسية:

- سليم.
- تم الإصلاح.
- تحتاج مواد.
- تحتاج بلاغ صيانة.

وكذلك:

- Task / Task Item states المجمدة.
- Visits / Members / Leader.
- Notes / images حسب العقود المعتمدة.
- Mobile/Tablet UX.
- Core stabilization قبل الدخول في المخزون والمشتريات والبلاغات.

### بوابة القبول

- السيناريوهات الأربعة تعمل من البداية للنهاية داخل Core PM V2.
- Task/Task Item transitions صحيحة.
- Security/Audit على أعمال الفني يعملان.
- لا Regression على وظائف النظام الحالية.

## المرحلة 4 — المواد والمستودع والشراء والبلاغات

الهدف: ربط PM V2 بالقدرات التشغيلية الحالية بدل إنشاء Workflows موازية.

### حالة التنفيذ الحالية — Patch 100 / Step 4.1

- **Phase 4 = IN PROGRESS.**
- Step 4.1 material intake = **CODE-READY / MANUAL ACCEPTANCE PENDING**.
- الفني على Item بحالة `waiting_material / needs_material` يحدد المادة والكمية والوحدة من `catalog_items` الحالي.
- فحص توفر مخزن الفريق قراءة فقط عبر Inventory الحالي، مع احتساب أرصدة Lots الحالية عندما يكون Lot tracking فعالًا.
- إذا كانت الكمية المطلوبة متوفرة بالكامل في مخزن الفريق: **لا ينشأ `pmv2_material_request`**؛ يعاد Handoff واضح إلى مسار Inventory/Delivery الحالي، ولا ينفذ PM V2 أي Stock mutation.
- إذا كان الرصيد صفرًا أو غير كافٍ: ينشأ Material Request PM V2 للـ**shortage فقط** وبند بحالة `waiting_warehouse`.
- يمنع إنشاء طلب فعال مكرر لنفس Task Item + Catalog Item.
- Main warehouse transfer / external purchase / Ticket integration ليست ضمن Step 4.1.
- لا SQL/schema change في Patch 094.

### تحسين Step 4.1 — Patch 095

- يعرض Catalog selector رصيد الصنف في **مخزن الفريق** بجانب اسم الصنف قبل التسجيل.
- بعد إدخال الكمية يعرض ملخصًا واضحًا: **المطلوب / المتاح / الناقص**.
- إذا كان المتاح يغطي المطلوب فالناقص = 0 ولا ينشأ Material Request؛ الصرف الفعلي يبقى عبر Inventory/Delivery الحالي وبحد الرصيد المتاح وقت الصرف.
- إذا كان الرصيد أقل من المطلوب يبقى مسموحًا للفني تسجيل كامل الاحتياج، ويطلب PM V2 **الناقص فقط** من المستودع الرئيسي.
- القراءة Lot-aware وتبقى Read-only؛ لا حجز ولا خصم ولا Stock mutation ولا SQL.
- Step 4.1 يبقى **MANUAL ACCEPTANCE PENDING** بعد Patch 095.

### إصلاح استمرارية مهام الفني — Patch 096

- شاشة الفني تعرض مهام تاريخ اليوم إضافة إلى أي Task أقدم ما زالت حالته غير نهائية.
- المهام السابقة `completed` أو `cancelled` لا تحمل لليوم الجديد؛ مهام اليوم المكتملة قد تبقى ضمن قائمة يومها كما كان السلوك السابق.
- `dueDate` الأصلي لا يتغير ولا ينشأ Task بديل؛ الواجهة تفصل **مهام اليوم** عن **مهام سابقة مفتوحة** وتعرض تاريخ الاستحقاق الأصلي.
- Security يبقى مبنيًا على active Team membership كما في Phase 3.
- لا SQL ولا Stock mutation ولا تغيير في Material Request routing.
- Step 4.1 يبقى **MANUAL ACCEPTANCE PENDING** بعد Patch 096.


### تكملة Step 4.1 — Patch 097: مادة غير موجودة في الدليل

- إذا لم يجد الفني المادة في `catalog_items`، يظهر مسار صريح **سجلها كمادة غير موجودة في الدليل**.
- الفني يكتب اسم المادة + الكمية + الوحدة؛ لا ينشئ PM V2 Catalog Item ولا يكرر Master Data.
- الطلب يحفظ `catalogItemId = NULL` و`itemNameSnapshot` بالاسم الذي أدخله الفني، مستفيدًا من الـSchema المجمد الموجود أصلًا؛ لا SQL جديد.
- لأن هوية Catalog غير معروفة، لا يجوز ادعاء فحص رصيد مخزن الفريق أو مطابقة Inventory بشكل تخميني. يسجل كامل الاحتياج في `waiting_warehouse` ليعالجه المستودع ويربطه بصنف معروف لاحقًا أو يمرره إلى Workflow إنشاء/اعتماد الصنف الحالي.
- يمنع طلب حر مكرر نشط لنفس Task Item عند تطابق الاسم بعد التطبيع.
- Step 4.1 يبقى **MANUAL ACCEPTANCE PENDING** بعد Patch 097.

### تكملة Step 4.1 — Patch 098: إغلاق نموذج الاحتياج بعد النجاح ومنع التكرار بصريًا

- بعد نجاح إنشاء Material Request، يُمسح نموذج الإدخال ويُغلق بدل إبقاء زر التسجيل جاهزًا للضغط مرة أخرى.
- الطلبات الحالية تبقى ظاهرة، ويظهر زر صريح **إضافة مادة أخرى** عندما يحتاج الفني احتياجًا إضافيًا مختلفًا.
- مواد Catalog التي لها طلب فعال على نفس البند تظهر **مطلوب بالفعل** ولا يمكن اختيارها من النموذج الإضافي.
- المادة الحرة غير الموجودة في الدليل تُقارن بالطلبات الفعالة بالاسم المطبع؛ عند التطابق يظهر منع فوري في الواجهة، مع بقاء منع التكرار Server-side هو الحد النهائي الموثوق.
- لا تغيير في Material Request contract أو Inventory routing، ولا SQL. Step 4.1 يبقى **MANUAL ACCEPTANCE PENDING** بعد Patch 098.


### تكملة Step 4.1 — Patch 099: منع الكسور للوحدات المعدودة

- اكتشف الاختبار اليدوي أن `2.5 قطعة` كانت تُقبل رغم أن `قطعة` وحدة معدودة؛ هذا غير مقبول تشغيليًا.
- تم إضافة سياسة كمية مشتركة بين Client/Server: الوحدات المعدودة المعروفة مثل **قطعة / حبة / علبة / لفة / كيس / وحدة** وأشهر مرادفاتها الإنجليزية تقبل أعدادًا صحيحة فقط.
- الوحدات القابلة للتجزئة أو الوحدات الحرة غير المصنفة كمعدودة تبقى قادرة على قبول الكسور حتى 3 منازل كما يسمح عقد `DECIMAL(12,3)`.
- الواجهة تغيّر `step` إلى `1` للوحدة المعدودة، تعرض رسالة **هذه الوحدة لا تقبل الكسور؛ أدخل عددًا صحيحًا.**، تمنع زر التسجيل، ولا تحسب shortage preview كقيمة صالحة حتى تصحيح الكمية.
- الخادم يستخدم نفس السياسة المشتركة ويعيد التحقق قبل أي routing أو Material Request write؛ تجاوز الواجهة لا يسمح بكمية كسرية لوحدة معدودة.
- لا SQL، لا Stock mutation، ولا تغيير في Inventory/Transfer/PO/Ticket workflows. Step 4.1 يبقى **MANUAL ACCEPTANCE PENDING** بعد Patch 099.

### يشمل المواد والمخزون

- استخدام Inventory services الحالية.
- صرف المادة الموجودة في مخزن الفريق عبر المسار الحالي.
- QR/Lot/Validation الحالية.
- PM V2 لا تخصم Stock مباشرة.
- Material Request عند نقص مخزن الفريق.
- Main warehouse availability decision.
- Warehouse Transfer الحالي عند التوفر.
- حالات Material Request Item المجمدة.

### يشمل الشراء

`Material Request Item → pmv2_material_purchase_links → PO / PO Item`

- عند الحاجة للشراء ينشأ Purchase Order عادي بالكامل.
- نفس الترقيم، الصفحة، الحالات، الاعتمادات، الموردين، Packages، receiving، inventory entry، delivery، audit والتقارير الحالية.
- لا تستخدم `ticketId/ticketItemId/packageId` لحفظ Source identity الخاصة بـPM V2.

### يشمل البلاغات

`Task Item → pmv2_task_ticket_links → Ticket`

- `needs_ticket` يفتح نفس نافذة البلاغ الحالية.
- البلاغ الناتج Ticket حقيقي.
- Ticket Workflow الحالي يحدد A/B/C ويكملها دون أي تغيير من PM V2.

### بوابة القبول

- مخزون الفريق والمستودع الرئيسي يعملان عبر الخدمات الحالية.
- Material Request trace صحيح.
- PO الناتج من PM V2 يعمل مثل أي PO حالي.
- Ticket الناتج من PM V2 يعمل مثل أي Ticket حالي ومسارات A/B/C لا تتغير.
- PO/Ticket غير المرتبطين بـPM V2 يعملان كما كانوا.
- لا Stock mutation مباشر من PM V2.

## المرحلة 5 — المتابعة والإغلاق والإدارة

الهدف: إكمال دورة المهمة بعد التبعيات الخارجية وتوفير أدوات الإدارة والمتابعة.

### يشمل

- العودة للمهمة بعد توفر المواد أو إغلاق البلاغ.
- Follow-up Visits عند الحاجة.
- Closure rules المجمدة.
- Notifications/Reminders.
- Dashboards.
- Filters.
- KPIs حسب Specialty/Team/Task status والروابط الخارجية.
- Supervision & Management views.

### بوابة القبول

- لا تغلق المهمة مع بند غير مكتمل.
- لا تغلق المهمة مع Material dependency فعالة.
- لا تغلق المهمة مع Ticket مفتوح.
- `ready_to_complete` تظهر فقط بعد زوال التبعيات المطلوبة.
- المتابعة والإشعارات والإدارة تعكس الحالة الحقيقية.

## المرحلة 6 — الاختبار الشامل والإطلاق

الهدف: إثبات أن PM V2 تعمل من البداية للنهاية دون كسر النظام الحالي ثم إطلاقها بأمان.

### يشمل

- Full Integration Testing.
- Regression على:
  - Users/Auth.
  - Sites/Sections/Assets.
  - Tickets A/B/C.
  - Inventory/Warehouses/QR/Lots.
  - Purchase Orders/Packages/Receiving/Delivery.
  - Legacy PM.
- UAT end-to-end على الأجهزة الفعلية.
- Deployment.
- Monitoring.
- Rollback readiness.
- Stabilization.

### بوابة القبول النهائية

- UAT معتمد.
- Regression كامل ناجح.
- لا Critical blockers.
- خطة الإطلاق والRollback جاهزة.
- الاستقرار بعد الإطلاق مثبت حسب معايير الإصدار.

# خارج النطاق

**Legacy PM Cleanup** لا يبدأ أثناء هذه الخطة. يفتح كمشروع مستقل بعد نجاح PM V2 واستقرارها في الإنتاج.


### تكملة Step 4.1 — Patch 100: حفظ قرار «جاهز للصرف» وإغلاق نموذج التحقق

- الاختبار اليدوي لـPatch 099 أكد `2.5 قطعة` = مرفوض، ثم `2 قطعة` مع رصيد `5` = **المطلوب 2 / المتاح 5 / الناقص 0**.
- بعد الضغط، Live DB أكد بقاء رصيد مخزن الفريق `5` وعدم إنشاء أي PM V2 Material Request للصنف (`pmv2RequestCount = 0`)؛ أي أن read-only routing يعمل كما صُمم.
- اكتشف القبول اليدوي فجوة UX/State: مسار `team_inventory` كان Toast/response مؤقتًا ويترك نموذج التحقق قابلًا لإعادة الضغط، ولا يمكن استعادته كحالة Domain بعد Refresh.
- Patch 100 يسجل كل قرار Catalog routing في `pmv2_item_actions.action = material_route_decision` مع JSON snapshot داخل `note`; لا جدول جديد ولا SQL. آخر قرار لكل Catalog Item هو المرجع لعرض الحالة.
- عندما يكون آخر قرار `team_inventory` تعرض الواجهة بطاقة **جاهز للصرف من مخزن الفريق**، تغلق/تمسح نموذج الإدخال، تمنع اختيار نفس الصنف كاحتياج جديد، وتوفر **إعادة التحقق من الرصيد**.
- إعادة التحقق تعيد تنفيذ نفس Server-side availability boundary؛ إذا أصبح الرصيد غير كافٍ يستطيع القرار الأحدث التحول إلى `material_request` ويظل الطلب الفعلي للـshortage فقط.
- هذا Event لا يخصم ولا يحجز المخزون ولا يمثل Material Usage؛ الصرف الفعلي يظل Inventory/Delivery الحالي، و`pmv2_material_usages` يبقى Trace للاستهلاك الفعلي اللاحق.
- Step 4.1 يبقى **MANUAL ACCEPTANCE PENDING** بعد Patch 100.


### إغلاق Step 4.1 — Patch 101: Final Acceptance

- **Step 4.1 = CLOSED / PASS** بقرار المستخدم بعد اكتمال القبول اليدوي للنطاق المنفذ من Patches 094–100.
- Manual PASS شمل: إنشاء shortage request عند عدم توفر مخزن الفريق؛ عرض الرصيد وrequested/available/shortage؛ carry-over للمهمة المفتوحة بين الأيام؛ المادة غير الموجودة في الدليل بدون إنشاء Master Data؛ منع التكرار؛ إغلاق/مسح نموذج الإدخال بعد النجاح؛ رفض الكسر للوحدات المعدودة؛ full-stock route بدون Material Request أو Stock mutation؛ وحفظ/استعادة بطاقة **جاهز للصرف من مخزن الفريق** بعد Refresh.
- Live DB evidence: Request `#1` / Item `1` بقي `waiting_warehouse` بكمية `1111` للمادة `300042` مع `receivedWarehouseQuantity = 0` و`issuedToTeamQuantity = 0`. مسار PRIMA (`catalogItemId = 1140273`) أكد رصيد Team Warehouse `5` وعدم إنشاء PM V2 request (`0`) عند طلب `2`. سجل `material_route_decision` رقم `30001` حفظ `requested=2 / available=5 / shortage=0` و`materialRequestId = NULL`.
- **Manual SKIPPED / ACCEPTED:** (1) خفض الرصيد بعد قرار `team_inventory` ثم recheck لإثبات التحول الحي إلى shortage route؛ (2) سيناريو نقص جزئي يدوي مثل requested `5` / available `2`. كلاهما لا يسجل PASS يدويًا؛ منطق إعادة الحساب/shortage موجود ومغطى بالعقد الآلي المركز، والمستخدم اختار الانتقال.
- آخر automated evidence قبل الإغلاق: Step 4.1 = **35/35 PASS**؛ combined Phase 3 regression + Step 4.1 = **88/88 PASS**؛ changed TS/TSX syntax = **2/2 PASS**. Phase 2 tests لم تُعد.
- لا SQL جديد، ولا Stock reservation/mutation، ولا Warehouse Transfer/PO/Ticket mutation من PM V2 ضمن Step 4.1.

### مراجعة Step 4.2 — Warehouse decision / transfer handoff — READY / NOT STARTED

- راجعت الحدود الفعلية الحالية قبل التنفيذ. Warehouse Transfer القائم موجود في `server/routers/inventory/transfers.router.ts` ويستخدم `warehouseProcedure` و`createBatch`، مع QR/Lot إلزامي عند تفعيل Lots، ويكتب Audit الحالي `warehouse_transfer_batch`.
- العقد المجمد يبقى: `waiting_warehouse` → إذا المستودع الرئيسي لديه المادة تستخدم **Warehouse Transfer الحالية** إلى Team Warehouse؛ PM V2 لا تنشئ Stock mutation موازية. `issuedToTeamQuantity` هي Projection من نقل حقيقي مؤكد، و`issued_to_team` لا تتحقق قبل وصول الكمية المطلوبة فعليًا.
- أول Slice مقترح للتنفيذ لاحقًا هو **Step 4.2A: Warehouse work queue + Main-Warehouse availability decision (read-only first)**: عرض Items بحالة `waiting_warehouse` لمستخدم المستودع، مع Team Warehouse destination وCatalog identity/علامة unlisted، وفحص رصيد المستودع الرئيسي عبر Adapter فقط. لا Transfer write ولا PO في هذا الـSlice الأول.
- بعد قبول 4.2A، Slice لاحق منفصل يربط قرار التوفر بعملية **Warehouse Transfer الحالية** (مع QR/Lot كما هي) ويحدث PM V2 projection فقط بعد نجاح التحويل المؤكد.
- لا يبدأ Step 4.2 Runtime حتى أمر تنفيذ صريح جديد.

### بدء Step 4.2A — Patch 102: Warehouse work queue + Main-Warehouse availability — CODE-READY / MANUAL ACCEPTANCE PENDING

- تمت إضافة شاشة مستقلة للمستودع على `/scheduled-maintenance/warehouse-requests` تعرض فقط `pmv2_material_request_items.status = waiting_warehouse`.
- وصول الشاشة/API محصور في `warehouse | owner | admin` عبر PM V2 warehouse guard منفصل؛ لا يُمنح دور warehouse صلاحيات إدارة PM V2 أو شاشة الفني.
- Main Warehouse لا يستخدم ID ثابتًا؛ Adapter جديد `requireSingleActiveMainWarehouse()` يطبق نفس عقد الاستلام الحالي: مستودع `type=main` مفعّل واحد فقط، ويوقف القراءة عند صفر/تعدد المستودعات الرئيسية بدل التخمين.
- لكل طلب تظهر Task/Task Item/Team/Team Warehouse destination/المادة/الكمية، ويقرأ PM V2 رصيد Main Warehouse عبر Inventory Adapter الحالي وبـLot-aware availability.
- الحالات الأساسية: `available` / `insufficient` / `unlisted`. ولحماية النزاهة توجد حالات صريحة `catalog_unavailable` / `ambiguous_inventory` / `unit_mismatch` بدل إعطاء قرار توفر مضلل.
- المادة `catalogItemId = NULL` تبقى **غير موجودة في الدليل** ولا يجري تخمين Inventory بديل.
- Step 4.2A **read-only بالكامل**: لا Warehouse Transfer mutation، لا PO، لا تغيير Material Request status، ولا Inventory/Stock mutation.
- Automated evidence: Step 4.2A focused = **15/15 PASS**؛ combined Phase 3 + Step 4.1 + Step 4.2A = **103/103 PASS**؛ changed TS/TSX syntax transpile = **14/14 PASS**.
- Step 4.2A يبقى **MANUAL ACCEPTANCE PENDING**؛ التحويل الفعلي عبر Warehouse Transfer الحالي هو Slice لاحق فقط بعد قبول هذه الشاشة.

### عقد Step 4.2B قبل التنفيذ — Patch 104: Warehouse Transfer handoff فقط — READY / NOT STARTED

- **هدف 4.2B:** استخدام الكمية الموجودة فعليًا الآن في Main Warehouse لتغطية احتياج PM V2 عبر **Warehouse Transfer الحالي** إلى Team Warehouse، مع إبقاء Inventory/QR/Lot/stock/audit الحالية Source of Truth.
- PM V2 لا تنشئ Stock mutation ولا Transfer engine موازٍ. نقطة البداية للمستخدم تكون من بطاقة طلب PM V2، ثم يمر التنفيذ عبر Warehouse Transfer الحالي.
- لكل Material Request Item معروف في Catalog يحسب العرض: **المطلوب الأصلي / ما تم توفيره سابقًا / المتبقي / المتاح في Main Warehouse / القابل للتحويل الآن**. القابل للتحويل الآن = الأقل من `المتبقي` و`المتاح` بعد إعادة التحقق Server-side.
- **التحويل الجزئي مسموح:** إذا المطلوب المتبقي `10` والمتاح `6` يمكن تحويل `6` الآن، ويبقى `4` عجزًا على **نفس Material Request Item**؛ لا ينشأ احتياج PM V2 جديد.
- بعد نجاح Transfer الحقيقي فقط، تحدث PM V2 الـprojection/trace المرتبط بالطلب. فشل/إلغاء Transfer لا يحسب كمية موردة.
- يمكن لأكثر من Transfer حقيقي أن يغطي نفس Material Request Item على دفعات. لا يعتبر احتياج المادة مكتملًا حتى يبلغ مجموع الكميات المؤكدة الكمية المطلوبة.
- إذا المتاح `0` فلا يبدأ Transfer. وإذا `catalogItemId = NULL` فلا Transfer قبل حل هوية المادة في Catalog.
- Task Item يبقى `waiting_material` ما دام هذا الاحتياج غير مكتمل؛ اكتمال التحويل وحده لا يعني استهلاك المادة أو إكمال الصيانة.
- **خارج 4.2B ومؤجل:** إنشاء/بدء Purchase Order للعجز، ربط PO/PO Item، متابعة Receiving، إعادة إظهار الكمية المستلمة كجاهزة للتحويل، والصرف/الاستهلاك النهائي من Team Warehouse.
- **قاعدة الشراء المستقبلية المعتمدة:** عجز PM V2 هو **الحد الأدنى المرتبط بالمهمة** وليس سقف كمية الشراء. إذا العجز `4` وقرر المستودع شراء `20`، يرتبط بـPM V2 فقط `4` عبر `linkedQuantity`، والـ`16` الزائدة تبقى مخزونًا عامًا. لا تنسب الزيادة للمهمة ولا تغير احتياجها الأصلي.
- يمكن أن يحتوي Purchase Order مستقبلاً على كميات لأكثر من مصدر/غرض، لكن كل ربط PM V2 يبقى لكمية محددة ومصدر محدد وفق `pmv2_material_purchase_links`; تفاصيل إنشاء/تقسيم PO Items تبقى ضمن Slice الشراء اللاحق ولا تنفذ في 4.2B.
- Patch 104 توثيق فقط؛ لا Runtime ولا SQL. يبدأ تنفيذ 4.2B فقط بعد أمر تنفيذ صريح جديد.


### تنفيذ Step 4.2B — Patch 105: Existing Warehouse Transfer handoff — CLOSED / PASS بعد Patch 108

- شاشة **طلبات مواد PM V2** تشرح الآن أصل الاحتياج بوضوح: **احتياج المهمة / المتاح في مخزن الفريق وقت الطلب / المطلوب من المستودع الرئيسي / المتبقي للتحويل**، مع **المتاح في الرئيسي الآن** ومخزن الفريق المستهدف. ويظل `transferableNow` محسوبًا Server-side ويظهر في إجراء بدء التحويل.
- زر **بدء تحويل المتاح** يظهر فقط لمادة Catalog سليمة ولها `transferableNow > 0`.
- الانتقال يفتح **Warehouse Transfer الحالي** مع سياق PM V2: Main Warehouse مصدر، Team Warehouse هدف، Inventory identity محددة، وMaximum quantity = الأقل من المتبقي والمتاح.
- Warehouse Transfer الحالي يبقى مالك `createBatch` وQR/Lot وفحص الرصيد والحركة الفعلية والتدقيق؛ PM V2 لا يكتب Inventory/Transfer rows. يمكن تقسيم الكمية على أكثر من Lot دون تجاوز سقف احتياج PM V2.
- بعد نجاح الحركة الفعلية فقط، ترسل أرقام التحويل الناجحة إلى PM V2. Adapter قراءة فقط يثبت أن كل Transfer حقيقي يطابق Main source + Team destination + Catalog identity + unit.
- كل Transfer مؤكد يُسجل Trace في `pmv2_item_actions` باسم `material_transfer_linked` مع snapshot رقم/ID التحويل والكمية والمسار. لا جدول ربط جديد ولا SQL.
- `issuedToTeamQuantity` يعاد حسابه من Transfers الفعلية الفريدة المرتبطة، ومقيد بحد `requestedQuantity`. التحويل الجزئي يبقي الحالة `waiting_warehouse`؛ الاكتمال فقط يحول البند إلى `issued_to_team`.
- إعادة ربط نفس Transfer idempotent، ونفس Transfer لا يمكن أن يغطي طلب PM V2 آخر.
- بعد تنفيذ حركة فعلية من سياق PM V2 تقفل صفحة التحويل ذلك السياق القديم؛ يجب العودة للطابور لإعادة فحص المتبقي والرصيد قبل Transfer آخر. إذا نجح المخزون وفشل ربط PM V2، يسمح **Retry للربط فقط** بدون إعادة الحركة.
- Purchase/PO/Receiving تبقى مؤجلة بعد 4.2B كما جُمّد في Patch 104.
- Automated evidence: Step 4.2B focused = **25/25 PASS**؛ combined Phase 3 + Step 4.1 + Step 4.2A + Step 4.2B = **131/131 PASS**؛ targeted changed TS/TSX syntax = **7/7 PASS**؛ Node test syntax = PASS.
- لا SQL/schema change. Manual runtime acceptance لـ4.2B اكتمل **PASS** في Patch 108 بعد إثبات الحركة الحقيقية وربط `TRF-2026-090001` بالطلب وتحديث `issuedToTeamQuantity = 1` والحالة `issued_to_team`.

### Phase 4 UX follow-up — technician material picker — IMPLEMENTED in Patch 143
- The Step 4.1 no-search selector now uses a smart default list without reopening the accepted material-routing contract.
- Team-Warehouse-stocked materials rank first; real same-target / same-Team `pmv2_material_usages` history contributes only as evidence-based relevance.
- Unrestricted search across the active Catalog remains available by material name/item code.
- Result identity now includes material name + operator Catalog code + taxonomy path + Team-Warehouse balance.
- No specialty relationship is inferred from category names/free text; explicit Master Data would still be required for any future specialty ranking.
- No SQL/schema or external workflow write.


### Patch 107 — Warehouse quantity-context clarity during Step 4.2B manual acceptance
- صحح العرض المضلل `المطلوب الأصلي` الذي كان يعرض فقط Shortage Material Request Item وليس إجمالي احتياج الفني.
- تستعيد شاشة المستودع Snapshot قرار Step 4.1 من `material_route_decision` لتعرض **احتياج المهمة** و**المتاح في مخزن الفريق وقت الطلب** بدون جدول أو SQL جديد.
- `requestedQuantity` في Material Request Item يبقى معناه الصحيح: **المطلوب من المستودع الرئيسي** (النقص فقط).
- `remainingQuantity` يعرض باسم **المتبقي للتحويل**. Main current availability يبقى قراءة حية منفصلة.
- للطلبات التاريخية التي لا تملك Snapshot قرار قابلًا للقراءة، لا يتم اختراع القيم القديمة؛ يظهر `—` لحقول Snapshot فقط بينما تستمر بيانات طلب المستودع الحالية بشكل طبيعي.
- الاختبار اليدوي للنقص الجزئي أصبح PASS: احتياج 6، Team Warehouse عند القرار 5، Material Request created للناقص 1 فقط.
- 4.2B يبقى MANUAL ACCEPTANCE IN PROGRESS؛ لم يتم تنفيذ Transfer فعلي بعد هذا التعديل.


### Patch 108 — Step 4.2B final manual acceptance closure (2026-09-16)
- **Step 4.2B = CLOSED / PASS.**
- الاختبار الحقيقي نفذ Warehouse Transfer بكمية `1` من Lot `LOT-2026-00315`. رقم رأس العملية الظاهر للمستخدم هو Batch `TRB-2026-090001`، بينما صف التحويل الفعلي المرتبط بـPM V2 يحمل `warehouse_transfers.transferNumber = TRF-2026-090001`.
- DB verification أثبت: `linkedQuantity = 1`, `requestedQuantity = 1`, `issuedToTeamQuantity = 1`, `status = issued_to_team`.
- PM V2 يربط `TRF` لأنه هو هوية صف التحويل الفعلي التي يتحقق منها Adapter؛ `TRB` يبقى هوية عملية `createBatch` الجامعة. لا تغيير كود أو schema مطلوب لهذا التوضيح.
- Purchase/PO/Receiving لم تبدأ ضمن هذا الإغلاق وتبقى Slice لاحقة من Phase 4.


### Patch 109 — Phase 4 Team-Warehouse Issue/Delivery linkage (2026-09-16)
- **الحالة: CODE IMPLEMENTED / MANUAL ACCEPTANCE PENDING.** هذا Slice يكمل Material dependency بعد وصول المادة إلى Team Warehouse، ولا يبدأ Purchase/PO/Receiving ولا Phase 5.
- الصرف الفعلي يبقى عبر `purchaseOrders.deliverInventoryItem` → `db.issueDelivery` الحالي؛ Inventory/Lot/QR/Delivery Document/transaction/cost allocation تبقى Source of Truth، وPM V2 لا تخصم Stock مباشرة.
- شاشة المخزون تعرض اختيارًا **اختياريًا** لربط التسليم باحتياج PM V2 المطابق لنفس Team Warehouse + Catalog Item. بدون الاختيار يبقى الصرف العام الحالي كما هو.
- Server يعيد فحص full task requirement من آخر `material_route_decision`، والاستخدام الفعلي المسجل سابقًا، والرصيد الحي؛ `issuableNow = min(task remaining, live Team-Warehouse availability)`. المستلم عند ربط PM V2 يجب أن يكون فنيًا نشطًا في فريق المهمة.
- بعد إنشاء Delivery حقيقي فقط، يقرأ PM V2 `delivery_documents` عبر Adapter read-only ويسجل `pmv2_material_usages` مع `inventoryTransactionId / inventoryLotId / deliveryDocumentId`. إعادة ربط نفس Delivery idempotent، ولا يمكن نسب نفس Delivery إلى Task Item آخر.
- في سيناريو النقص الجزئي الحالي (`6` احتياج / `5` مخزون فريق أصلي / `1` shortage وصل بالتحويل)، إذا صُرفت `6` دفعة واحدة فـPM V2 لا ينسب الستة كلها لطلب النقص `1`: يسجل `5` كاستخدام من مخزون الفريق الأصلي (`materialRequestItemId = NULL`) و`1` فقط من Material Request.
- Material Request Item ينتقل إلى `consumed` فقط عندما تبلغ الكمية المنسوبة له طلبه وبعد أن يكون `issued_to_team`. Task Item ينتقل من `waiting_material` إلى `ready_to_complete` فقط بعد إثبات الاستخدام الفعلي لكل احتياجاته المادية المعروفة.
- إذا نجح الصرف الحقيقي وفشل ربط PM V2، الواجهة تمنع منطق إعادة الصرف وتوفر **إعادة ربط PM V2 فقط** لنفس Delivery.
- لا SQL/schema جديد. `pmv2_material_usages` الموجود مسبقًا هو Trace/Audit فقط.
- Automated evidence: focused Patch 109 = **27/27 PASS**؛ Phase 3 + Phase 4 focused regression = **158/158 PASS**؛ changed TS/TSX syntax transpile = **7/7 PASS**. Full `tsc --noEmit` غير قابل للتشغيل في snapshot المعزول بسبب غياب type packages الكاملة، كما في Patches السابقة.
- **Phase 5 لم تبدأ:** Patch 109 يزيل Material dependency إلى `ready_to_complete` فقط؛ عودة الفني/Follow-up Visit/الإغلاق النهائي تبقى ضمن Phase 5 لاحقًا.

### Patch 114 — Technician self-service receipt from Team Warehouse (2026-09-19)
- For a listed need fully covered by the Team Warehouse, replace the routine warehouse-user issue dependency with **استلام المواد من مخزن الفريق** on the technician task.
- Confirmation persists the PM V2 requirement then uses the existing Inventory/Delivery issue boundary with the logged-in technician as actual recipient; Lot/Multi-Lot allocation remains automatic.
- If only part of the need is available, do **not** issue the available part by default. Persist the full task need and create a Main-Warehouse request only for the shortage.
- Once the shortage is physically transferred and the Team Warehouse can cover the full remaining need, the technician receives the complete amount in one action.
- Warehouse issue queue remains useful for recovery/operational oversight, but is no longer mandatory for routine full-stock Team-Warehouse receipt.
- No SQL/schema; no Purchase/PO start; Patch 110 consumption/return semantics remain unchanged.

### Patch 115 — Warehouse shortage clarity + Purchase handoff (2026-09-19)
- This slice starts the already-planned Purchase handoff only after explicit user approval; it does not create a parallel purchasing engine.
- Warehouse card preserves the full task context while making the action quantity the **shortage only**: task need, Team-Warehouse snapshot, shortage request, remaining coverage, and live Main-Warehouse availability are shown separately.
- If Main Warehouse can cover the whole remaining shortage, PM V2 opens the existing Warehouse Transfer workflow for that whole shortage. New PM V2 handoffs do not default to partial Main→Team transfers.
- If Main Warehouse cannot cover the whole shortage, PM V2 opens the existing Purchase Order page with the same Catalog item and a minimum purchase quantity equal to the currently uncovered amount. Buying more is allowed; only the PM V2 shortage portion is linked back through `pmv2_material_purchase_links`.
- Purchase approval, vendor, receiving, confirmed warehouse receipt, Inventory entry, and audit remain owned by the existing Purchase/Receiving workflows. PM V2 stores source links only.
- A shortage-routed full task need does not reappear as a ready issue/receipt card until the shortage has physically reached the Team Warehouse (`issued_to_team`).
- No SQL/schema change is required; the frozen purchase-link table already exists.
