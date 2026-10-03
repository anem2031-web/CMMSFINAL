# Delivery notes — PM V2 Patch 066

Reason: the Patch 065 acceptance screen exposed no clear way to edit an existing program, so the estimated duration foundation could not be used by the manager.

Result: selected programs now show **تعديل البرنامج**, with team, checklist, estimated duration, readable duration feedback, and **حفظ التعديلات**. Existing historical-safety rules for team/checklist changes remain in place.

No SQL is required for this patch because the duration column was already added successfully before Patch 065.
