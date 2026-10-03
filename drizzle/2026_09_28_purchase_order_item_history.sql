CREATE TABLE IF NOT EXISTS `purchase_order_item_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `purchaseOrderItemId` int NOT NULL,
  `purchaseOrderId` int NOT NULL,
  `eventType` varchar(80) NOT NULL,
  `previousStatus` varchar(50) NULL,
  `newStatus` varchar(50) NULL,
  `previousDelegateId` int NULL,
  `newDelegateId` int NULL,
  `actorUserId` int NULL,
  `actorName` varchar(300) NULL,
  `note` text NULL,
  `metadata` json NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_poi_history_item_created` (`purchaseOrderItemId`,`createdAt`),
  KEY `idx_poi_history_po_created` (`purchaseOrderId`,`createdAt`)
);
