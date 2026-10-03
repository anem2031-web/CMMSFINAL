CREATE TABLE `pmv2_material_requests` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `taskItemId` INT NOT NULL,
  `visitId` INT NOT NULL,
  `requestedById` INT NOT NULL,
  `teamId` INT NOT NULL,
  `teamWarehouseId` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  KEY `idx_pmv2_material_requests_task_item` (`taskItemId`),
  KEY `idx_pmv2_material_requests_visit` (`visitId`),
  KEY `idx_pmv2_material_requests_requested_by` (`requestedById`),
  KEY `idx_pmv2_material_requests_team` (`teamId`),
  KEY `idx_pmv2_material_requests_team_warehouse` (`teamWarehouseId`),
  KEY `idx_pmv2_material_requests_created_at` (`createdAt`),

  CONSTRAINT `fk_pmv2_material_requests_task_item`
    FOREIGN KEY (`taskItemId`)
    REFERENCES `pmv2_task_items` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  CONSTRAINT `fk_pmv2_material_requests_visit`
    FOREIGN KEY (`visitId`)
    REFERENCES `pmv2_visits` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  CONSTRAINT `fk_pmv2_material_requests_team`
    FOREIGN KEY (`teamId`)
    REFERENCES `pmv2_teams` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
