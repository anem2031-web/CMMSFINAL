-- Patch 124 / reconciled by Patch 125 — Warehouse Issue Batch (WIS)
-- This file now mirrors the exact three manual statements executed in production.
-- تنفيذ يدوي حسب سياسة المشروع: statement واحد فقط في كل خطوة.

CREATE TABLE `warehouse_issue_batch_number_counter` (
  `id` int NOT NULL AUTO_INCREMENT,
  `year` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE `warehouse_issue_batches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `issueNumber` varchar(30) NOT NULL,
  `warehouseId` int NOT NULL,
  `warehouseName` varchar(200) NOT NULL,
  `deliveredToId` int NOT NULL,
  `deliveredToName` varchar(200) NOT NULL,
  `issuedById` int NOT NULL,
  `issuedByName` varchar(200) NOT NULL,
  `notes` text,
  `itemsCount` int NOT NULL DEFAULT 0,
  `status` enum('completed','cancelled') NOT NULL DEFAULT 'completed',
  `printCount` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_warehouse_issue_batches_number` (`issueNumber`),
  KEY `idx_warehouse_issue_batches_warehouse` (`warehouseId`),
  KEY `idx_warehouse_issue_batches_recipient` (`deliveredToId`),
  KEY `idx_warehouse_issue_batches_created_by` (`issuedById`)
);

CREATE TABLE `warehouse_issue_batch_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `batchId` int NOT NULL,
  `deliveryDocumentId` int NOT NULL,
  `deliveryNumber` varchar(30) NOT NULL,
  `inventoryTransactionId` int NOT NULL,
  `inventoryLotId` int NOT NULL,
  `lotCode` varchar(100) NOT NULL,
  `inventoryId` int NOT NULL,
  `catalogItemId` int DEFAULT NULL,
  `itemName` varchar(255) NOT NULL,
  `itemCode` varchar(100) DEFAULT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `unit` varchar(50) DEFAULT NULL,
  `referenceType` varchar(50) DEFAULT NULL,
  `referenceId` int DEFAULT NULL,
  `referenceNumber` varchar(100) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_warehouse_issue_batch_items_batch` (`batchId`),
  KEY `idx_warehouse_issue_batch_items_delivery` (`deliveryDocumentId`),
  KEY `idx_warehouse_issue_batch_items_lot` (`inventoryLotId`)
);
