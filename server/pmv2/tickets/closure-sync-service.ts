import { and, desc, eq, ne, sql } from "drizzle-orm";
import {
  pmv2ItemActions,
  pmv2TaskItems,
  pmv2Tasks,
  pmv2TaskTicketLinks,
  tickets,
} from "../../../drizzle/schema";
import { writePmv2AuditWithDb } from "../audit/service";

type Pmv2ItemStatus =
  | "pending"
  | "in_progress"
  | "waiting_material"
  | "waiting_ticket"
  | "ready_to_complete"
  | "completed";

function deriveTaskStatus(itemStatuses: Pmv2ItemStatus[]) {
  if (itemStatuses.length > 0 && itemStatuses.every(status => status === "completed")) return "completed";
  if (itemStatuses.includes("waiting_material")) return "waiting_material";
  if (itemStatuses.includes("waiting_ticket")) return "waiting_ticket";
  if (itemStatuses.includes("in_progress")) return "in_progress";
  if (itemStatuses.includes("ready_to_complete")) return "ready_to_complete";
  if (itemStatuses.includes("completed")) return "in_progress";
  return "pending";
}

/**
 * Patch 123 — closes only the PM V2 Task Item that is directly linked to a
 * successfully closed maintenance Ticket.
 *
 * Important boundaries:
 * - No PM V2 link => strict no-op (normal Tickets are untouched).
 * - Only waiting_ticket + needs_ticket can be completed here.
 * - A different active Ticket on the same Item blocks automatic completion.
 * - The caller passes the same DB transaction used to close the Ticket, so
 *   Ticket closure and PM V2 completion commit or roll back together.
 */
