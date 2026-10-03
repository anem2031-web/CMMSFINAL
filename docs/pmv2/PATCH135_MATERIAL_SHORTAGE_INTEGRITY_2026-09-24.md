# PATCH135 — Material Shortage Integrity

**Date:** 2026-09-24  
**Baseline:** `eggt5.zip`, confirmed to contain PATCH134 byte-for-byte  
**Status:** IMPLEMENTED / REGRESSION TESTS PASS  
**SQL / Schema:** none

## Purpose

Harden the technician material view after identity resolution and warehouse progress without rewriting the already-correct shortage-routing logic. The patch prevents duplicate material selection after the warehouse resolves an unlisted material and replaces a stale shortage snapshot in the technician attention surface with a live remaining-shortage projection.

## What changed

### Duplicate protection after identity resolution

The technician material selector now treats both identities as active/blocked when checking duplicates:

- the direct `catalogItemId` stored on an active request; and
- `identityResolution.resolvedCatalogItemId` when the warehouse has resolved an originally unlisted material.

This closes the UX gap where the same Catalog material could otherwise be selected again merely because its original request began without a Catalog ID. Existing server-side active-request duplicate protection remains authoritative.

### Remaining shortage projection

`technician-attention-service.ts` now exposes and normalizes:

- `initialShortageQuantity` — shortage captured when the need was routed;
- `warehouseRequestedQuantity` — quantity represented by the warehouse request;
- `warehouseReceivedQuantity` — confirmed quantity received into Main Warehouse for that request;
- `warehouseIssuedToTeamQuantity` — confirmed quantity transferred/issued into Team Warehouse;
- `shortageQuantity` — current remaining shortage, derived as `max(0, initial shortage - issued to Team)`.

For direct `team_inventory` routes, current shortage is zero.

The technician attention card now distinguishes **النقص عند التسجيل** from **المتبقي من النقص**, and also shows **وصل للمستودع الرئيسي** and **حُوّل لمخزن الفريق** when those quantities are greater than zero. When the shortage is fully supplied to Team Warehouse, the card states **تم استكمال النقص لمخزن الفريق** instead of continuing to display the old shortage as outstanding.

## Existing invariants explicitly protected by tests

PATCH135 does not rewrite `request-service.ts` or `material-identity-resolution-service.ts`; its regression tests lock the existing correct behavior:

- full Team-Warehouse coverage creates no warehouse Material Request;
- partial Team-Warehouse coverage creates only the true shortage (`required - available`);
- warehouse identity resolution rechecks live Team-Warehouse stock and rewrites the same request to the current shortage/route;
- one active request per material/task item is protected server-side.

## Changed files

- `client/src/pages/pmv2/Pmv2MyTasks.tsx`
- `server/pmv2/materials/technician-attention-service.ts`
- `server/tests/pmv2-patch135-material-shortage-integrity.node.mjs`

The delivery package also contains `PATCH135_CHANGE_SUMMARY.txt`; it is a package summary, not runtime source.

## Verification

- Patch 135 test file: **7/7 PASS**.
- Focused regression across Patches **114, 115, 131, 134, 135: 39/39 PASS**.
- Broad PM V2 Node suite after Patch 135: **322/341 PASS, 19 FAIL**.
- Baseline before Patch 135: **315/334 PASS, 19 FAIL**.
- Failure count and failing baseline set remained unchanged; PATCH135 introduced **no additional broad-suite failure**.
- `npm run check/build` was not verified in the execution environment: `node_modules` was absent and `npm ci` did not complete within the environment timeout. This is recorded as **not verified**, not PASS.

## Deployment note

No SQL is required. In the real project environment, install/use the normal project dependencies, run the standard TypeScript/production build, then restart/redeploy.
