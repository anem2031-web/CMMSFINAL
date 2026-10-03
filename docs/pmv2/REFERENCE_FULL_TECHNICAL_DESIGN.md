# PM V2 — المرجع الفني المجمع

> **Baseline:** Phase 0 CLOSED/PASS — 2026-09-06.  
> **Current:** المرحلة 1 — تأسيس الوحدة وربط البيانات الأساسية — IN PROGRESS منذ 2026-09-07. DB Steps 1–5 = PASS؛ Organization + Target adapters/routes منفذة؛ DB Step 6 (`pmv2_programs`) جاهز وينتظر التنفيذ اليدوي.

## 1. Architecture

PM V2 Bounded Module داخل CMMS. لا تكرر Master Data ولا تغير Workflows الحالية. التكامل عبر Adapters.

## 2. Organization

`Specialty → Team → Members`

Team ترتبط بمخزن حالي، Members/Managers references إلى Users الحاليين.

## 3. Targets

`Site | Section | Asset`, Exactly One لكل Program Target. نفس Section يمكن أن يكون هدفًا لبرامج فرق مختلفة.

## 4. Checklist / Program / Scheduler

Reusable Checklist + item recurrence → Program(Team+Checklist+Targets) → Scheduler → Task per Program Target/Due date مع idempotency uniqueness.

## 5. Technician Workflow

لكل Task Item:

- سليم (`ok`).
- تم الإصلاح (`fixed`).
- تحتاج مواد (`needs_material`).
- تحتاج بلاغ صيانة (`needs_ticket`).

## 6. Task Item / Task States

Task Item:

`pending | in_progress | waiting_material | waiting_ticket | ready_to_complete | completed`

Task:

`pending | in_progress | waiting_material | waiting_ticket | ready_to_complete | completed | cancelled`

Task status مشتق من Task Items ولا يكرر PO/Ticket states.

## 7. Materials

إذا المادة موجودة بمخزن الفريق: Inventory flow الحالي.

إذا غير موجودة: Material Request للمستودع الرئيسي.

Material Request Item:

`waiting_warehouse | external_purchase | received_warehouse | issued_to_team | consumed | cancelled`

Header بلا Status مستقل.

## 8. Purchase

إذا المستودع الرئيسي لا يملك المادة:

`Material Request Item → pmv2_material_purchase_links → PO/PO Item`

PO عادي بالكامل بنفس numbering/approval/supplier/packages/receiving/inventory/delivery/audit/reporting الحالي.

لا تستخدم Ticket/Package source fields لحفظ Source identity الخاصة بـPM V2.

## 9. Ticket

عند `needs_ticket`:

`Task Item → pmv2_task_ticket_links → Ticket`

تفتح نفس نافذة البلاغ. Ticket system يحدد A/B/C ويكمل Workflow الحالي. PM V2 تقرأ الحالة/الإغلاق فقط.

## 10. Material Recipient

لا Recipient ثابت للTeam Device. المستودع يثبت المستلم الحقيقي وقت التسليم في Workflow الحالي.

## 11. Visits / Follow-up / Closure

Task لها Visits متعددة. Visit لا تغلق Task تلقائيًا. التبعيات الخارجية يجب أن تزول وتكتمل Task Items قبل الإغلاق النهائي.

## 12. Database

18 PM V2-owned tables كما في `15_FINAL_ERD_FREEZE.md`، وأهم روابط التكامل:

- `pmv2_material_purchase_links`
- `pmv2_task_ticket_links`
- `pmv2_material_usages`

Internal refs = FKs. Existing-system refs = logical external refs + Adapter validation في baseline.

## 13. Adapters

Users / MaintenanceTarget / Warehouse / Inventory / Ticket / Purchase / Notification / FileImage.

## 14. Security/Audit

المرحلة 1 تؤسس authorization/audit داخل PM V2 ضمن تأسيس الوحدة وربط البيانات الأساسية. أي صلاحية Warehouse لبدء PO من PM V2 تكون Scoped ومحمية Server-side، ولا توسع صلاحيات Purchase العامة تلقائيًا.

## 15. Testing

كل مرحلة لها Gate. Phase 0 Design Gate PASS. Runtime build/tests/regression مطلوبة من المرحلة التنفيذية 1 فصاعدًا ولا تستبدل بالStatic inspection. الخطة التنفيذية الرسمية = 6 مراحل حسب `01_PLAN.md`.

## 16. Current Status

- Phase 0 CLOSED/PASS.
- Final ERD FROZEN.
- PM V2 code/database NOT STARTED.
- Next: المرحلة 1 — تأسيس الوحدة وربط البيانات الأساسية، وتبدأ بـSchema/Security/Audit مع SQL يدوي خطوة بخطوة ثم Organization/Targets ضمن نفس المرحلة.


### TiDB CHECK enforcement note — 2026-09-08
في البيئة الحالية `CHECK` غير مفعلة، لذلك لا تعتمد PM V2 عليها كحماية. Range/flag invariants الخاصة بالبيانات المملوكة للوحدة تفرض في Service write boundary وتختبر، بينما تبقى FKs الداخلية/Unique/Indexes/column types في DB. لا يغيّر هذا الـERD المنطقي.
