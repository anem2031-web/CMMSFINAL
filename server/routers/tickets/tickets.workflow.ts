import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure, ticketProcedure, ticketManagerProcedure, ticketScopedWorkflowManagerProcedure, supervisorProcedure,
  ticketTriageProcedure, warehouseProcedure, accountantProcedure, managementProcedure } from "../_shared/procedures";
import {
  APP_ROLE,
  MAINTENANCE_INSPECTION_RESULT_STATUS,
  MAINTENANCE_INSPECTION_WORKFLOW_STATUS,
  MAINTENANCE_RESPONSIBLE_DEPARTMENT,
} from "@shared/roles";
import * as db from "../../_core/db";
import { summarizeSubTicketFamily } from "@shared/ticketUiRules";
import { detectLanguage } from "../../services/translation/translation";
import { queueTranslation } from "../../services/translation/translationEngine";
import {
  assertTicketReadable,
  assertTicketWorkflowManageable,
  assertTicketItemWorkflowManageable,
  isAssignedTicketTechnicianForWorkflow,
  canRecordTicketInspection,
  canReviewTicketInspection,
  canSelectTicketMaintenancePath,
  canSelectTicketItemMaintenancePath,
  shouldAutoApproveRecordedInspection,
} from "./tickets.access";

const responsibleDepartmentSchema = z.enum([
  MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL,
  MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION,
]);

const inspectionSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
const inspectionSubmissionSchema = z.enum(["save_draft", "submit"]);

const inspectionActorRoles = new Set<string>([
  APP_ROLE.TECHNICIAN,
  APP_ROLE.SUPERVISOR,
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
  APP_ROLE.IT_MANAGER,
  APP_ROLE.ADMIN,
  APP_ROLE.OWNER,
]);

function legacyTicketPurchaseWorkflowDisabled(): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "تم إيقاف إجراءات المسار B القديمة. استخدم إعادة الإسناد المعتمدة وطلب الشراء المرتبط بالبلاغ لإكمال دورة التسعير والاعتمادات والشراء والاستلام.",
  });
}

async function resolveInspectionPerformerId(args: {
  actor: { id: number; role: string };
  ticket: any;
  requestedId?: number;
}): Promise<number> {
  if (args.actor.role === APP_ROLE.TECHNICIAN) {
    if (!(await isAssignedTicketTechnicianForWorkflow(args.actor, args.ticket))) {
      throw new TRPCError({ code: "FORBIDDEN", message: "البلاغ غير مسند إليك للفحص" });
    }
    if (args.requestedId && args.requestedId !== args.actor.id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن للفني تسجيل الفحص باسم مستخدم آخر" });
    }
    return args.actor.id;
  }

  // IT Manager is the directly routed technical executor for the IT ticket.
  // Keep the inspection identity scoped to the manager themself rather than
  // allowing the role to record field work on behalf of unrelated staff.
  if (args.actor.role === APP_ROLE.IT_MANAGER) {
    if (args.requestedId && args.requestedId !== args.actor.id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "مدير تقنية المعلومات يسجل فحص بلاغ IT باسمه فقط" });
    }
    return args.actor.id;
  }

  const performerId = args.requestedId ?? args.actor.id;
  const performer = await db.getUserById(performerId);
  if (!performer || performer.isActive === 0 || !inspectionActorRoles.has(performer.role)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "منفذ الفحص المختار غير موجود أو غير نشط أو غير مخول" });
  }
  return performerId;
}

function assertSubmittedInspectionFields(input: {
  inspectionNotes?: string;
  severity?: string;
  findings?: string;
  recommendedAction?: string;
}) {
  if (!input.inspectionNotes?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "الملاحظات الفنية مطلوبة عند إرسال نتيجة الفحص" });
  }
  if (!input.severity) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "مستوى الخطورة مطلوب عند إرسال نتيجة الفحص" });
  }
  if (!input.findings?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "نتائج الفحص مطلوبة عند الإرسال" });
  }
  if (!input.recommendedAction?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "الإجراء الموصى به مطلوب عند الإرسال" });
  }
}

function isInspectionLocked(status?: string | null): boolean {
  return [
    MAINTENANCE_INSPECTION_WORKFLOW_STATUS.SUBMITTED_FOR_REVIEW,
    MAINTENANCE_INSPECTION_WORKFLOW_STATUS.APPROVED,
  ].includes(status as any);
}

/**
 * قيد "بلاغه فقط" لمدير الإنشاءات والمشتريات عند الفرز (2026-08-13).
 *
 * `ticketTriageProcedure` فحص دور فقط — لا تميّز بين بلاغ المستخدم وبلاغ غيره.
 * هذا الحارس يُستدعى داخل كل إجراء فرز (triage/triageMulti/triageTicket) بعد
 * جلب البلاغ مباشرة، ويرفض دوره تحديدًا إن لم يكن هو منشئ البلاغ. بقية
 * الأدوار المسموح لها بـticketTriageProcedure (مدير الصيانة العامة، الأدمن،
 * المالك) تتجاوز هذا الحارس بلا قيد — نطاقهم الأوسع (كل الطابور) لم يتغيّر.
 */
function assertConstructionManagerOwnTicketForTriage(
  actor: { id: number; role: string },
  ticket: { reportedById: number | null },
): void {
  if (actor.role !== APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER) return;
  if (ticket.reportedById !== actor.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "يمكنك تصنيف البلاغات التي أنشأتها بنفسك فقط",
    });
  }
}

async function resolveResponsibleManagerId(
  department: z.infer<typeof responsibleDepartmentSchema>,
  requestedManagerId: number | undefined,
  actor: { id: number; role: string },
): Promise<number> {
  const requiredRole = department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION
    ? APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER
    : APP_ROLE.GENERAL_MAINTENANCE_MANAGER;
  const candidateRoles = department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION
    ? [requiredRole]
    : [requiredRole, APP_ROLE.MAINTENANCE_MANAGER];
  const candidateLists = await Promise.all(candidateRoles.map((role) => db.getUsersByRole(role)));
  const candidates = candidateLists.flat().filter((u: any) => u.isActive !== 0);

  if (requestedManagerId) {
    const selected = candidates.find((u: any) => u.id === requestedManagerId);
    if (!selected) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "المسؤول المختار غير نشط أو لا يحمل الدور المطلوب" });
    }
    return selected.id;
  }

  if (
    department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL &&
    [APP_ROLE.GENERAL_MAINTENANCE_MANAGER, APP_ROLE.MAINTENANCE_MANAGER].includes(actor.role as any)
  ) {
    return actor.id;
  }
  if (candidates.length === 1) return candidates[0].id;
  if (candidates.length === 0) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يوجد مسؤول نشط للجهة المختارة" });
  }
  throw new TRPCError({ code: "BAD_REQUEST", message: "يوجد أكثر من مسؤول نشط؛ يجب تحديد المسؤول" });
}


async function assertActiveInternalTechnician(technicianId: number): Promise<void> {
  const technician = await db.getUserById(technicianId);
  if (!technician || technician.role !== APP_ROLE.TECHNICIAN || technician.isActive === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "الفني المختار غير موجود أو غير نشط أو لا يحمل دور فني",
    });
  }
}

