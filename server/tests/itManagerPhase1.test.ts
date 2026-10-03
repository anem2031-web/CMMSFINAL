import { describe, expect, it } from "vitest";
import {
  APP_ROLE,
  MAINTENANCE_RESPONSIBLE_DEPARTMENT,
  canRoleAccessPath,
  canRoleExecutePmv2Technician,
  canRoleManagePmv2,
} from "../../shared/roles";
import {
  canManageTicketItemWorkflow,
  canManageTicketWorkflow,
  isTicketReadOnlyForUser,
  isTicketVisible,
} from "../routers/tickets/tickets.access";

const itManager = { id: 70, role: APP_ROLE.IT_MANAGER };
const maintenanceManager = { id: 10, role: APP_ROLE.MAINTENANCE_MANAGER };
const generalManager = { id: 11, role: APP_ROLE.GENERAL_MAINTENANCE_MANAGER };
const constructionManager = { id: 12, role: APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER };
const owner = { id: 1, role: APP_ROLE.OWNER };

const itTicket = {
  id: 500,
  status: "under_inspection",
  reportedById: 99,
  assignedToId: 70,
  assignedTechnicianId: null,
  maintenanceResponsibleDepartment: MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT,
  maintenanceResponsibleManagerId: 70,
};

describe("IT manager phase 2 access contract", () => {
  it("defines an independent IT role and department", () => {
    expect(APP_ROLE.IT_MANAGER).toBe("it_manager");
    expect(MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT).toBe("maintenance_report_department_it");
  });

  it("scopes IT manager visibility to own/routed tickets", () => {
    expect(isTicketVisible(itManager, itTicket)).toBe(true);
    expect(isTicketVisible(itManager, { ...itTicket, id: 501, reportedById: 99, assignedToId: null, maintenanceResponsibleManagerId: 88 })).toBe(false);
    expect(isTicketVisible(itManager, { ...itTicket, id: 502, reportedById: 70, assignedToId: null, maintenanceResponsibleDepartment: MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL, maintenanceResponsibleManagerId: 11 })).toBe(true);
  });

  it("opens A/B/C only for the exact routed IT manager", () => {
    expect(canManageTicketWorkflow(itManager, itTicket)).toBe(true);
    expect(canManageTicketWorkflow({ id: 71, role: APP_ROLE.IT_MANAGER }, itTicket)).toBe(false);
    expect(canManageTicketItemWorkflow(itManager, {
      responsibleDepartment: MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT,
      responsibleManagerId: 70,
      assignedToId: 70,
    })).toBe(true);
    expect(canManageTicketItemWorkflow({ id: 71, role: APP_ROLE.IT_MANAGER }, {
      responsibleDepartment: MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT,
      responsibleManagerId: 70,
      assignedToId: 70,
    })).toBe(false);
  });

  it("makes IT tickets read-only for maintenance and construction managers", () => {
    for (const manager of [maintenanceManager, generalManager, constructionManager]) {
      expect(isTicketVisible(manager, itTicket)).toBe(true);
      expect(canManageTicketWorkflow(manager, itTicket)).toBe(false);
      expect(isTicketReadOnlyForUser(manager, itTicket)).toBe(true);
    }
    expect(canManageTicketWorkflow(owner, itTicket)).toBe(true);
    expect(isTicketReadOnlyForUser(owner, itTicket)).toBe(false);
  });

  it("opens only ticket and own purchase-order routes in phase 2", () => {
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/tickets")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/tickets/inbox")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/tickets/new")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/tickets/123")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/purchase-orders")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/purchase-orders/new?ticketId=500")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/scheduled-maintenance/my-tasks")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/scheduled-maintenance")).toBe(false);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/scheduled-maintenance/reports")).toBe(false);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/triage")).toBe(false);
  });

  it("allows PM V2 execution without PM V2 management", () => {
    expect(canRoleExecutePmv2Technician(APP_ROLE.IT_MANAGER)).toBe(true);
    expect(canRoleManagePmv2(APP_ROLE.IT_MANAGER)).toBe(false);
  });
});
