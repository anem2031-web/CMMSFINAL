import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adapterSource = readFileSync(
  new URL("../pmv2/adapters/current-system.ts", import.meta.url),
  "utf8",
);
const serviceSource = readFileSync(
  new URL("../pmv2/organization/service.ts", import.meta.url),
  "utf8",
);
const routerSource = readFileSync(
  new URL("../routers/pmv2/organization.ts", import.meta.url),
  "utf8",
);

describe("PM V2 Phase 1 organization ownership contract", () => {
  it("validates current-system users and warehouses before PM V2 writes", () => {
    expect(serviceSource).toContain("requireActiveUser(input.managerUserId)");
    expect(serviceSource).toContain("requireActiveWarehouse(input.warehouseId)");
    expect(serviceSource).toContain("requireActiveUser(userId)");
    expect(adapterSource).toContain("المستخدم المحدد غير فعال");
    expect(adapterSource).toContain("المستودع المحدد غير فعال");
  });

  it("uses direct JOINs for reads without turning current master data into PM V2 ownership", () => {
    expect(serviceSource).toContain("leftJoin(users");
    expect(serviceSource).toContain("leftJoin(warehouses");
    expect(serviceSource).not.toContain("insert(users)");
    expect(serviceSource).not.toContain("insert(warehouses)");
  });

  it("reactivates the frozen Team/User membership row instead of duplicating it", () => {
    expect(serviceSource).toContain('action = "team_member.reactivated"');
    expect(serviceSource).toContain("joinedAt: sql`CURRENT_TIMESTAMP`");
    expect(serviceSource).toContain("leftAt: null");
  });

  it("protects every organization endpoint with the PM V2 management policy", () => {
    expect(routerSource).not.toContain("protectedProcedure");
    expect(routerSource).toContain("pmv2ManagementProcedure");
  });
});

const targetsSource = readFileSync(
  new URL("../routers/pmv2/targets.ts", import.meta.url),
  "utf8",
);

describe("PM V2 Phase 1 maintenance-target boundary", () => {
  it("reuses current Site/Section/Asset master data through the adapter", () => {
    expect(adapterSource).toContain("currentMaintenanceTargetAdapter");
    expect(adapterSource).toContain(".from(sites)");
    expect(adapterSource).toContain(".from(sections)");
    expect(adapterSource).toContain(".from(assets)");
    expect(adapterSource).not.toContain("insert(sites)");
    expect(adapterSource).not.toContain("insert(sections)");
    expect(adapterSource).not.toContain("insert(assets)");
  });

  it("validates the frozen Site -> Section -> Asset relationship before accepting targets", () => {
    expect(adapterSource).toContain("innerJoin(sites, eq(sites.id, sections.siteId))");
    expect(adapterSource).toContain("eq(sites.id, asset.siteId)");
    expect(adapterSource).toContain('ne(assets.status, "disposed")');
  });

  it("exposes only the three frozen target types", () => {
    expect(targetsSource).toContain('z.literal("site")');
    expect(targetsSource).toContain('z.literal("section")');
    expect(targetsSource).toContain('z.literal("asset")');
  });
});
