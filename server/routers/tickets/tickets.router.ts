import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure, ticketProcedure } from "../_shared/procedures";
import { APP_ROLE, MAINTENANCE_MANAGER_FAMILY, MAINTENANCE_RESPONSIBLE_DEPARTMENT } from "@shared/roles";
import { detectLanguage, type SupportedLanguage } from "../../services/translation/translation";
import { queueTranslation, translationCache } from "../../services/translation/translationEngine";
import * as db from "../../_core/db";
import { assertTicketReadable, isRoleDeniedFromTickets } from "./tickets.access";
import { Pmv2TicketHandoffError, pmv2TicketHandoffService } from "../../pmv2/tickets/handoff-service";



function queueTicketHistoryTranslations(rows: any[], userId: number) {
  for (const row of rows) {
    const notes = String(row?.notes || "").trim();
    if (!notes || !row?.id) continue;
    void detectLanguage(notes)
      .then((sourceLanguage) => queueTranslation({
        entityType: "TICKET_STATUS_HISTORY",
        entityId: Number(row.id),
        fields: [{ fieldName: "notes", text: notes }],
        sourceLanguage,
        userId,
      }))
      .catch((error) => console.error("[TICKET_STATUS_HISTORY] Queue translation failed:", error));
  }
}

async function resolveSingleActiveItManager() {
  const managers = (await db.getUsersByRole(APP_ROLE.IT_MANAGER)).filter((u: any) => u.isActive !== 0);
  if (managers.length === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "لا يوجد مدير تقنية معلومات نشط. يجب تعيين مستخدم واحد بدور مدير تقنية المعلومات قبل إنشاء بلاغ IT.",
    });
  }
  if (managers.length > 1) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "يوجد أكثر من مدير تقنية معلومات نشط. يجب الإبقاء على مدير IT نشط واحد للتوجيه التلقائي في المرحلة الحالية.",
    });
  }
  return managers[0];
}

/**
 * توجيه بلاغ IT إلى مرحلة تخطيط المهام فقط.
 *
 * لا ننشئ مهمة أو بلاغًا فرعيًا هنا: مدير تقنية المعلومات هو من يقسم البلاغ
 * إلى مهمة واحدة أو عدة مهام لاحقًا. كل مهمة IT تُسند له تلقائيًا عند إنشائها
 * ثم يمكن تحويلها إلى بلاغ فرعي يدخل نفس A/B/C الحالي.
 */
async function createDirectItPlanningTicket(args: {
  tx: any;
  ticketNumber: string;
  ticketData: any;
  actorUserId: number;
  itManager: any;
}) {
  const { tx, ticketNumber, ticketData, actorUserId, itManager } = args;
  const routedAt = new Date();
  const routingNote = "توجيه آلي إلى تقنية المعلومات بناءً على تصنيف البلاغ";

  const parentId = await db.createTicket({
    ...ticketData,
    ticketNumber,
    status: "department_planning",
    workflowModel: "department_tasks",
    maintenanceResponsibleDepartment: MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT,
    maintenanceResponsibleManagerId: itManager.id,
    maintenanceRoutedById: actorUserId,
    maintenanceRoutedAt: routedAt,
    maintenanceRoutingNote: routingNote,
    assignedToId: null,
    assignedTechnicianId: null,
    assignedAt: null,
    inspectionWorkflowStatus: null,
  }, tx);
  if (!parentId) throw new Error("تعذر إنشاء بلاغ تقنية المعلومات");

  // بند توافق واحد للرأس فقط. المهمة/المهام الحقيقية ينشئها مدير IT بنفسه.
  await db.createTicketItem({
    ticketId: Number(parentId),
    itemNumber: 1,
    title: ticketData.title,
    description: ticketData.description ?? null,
    descriptionAr: ticketData.description ?? null,
    assetId: ticketData.assetId ?? null,
    responsibleDepartment: MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT,
    responsibleManagerId: itManager.id,
    routedById: actorUserId,
    routedAt,
    routingNote,
    status: "department_planning",
    assignedToId: null,
    assignedTechnicianId: null,
    isLegacySingleItem: 1,
    createdById: actorUserId,
  }, tx);

  await db.createTicketDepartments([{
    ticketId: Number(parentId),
    department: MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT,
    responsibleManagerId: itManager.id,
    routedById: actorUserId,
    routedAt,
    routingNote,
    organizationalTitle: "تقنية المعلومات",
    status: "planning",
  }], tx);

  return { id: Number(parentId), ticketNumber };
}

