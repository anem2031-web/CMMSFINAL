-- Manual DB step for PM V2 Patch 064.
-- Apply exactly once before applying the patch files.
ALTER TABLE `pmv2_checklist_items`
  ADD COLUMN `scheduleConfigJson` TEXT NULL;

ALTER TABLE `pmv2_task_items`
  ADD COLUMN `recurrenceLabelSnapshot` VARCHAR(500) NULL;
