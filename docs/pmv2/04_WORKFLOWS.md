# Workflows — PM V2

## 1. إعداد الهيكل

Specialty → Team → Members، مع Team Warehouse حالي.

## 2. إعداد الصيانة

Checklist → Checklist Items/Recurrence → Program → Targets (`Site|Section|Asset`) → Scheduler → Task/Task Items.

## 3. تنفيذ الفني

يفتح الفني البند ويختار أحد النتائج:

### سليم
يسجل النتيجة/الملاحظة إن وجدت → Task Item `completed`.

### تم الإصلاح
يسجل ما تم والإثبات المطلوب → Task Item `completed`.

### تحتاج مواد
ينتقل البند إلى `waiting_material` ويطبق Material flow.

### تحتاج بلاغ صيانة
تفتح نفس نافذة البلاغ الحالية → ينشأ Ticket ويربط عبر `pmv2_task_ticket_links` → Task Item `waiting_ticket`.

## 4. Material flow

### المادة موجودة في مخزن الفريق

تستخدم Inventory/Delivery service الحالية، ثم يكمل الفني الإصلاح. لا ينشأ Main Warehouse Material Request بلا حاجة.

من Patch 100، نجاح فحص التوفر الكامل يحفظ Domain Event باسم `material_route_decision` على Task Item نفسه، بحيث تظهر حالة **جاهز للصرف من مخزن الفريق** بعد Refresh. هذا الحدث ليس Stock reservation ولا Material Usage ولا يخصم المخزون؛ الصرف الحقيقي يبقى في Inventory/Delivery الحالي.

### المادة غير موجودة في مخزن الفريق

ينشأ Material Request/Items بحالة `waiting_warehouse`.

#### المستودع الرئيسي لديه المادة

**Step 4.2A / Patch 102:** قبل أي حركة فعلية، دور المستودع يرى طابور `waiting_warehouse` ويقرأ توفر المادة من Main Warehouse عبر Adapter الحالي فقط. القرار هنا read-only: `available / insufficient / unlisted` مع إيقاف آمن عند Catalog/Inventory identity أو unit mismatch. لا تغيير حالة ولا Stock mutation في هذا الـSlice.

بعد قبول Step 4.2A، Warehouse Transfer الحالي ينقل النقص إلى مخزن الفريق ويجعل Material Request Item `issued_to_team` عند اكتمال التحويل. **هذا وحده لا يجعل Task Item `ready_to_complete`**؛ يلزم بعده Issue/Delivery فعلي من Team Warehouse للمهمة وتسجيل `pmv2_material_usages`. التحويل الفعلي ليس جزءًا من Patch 102.

#### المستودع الرئيسي لا يملك المادة

Warehouse يبدأ PO عادي من مصدر PM V2 حسب الصلاحية المعتمدة → `external_purchase`.

PO يكمل دورة الشراء الحالية بالكامل. بعد الاستلام الفعلي في المستودع → `received_warehouse`. بعد النقل لمخزن الفريق → `issued_to_team`.

الاستخدام الفعلي أثناء الإصلاح يسجل عبر Inventory service الحالية → `consumed`.

## 5. Ticket flow

عند `needs_ticket`:

1. فتح نفس Ticket dialog الحالي.
2. إنشاء Ticket حقيقي مع Source Link إلى Task Item.
3. النظام الحالي يحدد A/B/C حسب قواعده الحالية.
4. PM V2 تعرض رقم/حالة البلاغ عبر TicketAdapter.
5. بعد إغلاق البلاغ المعتمد، يعود Task Item إلى `ready_to_complete` أو يكمل حسب Closure contract.

PM V2 لا تدير A/B/C ولا تنشئ Corrective Workflow موازٍ.

## 6. Task Item State Machine

`pending → in_progress`

ومن `in_progress`:

- `ok/fixed → completed`
- `needs_material → waiting_material → ready_to_complete → in_progress/completed`
- `needs_ticket → waiting_ticket → ready_to_complete → in_progress/completed`

## 7. Task State

Task status ملخص مشتق من Task Items:

