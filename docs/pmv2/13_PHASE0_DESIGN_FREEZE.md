# Phase 0 — Design & Integration Freeze

> **الحالة النهائية:** CLOSED / PASS — 2026-09-06.

## 1. Module Boundary — FROZEN

PM V2 تملك Domain الصيانة الدورية وبيانات `pmv2_*` فقط. Users/Targets/Warehouse/Inventory/Ticket/Purchase تبقى ملك الوحدات الحالية.

## 2. Organization — FROZEN

`Specialty → Team → Members`

Department ليس Parent في baseline، وSection مفهوم مكاني.

## 3. Maintenance Targets — FROZEN

`Site | Section | Asset`

- Exactly One لكل Target.
- Section Target لا يحتاج Asset.
- Target منفصل عن Specialty/Team.

## 4. Technician Results — FROZEN

`ok | fixed | needs_material | needs_ticket`

## 5. Task Item State — FROZEN

`pending | in_progress | waiting_material | waiting_ticket | ready_to_complete | completed`

- `ok/fixed` يمكن أن يغلق البند.
- `needs_material` ينتظر Material flow.
- `needs_ticket` ينتظر Ticket الحالي.
- `ready_to_complete` بعد زوال التبعية إذا بقي عمل فني مطلوب.

## 6. Task State — FROZEN

`pending | in_progress | waiting_material | waiting_ticket | ready_to_complete | completed | cancelled`

Task status = Cached Domain Projection من Task Items، مع الإلغاء الإداري الصريح.

## 7. Material Request Item — FROZEN

`waiting_warehouse | external_purchase | received_warehouse | issued_to_team | consumed | cancelled`

- لا Header status مستقل.
- Warehouse يقرر التوفر.
- Purchase system يملك PO lifecycle.
- Inventory/Warehouse system يملك النقل/الصرف.
- PM V2 تسجل Links/Projections فقط.

## 8. Ticket Integration — FROZEN

`Task Item → pmv2_task_ticket_links → Ticket`

- نفس Ticket creation flow.
- Ticket system يحدد A/B/C.
- PM V2 لا تنسخ Ticket states/path.

## 9. Purchase Integration — FROZEN

`Material Request Item → pmv2_material_purchase_links → PO/PO Item`

- لا PM V2 IDs في `ticketId/ticketItemId/packageId`.
- PO عادي بالكامل بنفس Workflow الحالي.

## 10. Material Recipient — FROZEN

المستلم الحقيقي يحدده المستودع عند التسليم. Team Device لا يثبت Recipient تلقائيًا.

## 11. Adapter Boundaries — FROZEN

Users, MaintenanceTarget, Warehouse, Inventory, Ticket, Purchase, Notification, File/Image.

## 12. Closure Rules — FROZEN

لا Task completion إذا بقي:

- Task Item غير مكتمل.
- Material dependency فعالة.
- Ticket مفتوح.
- Follow-up/repair مطلوب غير مكتمل.

## 13. External Reference Policy — FROZEN

- Internal PM V2 references = Physical FKs.
- Existing-system references = IDs + Adapter validation في baseline.
- لا FK خارجي يغير Delete/Workflow قائم دون Design Change جديد.

## 14. Final ERD — FROZEN

المرجع الكامل: `15_FINAL_ERD_FREEZE.md`.

## 15. Phase 0 Acceptance Gate — PASS

- [x] Existing capability boundaries.
- [x] DB Reality Checks المطلوبة.
- [x] Organization/Target contracts.
- [x] State Machines/Transition ownership.
- [x] Ticket/Purchase reuse contracts.
- [x] Material recipient contract.
- [x] Adapter boundaries.
- [x] Closure rules.
- [x] ERD/Cardinality/External references.
- [x] Documentation consistency cleanup.
- [x] لا Pending blocker بطلب المستخدم.

**النتيجة:** Phase 0 CLOSED/PASS. المرحلة 1 — تأسيس الوحدة وربط البيانات الأساسية — READY/NOT STARTED.
