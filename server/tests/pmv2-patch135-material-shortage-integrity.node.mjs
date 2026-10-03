import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const page = read("client/src/pages/pmv2/Pmv2MyTasks.tsx");
const requestService = read("server/pmv2/materials/request-service.ts");
const identityResolver = read("server/pmv2/materials/material-identity-resolution-service.ts");
const attention = read("server/pmv2/materials/technician-attention-service.ts");

test("full Team-Warehouse coverage stays out of warehouse request flow", () => {
  assert.match(requestService, /if \(catalogItemId !== null && availableQuantity >= quantity\)/);
  assert.match(requestService, /route: "team_inventory"/);
  assert.match(requestService, /materialRequestCreated: false/);
  assert.match(requestService, /shortageQuantity: 0/);
});

test("partial Team-Warehouse coverage creates only the true shortage", () => {
  assert.match(requestService, /quantity - availableQuantity/);
  assert.match(requestService, /requestedQuantity: shortageQuantity/);
  assert.match(requestService, /requestedTotalQuantity: quantity/);
  assert.match(requestService, /availableTeamQuantity:/);
  assert.match(requestService, /shortageQuantity,/);
});

test("identity resolution rechecks live Team-Warehouse stock and rewrites the same request to the shortage", () => {
  assert.match(identityResolver, /getCatalogAvailability\(catalogItemId, Number\(context\.teamWarehouseId\)\)/);
  assert.match(identityResolver, /shortageQuantity = roundQuantity\(fullNeedQuantity - teamAvailableQuantity\)/);
  assert.match(identityResolver, /requestedQuantity: route === "material_request" \? shortageQuantity : fullNeedQuantity/);
  assert.match(identityResolver, /status: route === "material_request" \? "waiting_warehouse" : "cancelled"/);
});

test("server-side duplicate protection keeps one active request per material and task item", () => {
  assert.match(requestService, /notInArray\(pmv2MaterialRequestItems\.status, \["consumed", "cancelled"\]\)/);
  assert.match(requestService, /يوجد بالفعل طلب مواد فعال لهذه المادة على نفس البند/);
});

test("active catalog duplicate guard also includes catalog identity resolved by warehouse", () => {
  assert.match(page, /const identityResolution = request\.identityResolution as any;/);
  assert.match(page, /resolvedCatalogItemId/);
  assert.match(page, /blockedCatalogItemIds\.has\(Number\(catalogItemId\)\)/);
});

test("technician attention derives remaining shortage from quantity issued into Team Warehouse", () => {
  assert.match(attention, /function remainingShortage\(initialShortage: unknown, issuedToTeam: unknown\)/);
  assert.match(attention, /remainingShortage\(initialShortageQuantity, warehouseIssuedToTeamQuantity\)/);
  assert.match(attention, /initialShortageQuantity,/);
  assert.match(attention, /warehouseReceivedQuantity,/);
  assert.match(attention, /warehouseIssuedToTeamQuantity,/);
});

test("attention UI distinguishes original shortage from the still-outstanding shortage", () => {
  assert.match(page, /النقص عند التسجيل:/);
  assert.match(page, /المتبقي من النقص:/);
  assert.match(page, /تم استكمال النقص لمخزن الفريق/);
  assert.match(page, /وصل للمستودع الرئيسي:/);
  assert.match(page, /حُوّل لمخزن الفريق:/);
});