async function routeTicketAfterTriage(args: {
  ticket: any;
  actor: { id: number; role: string };
  department: z.infer<typeof responsibleDepartmentSchema>;
  responsibleManagerId?: number;
  assignedToId?: number;
  ticketType?: "internal" | "external" | "procurement";
  priority?: string;
  triageNotes?: string;
}) {
  const managerId = await resolveResponsibleManagerId(args.department, args.responsibleManagerId, args.actor);
  const isConstruction = args.department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION;
  if (!isConstruction && !args.assignedToId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "يجب تعيين فني مسؤول عند توجيه البلاغ إلى الصيانة العامة",
    });
  }
  if (!isConstruction && args.assignedToId) {
    await assertActiveInternalTechnician(args.assignedToId);
  }
  const routedAt = new Date();
  const updateData: any = {
    status: "under_inspection",
    supervisorId: args.actor.id,
    ticketType: args.ticketType,
    priority: args.priority,
    triageNotes: args.triageNotes,
    maintenanceResponsibleDepartment: args.department,
    maintenanceResponsibleManagerId: managerId,
    maintenanceRoutedById: args.actor.id,
    maintenanceRoutedAt: routedAt,
    maintenanceRoutingNote: args.triageNotes,
    inspectionWorkflowStatus: MAINTENANCE_INSPECTION_WORKFLOW_STATUS.PENDING_SUBMISSION,
    inspectionPerformedById: null,
    inspectionRecordedById: null,
    inspectionSubmittedAt: null,
    inspectionSubmittedById: null,
    inspectionApprovedAt: null,
    inspectionApprovedById: null,
    inspectionReturnedAt: null,
    inspectionReturnedById: null,
    inspectionReturnReason: null,
    inspectionNotes: null,
    // Construction manager assigns the technician after receiving the ticket.
    assignedToId: isConstruction ? null : (args.assignedToId ?? null),
    assignedTechnicianId: isConstruction ? null : undefined,
    assignedAt: !isConstruction && args.assignedToId ? routedAt : null,
  };
  Object.keys(updateData).forEach((key) => updateData[key] === undefined && delete updateData[key]);

  await db.updateTicket(args.ticket.id, updateData);
  const departmentLabel = isConstruction ? "قسم الإنشاءات" : "الصيانة العامة";
  await db.addTicketStatusHistory({
    ticketId: args.ticket.id,
    fromStatus: args.ticket.status,
    toStatus: "under_inspection",
    changedById: args.actor.id,
    notes: `تم توجيه البلاغ إلى ${departmentLabel}${args.triageNotes ? ` — ${args.triageNotes}` : ""}`,
  });
  await db.createAuditLog({
    userId: args.actor.id,
    action: "route_maintenance_ticket",
    entityType: "ticket",
    entityId: args.ticket.id,
    oldValues: {
      maintenanceResponsibleDepartment: args.ticket.maintenanceResponsibleDepartment,
      maintenanceResponsibleManagerId: args.ticket.maintenanceResponsibleManagerId,
    },
    newValues: {
      maintenanceResponsibleDepartment: args.department,
      maintenanceResponsibleManagerId: managerId,
    },
  });

  await db.createNotification({
    userId: managerId,
    title: isConstruction ? "بلاغ إنشائي جديد" : "بلاغ صيانة عامة جديد",
    message: `تم توجيه البلاغ ${args.ticket.ticketNumber} إليك بعد الفرز`,
    type: "warning",
    relatedTicketId: args.ticket.id,
  });

  if (!isConstruction && args.assignedToId) {
    await db.createNotification({
      userId: args.assignedToId,
      title: "تم تعيينك لفحص بلاغ",
      message: `تم تعيينك للفحص الميداني للبلاغ ${args.ticket.ticketNumber}`,
      type: "warning",
      relatedTicketId: args.ticket.id,
    });
  }

  return { managerId };
}

/**
 * الفرز المتعدد بالهيكل الجديد — 2026-08-11.
 * يثبت الجهة/الجهات ومسؤول كل جهة فقط؛ المهام والفنيون مرحلة لاحقة.
 */
async function routeTicketToDepartmentsForPlanning(args: {
  ticket: any;
  actor: { id: number; role: string };
  assignments: Array<{ department: z.infer<typeof responsibleDepartmentSchema>; responsibleManagerId?: number; organizationalTitle?: string }>;
  ticketType?: "internal" | "external" | "procurement";
  priority?: string;
  triageNotes?: string;
}) {
  const resolved: Array<{ department: z.infer<typeof responsibleDepartmentSchema>; managerId: number; organizationalTitle: string | null }> = [];
  for (const assignment of args.assignments) {
    const organizationalTitle = assignment.organizationalTitle?.trim() || null;
    if (assignment.department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION && !organizationalTitle) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "العنوان التنظيمي مطلوب عند توجيه العمل إلى قسم الإنشاءات" });
    }
    resolved.push({
      department: assignment.department,
      managerId: await resolveResponsibleManagerId(assignment.department, assignment.responsibleManagerId, args.actor),
      organizationalTitle,
    });
  }
  const primary = resolved[0];
  const routedAt = new Date();
  await db.withTransaction(async (tx: any) => {
    const headerUpdate: Record<string, any> = {
      status: "department_planning", workflowModel: "department_tasks", supervisorId: args.actor.id,
      ticketType: args.ticketType, priority: args.priority, triageNotes: args.triageNotes,
      maintenanceResponsibleDepartment: primary.department, maintenanceResponsibleManagerId: primary.managerId,
      maintenanceRoutedById: args.actor.id, maintenanceRoutedAt: routedAt, maintenanceRoutingNote: args.triageNotes,
      assignedToId: null, assignedTechnicianId: null, assignedAt: null, maintenancePath: null, inspectionWorkflowStatus: null,
    };
    Object.keys(headerUpdate).forEach((key) => headerUpdate[key] === undefined && delete headerUpdate[key]);
    await db.updateTicket(args.ticket.id, headerUpdate, tx);
    await db.createTicketDepartments(resolved.map((r) => ({
      ticketId: args.ticket.id, department: r.department, responsibleManagerId: r.managerId,
      routedById: args.actor.id, routedAt, routingNote: args.triageNotes ?? null, organizationalTitle: r.organizationalTitle, status: "planning",
    })), tx);
    const items = await db.getTicketItems(args.ticket.id, tx);
    const legacy = items.find((i: any) => i.isLegacySingleItem === 1) ?? items[0];
    if (legacy) {
      await db.updateTicketItem(legacy.id, {
        status: "department_planning", responsibleDepartment: primary.department, responsibleManagerId: primary.managerId,
        routedById: args.actor.id, routedAt, routingNote: args.triageNotes ?? null,
        assignedToId: null, assignedTechnicianId: null, maintenancePath: null,
      }, tx);
    } else {
      // حماية بيانات قديمة/استيراد ناقص: الرأس الجديد يجب أن يحتفظ ببند توافق واحد
      // حتى تبقى إجراءات الـWorkflow القديمة والمستندات التي تتوقع ticket_items آمنة.
      await db.createTicketItem({
        ticketId: args.ticket.id, itemNumber: 1, title: args.ticket.title, description: args.ticket.description,
        descriptionAr: args.ticket.descriptionAr ?? args.ticket.description, assetId: args.ticket.assetId ?? null,
        responsibleDepartment: primary.department, responsibleManagerId: primary.managerId,
        routedById: args.actor.id, routedAt, routingNote: args.triageNotes ?? null, status: "department_planning",
        assignedToId: null, assignedTechnicianId: null, isLegacySingleItem: 1, createdById: args.actor.id,
      }, tx);
    }
  });
  const triageText = args.triageNotes?.trim();
  if (triageText) {
    const triageLanguage = await detectLanguage(triageText).catch(() => "ar" as const);
    queueTranslation({
      entityType: "TICKET",
      entityId: args.ticket.id,
      fields: [
        { fieldName: "triageNotes", text: triageText },
        { fieldName: "maintenanceRoutingNote", text: triageText },
      ],
      sourceLanguage: triageLanguage,
      userId: args.actor.id,
    }).catch((error) => console.error("[TICKET triage/routing notes] Queue translation failed:", error));
  }

  const createdDepartments = await db.getTicketDepartments(args.ticket.id);
  for (const department of createdDepartments) {
    const fields = [
      ...(department.routingNote?.trim() ? [{ fieldName: "routingNote", text: department.routingNote.trim() }] : []),
      ...(department.organizationalTitle?.trim() ? [{ fieldName: "organizationalTitle", text: department.organizationalTitle.trim() }] : []),
    ];
    if (!fields.length) continue;
    const sourceLanguage = await detectLanguage(fields[0].text).catch(() => "ar" as const);
    queueTranslation({
      entityType: "TICKET_DEPARTMENT",
      entityId: Number(department.id),
      fields,
      sourceLanguage,
      userId: args.actor.id,
    }).catch((error) => console.error("[TICKET_DEPARTMENT planning fields] Queue translation failed:", error));
  }

  await db.addTicketStatusHistory({ ticketId: args.ticket.id, fromStatus: args.ticket.status, toStatus: "department_planning", changedById: args.actor.id, notes: `تم اعتماد ${resolved.length} جهة وبدء مرحلة تحليل المهام` });
  for (const r of resolved) await db.createNotification({
    userId: r.managerId, title: "بلاغ بانتظار تحليل المهام",
    message: r.department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION
      ? `تم توجيه البلاغ ${args.ticket.ticketNumber} إليك تحت العنوان التنظيمي: ${r.organizationalTitle}. أنشئ مهمة واحدة أو عدة مهام ثم وزّع الفنيين.`
      : `تم توجيه البلاغ ${args.ticket.ticketNumber} إلى الصيانة العامة. راجع البلاغ وأنشئ مهام الجهة ثم وزّع الفنيين.`,
    type: "warning", relatedTicketId: args.ticket.id,
  });
  await db.createAuditLog({ userId: args.actor.id, action: "route_maintenance_ticket_departments", entityType: "ticket", entityId: args.ticket.id,
    newValues: { departments: resolved.map(r => r.department), managers: resolved.map(r => r.managerId), organizationalTitles: resolved.map(r => r.organizationalTitle), workflowModel: "department_tasks" } });
  return { departmentsCreated: resolved.length };
}

