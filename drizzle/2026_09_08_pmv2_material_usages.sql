CREATE TABLE `pmv2_material_usages` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `taskItemId` INT NOT NULL,
  `visitId` INT NOT NULL,
  `materialRequestItemId` INT NULL,
  `warehouseId` INT NOT NULL,
  `catalogItemId` INT NOT NULL,
  `inventoryTransactionId` INT NULL,
  `inventoryLotId` INT NULL,
  `deliveryDocumentId` INT NULL,
  `purchaseOrderItemId` INT NULL,
  `usedQuantity` DECIMAL(12,3) NOT NULL,
  `unitSnapshot` VARCHAR(50) NULL,
  `recordedById` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  KEY `idx_pmv2_material_usages_task_item` (`taskItemId`),
  KEY `idx_pmv2_material_usages_visit` (`visitId`),
  KEY `idx_pmv2_material_usages_request_item` (`materialRequestItemId`),
  KEY `idx_pmv2_material_usages_warehouse` (`warehouseId`),
  KEY `idx_pmv2_material_usages_catalog_item` (`catalogItemId`),
  KEY `idx_pmv2_material_usages_inventory_tx` (`inventoryTransactionId`),
  KEY `idx_pmv2_material_usages_inventory_lot` (`inventoryLotId`),
  KEY `idx_pmv2_material_usages_delivery_document` (`deliveryDocumentId`),
  KEY `idx_pmv2_material_usages_po_item` (`purchaseOrderItemId`),
  KEY `idx_pmv2_material_usages_recorded_by` (`recordedById`),
  KEY `idx_pmv2_material_usages_created_at` (`createdAt`),

  CONSTRAINT `fk_pmv2_material_usages_task_item`
    FOREIGN KEY (`taskItemId`)
    REFERENCES `pmv2_task_items` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  CONSTRAINT `fk_pmv2_material_usages_visit`
    FOREIGN KEY (`visitId`)
    REFERENCES `pmv2_visits` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  CONSTRAINT `fk_pmv2_material_usages_request_item`
    FOREIGN KEY (`materialRequestItemId`)
    REFERENCES `pmv2_material_request_items` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
