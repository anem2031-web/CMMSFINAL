CREATE TABLE `pmv2_visits` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `taskId` INT NOT NULL,
  `startedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `endedAt` TIMESTAMP NULL DEFAULT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  KEY `idx_pmv2_visits_task` (`taskId`),
  KEY `idx_pmv2_visits_started_at` (`startedAt`),
  KEY `idx_pmv2_visits_ended_at` (`endedAt`),

  CONSTRAINT `fk_pmv2_visits_task`
    FOREIGN KEY (`taskId`)
    REFERENCES `pmv2_tasks` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
