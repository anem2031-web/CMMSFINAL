# PM V2 — مركز التوثيق الرسمي

> **AUTHORITATIVE CURRENT CHECKPOINT — 2026-09-24:** PATCH134 and PATCH135 are now documented. PATCH134 adds persistent technician material attention above the task feed; PATCH135 hardens resolved-identity duplicate protection and exposes original vs current remaining shortage using confirmed warehouse/Team supply progress. No SQL/schema change. Focused Patches 114/115/131/134/135 = **39/39 PASS**; broad PM V2 after PATCH135 = **322/341 PASS with the same 19 baseline failures**. Production build/check remains **NOT VERIFIED in this execution environment** because dependencies were unavailable. Phase 4 remains **IN PROGRESS**.


> **AUTHORITATIVE CURRENT CHECKPOINT — 2026-09-22:** Phase 0–3 = **CLOSED / PASS**. Phase 4 = **IN PROGRESS**. The standalone **الصرف المخزني المتعدد (WIS)** capability delivered through Patches 124–129 is now **CLOSED / PASS** after live runtime acceptance, including successful issue `WIS-2026-000004` and final print verification. The four existing single-issue screens remain unchanged by decision. **Next Phase 4 focus:** resolve Unlisted / non-Catalog material identity and reroute it using live stock before closing Phase 4. See `PHASE4_WIS_MULTI_ISSUE_CLOSURE_2026-09-22.md`.

> **الحالة الرسمية:** Phase 0 — **CLOSED / PASS** بتاريخ 2026-09-06.  
> **المرحلة 1:** **CLOSED / PASS** بتاريخ 2026-09-08.  
> **المرحلة 2:** **CLOSED / PASS** — final acceptance بتاريخ 2026-09-12.  
> **المرحلة 3:** **CLOSED / PASS** — final acceptance بعد Patch 093 بتاريخ 2026-09-13.  
> **المرحلة 4:** **IN PROGRESS** — **Step 4.1 = CLOSED / PASS**؛ **Step 4.2A = CLOSED / PASS بعد Patch 103**؛ **Step 4.2B = CLOSED / PASS بعد Patch 108 بتاريخ 2026-09-16**؛ **Team-Warehouse Issue/Delivery linkage = CODE IMPLEMENTED / MANUAL ACCEPTANCE PENDING بعد Patch 109**. changed-stock recheck فقط = SKIPPED/ACCEPTED؛ partial-shortage runtime case = PASS.  
> **إفصاح القبول:** اختبار انضمام فني ثانٍ لنفس Visit يدويًا = SKIPPED/ACCEPTED بقرار المستخدم؛ فحص Mobile/Tablet اليدوي = DEFERRED إلى القبول النهائي للبرنامج (Phase 6)، وليس PASS.  
> **PM V2 Code:** Foundation + Organization + current Master Data adapters (`users/warehouses/sites/sections/assets`) منفذة Additive داخل Namespace مستقل.  
> **PM V2 DB:** DB Steps 1–18 = PASS يدويًا بواسطة المستخدم؛ Schema المرحلة 1 مكتمل.
> **الخطة التنفيذية الرسمية:** 6 مراحل فقط حسب `01_PLAN.md`؛ التقسيم السابق إلى 15 مرحلة لم يعد مستخدمًا.

## 1. القرار المعماري النهائي

**PM V2 وحدة مستقلة معماريًا داخل نفس برنامج CMMS**، وتتكامل مع القدرات الحالية عبر Adapters، ولا تكرر Master Data ولا تغيّر Workflows القائمة لكي تناسبها.

PM V2 تملك منطق الصيانة الدورية فقط، بينما تعيد استخدام:

- `users`
- `sites / sections / assets`
- `warehouses`
- `catalog_items`
- Inventory / Lots / Transactions / QR
- Ticket Workflow الحالي ومسارات A/B/C
- Purchase Orders / Purchase Packages / Receiving / Delivery الحالية

## 2. العقود المجمدة في Phase 0

- Organization: `Specialty → Team → Members`.
- Maintenance Targets: `Site | Section | Asset`، وكل Target له نوع واحد فقط.
- المكان المستهدف مستقل عن Specialty/Team المنفذ.
- نتائج الفني: `سليم | تم الإصلاح | تحتاج مواد | تحتاج بلاغ صيانة`.
- Task Item states: `pending | in_progress | waiting_material | waiting_ticket | ready_to_complete | completed`.
- Task states: `pending | in_progress | waiting_material | waiting_ticket | ready_to_complete | completed | cancelled`، وهي مشتقة من Task Items ما عدا الإلغاء الإداري.
- Material Request Item states: `waiting_warehouse | external_purchase | received_warehouse | issued_to_team | consumed | cancelled`.
- البلاغ الناتج من PM V2 هو Ticket حقيقي ويكمل نفس Workflow الحالي A/B/C بدون أي تغيير.
- الشراء الناتج من PM V2 هو Purchase Order عادي بالكامل بنفس Workflow ووظائف الشراء الحالية.
- Source Link للشراء: `pmv2_material_purchase_links`.
- Source Link للبلاغ: `pmv2_task_ticket_links`.
- Material recipient يحدده المستودع وقت التسليم الفعلي؛ Team Device ليس Recipient ثابتًا.
- Final ERD: `15_FINAL_ERD_FREEZE.md`.

## 3. قواعد التنفيذ الملزمة

- لا يبدأ التنفيذ البرمجي إلا بأمر صريح: **«نفذ الآن»**.
- إذا قال المستخدم **«أجب عليا»**: نقاش فقط، بلا تعديل.
- أي DB write: يرسل SQL واحد للمستخدم، ينفذه يدويًا ويرسل النتيجة.
- بعد كل خطوة تنفيذية يحدث التوثيق.
- أي تغيير ملفات يسلم Patch ZIP صغيرًا بنفس هيكل المشروع.
- Legacy PM Cleanup خارج نطاق بناء PM V2 حتى الاستقرار والإطلاق.

## 4. ترتيب القراءة الرسمي

