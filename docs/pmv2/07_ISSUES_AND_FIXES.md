# المشاكل والمخاطر الفنية — PM V2

> هذا الملف يحتفظ فقط بالمشاكل التي تؤثر على التصميم/التنفيذ الحالي. المشاكل التصميمية القديمة المغلقة لا تبقى كخطة بديلة.

## ISSUE-001 — خطر Duplicate Master Data — CLOSED

- **المشكلة:** احتمال إنشاء مواقع/Users/Warehouses/Catalog موازية داخل PM V2.
- **Root Cause:** تصميم أولي قبل Existing Capability Audit.
- **الحل:** PM V2 تستخدم Master Data الحالية عبر Adapters. Targets = Site/Section/Asset.
- **منع التكرار:** Existing Capability Audit إلزامي قبل أي Master table جديد.

## ISSUE-002 — التباس Section / Department / Specialty — CLOSED

- **المشكلة:** `sections` مكانية، و`users.department` وصف نصي، وTicket departments خاصة بالبلاغات.
- **الحل:** Organization = `Specialty → Team → Members`; `sections` Targets مكانية فقط؛ Department Metadata وصفي فقط.

## ISSUE-003 — Users Specialty Schema Drift — CLOSED FOR PM V2

- **المشكلة:** إشارات تاريخية لحقول Specialty على Users لا تطابق Schema الحية.
- **الحل:** PM V2 لا تعتمد عليها؛ تستخدم `users.id` فقط، وSpecialty مملوكة لـPM V2.
- **ملاحظة:** أي Cleanup عام لـUsers schema خارج نطاق PM V2 ولا يمنع التنفيذ.

## ISSUE-004 — خطر Coupling مع الوحدات الحالية — CLOSED DESIGN

- **الحل:** Users/Target/Warehouse/Inventory/Ticket/Purchase/Notification/File Adapters إلزامية.

## ISSUE-005 — هوية Material Recipient مع Team Device — CLOSED/FROZEN

- **المشكلة:** Session device لا يثبت من استلم المادة فعليًا.
- **الحل:** PM V2 لا تختار Recipient مسبقًا. Workflow المستودع الحالي يثبت المنفذ والمستلم الحقيقي وقت التسليم.
- **Legacy:** Name-only records لا تعمل لها Backfill تلقائي.

## ISSUE-006 — شراء PM V2 لا يجب أن يعتمد على Ticket/Path B Source — CLOSED/FROZEN

- **المشكلة:** ربط شراء PM V2 بBridge Ticket يخلق بلاغًا وهميًا ويخلط Source semantics.
- **الحل:** `pmv2_material_purchase_links` تربط Material Request Item مباشرة بـPO/PO Item. PO نفسه عادي ويستخدم Workflow الحالي.

## ISSUE-007 — عطل كبير أثناء الفحص الدوري — CLOSED/FROZEN

- **المشكلة:** تضخم PM V2 بمسارات Corrective/External maintenance جديدة.
- **الحل:** خيار `needs_ticket` يفتح Ticket حقيقي؛ Ticket Workflow الحالي يحدد A/B/C بلا تغيير.

## ISSUE-008 — تضخم حالات الانتظار — CLOSED/FROZEN

- **المشكلة:** تكرار حالات Warehouse/PO/Ticket داخل Task يؤدي لتعقيد وتعارض Source of Truth.
- **الحل:** PM V2 تستخدم حالات داخلية بسيطة، وتعرض التفاصيل الخارجية من الأنظمة المالكة عبر Adapters.

## ISSUE-009 — Runtime dependencies غير متاحة في بيئة التنفيذ — OPEN / BLOCKS PHASE 1 GATE ONLY

