CREATE TABLE `pmv2_visit_members` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `visitId` INT NOT NULL,
  `userId` INT NOT NULL,
  `isLeader` TINYINT NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  UNIQUE KEY `uq_pmv2_visit_members_visit_user` (`visitId`, `userId`),

  KEY `idx_pmv2_visit_members_visit` (`visitId`),
  KEY `idx_pmv2_visit_members_user` (`userId`),
  KEY `idx_pmv2_visit_members_leader` (`isLeader`),

  CONSTRAINT `fk_pmv2_visit_members_visit`
    FOREIGN KEY (`visitId`)
    REFERENCES `pmv2_visits` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
