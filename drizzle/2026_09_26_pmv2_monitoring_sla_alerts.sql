-- PATCH139 — PM V2 monitoring, SLA and alert-delivery persistence only.
-- No existing purchase / inventory / ticket workflow tables are modified.

CREATE TABLE IF NOT EXISTS `pmv2_sla_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `roleKey` varchar(60) NOT NULL,
  `slaMinutes` int NULL,
  `reminderMinutes` int NULL,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `updatedById` int NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pmv2_sla_rules_role` (`roleKey`),
  KEY `idx_pmv2_sla_rules_active` (`isActive`),
  KEY `idx_pmv2_sla_rules_updated_by` (`updatedById`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pmv2_alert_deliveries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `taskId` int NOT NULL,
  `taskItemId` int NOT NULL,
  `recipientUserId` int NOT NULL,
  `alertType` varchar(50) NOT NULL,
  `stageKey` varchar(120) NOT NULL,
  `dedupeKey` varchar(191) NOT NULL,
  `notificationId` int NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pmv2_alert_deliveries_dedupe` (`dedupeKey`),
  KEY `idx_pmv2_alert_deliveries_task` (`taskId`),
  KEY `idx_pmv2_alert_deliveries_item` (`taskItemId`),
  KEY `idx_pmv2_alert_deliveries_recipient` (`recipientUserId`),
  KEY `idx_pmv2_alert_deliveries_type` (`alertType`),
  CONSTRAINT `fk_pmv2_alert_deliveries_task` FOREIGN KEY (`taskId`) REFERENCES `pmv2_tasks` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_pmv2_alert_deliveries_item` FOREIGN KEY (`taskItemId`) REFERENCES `pmv2_task_items` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
