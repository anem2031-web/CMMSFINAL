import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const resolver = read("server/pmv2/materials/material-identity-resolution-service.ts");
const warehouseRouter = read("server/routers/pmv2/warehouse.ts");
const warehousePage = read("client/src/pages/pmv2/Pmv2WarehouseQueue.tsx");
const technicianPage = read("client/src/pages/pmv2/Pmv2MyTasks.tsx");
const requestService = read("server/pmv2/materials/request-service.ts");
const issueService = read("server/pmv2/materials/team-issue-handoff-service.ts");
const adapters = read("server/pmv2/adapters/current-system.ts");

test("Patch 131 gives warehouse an explicit identity-resolution action without changing technician free-text capture", () => {
  assert.match(warehousePage, /تحديد المادة من الدليل/);
  assert.match(warehousePage, /وصف الفني مرجع للمساعدة فقط/);
  assert.match(warehousePage, /البحث مستقل عن وصف الفني/);
  assert.match(warehousePage, /استخدام وصف الفني كبحث/);
  assert.match(technicianPage, /سجّل المادة غير الموجودة في الدليل/);
});

test("warehouse identity search stays inside the existing active Catalog and shows Team/Main stock context", () => {
  assert.match(warehouseRouter, /searchMaterialIdentityCandidates: pmv2WarehouseProcedure/);
  assert.match(resolver, /currentCatalogAdapter\.searchActiveItems\(query, 30\)/);
  assert.match(resolver, /currentInventoryAdapter\.getCatalogAvailabilities\(ids, Number\(context\.teamWarehouseId\)\)/);
  assert.match(resolver, /currentInventoryAdapter\.getCatalogAvailabilities\(ids, Number\(mainWarehouse!\.id\)\)/);
  assert.match(adapters, /like\(catalogItems\.manufacturer/);
  assert.match(adapters, /like\(catalogItems\.descriptionAr/);
  assert.doesNotMatch(resolver, /insert\(catalogItems\)|update\(catalogItems\)|delete\(catalogItems\)/);
});

test("identity resolution is serialized and rechecks live stock before choosing the new route", () => {
  assert.match(resolver, /FOR UPDATE/);
  assert.match(resolver, /requireActiveItem\(catalogItemId\)/);
  assert.match(resolver, /getCatalogAvailability\(catalogItemId, Number\(context\.teamWarehouseId\)\)/);
  assert.match(resolver, /shortageQuantity = roundQuantity\(fullNeedQuantity - teamAvailableQuantity\)/);
  assert.match(resolver, /shortageQuantity <= 0 \? "team_inventory"/);
});

test("full Team-Warehouse stock closes only the obsolete warehouse request and creates a normal self-receive route", () => {
  assert.match(resolver, /status: route === "material_request" \? "waiting_warehouse" : "cancelled"/);
  assert.match(resolver, /materialRequestId: route === "material_request" \? Number\(context\.requestId\) : null/);
  assert.match(resolver, /materialRequestItemId: route === "material_request" \? requestItemId : null/);
  assert.match(technicianPage, /تم حل الهوية — متوفر في مخزن الفريق/);
  assert.match(technicianPage, /يمكن استلامها من زر المادة الجاهزة أعلاه/);
});

test("partial/zero Team stock keeps the same PM V2 request but rewrites it to the true shortage", () => {
  assert.match(resolver, /requestedQuantity: route === "material_request" \? shortageQuantity : fullNeedQuantity/);
  assert.match(resolver, /catalogItemId: nextItemWrite\.catalogItemId/);
  assert.match(resolver, /itemNameSnapshot: nextItemWrite\.itemNameSnapshot/);
  assert.match(resolver, /const nextRouteSnapshot: MaterialRouteDecisionSnapshot = \{[\s\S]*?route,/);
});

test("old unlisted route history remains immutable but stops blocking completion after identity is resolved", () => {
  assert.match(issueService, /Historical free-text route decisions must stop blocking completion/);
  assert.match(issueService, /unlistedRequestItemIds/);
  assert.match(issueService, /row\.catalogItemId == null && !\["cancelled", "consumed"\]\.includes/);
  assert.doesNotMatch(resolver, /delete\(pmv2ItemActions\)/);
});

test("technician sees the warehouse recognition and receives an in-app/push notification", () => {
  assert.match(requestService, /MATERIAL_IDENTITY_RESOLVED_ACTION/);
  assert.match(requestService, /identityResolution: identityByRequestItemId/);
  assert.match(technicianPage, /تم التعرف عليها بواسطة المستودع/);
  assert.match(technicianPage, /وصفك:/);
  assert.match(technicianPage, /الصنف الصحيح:/);
  assert.match(resolver, /createNotification/);
  assert.match(resolver, /تم التعرف على المادة المطلوبة/);
});

test("resolution preserves audit/history and does not create Inventory, Transfer, Purchase, or new Master Data", () => {
  assert.match(resolver, /action: MATERIAL_IDENTITY_RESOLVED_ACTION/);
  assert.match(resolver, /action: "material_identity_resolved"/);
  assert.match(resolver, /originalItemName/);
  assert.doesNotMatch(resolver, /issueDelivery|warehouseTransfers|purchaseOrders|purchaseOrderItems/);
});
