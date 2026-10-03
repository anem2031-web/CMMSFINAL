import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const teamsSql = readFileSync(
  new URL("../../drizzle/2026_09_07_pmv2_teams.sql", import.meta.url),
  "utf8",
);

const teamMembersSql = readFileSync(
  new URL("../../drizzle/2026_09_07_pmv2_team_members.sql", import.meta.url),
  "utf8",
);

const checklistsSql = readFileSync(
  new URL("../../drizzle/2026_09_07_pmv2_checklists.sql", import.meta.url),
  "utf8",
);

const checklistItemsSql = readFileSync(
  new URL("../../drizzle/2026_09_08_pmv2_checklist_items.sql", import.meta.url),
  "utf8",
);

const programsSql = readFileSync(
  new URL("../../drizzle/2026_09_08_pmv2_programs.sql", import.meta.url),
  "utf8",
);


const programTargetsSql = readFileSync(
  new URL("../../drizzle/2026_09_08_pmv2_program_targets.sql", import.meta.url),
  "utf8",
);

const tasksSql = readFileSync(
  new URL("../../drizzle/2026_09_08_pmv2_tasks.sql", import.meta.url),
  "utf8",
);

const taskItemsSql = readFileSync(
  new URL("../../drizzle/2026_09_08_pmv2_task_items.sql", import.meta.url),
  "utf8",
);

const visitsSql = readFileSync(
  new URL("../../drizzle/2026_09_08_pmv2_visits.sql", import.meta.url),
  "utf8",
);

const visitMembersSql = readFileSync(
  new URL("../../drizzle/2026_09_08_pmv2_visit_members.sql", import.meta.url),
  "utf8",
);

const itemActionsSql = readFileSync(
  new URL("../../drizzle/2026_09_08_pmv2_item_actions.sql", import.meta.url),
  "utf8",
);

const materialRequestsSql = readFileSync(
  new URL("../../drizzle/2026_09_08_pmv2_material_requests.sql", import.meta.url),
  "utf8",
);

const materialRequestItemsSql = readFileSync(
  new URL("../../drizzle/2026_09_08_pmv2_material_request_items.sql", import.meta.url),
  "utf8",
);

const materialPurchaseLinksSql = readFileSync(
  new URL("../../drizzle/2026_09_08_pmv2_material_purchase_links.sql", import.meta.url),
  "utf8",
);

const taskTicketLinksSql = readFileSync(
  new URL("../../drizzle/2026_09_08_pmv2_task_ticket_links.sql", import.meta.url),
  "utf8",
);

const materialUsagesSql = readFileSync(
  new URL("../../drizzle/2026_09_08_pmv2_material_usages.sql", import.meta.url),
  "utf8",
);

const requestRemindersSql = readFileSync(
  new URL("../../drizzle/2026_09_08_pmv2_request_reminders.sql", import.meta.url),
  "utf8",
);

