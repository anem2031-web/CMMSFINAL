// ============================================================
// مركز التحسين والتطوير — وصول قاعدة البيانات
// ملف منفصل عن db.ts (نفس نمط translationEngine.ts) لسهولة المراجعة والصيانة
// ============================================================
import { eq, desc, and, count, like, or } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { getDb } from "./db";
import { improvementIdeas, users, sites, sections } from "../drizzle/schema";

// ─── توليد رقم الطلب التالي (مثال: IMP-2026-00001) ────────────────────────
export async function getNextImprovementIdeaNumber() {
  const db = await getDb();
  if (!db) return "IMP-2026-00001";

  const year = new Date().getFullYear();
  const prefix = `IMP-${year}-`;

  const last = await db
    .select({ requestNumber: improvementIdeas.requestNumber })
    .from(improvementIdeas)
    .where(like(improvementIdeas.requestNumber, `${prefix}%`))
    .orderBy(desc(improvementIdeas.requestNumber))
    .limit(1);

  let nextNum = 1;
  if (last && last.length > 0) {
    const parts = last[0].requestNumber.split("-");
    const lastNumStr = parts[parts.length - 1];
    const lastNum = parseInt(lastNumStr || "0", 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }
  return `${prefix}${String(nextNum).padStart(5, "0")}`;
}

// ─── إنشاء فكرة جديدة ──────────────────────────────────────────────────
export async function createImprovementIdea(data: any) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(improvementIdeas).values(data);
  return result[0].insertId;
}

type IdeaFilters = {
  status?: string;
  priority?: string;
  category?: string;
  siteId?: number;
  sectionId?: number;
  submittedById?: number;
  assignedToId?: number;
  search?: string;
};

function buildIdeaWhere(filters?: IdeaFilters) {
  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(improvementIdeas.status, filters.status as any));
  if (filters?.priority) conditions.push(eq(improvementIdeas.priority, filters.priority as any));
  if (filters?.category) conditions.push(eq(improvementIdeas.category, filters.category as any));
  if (filters?.siteId) conditions.push(eq(improvementIdeas.siteId, filters.siteId));
  if (filters?.sectionId) conditions.push(eq(improvementIdeas.sectionId, filters.sectionId));
  if (filters?.submittedById) conditions.push(eq(improvementIdeas.submittedById, filters.submittedById));
  if (filters?.assignedToId) conditions.push(eq(improvementIdeas.assignedToId, filters.assignedToId));
  if (filters?.search) conditions.push(or(
    like(improvementIdeas.title, `%${filters.search}%`),
    like(improvementIdeas.requestNumber, `%${filters.search}%`),
  ));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