1. `README.md`
2. `00_WORKING_RULES.md`
3. `06_IMPLEMENTATION_STATUS.md`
4. `14_HANDOFF_CHECKPOINT.md`
5. `08_DECISIONS.md`
6. `12_EXISTING_CAPABILITY_AUDIT.md`
7. `13_PHASE0_DESIGN_FREEZE.md`
8. `15_FINAL_ERD_FREEZE.md`
9. `09_TESTING.md`
10. بقية الملفات عند الحاجة.

## 5. فهرس الملفات

| الملف | الغرض |
|---|---|
| `00_WORKING_RULES.md` | قواعد العمل الملزمة |
| `01_PLAN.md` | مراحل التنفيذ المعتمدة |
| `02_ARCHITECTURE.md` | حدود الوحدة والAdapters |
| `03_DATABASE.md` | Baseline Schema Contract |
| `04_WORKFLOWS.md` | التدفقات النهائية |
| `05_SCREENS.md` | تصميم الشاشات |
| `06_IMPLEMENTATION_STATUS.md` | الحالة التنفيذية الرسمية |
| `07_ISSUES_AND_FIXES.md` | المشاكل المغلقة والمخاطر الحالية |
| `08_DECISIONS.md` | القرارات النشطة فقط |
| `09_TESTING.md` | Acceptance Gates |
| `10_RELEASE_NOTES.md` | ملخص تغييرات التوثيق |
| `11_CHANGE_PACKAGE_PROTOCOL.md` | بروتوكول تسليم Patches |
| `12_EXISTING_CAPABILITY_AUDIT.md` | ما يعاد استخدامه من النظام الحالي |
| `13_PHASE0_DESIGN_FREEZE.md` | Design Freeze النهائي لـPhase 0 |
| `14_HANDOFF_CHECKPOINT.md` | نقطة الاستئناف الحالية |
| `15_FINAL_ERD_FREEZE.md` | ERD النهائي المجمد |
| `REFERENCE_FULL_TECHNICAL_DESIGN.md` | مرجع فني مجمع |
| `PATCH134_TECHNICIAN_MATERIAL_ATTENTION_2026-09-24.md` | توثيق PATCH134: سطح تنبيه المواد الدائم للفني |
| `PATCH135_MATERIAL_SHORTAGE_INTEGRITY_2026-09-24.md` | توثيق PATCH135: سلامة النقص والهوية المحلولة |
| `pending/PENDING_ITEMS.md` | طلبات «ذكرني لاحقًا» فقط |

## 6. نقطة الاستئناف الحالية

**Phase 0 = CLOSED / PASS. Phase 1 = CLOSED / PASS. Phase 2 = CLOSED / PASS. Phase 3 = CLOSED / PASS (final acceptance after Patch 093). Phase 4 = READY / NOT STARTED.**

تم تنفيذ Foundation scaffold، ونفذ المستخدم DB Steps 1–5 بنجاح، وتم تثبيت سياسة External References عمليًا:

- العلاقات داخل `pmv2_*` = Physical FK.
- `users/sites/sections/assets/warehouses` = External IDs بلا Physical FK.
- كل External ID يحتاج Index مناسب في جدول PM V2 الذي يحفظه.
- Adapter validation إلزامي عند الكتابة/التعديل قبل حفظ المرجع.
- القراءة مسموح أن تستخدم JOIN مباشرًا داخل نفس قاعدة البيانات؛ عدم وجود FK لا يمنع JOIN.

**نقطة التوقف الحالية:** DB Steps 1–18 = PASS، واكتمل Schema المرحلة 1، وتم إغلاق Phase 1 = `CLOSED / PASS` على نطاق PM V2. أعطال الاختبارات العامة خارج PM V2 موثقة في `pending/PENDING_ITEMS.md` كـ`PEND-001`. Phase 2 = `CLOSED / PASS`. Phase 3 = `IN PROGRESS`؛ Step 3.1 وStep 3.2 = `CLOSED / PASS`، وStep 3.3 للنتائج الأساسية الأربع = `CLOSED / PASS`، وStep 3.4 إنهاء الزيارة = `CLOSED / PASS` بعد Patch 090. بقية نطاق Phase 3 لم تُغلق بعد، والتكاملات الخارجية Material/Ticket تبقى Phase 4.


### Current execution checkpoint — 2026-09-13

DB Steps 1–18 are confirmed PASS. Phase 1 is CLOSED / PASS for PM V2. Project-wide non-PMV2 test baseline failures are tracked separately as PEND-001. Phase 2 final hardening/acceptance (Patches 067–079) is complete and Phase 2 is CLOSED / PASS. Two optional manual recurrence runtime checks were explicitly skipped by user decision and are recorded as SKIPPED, not PASS. Phase 3 is IN PROGRESS: Step 3.1 and Step 3.2 are CLOSED / PASS; Step 3.3 basic outcomes `ok | fixed | needs_material | needs_ticket` are CLOSED / PASS; Step 3.4 Visit ending is CLOSED / PASS after Patch 090 manual UI + live DB + Audit acceptance. External Material/Ticket integration remains Phase 4, while remaining Phase 3 core work is still not closed.


## Phase 1 checkpoint — 2026-09-08 — Step 12 PASS / Step 13 READY

- DB Steps 1–12 = PASS.
- DB Step 13 `pmv2_material_requests` = READY only.
- Material Request Header has no independent status; user/warehouse references remain external indexed IDs.


## Phase 1 checkpoint — 2026-09-08 — Step 13 PASS / Step 14 READY

- DB Steps 1–13 = PASS.
- DB Step 14 `pmv2_material_request_items` = READY only.
- `catalogItemId` remains an indexed External Reference; no duplicate Catalog Master Data or external FK.
- Quantity range rules are enforced at the PM V2 write boundary in the current TiDB environment.
- No Inventory/Purchase runtime behavior is activated by this schema step.


## Phase 1 checkpoint — 2026-09-08 — Step 14 PASS / Step 15 READY

- DB Steps 1–14 = PASS.
- DB Step 15 `pmv2_material_purchase_links` = READY only.
- Purchase Order/Item/User references remain indexed External References without physical FKs.
- PM V2 stores only the source link and linked quantity; PO status/workflow remain owned by the existing Purchase module.
- Quantity allocation invariants are enforced at the PM V2 write boundary in the current TiDB environment.


## Phase 1 checkpoint — 2026-09-08 — Step 15 PASS / Step 16 READY