- كلها pending → `pending`
- يوجد عمل جارٍ → `in_progress`
- توجد تبعية مواد → `waiting_material`
- توجد تبعية Ticket مفتوح → `waiting_ticket`
- التبعيات زالت وما زال إكمال فني مطلوبًا → `ready_to_complete`
- كل البنود مكتملة → `completed`
- `cancelled` إداري صريح

إذا توجد تبعيات متعددة، Domain service يطبق أولوية عرض ثابتة موثقة في التنفيذ؛ تفاصيل كل بند تبقى ظاهرة ولا تضيع في Task summary.

## 8. Visit / Follow-up

- Visit لا تغلق Task تلقائيًا.
- في Step 3.2 يوجد **Visit مفتوحة واحدة فقط لكل Task** داخل PM V2 write boundary؛ قفل صف المهمة داخل Transaction يمنع إنشاء زيارتين مفتوحتين بسبب بدء متزامن.
- أول فني فعال يبدأ بندًا `pending` ينشئ Visit ويُسجل Leader؛ عضو فعال آخر يبدأ بندًا أثناء نفس الزيارة ينضم كMember ولا ينشئ Visit ثانية.
- بداية التنفيذ تسجل Item Action باسم `start_execution` وتحوّل البند `pending → in_progress`، وتحوّل Task `pending → in_progress` عند أول بدء.
- في Patch 085، أول slice من Step 3.3 يسمح فقط لبند `in_progress` بنتيجتي `ok` أو `fixed`: يسجل `submit_result` + النتيجة + الملاحظة الاختيارية، ثم يحول البند إلى `completed`.
- بعد نتيجة `ok/fixed` يعاد حساب Cached Task status داخل نفس Transaction: إذا بقي أي Task Item غير مكتمل تبقى المهمة `in_progress`، وإذا اكتملت جميع البنود تصبح Task `completed`.
- Patch 085 لا ينهي Visit المفتوحة تلقائيًا؛ إنهاء Visit يبقى خطوة لاحقة مستقلة. كما أن `needs_material` و`needs_ticket` لا يتم تشغيلهما في هذا slice.
- Patch 087 يضيف Core-only `needs_material → waiting_material` و`needs_ticket → waiting_ticket` من بند `in_progress` مع نفس `submit_result`/Audit. لا ينشئ Material Request ولا Ticket حقيقيًا؛ التكامل الخارجي يبقى Phase 4.
- Cached Task projection بعد Patch 087: `completed` إذا اكتملت كل البنود؛ وإلا أولوية التبعيات `waiting_material` ثم `waiting_ticket`؛ ثم `in_progress` للعمل الجاري؛ ثم `ready_to_complete`. البنود الأخرى تبقى قابلة للتنفيذ أثناء حالة الانتظار.
- Patch 089 يضيف إنهاء الزيارة كعملية مستقلة: **قائد الزيارة الحالي فقط** يمكنه إنهاء الـVisit المفتوحة، مع إعادة التحقق من عضوية الفريق الفعالة داخل Transaction.
- لا يمكن إنهاء Visit بينما يوجد أي Task Item بحالة `in_progress`; يجب تسجيل نتيجة البند أولًا. البنود `pending` أو حالات الانتظار لا تمنع إنهاء الزيارة.
- إنهاء Visit يضبط `pmv2_visits.endedAt` ويسجل Audit باسم `pmv2.visit_ended`; لا يغير Task/Task Item status/result ولا يغلق Task تلقائيًا.
- الضغط المكرر بعد الإنهاء يرفض لأنه لا تعود توجد Visit مفتوحة.
- بعد إنهاء الزيارة، بدء بند `pending` لاحقًا يمكن أن يفتح Follow-up Visit جديدة لنفس Task وفق قاعدة الزيارة المفتوحة الواحدة.
- Patch 091 يضيف الصور/الأدلة الاختيارية دون جدول PM V2 جديد: سجل `attachments` يستخدم `entityType = pmv2_item_action` و`entityId = pmv2_item_actions.id`.
- الفني يستطيع رفع صورة فقط أثناء Visit مفتوحة، إلى Item Action نفذه هو بنفسه، وبعد إعادة التحقق من عضوية Team الفعالة. الأدلة السابقة تبقى للقراءة بعد انتهاء الزيارة.
- شاشة `مهامي اليوم` تجمع وتعرض أدلة البند عبر Item Actions التابعة له؛ رفع الصورة لا يغيّر Task/Task Item state/result ولا ينشئ Material Request أو Ticket.
- PM V2 managers يملكون قراءة أدلة `pmv2_item_action` للمراجعة، بينما الكتابة تبقى Technician execution فقط.
- إضافة الدليل تستخدم مسار الرفع وخدمة `attachments` الحالية وتحتفظ بسجل Audit الحالي `add_attachment`; لا يوجد Attachment storage موازٍ ولا SQL جديد.
- Leader/Members قد يختلفون حسب الحاجة والصلاحية.
- المهمة لا تغلق حتى تغلق جميع Task Items وشروطها الخارجية.

