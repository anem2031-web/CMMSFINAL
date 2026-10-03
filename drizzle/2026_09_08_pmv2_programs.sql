CREATE TABLE `pmv2_programs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `teamId` INT NOT NULL,
  `checklistId` INT NOT NULL,
  `isActive` TINYINT NOT NULL DEFAULT 1,
  `createdById` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  KEY `idx_pmv2_programs_team` (`teamId`),
  KEY `idx_pmv2_programs_checklist` (`checklistId`),
  KEY `idx_pmv2_programs_active` (`isActive`),
  KEY `idx_pmv2_programs_created_by` (`createdById`),

  CONSTRAINT `fk_pmv2_programs_team`
    FOREIGN KEY (`teamId`)
    REFERENCES `pmv2_teams` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  CONSTRAINT `fk_pmv2_programs_checklist`
    FOREIGN KEY (`checklistId`)
    REFERENCES `pmv2_checklists` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