- DB Steps 1–15 = PASS.
- DB Step 16 `pmv2_task_ticket_links` = READY only.
- Ticket/User references remain indexed External References without physical FKs.
- PM V2 stores only the source link; Ticket status/path and A/B/C workflow remain owned by the current Ticket module.


## Phase 1 checkpoint — 2026-09-08 — Step 16 PASS / Step 17 READY

- DB Steps 1–16 = PASS.
- DB Step 17 `pmv2_material_usages` = READY only.
- Material Usage is trace/audit only; it never decrements stock directly.
- Existing Inventory/Delivery/Warehouse/Catalog/PO Item/User records remain indexed External References with Adapter validation.
- Runtime Inventory/consumption behavior remains Phase 4.


## Phase 1 checkpoint — 2026-09-08 — Step 17 PASS / Step 18 READY

- DB Steps 1–17 = PASS.
- DB Step 18 `pmv2_request_reminders` = READY only; it is the last PM V2-owned table in the frozen ERD.
- Existing `notifications` table/service and Web Push path are reused; PM V2 does not create a parallel notification workflow.
- Reminder table is trace/source metadata only. Notification scheduling/sending behavior remains Phase 5.
- After DB Step 18 runtime confirmation, move to the Phase 1 Acceptance Gate; do not start Phase 2 automatically.


## Phase 1 gate checkpoint — 2026-09-08

- DB Steps 1–18 = PASS.
- Standalone PM V2 Node tests = 63/63 PASS.
- Standalone Phase 1 acceptance gate = 6/6 PASS.
- Syntax/relative-import-path check = PASS.
- No PM V2 patch changed Legacy PM/Ticket/Purchase/Inventory workflow source files.
- Full-project Vitest was later run and its non-PMV2 failures were isolated as `PEND-001`; Production build completed.
- **Historical Phase 1 gate result (superseded): Phase 1 = CLOSED / PASS; at that time Phase 2 = READY / NOT STARTED. Current status is Phase 2 = CLOSED / PASS; Phase 3 = READY / NOT STARTED.**

### Patch 059 note
Historical task items now carry/display recurrence provenance. Apply the single manual PM V2 `pmv2_task_items` ALTER from `drizzle/2026_09_09_pmv2_task_item_recurrence_snapshot.sql` before applying code that reads/writes the new snapshot columns.


## Phase 3 started — Patch 081 — 2026-09-13
- Step 3.1 = technician read foundation only (`مهامي اليوم`).
- Server access requires the existing `technician` role plus active membership in the Task team.
- No execution-state mutation/Visit/Item Action yet. No SQL.


## آخر checkpoint — Patch 082
- Step 3.1 (**مهامي اليوم** read-only + active team-membership security) = CLOSED / PASS.
- Phase 3 remains IN PROGRESS; Visits/result submission/state mutations have not started.
- No SQL in Patch 082.

## آخر checkpoint — Patch 083
- Phase 2 = CLOSED / PASS; Step 3.1 = CLOSED / PASS.
- Phase 3 Step 3.2 **Start Execution** = code-ready / manual runtime acceptance pending.
- Pending Task Item can be started by an active assigned technician; the write opens/reuses one Visit, records Leader/Member, moves Item/Task to `in_progress`, and records Item Action + Audit atomically.
- No result choices, Visit end, material/ticket/purchase/inventory flow, or task closure yet.
- No SQL in Patch 083.


## آخر checkpoint — Patch 084
- Phase 2 = CLOSED / PASS; Phase 3 = IN PROGRESS.
- Step 3.1 **مهامي اليوم** = CLOSED / PASS.
- Step 3.2 **Start Execution** = CLOSED / PASS after manual UI + live DB acceptance.
- One open Visit, Leader registration, two `start_execution` Item Actions, and matching Audit rows were verified.
- Different-teammate join was not separately manually exercised; focused automated coverage remains for that branch.
- Result choices, Visit ending, and task completion remain NOT STARTED.
- No SQL and no runtime code in Patch 084.


## آخر checkpoint — Patch 085
- Phase 2 = CLOSED / PASS; Phase 3 = IN PROGRESS.
- Step 3.1 and Step 3.2 = CLOSED / PASS.
- Step 3.3 has started with the dependency-free `ok/fixed` slice only: in-progress Item → completed, optional note, Item Action + Audit, and Task cached status completes only when all Items are completed.
- `needs_material`, `needs_ticket`, attachments/images, Visit ending, Inventory/Purchase/Ticket integrations remain NOT STARTED.
- No SQL in Patch 085. Focused Phase 3 regression = **23/23 PASS**; changed-source syntax transpile = **3/3 PASS**. Manual runtime acceptance is pending.


## آخر checkpoint — Patch 086
- Phase 2 = CLOSED / PASS; Phase 3 = IN PROGRESS.
- Step 3.1 and Step 3.2 = CLOSED / PASS.
- Step 3.3 basic `ok/fixed` slice = **CLOSED / PASS** after manual UI + live DB + Audit acceptance.
- Task `PMV2-20260913-P5-T13`: Item `437` accepted as `ok` with saved note; Item `438` accepted as `fixed` with saved note; Task completed at `2/2`.
- DB confirmed `submit_result` Item Actions and `pmv2.item_result_submitted` Audit rows for both Items by technician `19110028`.
- Step 3.3 overall remains IN PROGRESS because `needs_material` and `needs_ticket` are NOT STARTED; Visit ending also remains outside the accepted slice.
- Patch 086 is documentation-only. No SQL and no runtime code.


## آخر checkpoint — Patch 087
- Phase 2 = CLOSED / PASS; Phase 3 = IN PROGRESS.
- Step 3.1 and Step 3.2 = CLOSED / PASS; Step 3.3A `ok/fixed` = CLOSED / PASS.
- Step 3.3B is code-ready: technician can record `needs_material` or `needs_ticket` on an `in_progress` Item, producing `waiting_material` or `waiting_ticket` with note/Item Action/Audit.
- Mixed Task projection priority is **waiting_material > waiting_ticket**; unrelated Items remain executable while a dependency is pending.
- No real Material Request/Ticket/Inventory/Purchase action is created yet; those remain Phase 4. Visit ending remains NOT STARTED.
- No SQL. Focused Phase 3 regression = **34/34 PASS**; changed TS/TSX syntax = **3/3 PASS**. Manual runtime acceptance pending.