## 9. Closure

لا يغلق Task إذا يوجد:

- Task Item غير مكتمل.
- Material Request Item نشط غير محلول.
- Ticket مرتبط مفتوح.
- إصلاح/متابعة مطلوبة غير مكتملة.

## 10. Ownership

- PM V2: Task/Task Item/Material Request states والروابط.
- Warehouse: availability + transfer/delivery.
- Purchase system: PO lifecycle بالكامل.
- Ticket system: Ticket lifecycle وA/B/C بالكامل.
- Inventory system: stock/lots/transactions بالكامل.

## 4.2B — Warehouse Transfer handoff — CLOSED / PASS (Patch 108)

التدفق المنفذ:

1. Warehouse user يبدأ من **طلبات مواد PM V2** وليس من تخمين حركة مخزون مستقلة.
2. للمادة المعروفة، PM V2 يعرض المطلوب/المتبقي/المتاح ويحسب **القابل للتحويل الآن**.
3. إذا توجد كمية، يبدأ المستخدم **Warehouse Transfer الحالي** من Main Warehouse إلى Team Warehouse؛ QR/Lot/stock/audit والصلاحيات تبقى ملك Workflow الحالي.
4. يسمح بالتحويل الجزئي. مثال: المتبقي `10` والمتاح `6` → يحول `6` ويبقى `4` عجزًا على نفس Material Request Item.
5. PM V2 لا يزيد `issuedToTeamQuantity` ولا يعتبر الكمية موردة إلا بعد نجاح Transfer الحقيقي وربطه بالاحتياج. يمكن جمع عدة Transfers لنفس الاحتياج حتى اكتماله.
6. `0` متاح → لا Transfer. مادة غير موجودة في Catalog → لا Transfer قبل حل الهوية.
7. بقاء عجز يعني بقاء Material dependency فعالة؛ لا يعتبر Task Item جاهزًا فقط بسبب Transfer جزئي.

**مؤجل بعد 4.2B:** Purchase handoff للعجز و`pmv2_material_purchase_links` ومتابعة PO/Receiving. الصرف/الاستهلاك الفعلي من Team Warehouse نُفذ لاحقًا في Patch 109 كـPhase 4 integration slice مستقل.

**قاعدة الشراء المستقبلية:** PM V2 يربط فقط كمية العجز المطلوبة للمهمة. للمستودع أن يشتري كمية أكبر؛ الزيادة تصبح مخزونًا عامًا ولا تنسب للمهمة. مثال عجز `4` وشراء `20`: linked PM V2 quantity = `4`، general-stock excess = `16`.


### Patch 105 — التنفيذ الفعلي لـ4.2B

التدفق المنفذ الآن:

