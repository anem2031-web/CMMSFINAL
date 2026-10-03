-- PM V2 Phase 1 — DB Step 5 — pmv2_checklist_items
-- TiDB baseline note (2026-09-08): tidb_enable_check_constraint is OFF in the
-- current CMMS environment, so CHECK clauses are intentionally omitted here.
-- Their write invariants are enforced by server/pmv2/checklists/validation.ts.

CREATE TABLE `pmv2_checklist_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `checklistId` INT NOT NULL,
  `title` VARCHAR(300) NOT NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `isRequired` TINYINT NOT NULL DEFAULT 1,
  `isActive` TINYINT NOT NULL DEFAULT 1,
  `frequency` ENUM('daily','weekly','monthly','quarterly','biannual','annual') NOT NULL,
  `frequencyValue` INT NULL,
  `weekday` TINYINT NULL,
  `monthDay` TINYINT NULL,
  `anchorDate` DATE NULL,

  PRIMARY KEY (`id`),

  KEY `idx_pmv2_checklist_items_checklist` (`checklistId`),
  KEY `idx_pmv2_checklist_items_active` (`isActive`),
  KEY `idx_pmv2_checklist_items_frequency` (`frequency`),

  CONSTRAINT `fk_pmv2_checklist_items_checklist`
    FOREIGN KEY (`checklistId`)
    REFERENCES `pmv2_checklists` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