describe("PM V2 Phase 1 schema ownership contract", () => {
  it("uses a physical FK for the internal Team -> Specialty relation", () => {
    expect(teamsSql).toContain("CONSTRAINT `fk_pmv2_teams_specialty`");
    expect(teamsSql).toContain("FOREIGN KEY (`specialtyId`)");
    expect(teamsSql).toContain("REFERENCES `pmv2_specialties` (`id`)");
  });

  it("indexes external warehouse/user references without physical external FKs", () => {
    expect(teamsSql).toContain("KEY `idx_pmv2_teams_warehouse` (`warehouseId`)");
    expect(teamsSql).toContain("KEY `idx_pmv2_teams_device_user` (`deviceUserId`)");

    expect(teamsSql).not.toMatch(/FOREIGN KEY \(`warehouseId`\)/);
    expect(teamsSql).not.toMatch(/FOREIGN KEY \(`deviceUserId`\)/);
    expect(teamsSql).not.toMatch(/REFERENCES `warehouses`/);
    expect(teamsSql).not.toMatch(/REFERENCES `users`/);
  });

  it("uses a physical FK for Team Member -> Team and no physical FK to users", () => {
    expect(teamMembersSql).toContain("CONSTRAINT `fk_pmv2_team_members_team`");
    expect(teamMembersSql).toContain("FOREIGN KEY (`teamId`)");
    expect(teamMembersSql).toContain("REFERENCES `pmv2_teams` (`id`)");
    expect(teamMembersSql).toContain("KEY `idx_pmv2_team_members_user` (`userId`)");
    expect(teamMembersSql).not.toMatch(/FOREIGN KEY \(`userId`\)/);
    expect(teamMembersSql).not.toMatch(/REFERENCES `users`/);
  });

  it("freezes one membership row per Team/User pair", () => {
    expect(teamMembersSql).toContain(
      "UNIQUE KEY `uq_pmv2_team_members_team_user` (`teamId`, `userId`)",
    );
    expect(teamMembersSql).toContain("`joinedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
    expect(teamMembersSql).toContain("`leftAt` TIMESTAMP NULL DEFAULT NULL");
  });
  it("keeps the Checklist header PM V2-owned without external physical FKs", () => {
    expect(checklistsSql).toContain("CREATE TABLE `pmv2_checklists`");
    expect(checklistsSql).toContain("`isActive` TINYINT NOT NULL DEFAULT 1");
    expect(checklistsSql).toContain("KEY `idx_pmv2_checklists_created_by` (`createdById`)");
    expect(checklistsSql).not.toMatch(/FOREIGN KEY/);
    expect(checklistsSql).not.toMatch(/REFERENCES `users`/);
  });

  it("freezes Checklist Item ownership and recurrence fields without external FKs", () => {
    expect(checklistItemsSql).toContain("CREATE TABLE `pmv2_checklist_items`");
    expect(checklistItemsSql).toContain("FOREIGN KEY (`checklistId`)");
    expect(checklistItemsSql).toContain("REFERENCES `pmv2_checklists` (`id`)");
    expect(checklistItemsSql).toContain("`frequency` ENUM('daily','weekly','monthly','quarterly','biannual','annual') NOT NULL");
    expect(checklistItemsSql).toContain("`frequencyValue` INT NULL");
    expect(checklistItemsSql).toContain("`weekday` TINYINT NULL");
    expect(checklistItemsSql).toContain("`monthDay` TINYINT NULL");
    expect(checklistItemsSql).toContain("`anchorDate` DATE NULL");
    expect(checklistItemsSql).not.toMatch(/\bCHECK\s*\(/);
    expect(checklistItemsSql).not.toMatch(/REFERENCES `users`/);
    expect(checklistItemsSql).not.toMatch(/REFERENCES `sites`/);
    expect(checklistItemsSql).not.toMatch(/REFERENCES `warehouses`/);
  });

  it("keeps Program ownership inside PM V2 with internal FKs only", () => {
    expect(programsSql).toContain("CREATE TABLE `pmv2_programs`");
    expect(programsSql).toContain("FOREIGN KEY (`teamId`)");
    expect(programsSql).toContain("REFERENCES `pmv2_teams` (`id`)");
    expect(programsSql).toContain("FOREIGN KEY (`checklistId`)");
    expect(programsSql).toContain("REFERENCES `pmv2_checklists` (`id`)");
    expect(programsSql).toContain("KEY `idx_pmv2_programs_created_by` (`createdById`)");
    expect(programsSql).not.toMatch(/FOREIGN KEY \(`createdById`\)/);
    expect(programsSql).not.toMatch(/REFERENCES `users`/);
  });

  it("keeps Program Target ownership internal and Master Data references external", () => {
    expect(programTargetsSql).toContain("CREATE TABLE `pmv2_program_targets`");
    expect(programTargetsSql).toContain("FOREIGN KEY (`programId`)");
    expect(programTargetsSql).toContain("REFERENCES `pmv2_programs` (`id`)");
    expect(programTargetsSql).toContain("KEY `idx_pmv2_program_targets_site` (`siteId`)");
    expect(programTargetsSql).toContain("KEY `idx_pmv2_program_targets_section` (`sectionId`)");
    expect(programTargetsSql).toContain("KEY `idx_pmv2_program_targets_asset` (`assetId`)");
    expect(programTargetsSql).not.toMatch(/REFERENCES `sites`/);
    expect(programTargetsSql).not.toMatch(/REFERENCES `sections`/);
    expect(programTargetsSql).not.toMatch(/REFERENCES `assets`/);
    expect(programTargetsSql).not.toMatch(/\bCHECK\s*\(/);
  });

  it("freezes Task internal ownership and scheduler idempotency contract", () => {
    expect(tasksSql).toContain("CREATE TABLE `pmv2_tasks`");
    expect(tasksSql).toContain("REFERENCES `pmv2_programs` (`id`)");
    expect(tasksSql).toContain("REFERENCES `pmv2_program_targets` (`id`)");
    expect(tasksSql).toContain("REFERENCES `pmv2_teams` (`id`)");
    expect(tasksSql).toContain("UNIQUE KEY `uq_pmv2_tasks_task_number` (`taskNumber`)");
    expect(tasksSql).toContain("UNIQUE KEY `uq_pmv2_tasks_generation` (`programId`, `programTargetId`, `dueDate`)");
    expect(tasksSql).not.toMatch(/REFERENCES `(users|sites|sections|assets|warehouses)`/);
  });

  it("freezes Task Item ownership, snapshots, states, results and generation idempotency", () => {
    expect(taskItemsSql).toContain("CREATE TABLE `pmv2_task_items`");
    expect(taskItemsSql).toContain("REFERENCES `pmv2_tasks` (`id`)");
    expect(taskItemsSql).toContain("REFERENCES `pmv2_checklist_items` (`id`)");
    expect(taskItemsSql).toContain("`titleSnapshot` VARCHAR(300) NOT NULL");
    expect(taskItemsSql).toContain("`sortOrderSnapshot` INT NOT NULL DEFAULT 0");
    expect(taskItemsSql).toContain("`scheduledDate` DATE NOT NULL");
    expect(taskItemsSql).toContain("UNIQUE KEY `uq_pmv2_task_items_generation`");
    expect(taskItemsSql).toContain("(`taskId`, `sourceChecklistItemId`, `scheduledDate`)");
    for (const state of ["pending", "in_progress", "waiting_material", "waiting_ticket", "ready_to_complete", "completed"]) {
      expect(taskItemsSql).toContain(`'${state}'`);
    }
    for (const result of ["ok", "fixed", "needs_material", "needs_ticket"]) {
      expect(taskItemsSql).toContain(`'${result}'`);
    }
    expect(taskItemsSql).not.toMatch(/REFERENCES `(users|sites|sections|assets|warehouses)`/);
  });

  it("freezes Visit ownership under Task without external Master Data FKs", () => {
    expect(visitsSql).toContain("CREATE TABLE `pmv2_visits`");
    expect(visitsSql).toContain("FOREIGN KEY (`taskId`)");
    expect(visitsSql).toContain("REFERENCES `pmv2_tasks` (`id`)");
    expect(visitsSql).toContain("`startedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
    expect(visitsSql).toContain("`endedAt` TIMESTAMP NULL DEFAULT NULL");
    expect(visitsSql).not.toMatch(/REFERENCES `(users|sites|sections|assets|warehouses)`/);
  });

  it("freezes Visit Member ownership with internal Visit FK and external User reference", () => {
    expect(visitMembersSql).toContain("CREATE TABLE `pmv2_visit_members`");
    expect(visitMembersSql).toContain("FOREIGN KEY (`visitId`)");
    expect(visitMembersSql).toContain("REFERENCES `pmv2_visits` (`id`)");
    expect(visitMembersSql).toContain("KEY `idx_pmv2_visit_members_user` (`userId`)");
    expect(visitMembersSql).toContain("UNIQUE KEY `uq_pmv2_visit_members_visit_user` (`visitId`, `userId`)");
    expect(visitMembersSql).toContain("`isLeader` TINYINT NOT NULL DEFAULT 0");
    expect(visitMembersSql).not.toMatch(/FOREIGN KEY \(`userId`\)/);
    expect(visitMembersSql).not.toMatch(/REFERENCES `users`/);
    expect(visitMembersSql).not.toMatch(/\bCHECK\s*\(/);
  });

  it("freezes Item Action ownership, technician results, and external performer reference", () => {
    expect(itemActionsSql).toContain("CREATE TABLE `pmv2_item_actions`");
    expect(itemActionsSql).toContain("FOREIGN KEY (`taskItemId`)");
    expect(itemActionsSql).toContain("REFERENCES `pmv2_task_items` (`id`)");
    expect(itemActionsSql).toContain("FOREIGN KEY (`visitId`)");
    expect(itemActionsSql).toContain("REFERENCES `pmv2_visits` (`id`)");
    expect(itemActionsSql).toContain("`action` VARCHAR(50) NOT NULL");
    expect(itemActionsSql).toContain("`note` TEXT NULL");
    for (const result of ["ok", "fixed", "needs_material", "needs_ticket"]) {
      expect(itemActionsSql).toContain(`'${result}'`);
    }
    expect(itemActionsSql).toContain("KEY `idx_pmv2_item_actions_performed_by` (`performedById`)");
    expect(itemActionsSql).not.toMatch(/FOREIGN KEY \(`performedById`\)/);
    expect(itemActionsSql).not.toMatch(/REFERENCES `users`/);
    expect(itemActionsSql).not.toMatch(/REFERENCES `attachments`/);
  });

  it("freezes Material Request header ownership without duplicate header status", () => {
    expect(materialRequestsSql).toContain("CREATE TABLE `pmv2_material_requests`");
    expect(materialRequestsSql).toContain("REFERENCES `pmv2_task_items` (`id`)");
    expect(materialRequestsSql).toContain("REFERENCES `pmv2_visits` (`id`)");
    expect(materialRequestsSql).toContain("REFERENCES `pmv2_teams` (`id`)");
    expect(materialRequestsSql).toContain("KEY `idx_pmv2_material_requests_requested_by` (`requestedById`)");
    expect(materialRequestsSql).toContain("KEY `idx_pmv2_material_requests_team_warehouse` (`teamWarehouseId`)");
    expect(materialRequestsSql).not.toMatch(/FOREIGN KEY \(`requestedById`\)/);
    expect(materialRequestsSql).not.toMatch(/FOREIGN KEY \(`teamWarehouseId`\)/);
    expect(materialRequestsSql).not.toMatch(/REFERENCES `(users|warehouses)`/);
    expect(materialRequestsSql).not.toMatch(/`status`/);
  });

  it("freezes Material Request Item ownership, quantities, states and external Catalog reference", () => {
    expect(materialRequestItemsSql).toContain("CREATE TABLE `pmv2_material_request_items`");
    expect(materialRequestItemsSql).toContain("FOREIGN KEY (`requestId`)");
    expect(materialRequestItemsSql).toContain("REFERENCES `pmv2_material_requests` (`id`)");
    expect(materialRequestItemsSql).toContain("KEY `idx_pmv2_material_request_items_catalog_item` (`catalogItemId`)");
    expect(materialRequestItemsSql).not.toMatch(/FOREIGN KEY \(`catalogItemId`\)/);
    expect(materialRequestItemsSql).not.toMatch(/REFERENCES `catalog_items`/);
    expect(materialRequestItemsSql).toContain("`requestedQuantity` DECIMAL(12,3) NOT NULL");
    expect(materialRequestItemsSql).toContain("`receivedWarehouseQuantity` DECIMAL(12,3) NOT NULL DEFAULT 0.000");
    expect(materialRequestItemsSql).toContain("`issuedToTeamQuantity` DECIMAL(12,3) NOT NULL DEFAULT 0.000");
    for (const state of ["waiting_warehouse", "external_purchase", "received_warehouse", "issued_to_team", "consumed", "cancelled"]) {
      expect(materialRequestItemsSql).toContain(`'${state}'`);
    }
    expect(materialRequestItemsSql).not.toMatch(/\bCHECK\s*\(/);
    expect(materialRequestItemsSql).not.toMatch(/REFERENCES `(inventory|purchase_orders|purchase_order_items)`/);
  });

  it("freezes Purchase Source Link ownership without taking over the current Purchase workflow", () => {
    expect(materialPurchaseLinksSql).toContain("CREATE TABLE `pmv2_material_purchase_links`");
    expect(materialPurchaseLinksSql).toContain("FOREIGN KEY (`materialRequestItemId`)");
    expect(materialPurchaseLinksSql).toContain("REFERENCES `pmv2_material_request_items` (`id`)");
    expect(materialPurchaseLinksSql).toContain("UNIQUE KEY `uq_pmv2_material_purchase_links_po_item` (`purchaseOrderItemId`)");
    expect(materialPurchaseLinksSql).toContain("UNIQUE KEY `uq_pmv2_material_purchase_links_request_po_item`");
    expect(materialPurchaseLinksSql).toContain("KEY `idx_pmv2_material_purchase_links_purchase_order` (`purchaseOrderId`)");
    expect(materialPurchaseLinksSql).toContain("KEY `idx_pmv2_material_purchase_links_created_by` (`createdById`)");
    expect(materialPurchaseLinksSql).not.toMatch(/FOREIGN KEY \(`purchaseOrderId`\)/);
    expect(materialPurchaseLinksSql).not.toMatch(/FOREIGN KEY \(`purchaseOrderItemId`\)/);
    expect(materialPurchaseLinksSql).not.toMatch(/FOREIGN KEY \(`createdById`\)/);
    expect(materialPurchaseLinksSql).not.toMatch(/REFERENCES `(purchase_orders|purchase_order_items|users)`/);
    expect(materialPurchaseLinksSql).not.toMatch(/`status`/);
  });

  it("freezes Task-to-Ticket source link without taking over the current Ticket workflow", () => {
    expect(taskTicketLinksSql).toContain("CREATE TABLE `pmv2_task_ticket_links`");
    expect(taskTicketLinksSql).toContain("FOREIGN KEY (`taskItemId`)");
    expect(taskTicketLinksSql).toContain("REFERENCES `pmv2_task_items` (`id`)");
    expect(taskTicketLinksSql).toContain("UNIQUE KEY `uq_pmv2_task_ticket_links_ticket` (`ticketId`)");
    expect(taskTicketLinksSql).toContain("KEY `idx_pmv2_task_ticket_links_created_by` (`createdById`)");
    expect(taskTicketLinksSql).not.toMatch(/FOREIGN KEY \(`ticketId`\)/);
    expect(taskTicketLinksSql).not.toMatch(/FOREIGN KEY \(`createdById`\)/);
    expect(taskTicketLinksSql).not.toMatch(/REFERENCES `(tickets|users)`/);
    expect(taskTicketLinksSql).not.toMatch(/`status`/);
    expect(taskTicketLinksSql).not.toMatch(/maintenancePath|maintenance_path/);
    expect(taskTicketLinksSql).not.toMatch(/`taskId`/);
  });

  it("freezes Material Usage as trace-only with internal PM V2 links and external inventory evidence", () => {
    expect(materialUsagesSql).toContain("CREATE TABLE `pmv2_material_usages`");
    expect(materialUsagesSql).toContain("REFERENCES `pmv2_task_items` (`id`)");
    expect(materialUsagesSql).toContain("REFERENCES `pmv2_visits` (`id`)");
    expect(materialUsagesSql).toContain("`materialRequestItemId` INT NULL");
    expect(materialUsagesSql).toContain("REFERENCES `pmv2_material_request_items` (`id`)");
    expect(materialUsagesSql).toContain("`usedQuantity` DECIMAL(12,3) NOT NULL");
    expect(materialUsagesSql).toContain("KEY `idx_pmv2_material_usages_inventory_tx` (`inventoryTransactionId`)");
    expect(materialUsagesSql).toContain("KEY `idx_pmv2_material_usages_inventory_lot` (`inventoryLotId`)");
    expect(materialUsagesSql).toContain("KEY `idx_pmv2_material_usages_delivery_document` (`deliveryDocumentId`)");
    expect(materialUsagesSql).not.toMatch(/REFERENCES `(warehouses|catalog_items|inventory_transactions|inventory_lots|delivery_documents|purchase_order_items|users)`/);
    expect(materialUsagesSql).not.toMatch(/`status`/);
    expect(materialUsagesSql).not.toMatch(/\bCHECK\s*\(/);
  });

  it("freezes Request Reminder as a PM V2 trace that reuses the current notification service", () => {
    expect(requestRemindersSql).toContain("CREATE TABLE `pmv2_request_reminders`");
    expect(requestRemindersSql).toContain("FOREIGN KEY (`requestId`)");
    expect(requestRemindersSql).toContain("REFERENCES `pmv2_material_requests` (`id`)");
    expect(requestRemindersSql).toContain("KEY `idx_pmv2_request_reminders_recipient_user` (`recipientUserId`)");
    expect(requestRemindersSql).toContain("KEY `idx_pmv2_request_reminders_notification` (`notificationId`)");
    expect(requestRemindersSql).not.toMatch(/FOREIGN KEY \(`recipientUserId`\)/);
    expect(requestRemindersSql).not.toMatch(/FOREIGN KEY \(`notificationId`\)/);
    expect(requestRemindersSql).not.toMatch(/REFERENCES `(users|notifications)`/);
    expect(requestRemindersSql).not.toMatch(/`status`/);
    expect(requestRemindersSql).not.toMatch(/`title`|`message`|`body`/);
  });

});