1. Warehouse Queue يحسب `remaining = requested - issuedToTeamQuantity` و`transferableNow = min(remaining, current Main availability)`.
2. عند **بدء تحويل المتاح** يعيد الخادم فحص الطلب، Catalog identity، Main Warehouse، Team Warehouse، unit، والرصيد؛ هذه الخطوة لا تكتب مخزونًا.
3. يفتح النظام Warehouse Transfer الحالي مع مصدر/هدف/Inventory/سقف كمية مرتبطة بسياق PM V2. QR/Lot و`transfers.createBatch` تبقى كما هي في النظام الحالي.
4. بعد نجاح `createBatch` تجمع الواجهة فقط `transferNumber` للصفوف الناجحة المرتبطة بالسياق وترسلها إلى PM V2.
5. PM V2 يقرأ Warehouse Transfer rows الحالية عبر Adapter read-only، ويتحقق من source/destination/Catalog/unit/quantity.
6. كل Transfer صالح وفريد يسجل `material_transfer_linked` في Item Actions، ثم يعاد حساب `issuedToTeamQuantity` من الروابط المؤكدة الفعلية. Partial => `waiting_warehouse`; full => `issued_to_team`.
7. إعادة نفس Transfer آمنة/idempotent؛ Transfer مرتبط بطلب آخر يرفض.
8. بعد حركة فعلية، نفس handoff context يتجمد حتى الرجوع للطابور وإعادة فحص المتبقي. إذا فشل PM V2 projection، تتم إعادة **الربط** فقط ولا تعاد حركة المخزون.

لا Purchase/PO/Receiving ولا consumption في Patch 105.


## Phase 4 — Team-Warehouse Issue/Delivery linkage — Patch 109

التدفق المنفذ، مع إبقاء الصرف الحالي Source of Truth:

1. Warehouse user يفتح **المخزون** على Team Warehouse ويختار الصنف المعتاد ثم **تسليم للفني**.
2. الواجهة تسأل اختياريًا هل الصرف مرتبط باحتياج PM V2 مطابق. PM V2 يعرض فقط Task Items `waiting_material + needs_material` التي تطابق نفس Warehouse/Catalog identity.
3. عند اختيار PM V2، Server يعيد فحص full task need، الاستخدام المسجل، الرصيد الحي، والفني المستلم كعضو Team نشط. لا Stock write يحدث في هذه الخطوة.
4. `db.issueDelivery` الحالي وحده ينفذ QR/Lot validation، خصم Lot + Aggregate Inventory، Inventory Transaction، cost attribution، وDelivery Document.
5. بعد نجاح Delivery فقط، PM V2 يقرأ المستند الحقيقي ويربطه في `pmv2_material_usages`. نفس Delivery لا يعاد احتسابه ولا ينسب إلى Task Item آخر.
6. إذا كان الاحتياج بدأ بمخزون فريق جزئي ثم أكملته Material Request، يمكن لسند صرف واحد أن ينقسم منطقيًا في Trace: الجزء المغطى من المخزون الأصلي يبقى `materialRequestItemId = NULL`، وجزء shortage فقط يرتبط بالـMaterial Request Item.
7. عند اكتمال الكمية المنسوبة للـMaterial Request بعد `issued_to_team` يصبح `consumed`. وعند اكتمال الاستخدام الحقيقي لكل احتياجات البند يصبح Task Item `ready_to_complete`.
8. نجاح Stock issue مع فشل PM V2 link لا يسمح بإعادة الحركة؛ الاسترداد هو **link-only retry**.

هذا Patch لا ينفذ عودة الفني من `ready_to_complete` ولا Follow-up Visit/closure؛ ذلك يبقى Phase 5. ولا ينفذ Purchase/PO/Receiving.

## Phase 4 — Programmatic Team-Warehouse issue, actual consumption, and return — Patch 110

Patch 110 supersedes the operator-matching UX introduced in Patch 109; the generic Inventory **تسليم للفني** screen no longer asks the warehouse user to choose a PM V2 task.