- **المشكلة:** نسخة العمل الحالية لا تحتوي `node_modules`؛ لذلك Full Vitest/Typecheck لم يكتمل بعد بدء كود PM V2.
- **Root Cause:** الحزمة المرفقة لا تشمل runtime dependencies المحلية.
- **الأثر:** لا يمنع تجهيز Patch أو SQL اليدوي، لكنه يمنع إغلاق Acceptance Gate للمرحلة 1.
- **الحل الحالي:** نجحت اختبارات PM V2 المستقلة 63/63، وStandalone Phase 1 Gate 6/6، وفحص Syntax/relative imports. تمت إعادة محاولة `npm ci --ignore-scripts --no-audit --no-fund` ولم تكتمل في بيئة العمل؛ Full Vitest/Typecheck/Build يبقى مطلوبًا قبل Gate.
- **منع التكرار:** لا يوصف أي Phase برمجية بأنها PASS اعتمادًا على static inspection فقط.


## ISSUE-010 — TiDB CHECK constraints معطلة — MITIGATED / ACCEPTED BASELINE

- **المشكلة:** DDL لـ`pmv2_checklist_items` أعاد ستة تحذيرات `tidb_enable_check_constraint is off`، لذلك شروط `CHECK` المكتوبة في الأمر ليست حماية فعلية في البيئة الحالية.
- **Root Cause:** ميزة `CHECK` في TiDB تتحكم بها قيمة GLOBAL، والبيئة الحالية تشغلها على OFF.
- **الخطر:** الاعتماد على `CHECK` في التوثيق أو Drizzle بينما لا ينشئها TiDB يعطي إحساسًا زائفًا بسلامة البيانات.
- **الحل:** عدم تغيير الإعداد العام؛ إزالة `CHECK` من baseline التنفيذي وDrizzle، وإنشاء `validatePmv2ChecklistItemWrite()` كتحقق إلزامي على write boundary.
- **الاختبار:** Node test مستقل يثبت رفض القيم الست غير الصحيحة = PASS (5 اختبارات / 5 ناجحة).
- **منع التكرار:** أي Domain invariant جديد في PM V2 لا يعتمد على خاصية DB معطلة؛ يجب إثبات آلية enforcement الحقيقية واختبارها قبل Gate.
- **Residual Risk:** أي كتابة يدوية مباشرة إلى DB خارج خدمات PM V2 يمكن أن تتجاوز هذه range validations؛ هذا مقبول كحد تشغيلي حاليًا ولا يبرر تغيير إعداد GLOBAL دون Regression/UAT مستقل.

## ISSUE-011 — Duplicate checklist item order accepted — FIXED IN PATCH 051 / DB HARDENING PENDING CLEANUP

- **المشكلة:** الاختبار اليدوي سمح بإضافة بندين فعالين داخل نفس قائمة الصيانة بنفس `sortOrder = 4`، كما سمح بتكرار بند متطابق بالكامل.
- **Root Cause:** تحقق بند القائمة كان يتحقق من النطاقات والتكرار فقط، بدون مقارنة البنود الفعالة الأخرى داخل نفس القائمة.
- **الحل البرمجي:** إضافة `assertPmv2ChecklistItemLogicalUniqueness()` وربطها بكل Create/Update/Reactivation لبنود القائمة.
- **القواعد المعتمدة:**
  - `sortOrder` فريد بين البنود **الفعالة** داخل نفس القائمة.
  - العنوان وحده **ليس فريدًا**؛ يمكن تكراره إذا اختلف معنى التكرار.
  - يمنع البند المتطابق بالكامل إذا تطابق العنوان بعد التطبيع + نوع التكرار + الفترة + يوم الأسبوع/الشهر + تاريخ الارتكاز.
  - تحقق التعارض البرمجي يبقى على البنود **الفعالة** حفاظًا على توافق السجلات القديمة وإعادة التفعيل.
  - ابتداءً من Patch 074، واجهة المدير لا تطلب `sortOrder` يدويًا؛ الإنشاء العادي يأخذ تلقائيًا الرقم التالي بعد أعلى ترتيب موجود داخل القائمة، بما في ذلك البنود المعطلة، حتى لا يعاد استخدام رقم ظاهر/تاريخي بصمت.