// ─── قائمة مرقّمة بصفحات (نفس نمط صفحة البلاغات بالضبط) ───────────────────
export async function getImprovementIdeasPaginated(filters: IdeaFilters | undefined, page: number = 1, pageSize: number = 10) {
  const db = await getDb();
  if (!db) return { ideas: [] as any[], total: 0, page: 1, pageSize, totalPages: 1 };

  const where = buildIdeaWhere(filters);
  const [{ cnt }] = await db.select({ cnt: count() }).from(improvementIdeas).where(where);
  const total = Number(cnt) || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const offset = (safePage - 1) * pageSize;

  const submitter = alias(users, "submitter");
  const assignee = alias(users, "assignee");

  const rows = await db
    .select({
      idea: improvementIdeas,
      submitterName: submitter.name,
      assigneeName: assignee.name,
      siteName: sites.name,
      sectionName: sections.name,
    })
    .from(improvementIdeas)
    .leftJoin(submitter, eq(improvementIdeas.submittedById, submitter.id))
    .leftJoin(assignee, eq(improvementIdeas.assignedToId, assignee.id))
    .leftJoin(sites, eq(improvementIdeas.siteId, sites.id))
    .leftJoin(sections, eq(improvementIdeas.sectionId, sections.id))
    .where(where)
    .orderBy(desc(improvementIdeas.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    ideas: rows.map(r => ({
      ...r.idea,
      submitterName: r.submitterName ?? null,
      assigneeName: r.assigneeName ?? null,
      siteName: r.siteName ?? null,
      sectionName: r.sectionName ?? null,
    })),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

// ─── فكرة واحدة بالتفصيل الكامل (لصفحة المراجعة/القرار) ───────────────────
export async function getImprovementIdeaById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const submitter = alias(users, "submitter");
  const triager = alias(users, "triager");
  const decider = alias(users, "decider");
  const assignee = alias(users, "assignee");

  const rows = await db
    .select({
      idea: improvementIdeas,
      submitterName: submitter.name,
      triagerName: triager.name,
      deciderName: decider.name,
      assigneeName: assignee.name,
      siteName: sites.name,
      sectionName: sections.name,
    })
    .from(improvementIdeas)
    .leftJoin(submitter, eq(improvementIdeas.submittedById, submitter.id))
    .leftJoin(triager, eq(improvementIdeas.triagedById, triager.id))
    .leftJoin(decider, eq(improvementIdeas.decidedById, decider.id))
    .leftJoin(assignee, eq(improvementIdeas.assignedToId, assignee.id))
    .leftJoin(sites, eq(improvementIdeas.siteId, sites.id))
    .leftJoin(sections, eq(improvementIdeas.sectionId, sections.id))
    .where(eq(improvementIdeas.id, id))
    .limit(1);

  if (!rows.length) return null;
  const r = rows[0];
  return {
    ...r.idea,
    submitterName: r.submitterName ?? null,
    triagerName: r.triagerName ?? null,
    deciderName: r.deciderName ?? null,
    assigneeName: r.assigneeName ?? null,
    siteName: r.siteName ?? null,
    sectionName: r.sectionName ?? null,
  };
}

// ─── الفرز: "جديد" ← "بانتظار قرار الإدارة" ────────────────────────────
export async function triageImprovementIdea(id: number, triagedById: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(improvementIdeas).set({
    status: "pending_decision",
    triagedById,
    triagedAt: new Date(),
  }).where(eq(improvementIdeas.id, id));
}

// ─── قرار الإدارة العليا: موافقة (+تكليف منفّذ) / تأجيل (+تاريخ) / إلغاء (+سبب) ──
type DecisionInput = {
  decision: "approved" | "postponed" | "cancelled";
  decidedById: number;
  decisionNotes?: string;
  assignedToId?: number;
  postponedUntil?: Date;
  cancelReason?: string;
};

export async function decideImprovementIdea(id: number, input: DecisionInput) {
  const db = await getDb();
  if (!db) return;

  const statusMap = { approved: "in_progress", postponed: "postponed", cancelled: "cancelled" } as const;

  const updateData: any = {
    status: statusMap[input.decision],
    decidedById: input.decidedById,
    decidedAt: new Date(),
    decisionNotes: input.decisionNotes,
  };
  if (input.decision === "approved") updateData.assignedToId = input.assignedToId;
  if (input.decision === "postponed") updateData.postponedUntil = input.postponedUntil;
  if (input.decision === "cancelled") updateData.cancelReason = input.cancelReason;

  await db.update(improvementIdeas).set(updateData).where(eq(improvementIdeas.id, id));
}

// ─── إكمال التنفيذ: "قيد التنفيذ" ← "مكتملة" ──────────────────────────
export async function completeImprovementIdea(id: number, completionNotes?: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(improvementIdeas).set({
    status: "completed",
    completedAt: new Date(),
    completionNotes,
  }).where(eq(improvementIdeas.id, id));
}

// ─── حذف فكرة (لمقدّمها فقط وبحالة "جديد"، أو admin/owner — يُحدَّد بالراوتر) ──
export async function deleteImprovementIdea(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(improvementIdeas).where(eq(improvementIdeas.id, id));
}
