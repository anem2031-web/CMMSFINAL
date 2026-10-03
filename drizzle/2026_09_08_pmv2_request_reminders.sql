CREATE TABLE `pmv2_request_reminders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `requestId` INT NOT NULL,
  `recipientUserId` INT NOT NULL,
  `reminderType` VARCHAR(50) NOT NULL,
  `notificationId` INT NULL,
  `createdById` INT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  KEY `idx_pmv2_request_reminders_request` (`requestId`),
  KEY `idx_pmv2_request_reminders_recipient_user` (`recipientUserId`),
  KEY `idx_pmv2_request_reminders_type` (`reminderType`),
  KEY `idx_pmv2_request_reminders_notification` (`notificationId`),
  KEY `idx_pmv2_request_reminders_created_by` (`createdById`),
  KEY `idx_pmv2_request_reminders_created_at` (`createdAt`),

  CONSTRAINT `fk_pmv2_request_reminders_request`
    FOREIGN KEY (`requestId`)
    REFERENCES `pmv2_material_requests` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
