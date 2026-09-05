# CMMS — Catalog Item Image Display Fix — 2026-09-05

## Scope

Side fix unrelated to PM V2. No PM V2 files, database schema, migrations, inventory workflow, or purchase workflow were changed.

## Reported symptom

A user can add/edit a Catalog item and choose an image, but the image may not appear on the item after save.

## Root causes found

1. **Catalog permission mismatch**: `catalogProcedure` permits the `warehouse` role to create/update Catalog items, while `attachments.access.ts` denied `warehouse` from writing `catalog_item` attachments. The item could therefore save while its image link failed with `FORBIDDEN`.
2. **Premature success/refetch in the UI**: `ItemsManager` announced success, closed/reset the form, and refetched the list in the Catalog item mutation `onSuccess`, before the optional upload + `attachments.add` completed.
3. **Two image read sources**: Catalog list cards read images from generic `attachments`, while `catalog.items.getById` read from `catalog_item_images`. New uploads use `attachments`, so the two read paths could disagree.
4. **Latest-image selection was not explicitly ordered**: list image attachments were loaded without an order although the mapping logic intended to keep the latest image.

## Fix implemented

- Added `warehouse` to the allowed Catalog-item attachment write roles so attachment permissions match Catalog item management permissions.
- Kept attachment deletion consistent for Catalog items by allowing the same Catalog manager role to manage Catalog attachments.
- Reworked create/update UI sequencing so the operation is:
  1. save item,
  2. upload optional image,
  3. link it via `attachments.add`,
  4. refetch Catalog list,
  5. then show final success and close/reset the form.
- Added a whole-operation saving guard so the save button cannot be clicked again while upload/linking is still in progress.
- If item save succeeds but image upload/linking fails, the UI now reports the partial result explicitly instead of showing a false full-success message.
- Made `attachments` the authoritative read source in `catalog.items.getById`, while preserving the previous `images` response shape for compatibility.
- Ordered Catalog attachment reads by attachment id so the last mapped image is deterministically the newest one.
- Added regression coverage confirming `warehouse` can write Catalog item attachments while unrelated roles remain denied.

## Files changed

- `client/src/components/catalog/ItemsManager.tsx`
- `server/routers/uploads/attachments.access.ts`
- `server/routers/uploads/attachments.router.ts`
- `server/routers/catalog/catalog.router.ts`
- `server/tests/attachmentsAccess.test.ts`
- `docs/CMMS_CATALOG_ITEM_IMAGE_DISPLAY_FIX_2026-09-05.md`

## Validation

### Static review completed

- Catalog create/update permissions and Catalog attachment permissions now include the same operational `warehouse` role.
- Upload/link is completed before list refresh and success feedback.
- Catalog list and item detail now read newly uploaded Catalog images from the same `attachments` table.
- No database migration is required.

### Automated test environment limitation

The supplied project archive did not include `node_modules`, and `pnpm` is not installed in the execution container. An attempt to install dependencies with `npm ci --ignore-scripts` exceeded the available execution window before dependencies were installed, so the Vitest suite could not be executed in this environment. This is an environment limitation, not a test failure.

## Runtime acceptance test required after applying patch

Using a `warehouse` account:

1. Create a new Catalog item with an image.
2. Confirm the success message appears only after upload completes.
3. Confirm the image appears immediately in the Catalog list without manual page refresh.
4. Re-open/edit the item and add another image; confirm the newest image appears on the card.
5. Confirm an `attachments` row exists with `entityType = catalog_item` and the correct `entityId`.
6. Confirm a non-Catalog role such as `technician` still cannot add Catalog item attachments.

## Database impact

None. No SQL commands, schema changes, migrations, or data updates are required for this fix.
