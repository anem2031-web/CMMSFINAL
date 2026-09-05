# CMMS — Catalog Item Image Upload Progress & Legacy Recovery — 2026-09-05

## Scope

Side task unrelated to PM V2. This change improves the Catalog item image save experience and starts a read-only recovery audit for images entered before the Catalog image fix.

No PM V2 code, workflow, schema, migration, inventory workflow, or purchase workflow is changed by this patch.

## User requirement

For both Catalog item create and edit:

1. The user must see image upload progress.
2. The UI must distinguish between uploading bytes, server-side image processing/storage, and saving the image link to the Catalog item.
3. The dialog must not report final success or close until the optional image has been uploaded and linked successfully.
4. If the image fails after the item row has already been saved, the UI must report the partial result explicitly instead of showing a false full-success message.
5. Existing images entered before the previous image fix must be audited and recovered when safely identifiable.

## Implementation completed

### Catalog item create/edit UI

`client/src/components/catalog/ItemsManager.tsx`

- Replaced the image upload `fetch()` call with `XMLHttpRequest` so upload progress is observable.
- Added visible percentage/progress bar for the selected image.
- Upload byte progress is represented as 0–90%.
- The remaining progress is reserved for server-side processing/storage and attachment linking, because 100% bytes-sent does not mean the server has successfully processed and stored the image.
- When `/api/upload` returns a valid `url` and `fileKey`, the UI reports that the file has been uploaded and is being saved/linked.
- `attachments.add` must succeed before the image is marked 100% and before the whole item operation is reported as successful.
- The file picker is disabled while save/upload is in progress.
- The item dialog cannot be closed while the save/upload operation is active, preventing loss of visible operation state.
- The save button shows the active image stage (`رفع الصورة X%` / `حفظ الصورة...`).
- On image failure after the item mutation, the dialog stays available and the user receives an explicit partial-success error.

## Important sequencing decision

With the current Catalog/attachments architecture, a new attachment requires a real Catalog `itemId`. Therefore a new item row must exist before `attachments.add` can persist the image relationship.

The chosen safe sequence is:

1. validate form,
2. create/update the Catalog item row,
3. upload image with visible progress,
4. wait for server processing/storage response,
5. persist the Catalog attachment relationship,
6. refresh the Catalog list,
7. only then close the dialog and report final success.

This intentionally avoids uploading a raw file before item creation, which would create an orphaned storage object if item validation/database creation failed. "Final save" at the UI/workflow level is not considered successful until the image relationship is saved.

## Legacy image recovery

Recovery has **not** modified any production data yet.

Two historical sources must be audited:

- current generic `attachments` rows with `entityType = 'catalog_item'`;
- legacy `catalog_item_images` rows.

The recovery process is deliberately read-only first:

1. verify the live DB schemas for `catalog_items`, `attachments`, and `catalog_item_images`;
2. count Catalog items with/without current attachments;
3. count legacy image rows and identify items that have legacy images but no current Catalog attachment;
4. inspect recoverable URLs/metadata;
5. produce a proposed mapping;
6. only after review, send manual SQL migration commands to the user one step at a time;
7. verify the image appears before any cleanup is considered.

No blind migration or deletion of old files is allowed.

## Validation performed in this workspace

- TypeScript/TSX parser: PASS for the modified `ItemsManager.tsx`.
- TypeScript transpilation syntax check: PASS.
- Full project typecheck/runtime tests were not run because the supplied archive has no installed project dependencies in this environment.

## Runtime acceptance test

After applying this patch, test both **Add item** and **Edit item** with a `warehouse` account:

1. choose an image;
2. click Save/Update;
3. confirm upload percentage becomes visible and advances;
4. confirm the UI changes from upload to image-save/link status;
5. confirm final success appears only after the image reaches 100%;
6. confirm the image appears immediately in the Catalog list;
7. test an edit with a replacement/new image and confirm the same behavior.

## Database impact

None in this patch.

Legacy recovery remains in read-only audit until the user executes the requested SQL and returns the results.