1. A persisted `material_route_decision` remains the PM V2 material requirement anchor. When the full remaining task need is available in the Team Warehouse, the PM V2 warehouse queue shows a **جاهز للصرف للمهمة** card.
2. The task, Task Item, Catalog Item, Team Warehouse, remaining quantity, beneficiary target, and Lot allocation are resolved server-side. The warehouse operator does not choose the PM V2 task or type the PM V2 issue quantity.
3. The material requester is preselected as the actual recipient when still an active technician on the same Team; the warehouse operator may choose another active technician on that Team. The PM V2 requirement/requester identity remains unchanged while the authoritative Delivery Document records the actual recipient/signatory name.
4. One logical PM V2 issue may produce more than one existing Delivery Document when the required quantity spans multiple Lots. Each physical part is posted through the existing `issueDelivery` workflow with its original Lot and issue-cost attribution; PM V2 only stores trace actions after the real Delivery exists.
5. If a physical Delivery succeeds but its PM V2 link fails, a `material_issue_link_pending` recovery marker is stored when possible. The queue blocks a new issue and exposes **re-link only** for the existing Delivery number; stock movement must not be repeated.
6. After all latest listed-material requirements are physically issued, the Task Item becomes `ready_to_complete`. **Issued does not mean consumed.**
7. On **تم الإصلاح**, the technician enters only the quantity actually used for each issued material. PM V2 stores `issued / used / toReturn`; no stock is returned at technician save time.
8. If `toReturn = 0`, actual usage is finalized immediately into `pmv2_material_usages`. If `toReturn > 0`, the Task Item may complete while a warehouse return remains pending.
9. For a pending return from one original Lot, that Lot is fixed automatically and warehouse confirmation is one action. For multiple original Lots, the warehouse user allocates the return only among those original issue Lots and may not exceed the returnable quantity per Lot.
10. Warehouse confirmation reuses the existing recipient-to-warehouse return workflow, restoring the exact original Lot at the original issue cost. Only after the real return is posted is final PM V2 consumption projected as `issued - returned`.
11. The current live recipient-return document quantity is integer-only. Patch 110 rejects a technician declaration that would create a fractional pending return rather than closing the task with an unpostable return. No schema widening is included in this patch.

No Purchase/PO/Receiving behavior is started by Patch 110, and no PM V2 stock balance is mutated directly.


## Technician explicit Visit closure visibility — Patch 111

Task completion and Visit closure remain intentionally separate:

1. Recording the final Task Item result may set the Task to `completed`.
2. A Visit is **not** auto-ended by Task completion; only the recorded Visit Leader may end it through the existing **إنهاء الزيارة** action.
3. If the completed Task is from a prior due date and still has an open Visit (`endedAt = NULL`), it remains visible in **مهامي اليوم** solely so the Visit can be closed.
4. The technician UI shows **اكتملت جميع البنود — الزيارة ما زالت مفتوحة**. The Leader is prompted to end the Visit when leaving the site; another Team member is told to wait for the Leader.
5. After the Leader ends the Visit, the feed refetch removes that completed prior Task naturally. No Task status rollback, artificial due-date change, or automatic Visit end is introduced.

Patch 111 is a PM V2 technician-feed/UX correction only. It does not alter the Patch 110 material issue/consumption/return accounting and starts no Purchase/PO/Receiving work.

## Phase 4 — Technician self-service receipt from Team Warehouse — Patch 114

Patch 114 simplifies the accepted Patch 110 issue boundary without moving stock ownership into PM V2:

1. For a listed material whose **full requested quantity is currently available** in the Team Warehouse, the technician sees **استلام المواد من مخزن الفريق** instead of a warehouse handoff action.
2. A small confirmation is required because this click represents the real physical receipt. After confirmation, PM V2 first persists the `material_route_decision`, then invokes the existing Inventory/Delivery issue workflow through the adapter with the logged-in technician as the actual recipient.
3. Lot selection remains server-side and automatic. One logical receipt may still post multiple authoritative Delivery Documents when more than one Lot is required.
4. If availability changed before confirmation and the full need is no longer available, **no partial issue is performed**. PM V2 creates a Material Request for the shortage only and leaves the original Team-Warehouse quantity untouched.
5. For a partial-stock case such as required `7`, Team Warehouse `5`, shortage `2`, the workflow is: record total need `7` → request only `2` from Main Warehouse → wait until Team Warehouse can cover the full remaining need → technician receives the full `7` in one receipt action.
6. After the shortage transfer is physically completed and the Team Warehouse can cover the full remaining need, the same technician task surface exposes **جاهز للاستلام من مخزن الفريق** and the receipt button. No extra warehouse issue approval is required for this routine Team-Warehouse case.
7. Self-service is limited by the existing technician guard plus active membership in the same PM V2 Team. The real Delivery Document records the technician as the actual receiver.
8. Existing retry safety remains: if a physical Delivery succeeds but PM V2 linking fails, the pending-link marker blocks a second stock issue and recovery remains link-only.
9. Actual consumption and pending return remain unchanged: receipt/issue is not consumption, and unused material returns to stock only after warehouse confirmation.

