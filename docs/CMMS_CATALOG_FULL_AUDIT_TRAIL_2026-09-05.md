# CMMS — Catalog Full Audit Trail

Date: 2026-09-05

## Goal

Ensure every successful **Catalog data mutation** is traceable from the Admin Audit Log with:

- exact date/time (displayed to the second),
- user identity (`userId`, resolved to the user name in the Audit UI),
- action,
- affected entity and id,
- values before the change when applicable,
- values after the change when applicable,
- request IP/User-Agent where the mutation path has HTTP request context.

This change does **not** alter Catalog business workflows and does **not** require a database migration.

## Audit architecture

The existing application already has two audit stores and the Admin Audit Log merges both sources by `createdAt`:

1. `catalog_audit_logs`
   - Canonical Catalog governance/master-data audit.
   - Items, taxonomy nodes, units, suppliers, candidates, supplier relationships, imports, aliases/memory.

2. `audit_logs`
   - Shared application audit.
   - Catalog item images/attachments remain here because attachments are a shared service used by multiple modules.

**Do not duplicate attachment events into `catalog_audit_logs`.** The Admin Audit Log already merges both sources, so double-writing would create duplicate user-visible events.

## Existing coverage confirmed

The Catalog router already audited these operations before this patch:

- create/update/deactivate/reactivate taxonomy node,
- create/update/deactivate/reactivate Catalog Item,
- create/update/deactivate/reactivate unit,
- create/update/deactivate supplier,
- item candidate merge/separate/link/approve,
- supplier candidate link/approve,
- Catalog AI matching usage.

Importantly, editing an item code or moving it to another category is already included in the normal item `update` audit. `oldValues` and `newValues` contain the submitted `code`/`nodeId`, so future code/category changes are traceable.

## Gaps fixed in this patch

### Item ↔ Supplier relationships

All direct relationship mutations now write Catalog audit rows:

- `assign_supplier_to_item`
- `update_item_supplier_link`
- `restore_item_supplier_link`
- `remove_supplier_from_item`
- `set_preferred_supplier`
- `unset_preferred_supplier`

Implicit preference changes are also audited. If selecting Supplier B as preferred automatically removes preferred status from Supplier A, both movements are recorded.

### Bulk Catalog import

`importCommit` now passes the authenticated user into the import service.

Every imported row that writes Catalog data is audited:

- `import_create` for new nodes/items,
- `import_update` for existing nodes/items and parent/category relationship changes,
- `import_commit` summary for the completed import.

This closes the previous gap where bulk import could mutate Catalog master data without user-level audit history.

### Warehouse-driven Catalog candidates and supplier memory

Catalog master-data changes created from receiving are now audited:

- `create_item_candidate`
- `create_supplier_candidate`
- `create_supplier_alias`
- `create_supplier_item_alias`
- `confirm_supplier_item_alias`

This means the audit trail does not depend only on the standalone Catalog screen; Catalog changes initiated by Warehouse Receiving are also traceable.

### Catalog images / attachments

Image add/delete events continue to use the shared `audit_logs` table, but the audit payload is now richer:

- attachment id,
- file name,
- file key,
- MIME type,
- file size,
- catalog item id through the audit entity.

Actions:

- `add_attachment`
- `delete_attachment`

The existing Catalog image permission fix for the `warehouse` role is preserved in this patch.

## Audit UI improvements

`client/src/pages/admin/AuditLog.tsx` now:

- gives Arabic/English/Urdu labels to the new Catalog audit actions,
- gives readable labels to Catalog attachment, item-supplier, supplier alias, supplier-item memory and import entities,
- searches `oldValues` and `newValues` in addition to action/user/entity text,
- displays date/time explicitly down to seconds,
- continues to display the user name resolved from `userId`, with email/id fallback.

## Historical limitation

This patch is forward-looking. It cannot reconstruct the actor for old Catalog mutations that were never audited historically.

Examples already confirmed during the image investigation:

- old Catalog Item activation/deactivation changes were not present in `audit_logs`,
- therefore the historical user who disabled those old items cannot be recovered reliably from current data.

From installation of this patch forward, the covered mutations are recorded.

## Database

No SQL, migration, or schema change is required.

Existing columns already provide everything required:

- `userId`
- `action`
- `entityType`
- `entityId`
- `oldValues`
- `newValues`
- `ipAddress`
- `userAgent`
- `createdAt`

## Verification performed

- TypeScript syntax/transpile check passed for every modified/new TS/TSX file using the installed TypeScript compiler API.
- Added `server/tests/catalogFullAuditTrail.test.ts` regression coverage for:
  - supplier-item relationship auditing,
  - code/category old/new snapshots,
  - import audit coverage,
  - warehouse-created candidate/alias audit,
  - attachment audit payload,
  - Audit UI user/time/search behavior.

Full Vitest/TypeScript project execution was not available in the provided project copy because `node_modules` is not included. `tsc --noEmit` stops before project checking because external type packages such as `node` and `vite/client` are absent.

## Runtime acceptance test after patch installation

Recommended smoke test with an authorized Catalog user:

1. Create a new Catalog Item.
2. Edit its item code.
3. Move it to another valid leaf category and update the code accordingly.
4. Deactivate/reactivate it.
5. Add/edit a supplier.
6. Link the supplier to the item; edit price/SKU/notes; set preferred; remove the link.
7. Add and delete an item image.
8. Open Admin → Audit Log and confirm each successful action shows:
   - correct user name,
   - correct exact date/time,
   - correct entity/id,
   - correct old/new values.

For bulk import, perform a small controlled import and verify per-row `import_create`/`import_update` plus one `import_commit` summary.
