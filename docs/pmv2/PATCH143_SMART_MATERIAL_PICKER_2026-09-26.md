# PATCH143 — Smart technician material picker

Date: 2026-09-26

## Purpose
Close the deferred DEC-065 PM V2 technician Material Picker UX item without changing the accepted material-routing, Inventory, Purchase, Ticket, or Catalog ownership contracts.

## Behavior
When the technician opens the listed-material picker without entering a search term, PM V2 now builds a smart default list from real evidence only:

1. Catalog materials with usable current stock in the Task Team Warehouse are ranked first.
2. Within/after that stock group, real `pmv2_material_usages` history for the same maintenance target and Team contributes relevance.
3. Team usage history contributes after same-target evidence.
4. General active Catalog items fill the remaining default list.

When a search term is entered, full active-Catalog search remains available by material name/item code and is not restricted to the smart default list. Exact/stronger text matches stay ahead while Team-Warehouse availability and real PM V2 history act only as secondary ranking evidence.

## Operator identity
Each result keeps/now exposes:
- material name;
- operator Catalog code;
- Catalog taxonomy path from current Catalog Master Data;
- current Team-Warehouse balance;
- smart evidence label when applicable: Team stock / same-target prior use / Team prior use;
- existing duplicate state (`مطلوب بالفعل` / ready-receipt state) remains authoritative.

## Architecture boundary
- No new Catalog or specialty-to-material mapping is created.
- No category-name/free-text specialty inference is used.
- Inventory and Lot data are read-only through the PM V2 current-system adapter.
- Usage relevance comes only from existing PM V2 material-usage trace.
- Full Catalog remains the material Master Data and remains searchable.
- No Inventory/Transfer/Purchase/Ticket/Accounting/Legacy-PM write is added.
- No SQL/schema change.

## Files
Runtime:
- `server/pmv2/adapters/contracts.ts`
- `server/pmv2/adapters/current-system.ts`
- `server/pmv2/materials/request-service.ts`
- `client/src/pages/pmv2/Pmv2MyTasks.tsx`

Verification:
- `server/tests/pmv2-patch143-smart-material-picker.node.mjs`

Documentation:
- PM V2 plan/screens/decisions/status/testing/release/manifest/README.

## Automated verification
- PATCH143 dedicated: **5/5 PASS**.
- Step 4.1 + PATCH143 compatibility: **40/40 PASS**.
- focused material + PATCH131–143 regression: **114/114 PASS**.
- broad PM V2 after PATCH143: **380/399 PASS, 19 fail**.
- PATCH142 baseline recheck: **375/394 PASS, 19 fail**.
- failing test-name set is identical: **0 new broad-suite failures**.
- changed TS/TSX syntax via TypeScript `transpileModule`: **PASS**.
- Runtime/UAT remains deferred with the rest of the user-requested comprehensive PM V2 acceptance pass.