## آخر checkpoint — Patch 088
- Phase 2 = CLOSED / PASS; Phase 3 = IN PROGRESS.
- Step 3.1 and Step 3.2 = CLOSED / PASS.
- Step 3.3 basic outcomes (`ok | fixed | needs_material | needs_ticket`) = **CLOSED / PASS** after manual UI + live DB + Audit acceptance.
- Fresh acceptance Task `PMV2-20260913-P6-T14`: Item `439` accepted as `needs_material / waiting_material`; Item `440` remained executable and was accepted as `needs_ticket / waiting_ticket`.
- Mixed Task projection remained `waiting_material`, confirming priority **waiting_material > waiting_ticket**.
- No real Material Request/Ticket/Inventory/Purchase action was created; those external integrations remain Phase 4. Visit ending and remaining Phase 3 core work are still pending.
- Patch 088 is documentation-only. No SQL and no runtime code.



## آخر checkpoint — Patch 089
- Phase 2 = CLOSED / PASS; Phase 3 = IN PROGRESS.
- Steps 3.1, 3.2, and Step 3.3 basic Core outcomes are CLOSED / PASS.
- Step 3.4 **Visit ending** = CODE-READY / MANUAL RUNTIME ACCEPTANCE PENDING.
- Only the open Visit Leader may end the Visit; active Team membership is rechecked, and ending is blocked while any Item is `in_progress`.
- Successful end sets Visit `endedAt` + Audit only; it does not close or rewrite the Task/Items.
- No SQL and no Material/Ticket/Inventory/Purchase integration.
- Focused Phase 3 tests = 43/43 PASS; changed TS/TSX syntax = 5/5 PASS.
- Next action: deploy Patch 089 and run the first manual Visit-end UI test only.


## آخر checkpoint — Patch 090
- Phase 2 = CLOSED / PASS; Phase 3 = IN PROGRESS.
- Steps 3.1, 3.2, Step 3.3 basic outcomes, and Step 3.4 **Visit ending** = CLOSED / PASS.
- Manual UI acceptance on Task `PMV2-20260913-P6-T14` confirmed the Leader ended the open Visit while Task/Item dependency states remained unchanged.
- Live DB confirmed Visit `2` / Task `105`: `startedAt = 2026-09-13 10:59:05`, `endedAt = 2026-09-13 11:42:05`.
- Audit confirmed row `7235645`: `pmv2.visit_ended`, entity `pmv2.visit` / `2`, user `19110028`.
- Patch 090 is documentation-only. No SQL and no runtime code.
- Remaining Phase 3 core scope must be reviewed before the next implementation step; do not start Phase 4 Material/Ticket integration here.


## آخر checkpoint — Patch 091
- Phase 2 = CLOSED / PASS; Phase 3 = IN PROGRESS.
- Steps 3.1, 3.2, Step 3.3 basic outcomes, and Step 3.4 Visit ending = CLOSED / PASS.
- Step 3.5 optional execution images/evidence = CODE-READY / MANUAL RUNTIME ACCEPTANCE PENDING.
- Reuses existing `attachments` + `/api/upload`; evidence attaches to `pmv2_item_action` (Item Action ID), with no PM V2 attachment table and no SQL.
- Technician reads require active Task-Team membership; writes additionally require the technician's own Item Action and an open Visit. PM V2 managers may read for review.
- UI shows **إضافة صورة / دليل** only when an upload target is valid and renders evidence thumbnails across Item Actions.
- No Task/Item state changes and no Material/Ticket/Inventory/Purchase integration. Focused Phase 3 regression = **53/53 PASS**; syntax = **6/6 PASS**.


## آخر checkpoint — Patch 092
- Phase 2 = CLOSED / PASS; Phase 3 = IN PROGRESS.
- Steps 3.1–3.5 = **CLOSED / PASS**.
- Step 3.5 manual acceptance confirmed optional execution image upload, thumbnail persistence after refresh, DB attachment registration on `pmv2_item_action`, post-Visit read-only behavior, and `add_attachment` Audit.
- Acceptance evidence: attachment `3000641` → Item Action `3` → Task Item `437`, uploaded by technician `19110028`.
- Patch 092 is documentation-only. No SQL and no runtime code.
- Next continuation point: review remaining Phase 3 Core stabilization / acceptance gate; do not start Phase 4 integrations automatically.

## آخر checkpoint — Patch 093
- **Phase 3 = CLOSED / PASS (final acceptance).** Steps 3.1–3.5 are closed/pass on their accepted Core scopes.
- Different-active-teammate same-Visit join: dedicated manual runtime test is **SKIPPED / ACCEPTED** by explicit user decision; automated Step 3.2 coverage remains the evidence and is not relabeled manual PASS.
- Mobile/Tablet manual responsive-layout verification is **DEFERRED TO FINAL PROGRAM ACCEPTANCE (Phase 6)** by explicit user decision; it is not PASS.
- Patch 093 is documentation-only. No SQL and no runtime behavior change.
- **Next:** Phase 4 = READY / NOT STARTED. Review Phase 4 first; do not execute it automatically.


## آخر checkpoint — Patch 094
- Phase 0–3 = CLOSED / PASS; **Phase 4 = IN PROGRESS**.
- Step 4.1 material intake = **CODE-READY / MANUAL RUNTIME ACCEPTANCE PENDING**.
- On `waiting_material / needs_material`, technician can select current Catalog item + quantity + unit.
- Team Warehouse availability is read-only and Lot-aware. Full availability creates no PM V2 request and hands off to existing Inventory/Delivery; shortage creates request rows for the missing quantity only with `waiting_warehouse`.
- No direct Stock mutation, Warehouse Transfer, PO, Ticket, Legacy PM change, or SQL.
- Step 4.1 focused tests = 15/15 PASS; combined Phase 3 regression + Step 4.1 = 68/68 PASS; syntax = 6/6 PASS.
- Next action: apply Patch 094 and run only the first material-panel UI check on Task `PMV2-20260913-P6-T14` / Item `439`.


