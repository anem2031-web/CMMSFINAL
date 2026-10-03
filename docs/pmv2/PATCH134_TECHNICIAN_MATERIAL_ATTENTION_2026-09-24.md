# PATCH134 — Technician Material Attention

**Date:** 2026-09-24  
**Status:** IMPLEMENTED / FOCUSED TESTS PASS  
**SQL / Schema:** none

## Purpose

Prevent PM V2 material needs from disappearing inside a long technician task feed. Material states that still require the requesting technician's attention are projected into one persistent surface above the normal task cards.

## Runtime behavior

- Adds **مواد تحتاج انتباهك** above the technician task feed.
- The attention query refreshes every 60 seconds and can also be refreshed with the page refresh action.
- Ready material is prioritized first and shown as **جاهزة للاستلام من مخزن الفريق**.
- The technician can open the related task or execute the existing **استلام المواد من مخزن الفريق** action from the attention card after confirmation.
- Waiting states remain visible for unresolved identity, warehouse handling, purchase, transfer, or a temporary receipt blocker.
- Only the technician who owns/requested the material requirement receives that attention item.
- After an unlisted material is resolved by the warehouse, the old pre-resolution route is retained as history only; the resolved route becomes the displayed operational identity.
- Completed/irrelevant states are removed from attention: consumed/cancelled requests are excluded, and a fully issued route disappears after there is no longer a ready receipt action.

## Changed files

- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/routers/pmv2/technician.ts`
- `server/pmv2/materials/technician-attention-service.ts`
- `server/tests/pmv2-patch134-technician-material-attention.node.mjs`

## Verification

- Patch 134 focused test file: **6/6 PASS**.
- The full `eggt5.zip` baseline used for Patch 135 was later verified to contain these four Patch 134 files **byte-for-byte**.
- Broad PM V2 Node baseline before Patch 135: **315/334 PASS, 19 FAIL**; those 19 failures remained unchanged after Patch 135 and are not introduced by Patch 134/135.
- Production TypeScript build was not re-verified in the execution environment because project dependencies were not available.

## Non-goals

Patch 134 does not create a new stock movement, Purchase flow, Material Request model, or inventory accounting path. Physical issue/receipt remains owned by the existing Inventory/Delivery workflow and the existing PM V2 technician self-service adapter.
