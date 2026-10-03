CREATE TABLE IF NOT EXISTS `pmv2_daily_report_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `reportDate` date NOT NULL,
  `teamId` int NOT NULL,
  `reviewedById` int NOT NULL,
  `reviewedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `note` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pmv2_daily_report_reviews_date_team` (`reportDate`, `teamId`),
  KEY `idx_pmv2_daily_report_reviews_team` (`teamId`),
  KEY `idx_pmv2_daily_report_reviews_reviewer` (`reviewedById`),
  KEY `idx_pmv2_daily_report_reviews_reviewed_at` (`reviewedAt`),
  CONSTRAINT `fk_pmv2_daily_report_reviews_team`
    FOREIGN KEY (`teamId`) REFERENCES `pmv2_teams` (`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