## آخر checkpoint — Patch 095
- Phase 0–3 = CLOSED / PASS; **Phase 4 = IN PROGRESS**.
- Step 4.1 remains **CODE-READY / MANUAL RUNTIME ACCEPTANCE PENDING**.
- Material selector now shows Team Warehouse balance beside each Catalog item and selected material shows **المطلوب / المتاح / الناقص** before submit.
- Technician may state a total need larger than local stock; PM V2 requests only the shortage. This is not an over-issue: actual stock issue remains in existing Inventory/Delivery and is limited by actual stock/QR/Lot rules.
- Server rechecks availability at submit; no stock reservation/mutation, Warehouse Transfer, PO, Ticket integration, Legacy PM change, or SQL.
- Existing manual evidence confirms the zero-stock shortage route for Item `439` / Catalog `300042` / Request `#1`; post-Patch-095 balance-preview acceptance is still pending.
- Step 4.1 focused tests = **18/18 PASS**; combined Phase 3 regression + Step 4.1 = **71/71 PASS**; changed TS/TSX syntax = **5/5 PASS**.
- Next manual action: select Catalog Item `300042` on the existing `waiting_material` Item and verify balance `0` plus requested/available/shortage preview. Do not submit a duplicate request.


## آخر checkpoint — Patch 096
- Phase 0–3 = CLOSED / PASS; **Phase 4 = IN PROGRESS**.
- Step 4.1 remains **CODE-READY / MANUAL RUNTIME ACCEPTANCE PENDING**.
- Fixed exact-today-only technician visibility: today's Tasks plus previous non-final Tasks are now shown; previous completed/cancelled Tasks are not carried forward.
- Original `dueDate` remains unchanged, and UI separates **مهام اليوم** / **مهام سابقة مفتوحة** with due date visible.
- This fix changes visibility only; active Team authorization and Step 4.1 material routing remain unchanged. No SQL or Stock mutation.
- Automated: Step 4.1 = **21/21 PASS**; Phase 3 regression + Step 4.1 = **74/74 PASS**; syntax checks = PASS.
- Next manual action: after applying Patch 096, verify `PMV2-20260913-P6-T14` appears on 2026-09-14 under **مهام سابقة مفتوحة** as `بانتظار المواد`; do not submit another Request.


## آخر checkpoint — Patch 097
- Phase 0–3 = CLOSED / PASS; **Phase 4 = IN PROGRESS**.
- Step 4.1 remains **CODE-READY / MANUAL ACCEPTANCE PENDING**.
- Added technician fallback **مادة غير موجودة في الدليل**: free-text name + quantity + unit, persisted with `catalogItemId = NULL` and `itemNameSnapshot` using the existing schema.
- PM V2 does not create Catalog Master Data and does not guess stock for an unlisted item; the full need goes to `waiting_warehouse` for warehouse/Catalog resolution.
- Existing Catalog balance/shortage behavior remains unchanged. No SQL, no Stock mutation, Transfer, PO, Ticket, or Legacy PM change.
- Automated: Step 4.1 = **26/26 PASS**; Phase 3 regression + Step 4.1 = **79/79 PASS**; syntax = **3/3 PASS**.
- Next manual action: open **مادة غير موجودة في الدليل** on a `waiting_material` Item and confirm the free-text form appears; do not submit on the first check.

## آخر checkpoint — Patch 098
- Phase 0–3 = CLOSED / PASS; **Phase 4 = IN PROGRESS**.
- Step 4.1 remains **CODE-READY / MANUAL ACCEPTANCE PENDING**.
- After successful Material Request creation, the populated intake form now clears/collapses and the saved request remains visible.
- **إضافة مادة أخرى** explicitly opens a clean form for another distinct material. Active Catalog duplicates are marked **مطلوب بالفعل** and disabled; active unlisted duplicates are warned/blocked by normalized name, with server-side duplicate rejection still authoritative.
- No SQL, Stock mutation, Transfer, PO, Ticket, or Legacy PM change.
- Automated: Step 4.1 **29/29 PASS**; Phase 3 regression + Step 4.1 **82/82 PASS**.
- Next manual action: confirm the existing requests are visible with the old input form collapsed; do not submit another duplicate request.



## آخر checkpoint — Patch 099
- Phase 0–3 = CLOSED / PASS; **Phase 4 = IN PROGRESS**.
- Step 4.1 remains **CODE-READY / MANUAL ACCEPTANCE PENDING**.
- Fractional quantities are now rejected for countable units such as `قطعة/حبة/علبة/لفة/كيس/وحدة` by one shared UI/server policy; divisible/unknown measurement units remain decimal-capable.
- The UI blocks invalid submit and the server independently rejects it before inventory routing or Material Request creation.
- No SQL, Stock mutation, Transfer, PO, Ticket, or Legacy PM change.
- Automated: Step 4.1 **32/32 PASS**; Phase 3 regression + Step 4.1 **85/85 PASS**; syntax **3/3 PASS**.
- Next manual action: with the stocked pen (`قطعة`), enter `2.5` and verify the whole-number validation message and blocked submit.


## آخر checkpoint — Patch 100
- Step 4.1 still open / manual acceptance pending.
- Full Team-Warehouse availability is persisted as `pmv2_item_actions.action = material_route_decision`, not as stock mutation or reservation.
- Technician UI collapses after a successful full-stock check and shows **جاهز للصرف من مخزن الفريق** with a recheck action.
- Manual evidence before this patch already proved PRIMA pen stock `5`, request `2`, shortage `0`, no PM V2 Material Request, and no stock change.
- Automated: Step 4.1 **35/35 PASS**; combined Phase 3 + Step 4.1 **88/88 PASS**; syntax **2/2 PASS**.


