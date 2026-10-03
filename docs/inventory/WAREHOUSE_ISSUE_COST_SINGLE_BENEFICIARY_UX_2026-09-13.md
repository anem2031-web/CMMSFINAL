# Warehouse issue cost attribution — single beneficiary UX

**Date:** 2026-09-13  
**Patch:** WAREHOUSE PATCH 002  
**Scope:** Simplify lot-based issue cost attribution during warehouse delivery.

## Decision

Each warehouse delivery operation now represents exactly one beneficiary destination:

- **Site:** required.
- **Section:** required and must belong to the selected site.
- **Asset:** optional and, when selected, must belong to the selected site and section.
- **Quantity:** the complete delivery quantity is attributed to that one destination automatically.
- **Cost:** calculated server-side from the consumed lot `issueUnitCost` snapshot; users cannot type or override the cost.

If the same lot must be issued to another site/section/asset, that is a separate delivery operation from the same lot. The remaining lot balance stays available for later issues.

## Inventory accounting isolation

This patch does **not** change the existing inventory valuation/accounting movement:

- aggregate stock still uses the current inventory `averageCost` flow;
- physical quantity is still consumed from the scanned lot;
- the new attribution layer records the operational maintenance cost using the consumed lot `issueUnitCost` snapshot.

The attribution table created in WAREHOUSE PATCH 001 is retained. Although the table structurally allows multiple rows per inventory transaction, the current application contract intentionally creates exactly one attribution row per delivery operation.

## UX simplification

The cost-attribution block is vertically stacked to work in the narrow delivery dialog without overlapping labels:

1. delivery quantity (read-only mirror of the main quantity),
2. site,
3. section,
4. asset (optional),
5. lot unit cost + total attributed issue cost.

The previous **“إضافة جهة أخرى”** split-allocation control was removed.

## Validation

Both client and server enforce:

- exactly one beneficiary row;
- site required;
- section required;
- section belongs to site;
- optional asset belongs to the same site and section;
- attributed quantity equals the complete delivery quantity;
- lot-based attribution is available only when lot tracking is active.

## Database

No new SQL is required for this patch. It uses the existing table:

`inventory_issue_cost_allocations`