- **حماية DB:** لم تُضف بعد لأن قاعدة الاختبار تحتوي فعليًا على بيانات تاريخية من اختبارات سابقة، وUnique بسيط على `(checklistId, sortOrder)` لا يعبر كامل سلوك Soft Disable/legacy. Patch 074 لا يحتاج SQL؛ الحماية الحالية تبقى عند Service boundary.
- **الاختبار:** Regression جديد 5/5 PASS؛ PM V2 standalone suite بعد الإصلاح = **79/79 PASS**.


## UX-077 — custom recurrence still required interpretation after Patch 076
- **Observed:** during manual annual recurrence acceptance, the manager still had to interpret the separate label **فترة التكرار** before understanding the schedule.
- **Decision:** reduce the custom builder to a natural sentence plus one execution-date question.
- **Fix:** Patch 077 shows **يتكرر الفحص كل [رقم] [وحدة]**, a live **النتيجة**, and then **متى يتم التنفيذ؟**.
- **Scope:** presentation only; recurrence storage/engine semantics unchanged; no SQL.


## ISSUE-012 — Completed carry-over Task hidden before explicit Visit end — FIXED IN PATCH 111 / MANUAL RETEST PENDING

- **Observed:** during the real Patch 110 PRIMA flow, completing the last Item on prior Task `PMV2-20260914-P5-T13` correctly set the Task to `completed`, but the technician feed immediately removed it while the Visit still had no `endedAt`. The Leader therefore lost the normal **إنهاء الزيارة** action.
- **Root Cause:** `listTodayTasks()` retained prior Tasks only while `status != completed`; it did not preserve the distinct state `Task completed + Visit still open`.
- **Fix:** keep a completed prior Task in the feed when an open `pmv2_visits` row exists for it. Preserve the existing explicit Leader-only Visit-end mutation and remove the Task from the feed after `endedAt` is written.
- **UX:** no new screen or workflow branch. A short cue explains that all Items are complete but the Visit remains open, followed by the existing **إنهاء الزيارة** button for the Leader.
- **Safety:** no Task reopening, no auto-close, no due-date mutation, no SQL/schema, no Inventory/Purchase/Legacy PM change.
- **Automated verification:** targeted regression **53/53 PASS**; broad PM V2 source-contract run keeps the same **18 baseline failures** as the untouched project (Patch 111 adds 3 passing tests, no new failure signature); changed TS/TSX syntax transpile **2/2 PASS**. Manual runtime retest remains required.


## ISSUE-013 — بحث مادة الفني كان خطوتين وغير بديهي — FIXED IN PATCH 112

- **المشكلة:** شاشة **تحتاج مواد** كانت تفصل بين حقل البحث و`select` مستقل؛ الفني يكتب الاسم/الكود ثم يحتاج أن يعرف أنه يجب فتح قائمة ثانية لرؤية النتائج. الاختبار اليدوي أثبت أن هذا السلوك مربك حتى مع بيانات صحيحة.
- **الحل:** دمج البحث والاختيار في `searchable combobox` واحد. الضغط يفتح نفس عنصر الاختيار، والكتابة تستدعي بحث Catalog الحالي وتعرض النتائج مباشرة.
- **عرض النتيجة:** اسم المادة + الكود التشغيلي + رصيد مخزن الفريق/الوحدة + حالة الحجب (`مطلوب بالفعل` / `جاهز للصرف`) عند الحاجة.
- **سلامة النطاق:** لا تغيير في API أو routing أو Inventory أو Material Request rules؛ مسار المادة غير المدرجة يبقى منفصلًا ولا ينشئ Master Data.
- **الاختبار:** Patch 112 + Step 4.1 focused = **39/39 PASS**؛ broad PM V2 = **258/276 PASS مع نفس 18 baseline failures**؛ TSX syntax transpile = **1/1 PASS**.

## ISSUE-014 — Technician material attention could be buried in a large task feed — FIXED IN PATCH 134

**Observed risk:** the material state existed in PM V2 but a technician with many tasks could miss a material that was waiting, newly resolved, or ready for Team-Warehouse receipt because the information lived inside individual task cards.

**Fix:** Patch 134 adds a persistent **مواد تحتاج انتباهك** projection above the task list, scoped to the requesting technician and prioritized by actionability. It reuses the existing receipt path and does not create a parallel Inventory workflow.

