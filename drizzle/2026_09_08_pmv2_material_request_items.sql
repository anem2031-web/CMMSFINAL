CREATE TABLE `pmv2_material_request_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `requestId` INT NOT NULL,
  `catalogItemId` INT NULL,
  `itemNameSnapshot` VARCHAR(300) NOT NULL,
  `requestedQuantity` DECIMAL(12,3) NOT NULL,
  `unitSnapshot` VARCHAR(50) NULL,
  `status` ENUM(
    'waiting_warehouse',
    'external_purchase',
    'received_warehouse',
    'issued_to_team',
    'consumed',
    'cancelled'
  ) NOT NULL DEFAULT 'waiting_warehouse',
  `receivedWarehouseQuantity` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `issuedToTeamQuantity` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  KEY `idx_pmv2_material_request_items_request` (`requestId`),
  KEY `idx_pmv2_material_request_items_catalog_item` (`catalogItemId`),
  KEY `idx_pmv2_material_request_items_status` (`status`),

  CONSTRAINT `fk_pmv2_material_request_items_request`
    FOREIGN KEY (`requestId`)
    REFERENCES `pmv2_material_requests` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
