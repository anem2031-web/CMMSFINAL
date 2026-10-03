ALTER TABLE `pmv2_task_items`
  ADD COLUMN `frequencySnapshot` ENUM('daily','weekly','monthly','quarterly','biannual','annual') NULL AFTER `sortOrderSnapshot`,
  ADD COLUMN `frequencyValueSnapshot` INT NULL AFTER `frequencySnapshot`,
  ADD COLUMN `weekdaySnapshot` TINYINT NULL AFTER `frequencyValueSnapshot`,
  ADD COLUMN `monthDaySnapshot` TINYINT NULL AFTER `weekdaySnapshot`,
  ADD COLUMN `anchorDateSnapshot` DATE NULL AFTER `monthDaySnapshot`;