The PM V2 request service itself still performs no Inventory mutation. Patch 114 orchestrates the authoritative existing Inventory/Delivery boundary; no SQL/schema change and no Purchase/PO implementation is introduced.

## Phase 4 — Warehouse shortage completion and Purchase handoff — Patch 115

For a partial Team-Warehouse case such as task need `7`, Team stock `5`, shortage `2`:

1. Technician records the full need, but the PM V2 Material Request Item stores only shortage `2` in `waiting_warehouse`.
2. Warehouse queue displays the full operational context: **احتياج المهمة 7 / المتاح في مخزن الفريق وقت الطلب 5 / النقص المسجل 2 / المتبقي المطلوب تغطيته 2 / المتاح في الرئيسي الآن**.
3. While the shortage request is still `waiting_warehouse`, the original full need is hidden from ready issue/receipt projection so the warehouse is never asked to issue `7` from a `2`-unit shortage request.
4. If Main Warehouse currently has at least the full remaining shortage, warehouse chooses **تحويل النقص إلى مخزن الفريق**. `prepareTransferHandoff` rechecks server-side and rejects a new default partial PM V2 transfer when Main stock is still below the whole remaining shortage.
5. The existing Warehouse Transfer screen remains the stock owner. In PM V2 context, multiple Lot rows are allowed but their total must equal the whole handoff shortage before posting.
6. If Main Warehouse does not fully cover the shortage, PM V2 calculates only the uncovered amount after current Main stock and any still-pending linked purchase coverage, then opens the existing Purchase page through **إنشاء طلب شراء للعجز**.
7. PM V2 does not insert/update `purchase_orders` or `purchase_order_items`. After the existing Purchase workflow creates the authoritative PO Item, PM V2 stores a source link in `pmv2_material_purchase_links`, capped to the mission shortage; overbuy remains general stock.
8. Pending purchase coverage is reconciled against **confirmed Warehouse Receipt** quantity. A delivered-but-not-yet-entered item stays covered/pending; once a confirmed receipt enters stock, live Main-Warehouse Inventory becomes the authoritative available quantity.
9. After Main Warehouse can cover the full shortage, warehouse transfers that shortage to Team Warehouse. The Material Request Item reaches `issued_to_team`; then the technician receives the full task need from Team Warehouse through Patch 114 self-service.
10. Actual use and Pending Return remain Patch 110 behavior and are not changed here.

## Phase 4 — PM V2-linked Purchase single-item trace — Patch 117

Patch 117 tightens only the UI/payload boundary between the shortage handoff and the existing Purchase workflow:
1. Warehouse selects **إنشاء طلب شراء للعجز** for the uncovered shortage.
2. Purchase opens in **PM V2 linked mode** with a visible maintenance reference and the shortage context.
3. The request contains exactly one Catalog item: the material whose PM V2 shortage triggered the handoff. Its quantity is the exact uncovered shortage handed off at that time.
4. Unrelated items cannot be appended to this PM V2-linked request. General-stock/multi-item purchasing continues through the normal Purchase entry path.
5. Purchase approvals, PO issuance, receiving, and stock entry are unchanged and remain authoritative in the existing Purchase modules.
6. After creation, PM V2 links only that authoritative PO Item and resumes the Patch 115 → Warehouse Transfer → Patch 114 technician-receipt flow when stock becomes available.

This supersedes the earlier Patch 115 allowance to overbuy/add general-stock items inside the PM V2-launched Purchase request; it does not change ordinary Purchase behavior.

## PM V2 Purchase unit fallback and link recovery — Patch 119

After a shortage opens the existing Purchase workflow:
1. If the Catalog Item resolves to an active Catalog Unit, that unit is prefilled/locked.
2. If the Catalog Item has no active Catalog Unit relationship, the Purchase unit remains an explicit buyer selection from active units; PM V2 snapshot text is context only.
3. The selected unit is stored only on the existing Purchase Item. PM V2 does not update Catalog/Master Data.
4. After Purchase creation, PM V2 links the authoritative PO Item. If this link fails after the Purchase row already exists, recovery is performed from that Purchase Order Detail using the existing PM V2 request/item reference.
5. Recovery calls link-only/idempotent logic; it must not create another Purchase Order or repeat the Purchase workflow.

