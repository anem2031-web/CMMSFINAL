CREATE TABLE `pmv2_tasks` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `programId` INT NOT NULL,
  `programTargetId` INT NOT NULL,
  `teamId` INT NOT NULL,
  `taskNumber` VARCHAR(50) NOT NULL,
  `dueDate` DATE NOT NULL,
  `status` ENUM(
    'pending',
    'in_progress',
    'waiting_material',
    'waiting_ticket',
    'ready_to_complete',
    'completed',
    'cancelled'
  ) NOT NULL DEFAULT 'pending',

  PRIMARY KEY (`id`),

  UNIQUE KEY `uq_pmv2_tasks_task_number` (`taskNumber`),
  UNIQUE KEY `uq_pmv2_tasks_generation` (`programId`, `programTargetId`, `dueDate`),

  KEY `idx_pmv2_tasks_program` (`programId`),
  KEY `idx_pmv2_tasks_program_target` (`programTargetId`),
  KEY `idx_pmv2_tasks_team` (`teamId`),
  KEY `idx_pmv2_tasks_due_date` (`dueDate`),
  KEY `idx_pmv2_tasks_status` (`status`),

  CONSTRAINT `fk_pmv2_tasks_program`
    FOREIGN KEY (`programId`)
    REFERENCES `pmv2_programs` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  CONSTRAINT `fk_pmv2_tasks_program_target`
    FOREIGN KEY (`programTargetId`)
    REFERENCES `pmv2_program_targets` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  CONSTRAINT `fk_pmv2_tasks_team`
    FOREIGN KEY (`teamId`)
    REFERENCES `pmv2_teams` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
