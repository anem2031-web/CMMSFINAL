import { and, desc, eq, ne, sql } from "drizzle-orm";
import {
  assets,
  pmv2ProgramTargets,
  pmv2ItemActions,
  pmv2TaskItems,
  pmv2Tasks,
  pmv2TaskTicketLinks,
  pmv2TeamMembers,
  sections,
  tickets,
} from "../../../drizzle/schema";
import { getDb } from "../../_core/db/client";
import { writePmv2AuditWithDb } from "../audit/service";

const TERMINAL_TICKET_STATUSES = new Set(["closed", "requester_confirmed"]);

export class Pmv2TicketHandoffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Pmv2TicketHandoffError";
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات");
  return db;
}

async function loadSource(db: any, userId: number, taskItemId: number) {
  const rows = await db
    .select({
      taskItemId: pmv2TaskItems.id,
      taskId: pmv2TaskItems.taskId,
      itemTitle: pmv2TaskItems.titleSnapshot,
      itemStatus: pmv2TaskItems.status,
      itemResult: pmv2TaskItems.result,
      taskNumber: pmv2Tasks.taskNumber,
      targetSiteId: pmv2ProgramTargets.siteId,
      targetSectionId: pmv2ProgramTargets.sectionId,
      targetAssetId: pmv2ProgramTargets.assetId,
    })
    .from(pmv2TaskItems)
    .innerJoin(pmv2Tasks, eq(pmv2Tasks.id, pmv2TaskItems.taskId))
    .innerJoin(pmv2ProgramTargets, eq(pmv2ProgramTargets.id, pmv2Tasks.programTargetId))
    .innerJoin(
      pmv2TeamMembers,
      and(
        eq(pmv2TeamMembers.teamId, pmv2Tasks.teamId),
        eq(pmv2TeamMembers.userId, userId),
        eq(pmv2TeamMembers.isActive, 1),
      ),
    )
    .where(eq(pmv2TaskItems.id, taskItemId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new Pmv2TicketHandoffError("بند PM V2 غير موجود ضمن مهامك الفعالة");

  let siteId = row.targetSiteId == null ? null : Number(row.targetSiteId);
  let sectionId = row.targetSectionId == null ? null : Number(row.targetSectionId);
  const assetId = row.targetAssetId == null ? null : Number(row.targetAssetId);

  if (assetId != null) {
    const assetRows = await db
      .select({ siteId: assets.siteId, sectionId: assets.sectionId, status: assets.status })
      .from(assets)
      .where(eq(assets.id, assetId))
      .limit(1);
    const asset = assetRows[0];
    if (!asset || asset.status === "disposed" || asset.siteId == null || asset.sectionId == null) {
      throw new Pmv2TicketHandoffError("أصل مهمة PM V2 غير صالح لإنشاء بلاغ صيانة");
    }
    siteId = Number(asset.siteId);
    sectionId = Number(asset.sectionId);
  } else if (sectionId != null && siteId == null) {
    const sectionRows = await db
      .select({ siteId: sections.siteId, isActive: sections.isActive })
      .from(sections)
      .where(eq(sections.id, sectionId))
      .limit(1);
    const section = sectionRows[0];
    if (!section || Number(section.isActive) !== 1) {
      throw new Pmv2TicketHandoffError("قسم مهمة PM V2 غير صالح لإنشاء بلاغ صيانة");
    }
    siteId = Number(section.siteId);
  }

  if (siteId == null) {
    throw new Pmv2TicketHandoffError("مهمة PM V2 لا تحتوي موقعًا صالحًا لإنشاء البلاغ");
  }

  return {
    taskItemId: Number(row.taskItemId),
    taskId: Number(row.taskId),
    taskNumber: String(row.taskNumber),
    itemTitle: String(row.itemTitle),
    itemStatus: String(row.itemStatus),
    itemResult: row.itemResult == null ? null : String(row.itemResult),
    siteId,
    sectionId,
    assetId,
  };
}

async function findLinkedTicketState(db: any, taskItemId: number) {
  const rows = await db
    .select({
      ticketId: pmv2TaskTicketLinks.ticketId,
      ticketNumber: tickets.ticketNumber,
      status: tickets.status,
      maintenancePath: tickets.maintenancePath,
      createdAt: pmv2TaskTicketLinks.createdAt,
    })
    .from(pmv2TaskTicketLinks)
    .innerJoin(tickets, eq(tickets.id, pmv2TaskTicketLinks.ticketId))
    .where(eq(pmv2TaskTicketLinks.taskItemId, taskItemId))
    .orderBy(desc(pmv2TaskTicketLinks.createdAt), desc(pmv2TaskTicketLinks.id));

  const activeRow = rows.find((row: any) => !TERMINAL_TICKET_STATUSES.has(String(row.status)));
  const selected = activeRow ?? rows[0];
  const linkedTicket = selected
    ? {
        id: Number(selected.ticketId),
        ticketNumber: String(selected.ticketNumber),
        status: String(selected.status),
        maintenancePath: selected.maintenancePath == null ? null : String(selected.maintenancePath),
      }
    : null;

  return { linkedTicket, hasActiveTicket: Boolean(activeRow) };
}

export class Pmv2TicketHandoffService {
  async getCreateContext(userId: number, taskItemId: number) {
    const db = await requireDb();
    const source = await loadSource(db, userId, taskItemId);
    const ticketState = await findLinkedTicketState(db, taskItemId);
    const noteRows = await db
      .select({ note: pmv2ItemActions.note })
      .from(pmv2ItemActions)
      .where(and(
        eq(pmv2ItemActions.taskItemId, taskItemId),
        eq(pmv2ItemActions.action, "submit_result"),
        eq(pmv2ItemActions.result, "needs_ticket"),
      ))
      .orderBy(desc(pmv2ItemActions.id))
      .limit(1);
    const ticketDescription = String(noteRows[0]?.note ?? "").trim();
    return {
      ...source,
      ...ticketState,
      ticketDescription,
    };
  }

  async prepareAtomicTicketCreation(
    tx: any,
    userId: number,
    taskItemId: number,
    target: { siteId?: number; sectionId?: number; assetId?: number },
  ) {
    await tx.execute(sql`SELECT id FROM pmv2_task_items WHERE id = ${taskItemId} FOR UPDATE`);

    const source = await loadSource(tx, userId, taskItemId);
    if (source.itemStatus !== "waiting_ticket" || source.itemResult !== "needs_ticket") {
      throw new Pmv2TicketHandoffError("بند PM V2 ليس في حالة انتظار بلاغ صيانة");
    }

    const activeLinks = await tx
      .select({
        ticketId: pmv2TaskTicketLinks.ticketId,
        ticketNumber: tickets.ticketNumber,
        status: tickets.status,
      })
      .from(pmv2TaskTicketLinks)
      .innerJoin(tickets, eq(tickets.id, pmv2TaskTicketLinks.ticketId))
      .where(and(
        eq(pmv2TaskTicketLinks.taskItemId, taskItemId),
        ne(tickets.status, "closed"),
        ne(tickets.status, "requester_confirmed"),
      ))
      .orderBy(desc(pmv2TaskTicketLinks.id))
      .limit(1);

    if (activeLinks[0]) {
      throw new Pmv2TicketHandoffError(
        `يوجد بلاغ صيانة نشط مرتبط بهذا البند بالفعل: ${activeLinks[0].ticketNumber}`,
      );
    }

    if (Number(target.siteId || 0) !== source.siteId) {
      throw new Pmv2TicketHandoffError("موقع البلاغ لا يطابق موقع مهمة PM V2");
    }

    if (source.sectionId != null) {
      if (Number(target.sectionId || 0) !== source.sectionId) {
        throw new Pmv2TicketHandoffError("قسم البلاغ لا يطابق قسم مهمة PM V2");
      }
    } else {
      if (!target.sectionId) {
        throw new Pmv2TicketHandoffError("اختر القسم قبل إنشاء البلاغ");
      }
      const sectionRows = await tx
        .select({ siteId: sections.siteId, isActive: sections.isActive })
        .from(sections)
        .where(eq(sections.id, target.sectionId))
        .limit(1);
      const section = sectionRows[0];
      if (!section || Number(section.isActive) !== 1 || Number(section.siteId) !== source.siteId) {
        throw new Pmv2TicketHandoffError("القسم المختار لا يتبع موقع مهمة PM V2");
      }
    }

    if (source.assetId != null && Number(target.assetId || 0) !== source.assetId) {
      throw new Pmv2TicketHandoffError("الأصل في البلاغ لا يطابق أصل مهمة PM V2");
    }

    return source;
  }

  async linkAtomicCreatedTicket(
    tx: any,
    input: { userId: number; taskItemId: number; ticketId: number; ticketNumber: string },
  ) {
    await tx.insert(pmv2TaskTicketLinks).values({
      taskItemId: input.taskItemId,
      ticketId: input.ticketId,
      createdById: input.userId,
    });

    await writePmv2AuditWithDb(tx, {
      actorUserId: input.userId,
      action: "ticket_linked",
      entity: "task_item",
      entityId: input.taskItemId,
      newValues: {
        ticketId: input.ticketId,
        ticketNumber: input.ticketNumber,
      },
    });
  }
}

export const pmv2TicketHandoffService = new Pmv2TicketHandoffService();
