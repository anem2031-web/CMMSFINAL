import { describe, expect, it } from "vitest";
import { APP_ROLE } from "@shared/roles";
import {
  canManagePmv2Foundation,
  PMV2_FOUNDATION_MANAGEMENT_ROLES,
} from "../pmv2/security/policy";
import { buildPmv2AuditRecord } from "../pmv2/audit/service";

describe("PM V2 Phase 1 foundation security", () => {
  it("allows only the Phase 1 maintenance-management baseline", () => {
    for (const role of PMV2_FOUNDATION_MANAGEMENT_ROLES) {
      expect(canManagePmv2Foundation(role)).toBe(true);
    }
  });

  it("defaults to deny for unrelated/current operational roles", () => {
    for (const role of [
      APP_ROLE.TECHNICIAN,
      APP_ROLE.SUPERVISOR,
      APP_ROLE.WAREHOUSE,
      APP_ROLE.PURCHASE_MANAGER,
      APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
      APP_ROLE.USER,
      undefined,
      null,
    ]) {
      expect(canManagePmv2Foundation(role)).toBe(false);
    }
  });
});

describe("PM V2 audit namespace", () => {
  it("reuses the shared audit contract with PM V2-prefixed identity", () => {
    expect(
      buildPmv2AuditRecord({
        actorUserId: 7,
        action: "specialty.created",
        entity: "specialty",
        entityId: 12,
        newValues: { code: "ELEC" },
      }),
    ).toEqual({
      userId: 7,
      action: "pmv2.specialty.created",
      entityType: "pmv2.specialty",
      entityId: 12,
      oldValues: undefined,
      newValues: { code: "ELEC" },
      ipAddress: undefined,
      userAgent: undefined,
    });
  });
});
