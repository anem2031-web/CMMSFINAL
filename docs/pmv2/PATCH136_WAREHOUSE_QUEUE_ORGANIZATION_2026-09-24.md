# PATCH136 — Warehouse Queue Organization

**Date:** 2026-09-24  
**Baseline:** `eggt5_PATCH135_FULL_DOCUMENTED.zip`  
**Status:** IMPLEMENTED / FOCUSED PASS  
**SQL / Schema:** none  
**Business logic:** unchanged

## Purpose

Reorganize `/scheduled-maintenance/warehouse-requests` so the warehouse operator can understand the page in a clear operational order without deleting any existing information, action, status, or recovery path.

PATCH136 is a presentation-only reorganization. It does not change shortage calculation, identity resolution, Warehouse Transfer handoff, Purchase handoff, Team-Warehouse issue, Delivery relink, return confirmation, Inventory ownership, or Purchase ownership.

## Organization after PATCH136

The page now follows one fixed visual sequence:

1. **ملخص عمل المستودع** — Main Warehouse identity plus counts for waiting requests, ready-to-issue materials, and pending returns.
2. **طلبات تحتاج معالجة المستودع** — the action/decision queue appears first.
3. **مواد PM V2 الجاهزة للصرف للمهمة** — ready issue work appears second.
4. **مرتجعات PM V2 المعلقة** — return intake appears third.
5. **PM V2 لا ينفذ حركة مخزون بنفسه** — the existing architecture notice is preserved and moved after operational work.

## Waiting-request card organization

Every existing field remains visible, but is grouped under stable visual areas:

- **الكميات**
  - احتياج المهمة
  - المتاح في مخزن الفريق وقت الطلب
  - النقص المسجل على المهمة
  - المتبقي المطلوب تغطيته
- **المخزون والوجهة**
  - المتاح في الرئيسي الآن
  - مخزن الفريق المستهدف
  - الفريق
- **تفاصيل الطلب والحالة**
  - Request / Request Item / Task references
  - Catalog item code and category
  - maintenance item and due date
  - identity-resolution message
  - all existing shortage / availability / purchase-coverage / ambiguity / unit-mismatch explanations
- **الإجراء**
  - تحديد المادة من الدليل
  - تحويل النقص إلى مخزن الفريق
  - إنشاء طلب شراء للعجز
  - existing duplicate-purchase suppression message

Linked Purchase references remain visible exactly as operational context before the action area.

## Ready-to-issue and return organization

No capability was removed.

Ready-to-issue cards retain:
- task and item identity;
- required / issued / current issue / Team availability quantities;
- target location;
- requester and Team;
- automatic Lot allocation;
- existing recipient selector;
- Delivery relink recovery;
- full issue action.

Return cards retain:
- issued / used / remaining-return quantities;
- previous recipient;
- single-Lot automatic return identity;
- multi-Lot return allocation;
- return confirmation action.

## Changed runtime files

- `client/src/pages/pmv2/Pmv2WarehouseQueue.tsx`

## Added regression test

- `server/tests/pmv2-patch136-warehouse-queue-organization.node.mjs`

The test locks both the new section order and the presence of the pre-existing information/actions so a future visual cleanup cannot silently remove operational content.

## Verification

- Patch 134 + Patch 135 + Patch 136 focused tests: **20/20 PASS**.
- PATCH136 TSX syntax transpile using TypeScript 5.8.3: **PASS**.
- Full production build was not run because this delivered project snapshot does not include `node_modules`; this is **not verified**, not PASS.

## Deployment

No SQL is required. Extract the modified-files ZIP at the project root, run the normal project build in the real environment, then restart/redeploy.