## ISSUE-015 — Resolved material could bypass duplicate UX and stale shortage stayed visible — FIXED IN PATCH 135

**Observed risk:** an originally unlisted material could later receive a Catalog identity from the warehouse while the technician duplicate guard still looked only at the direct request Catalog ID. The technician attention card could also continue showing the original shortage after part/all of that shortage had already been transferred into Team Warehouse.

**Fix:** Patch 135 includes `identityResolution.resolvedCatalogItemId` in active duplicate blocking and derives current remaining shortage from confirmed Team-Warehouse issue/transfer progress. The original shortage remains visible as historical context, not as the current outstanding quantity.

## 2026-09-24 — Warehouse request page was operationally scattered — PATCH136

**Observed:** `/scheduled-maintenance/warehouse-requests` contained the correct information and actions, but ready issue, returns, waiting requests, warehouse identity/count cards, and the architecture notice were presented in an order that made the operator scan several large sections before reaching the action-required shortage queue.

**Fix:** presentation-only reorganization. Waiting/action-required requests now appear first after one compact work summary; ready issue and returns follow; the existing architecture notice remains visible after operational work. Request-card data is grouped by quantities, inventory/destination, details/status, linked purchases, and action.

**Non-change:** no information, action, status, recovery path, API, stock mutation, shortage calculation, Purchase logic, or schema was removed or changed.

## Patch 137 — Warehouse page still showed too much at once after Patch 136

**Observed issue:** Patch 136 organized the warehouse page into a clear vertical sequence, but all three operational queues and every card body were still simultaneously visible. With real workload volume, the operator would still need to scan a long page even though no information could be removed.

**Fix:** keep all existing content but change the presentation to progressive disclosure:
- exactly three operational tabs: **تحتاج معالجة / جاهزة للصرف / المرتجعات**;
- one operational section visible at a time;
- cards collapsed by default with their existing identity/status header still visible;
- full legacy information/actions revealed only when the operator opens the card details.

**Boundary:** UI organization only. No warehouse/Purchase/Inventory business rule changed.

## Patch 138 — البند الجاهز بعد المواد لا يستطيع الاستكمال بعد إنهاء زيارة اليوم

**المشكلة:** Item يصل إلى `ready_to_complete` بعد صرف المواد، لكن إذا كانت Visit الأصلية قد انتهت فإن `submitBasicResult` يتطلب Visit مفتوحة بينما `startItem` يسمح فقط بـ`pending`.

**الإصلاح:** إضافة `resumeItem` داخل PM V2 فقط: يعيد استخدام Visit مفتوحة أو ينشئ Visit على نفس Task، يسجل `resume_execution`، وينقل Item إلى `in_progress` مع الاحتفاظ بسياق `needs_material`. الإكمال اللاحق يستخدم نفس Material Settlement الحالي.

## Patch 138 — لا توجد رؤية موحدة لأين قضت المهمة وقتها ومن عنده الإجراء الآن

**المشكلة:** البيانات كانت موزعة بين PM V2، Material Requests، Purchase، Tickets وAudit History، فلم توجد قراءة PM V2 موحدة للمسؤول الحالي والزمن.

**الإصلاح:** `timeline-service.ts` طبقة read-only تشتق Timeline وCurrent Responsibility وStage Durations من مصادر الحقيقة القائمة. لا تنسخ State Machine ولا تكتب في الأنظمة الخارجية، ولا تصف مدة بأنها "تأخير" قبل اعتماد SLA.

## PATCH139 — Gap closed: management could not see where PM V2 work was currently stuck

**Before:** PATCH138 exposed responsibility/time history to the technician but Scheduled Maintenance management did not show current blocker, role/person, elapsed responsibility or SLA.

**Fix:** PATCH139 reuses the same Timeline engine through a management-only read path, adds owner aggregation, optional SLA rules and deduplicated alerts.

**Guardrails:** no external workflow write; no lateness label without configured SLA; no invented responsible person.