export class Pmv2TicketClosureSyncService {
  async syncClosedTicketWithDb(
    tx: any,
    input: { ticketId: number; actorUserId: number },
  ) {
    const linkedRows = await tx
      .select({
        linkId: pmv2TaskTicketLinks.id,
        taskItemId: pmv2TaskTicketLinks.taskItemId,
        taskId: pmv2TaskItems.taskId,
        itemStatus: pmv2TaskItems.status,
        itemResult: pmv2TaskItems.result,
        taskStatus: pmv2Tasks.status,
        ticketNumber: tickets.ticketNumber,
        ticketStatus: tickets.status,
      })
      .from(pmv2TaskTicketLinks)
      .innerJoin(pmv2TaskItems, eq(pmv2TaskItems.id, pmv2TaskTicketLinks.taskItemId))
      .innerJoin(pmv2Tasks, eq(pmv2Tasks.id, pmv2TaskItems.taskId))
      .innerJoin(tickets, eq(tickets.id, pmv2TaskTicketLinks.ticketId))
      .where(eq(pmv2TaskTicketLinks.ticketId, input.ticketId))
      .limit(1);

    const initial = linkedRows[0];
    if (!initial) return { linked: false, completed: false, reason: "not_linked" as const };
    if (initial.ticketStatus !== "closed") {
      return { linked: true, completed: false, reason: "ticket_not_closed" as const };
    }

    // Same lock order used by PM V2 technician writes: Task first, then Item.
    await tx.execute(sql`SELECT id FROM pmv2_tasks WHERE id = ${initial.taskId} FOR UPDATE`);

    const currentRows = await tx
      .select({
        taskItemId: pmv2TaskTicketLinks.taskItemId,
        taskId: pmv2TaskItems.taskId,
        itemStatus: pmv2TaskItems.status,
        itemResult: pmv2TaskItems.result,
        taskStatus: pmv2Tasks.status,
        ticketNumber: tickets.ticketNumber,
        ticketStatus: tickets.status,
      })
      .from(pmv2TaskTicketLinks)
      .innerJoin(pmv2TaskItems, eq(pmv2TaskItems.id, pmv2TaskTicketLinks.taskItemId))
      .innerJoin(pmv2Tasks, eq(pmv2Tasks.id, pmv2TaskItems.taskId))
      .innerJoin(tickets, eq(tickets.id, pmv2TaskTicketLinks.ticketId))
      .where(eq(pmv2TaskTicketLinks.ticketId, input.ticketId))
      .limit(1);

    const row = currentRows[0];
    if (!row || row.ticketStatus !== "closed") {
      return { linked: Boolean(row), completed: false, reason: "ticket_not_closed" as const };
    }
    if (row.taskStatus === "cancelled") {
      return { linked: true, completed: false, reason: "task_cancelled" as const };
    }
    if (row.itemStatus === "completed") {
      return { linked: true, completed: false, reason: "already_completed" as const };
    }
    if (row.itemStatus !== "waiting_ticket" || row.itemResult !== "needs_ticket") {
      return { linked: true, completed: false, reason: "item_not_waiting_ticket" as const };
    }

    // Defensive guard: never let closing an older Ticket complete an Item while
    // another linked Ticket is still active.
    const otherActiveTickets = await tx
      .select({ ticketId: pmv2TaskTicketLinks.ticketId })
      .from(pmv2TaskTicketLinks)
      .innerJoin(tickets, eq(tickets.id, pmv2TaskTicketLinks.ticketId))
      .where(and(
        eq(pmv2TaskTicketLinks.taskItemId, row.taskItemId),
        ne(pmv2TaskTicketLinks.ticketId, input.ticketId),
        ne(tickets.status, "closed"),
        ne(tickets.status, "requester_confirmed"),
      ))
      .limit(1);

    if (otherActiveTickets[0]) {
      return { linked: true, completed: false, reason: "other_active_ticket" as const };
    }

    const sourceActions = await tx
      .select({ visitId: pmv2ItemActions.visitId })
      .from(pmv2ItemActions)
      .where(and(
        eq(pmv2ItemActions.taskItemId, row.taskItemId),
        eq(pmv2ItemActions.action, "submit_result"),
        eq(pmv2ItemActions.result, "needs_ticket"),
      ))
      .orderBy(desc(pmv2ItemActions.id))
      .limit(1);

    await tx
      .update(pmv2TaskItems)
      .set({ status: "completed", result: "fixed" })
      .where(and(
        eq(pmv2TaskItems.id, row.taskItemId),
        eq(pmv2TaskItems.taskId, row.taskId),
        eq(pmv2TaskItems.status, "waiting_ticket"),
        eq(pmv2TaskItems.result, "needs_ticket"),
      ));

    const completionNote = `تم الإصلاح عبر البلاغ ${row.ticketNumber}`;
    if (sourceActions[0]) {
      await tx.insert(pmv2ItemActions).values({
        taskItemId: row.taskItemId,
        visitId: sourceActions[0].visitId,
        action: "ticket_closed_completion",
        result: "fixed",
        note: completionNote,
        performedById: input.actorUserId,
      });
    }

    const taskItems = await tx
      .select({ status: pmv2TaskItems.status })
      .from(pmv2TaskItems)
      .where(eq(pmv2TaskItems.taskId, row.taskId));

    const taskStatus = deriveTaskStatus(
      taskItems.map((item: { status: Pmv2ItemStatus }) => item.status),
    );

    await tx
      .update(pmv2Tasks)
      .set({ status: taskStatus })
      .where(eq(pmv2Tasks.id, row.taskId));

    await writePmv2AuditWithDb(tx, {
      actorUserId: input.actorUserId,
      action: "ticket_closed_completion",
      entity: "task_item",
      entityId: row.taskItemId,
      oldValues: {
        taskId: row.taskId,
        taskStatus: row.taskStatus,
        itemStatus: row.itemStatus,
        itemResult: row.itemResult,
      },
      newValues: {
        taskId: row.taskId,
        taskStatus,
        itemStatus: "completed",
        itemResult: "fixed",
        ticketId: input.ticketId,
        ticketNumber: row.ticketNumber,
        completionSource: "ticket_closed",
        itemActionRecorded: Boolean(sourceActions[0]),
      },
    });

    return {
      linked: true,
      completed: true,
      taskId: Number(row.taskId),
      taskItemId: Number(row.taskItemId),
      taskStatus,
      ticketNumber: String(row.ticketNumber),
    };
  }
}

export const pmv2TicketClosureSyncService = new Pmv2TicketClosureSyncService();