## آخر checkpoint — Patch 101
- Phase 0–3 = CLOSED / PASS؛ Phase 4 = IN PROGRESS.
- **Step 4.1 material intake = CLOSED / PASS.** Manual acceptance شمل shortage request، balance preview، carry-over، unlisted material، duplicate guards، post-submit reset، count-unit validation، full-stock no-request route، persistent **جاهز للصرف من مخزن الفريق** بعد Refresh، وrecheck مع رصيد لم يتغير.
- changed-stock recheck بعد ready decision + dedicated partial-shortage runtime case = **SKIPPED / ACCEPTED by user decision**، وليس manual PASS.
- Automated evidence retained: Step 4.1 35/35؛ combined Phase 3 + Step 4.1 88/88؛ syntax 2/2. لا إعادة لاختبارات Phase 2.
- **Step 4.2 reviewed / READY / NOT STARTED.** Warehouse Transfer الحالي (`inventory.transfers.createBatch`) يبقى Source of Truth مع QR/Lot/stock/audit الحالية.
- أول Slice مقترح لاحقًا: Warehouse `waiting_warehouse` queue + read-only Main-Warehouse availability decision؛ لا Transfer write ولا PO حتى أمر تنفيذ صريح لاحق.
- Patch 101 documentation-only؛ لا SQL ولا Runtime behavior change.


## آخر checkpoint — Patch 102
- Phase 0–3 = CLOSED / PASS؛ Phase 4 = IN PROGRESS.
- Step 4.1 = CLOSED / PASS؛ **Step 4.2A warehouse queue = CODE-READY / MANUAL ACCEPTANCE PENDING**.
- Added `/scheduled-maintenance/warehouse-requests` for `warehouse | owner | admin`, listing only `waiting_warehouse` requests.
- Main Warehouse is resolved dynamically as exactly one active `type=main`; known materials use current Lot-aware Inventory availability, while unlisted and integrity exceptions are explicit.
- Read-only only: no Warehouse Transfer/PO/status/stock/Ticket/Legacy PM write and no SQL.
- Automated: Step 4.2A 15/15؛ combined Phase 3 + Step 4.1 + Step 4.2A 103/103؛ syntax 14/14.
- Next manual action: warehouse user opens **الصيانة المجدولة → طلبات مواد PM V2** and confirms queue + availability; no transfer yet.

## آخر checkpoint — Patch 103
- Step 4.2A warehouse queue functional manual acceptance = **CLOSED / PASS**.
- Warehouse request cards for listed materials now use the Catalog's real **كود الصنف** and full **التصنيف** path from the Catalog tree; internal `catalogItemId` is no longer shown as `Catalog #...`.
- Unlisted materials remain explicit and receive no invented code/category.
- No SQL, Transfer, PO, stock/status mutation, Ticket, or Legacy PM change.
- Automated: Step 4.2A **18/18 PASS**; combined Phase 3 + Step 4.1 + Step 4.2A **106/106 PASS**; targeted syntax **3/3 PASS**.
- Next manual action: verify one known listed request displays **كود الصنف + التصنيف** and no internal Catalog ID; do not transfer yet.

## آخر checkpoint — Patch 104
- Patch 103 visual smoke = **PASS**: كود الصنف `0032-2-1-7` + التصنيف ظهر، و`Catalog #300042` اختفى من واجهة المستخدم.
- **Step 4.2A = CLOSED / PASS. Step 4.2B = READY / NOT STARTED.**
- عقد 4.2B موثق قبل التنفيذ: التحويل من Main Warehouse إلى Team Warehouse يتم فقط عبر Warehouse Transfer الحالي، ويسمح بالتحويل الجزئي، وتبقى الكمية الناقصة على نفس Material Request Item.
- PM V2 لا يحسب كمية موردة إلا بعد نجاح Transfer حقيقي؛ يمكن جمع عدة Transfers لنفس الاحتياج.
- الشراء/PO/Receiving مؤجل بعد 4.2B.
- قاعدة الشراء المستقبلية: عجز PM V2 هو الكمية المرتبطة بالمهمة فقط؛ إذا تم شراء أكثر منها فالزيادة مخزون عام ولا تنسب للمهمة.
- Patch 104 documentation-only؛ لا SQL ولا Runtime behavior change.


## آخر checkpoint — Patch 105
- **Step 4.2B = CODE-READY / MANUAL ACCEPTANCE PENDING.**
- Warehouse queue now works from the outstanding PM V2 quantity and can start **بدء تحويل المتاح** only after a fresh server recheck.
- Physical stock movement remains entirely in the existing Warehouse Transfer workflow with its QR/Lot/stock/audit rules; PM V2 does not create Transfer/Inventory mutations.
- Successful transfer numbers are validated via a read-only adapter and traced as `material_transfer_linked`; PM V2 recomputes `issuedToTeamQuantity` from unique real Transfers. Partial stays `waiting_warehouse`; full becomes `issued_to_team`.
- Same-request relink is idempotent; a Transfer cannot satisfy another PM V2 request. After physical movement, the stale handoff is frozen and a fresh queue recheck is required before another transfer. Link failure recovery retries PM V2 linking only.
- Purchase/PO/Receiving remains deferred. No SQL/schema/new transfer-link table.
- Automated: Step 4.2B **25/25**; combined focused regression **131/131**; changed TS/TSX syntax **7/7**.
- Next manual action: identify one listed `waiting_warehouse` need with positive Main-Warehouse balance and confirm the queue shows the expected **بدء تحويل المتاح** values. Do not execute the Transfer in that first check.

### Deferred material-picker UX after Step 4.2B
A documentation-only follow-up is recorded for the technician material selector: smart default materials (Team-Warehouse stock / evidence-backed relevance), full Catalog search by name/code, and operator-facing code + taxonomy + balance. Specialty filtering is not inferred; it requires explicit Master Data mapping. Step 4.2B is now CLOSED/PASS; this UX follow-up remains deferred.


## آخر checkpoint — Patch 107
- أثناء الاختبار اليدوي لـ4.2B ثبت أن النقص الجزئي يعمل: احتياج المهمة `6`، المتاح في Team Warehouse `5`، فأنشئ طلب Main للناقص `1` فقط.
- بطاقة المستودع كانت تسمي `1` باسم **المطلوب الأصلي**؛ تم تصحيح المعنى بدل تغيير منطق الكمية.
- البطاقة الآن تعرض: **احتياج المهمة / المتاح في مخزن الفريق وقت الطلب / المطلوب من المستودع الرئيسي / المتبقي للتحويل**، مع الرصيد الحالي في الرئيسي ومخزن الهدف.
- البيانات التاريخية تأتي من Snapshot `material_route_decision` الموجود أصلًا؛ لا SQL/schema جديد.
- Positive Main queue check = PASS (`89` متاح، `1` قابل للتحويل). Physical Transfer ما زال pending.
- Automated: Step 4.2B **25/25**؛ combined focused regression **131/131**.