async function recordDirectItRouting(args: {
  actorUserId: number;
  parentId: number;
  ticketNumber: string;
  title: string;
  itManagerId: number;
}) {
  await db.addTicketStatusHistory({
    ticketId: args.parentId,
    fromStatus: undefined,
    toStatus: "department_planning",
    changedById: args.actorUserId,
    notes: "تم توجيه البلاغ آليًا إلى تقنية المعلومات لبدء تحليل وإنشاء المهام",
  });
  await db.createAuditLog({
    userId: args.actorUserId,
    action: "auto_route_it_ticket",
    entityType: "ticket",
    entityId: args.parentId,
    newValues: { itManagerId: args.itManagerId, workflowModel: "department_tasks" },
  });
  await db.createNotification({
    userId: args.itManagerId,
    title: "بلاغ تقنية معلومات جديد",
    message: `تم توجيه البلاغ ${args.ticketNumber} - ${args.title} إليك. راجع البلاغ وأنشئ مهمة واحدة أو عدة مهام حسب الحاجة.`,
    type: "info",
    relatedTicketId: args.parentId,
    allowItManager: true,
  });
}

export const ticketsRouter = router({
  list: protectedProcedure.input(z.object({
    status: z.string().optional(),
    priority: z.string().optional(),
    siteId: z.number().optional(),
    sectionId: z.number().optional(),
    assetId: z.number().optional(),
    search: z.string().optional(),
    category: z.string().optional(),
    assignedTechnicianId: z.number().optional(),
    assignedToId: z.number().optional(), // Phase 2: filter by user-based assignment
    maintenanceResponsibleDepartment: z.enum([
      MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL,
      MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION,
      MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT,
    ]).optional(),
  }).optional()).query(async ({ input, ctx }) => {
    const role = ctx.user.role;
    // ✅ إغلاق فجوة الواجهة/الخادم: أدوار محجوبة عن البلاغات بالواجهة كانت ترى الكل هنا
    if (isRoleDeniedFromTickets(role)) return [];
    let filters: any = { ...(input || {}) };
    if (role === APP_ROLE.OPERATOR) filters.reportedById = ctx.user.id;
    else if (role === APP_ROLE.TECHNICIAN) filters.assignedToId = ctx.user.id;
    else if (role === APP_ROLE.IT_MANAGER) filters.itManagerScopeUserId = ctx.user.id;
    // ⚠️ 2026-08-13: أُزيل فرع CONSTRUCTION_PROCUREMENT_MANAGER هنا عمدًا —
    // يرى الآن كل البلاغات بلا تضييق بقاعدة البيانات، مطابقًا لتوسيع الرؤية في
    // isTicketVisible. راجع docs/CONSTRUCTION_MANAGER_TICKET_READ_ACCESS.md.
    return db.getTickets(filters);
  }),

  // صفحات حقيقية لقائمة البلاغات (10 بلاغات/صفحة افتراضياً) — لا تؤثر على list الأصلي
  listPaginated: protectedProcedure.input(z.object({
    status: z.string().optional(),
    priority: z.string().optional(),
    siteId: z.number().optional(),
    sectionId: z.number().optional(),
    assetId: z.number().optional(),
    search: z.string().optional(),
    category: z.string().optional(),
    assignedTechnicianId: z.number().optional(),
    assignedToId: z.number().optional(),
    maintenanceResponsibleDepartment: z.enum([
      MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL,
      MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION,
      MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT,
    ]).optional(),
    page: z.number().min(1).default(1),
    pageSize: z.number().min(1).max(100).default(10),
    // خيارات "صندوق البلاغات" — اختيارية بالكامل ولا تغيّر سلوك الصفحة الحالية
    quickFilter: z.enum(["all", "critical", "unassigned", "stale", "ready_for_closure"]).optional(),
    sort: z.enum(["important", "newest", "oldest", "updated"]).optional(),
    // صفحة "كل البلاغات" فقط: تجمع البلاغات الفرعية داخل بطاقة البلاغ الرئيسي.
    groupSubTickets: z.boolean().optional(),
  }).optional()).query(async ({ input, ctx }) => {
    const role = ctx.user.role;
    const { page = 1, pageSize = 10, quickFilter, sort, groupSubTickets, ...rest } = input || {};
    // ✅ إغلاق فجوة الواجهة/الخادم (نفس قاعدة list)
    if (isRoleDeniedFromTickets(role)) return { items: [], total: 0, page, pageSize, totalPages: 0 } as any;
    let filters: any = { ...rest };
    // قيود الرؤية وحدها تُمرَّر أيضًا لاستعلام أبناء العائلة، حتى لا يؤدي التجميع
    // إلى كشف بلاغ فرعي من جهة/فني خارج نطاق المستخدم.
    const childVisibilityFilters: any = {};
    if (role === APP_ROLE.OPERATOR) {
      filters.reportedById = ctx.user.id;
      childVisibilityFilters.reportedById = ctx.user.id;
    } else if (role === APP_ROLE.TECHNICIAN) {
      filters.assignedToId = ctx.user.id;
      childVisibilityFilters.assignedToId = ctx.user.id;
    } else if (role === APP_ROLE.IT_MANAGER) {
      filters.itManagerScopeUserId = ctx.user.id;
      childVisibilityFilters.itManagerScopeUserId = ctx.user.id;
    }
    // ⚠️ 2026-08-13: أُزيل فرع CONSTRUCTION_PROCUREMENT_MANAGER هنا عمدًا —
    // نفس السبب أعلاه في list.
    return db.getTicketsPaginated(filters, page, pageSize, {
      quickFilter: quickFilter === "all" ? undefined : quickFilter,
      sort,
      groupSubTickets,
      childVisibilityFilters,
    });
  }),

  // عدادات الفلاتر السريعة لصندوق البلاغات — نفس الفلاتر ونفس نطاق الصلاحيات
  // المستخدم في list/listPaginated حرفيًا (operator ← بلاغاته، technician ← المسند له)
  inboxCounts: protectedProcedure.input(z.object({
    status: z.string().optional(),
    priority: z.string().optional(),
    siteId: z.number().optional(),
    sectionId: z.number().optional(),
    search: z.string().optional(),
    assignedToId: z.number().optional(),
    maintenanceResponsibleDepartment: z.enum([
      MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL,
      MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION,
      MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT,
    ]).optional(),
  }).optional()).query(async ({ input, ctx }) => {
    const role = ctx.user.role;
    // ✅ إغلاق فجوة الواجهة/الخادم (نفس قاعدة list)
    if (isRoleDeniedFromTickets(role)) return { all: 0, critical: 0, unassigned: 0, stale: 0, ready_for_closure: 0 } as any;
    let filters: any = { ...(input || {}) };
    if (role === APP_ROLE.OPERATOR) filters.reportedById = ctx.user.id;
    else if (role === APP_ROLE.TECHNICIAN) filters.assignedToId = ctx.user.id;
    else if (role === APP_ROLE.IT_MANAGER) filters.itManagerScopeUserId = ctx.user.id;
    // ⚠️ 2026-08-13: أُزيل فرع CONSTRUCTION_PROCUREMENT_MANAGER هنا عمدًا —
    // نفس السبب أعلاه في list.
    return db.getTicketsInboxCounts(filters);
  }),

  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    // القاعدة العامة تطابق القائمة. مدير الإنشاءات والمشتريات يملك استثناء
    // قراءة فقط عندما يكون البلاغ مرتبطًا بطلب شراء.
    await assertTicketReadable(ctx.user, ticket as any);
    const currentUserTaskAssignee = [APP_ROLE.TECHNICIAN, APP_ROLE.IT_MANAGER].includes(ctx.user.role as any) && ticket.sourceTaskId
      ? await db.isUserAssignedToTicketTasks(ticket.id, ticket.sourceTaskId, ctx.user.id)
      : false;
    return { ...ticket, currentUserTaskAssignee };
  }),

  /**
   * بنود البلاغ (المهام المتعددة داخله) — قراءة فقط.
   *
   * الخطوة 1 من ميزة "البلاغ متعدد الجهات والمسارات" (2026-08-08).
   * كل بلاغ له بند واحد على الأقل: البلاغات السابقة لهذه الميزة لها بند
   * واحد مُرحَّل تلقائيًا (isLegacySingleItem = 1).
   *
   * الصلاحية: نفس حارس قراءة البلاغ نفسه بالضبط (assertTicketReadable)،
   * فلا يفتح هذا الإجراء أي نطاق رؤية جديد لم يكن متاحًا أصلًا.
   */
  items: protectedProcedure.input(z.object({ ticketId: z.number() })).query(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.ticketId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    await assertTicketReadable(ctx.user, ticket as any);
    return db.getTicketItems(input.ticketId);
  }),

  /**
   * بنود المستخدم الحالي فقط ضمن مجموعة بلاغات — الخطوة 2 من ميزة البلاغ متعدد
   * الجهات (2026-08-08). تُستخدم من شاشات القوائم (بلاغات الإنشاءات مثلًا)
   * لعرض "بطاقة مهمتي" داخل كل بلاغ بدل الحقول العامة للبلاغ. آمنة بذاتها —
   * راجع db.getMyTicketItemsForTickets.
   */
  myItemsForTickets: protectedProcedure.input(z.object({ ticketIds: z.array(z.number()) })).query(async ({ input, ctx }) => {
    if (input.ticketIds.length === 0) return [];
    return db.getMyTicketItemsForTickets(input.ticketIds, ctx.user.id);
  }),

  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    priority: z.string().default("medium"),
    category: z.string().default("general"),
    siteId: z.number().optional(),
    sectionId: z.number().optional(),
    assetId: z.number().optional(),
    locationDetail: z.string().optional(),
    beforePhotoUrl: z.string().optional(),
    pmv2TaskItemId: z.number().int().positive().optional(),
  })).mutation(async ({ input, ctx }) => {
    if (!input.siteId || !input.sectionId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "يرجى اختيار الموقع والقسم" });
    }
    if (!input.beforePhotoUrl?.trim()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "يرجى إضافة صورة واحدة على الأقل للبلاغ" });
    }

    const { pmv2TaskItemId, ...ticketInput } = input;
    const isItTicket = ticketInput.category === "it";
    const itManager = isItTicket ? await resolveSingleActiveItManager() : null;

    // كشف اللغة فقط — الترجمة تحدث في الخلفية
    const detectedLang: SupportedLanguage = await detectLanguage(ticketInput.title).catch(() => "ar" as SupportedLanguage);

    let id: number | null = null;
    let ticketNumber = "";

    if (pmv2TaskItemId) {
      try {
        const created = await db.withTransaction(async (tx) => {
          await pmv2TicketHandoffService.prepareAtomicTicketCreation(
            tx,
            ctx.user.id,
            pmv2TaskItemId,
            {
              siteId: ticketInput.siteId,
              sectionId: ticketInput.sectionId,
              assetId: ticketInput.assetId,
            },
          );

          const atomicTicketNumber = await db.getNextTicketNumber(tx);
          let result: { id: number; ticketNumber: string };
          if (itManager) {
            result = await createDirectItPlanningTicket({
              tx,
              ticketNumber: atomicTicketNumber,
              actorUserId: ctx.user.id,
              itManager,
              ticketData: {
                ...ticketInput,
                originalLanguage: detectedLang,
                reportedById: ctx.user.id,
              },
            });
          } else {
            const atomicTicketId = await db.createTicket({
              ...ticketInput,
              originalLanguage: detectedLang,
              ticketNumber: atomicTicketNumber,
              reportedById: ctx.user.id,
              status: "pending_triage",
              workflowModel: "department_tasks",
            }, tx);
            if (!atomicTicketId) throw new Error("تعذر إنشاء البلاغ");
            result = { id: Number(atomicTicketId), ticketNumber: atomicTicketNumber };
          }

          await pmv2TicketHandoffService.linkAtomicCreatedTicket(tx, {
            userId: ctx.user.id,
            taskItemId: pmv2TaskItemId,
            ticketId: result.id,
            ticketNumber: result.ticketNumber,
          });
          return result;
        });
        id = created.id;
        ticketNumber = created.ticketNumber;
      } catch (error) {
        if (error instanceof Pmv2TicketHandoffError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
    } else if (itManager) {
      const created = await db.withTransaction(async (tx) => {
        const atomicTicketNumber = await db.getNextTicketNumber(tx);
        return createDirectItPlanningTicket({
          tx,
          ticketNumber: atomicTicketNumber,
          actorUserId: ctx.user.id,
          itManager,
          ticketData: {
            ...ticketInput,
            originalLanguage: detectedLang,
            reportedById: ctx.user.id,
          },
        });
      });
      id = created.id;
      ticketNumber = created.ticketNumber;
    } else {
      ticketNumber = await db.getNextTicketNumber();
      id = await db.createTicket({
        ...ticketInput,
        originalLanguage: detectedLang,
        ticketNumber,
        reportedById: ctx.user.id,
        status: "pending_triage",
        // كل بلاغ جديد يبدأ على نموذج الجهات/المهام؛ البلاغات السابقة للترحيل تبقى legacy.
        workflowModel: "department_tasks",
      });
    }
    if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء البلاغ" });

    // ترجمة في الخلفية — المستخدم لا ينتظر
    const fieldsToQueue = [
      { fieldName: "title", text: input.title },
      ...(input.description ? [{ fieldName: "description", text: input.description }] : []),
    ];
    queueTranslation({
      entityType: "TICKET",
      entityId: id,
      fields: fieldsToQueue,
      sourceLanguage: detectedLang,
      userId: ctx.user.id,
    }).catch(e => console.error("[Ticket] Queue translation failed:", e));

    await db.createAuditLog({ userId: ctx.user.id, action: "create_ticket", entityType: "ticket", entityId: id });

    if (itManager) {
      await recordDirectItRouting({
        actorUserId: ctx.user.id,
        parentId: id,
        ticketNumber,
        title: input.title,
        itManagerId: itManager.id,
      });
      return { id, ticketNumber };
    }

    await db.addTicketStatusHistory({ ticketId: id, fromStatus: undefined, toStatus: "pending_triage", changedById: ctx.user.id });

    // بند افتراضي للتوافق الرجعي مع ticket_items. في نموذج الجهات/المهام الجديد
    // لا يمثل هذا البند جهة أو مهمة؛ يبقى بند توافق واحد يعكس حالة الرأس.
    try {
      await db.createTicketItem({
        ticketId: id,
        itemNumber: 1,
        title: input.title,
        description: input.description ?? null,
        descriptionAr: input.description ?? null,
        assetId: input.assetId ?? null,
        status: "pending_triage",
        isLegacySingleItem: 1,
        createdById: ctx.user.id,
      });
    } catch (e) {
      console.error("[Ticket] Failed to create default ticket item:", e);
    }

    // البلاغات غير IT فقط تدخل طابور الفرز الحالي وتستخدم البث العام الحالي.
    const supervisors = await db.getUsersByRole("supervisor");
    for (const sup of supervisors) {
      await db.createNotification({ userId: sup.id, title: "بلاغ جديد بانتظار الفرز", message: `البلاغ ${ticketNumber} - ${input.title} بانتظار الفرز والتصنيف`, type: "info", relatedTicketId: id });
    }
    const managers = await db.getTicketManagerUsers();
    for (const mgr of managers) {
      await db.createNotification({ userId: mgr.id, title: "بلاغ جديد", message: `تم إنشاء بلاغ جديد: ${ticketNumber} - ${input.title}`, type: "info", relatedTicketId: id });
    }
    return { id, ticketNumber };
  }),

  update: protectedProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    description: z.string().optional(),
    priority: z.string().optional(),
    category: z.string().optional(),
    siteId: z.number().optional(),
    locationDetail: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    // حارس قراءة أولًا لمنع استدعاء update مباشرة على بلاغ خارج نطاق المستخدم.
    await assertTicketReadable(ctx.user, ticket as any);
    // الأدوار الثلاثة المحددة لا تعدّل بلاغًا أنشأه مستخدم آخر.
    // owner/admin فقط لهما تجاوز إداري؛ بقية الأدوار تحتفظ بالسلوك السابق (المنشئ فقط).
    const isCreatorRestrictedManager = (MAINTENANCE_MANAGER_FAMILY as readonly string[]).includes(ctx.user.role);
    const isAdminOverride = [APP_ROLE.OWNER, APP_ROLE.ADMIN].includes(ctx.user.role as any);
    const isReporter = ticket.reportedById === ctx.user.id;
    if (isCreatorRestrictedManager && !isReporter) {
      throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك تعديل هذا البلاغ لأنك لست منشئه" });
    }
    if (!isAdminOverride && !isReporter) {
      throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لتعديل هذا البلاغ" });
    }
    // ✅ البلاغ قابل للتعديل فقط طالما لم يُصنَّف بعد (لا يزال في مرحلة الفرز الأولي pending_triage).
    // بمجرد تصنيفه (انتقاله لأي حالة تالية) يُمنع التعديل نهائياً، بصرف النظر عن الدور.
    if (ticket.status !== "pending_triage") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تعديل البلاغ بعد تصنيفه" });
    }
    const { id, ...updateData } = input;
    const oldValues: any = {};
    const newValues: any = {};
    if (input.title && input.title !== ticket.title) { oldValues.title = ticket.title; newValues.title = input.title; }
    if (input.description && input.description !== ticket.description) { oldValues.description = ticket.description; newValues.description = input.description; }
    if (input.priority && input.priority !== ticket.priority) { oldValues.priority = ticket.priority; newValues.priority = input.priority; }
    if (input.category && input.category !== ticket.category) { oldValues.category = ticket.category; newValues.category = input.category; }
    if (input.siteId && input.siteId !== ticket.siteId) { oldValues.siteId = ticket.siteId; newValues.siteId = input.siteId; }
    // تحديث التذكرة فوراً
    await db.updateTicket(id, { ...updateData });

    // إعادة الترجمة في الخلفية إذا تغيرت حقول نصية
    const fieldsToRequeue = [
      ...(input.title && input.title !== ticket.title
        ? [{ fieldName: "title", text: input.title }] : []),
      ...(input.description && input.description !== ticket.description
        ? [{ fieldName: "description", text: input.description }] : []),
    ];
    if (fieldsToRequeue.length > 0) {
      const detectedLang = await detectLanguage(fieldsToRequeue[0].text).catch(() => ticket.originalLanguage as SupportedLanguage);
      queueTranslation({
        entityType: "TICKET",
        entityId: id,
        fields: fieldsToRequeue,
        sourceLanguage: detectedLang,
        userId: ctx.user.id,
      }).catch(e => console.error("[Ticket] Queue translation update failed:", e));
      translationCache.invalidate("TICKET", id);
    }

