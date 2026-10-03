CREATE TABLE `pmv2_program_targets` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `programId` INT NOT NULL,
  `siteId` INT NULL,
  `sectionId` INT NULL,
  `assetId` INT NULL,

  PRIMARY KEY (`id`),

  KEY `idx_pmv2_program_targets_program` (`programId`),
  KEY `idx_pmv2_program_targets_site` (`siteId`),
  KEY `idx_pmv2_program_targets_section` (`sectionId`),
  KEY `idx_pmv2_program_targets_asset` (`assetId`),

  UNIQUE KEY `uq_pmv2_program_targets_program_site` (`programId`, `siteId`),
  UNIQUE KEY `uq_pmv2_program_targets_program_section` (`programId`, `sectionId`),
  UNIQUE KEY `uq_pmv2_program_targets_program_asset` (`programId`, `assetId`),

  CONSTRAINT `fk_pmv2_program_targets_program`
    FOREIGN KEY (`programId`)
    REFERENCES `pmv2_programs` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
