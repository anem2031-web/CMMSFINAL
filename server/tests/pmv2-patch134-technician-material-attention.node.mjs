import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const page = read("client/src/pages/pmv2/Pmv2MyTasks.tsx");
const router = read("server/routers/pmv2/technician.ts");
const service = read("server/pmv2/materials/technician-attention-service.ts");

test("technician has a persistent material attention surface above task cards", () => {
  assert.match(page, /مواد تحتاج انتباهك/);
  assert.match(page, /تبقى حالات المواد هنا أعلى المهام حتى تنتهي أو تستلم المادة/);
  assert.match(page, /materialAttention\.useQuery/);
  assert.match(page, /refetchInterval:\s*60_000/);
});

test("attention cards preserve identity-resolution context and current material quantities", () => {
  assert.match(page, /ما سجلته سابقًا:/);
  assert.match(page, /تم التعرف عليها بواسطة المستودع/);
  assert.match(page, /المتوفر في مخزن الفريق عند آخر تقييم/);
  assert.match(page, /النقص:/);
});

test("ready material can be opened or received from the persistent attention card with confirmation", () => {
  assert.match(page, /فتح المهمة/);
  assert.match(page, /استلام المواد من مخزن الفريق/);
  assert.match(page, /تأكيد استلام المادة من مخزن الفريق/);
  assert.match(page, /receiveAttentionMaterial\.mutate\(\{ routeDecisionActionId:/);
});

test("technician router exposes materialAttention through PMV2 technician authorization", () => {
  assert.match(router, /materialAttention:\s*pmv2TechnicianProcedure\.query/);
  assert.match(router, /pmv2TechnicianMaterialAttentionService\.list\(ctx\.user\.id\)/);
});

test("attention service keeps old unlisted route as history and uses the resolved route", () => {
  assert.match(service, /material_identity_resolved/);
  assert.match(service, /requestIdentity\.routeDecisionActionId !== actionId/);
  assert.match(service, /identityResolved:\s*Boolean\(identity\)/);
});

test("attention service only shows the requesting technician's material need and drops it after receipt", () => {
  assert.match(service, /ownerUserId !== userId/);
  assert.match(service, /requestStatus === "issued_to_team" && !ready/);
  assert.match(service, /snapshot\.route === "team_inventory" && !ready/);
});
