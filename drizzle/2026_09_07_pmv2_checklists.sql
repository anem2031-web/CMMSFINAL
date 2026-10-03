-- PM V2 — Phase 1 — DB Step 4
-- Table: pmv2_checklists
-- Execute manually only after pmv2_specialties, pmv2_teams, and pmv2_team_members are confirmed PASS.
-- This header is PM V2-owned. No external master-data FK is introduced.

CREATE TABLE `pmv2_checklists` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `isActive` TINYINT NOT NULL DEFAULT 1,
  `createdById` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_pmv2_checklists_active` (`isActive`),
  KEY `idx_pmv2_checklists_created_by` (`createdById`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