function canManageDepartmentPlan(actor: { id: number; role: string }, department: any): boolean {
  if ([APP_ROLE.OWNER, APP_ROLE.ADMIN].includes(actor.role as any)) return true;

  // جهة IT لا تمر بفرز فنيين: مدير IT المسؤول هو من ينشئ مهام الجهة،
  // وتُسند كل مهمة إليه تلقائيًا قبل تحويلها إلى بلاغ فرعي A/B/C.
  if (department.department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT) {
    return department.responsibleManagerId === actor.id && actor.role === APP_ROLE.IT_MANAGER;
  }

  // في جهة الإنشاءات: مدير الصيانة والتشغيل يرسل العنوان التنظيمي فقط.
  // إنشاء المهام وتوزيع الفنيين وتحويلها لبلاغات فرعية من مسؤول الإنشاءات المحدد.
  if (department.department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION) {
    return department.responsibleManagerId === actor.id && actor.role === APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER;
  }

  if (actor.role === APP_ROLE.MAINTENANCE_MANAGER) return true;
  return department.responsibleManagerId === actor.id && actor.role === APP_ROLE.GENERAL_MAINTENANCE_MANAGER;
}
function assertCanManageDepartmentPlan(actor: { id: number; role: string }, department: any) {
  if (!canManageDepartmentPlan(actor, department)) throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لإدارة مهام هذه الجهة" });
}

/**
 * تجميد خطة الجهات والمهام بعد إغلاق البلاغ الرئيسي — **لكل الأدوار بلا استثناء**.
 *
 * سبب وجوده: إضافة زر إغلاق الرأس بلا هذا الحارس كانت ستفتح ثغرة أسوأ من العطل
 * الأصلي. بلاغ مغلق كان يقبل:
 *   • إنشاء مهمة جديدة تحته،
 *   • إسناد مهمة — وهو يُرجع الجهة من completed إلى active، أي جهة "قيد العمل"
 *     تحت بلاغ مغلق،
 *   • تحويل مهمة إلى بلاغ فرعي جديد، فيكسر نسبة الاكتمال وحارس الإغلاق معًا
 *     (أب مغلق وابن مفتوح).
 *
 * ملاحظة مقصودة: لا استثناء لـ admin/owner هنا. تعديل بلاغ مغلق ليس صلاحية
 * أعلى بل تجاوز لسجل مكتمل؛ من أراد استئناف العمل يفتح بلاغًا جديدًا.
 */
const CLOSED_PARENT_STATUSES = new Set(["closed", "requester_confirmed"]);
function assertDepartmentPlanEditable(ticket: any) {
  if (CLOSED_PARENT_STATUSES.has(ticket?.status)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `البلاغ الرئيسي ${ticket.ticketNumber || ""} مغلق — لا يمكن إضافة مهام أو تعديل خطة الجهات. افتح بلاغًا جديدًا إن لزم عمل إضافي.`,
    });
  }
}

