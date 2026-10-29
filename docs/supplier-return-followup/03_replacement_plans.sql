-- Manual trial migration ONLY. Existing four tables cannot identify an approved
-- replacement before it has a receipt. No data backfill or production migration.
CREATE TABLE `copycmms2`.`supplier_return_replacement_plans` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `caseId` INT NOT NULL,
  `planNumber` INT NOT NULL,
  `status` ENUM('draft','pending_review','pricing','pending_accounting','pending_management','ready_to_purchase','purchased','partially_received','received','cancelled') NOT NULL DEFAULT 'draft',
  `catalogItemId` INT NULL,
  `itemName` VARCHAR(300) NOT NULL,
  `replacementQuantity` DECIMAL(12,3) NOT NULL,
  `replacementUnit` VARCHAR(50) NOT NULL,
  `originalQuantityCovered` DECIMAL(12,3) NOT NULL,
  `selectedById` INT NOT NULL,
  `selectedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `quotedById` INT NULL,
  `quotedAt` TIMESTAMP NULL DEFAULT NULL,
  `quotedTotal` DECIMAL(18,4) NULL,
  `currency` CHAR(3) NULL,
  `valuationBasis` ENUM('tax_inclusive','tax_exclusive') NULL,
  `catalogSupplierId` INT NULL,
  `supplierName` VARCHAR(300) NULL,
  `supplierCreditId` INT NULL,
  `creditAllocationSettlementId` INT NULL,
  `fundingSettlementId` INT NULL,
  `creditAllocated` DECIMAL(18,4) NULL,
  `additionalFunding` DECIMAL(18,4) NULL,
  `purchaseOrderId` INT NULL,
  `purchaseOrderItemId` INT NULL,
  `revision` INT NOT NULL DEFAULT 0,
  `createdById` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_return_plan_number` (`caseId`,`planNumber`),
  UNIQUE KEY `uq_return_plan_purchase_item` (`purchaseOrderItemId`),
  KEY `idx_return_plan_queue` (`status`,`createdAt`,`id`),
  KEY `idx_return_plan_purchase_order` (`purchaseOrderId`),
  CONSTRAINT `fk_return_plan_case` FOREIGN KEY (`caseId`)
    REFERENCES `copycmms2`.`supplier_return_cases` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_return_plan_credit` FOREIGN KEY (`supplierCreditId`)
    REFERENCES `copycmms2`.`supplier_return_settlements` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_return_plan_allocation` FOREIGN KEY (`creditAllocationSettlementId`)
    REFERENCES `copycmms2`.`supplier_return_settlements` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_return_plan_funding` FOREIGN KEY (`fundingSettlementId`)
    REFERENCES `copycmms2`.`supplier_return_settlements` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
