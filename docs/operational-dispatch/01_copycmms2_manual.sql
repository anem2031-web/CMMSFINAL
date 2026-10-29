-- Manual execution only, on the trial database copycmms2.
-- Run the checks first, then each DDL statement separately (TiDB).
SELECT DATABASE() AS current_database;
SELECT COLUMN_NAME FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA='copycmms2' AND TABLE_NAME='operational_issue_items' AND COLUMN_NAME='dispatchContext';
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA='copycmms2' AND TABLE_NAME='operational_issue_batches';

-- Run only if dispatchContext is absent.
ALTER TABLE `copycmms2`.`operational_issue_items` ADD COLUMN `dispatchContext` JSON NULL;

-- Run only if the table is absent. Existing orders/items are not rewritten.
CREATE TABLE `copycmms2`.`operational_issue_batches` (
  `orderId` INT NOT NULL,
  `operationKey` VARCHAR(100) COLLATE utf8mb4_bin NOT NULL,
  `requestFingerprint` CHAR(64) NOT NULL,
  `issuedById` INT NOT NULL,
  `inputJson` JSON NOT NULL,
  `resultJson` JSON NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`orderId`),
  UNIQUE KEY `uq_operational_issue_batch_key` (`operationKey`),
  CONSTRAINT `fk_operational_issue_batch_order` FOREIGN KEY (`orderId`)
    REFERENCES `copycmms2`.`operational_issue_orders` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Verify afterwards.
SHOW COLUMNS FROM `copycmms2`.`operational_issue_items` LIKE 'dispatchContext';
SHOW CREATE TABLE `copycmms2`.`operational_issue_batches`;
