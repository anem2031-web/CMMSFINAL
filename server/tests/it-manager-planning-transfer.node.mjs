import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const router = read("server/routers/tickets/tickets.router.ts");
const workflow = read("server/routers/tickets/tickets.workflow.ts");
const detail = read("client/src/pages/tickets/TicketDetail.tsx");

function block(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing start marker: ${start}`);
  const to = source.indexOf(end, from);
  assert.notEqual(to, -1, `missing end marker: ${end}`);
  return source.slice(from, to);
}

test("IT ticket creation stops at department planning and does not auto-create a task/sub-ticket", () => {
  const helper = block(router, "async function createDirectItPlanningTicket", "async function recordDirectItRouting");
  assert.match(helper, /status:\s*"department_planning"/);
  assert.match(helper, /department:\s*MAINTENANCE_RESPONSIBLE_DEPARTMENT\.IT/);
  assert.match(helper, /status:\s*"planning"/);
  assert.doesNotMatch(helper, /createTicketTask/);
  assert.doesNotMatch(helper, /workflowModel:\s*"sub_ticket"/);
  assert.doesNotMatch(helper, /allocateNextSubTicketSequence/);
});

test("new IT notification points to the parent planning ticket", () => {
  const recorder = block(router, "async function recordDirectItRouting", "export const ticketsRouter");
  assert.match(recorder, /title:\s*"بلاغ تقنية معلومات جديد"/);
  assert.match(recorder, /relatedTicketId:\s*args\.parentId/);
  assert.match(recorder, /allowItManager:\s*true/);
  assert.doesNotMatch(recorder, /childTicket/);
});

test("IT manager creates multiple tasks without technician triage; each task auto-assigns to the IT manager", () => {
  const createTask = block(workflow, "createDepartmentTask:", "assignDepartmentTask:");
  assert.match(createTask, /isItDepartment/);
  assert.match(createTask, /status:\s*isItDepartment\s*\?\s*"assigned"\s*:\s*"pending_assignment"/);
  assert.match(createTask, /replaceTicketTaskAssignees\(Number\(createdTaskId\), \[department\.responsibleManagerId\]/);
  assert.match(createTask, /autoAssignedToId/);

  const assignTask = block(workflow, "assignDepartmentTask:", "promoteDepartmentTask:");
  assert.match(assignTask, /department\.department === MAINTENANCE_RESPONSIBLE_DEPARTMENT\.IT/);
  assert.match(assignTask, /تُسند تلقائيًا إلى مدير تقنية المعلومات/);
});

test("IT task promotion still creates the normal executable child for A/B/C", () => {
  const promote = block(workflow, "promoteDepartmentTask:", "تصحيح بلاغ صُنّف IT بالخطأ");
  assert.match(promote, /workflowModel:\s*"sub_ticket"/);
  assert.match(promote, /status:\s*"under_inspection"/);
  assert.match(promote, /inspectionWorkflowStatus:\s*MAINTENANCE_INSPECTION_WORKFLOW_STATUS\.PENDING_SUBMISSION/);
});

test("IT manager may transfer a planning ticket to general maintenance/construction only with justification", () => {
  const transfer = block(workflow, "transferItTicket:", "triageTicket:");
  assert.match(transfer, /justification:\s*z\.string\(\)\.trim\(\)\.min\(5/);
  assert.match(transfer, /ctx\.user\.role !== APP_ROLE\.IT_MANAGER/);
  assert.match(transfer, /ticket\.maintenanceResponsibleDepartment !== MAINTENANCE_RESPONSIBLE_DEPARTMENT\.IT/);
  assert.match(transfer, /ticket\.maintenanceResponsibleManagerId !== ctx\.user\.id/);
  assert.match(transfer, /task\.convertedTicketId/);
  assert.match(transfer, /updateTicketDepartment\(itDepartment\.id/);
  assert.match(transfer, /replaceTicketTaskAssignees\(task\.id, \[\]/);
  assert.match(transfer, /action:\s*"transfer_it_ticket_department"/);
  assert.match(transfer, /title:\s*"بلاغ محول من تقنية المعلومات"/);
});

test("IT UI exposes task creation/self-execution and transfer with a required reason, without technician picker for IT", () => {
  assert.match(detail, /dept\.department === MAINTENANCE_RESPONSIBLE_DEPARTMENT\.IT[\s\S]*role === APP_ROLE\.IT_MANAGER/);
  assert.match(detail, /المهمة مسندة تلقائيًا إلى مدير تقنية المعلومات/);
  assert.match(detail, /لا توجد خطوة فرز أو اختيار فني لمهام IT/);
  assert.match(detail, /بدء تنفيذ المهمة/);
  assert.match(detail, /تحويل إلى الصيانة \/ الإنشاءات/);
  assert.match(detail, /سبب التحويل \*/);
  assert.match(detail, /itTransferJustification\.trim\(\)\.length < 5/);
  assert.match(detail, /trpc\.tickets\.transferItTicket\.useMutation/);
});
