CREATE TABLE `pmv2_task_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `taskId` INT NOT NULL,
  `sourceChecklistItemId` INT NOT NULL,
  `titleSnapshot` VARCHAR(300) NOT NULL,
  `sortOrderSnapshot` INT NOT NULL DEFAULT 0,
  `scheduledDate` DATE NOT NULL,
  `status` ENUM(
    'pending',
    'in_progress',
    'waiting_material',
    'waiting_ticket',
    'ready_to_complete',
    'completed'
  ) NOT NULL DEFAULT 'pending',
  `result` ENUM(
    'ok',
    'fixed',
    'needs_material',
    'needs_ticket'
  ) NULL,

  PRIMARY KEY (`id`),

  UNIQUE KEY `uq_pmv2_task_items_generation`
    (`taskId`, `sourceChecklistItemId`, `scheduledDate`),

  KEY `idx_pmv2_task_items_task` (`taskId`),
  KEY `idx_pmv2_task_items_source_checklist_item` (`sourceChecklistItemId`),
  KEY `idx_pmv2_task_items_scheduled_date` (`scheduledDate`),
  KEY `idx_pmv2_task_items_status` (`status`),
  KEY `idx_pmv2_task_items_result` (`result`),

  CONSTRAINT `fk_pmv2_task_items_task`
    FOREIGN KEY (`taskId`)
    REFERENCES `pmv2_tasks` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  CONSTRAINT `fk_pmv2_task_items_source_checklist_item`
    FOREIGN KEY (`sourceChecklistItemId`)
    REFERENCES `pmv2_checklist_items` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