## Phase 4 — Persistent technician material attention — Patch 134

1. Material routing/requests continue through the existing Patch 114+ material flow.
2. Independently of the position of the original task card, the requesting technician receives a persistent **مواد تحتاج انتباهك** projection for active material dependencies.
3. Attention state is derived from the current route/request/ready-receipt evidence: waiting identity, waiting warehouse, waiting purchase, waiting transfer, ready but blocked, or ready to receive.
4. **Ready to receive** is sorted first. The technician may open the task or invoke the existing Team-Warehouse self-service receipt after confirmation.
5. When an unlisted material is resolved, its earlier route-decision record remains historical evidence but is not shown as a second active attention item.
6. Consumed/cancelled/no-longer-actionable material leaves the attention surface; the list is not a permanent history log.

## Phase 4 — Material shortage integrity projection — Patch 135

1. The true shortage-routing rule remains unchanged: full Team stock → no Material Request; partial Team stock → request only `required - available`; zero Team stock → request the full need.
2. If an unlisted material is resolved later, live Team-Warehouse availability is rechecked by the existing identity-resolution flow and the same request is rerouted rather than creating a second requirement.
3. Technician duplicate blocking treats both direct Catalog identity and later resolved Catalog identity as active.
4. The original shortage is retained as routing history. Current remaining shortage for the attention surface is reduced only by quantity confirmed as issued/transferred into Team Warehouse.
5. Main-Warehouse receipt is displayed as progress but does not by itself complete the Team-Warehouse shortage.
6. When Team-Warehouse issued quantity covers the original shortage, current shortage becomes zero and the technician sees that the shortage has been completed to Team Warehouse; the existing ready-receipt rules then determine whether physical technician receipt can proceed.

## Patch 138 — استكمال نفس المهمة + مسار المسؤولية الزمني

### بعد انتظار المواد
`in_progress` → الفني يسجل `needs_material` → `waiting_material` → تنتهي زيارة اليوم طبيعيًا → المخزون/التحويل/الشراء يعمل في أنظمته الحالية → كل الاحتياج يصبح مصروفًا للفريق → `ready_to_complete` → الفني يضغط **استكمال العمل** → تُفتح/تعاد استخدام Visit على **نفس Task** → `in_progress + needs_material` → تسجيل الاستخدام/المرتجع → `completed + fixed`.

لا تنشأ Task جديدة ولا يُغيّر due date الأصلي. الزيارة الجديدة عند الحاجة هي جزء آخر من تاريخ نفس Task.

### المسؤولية
PM V2 يشتق الجهة صاحبة الإجراء من المصدر الحالي:
- warehouse material handling → المستودع؛
- Purchase `pending_review` → مدير الصيانة؛
- Purchase estimate/purchase item assigned → مندوب المشتريات (+ الاسم إذا كان `delegateId` موجودًا)؛
- Purchase accounting → الحسابات؛
- Purchase management → الإدارة العليا؛
- purchased/received stage needing warehouse action → المستودع؛
- materials ready → الفني/الفريق؛
- open Ticket → الدور/الشخص الذي يملكه حسب Ticket source-of-truth.

يسجل العرض المدة ولا يقرر "تأخير" قبل وجود SLA معتمد.

## PATCH139 — Management monitoring / SLA / notification flow

1. Existing PM V2 Task remains open.
2. PATCH138 Timeline derives the current responsibility from PM V2 plus read-only Purchase/Ticket source state.
3. PATCH139 management overview groups the task by current role/person and measures `since -> now`.
4. If no SLA exists for the role, status is **SLA غير محدد**; elapsed time is informational only.
5. If SLA exists, PM V2 classifies `within` or `overdue` from the current responsibility start.
6. If a concrete person owns the current action, PM V2 can send one deduplicated responsibility notification.
7. If reminder threshold is reached, PM V2 sends one deduplicated reminder for that responsibility stage.
8. If SLA is breached, PM V2 sends one deduplicated SLA alert to the responsible user (when present) and PM V2 management recipients.
9. External Purchase/Ticket/Inventory state is never updated by this monitoring flow.