await db.createAuditLog({ userId: ctx.user.id, action: "update_ticket", entityType: "ticket", entityId: id, oldValues, newValues });
    // Notify managers about ticket edit
    if (Object.keys(newValues).length > 0) {
      const managers = await db.getTicketManagerUsers();
      const changedFields = Object.keys(newValues).join(", ");
      for (const mgr of managers) {
        if (mgr.id !== ctx.user.id) {
          await db.createNotification({ userId: mgr.id, title: `تعديل بلاغ #${ticket.ticketNumber}`, message: `قام ${ctx.user.name} بتعديل البلاغ "${ticket.title}" - الحقول: ${changedFields}`, type: "ticket_updated", relatedTicketId: id });
        }
      }
    }
    return { success: true };
  }),

  delete: ticketProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    // Only owner/admin can delete
    if (!["owner", "admin"].includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لحذف البلاغات" });
    }
    // لا نسمح بحذف الرأس التنظيمي مع بقاء بلاغات فرعية حيّة؛ وإلا ستتحول
    // الأبناء إلى بلاغات يتيمة ويفقد الفنيون الإضافيون رابط مهمة المصدر.
    if (ticket.workflowModel === "department_tasks") {
      const tasks = await db.getTicketTasks(ticket.id);
      if (tasks.some((task: any) => !!task.convertedTicketId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "لا يمكن حذف البلاغ الرئيسي قبل حذف البلاغات الفرعية المرتبطة به",
        });
      }
    }
    await db.deleteTicket(input.id);
    await db.createAuditLog({ userId: ctx.user.id, action: "delete_ticket", entityType: "ticket", entityId: input.id, oldValues: { ticketNumber: ticket.ticketNumber, title: ticket.title, status: ticket.status } });
    // Notify managers about ticket deletion
    const managers = await db.getTicketManagerUsers();
    for (const mgr of managers) {
      if (mgr.id !== ctx.user.id) {
        await db.createNotification({ userId: mgr.id, title: `حذف بلاغ #${ticket.ticketNumber}`, message: `قام ${ctx.user.name} بحذف البلاغ "${ticket.title}"`, type: "ticket_deleted", relatedTicketId: input.id });
      }
    }
    return { success: true };
  }),

  history: protectedProcedure.input(z.object({ ticketId: z.number() })).query(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.ticketId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    await assertTicketReadable(ctx.user, ticket as any);
    const rows = await db.getTicketHistory(input.ticketId);
    queueTicketHistoryTranslations(rows as any[], ctx.user.id);
    return rows;
  }),

  createTicket: protectedProcedure.input(z.object({
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "critical"]),
    category: z.enum(["electrical", "plumbing", "hvac", "structural", "mechanical", "general", "safety", "cleaning", "it"]),
    siteId: z.number().optional(),
    assetId: z.number().optional(),
    locationDetail: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const ticketNumber = `TK-${Date.now()}`;
    if (input.category === "it") {
      const itManager = await resolveSingleActiveItManager();
      const created = await db.withTransaction(async (tx) => createDirectItPlanningTicket({
        tx,
        ticketNumber,
        actorUserId: ctx.user.id,
        itManager,
        ticketData: {
          ...input,
          reportedById: ctx.user.id,
          originalLanguage: "ar",
        },
      }));
      await db.createAuditLog({ userId: ctx.user.id, action: "create_ticket", entityType: "ticket", entityId: created.id });
      await recordDirectItRouting({
        actorUserId: ctx.user.id,
        parentId: created.id,
        ticketNumber: created.ticketNumber,
        title: input.title,
        itManagerId: itManager.id,
      });
      return created.id;
    }

    const ticket = await db.createTicket({
      ticketNumber,
      title: input.title,
      description: input.description,
      priority: input.priority as any,
      category: input.category as any,
      siteId: input.siteId,
      assetId: input.assetId,
      locationDetail: input.locationDetail,
      reportedById: ctx.user.id,
      status: "pending_triage",
      workflowModel: "department_tasks",
    });
    if (!ticket) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const ticketId = typeof ticket === 'number' ? ticket : (ticket as any).id;
    await db.createTicketItem({
      ticketId, itemNumber: 1, title: input.title, description: input.description ?? null,
      descriptionAr: input.description ?? null, assetId: input.assetId ?? null,
      status: "pending_triage", isLegacySingleItem: 1, createdById: ctx.user.id,
    });
    await db.addTicketStatusHistory({ ticketId, fromStatus: "new", toStatus: "pending_triage", changedById: ctx.user.id });
    return ticket;
  }),

});