## آخر checkpoint — Patch 108
- **Step 4.2B = CLOSED / PASS** بعد Warehouse Transfer حقيقي وربط DB نهائي ناجح.
- Batch/header = `TRB-2026-090001`; PM V2-linked transfer row = `TRF-2026-090001`; Lot = `LOT-2026-00315`; quantity = `1`.
- تحقق DB النهائي: `linkedQuantity=1`, `requestedQuantity=1`, `issuedToTeamQuantity=1`, `status=issued_to_team`.
- `TRB` و`TRF` ليسا رقمين بديلين لنفس الحقل: الأول للعملية المجمعة، والثاني لصف التحويل الذي يربطه PM V2.
- لا Runtime/SQL/schema change في Patch 108، ولم يبدأ Purchase/PO/Receiving.


## آخر checkpoint — Patch 109
- Phase 4 continues after 4.2B with **Team-Warehouse Issue/Delivery linkage = CODE IMPLEMENTED / MANUAL ACCEPTANCE PENDING**.
- Existing Inventory `تسليم للفني` remains the physical stock owner; PM V2 context is optional and links only a confirmed Delivery into `pmv2_material_usages`.
- Full task need is tracked independently from shortage request quantity; mixed original-Team-stock + request-supplied deliveries are split in trace so request attribution cannot exceed the shortage actually supplied.
- Real usage completion can move the Task Item to `ready_to_complete`; technician resume/Follow-up Visit remains Phase 5 and has not started.
- No SQL/schema and no Purchase/PO/Receiving in Patch 109. Automated: **27/27 focused**, **158/158 combined focused**, **7/7 syntax**.

## Current Team-Warehouse receipt behavior — Patch 114

For listed materials, PM V2 now treats the Team Warehouse as immediately receivable operating stock for active technicians on the same Team:

- full remaining need available → technician **استلام المواد من مخزن الفريق** → confirmation → authoritative Inventory/Delivery issue to that technician;
- shortage exists → **تسجيل الاحتياج وطلب النقص** → only the shortage is requested → no default partial issue;
- after shortage replenishment makes the full remaining need available → the technician task itself exposes **جاهز للاستلام من مخزن الفريق** and the same receipt action.

PM V2 still does not own stock mutation or Lot accounting. Issue, Lot allocation, Delivery documents, and cost attribution stay in the existing inventory workflow; Patch 110 actual-use and Pending Return behavior remains unchanged.

## Current Main-Warehouse shortage behavior — Patch 115

For a shortage-routed need, the warehouse now works on the shortage rather than the full technician need:
- card shows full task need + Team-Warehouse snapshot + shortage + remaining shortage + live Main stock;
- Main covers the whole shortage → existing Warehouse Transfer moves the whole shortage to Team Warehouse;
- Main does not cover it → existing Purchase workflow is opened for only the uncovered quantity; PM V2 links only the shortage portion and any overbuy is general stock;
- confirmed Purchase Receiving and current Inventory remain authoritative; PM V2 does not create a second PO/Receiving system;
- after the shortage reaches Team Warehouse, Patch 114 technician self-service receives the full task need.

No SQL/schema change is introduced by Patch 115.

## Current Purchase recovery behavior — Patch 119

A PM V2 shortage Purchase no longer treats an old PM V2 unit snapshot as Master Data. If the Catalog Item has an active Catalog Unit relationship, Purchase uses it; otherwise the buyer selects an active unit manually for that Purchase Item only. If the Purchase Order was created but PM V2 linking failed, the existing Purchase Order Detail exposes **ربط / إعادة ربط PM V2** and links the existing PO Item idempotently without creating another order.


## آخر checkpoint — 2026-09-22 — WIS multi-issue CLOSED / PASS

- **الصرف المخزني المتعدد (WIS)** أُغلق رسميًا بعد قبول Runtime حتى Patch 129.
- الشاشات الأربع الحالية تبقى للصرف الفردي كما هي؛ WIS مخصص للصرف المتعدد فقط ويتطلب بندين على الأقل.
- تكرار نفس Lot مسموح فقط عند اختلاف الموقع/القسم/الأصل، مع منع التكرار المطابق ومنع تجاوز مجموع الكميات للرصيد.
- Runtime success: `WIS-2026-000004`; final print verification completed.
- Phase 4 نفسها ما تزال **IN PROGRESS**. التالي: Unlisted / non-Catalog material resolution.
- التفاصيل: `PHASE4_WIS_MULTI_ISSUE_CLOSURE_2026-09-22.md`.

## آخر checkpoint — Patch 136 — تنظيم صفحة طلبات المستودع

- `/scheduled-maintenance/warehouse-requests` أعيد تنظيمها بصريًا فقط؛ لم تُحذف أي معلومة أو وظيفة.
- الترتيب الحالي: **ملخص عمل المستودع → طلبات تحتاج معالجة → جاهز للصرف → مرتجعات → ملاحظة حدود PM V2**.
- بطاقة الطلب تجمع نفس البيانات الحالية تحت: **الكميات / المخزون والوجهة / تفاصيل الطلب والحالة / الإجراء** مع بقاء روابط الشراء والحالات التفسيرية.
- لا تغيير في حساب النقص أو Identity Resolution أو Warehouse Transfer أو Purchase أو Inventory/Delivery أو Returns، ولا SQL/schema.
- Automated: Patches 134/135/136 **20/20 PASS**؛ TSX syntax **PASS**. Build الكامل يحتاج بيئة المشروع ذات الاعتماديات.
- التفاصيل: `PATCH136_WAREHOUSE_QUEUE_ORGANIZATION_2026-09-24.md`.

## آخر checkpoint — Patch 137 — تبويبات المستودع والتفاصيل التدريجية

