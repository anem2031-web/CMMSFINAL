-- PM V2 — Phase 1 — Manual DB Step 2
-- Table: pmv2_teams
-- Execute manually only after pmv2_specialties was created successfully.
--
-- Ownership policy:
--   specialtyId = INTERNAL PM V2 relation => physical FK.
--   warehouseId/deviceUserId = EXISTING-SYSTEM external references => indexed IDs only,
--   validated through PM V2 adapters; intentionally NO physical FK to warehouses/users.

CREATE TABLE `pmv2_teams` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `specialtyId` INT NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `warehouseId` INT NOT NULL,
  `deviceUserId` INT NULL,
  `isActive` TINYINT NOT NULL DEFAULT 1,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pmv2_teams_code` (`code`),

  KEY `idx_pmv2_teams_specialty` (`specialtyId`),
  KEY `idx_pmv2_teams_warehouse` (`warehouseId`),
  KEY `idx_pmv2_teams_device_user` (`deviceUserId`),
  KEY `idx_pmv2_teams_active` (`isActive`),

  CONSTRAINT `fk_pmv2_teams_specialty`
    FOREIGN KEY (`specialtyId`)
    REFERENCES `pmv2_specialties` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
