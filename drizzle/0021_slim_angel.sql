CREATE TABLE `asset_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `asset_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inspection_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`assetId` int,
	`inspectorId` int NOT NULL,
	`inspectionType` enum('triage','detailed') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL,
	`rootCause` varchar(500),
	`findings` text,
	`recommendedAction` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inspection_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `procurement_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`userId` int NOT NULL,
	`userName` text NOT NULL,
	`userRole` varchar(50) NOT NULL,
	`actionType` varchar(50) NOT NULL,
	`note` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `procurement_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `purchase_order_items` MODIFY COLUMN `status` enum('pending','estimated','approved','rejected','funded','purchased','delivered_to_warehouse','delivered_to_requester') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `status` enum('draft','pending_review','pending_estimate','pending_accounting','pending_management','approved','partial_purchase','purchased','received','closed','rejected','revision_needed') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `assets` ADD `categoryId` int;