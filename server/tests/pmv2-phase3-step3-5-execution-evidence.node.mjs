import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const schema = read("drizzle/schema.ts");
const dbDoc = read("docs/pmv2/03_DATABASE.md");
const readService = read("server/pmv2/technician/read-service.ts");
const evidenceAccess = read("server/pmv2/technician/evidence-access.ts");
const attachmentsAccess = read("server/routers/uploads/attachments.access.ts");
const attachmentsRouter = read("server/routers/uploads/attachments.router.ts");
const technicianRouter = read("server/routers/pmv2/technician.ts");
const page = read("client/src/pages/pmv2/Pmv2MyTasks.tsx");

const attachmentTable = schema.match(/export const attachments = mysqlTable\("attachments", \{[\s\S]*?\n\},\n\(table\)/)?.[0] ?? "";

test("Step 3.5 reuses the existing attachments table and links evidence to Item Action", () => {
  assert.match(attachmentTable, /entityType: varchar/);
  assert.match(attachmentTable, /entityId: int\(\)\.notNull\(\)/);
  assert.match(dbDoc, /الأدلة\/الصور[^\n]*خدمة `attachments` الحالية بربط Entity إلى Item Action/);
  assert.doesNotMatch(schema, /pmv2_(?:item_)?(?:evidence|attachments)/i);
});

test("generic attachment allowlist explicitly admits pmv2_item_action", () => {
  assert.match(attachmentsAccess, /"pmv2_item_action"/);
  assert.match(attachmentsAccess, /assertPmv2ItemActionEvidenceAccess/);
});

test("PM V2 evidence write access requires technician role, active Task-Team membership, own action, and open Visit", () => {
  assert.match(evidenceAccess, /canAccessPmv2TechnicianExecution\(user\.role\)/);
  assert.match(evidenceAccess, /eq\(pmv2TeamMembers\.teamId, pmv2Tasks\.teamId\)/);
  assert.match(evidenceAccess, /eq\(pmv2TeamMembers\.userId, user\.id\)/);
  assert.match(evidenceAccess, /eq\(pmv2TeamMembers\.isActive, 1\)/);
  assert.match(evidenceAccess, /Number\(row\.performedById\) !== Number\(user\.id\)/);
  assert.match(evidenceAccess, /row\.visitEndedAt != null/);
  assert.match(evidenceAccess, /يمكنك إضافة دليل فقط إلى إجراء نفذته أنت/);
  assert.match(evidenceAccess, /لا يمكن إضافة دليل بعد إنهاء الزيارة/);
});

test("PM V2 managers receive review-only evidence access without gaining upload permission", () => {
  assert.match(evidenceAccess, /mode === "read" && canManagePmv2Foundation\(user\.role\)/);
  const writeBlock = evidenceAccess.split('if (mode === "write")', 2)[1] ?? "";
  assert.match(writeBlock, /performedById/);
  assert.match(writeBlock, /visitEndedAt/);
});

test("PM V2 attachment add accepts images only and keeps existing attachment audit", () => {
  assert.match(attachmentsRouter, /input\.entityType === "pmv2_item_action"/);
  assert.match(attachmentsRouter, /startsWith\("image\/"\)/);
  assert.match(attachmentsRouter, /دليل PM V2 في هذه الخطوة يجب أن يكون صورة/);
  assert.match(attachmentsRouter, /action: "add_attachment"/);
  assert.match(attachmentsRouter, /entityType: input\.entityType/);
});

test("technician evidence read rechecks exact Task Item ownership and active Team membership", () => {
  const method = readService.split("async getItemEvidence", 2)[1]?.split("async listTaskItems", 1)[0] ?? "";
  assert.match(method, /eq\(pmv2Tasks\.id, taskId\)/);
  assert.match(method, /eq\(pmv2TaskItems\.id, taskItemId\)/);
  assert.match(method, /eq\(pmv2TaskItems\.taskId, taskId\)/);
  assert.match(method, /eq\(pmv2TeamMembers\.userId, userId\)/);
  assert.match(method, /eq\(pmv2TeamMembers\.isActive, 1\)/);
});

test("evidence listing spans all Item Actions while upload target stays on the technician's action in exactly one open Visit", () => {
  const method = readService.split("async getItemEvidence", 2)[1]?.split("async listTaskItems", 1)[0] ?? "";
  assert.match(method, /eq\(attachments\.entityType, "pmv2_item_action"\)/);
  assert.match(method, /eq\(attachments\.entityId, pmv2ItemActions\.id\)/);
  assert.match(method, /eq\(pmv2ItemActions\.taskItemId, taskItemId\)/);
  assert.match(method, /isNull\(pmv2Visits\.endedAt\)/);
  assert.match(method, /openVisits\.length > 1/);
  assert.match(method, /Number\(row\.performedById\) === Number\(userId\)/);
  assert.match(method, /uploadActionId/);
});

test("technician API exposes evidence through the existing PM V2 technician permission", () => {
  assert.match(technicianRouter, /evidence: pmv2TechnicianProcedure/);
  assert.match(technicianRouter, /taskItemId: z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(technicianRouter, /pmv2TechnicianReadService\.getItemEvidence\(ctx\.user\.id, input\.taskId, input\.taskItemId\)/);
});

test("My Tasks uploads an optional image through existing upload + attachments services and renders stored evidence", () => {
  assert.match(page, /trpc\.pmv2\.technician\.evidence\.useQuery/);
  assert.match(page, /fetch\("\/api\/upload"/);
  assert.match(page, /trpc\.attachments\.add\.useMutation/);
  assert.match(page, /entityType: "pmv2_item_action"/);
  assert.match(page, /accept="image\/\*,\.heic,\.heif"/);
  assert.match(page, /إضافة صورة \/ دليل/);
  assert.match(page, /الصورة اختيارية/);
  assert.match(page, /mediaUrl\(file\.fileUrl \|\| file\.fileKey\)/);
});

test("evidence cache is refreshed after start/result/end Visit state changes", () => {
  assert.match(page, /utils\.pmv2\.technician\.evidence\.invalidate\(\{ taskId: data\.taskId, taskItemId: data\.taskItemId \}\)/);
  assert.match(page, /utils\.pmv2\.technician\.evidence\.invalidate\(\)/);
});