export const ticketsWorkflowRouter = router({
  submitForTriage: ticketProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    await db.updateTicket(input.id, { status: "pending_triage" });
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "pending_triage", changedById: ctx.user.id });
    // ⚠️ 2026-08-10: هذا الموضع **يبقى بثًّا لكل المشرفين عمدًا** — الإجراء يُعيد
    // البلاغ إلى طابور الفرز (pending_triage)، أي يصبح بلا مالك محدد بانتظار من
    // يلتقطه ويفرزه. توجيهه لمشرفه السابق وحده قد يعني ألا يُفرَز إطلاقًا لو كان
    // غائبًا — نفس منطق إشعار إنشاء البلاغ بـtickets.router.ts.
    const supervisors = await db.getUsersByRole("supervisor");
    for (const sup of supervisors) {
      await db.createNotification({ userId: sup.id, title: "بلاغ بانتظار الفرز", message: `البلاغ ${ticket.ticketNumber} بانتظار الفرز والتصنيف`, type: "info", relatedTicketId: input.id });
    }
    return { success: true };
  }),

  triage: ticketTriageProcedure.input(z.object({
    id: z.number(),
    ticketType: z.enum(["internal", "external", "procurement"]),
    priority: z.string().optional(),
    triageNotes: z.string().optional(),
    assignedToId: z.number().optional(),
    maintenanceResponsibleDepartment: responsibleDepartmentSchema,
    maintenanceResponsibleManagerId: z.number().optional(),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    assertConstructionManagerOwnTicketForTriage(ctx.user, ticket);
    if (ticket.status !== "pending_triage") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ ليس في مرحلة الفرز" });
    if (ticket.workflowModel === "department_tasks") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "هذا البلاغ يستخدم هيكل الجهات والمهام؛ استخدم فرز الجهات المعتمد" });
    }
    await routeTicketAfterTriage({
      ticket,
      actor: ctx.user,
      department: input.maintenanceResponsibleDepartment,
      responsibleManagerId: input.maintenanceResponsibleManagerId,
      assignedToId: input.assignedToId,
      ticketType: input.ticketType,
      priority: input.priority,
      triageNotes: input.triageNotes,
    });
    return { success: true };
  }),

  /** الفرز متعدد الجهات: اعتماد الجهات والمسؤولين فقط. */
  triageMulti: ticketTriageProcedure.input(z.object({
    id: z.number(),
    ticketType: z.enum(["internal", "external", "procurement"]).optional(),
    priority: z.string().optional(),
    triageNotes: z.string().optional(),
    assignments: z.array(z.object({
      department: responsibleDepartmentSchema,
      responsibleManagerId: z.number().optional(),
      organizationalTitle: z.string().max(300, "العنوان التنظيمي طويل جدًا").optional(),
    })).min(1, "يجب اختيار جهة واحدة على الأقل"),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    assertConstructionManagerOwnTicketForTriage(ctx.user, ticket);
    if (ticket.status !== "pending_triage") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ ليس في مرحلة الفرز" });
    const departments = input.assignments.map(a => a.department);
    if (new Set(departments).size !== departments.length) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن اختيار نفس الجهة أكثر من مرة" });
    return routeTicketToDepartmentsForPlanning({ ticket, actor: ctx.user, assignments: input.assignments, ticketType: input.ticketType, priority: input.priority, triageNotes: input.triageNotes });
  }),

  /** قراءة خطة البلاغ التنظيمية مع أقل صلاحية لازمة. */
  departmentPlan: protectedProcedure.input(z.object({ ticketId: z.number() })).query(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.ticketId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    await assertTicketReadable(ctx.user, ticket as any);
    let departments = await db.getTicketDepartments(input.ticketId);
    let tasks = await db.getTicketTasks(input.ticketId);
    let assignees = await db.getTaskAssigneesForTasks(tasks.map((t: any) => t.id));
    if (ctx.user.role === APP_ROLE.TECHNICIAN) {
      const visibleTaskIds = new Set(assignees.filter((a: any) => a.userId === ctx.user.id).map((a: any) => a.taskId));
      tasks = tasks.filter((t: any) => visibleTaskIds.has(t.id));
      const deptIds = new Set(tasks.map((t: any) => t.ticketDepartmentId));
      departments = departments.filter((d: any) => deptIds.has(d.id));
      assignees = assignees.filter((a: any) => visibleTaskIds.has(a.taskId));
    } else if (
      [APP_ROLE.GENERAL_MAINTENANCE_MANAGER, APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER].includes(ctx.user.role as any) &&
      ticket.maintenanceResponsibleDepartment !== MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT
    ) {
      const expected = ctx.user.role === APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER ? MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION : MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL;
      departments = departments.filter((d: any) => d.department === expected && d.responsibleManagerId === ctx.user.id);
      const deptIds = new Set(departments.map((d: any) => d.id));
      tasks = tasks.filter((t: any) => deptIds.has(t.ticketDepartmentId));
      const taskIds = new Set(tasks.map((t: any) => t.id));
      assignees = assignees.filter((a: any) => taskIds.has(a.taskId));
    }
    // ملخّص عائلة البلاغات الفرعية — يُحسب من **كل** الأبناء بلا فلترة دور،
    // لأنه أرقام تجميعية لا تكشف تفاصيل جهة أو فني آخر، ولأن نسبة اكتمال
    // منقوصة (تحسب أبناء الفني وحده) ستكون مضللة لمن يقرر الإغلاق.
    const subTickets = await db.getSubTicketsByParent(input.ticketId);
    const subTicketsSummary = summarizeSubTicketFamily(subTickets as any);
    const pendingSubTickets = (subTickets as any[])
      .filter((child: any) => !["closed", "requester_confirmed"].includes(child.status))
      .map((child: any) => ({ id: child.id, ticketNumber: child.ticketNumber, status: child.status }));
    return { departments, tasks, assignees, subTicketsSummary, pendingSubTickets };
  }),

  createDepartmentTask: protectedProcedure.input(z.object({ ticketId: z.number(), ticketDepartmentId: z.number(), title: z.string().max(300).optional(), description: z.string().min(1, "وصف المهمة مطلوب") })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.ticketId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    if (ticket.workflowModel !== "department_tasks") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا البلاغ لا يستخدم هيكل الجهات والمهام الجديد" });
    assertDepartmentPlanEditable(ticket);
    const department = await db.getTicketDepartmentById(input.ticketDepartmentId);
    if (!department || department.ticketId !== input.ticketId) throw new TRPCError({ code: "BAD_REQUEST", message: "الجهة لا تنتمي لهذا البلاغ" });
    assertCanManageDepartmentPlan(ctx.user, department);

    const isItDepartment = department.department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT;
    if (isItDepartment) {
      const itManager = await db.getUserById(department.responsibleManagerId);
      if (!itManager || itManager.role !== APP_ROLE.IT_MANAGER || itManager.isActive === 0) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "مدير تقنية المعلومات المسؤول غير موجود أو غير نشط" });
      }
    }

    const taskId = await db.withTransaction(async (tx: any) => {
      await db.lockTicketDepartmentForTaskSequence(department.id, tx);
      const taskNumber = await db.getNextDepartmentTaskNumber(department.id, tx);
      const createdTaskId = await db.createTicketTask({
        ticketId: input.ticketId,
        ticketDepartmentId: department.id,
        taskNumber,
        title: input.title?.trim() || null,
        description: input.description.trim(),
        // مهام IT لا تدخل خطوة توزيع الفنيين؛ هي من مسؤولية مدير IT نفسه.
        status: isItDepartment ? "assigned" : "pending_assignment",
        createdById: ctx.user.id,
      }, tx);
      if (!createdTaskId) throw new Error("Failed to create department task");
      if (isItDepartment) {
        await db.replaceTicketTaskAssignees(Number(createdTaskId), [department.responsibleManagerId], ctx.user.id, tx);
        await db.updateTicketDepartment(department.id, { status: "active" }, tx);
      }
      return Number(createdTaskId);
    });
    await db.createAuditLog({
      userId: ctx.user.id,
      action: "create_ticket_department_task",
      entityType: "ticket",
      entityId: input.ticketId,
      newValues: { taskId, ticketDepartmentId: department.id, autoAssignedToItManager: isItDepartment ? department.responsibleManagerId : null },
    });

    const taskFields = [
      ...(input.title?.trim() ? [{ fieldName: "title", text: input.title.trim() }] : []),
      { fieldName: "description", text: input.description.trim() },
    ];
    const taskSourceLanguage = await detectLanguage(taskFields[0].text).catch(() => "ar" as const);
    queueTranslation({
      entityType: "TICKET_TASK",
      entityId: taskId,
      fields: taskFields,
      sourceLanguage: taskSourceLanguage,
      userId: ctx.user.id,
    }).catch((error) => console.error("[TICKET_TASK] Queue translation failed:", error));

    return { success: true, taskId, autoAssignedToId: isItDepartment ? department.responsibleManagerId : null };
  }),

  assignDepartmentTask: protectedProcedure.input(z.object({ ticketId: z.number(), taskId: z.number(), technicianIds: z.array(z.number()).min(1, "اختر فنيًا واحدًا على الأقل") })).mutation(async ({ input, ctx }) => {
    const parentTicket = await db.getTicketById(input.ticketId);
    if (!parentTicket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    // بدون هذا الفحص كان الإسناد يُرجع الجهة إلى active تحت بلاغ مغلق
    assertDepartmentPlanEditable(parentTicket);
    const task = await db.getTicketTaskById(input.taskId);
    if (!task || task.ticketId !== input.ticketId) throw new TRPCError({ code: "BAD_REQUEST", message: "المهمة لا تنتمي لهذا البلاغ" });
    if (task.convertedTicketId) throw new TRPCError({ code: "BAD_REQUEST", message: "تم تحويل المهمة إلى بلاغ فرعي ولا يمكن تغيير توزيعها" });
    const department = await db.getTicketDepartmentById(task.ticketDepartmentId);
    if (!department || department.ticketId !== input.ticketId) throw new TRPCError({ code: "BAD_REQUEST", message: "جهة المهمة غير صالحة" });
    assertCanManageDepartmentPlan(ctx.user, department);
    if (department.department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "مهام تقنية المعلومات تُسند تلقائيًا إلى مدير تقنية المعلومات ولا تقبل توزيع فنيين يدويًا" });
    }
    const technicianIds = Array.from(new Set(input.technicianIds));
    for (const id of technicianIds) await assertActiveInternalTechnician(id);
    await db.withTransaction(async (tx: any) => {
      await db.lockTicketTaskForPromotion(task.id, tx);
      const fresh = await db.getTicketTaskById(task.id, tx);
      if (!fresh) throw new TRPCError({ code: "NOT_FOUND", message: "المهمة لم تعد موجودة" });
      if (fresh.convertedTicketId) throw new TRPCError({ code: "CONFLICT", message: "تم تحويل المهمة أثناء تحديث التوزيع" });
      await db.replaceTicketTaskAssignees(task.id, technicianIds, ctx.user.id, tx);
      await db.updateTicketTask(task.id, { status: "assigned" }, tx);
      await db.updateTicketDepartment(department.id, { status: "active" }, tx);
    });
    const ticket = await db.getTicketById(input.ticketId);
    for (const id of technicianIds) await db.createNotification({ userId: id, title: "تم إسناد مهمة جديدة إليك", message: `تم إسناد مهمة ضمن البلاغ ${ticket?.ticketNumber ?? input.ticketId}: ${task.title || task.description}`, type: "info", relatedTicketId: input.ticketId });
    return { success: true };
  }),

  promoteDepartmentTask: protectedProcedure.input(z.object({ ticketId: z.number(), taskId: z.number() })).mutation(async ({ input, ctx }) => {
    const parent = await db.getTicketById(input.ticketId);
    if (!parent) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ الرئيسي غير موجود" });
    if (parent.workflowModel !== "department_tasks") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا البلاغ ليس بلاغًا رئيسيًا متعدد الجهات" });
    assertDepartmentPlanEditable(parent);
    const task = await db.getTicketTaskById(input.taskId);
    if (!task || task.ticketId !== input.ticketId) throw new TRPCError({ code: "BAD_REQUEST", message: "المهمة لا تنتمي لهذا البلاغ" });
    if (task.convertedTicketId) { const existing = await db.getTicketById(task.convertedTicketId); return { success: true, ticketId: task.convertedTicketId, ticketNumber: existing?.ticketNumber }; }
    const department = await db.getTicketDepartmentById(task.ticketDepartmentId);
    if (!department || department.ticketId !== input.ticketId) throw new TRPCError({ code: "BAD_REQUEST", message: "جهة المهمة غير صالحة" });
    assertCanManageDepartmentPlan(ctx.user, department);
    const result = await db.withTransaction(async (tx: any) => {
      await db.lockTicketTaskForPromotion(task.id, tx);
      const freshTask = await db.getTicketTaskById(task.id, tx);
      if (!freshTask) throw new TRPCError({ code: "NOT_FOUND", message: "المهمة لم تعد موجودة" });
      if (freshTask.convertedTicketId) return { childId: freshTask.convertedTicketId, ticketNumber: undefined as string | undefined, alreadyExisting: true, assigneeIds: [] as number[] };
      const freshAssignees = await db.getTaskAssignees(task.id, tx);
      if (!freshAssignees.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يجب توزيع المهمة على فني واحد على الأقل قبل تحويلها" });
      await db.lockTicketForSubTicketSequence(parent.id, tx);
      const seq = await db.allocateNextSubTicketSequence(parent.id, tx);
      const ticketNumber = `${parent.ticketNumber}-${String(seq).padStart(2, "0")}`;
      const primaryTechnicianId = freshAssignees[0].userId;
      const childId = await db.createTicket({
        ticketNumber, title: freshTask.title?.trim() || `${parent.title} — مهمة ${freshTask.taskNumber}`, description: freshTask.description,
        status: "under_inspection", priority: parent.priority, category: parent.category, siteId: parent.siteId, sectionId: parent.sectionId,
        assetId: parent.assetId, locationDetail: parent.locationDetail, reportedById: parent.reportedById, beforePhotoUrl: parent.beforePhotoUrl,
        originalLanguage: parent.originalLanguage, ticketType: parent.ticketType || "internal", supervisorId: parent.supervisorId ?? ctx.user.id,
        maintenanceResponsibleDepartment: department.department, maintenanceResponsibleManagerId: department.responsibleManagerId,
        maintenanceRoutedById: ctx.user.id, maintenanceRoutedAt: new Date(), maintenanceRoutingNote: `بلاغ فرعي من ${parent.ticketNumber} / مهمة ${freshTask.taskNumber}`,
        assignedToId: primaryTechnicianId, assignedAt: new Date(), inspectionWorkflowStatus: MAINTENANCE_INSPECTION_WORKFLOW_STATUS.PENDING_SUBMISSION,
        workflowModel: "sub_ticket", parentTicketId: parent.id, sourceTaskId: freshTask.id, subTicketSequence: seq,
      }, tx);
      if (!childId) throw new Error("Failed to create sub-ticket");
      await db.createTicketItem({ ticketId: childId, itemNumber: 1, title: freshTask.title?.trim() || `${parent.title} — مهمة ${freshTask.taskNumber}`, description: freshTask.description, descriptionAr: freshTask.description,
        assetId: parent.assetId ?? null, responsibleDepartment: department.department, responsibleManagerId: department.responsibleManagerId,
        routedById: ctx.user.id, routedAt: new Date(), routingNote: `محول من مهمة في ${parent.ticketNumber}`, status: "under_inspection",
        assignedToId: primaryTechnicianId, assignedAt: new Date(), isLegacySingleItem: 0, createdById: ctx.user.id }, tx);
      await db.updateTicketTask(freshTask.id, { status: "promoted", convertedTicketId: childId }, tx);
      return { childId, ticketNumber, alreadyExisting: false, assigneeIds: freshAssignees.map((a: any) => a.userId) };
    });
    if (result.alreadyExisting) { const existing = await db.getTicketById(result.childId); return { success: true, ticketId: result.childId, ticketNumber: existing?.ticketNumber }; }
    await db.addTicketStatusHistory({ ticketId: result.childId, fromStatus: undefined, toStatus: "under_inspection", changedById: ctx.user.id, notes: `تم إنشاء البلاغ الفرعي من المهمة ${task.taskNumber} التابعة للبلاغ ${parent.ticketNumber}` });
    await db.createAuditLog({ userId: ctx.user.id, action: "promote_ticket_task_to_subticket", entityType: "ticket", entityId: parent.id, newValues: { taskId: task.id, subTicketId: result.childId, subTicketNumber: result.ticketNumber } });
    for (const id of result.assigneeIds) await db.createNotification({ userId: id, title: "تم تحويل مهمتك إلى بلاغ فرعي", message: `المهمة أصبحت البلاغ ${result.ticketNumber} وتبدأ الآن دورة العمل المستقلة.`, type: "info", relatedTicketId: result.childId });
    return { success: true, ticketId: result.childId, ticketNumber: result.ticketNumber };
  }),

  /**
   * تصحيح بلاغ صُنّف IT بالخطأ: يحوّله مدير IT إلى الصيانة العامة أو الإنشاءات
   * مع تبرير إلزامي. لا يُغلق البلاغ ولا يُنشأ بلاغ جديد؛ نفس خطة الجهات والمهام
   * تنتقل للجهة الجديدة. يُمنع التحويل بعد ترقية أي مهمة إلى بلاغ فرعي.
   */
  transferItTicket: protectedProcedure.input(z.object({
    id: z.number(),
    department: responsibleDepartmentSchema,
    responsibleManagerId: z.number().optional(),
    justification: z.string().trim().min(5, "التبرير مطلوب ويجب أن يكون واضحًا").max(2000, "التبرير طويل جدًا"),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    if (ctx.user.role !== APP_ROLE.IT_MANAGER ||
        ticket.maintenanceResponsibleDepartment !== MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT ||
        ticket.maintenanceResponsibleManagerId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "التحويل متاح فقط لمدير تقنية المعلومات المسؤول عن هذا البلاغ" });
    }
    if (ticket.workflowModel !== "department_tasks" || ticket.status !== "department_planning") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "يمكن تحويل بلاغ IT أثناء مرحلة تحليل المهام فقط" });
    }
    assertDepartmentPlanEditable(ticket);

    const managerId = await resolveResponsibleManagerId(input.department, input.responsibleManagerId, ctx.user);
    const departments = await db.getTicketDepartments(ticket.id);
    const itDepartment = departments.find((d: any) =>
      d.department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT && d.responsibleManagerId === ctx.user.id
    );
    if (!itDepartment) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لم يتم العثور على خطة جهة تقنية المعلومات لهذا البلاغ" });
    }
    const existingTargetDepartment = departments.find((d: any) => d.id !== itDepartment.id && d.department === input.department);
    if (existingTargetDepartment) {
      throw new TRPCError({ code: "CONFLICT", message: "الجهة المستلمة موجودة أصلًا ضمن خطة هذا البلاغ" });
    }
    const initialTasks = (await db.getTicketTasks(ticket.id)).filter((task: any) => task.ticketDepartmentId === itDepartment.id);
    if (initialTasks.some((task: any) => !!task.convertedTicketId || task.status === "promoted" || task.status === "completed")) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "لا يمكن تحويل البلاغ بعد بدء تنفيذ إحدى مهامه كبلاغ فرعي. حوّل البلاغ قبل بدء A/B/C.",
      });
    }

    const routedAt = new Date();
    const departmentLabel = input.department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION ? "قسم الإنشاءات" : "الصيانة العامة";
    let resetTaskIds: number[] = [];
    await db.withTransaction(async (tx: any) => {
      // نستخدم نفس أقفال إنشاء/ترقية المهام لمنع سباق بين التحويل وبين إنشاء مهمة
      // أو تحويلها إلى بلاغ فرعي في اللحظة نفسها.
      await db.lockTicketForSubTicketSequence(ticket.id, tx);
      await db.lockTicketDepartmentForTaskSequence(itDepartment.id, tx);
      const freshTasks = (await db.getTicketTasks(ticket.id, tx)).filter((task: any) => task.ticketDepartmentId === itDepartment.id);
      for (const task of freshTasks) await db.lockTicketTaskForPromotion(task.id, tx);
      const lockedTasks = (await db.getTicketTasks(ticket.id, tx)).filter((task: any) => task.ticketDepartmentId === itDepartment.id);
      if (lockedTasks.some((task: any) => !!task.convertedTicketId || task.status === "promoted" || task.status === "completed")) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "بدأ تنفيذ إحدى المهام أثناء التحويل. أعد تحميل البلاغ وحاول مرة أخرى.",
        });
      }
      resetTaskIds = lockedTasks.map((task: any) => task.id);

      // المهام التي أنشأها مدير IT تبقى كما هي، لكن تُعاد لمرحلة توزيع الفنيين
      // حتى يتولى مدير الجهة الجديدة إسنادها وفق سير العمل الحالي.
      for (const task of lockedTasks) {
        await db.replaceTicketTaskAssignees(task.id, [], ctx.user.id, tx);
        if (task.status !== "cancelled") await db.updateTicketTask(task.id, { status: "pending_assignment" }, tx);
      }

      await db.updateTicketDepartment(itDepartment.id, {
        department: input.department,
        responsibleManagerId: managerId,
        routedById: ctx.user.id,
        routedAt,
        routingNote: input.justification,
        organizationalTitle: input.department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION ? ticket.title : null,
        status: "planning",
      }, tx);

      const items = await db.getTicketItems(ticket.id, tx);
      for (const item of items) {
        if (item.responsibleDepartment === MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT || item.isLegacySingleItem === 1) {
          await db.updateTicketItem(item.id, {
            responsibleDepartment: input.department,
            responsibleManagerId: managerId,
            routedById: ctx.user.id,
            routedAt,
            routingNote: input.justification,
            status: "department_planning",
            assignedToId: null,
            assignedTechnicianId: null,
            maintenancePath: null,
          }, tx);
        }
      }

      await db.updateTicket(ticket.id, {
        status: "department_planning",
        maintenanceResponsibleDepartment: input.department,
        maintenanceResponsibleManagerId: managerId,
        maintenanceRoutedById: ctx.user.id,
        maintenanceRoutedAt: routedAt,
        maintenanceRoutingNote: input.justification,
        assignedToId: null,
        assignedTechnicianId: null,
        assignedAt: null,
        maintenancePath: null,
        inspectionWorkflowStatus: null,
      }, tx);
    });

    const transferSourceLanguage = await detectLanguage(input.justification).catch(() => "ar" as const);
    queueTranslation({
      entityType: "TICKET",
      entityId: ticket.id,
      fields: [{ fieldName: "maintenanceRoutingNote", text: input.justification }],
      sourceLanguage: transferSourceLanguage,
      userId: ctx.user.id,
    }).catch((error) => console.error("[TICKET transfer justification] Queue translation failed:", error));
    queueTranslation({
      entityType: "TICKET_DEPARTMENT",
      entityId: itDepartment.id,
      fields: [{ fieldName: "routingNote", text: input.justification }],
      sourceLanguage: transferSourceLanguage,
      userId: ctx.user.id,
    }).catch((error) => console.error("[TICKET_DEPARTMENT transfer justification] Queue translation failed:", error));

    await db.addTicketStatusHistory({
      ticketId: ticket.id,
      fromStatus: ticket.status,
      toStatus: "department_planning",
      changedById: ctx.user.id,
      notes: `تم تحويل البلاغ من تقنية المعلومات إلى ${departmentLabel}. التبرير: ${input.justification}`,
    });
    await db.createAuditLog({
      userId: ctx.user.id,
      action: "transfer_it_ticket_department",
      entityType: "ticket",
      entityId: ticket.id,
      oldValues: {
        maintenanceResponsibleDepartment: MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT,
        maintenanceResponsibleManagerId: ctx.user.id,
      },
      newValues: {
        maintenanceResponsibleDepartment: input.department,
        maintenanceResponsibleManagerId: managerId,
        justification: input.justification,
        resetTasksForAssignment: resetTaskIds,
      },
    });
    await db.createNotification({
      userId: managerId,
      title: "بلاغ محول من تقنية المعلومات",
      message: `حوّل مدير تقنية المعلومات البلاغ ${ticket.ticketNumber} إلى ${departmentLabel}. السبب: ${input.justification}`,
      type: "warning",
      relatedTicketId: ticket.id,
    });
    return { success: true, managerId, department: input.department };
  }),

  triageTicket: ticketTriageProcedure.input(z.object({
    id: z.number(),
    assignedToId: z.number().optional(),
    triageNotes: z.string().optional(),
    maintenanceResponsibleDepartment: responsibleDepartmentSchema,
    maintenanceResponsibleManagerId: z.number().optional(),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    assertConstructionManagerOwnTicketForTriage(ctx.user, ticket);
    if (ticket.status !== "pending_triage") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ ليس في مرحلة الفرز" });
    if (ticket.workflowModel === "department_tasks") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "هذا البلاغ يستخدم هيكل الجهات والمهام؛ استخدم فرز الجهات المعتمد" });
    }
    await routeTicketAfterTriage({
      ticket,
      actor: ctx.user,
      department: input.maintenanceResponsibleDepartment,
      responsibleManagerId: input.maintenanceResponsibleManagerId,
      assignedToId: input.assignedToId,
      triageNotes: input.triageNotes,
    });
    return { success: true };
  }),

  inspectTicket: protectedProcedure.input(z.object({
    id: z.number(),
    performedById: z.number().optional(),
    inspectionNotes: z.string().optional(),
    severity: inspectionSeveritySchema.optional(),
    rootCause: z.string().optional(),
    findings: z.string().optional(),
    recommendedAction: z.string().optional(),
    submissionMode: inspectionSubmissionSchema.default("submit"),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    const canRecordInspection = canRecordTicketInspection(ctx.user, ticket as any) ||
      (ctx.user.role === APP_ROLE.TECHNICIAN && await isAssignedTicketTechnicianForWorkflow(ctx.user, ticket as any));
    if (!canRecordInspection) {
      throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لتسجيل نتيجة فحص لهذا البلاغ" });
    }
    if (ticket.status !== "under_inspection") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ ليس في مرحلة الفحص" });
    }
    if (isInspectionLocked(ticket.inspectionWorkflowStatus)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: ticket.inspectionWorkflowStatus === MAINTENANCE_INSPECTION_WORKFLOW_STATUS.APPROVED
          ? "نتيجة الفحص معتمدة بالفعل"
          : "نتيجة الفحص مرسلة للمراجعة ولا يمكن تعديلها",
      });
    }

    const performedById = await resolveInspectionPerformerId({
      actor: ctx.user,
      ticket,
      requestedId: input.performedById,
    });
    const isSubmit = input.submissionMode === "submit";
    if (isSubmit) assertSubmittedInspectionFields(input);

    const latest = await db.getLatestInspectionResultByTicket(input.id);
    if (latest && [
      MAINTENANCE_INSPECTION_RESULT_STATUS.SUBMITTED,
      MAINTENANCE_INSPECTION_RESULT_STATUS.APPROVED,
    ].includes(latest.workflowStatus as any)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "توجد نتيجة فحص مقفلة لهذا البلاغ" });
    }
    if (
      latest?.workflowStatus === MAINTENANCE_INSPECTION_RESULT_STATUS.DRAFT &&
      latest.recordedById && latest.recordedById !== ctx.user.id
    ) {
      throw new TRPCError({ code: "CONFLICT", message: "توجد مسودة فحص محفوظة بواسطة مستخدم آخر" });
    }

    const now = new Date();
    const autoApproved = isSubmit && shouldAutoApproveRecordedInspection(ctx.user);
    const resultStatus = !isSubmit
      ? MAINTENANCE_INSPECTION_RESULT_STATUS.DRAFT
      : autoApproved
        ? MAINTENANCE_INSPECTION_RESULT_STATUS.APPROVED
        : MAINTENANCE_INSPECTION_RESULT_STATUS.SUBMITTED;
    const revisionNumber = latest?.workflowStatus === MAINTENANCE_INSPECTION_RESULT_STATUS.DRAFT
      ? latest.revisionNumber
      : Number(latest?.revisionNumber ?? 0) + 1;
    const resultData: any = {
      ticketId: input.id,
      assetId: ticket.assetId ?? undefined,
      inspectorId: performedById,
      performedById,
      recordedById: ctx.user.id,
      inspectionType: "detailed",
      severity: input.severity ?? "medium",
      rootCause: input.rootCause?.trim() || null,
      findings: input.findings?.trim() || null,
      recommendedAction: input.recommendedAction?.trim() || null,
      inspectionNotes: input.inspectionNotes?.trim() || null,
      workflowStatus: resultStatus,
      revisionNumber,
      submittedAt: isSubmit ? now : null,
      approvedAt: autoApproved ? now : null,
      approvedById: autoApproved ? ctx.user.id : null,
      returnedAt: null,
      returnedById: null,
      returnReason: null,
    };

    let resultId: number;
    if (latest?.workflowStatus === MAINTENANCE_INSPECTION_RESULT_STATUS.DRAFT) {
      await db.updateInspectionResult(latest.id, resultData);
      resultId = latest.id;
    } else {
      const created = await db.createInspectionResult(resultData);
      resultId = Number(created?.id ?? 0);
    }

    const ticketUpdate: any = {
      inspectionPerformedById: performedById,
      inspectionRecordedById: ctx.user.id,
      inspectionNotes: input.inspectionNotes?.trim() || ticket.inspectionNotes || null,
    };
    if (isSubmit) {
      ticketUpdate.inspectionWorkflowStatus = autoApproved
        ? MAINTENANCE_INSPECTION_WORKFLOW_STATUS.APPROVED
        : MAINTENANCE_INSPECTION_WORKFLOW_STATUS.SUBMITTED_FOR_REVIEW;
      ticketUpdate.inspectionSubmittedAt = now;
      ticketUpdate.inspectionSubmittedById = ctx.user.id;
      ticketUpdate.inspectionReturnedAt = null;
      ticketUpdate.inspectionReturnedById = null;
      ticketUpdate.inspectionReturnReason = null;
      ticketUpdate.inspectionApprovedAt = autoApproved ? now : null;
      ticketUpdate.inspectionApprovedById = autoApproved ? ctx.user.id : null;
    }
    await db.updateTicket(input.id, ticketUpdate);

    const inspectionFields = [
      ...(input.rootCause?.trim() ? [{ fieldName: "rootCause", text: input.rootCause.trim() }] : []),
      ...(input.findings?.trim() ? [{ fieldName: "findings", text: input.findings.trim() }] : []),
      ...(input.recommendedAction?.trim() ? [{ fieldName: "recommendedAction", text: input.recommendedAction.trim() }] : []),
      ...(input.inspectionNotes?.trim() ? [{ fieldName: "inspectionNotes", text: input.inspectionNotes.trim() }] : []),
    ];
    if (inspectionFields.length > 0) {
      const inspectionSourceLanguage = await detectLanguage(inspectionFields[0].text).catch(() => "ar" as const);
      queueTranslation({
        entityType: "INSPECTION_RESULT",
        entityId: resultId,
        fields: inspectionFields,
        sourceLanguage: inspectionSourceLanguage,
        userId: ctx.user.id,
      }).catch((error) => console.error("[INSPECTION_RESULT] Queue translation failed:", error));

      if (input.inspectionNotes?.trim()) {
        queueTranslation({
          entityType: "TICKET",
          entityId: input.id,
          fields: [{ fieldName: "inspectionNotes", text: input.inspectionNotes.trim() }],
          sourceLanguage: inspectionSourceLanguage,
          userId: ctx.user.id,
        }).catch((error) => console.error("[TICKET inspectionNotes] Queue translation failed:", error));
      }
    }

    await db.createAuditLog({
      userId: ctx.user.id,
      action: isSubmit
        ? (autoApproved ? "record_and_approve_ticket_inspection" : "submit_ticket_inspection")
        : "save_ticket_inspection_draft",
      entityType: "ticket",
      entityId: input.id,
      oldValues: { inspectionWorkflowStatus: ticket.inspectionWorkflowStatus },
      newValues: {
        resultId,
        revisionNumber,
        performedById,
        recordedById: ctx.user.id,
        inspectionWorkflowStatus: ticketUpdate.inspectionWorkflowStatus ?? ticket.inspectionWorkflowStatus,
      },
    });

    if (isSubmit) {
      await db.addTicketStatusHistory({
        ticketId: input.id,
        fromStatus: ticket.status,
        toStatus: "under_inspection",
        changedById: ctx.user.id,
        notes: autoApproved
          ? `تم تسجيل واعتماد نتيجة الفحص — المراجعة رقم ${revisionNumber}`
          : `تم إرسال نتيجة الفحص للمراجعة — المراجعة رقم ${revisionNumber}`,
      });
      if (!autoApproved) {
        const managers = await db.getTicketWorkflowManagerUsers(ticket);
        for (const mgr of managers) {
          if (mgr.id === ctx.user.id) continue;
          await db.createNotification({
            userId: mgr.id,
            title: "نتيجة فحص بانتظار المراجعة",
            message: `تم إرسال نتيجة فحص البلاغ ${ticket.ticketNumber} لاعتمادها`,
            type: "warning",
            relatedTicketId: input.id,
          });
        }
      } else if (ticket.assignedToId && ticket.assignedToId !== ctx.user.id) {
        await db.createNotification({
          userId: ticket.assignedToId,
          title: "تم اعتماد نتيجة الفحص",
          message: `سجّل مدير الجهة واعتمد نتيجة فحص البلاغ ${ticket.ticketNumber}`,
          type: "success",
          relatedTicketId: input.id,
        });
      }
    }

    return {
      success: true,
      resultId,
      workflowStatus: ticketUpdate.inspectionWorkflowStatus ?? ticket.inspectionWorkflowStatus,
      autoApproved,
    };
  }),

  reviewInspection: ticketScopedWorkflowManagerProcedure.input(z.object({
    id: z.number(),
    action: z.enum(["approve", "return_for_correction"]),
    reason: z.string().trim().optional(),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    if (!canReviewTicketInspection(ctx.user, ticket as any)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية مراجعة نتيجة الفحص لهذا البلاغ" });
    }
    if (input.action === "return_for_correction" && !input.reason) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "سبب إعادة نتيجة الفحص للتصحيح مطلوب" });
    }
    const latest = await db.getLatestInspectionResultByTicket(input.id);
    if (!latest || latest.workflowStatus !== MAINTENANCE_INSPECTION_RESULT_STATUS.SUBMITTED) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا توجد نتيجة فحص مرسلة قابلة للمراجعة" });
    }

    const now = new Date();
    if (input.action === "approve") {
      await db.updateInspectionResult(latest.id, {
        workflowStatus: MAINTENANCE_INSPECTION_RESULT_STATUS.APPROVED as any,
        approvedAt: now as any,
        approvedById: ctx.user.id,
        returnedAt: null,
        returnedById: null,
        returnReason: null,
      } as any);
      await db.updateTicket(input.id, {
        inspectionWorkflowStatus: MAINTENANCE_INSPECTION_WORKFLOW_STATUS.APPROVED,
        inspectionApprovedAt: now,
        inspectionApprovedById: ctx.user.id,
        inspectionReturnedAt: null,
        inspectionReturnedById: null,
        inspectionReturnReason: null,
      });
      await db.addTicketStatusHistory({
        ticketId: input.id,
        fromStatus: ticket.status,
        toStatus: "under_inspection",
        changedById: ctx.user.id,
        notes: `تم اعتماد نتيجة الفحص — المراجعة رقم ${latest.revisionNumber}`,
      });
    } else {
      await db.updateInspectionResult(latest.id, {
        workflowStatus: MAINTENANCE_INSPECTION_RESULT_STATUS.RETURNED as any,
        returnedAt: now as any,
        returnedById: ctx.user.id,
        returnReason: input.reason,
      } as any);
      await db.updateTicket(input.id, {
        inspectionWorkflowStatus: MAINTENANCE_INSPECTION_WORKFLOW_STATUS.RETURNED_FOR_CORRECTION,
        inspectionReturnedAt: now,
        inspectionReturnedById: ctx.user.id,
        inspectionReturnReason: input.reason,
        inspectionApprovedAt: null,
        inspectionApprovedById: null,
      });
      await db.addTicketStatusHistory({
        ticketId: input.id,
        fromStatus: ticket.status,
        toStatus: "under_inspection",
        changedById: ctx.user.id,
        notes: `أعيدت نتيجة الفحص للتصحيح — السبب: ${input.reason}`,
      });
    }

    if (input.action === "return_for_correction" && input.reason) {
      const reasonLanguage = await detectLanguage(input.reason).catch(() => "ar" as const);
      queueTranslation({
        entityType: "INSPECTION_RESULT",
        entityId: latest.id,
        fields: [{ fieldName: "returnReason", text: input.reason }],
        sourceLanguage: reasonLanguage,
        userId: ctx.user.id,
      }).catch((error) => console.error("[INSPECTION_RESULT returnReason] Queue translation failed:", error));
      queueTranslation({
        entityType: "TICKET",
        entityId: input.id,
        fields: [{ fieldName: "inspectionReturnReason", text: input.reason }],
        sourceLanguage: reasonLanguage,
        userId: ctx.user.id,
      }).catch((error) => console.error("[TICKET inspectionReturnReason] Queue translation failed:", error));
    }

    await db.createAuditLog({
      userId: ctx.user.id,
      action: input.action === "approve" ? "approve_ticket_inspection" : "return_ticket_inspection",
      entityType: "ticket",
      entityId: input.id,
      oldValues: { inspectionWorkflowStatus: ticket.inspectionWorkflowStatus },
      newValues: {
        inspectionWorkflowStatus: input.action === "approve"
          ? MAINTENANCE_INSPECTION_WORKFLOW_STATUS.APPROVED
          : MAINTENANCE_INSPECTION_WORKFLOW_STATUS.RETURNED_FOR_CORRECTION,
        reason: input.reason,
      },
    });

    const notificationTargets = new Set<number>();
    if (ticket.assignedToId) notificationTargets.add(ticket.assignedToId);
    if (latest.recordedById) notificationTargets.add(latest.recordedById);
    notificationTargets.delete(ctx.user.id);
    for (const userId of notificationTargets) {
      await db.createNotification({
        userId,
        title: input.action === "approve" ? "تم اعتماد نتيجة الفحص" : "نتيجة الفحص تحتاج تصحيحًا",
        message: input.action === "approve"
          ? `تم اعتماد نتيجة فحص البلاغ ${ticket.ticketNumber}`
          : `أعيدت نتيجة فحص البلاغ ${ticket.ticketNumber}: ${input.reason}`,
        type: input.action === "approve" ? "success" : "warning",
        relatedTicketId: input.id,
      });
    }
    return { success: true };
  }),

  approveWork: ticketScopedWorkflowManagerProcedure.input(z.object({
    id: z.number(),
    maintenancePath: z.enum(["A", "B", "C"]),
    inspectionNotes: z.string().optional(),
    justification: z.string().optional(), // Required for Path C
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    assertTicketWorkflowManageable(ctx.user, ticket as any);
    if (ticket.status !== "under_inspection") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ ليس في مرحلة الفحص" });
    if (!canSelectTicketMaintenancePath(ctx.user, ticket as any)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تحديد مسار التنفيذ قبل اعتماد نتيجة الفحص" });
    }
    if (input.maintenancePath === "C" && !input.justification) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "المسار C يتطلب مبرراً للصيانة الخارجية" });
    }
    const approvedAt = new Date();
    const updateData: any = {
      status: "work_approved",
      maintenancePath: input.maintenancePath,
      approvedById: ctx.user.id,
      inspectionNotes: input.inspectionNotes ?? ticket.inspectionNotes,
      justification: input.justification,
    };
    await db.updateTicket(input.id, updateData);
    // البلاغ الأحادي/الفرعي يسلك إجراء الرأس القديم؛ يجب مزامنة بند التنفيذ
    // الوحيد لأن شاشات A/B/C الحديثة تعتمد ticket_items كمصدر حقيقة.
    await db.syncSingleTicketItem(input.id, {
      status: "work_approved",
      maintenancePath: input.maintenancePath,
      approvedById: ctx.user.id,
      approvedAt,
      justification: input.justification ?? null,
    });
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "work_approved", changedById: ctx.user.id, notes: `المسار: ${input.maintenancePath}` });
    // Notify based on path
    if (input.maintenancePath === "C") {
      // المسار C يبدأ لدى المستودع لتجهيز الأصل واختيار المندوب وإصدار وثيقة الخروج.
      const warehouseUsers = await db.getUsersByRole(APP_ROLE.WAREHOUSE);
      for (const warehouseUser of warehouseUsers) {
        await db.createNotification({
          userId: warehouseUser.id,
          title: "🔧 أصل بانتظار التجهيز للصيانة الخارجية",
          message: `تم اعتماد المسار C للبلاغ ${ticket.ticketNumber}. يرجى تجهيز الأصل، تحديد المندوب، وإصدار وثيقة الخروج.`,
          type: "warning",
          relatedTicketId: input.id,
        });
      }
    } else if (input.maintenancePath === "A") {
      // Notify assigned technician
      if (ticket.assignedToId) {
        await db.createNotification({ userId: ticket.assignedToId, title: "اعتماد بدء العمل", message: `تم اعتماد البلاغ ${ticket.ticketNumber} للإصلاح المباشر`, type: "success", relatedTicketId: input.id });
      }
    } else if (input.maintenancePath === "B") {
      // Notify assigned technician for path B (purchase required)
      if (ticket.assignedToId) {
        await db.createNotification({ userId: ticket.assignedToId, title: "اعتماد بلاغ - مسار الشراء", message: `تم اعتماد البلاغ ${ticket.ticketNumber} - سيتم رفع طلب شراء المواد اللازمة`, type: "warning", relatedTicketId: input.id });
      }
    }
    return { success: true };
  }),

  /**
   * اعتماد مسار التنفيذ لبند بعينه — الخطوة 3 من ميزة البلاغ متعدد الجهات
   * (2026-08-08). نظير `approveWork` أعلاه لكن على مستوى البند، لتمكين "4 بنود،
   * 2 على مسار A و2 على مسار B" (مثال مؤكَّد من صاحب المشروع) — كل بند يُعتمَد
   * ويتقدّم بمساره المستقل، دون انتظار بقية بنود نفس البلاغ.
   *
   * `approveWork` يبقى الإجراء المستخدَم للبلاغات أحادية البند، لكنه منذ
   * 2026-08-12 يزامن بند التنفيذ الوحيد مع رأس البلاغ حتى لا تنفصل حالة
   * `ticket_items` عن `tickets` في مسارات A/B/C.
   *
   * ✅ توافق رجعي: إن كان هذا **البند الأول** (`itemNumber === 1`)، تُحدَّث أعمدة
   * البلاغ أيضًا (نفس تحديث `approveWork` تمامًا) — لأن هذا البند يمثّل "الجهة
   * الرئيسية" التي تعكسها تلك الأعمدة (راجع القاعدة الحرجة #11 و#12 بـCLAUDE.md).
   * أي شاشة/تقرير/PDF لم يُحدَّث بعد ليقرأ من `ticket_items` يستمر بالعمل بلا كسر.
   */
  approveWorkForItem: ticketScopedWorkflowManagerProcedure.input(z.object({
    ticketItemId: z.number(),
    maintenancePath: z.enum(["A", "B", "C"]),
    justification: z.string().optional(), // Required for Path C
  })).mutation(async ({ input, ctx }) => {
    const item = await db.getTicketItemById(input.ticketItemId);
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "بند البلاغ غير موجود" });
    const ticket = await db.getTicketById(item.ticketId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });

    assertTicketItemWorkflowManageable(ctx.user, ticket as any, item as any);
    if (!canSelectTicketItemMaintenancePath(ctx.user, ticket as any, item as any)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تحديد مسار التنفيذ لهذا البند الآن" });
    }
    if (input.maintenancePath === "C" && !input.justification) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "المسار C يتطلب مبرراً للصيانة الخارجية" });
    }

    const approvedAt = new Date();
    await db.updateTicketItem(input.ticketItemId, {
      status: "work_approved",
      maintenancePath: input.maintenancePath,
      approvedById: ctx.user.id,
      approvedAt,
      justification: input.justification ?? null,
    });

    // توافق رجعي: البند الأول يعكس بيانات "الجهة الرئيسية" على أعمدة البلاغ.
    if (item.itemNumber === 1) {
      await db.updateTicket(item.ticketId, {
        status: "work_approved",
        maintenancePath: input.maintenancePath,
        approvedById: ctx.user.id,
        justification: input.justification ?? null,
      });
    }

    await db.addTicketStatusHistory({
      ticketId: item.ticketId,
      fromStatus: "under_inspection",
      toStatus: "work_approved",
      changedById: ctx.user.id,
      notes: `بند ${item.itemNumber}${item.responsibleDepartment ? ` (${item.responsibleDepartment === MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT ? "تقنية المعلومات" : item.responsibleDepartment === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION ? "الإنشاءات" : "الصيانة العامة"})` : ""} — المسار: ${input.maintenancePath}`,
    });

    // نفس إشعارات approveWork، موجَّهة لفني/جهة هذا البند تحديدًا (قد يختلف عن رأس البلاغ).
    if (input.maintenancePath === "C") {
      const warehouseUsers = await db.getUsersByRole(APP_ROLE.WAREHOUSE);
      for (const warehouseUser of warehouseUsers) {
        await db.createNotification({
          userId: warehouseUser.id,
          title: "🔧 أصل بانتظار التجهيز للصيانة الخارجية",
          message: `تم اعتماد المسار C لبند ${item.itemNumber} ضمن البلاغ ${ticket.ticketNumber}. يرجى تجهيز الأصل، تحديد المندوب، وإصدار وثيقة الخروج.`,
          type: "warning",
          relatedTicketId: item.ticketId,
        });
      }
    } else if (item.assignedToId) {
      await db.createNotification({
        userId: item.assignedToId,
        title: input.maintenancePath === "A" ? "اعتماد بدء العمل" : "اعتماد بند - مسار الشراء",
        message: input.maintenancePath === "A"
          ? `تم اعتماد بند ${item.itemNumber} ضمن البلاغ ${ticket.ticketNumber} للإصلاح المباشر`
          : `تم اعتماد بند ${item.itemNumber} ضمن البلاغ ${ticket.ticketNumber} - سيتم رفع طلب شراء المواد اللازمة`,
        type: input.maintenancePath === "A" ? "success" : "warning",
        relatedTicketId: item.ticketId,
      });
    }

    return { success: true };
  }),

  assignTechnician: ticketManagerProcedure.input(z.object({
    id: z.number(),
    assignedToId: z.number(),
  })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  startWork: protectedProcedure.input(z.object({ id: z.number() })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  submitEstimate: ticketManagerProcedure.input(z.object({
    id: z.number(),
    estimatedCost: z.number(),
    estimateNotes: z.string().optional(),
  })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  submitToAccounting: accountantProcedure.input(z.object({ id: z.number() })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  submitToManagement: managementProcedure.input(z.object({ id: z.number() })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  approvePurchase: managementProcedure.input(z.object({ id: z.number() })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  executePurchase: ticketManagerProcedure.input(z.object({
    id: z.number(),
    isPartial: z.boolean().default(false),
  })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  completePurchase: ticketManagerProcedure.input(z.object({ id: z.number() })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  receiveInWarehouse: warehouseProcedure.input(z.object({ id: z.number() })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  markRepaired: ticketManagerProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    assertTicketWorkflowManageable(ctx.user, ticket as any);
    if (ticket.maintenancePath) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء القديم غير متاح لمسارات الصيانة A/B/C" });
    }
    if (ticket.status !== "ready_for_closure") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون جاهزاً للإغلاق" });
    await db.updateTicket(input.id, { status: "repaired" });
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "ready_for_closure", toStatus: "repaired", changedById: ctx.user.id });
    return { success: true };
  }),

  markVerified: supervisorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    assertTicketWorkflowManageable(ctx.user, ticket as any);
    if (ticket.maintenancePath) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء القديم غير متاح لمسارات الصيانة A/B/C" });
    }
    if (ticket.status !== "repaired") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون مصلحاً" });
    await db.updateTicket(input.id, { status: "verified" });
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "repaired", toStatus: "verified", changedById: ctx.user.id });
    return { success: true };
  }),
});