- صفحة `/scheduled-maintenance/warehouse-requests` تعرض الآن فئة عمل واحدة فقط في كل مرة عبر: **تحتاج معالجة / جاهزة للصرف / المرتجعات**.
- التبويب الافتراضي هو **تحتاج معالجة**، مع بقاء العدد الحي لكل فئة ظاهرًا على التبويبات.
- كل بطاقة تبقى مختصرة افتراضيًا؛ التفاصيل الكاملة والإجراءات السابقة تظهر عبر **عرض التفاصيل والإجراء / الصرف / الاستلام** ثم يمكن طيها عبر **إخفاء التفاصيل**.
- **لم تُحذف أي معلومة أو وظيفة** من Patch 136: الملخص، حالات النقص، بيانات المخزون، روابط الشراء، التحويل، الصرف، إعادة ربط السند، Lots، المستلم، المرتجعات، وملاحظة حدود PM V2 كلها محفوظة.
- لا Backend/API/business-logic/SQL/schema change.
- Automated focused Patches 134/135/136/137: **27/27 PASS**؛ TSX syntax **PASS**؛ broad PM V2 **336/355 PASS, 19 fail** مقابل Patch 136 **329/348 PASS, 19 fail** مع نفس أسماء الإخفاقات وبدون فشل جديد.
- التفاصيل: `PATCH137_WAREHOUSE_TABS_PROGRESSIVE_DETAILS_2026-09-24.md`.

## آخر checkpoint — Patch 138 — استكمال نفس المهمة ومسار المسؤولية الزمني

- Item العائد من انتظار المواد (`ready_to_complete + needs_material`) أصبح يملك **استكمال العمل**؛ الاستكمال يفتح/يعيد استخدام Visit على **نفس Task** ولا ينشئ مهمة جديدة.
- يسجل PM V2 `resume_execution` ثم يبقى مسار الاستخدام/المرتجع والإكمال الحالي كما هو.
- أضيف **مسار المهمة والزمن**: أين المهمة الآن، الجهة صاحبة الإجراء، الشخص المعيّن عندما يوفّره النظام المصدر، منذ متى، ومدد المراحل.
- Purchase/Ticket/Inventory/Accounting/Management تبقى مصادر الحقيقة؛ Timeline يقرأها فقط ولا يعدل Workflow الخاص بها.
- المدد لا تسمى تأخيرًا قبل SLA معتمد.
- لا SQL/schema. Automated: Patch138 **9/9**؛ focused **99/99**؛ broad **345/364, 19 fail** مع نفس الـ19 الموجودة في baseline و**0 failure جديد**؛ syntax **PASS**.
- التفاصيل: `PATCH138_TASK_CONTINUATION_TIMELINE_2026-09-26.md`.

### PATCH139 — Management monitoring / owner / SLA / alerts

PATCH139 adds the PM V2 management layer above PATCH138 Timeline: **متابعة المعلق**, owner indicators, explicit per-role SLA/reminder settings, and deduplicated PM V2 alerts through the existing notification system. It requires the PM V2-only migration `drizzle/2026_09_26_pmv2_monitoring_sla_alerts.sql`. See `PATCH139_MANAGEMENT_MONITORING_SLA_ALERTS_2026-09-26.md`.

### PATCH140 — تبسيط متابعة مدير الصيانة

واجهة **متابعة المعلق** أصبحت تبدأ بما يحتاج تدخل مدير الصيانة مباشرة، ثم بقية المهام تحت الإجراء. لم تُحذف معلومات PATCH139: سبب التعليق، المرحلة، المسؤول، المدة، عمر المهمة، SLA، Timeline، مؤشرات المالك، الفلاتر، إعدادات SLA والتنبيهات كلها محفوظة. التعديل واجهة PM V2 فقط ولا يحتاج SQL جديدًا. Automated: PATCH140 **6/6 PASS**؛ PATCH139+140 **16/16 PASS**؛ broad **361/380 PASS, 19 fail** بنفس الـ19 السابقة وبدون فشل جديد؛ TSX syntax **PASS**. التفاصيل: `PATCH140_MANAGER_PENDING_PRIORITY_UI_2026-09-26.md`.

### PATCH141 — تقارير الصيانة المجدولة

أضيفت صفحة مستقلة `/scheduled-maintenance/reports` لمدير الصيانة والمالك/الإدارة المخولة. التقرير يقارن مهام الفريق المجدولة لليوم بما تم تنفيذه، ويقسمها إلى **منجز / بدأ ومعلق / لم يبدأ / مرحل**، ويعرض ملاحظات الفني أمام كل مهمة، المشاركين، وقت الزيارة، والوضع الحالي للمهمة والمسؤول عنها مع فتح PATCH138 Timeline. اختيار فني لا ينشئ إسنادًا فرديًا وهميًا؛ يعرض مهام فريقه ومشاركته المسجلة فعليًا. لا SQL/schema ولا تغيير لأي Workflow خارجي. Automated: PATCH141 **7/7 PASS**؛ PATCH138–141 **32/32 PASS**؛ broad **368/387 PASS, 19 fail** مقابل PATCH140 **361/380 PASS, 19 fail** بنفس الإخفاقات و**0 new failures**.

### PATCH142 — مراجعة التقرير والمؤشرات الإدارية
أضيفت حالة **تمت المراجعة / لم تتم المراجعة** لتقرير الفريق اليومي مع اسم المراجع والوقت وملاحظة اختيارية، إضافة إلى مؤشرات PM V2 حسب التخصص والحالة ومتوسط زمن المسؤولية وإنجاز آخر 30 يومًا حسب الفريق والتخصص. يتطلب جدول PM V2 جديدًا فقط: `pmv2_daily_report_reviews`. قيم SLA لا تُفترض تلقائيًا وتبقى للضبط التشغيلي لاحقًا. التفاصيل: `PATCH142_REPORT_REVIEW_ADMIN_INDICATORS_2026-09-26.md`.

### PATCH143 — Smart material picker
تم إغلاق تحسين Material Picker المؤجل: قائمة الفني الافتراضية تبدأ بالمواد ذات الرصيد الفعلي في مخزن الفريق، ثم تستخدم فقط سجل الاستخدام الحقيقي لنفس الهدف/الفريق كدليل صلة، مع بقاء البحث الكامل في Catalog بالاسم/الكود وعرض مسار التصنيف والرصيد. لا SQL/schema ولا تعديل Workflow خارجي. Automated: **5/5 dedicated**, **114/114 focused**, broad **380/399** مع نفس 19 failure السابقة و0 جديد. التفاصيل: `PATCH143_SMART_MATERIAL_PICKER_2026-09-26.md`.
