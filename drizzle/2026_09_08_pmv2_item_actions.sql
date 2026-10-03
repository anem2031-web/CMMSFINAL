CREATE TABLE `pmv2_item_actions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `taskItemId` INT NOT NULL,
  `visitId` INT NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `result` ENUM(
    'ok',
    'fixed',
    'needs_material',
    'needs_ticket'
  ) NULL,
  `note` TEXT NULL,
  `performedById` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  KEY `idx_pmv2_item_actions_task_item` (`taskItemId`),
  KEY `idx_pmv2_item_actions_visit` (`visitId`),
  KEY `idx_pmv2_item_actions_action` (`action`),
  KEY `idx_pmv2_item_actions_result` (`result`),
  KEY `idx_pmv2_item_actions_performed_by` (`performedById`),
  KEY `idx_pmv2_item_actions_created_at` (`createdAt`),

  CONSTRAINT `fk_pmv2_item_actions_task_item`
    FOREIGN KEY (`taskItemId`)
    REFERENCES `pmv2_task_items` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  CONSTRAINT `fk_pmv2_item_actions_visit`
    FOREIGN KEY (`visitId`)
    REFERENCES `pmv2_visits` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
