CREATE TABLE `pmv2_task_ticket_links` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `taskItemId` INT NOT NULL,
  `ticketId` INT NOT NULL,
  `createdById` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  UNIQUE KEY `uq_pmv2_task_ticket_links_ticket` (`ticketId`),

  KEY `idx_pmv2_task_ticket_links_task_item` (`taskItemId`),
  KEY `idx_pmv2_task_ticket_links_created_by` (`createdById`),

  CONSTRAINT `fk_pmv2_task_ticket_links_task_item`
    FOREIGN KEY (`taskItemId`)
    REFERENCES `pmv2_task_items` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
