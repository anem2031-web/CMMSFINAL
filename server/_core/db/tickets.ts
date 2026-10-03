// ============================================================
// db/tickets.ts — البلاغات وسجل حالاتها وتأكيداتها
// (مُقسَّم من db.ts الأصلي حسب المجال الوظيفي)
// ============================================================
import { eq, desc, asc, and, sql, count, sum, inArray, notInArray, like, or, gte, lte, lt, isNull, isNotNull, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { alias } from "drizzle-orm/mysql-core";
import mysql from "mysql2/promise";
import {
  InsertUser, users, tickets, purchaseOrders, purchaseOrderItems,
  inventory, inventoryTransactions, notifications, auditLogs,
  ticketStatusHistory, ticketItems, ticketDepartments, ticketTasks, ticketTaskAssignees, attachments, sites, backups,
  assets, preventivePlans, pmWorkOrders, assetSpareParts, pmJobs, assetMetrics,
  pmChecklistItems, pmWorkOrderBranches,
  twoFactorSecrets, twoFactorAuditLogs,
  pushSubscriptions, sections, technicians, inspectionResults,
  type InsertAsset, type InsertPreventivePlan, type PreventivePlan, type InsertPMWorkOrder,
  type InsertSection, type InsertInspectionResult,
  assetCategories,
  procurementComments,
  type InsertProcurementComment,
  warehouseReceipts,
  warehouseReturns,
  warehouseReceiptItems,
  ocrJobs,
  type InsertWarehouseReceipt,
  type InsertWarehouseReturn,
  ticketConfirmations,
  type InsertTicketConfirmation,
  deliveryDocuments,
  returnDocuments,
  deliveryNumberCounter,
  itemBarcodeCounter,
  disposalOperations,
  disposalItems,
  disposalNumberCounter,
  poPricingBatches,
  type InsertPOPricingBatch,
  inventoryCountOperations,
  inventoryCountItems,
  inventorySettlements,
  inventorySettlementItems,
  inventoryCountNumberCounter,
  inventorySettlementNumberCounter,
} from "../../../drizzle/schema";
import { ENV } from '../env';
import { MAINTENANCE_RESPONSIBLE_DEPARTMENT } from "@shared/roles";


import { getDb } from "./client";

// ============================================================
// TICKETS
// ============================================================
/**
 * توليد رقم البلاغ التالي من أعلى رقم بلاغ رئيسي فعلي للسنة الحالية.
 *
 * خلال فترة الانتقال بين النسخة القديمة والجديدة يجب أن يكون جدول `tickets`
 * هو مصدر الحقيقة المشترك للترقيم. نستبعد البلاغات الفرعية صراحةً حتى لا تدخل
 * أرقام مثل MT-2026-00246-01 في حساب الرقم الرئيسي التالي.
 */
export async function getNextTicketNumber(tx?: any) {
  const db = tx || await getDb();
  const year = new Date().getFullYear();
  const prefix = `MT-${year}-`;
  if (!db) return `${prefix}00001`;

  const mainTicketPattern = `^MT-${year}-[0-9]{5}$`;
  const lastTicket = await db
    .select({ ticketNumber: tickets.ticketNumber })
    .from(tickets)
    .where(sql`${tickets.ticketNumber} REGEXP ${mainTicketPattern}`)
    .orderBy(desc(tickets.ticketNumber))
    .limit(1);

  let nextNum = 1;
  if (lastTicket.length > 0) {
    const parts = lastTicket[0].ticketNumber.split("-");
    const lastNum = parseInt(parts[parts.length - 1] || "0", 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(5, "0")}`;
}

export async function createTicket(data: any, tx?: any) {
  const db = tx || await getDb();
  if (!db) return null;
  const result = await db.insert(tickets).values(data);
  return result[0].insertId;
}

type TicketListFilters = { status?: string; priority?: string; siteId?: number; sectionId?: number; assetId?: number; assignedToId?: number; assignedTechnicianId?: number; reportedById?: number; search?: string; category?: string; maintenanceResponsibleDepartment?: string; maintenanceResponsibleManagerId?: number; constructionManagerScopeUserId?: number; itManagerScopeUserId?: number };

// شرط الفلترة المشترك بين getTickets وgetTicketsInboxCounts وgetTicketsPaginated
function buildTicketsWhere(filters?: TicketListFilters) {
  const conditions: any[] = [];
  if (filters?.status) {
    conditions.push(filters.status === "open" ? ne(tickets.status, "closed" as any) : eq(tickets.status, filters.status as any));
  }
  if (filters?.priority) conditions.push(eq(tickets.priority, filters.priority as any));
  if (filters?.siteId) conditions.push(eq(tickets.siteId, filters.siteId));
  if (filters?.sectionId) conditions.push(eq(tickets.sectionId, filters.sectionId));
  if (filters?.assetId) conditions.push(eq(tickets.assetId, filters.assetId));

  // الفني قد يكون على الرأس/بند قديم أو على مهمة في النموذج الجديد.
  if (filters?.assignedToId || filters?.assignedTechnicianId) {
    const ticketLevelConds: any[] = [];
    if (filters.assignedToId) ticketLevelConds.push(eq(tickets.assignedToId, filters.assignedToId));
    if (filters.assignedTechnicianId) ticketLevelConds.push(eq(tickets.assignedTechnicianId, filters.assignedTechnicianId));
    const ticketLevel = ticketLevelConds.length > 1 ? or(...ticketLevelConds) : ticketLevelConds[0];
    const itemExists = sql`EXISTS (SELECT 1 FROM \`ticket_items\` WHERE \`ticket_items\`.\`ticketId\` = ${tickets.id} AND (
      ${filters.assignedToId ? sql`\`ticket_items\`.\`assignedToId\` = ${filters.assignedToId}` : sql`FALSE`}
      OR ${filters.assignedTechnicianId ? sql`\`ticket_items\`.\`assignedTechnicianId\` = ${filters.assignedTechnicianId}` : sql`FALSE`}
    ))`;
    const scopedUserId = filters.assignedToId ?? filters.assignedTechnicianId;
    const taskAssigneeExists = scopedUserId ? sql`EXISTS (
      SELECT 1 FROM \`ticket_task_assignees\` tta
      INNER JOIN \`ticket_tasks\` tt ON tt.\`id\` = tta.\`taskId\`
      WHERE tta.\`userId\` = ${scopedUserId}
        AND (tt.\`ticketId\` = ${tickets.id} OR ${tickets.sourceTaskId} = tt.\`id\`)
    )` : sql`FALSE`;
    conditions.push(or(ticketLevel, itemExists, taskAssigneeExists));
  }

  if (filters?.reportedById) conditions.push(eq(tickets.reportedById, filters.reportedById));

  // مدير تقنية المعلومات: بلاغاته الشخصية + ما وُجه إليه كجهة IT بأي طبقة
  // + البلاغ الفرعي/المهمة المسندة إليه. لا يسقط الدور الجديد إلى رؤية كل البلاغات.
  if (filters?.itManagerScopeUserId) {
    const uid = filters.itManagerScopeUserId;
    const routedAtTicket = and(
      eq(tickets.maintenanceResponsibleDepartment, MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT as any),
      eq(tickets.maintenanceResponsibleManagerId, uid),
    );
    const assignedAtTicket = eq(tickets.assignedToId, uid);
    const routedAtItem = sql`EXISTS (SELECT 1 FROM \`ticket_items\` WHERE \`ticket_items\`.\`ticketId\` = ${tickets.id}
      AND \`ticket_items\`.\`responsibleDepartment\` = ${MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT}
      AND \`ticket_items\`.\`responsibleManagerId\` = ${uid})`;
    const assignedAtItem = sql`EXISTS (SELECT 1 FROM \`ticket_items\` WHERE \`ticket_items\`.\`ticketId\` = ${tickets.id}
      AND \`ticket_items\`.\`assignedToId\` = ${uid})`;
    const routedAtDepartment = sql`EXISTS (SELECT 1 FROM \`ticket_departments\` WHERE \`ticket_departments\`.\`ticketId\` = ${tickets.id}
      AND \`ticket_departments\`.\`department\` = ${MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT}
      AND \`ticket_departments\`.\`responsibleManagerId\` = ${uid})`;
    const assignedAtTask = sql`EXISTS (
      SELECT 1 FROM \`ticket_task_assignees\` tta
      INNER JOIN \`ticket_tasks\` tt ON tt.\`id\` = tta.\`taskId\`
      WHERE tta.\`userId\` = ${uid}
        AND (tt.\`ticketId\` = ${tickets.id} OR ${tickets.sourceTaskId} = tt.\`id\`)
    )`;
    const ownTicket = eq(tickets.reportedById, uid);
    conditions.push(or(routedAtTicket, assignedAtTicket, routedAtItem, assignedAtItem, routedAtDepartment, assignedAtTask, ownTicket));
  }

  // مدير الإنشاءات: ما وُجه إليه بأي طبقة + بلاغه الشخصي قبل الفرز فقط.
  if (filters?.constructionManagerScopeUserId) {
    const uid = filters.constructionManagerScopeUserId;
    const routedAtTicket = and(
      eq(tickets.maintenanceResponsibleDepartment, MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION as any),
      eq(tickets.maintenanceResponsibleManagerId, uid),
    );
    const routedAtItem = sql`EXISTS (SELECT 1 FROM \`ticket_items\` WHERE \`ticket_items\`.\`ticketId\` = ${tickets.id}
      AND \`ticket_items\`.\`responsibleDepartment\` = ${MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION}
      AND \`ticket_items\`.\`responsibleManagerId\` = ${uid})`;
    const routedAtDepartment = sql`EXISTS (SELECT 1 FROM \`ticket_departments\` WHERE \`ticket_departments\`.\`ticketId\` = ${tickets.id}
      AND \`ticket_departments\`.\`department\` = ${MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION}
      AND \`ticket_departments\`.\`responsibleManagerId\` = ${uid})`;
    const ownPending = and(eq(tickets.reportedById, uid), eq(tickets.status, "pending_triage" as any));
    conditions.push(or(routedAtTicket, routedAtItem, routedAtDepartment, ownPending));
  }

  // الجهة/المسؤول قد يوجدان في الرأس أو ticket_items أو ticket_departments.
  if (filters?.maintenanceResponsibleDepartment && filters?.maintenanceResponsibleManagerId) {
    const ticketLevel = and(
      eq(tickets.maintenanceResponsibleDepartment, filters.maintenanceResponsibleDepartment as any),
      eq(tickets.maintenanceResponsibleManagerId, filters.maintenanceResponsibleManagerId),
    );
    const itemExists = sql`EXISTS (SELECT 1 FROM \`ticket_items\` WHERE \`ticket_items\`.\`ticketId\` = ${tickets.id}
      AND \`ticket_items\`.\`responsibleDepartment\` = ${filters.maintenanceResponsibleDepartment}
      AND \`ticket_items\`.\`responsibleManagerId\` = ${filters.maintenanceResponsibleManagerId})`;
    const departmentExists = sql`EXISTS (SELECT 1 FROM \`ticket_departments\` WHERE \`ticket_departments\`.\`ticketId\` = ${tickets.id}
      AND \`ticket_departments\`.\`department\` = ${filters.maintenanceResponsibleDepartment}
      AND \`ticket_departments\`.\`responsibleManagerId\` = ${filters.maintenanceResponsibleManagerId})`;
    conditions.push(or(ticketLevel, itemExists, departmentExists));
  } else {
    if (filters?.maintenanceResponsibleDepartment) {
      const department = filters.maintenanceResponsibleDepartment;
      conditions.push(or(
        eq(tickets.maintenanceResponsibleDepartment, department as any),
        sql`EXISTS (SELECT 1 FROM \`ticket_items\` WHERE \`ticket_items\`.\`ticketId\` = ${tickets.id} AND \`ticket_items\`.\`responsibleDepartment\` = ${department})`,
        sql`EXISTS (SELECT 1 FROM \`ticket_departments\` WHERE \`ticket_departments\`.\`ticketId\` = ${tickets.id} AND \`ticket_departments\`.\`department\` = ${department})`,
      ));
    }
    if (filters?.maintenanceResponsibleManagerId) {
      const managerId = filters.maintenanceResponsibleManagerId;
      conditions.push(or(
        eq(tickets.maintenanceResponsibleManagerId, managerId),
        sql`EXISTS (SELECT 1 FROM \`ticket_items\` WHERE \`ticket_items\`.\`ticketId\` = ${tickets.id} AND \`ticket_items\`.\`responsibleManagerId\` = ${managerId})`,
        sql`EXISTS (SELECT 1 FROM \`ticket_departments\` WHERE \`ticket_departments\`.\`ticketId\` = ${tickets.id} AND \`ticket_departments\`.\`responsibleManagerId\` = ${managerId})`,
      ));
    }
  }

  if (filters?.search) conditions.push(or(
    like(tickets.title, `%${filters.search}%`), like(tickets.titleAr, `%${filters.search}%`),
    like(tickets.titleEn, `%${filters.search}%`), like(tickets.titleUr, `%${filters.search}%`),
    like(tickets.ticketNumber, `%${filters.search}%`)
  ));
  if (filters?.category) conditions.push(eq(tickets.category, filters.category as any));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function getTickets(filters?: TicketListFilters) {
  const db = await getDb();
  if (!db) return [];
  const where = buildTicketsWhere(filters);
  // Phase 4: join both external technicians table AND internal users table
  // to resolve display names for both assignment paths.
  const assignedUser = alias(users, "assignedUser");
  const rows = await db
    .select({
      ticket: tickets,
      technicianName: technicians.name,           // external technician name
      assignedUserName: assignedUser.name,         // internal user name
    })
    .from(tickets)
    .leftJoin(technicians, eq(tickets.assignedTechnicianId, technicians.id))
    .leftJoin(assignedUser, eq(tickets.assignedToId, assignedUser.id))
    .where(where)
    .orderBy(desc(tickets.createdAt));
  return rows.map(r => ({
    ...r.ticket,
    assignedTechnicianName: r.technicianName ?? null,   // legacy external path
    assignedToUserName: r.assignedUserName ?? null,     // Phase 4: internal path
  }));
}

// ============================================================
// صندوق البلاغات (Tickets Inbox) — فلاتر سريعة وترتيب من الخادم
// ملاحظة مهمة: هذه ليست Workflow جديدًا — مجرد شروط "عرض/قراءة" إضافية
// تُبنى فوق نفس buildTicketsWhere ونفس الجدول ونفس الحالات المعرّفة في
// drizzle/schema (ticketStatuses / ticketPriorities). لا قيم جديدة.
// ============================================================
export type TicketInboxQuickFilter = "all" | "critical" | "unassigned" | "stale" | "ready_for_closure";
export type TicketInboxSort = "important" | "newest" | "oldest" | "updated";

const STALE_HOURS = 48;

// شرط "بلاغ مفتوح" = ليس مغلقًا (نفس تعريف فلتر status="open" المستخدم في buildTicketsWhere)
function openCondition() {
  return ne(tickets.status, "closed" as any);
}

// شروط الفلاتر السريعة — تُضاف فوق شرط buildTicketsWhere ولا تستبدله
function quickFilterCondition(quickFilter?: TicketInboxQuickFilter) {
  switch (quickFilter) {
    case "critical":
      // الأولوية الحرجة الحالية (من ticketPriorities)
      return eq(tickets.priority, "critical" as any);
    case "unassigned":
      // في البلاغ الرئيسي الجديد لا يُسند الفني على الرأس؛ يُسند على المهام. لذلك
      // لا نعتبره "غير مسند" إذا كان لأي مهمة تحته فني واحد على الأقل.
      return and(
        openCondition(),
        isNull(tickets.assignedToId),
        isNull(tickets.assignedTechnicianId),
        sql`(${tickets.workflowModel} <> 'department_tasks' OR NOT EXISTS (
          SELECT 1 FROM \`ticket_task_assignees\` tta
          INNER JOIN \`ticket_tasks\` tt ON tt.\`id\` = tta.\`taskId\`
          WHERE tt.\`ticketId\` = ${tickets.id}
        ))`,
      );
    case "stale":
      // بلاغ مفتوح لم يتغير updatedAt الخاص به منذ 48 ساعة
      return and(openCondition(), sql`${tickets.updatedAt} < (NOW() - INTERVAL ${sql.raw(String(STALE_HOURS))} HOUR)`);
    case "ready_for_closure":
      // الحالة الحالية المستخدمة في النظام للجاهزية للإغلاق (من ticketStatuses)
      return eq(tickets.status, "ready_for_closure" as any);
    default:
      return undefined;
  }
}

// ترتيب "الأهم أولًا": الحرجة ← غير المسندة ← بدون تحديث 48س ← أقدم المفتوحة ← البقية
function importantFirstRank() {
  return sql`CASE
    WHEN ${tickets.status} <> 'closed' AND ${tickets.priority} = 'critical' THEN 0
    WHEN ${tickets.status} <> 'closed'
      AND ${tickets.assignedToId} IS NULL
      AND ${tickets.assignedTechnicianId} IS NULL
      AND (${tickets.workflowModel} <> 'department_tasks' OR NOT EXISTS (
        SELECT 1 FROM \`ticket_task_assignees\` tta
        INNER JOIN \`ticket_tasks\` tt ON tt.\`id\` = tta.\`taskId\`
        WHERE tt.\`ticketId\` = ${tickets.id}
      )) THEN 1
    WHEN ${tickets.status} <> 'closed' AND ${tickets.updatedAt} < (NOW() - INTERVAL ${sql.raw(String(STALE_HOURS))} HOUR) THEN 2
    WHEN ${tickets.status} <> 'closed' THEN 3
    ELSE 4
  END`;
}

// عدادات الفلاتر السريعة — نفس شرط buildTicketsWhere (وبالتالي نفس نطاق الصلاحيات
// الممرر من الراوتر) ثم عدّ كل فلتر سريع فوقه
export async function getTicketsInboxCounts(filters?: TicketListFilters) {
  const db = await getDb();
  if (!db) return { all: 0, critical: 0, unassigned: 0, stale: 0, ready_for_closure: 0 };
  const base = buildTicketsWhere(filters);
  const countWhere = async (qf?: TicketInboxQuickFilter) => {
    const extra = quickFilterCondition(qf);
    const where = base && extra ? and(base, extra) : (extra ?? base);
    const [{ cnt }] = await db.select({ cnt: count() }).from(tickets).where(where);
    return Number(cnt) || 0;
  };
  const [all, critical, unassigned, stale, ready] = await Promise.all([
    countWhere(undefined),
    countWhere("critical"),
    countWhere("unassigned"),
    countWhere("stale"),
    countWhere("ready_for_closure"),
  ]);
  return { all, critical, unassigned, stale, ready_for_closure: ready };
}

// صفحات حقيقية لقائمة البلاغات: ترجع فقط عناصر الصفحة المطلوبة + العدد الإجمالي
// لحساب عدد الصفحات بالواجهة (limit/offset على مستوى قاعدة البيانات بعد تطبيق نفس الفلاتر والبحث)
// خيارات inbox (quickFilter/sort) اختيارية ولا تغيّر السلوك الافتراضي القديم إطلاقًا
export async function getTicketsPaginated(
  filters: TicketListFilters | undefined,
  page: number = 1,
  pageSize: number = 10,
  options?: {
    quickFilter?: TicketInboxQuickFilter;
    sort?: TicketInboxSort;
    groupSubTickets?: boolean;
    childVisibilityFilters?: TicketListFilters;
  },
) {
  const db = await getDb();
  if (!db) return { tickets: [] as any[], total: 0, page: 1, pageSize, totalPages: 1 };

  const groupSubTickets = options?.groupSubTickets === true;
  const base = buildTicketsWhere(filters);
  const extra = quickFilterCondition(options?.quickFilter);
  const topLevelOnly = groupSubTickets ? ne(tickets.workflowModel, "sub_ticket" as any) : undefined;
  const whereParts = [base, extra, topLevelOnly].filter(Boolean) as any[];
  const where = whereParts.length > 1 ? and(...whereParts) : whereParts[0];

  const [{ cnt }] = await db.select({ cnt: count() }).from(tickets).where(where);
  const total = Number(cnt) || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const offset = (safePage - 1) * pageSize;

  // ترتيب النتائج: الافتراضي القديم (الأحدث أولًا) يبقى كما هو تمامًا
  const sortMode = options?.sort;
  const orderExprs =
    sortMode === "important"
      ? [asc(importantFirstRank()),
         // داخل الفئات المفتوحة (0-3): الأقدم أولًا — والبقية (المغلقة): الأحدث أولًا
         asc(sql`IF(${importantFirstRank()} < 4, UNIX_TIMESTAMP(${tickets.createdAt}), -UNIX_TIMESTAMP(${tickets.createdAt}))`)]
      : sortMode === "oldest"
        ? [asc(tickets.createdAt)]
        : sortMode === "updated"
          ? [desc(tickets.updatedAt)]
          : [desc(tickets.createdAt)]; // newest / الافتراضي القديم

  const assignedUser = alias(users, "assignedUser");
  const reporter = alias(users, "reporterUser");
  const rows = await db
    .select({
      ticket: tickets,
      technicianName: technicians.name,
      assignedUserName: assignedUser.name,
      reporterName: reporter.name,
    })
    .from(tickets)
    .leftJoin(technicians, eq(tickets.assignedTechnicianId, technicians.id))
    .leftJoin(assignedUser, eq(tickets.assignedToId, assignedUser.id))
    .leftJoin(reporter, eq(tickets.reportedById, reporter.id))
    .where(where)
    .orderBy(...orderExprs)
    .limit(pageSize)
    .offset(offset);

  const mappedParents = rows.map(r => ({
    ...r.ticket,
    assignedTechnicianName: r.technicianName ?? null,
    assignedToUserName: r.assignedUserName ?? null,
    reportedByName: r.reporterName ?? null,
  }));

  if (!groupSubTickets || mappedParents.length === 0) {
    return { tickets: mappedParents, total, page: safePage, pageSize, totalPages };
  }

  // البلاغات الفرعية لا تدخل في pagination نفسها؛ تُحمّل فقط للعائلات الموجودة في الصفحة.
  // childVisibilityFilters تحتوي قيود الدور فقط (وليس فلاتر المستخدم) حتى تظهر كل
  // البلاغات الفرعية المسموح له برؤيتها داخل العائلة دون تسريب نطاق جهة/فني آخر.
  const parentIds = mappedParents.map((ticket: any) => ticket.id);
  const childVisibility = buildTicketsWhere(options?.childVisibilityFilters);
  const childWhereParts = [
    inArray(tickets.parentTicketId, parentIds),
    eq(tickets.workflowModel, "sub_ticket" as any),
    childVisibility,
  ].filter(Boolean) as any[];
  const childWhere = and(...childWhereParts);

  const childAssignedUser = alias(users, "childAssignedUser");
  const childReporter = alias(users, "childReporterUser");
  const childRows = await db
    .select({
      ticket: tickets,
      technicianName: technicians.name,
      assignedUserName: childAssignedUser.name,
      reporterName: childReporter.name,
    })
    .from(tickets)
    .leftJoin(technicians, eq(tickets.assignedTechnicianId, technicians.id))
    .leftJoin(childAssignedUser, eq(tickets.assignedToId, childAssignedUser.id))
    .leftJoin(childReporter, eq(tickets.reportedById, childReporter.id))
    .where(childWhere)
    .orderBy(asc(tickets.parentTicketId), asc(tickets.subTicketSequence), asc(tickets.createdAt));

  const childrenByParent = new Map<number, any[]>();
  for (const row of childRows) {
    if (!row.ticket.parentTicketId) continue;
    const child = {
      ...row.ticket,
      assignedTechnicianName: row.technicianName ?? null,
      assignedToUserName: row.assignedUserName ?? null,
      reportedByName: row.reporterName ?? null,
    };
    const bucket = childrenByParent.get(row.ticket.parentTicketId) || [];
    bucket.push(child);
    childrenByParent.set(row.ticket.parentTicketId, bucket);
  }

  return {
    tickets: mappedParents.map((ticket: any) => ({
      ...ticket,
      subTickets: childrenByParent.get(ticket.id) || [],
    })),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export async function getTicketById(id: number, tx?: any) {
  const db = tx || await getDb();
  if (!db) return null;
  const result = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  return result[0] || null;
}

/**
 * البلاغات الفرعية التابعة لبلاغ رئيسي واحد (workflowModel = department_tasks).
 * مرتبة بتسلسل الفرع لتطابق ترتيب أرقامها (…-01 ثم …-02).
 */
export async function getSubTicketsByParent(parentTicketId: number, tx?: any) {
  const db = tx || await getDb();
  if (!db) return [];
  return db
    .select()
    .from(tickets)
    .where(and(eq(tickets.parentTicketId, parentTicketId), eq(tickets.workflowModel, "sub_ticket" as any)))
    .orderBy(asc(tickets.subTicketSequence), asc(tickets.createdAt));
}

export async function getTicketsByAsset(assetId: number) {  const db = await getDb();
  if (!db) return [];
  return db.select().from(tickets).where(eq(tickets.assetId, assetId)).orderBy(desc(tickets.createdAt));
}

export async function updateTicket(id: number, data: any, tx?: any) {
  const db = tx || await getDb();
  if (!db) return;
  await db.update(tickets).set(data).where(eq(tickets.id, id));
}

/**
 * Notification recipients for the current ticket route.
 * Construction tickets notify the explicitly routed construction manager;
 * general/unclassified tickets notify the general-maintenance manager family.
 * Legacy manager + owner/admin remain included for compatibility/oversight.
 */
export async function getTicketWorkflowManagerUsers(ticket: {
  maintenanceResponsibleDepartment?: string | null;
  maintenanceResponsibleManagerId?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];

  const baseRoles = ticket.maintenanceResponsibleDepartment === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION
    ? ["maintenance_manager", "owner", "admin"]
    : ["maintenance_manager", "general_maintenance_manager", "owner", "admin"];

  const base = await db.select().from(users).where(inArray(users.role, baseRoles as any[]));
  if (!ticket.maintenanceResponsibleManagerId) return base;

  const routed = await db.select().from(users)
    .where(eq(users.id, ticket.maintenanceResponsibleManagerId))
    .limit(1);

  const merged = new Map<number, (typeof base)[number]>();
  for (const user of [...base, ...routed]) merged.set(user.id, user);
  return Array.from(merged.values());
}

// ============================================================
// TICKET STATUS HISTORY
// ============================================================
export async function addTicketStatusHistory(data: { ticketId: number; fromStatus?: string; toStatus: string; changedById: number; notes?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(ticketStatusHistory).values(data);
}

// ============================================================
// TICKET CONFIRMATIONS (requester confirms completion after closure)
// ============================================================
export async function createTicketConfirmation(data: InsertTicketConfirmation) {
  const db = await getDb();
  if (!db) return;
  await db.insert(ticketConfirmations).values(data);
}

export async function getTicketConfirmation(ticketId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(ticketConfirmations).where(eq(ticketConfirmations.ticketId, ticketId)).orderBy(desc(ticketConfirmations.createdAt)).limit(1);
  return result[0] || null;
}

export async function getTicketHistory(ticketId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ticketStatusHistory).where(eq(ticketStatusHistory.ticketId, ticketId)).orderBy(desc(ticketStatusHistory.createdAt));
}


// ============================================================
// TICKET ITEMS — بنود البلاغ (مهام متعددة داخل البلاغ الواحد)
//
// الخطوة 1 من ميزة "البلاغ متعدد الجهات والمسارات" (2026-08-08).
// كل بلاغ — قديمًا كان أم جديدًا — له بند واحد على الأقل، فلا يوجد
// فرعان منفصلان بالكود لـ"بلاغ أحادي" و"بلاغ متعدد": كلاهما نفس المسار.
//
// ⚠️ قاعدة إلزامية (نفس مبدأ الإصلاح #1 بـCLAUDE.md — ثغرة IDOR):
// أي itemId يصل من العميل مصحوبًا بـticketId يجب أن يمر على
// assertTicketItemBelongsToTicket قبل أي قراءة حساسة أو تعديل أو حذف.
// ============================================================

export async function getTicketItems(ticketId: number, tx?: any) {
  const db = tx || await getDb();
  if (!db) return [];
  return db
    .select()
    .from(ticketItems)
    .where(eq(ticketItems.ticketId, ticketId))
    .orderBy(asc(ticketItems.itemNumber), asc(ticketItems.id));
}

export async function getTicketItemById(id: number, tx?: any) {
  const db = tx || await getDb();
  if (!db) return null;
  const result = await db.select().from(ticketItems).where(eq(ticketItems.id, id)).limit(1);
  return result[0] || null;
}

/**
 * جلب بنود عدة بلاغات دفعة واحدة (يمنع نمط N+1 بشاشات القوائم).
 */
export async function getTicketItemsForTickets(ticketIds: number[]) {
  const db = await getDb();
  if (!db || ticketIds.length === 0) return [];
  return db
    .select()
    .from(ticketItems)
    .where(inArray(ticketItems.ticketId, ticketIds))
    .orderBy(asc(ticketItems.ticketId), asc(ticketItems.itemNumber), asc(ticketItems.id));
}

/**
 * بنود المستخدم الحالي فقط ضمن مجموعة بلاغات — الخطوة 2 من ميزة البلاغ متعدد
 * الجهات (2026-08-08). مُصمَّمة لعرض "بطاقة مهمتي" بشاشات القوائم (بلاغات
 * الإنشاءات مثلًا) بدل عرض كل بنود البلاغ لكل من يرى القائمة.
 *
 * ✅ آمنة بذاتها بلا حاجة لفحص صلاحية إضافي: الشرط `OR` يقتصر على بنود يكون
 * فيها المستخدم تحديدًا مسؤولًا أو فنيًا مسندًا — لا يمكن لمستخدم رؤية بند لا
 * يخصه عبر هذه الدالة مهما كانت الأدوار.
 */
export async function getMyTicketItemsForTickets(ticketIds: number[], userId: number) {
  const db = await getDb();
  if (!db || ticketIds.length === 0) return [];
  return db
    .select()
    .from(ticketItems)
    .where(and(
      inArray(ticketItems.ticketId, ticketIds),
      or(
        eq(ticketItems.responsibleManagerId, userId),
        eq(ticketItems.assignedToId, userId),
        eq(ticketItems.assignedTechnicianId, userId),
      ),
    ))
    .orderBy(asc(ticketItems.ticketId), asc(ticketItems.itemNumber));
}

/**
 * التحقق أن البند ينتمي فعلًا للبلاغ المُمرَّر قبل أي إجراء عليه.
 * يعيد البند عند النجاح، وnull عند الفشل — القرار (رمي الخطأ) يبقى
 * بالراوتر حتى لا تعتمد طبقة قاعدة البيانات على TRPCError.
 */
export async function assertTicketItemBelongsToTicket(
  itemId: number,
  ticketId: number,
  tx?: any,
) {
  const item = await getTicketItemById(itemId, tx);
  if (!item || item.ticketId !== ticketId) return null;
  return item;
}

/**
 * أعلى رقم بند مُستخدَم داخل البلاغ — لتوليد رقم البند التالي.
 * يُستدعى دائمًا داخل نفس المعاملة التي تُدرج البند، لأن الفهرس الفريد
 * (uq_ticket_items_ticket_number) هو الضامن النهائي ضد التزامن.
 */
export async function getMaxTicketItemNumber(ticketId: number, tx?: any): Promise<number> {
  const db = tx || await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ itemNumber: ticketItems.itemNumber })
    .from(ticketItems)
    .where(eq(ticketItems.ticketId, ticketId))
    .orderBy(desc(ticketItems.itemNumber))
    .limit(1);
  return Number(rows[0]?.itemNumber ?? 0);
}

export async function createTicketItem(data: any, tx?: any) {
  const db = tx || await getDb();
  if (!db) return null;
  const result = await db.insert(ticketItems).values(data);
  return result[0].insertId;
}

/**
 * إنشاء بنود متعددة دفعة واحدة.
 *
 * ✅ نفس حارس createPOItems (الإصلاح #5 بـCLAUDE.md): يُرفض إنشاء بلاغ
 * بلا بند واحد على الأقل من اللحظة الأولى. سابقًا بطلبات الشراء كانت
 * المصفوفة الفارغة تمر بصمت فيُنشأ رأس بلا أصناف — لا نكرر ذلك هنا.
 */
export async function createTicketItems(items: any[], tx?: any) {
  const db = tx || await getDb();
  if (!db) return;
  if (!items || items.length === 0) {
    throw new Error("Ticket must have at least one item — refusing to create ticket without items");
  }
  await db.insert(ticketItems).values(items);
}

export async function updateTicketItem(id: number, data: any, tx?: any) {
  const db = tx || await getDb();
  if (!db) return;
  await db.update(ticketItems).set(data).where(eq(ticketItems.id, id));
}

/**
 * مزامنة بند التنفيذ عندما يكون للبلاغ بند واحد فقط.
 *
 * البلاغات الأحادية والبلاغات الفرعية تستخدم بعض إجراءات Workflow القديمة التي
 * تكتب على `tickets`، بينما الشاشات الحديثة (الشراء/الصيانة الخارجية وغيرها)
 * تقرأ `ticket_items` كمصدر حقيقة للتنفيذ. لذلك يجب أن يتحرك البند الوحيد مع
 * رأس البلاغ. البلاغ متعدد البنود مستثنى عمدًا لأن كل بند فيه مستقل.
 *
 * لا تنشئ هذه الدالة بندًا مفقودًا ولا تختار "البند الأول" في البلاغ المتعدد؛
 * تنفذ التحديث فقط عندما يكون العدد الفعلي للبنود === 1.
 */
export async function syncSingleTicketItem(ticketId: number, data: any, tx?: any): Promise<boolean> {
  const db = tx || await getDb();
  if (!db) return false;

  const rows = await db
    .select({ id: ticketItems.id })
    .from(ticketItems)
    .where(eq(ticketItems.ticketId, ticketId))
    .orderBy(asc(ticketItems.itemNumber), asc(ticketItems.id))
    .limit(2);

  if (rows.length !== 1) return false;
  await db.update(ticketItems).set(data).where(eq(ticketItems.id, rows[0].id));
  return true;
}

export async function deleteTicketItemsByTicket(ticketId: number, tx?: any) {
  const db = tx || await getDb();
  if (!db) return;
  await db.delete(ticketItems).where(eq(ticketItems.ticketId, ticketId));
}

/**
 * حذف البنود المُرحَّلة تلقائيًا فقط (isLegacySingleItem = 1).
 *
 * يُستدعى عند الفرز المتعدد لبلاغ كان أحادي البند قبل الميزة: البند المُرحَّل
 * تلقائيًا يُستبدل ببنود الجهات الفعلية. **لا يمس أي بند أنشأه المستخدم**
 * (isLegacySingleItem = 0) — حماية صريحة ضد فقدان عمل حقيقي.
 */
export async function deleteLegacyTicketItems(ticketId: number, tx?: any) {
  const db = tx || await getDb();
  if (!db) return;
  await db.delete(ticketItems).where(
    and(eq(ticketItems.ticketId, ticketId), eq(ticketItems.isLegacySingleItem, 1)),
  );
}


// ============================================================
// MULTI-DEPARTMENT TICKET PLAN — 2026-08-11
// بلاغ رئيسي → جهات → مهام → فنيون → بلاغ فرعي اختياري
// ============================================================
export async function getTicketDepartments(ticketId: number, tx?: any) {
  const db = tx || await getDb(); if (!db) return [];
  return db.select().from(ticketDepartments).where(eq(ticketDepartments.ticketId, ticketId)).orderBy(asc(ticketDepartments.id));
}
export async function getTicketDepartmentById(id: number, tx?: any) {
  const db = tx || await getDb(); if (!db) return null;
  const rows = await db.select().from(ticketDepartments).where(eq(ticketDepartments.id, id)).limit(1); return rows[0] || null;
}
export async function createTicketDepartments(rows: any[], tx?: any) {
  const db = tx || await getDb(); if (!db) return; if (!rows.length) throw new Error("At least one ticket department is required");
  await db.insert(ticketDepartments).values(rows);
}
export async function hasTicketDepartmentAssignment(ticketId: number, department: string, managerId: number) {
  const db = await getDb(); if (!db) return false;
  const rows = await db.select({ id: ticketDepartments.id }).from(ticketDepartments).where(and(
    eq(ticketDepartments.ticketId, ticketId), eq(ticketDepartments.department, department as any), eq(ticketDepartments.responsibleManagerId, managerId),
  )).limit(1); return rows.length > 0;
}
export async function getTicketTasks(ticketId: number, tx?: any) {
  const db = tx || await getDb(); if (!db) return [];
  return db.select().from(ticketTasks).where(eq(ticketTasks.ticketId, ticketId)).orderBy(asc(ticketTasks.ticketDepartmentId), asc(ticketTasks.taskNumber), asc(ticketTasks.id));
}
export async function getTicketTaskById(id: number, tx?: any) {
  const db = tx || await getDb(); if (!db) return null;
  const rows = await db.select().from(ticketTasks).where(eq(ticketTasks.id, id)).limit(1); return rows[0] || null;
}
export async function getTaskAssignees(taskId: number, tx?: any) {
  const db = tx || await getDb(); if (!db) return [];
  return db.select().from(ticketTaskAssignees).where(eq(ticketTaskAssignees.taskId, taskId)).orderBy(asc(ticketTaskAssignees.id));
}
export async function getTaskAssigneesForTasks(taskIds: number[], tx?: any) {
  const db = tx || await getDb(); if (!db || taskIds.length === 0) return [];
  return db.select().from(ticketTaskAssignees).where(inArray(ticketTaskAssignees.taskId, taskIds)).orderBy(asc(ticketTaskAssignees.taskId), asc(ticketTaskAssignees.id));
}
export async function isUserAssignedToTicketTasks(ticketId: number, sourceTaskId: number | null | undefined, userId: number) {
  const db = await getDb(); if (!db) return false;
  const taskScope = sourceTaskId ? or(eq(ticketTasks.ticketId, ticketId), eq(ticketTasks.id, sourceTaskId)) : eq(ticketTasks.ticketId, ticketId);
  const rows = await db.select({ id: ticketTaskAssignees.id }).from(ticketTaskAssignees)
    .innerJoin(ticketTasks, eq(ticketTaskAssignees.taskId, ticketTasks.id))
    .where(and(eq(ticketTaskAssignees.userId, userId), taskScope)).limit(1);
  return rows.length > 0;
}
export async function lockTicketDepartmentForTaskSequence(ticketDepartmentId: number, tx: any) {
  if (!tx) return; await tx.execute(sql`SELECT ${ticketDepartments.id} FROM ${ticketDepartments} WHERE ${ticketDepartments.id} = ${ticketDepartmentId} FOR UPDATE`);
}
export async function getNextDepartmentTaskNumber(ticketDepartmentId: number, tx?: any) {
  const db = tx || await getDb(); if (!db) return 1;
  const rows = await db.select({ n: ticketTasks.taskNumber }).from(ticketTasks).where(eq(ticketTasks.ticketDepartmentId, ticketDepartmentId)).orderBy(desc(ticketTasks.taskNumber)).limit(1);
  return Number(rows[0]?.n ?? 0) + 1;
}
export async function createTicketTask(data: any, tx?: any) {
  const db = tx || await getDb(); if (!db) return null; const result = await db.insert(ticketTasks).values(data); return result[0].insertId;
}
export async function updateTicketTask(id: number, data: any, tx?: any) {
  const db = tx || await getDb(); if (!db) return; await db.update(ticketTasks).set(data).where(eq(ticketTasks.id, id));
}
export async function replaceTicketTaskAssignees(taskId: number, userIds: number[], assignedById: number, tx?: any) {
  const db = tx || await getDb(); if (!db) return; await db.delete(ticketTaskAssignees).where(eq(ticketTaskAssignees.taskId, taskId));
  if (userIds.length) await db.insert(ticketTaskAssignees).values(userIds.map(userId => ({ taskId, userId, assignedById })));
}
export async function lockTicketTaskForPromotion(taskId: number, tx: any) {
  if (!tx) return; await tx.execute(sql`SELECT ${ticketTasks.id} FROM ${ticketTasks} WHERE ${ticketTasks.id} = ${taskId} FOR UPDATE`);
}
export async function lockTicketForSubTicketSequence(ticketId: number, tx: any) {
  if (!tx) return; await tx.execute(sql`SELECT ${tickets.id} FROM ${tickets} WHERE ${tickets.id} = ${ticketId} FOR UPDATE`);
}
/** عداد دائم على الرأس: لا يعيد استخدام رقم فرعي بعد الحذف. يجب استدعاؤه بعد قفل الرأس. */
export async function allocateNextSubTicketSequence(parentTicketId: number, tx: any) {
  const parent = await getTicketById(parentTicketId, tx); if (!parent) throw new Error("Parent ticket not found");
  const seq = Number(parent.subTicketCounter ?? 0) + 1;
  await updateTicket(parentTicketId, { subTicketCounter: seq }, tx);
  return seq;
}
export async function updateTicketDepartment(id: number, data: any, tx?: any) {
  const db = tx || await getDb(); if (!db) return; await db.update(ticketDepartments).set(data).where(eq(ticketDepartments.id, id));
}
