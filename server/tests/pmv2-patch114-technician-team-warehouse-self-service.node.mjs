import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const requestService = read("server/pmv2/materials/request-service.ts");
const issueService = read("server/pmv2/materials/team-issue-handoff-service.ts");
const selfService = read("server/pmv2/materials/technician-self-service.ts");
const technicianRouter = read("server/routers/pmv2/technician.ts");
const page = read("client/src/pages/pmv2/Pmv2MyTasks.tsx");


test("Patch 114 exposes the persisted route-decision id needed for immediate self-service issue", () => {
  assert.match(requestService, /const routeDecisionActionId = await writeRouteDecision/);
  assert.match(requestService, /route: "team_inventory" as const[\s\S]*routeDecisionActionId/);
  assert.match(requestService, /route: "material_request" as const[\s\S]*routeDecisionActionId/);
});


test("technician self-service records the PM V2 need first and still issues through the existing Inventory\/Delivery boundary", () => {
  assert.match(selfService, /pmv2MaterialRequestService\.submitMaterialNeed/);
  assert.match(selfService, /if \(route\.route !== "team_inventory"\)/);
  assert.match(selfService, /pmv2TeamIssueHandoffService\.issueReadyRequirementToSelf/);
  assert.match(issueService, /currentInventoryIssueAdapter\.issueDelivery/);
  assert.match(issueService, /استلام ذاتي من مخزن الفريق لمهمة PM V2/);
  assert.doesNotMatch(selfService, /update\(inventory\)|inventoryTransactions|consumeInventoryLotForIssue/);
});


test("shortage routing never performs a default partial self-service issue", () => {
  const shortageBranch = selfService.split('if (route.route !== "team_inventory")', 2)[1]?.split("const issue =", 1)[0] ?? "";
  assert.match(shortageBranch, /receivedFromTeamWarehouse: false/);
  assert.match(shortageBranch, /issue: null/);
  assert.doesNotMatch(shortageBranch, /issueReadyRequirementToSelf/);
  assert.match(page, /تسجيل الاحتياج وطلب النقص/);
  assert.match(page, /لن يتم صرف المتوفر جزئيًا كمسار افتراضي/);
});


test("only an active technician on the same task team can see and perform self-service receipt", () => {
  assert.match(issueService, /async listTechnicianReadyReceipts\(userId: number, taskId: number, taskItemId: number\)/);
  assert.match(issueService, /item\.taskId === taskId/);
  assert.match(issueService, /item\.taskItemId === taskItemId/);
  assert.match(issueService, /item\.technicians\.some\(\(technician: any\) => technician\.id === userId\)/);
  assert.match(issueService, /async issueReadyRequirementToSelf/);
  assert.match(issueService, /deliveredToId: technicianUserId/);
});


test("technician router exposes ready receipt, submit-and-receive, and receive-existing actions behind technician authorization", () => {
  assert.match(technicianRouter, /readyMaterialReceipts: pmv2TechnicianProcedure/);
  assert.match(technicianRouter, /submitAndReceiveMaterialNeed: pmv2TechnicianProcedure/);
  assert.match(technicianRouter, /receiveReadyMaterial: pmv2TechnicianProcedure/);
  assert.match(technicianRouter, /pmv2TechnicianMaterialSelfService\.submitAndReceive/);
  assert.match(technicianRouter, /pmv2TeamIssueHandoffService\.issueReadyRequirementToSelf/);
});


test("full Team-Warehouse availability gives the technician one clear receive action with a confirmation dialog", () => {
  assert.match(page, /fullStockReadyForSelfReceive/);
  assert.match(page, /استلام المواد من مخزن الفريق/);
  assert.match(page, /تأكيد استلام المواد من مخزن الفريق/);
  assert.match(page, /تأكيد الاستلام/);
  assert.match(page, /submitAndReceiveMaterialNeed\.mutate/);
  assert.match(page, /سيُسجل الصرف الحقيقي عبر Inventory\/Delivery الحالي باسمك كمستلم فعلي/);
});


test("after a shortage is replenished, the same technician screen can receive the full remaining need", () => {
  assert.match(page, /readyMaterialReceipts\.useQuery/);
  assert.match(page, /readyReceiptByRequestItem/);
  assert.match(page, /جاهز للاستلام من مخزن الفريق/);
  assert.match(page, /المطلوب للاستلام الكامل/);
  assert.match(page, /receiveReadyMaterial\.mutate/);
});
