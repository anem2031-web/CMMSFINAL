CREATE TABLE `pmv2_material_purchase_links` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `materialRequestItemId` INT NOT NULL,
  `purchaseOrderId` INT NOT NULL,
  `purchaseOrderItemId` INT NOT NULL,
  `linkedQuantity` DECIMAL(12,3) NOT NULL,
  `createdById` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  UNIQUE KEY `uq_pmv2_material_purchase_links_po_item` (`purchaseOrderItemId`),
  UNIQUE KEY `uq_pmv2_material_purchase_links_request_po_item`
    (`materialRequestItemId`, `purchaseOrderItemId`),

  KEY `idx_pmv2_material_purchase_links_request_item` (`materialRequestItemId`),
  KEY `idx_pmv2_material_purchase_links_purchase_order` (`purchaseOrderId`),
  KEY `idx_pmv2_material_purchase_links_created_by` (`createdById`),

  CONSTRAINT `fk_pmv2_material_purchase_links_request_item`
    FOREIGN KEY (`materialRequestItemId`)
    REFERENCES `pmv2_material_request_items` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
