-- ============================================================
-- Purchase Package Submissions — Phase 1 data preparation only
-- Date: 2026-08-30
--
-- IMPORTANT:
--   * Additive / backward-compatible migration only.
--   * NO existing Purchase Order / Pricing Batch workflow is changed here.
--   * All new fields are nullable and have no defaults intentionally.
--   * Existing rows keep NULL in these fields until the future accounting /
--     management batch workflow is explicitly approved and implemented.
-- ============================================================

ALTER TABLE `purchase_package_submissions`
  ADD COLUMN `totalEstimatedCost` DECIMAL(12,2) NULL AFTER `createdById`,
  ADD COLUMN `custodyBalance` DECIMAL(12,2) NULL AFTER `totalEstimatedCost`,
  ADD COLUMN `status` ENUM('pending_accounting','pending_management','approved','rejected') NULL AFTER `custodyBalance`,
  ADD COLUMN `accountingApprovedById` INT NULL AFTER `status`,
  ADD COLUMN `accountingApprovedAt` TIMESTAMP NULL AFTER `accountingApprovedById`,
  ADD COLUMN `managementApprovedById` INT NULL AFTER `accountingApprovedAt`,
  ADD COLUMN `managementApprovedAt` TIMESTAMP NULL AFTER `managementApprovedById`;

-- No data backfill is intentionally performed in Phase 1.
-- No existing columns are altered or dropped.
-- No Purchase Order / Item / Pricing Batch statuses are modified.
--
-- Manual rollback (only if explicitly needed before Phase 3 starts):
-- ALTER TABLE `purchase_package_submissions`
--   DROP COLUMN `managementApprovedAt`,
--   DROP COLUMN `managementApprovedById`,
--   DROP COLUMN `accountingApprovedAt`,
--   DROP COLUMN `accountingApprovedById`,
--   DROP COLUMN `status`,
--   DROP COLUMN `custodyBalance`,
--   DROP COLUMN `totalEstimatedCost`;
