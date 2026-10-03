CREATE TABLE IF NOT EXISTS `catalog_code_aliases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entityType` enum('node','item') NOT NULL,
  `entityId` int NOT NULL,
  `oldCode` varchar(100) NOT NULL,
  `newCode` varchar(100) NOT NULL,
  `createdById` int NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_catalog_code_alias_entity_old` (`entityType`,`oldCode`),
  KEY `idx_catalog_code_alias_entity_id` (`entityType`,`entityId`)
);
