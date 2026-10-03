-- ============================================================
-- PM V2 — Phase 1 / Manual DB Step 1
-- Table: pmv2_specialties
-- Date: 2026-09-07
--
-- IMPORTANT:
--   * Execute manually by the project owner/user.
--   * This file is ONE database step only.
--   * No external physical FKs are created.
--   * managerUserId / createdById reference existing users logically and
--     are validated by PM V2 adapters at write time.
-- ============================================================

CREATE TABLE `pmv2_specialties` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `nameEn` VARCHAR(200) NULL,
  `nameUr` VARCHAR(200) NULL,
  `description` TEXT NULL,
  `managerUserId` INT NULL,
  `isActive` TINYINT NOT NULL DEFAULT 1,
  `createdById` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pmv2_specialties_code` (`code`),
  KEY `idx_pmv2_specialties_manager_user` (`managerUserId`),
  KEY `idx_pmv2_specialties_created_by` (`createdById`),
  KEY `idx_pmv2_specialties_active` (`isActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- End of manual DB Step 1. No second SQL is included in this patch.
