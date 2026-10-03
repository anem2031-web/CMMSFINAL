# PATCH137 — Warehouse Tabs + Progressive Details

**Date:** 2026-09-24  
**Baseline:** Patch 136 applied over `eggt5_PATCH135_FULL_DOCUMENTED.zip`  
**Status:** IMPLEMENTED / FOCUSED PASS  
**SQL / Schema:** none  
**Business logic:** unchanged

## Purpose

Simplify `/scheduled-maintenance/warehouse-requests` further without removing any information, action, status, explanation, recovery path, or PM V2 architecture note introduced before Patch 137.

Patch 136 organized the page vertically. Patch 137 reduces simultaneous visual load by showing only one warehouse work category at a time and keeping each individual work card compact until the operator requests its details.

## New page interaction

The existing three operational sections are now controlled by three top-level tabs:

1. **تحتاج معالجة** — the existing warehouse action queue.
2. **جاهزة للصرف** — the existing ready-to-issue queue.
3. **المرتجعات** — the existing pending-return queue.

The default tab is **تحتاج معالجة**. Each tab keeps its live count. Only the selected operational section is rendered at a time.

The existing **ملخص عمل المستودع** remains visible above the tabs, including:
- Main Warehouse name/code;
- `waiting_warehouse` count/status;
- ready-to-issue count;
- pending-return count.

The existing PM V2 stock-ownership notice remains visible below the operational tab content.

## Progressive card details

Each card keeps its existing header visible and starts with the body collapsed.

- Waiting request: **عرض التفاصيل والإجراء**.
- Ready issue: **عرض التفاصيل والصرف**.
- Pending return: **عرض التفاصيل والاستلام**.
- Expanded cards expose **إخفاء التفاصيل**.

No underlying content was removed. Expanding a card reveals the same Patch 136 content and controls.

### Waiting-request content preserved

- full task need;
- Team-Warehouse available-at-request snapshot;
- registered shortage;
- current remaining shortage;
- live Main-Warehouse availability;
- destination Team Warehouse and Team;
- request / request-item / task references;
- Catalog code/category;
- maintenance item and due date;
- identity-resolution state and all availability / shortage / purchase-coverage explanations;
- linked Purchase references;
- identity selection;
- Warehouse Transfer handoff;
- Purchase handoff;
- duplicate-purchase suppression message.

### Ready-to-issue content preserved

- item/task identity and ready/review state;
- required / issued / issue-now / Team-available quantities;
- target location;
- requester and Team;
- Lot allocations;
- recipient selector;
- existing Delivery relink recovery;
- issue action.

### Return content preserved

- issued / used / remaining-return quantities;
- previous recipient;
- single-Lot automatic identity;
- multi-Lot allocation controls;
- return confirmation.

## Changed runtime files

- `client/src/pages/pmv2/Pmv2WarehouseQueue.tsx`

## Added regression test

- `server/tests/pmv2-patch137-warehouse-tabs-progressive-details.node.mjs`

The regression test locks the three-tab structure, one-active-section behavior, progressive disclosure controls, preservation of all important existing fields/actions, summary preservation, architecture-notice preservation, and existing warehouse handoffs.

## Verification

- Focused Patches 134/135/136/137: **27/27 PASS**.
- Patch 137 TSX syntax transpile using TypeScript 5.8.3: **PASS**.
- Broad PM V2 suite after Patch 137: **336/355 PASS, 19 fail**; Patch 136 baseline: **329/348 PASS, 19 fail**. The **same 19 test names** fail in both baselines; Patch 137 introduces **0 new broad-suite failures**.
- Full production build is not claimed from this source snapshot because the delivered project snapshot does not include its installed dependencies.

## Deployment

No SQL is required. Extract the modified-files ZIP at the project root, run the normal build in the real project environment, then restart/redeploy.
