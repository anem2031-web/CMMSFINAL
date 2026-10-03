import { and, eq, inArray } from "drizzle-orm";
import { pmv2AlertDeliveries, users } from "../../../drizzle/schema";
import { PMV2_MANAGEMENT_ROLES } from "../../../shared/roles";
import { getDb } from "../../_core/db/client";
import { createNotification } from "../../_core/db/notifications";
import { pmv2MonitoringService } from "./service";
import { pmv2SlaService } from "./sla-service";

function isMissingTableError(error: unknown) {
  const anyError = error as any;
  return anyError?.code === "ER_NO_SUCH_TABLE" || String(anyError?.message || "").includes("pmv2_alert_deliveries");
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات");
  return db;
}

function responsibilityFingerprint(current: any) {
  return `${current?.taskItemId ?? "item"}:${current?.stageKey ?? "stage"}:${current?.responsibleUserId ?? "role"}:${current?.since ?? "unknown"}`;
}

export class Pmv2AlertService {
  private async deliverOnce(input: {
    taskId: number;
    taskItemId: number;
    recipientUserId: number;
    alertType: "responsibility" | "reminder" | "sla";
    stageKey: string;
    dedupeKey: string;
    title: string;
    message: string;
    notificationType: "info" | "warning" | "error" | "success";
    relatedPoId?: number;
    relatedTicketId?: number;
  }) {
    const db = await requireDb();
    try {
      const existing = await db.select({ id: pmv2AlertDeliveries.id })
        .from(pmv2AlertDeliveries)
        .where(eq(pmv2AlertDeliveries.dedupeKey, input.dedupeKey))
        .limit(1);
      if (existing.length) return false;

      await createNotification({
        userId: input.recipientUserId,
        title: input.title,
        message: input.message,
        type: input.notificationType,
        relatedPoId: input.relatedPoId,
        relatedTicketId: input.relatedTicketId,
      });
      await db.insert(pmv2AlertDeliveries).values({
        taskId: input.taskId,
        taskItemId: input.taskItemId,
        recipientUserId: input.recipientUserId,
        alertType: input.alertType,
        stageKey: input.stageKey,
        dedupeKey: input.dedupeKey,
        notificationId: null,
      });
      return true;
    } catch (error) {
      if (isMissingTableError(error)) return false;
      const anyError = error as any;
      if (anyError?.code === "ER_DUP_ENTRY") return false;
      throw error;
    }
  }

  async sweep() {
    const db = await requireDb();
    const [overview, ruleMap, managementUsers] = await Promise.all([
      pmv2MonitoringService.getOverview(),
      pmv2SlaService.getRuleMap(),
      db.select({ id: users.id, name: users.name, role: users.role })
        .from(users)
        .where(and(inArray(users.role, [...PMV2_MANAGEMENT_ROLES] as any), eq(users.isActive, 1))),
    ]);

    let delivered = 0;
    for (const task of overview.items) {
      const current = task.currentResponsibility;
      if (!current?.taskItemId || !current.stageKey) continue;
      const fingerprint = responsibilityFingerprint(current);
      const sourceId = current.sourceId == null ? undefined : Number(current.sourceId);
      const linkArgs = current.source === "purchase" ? { relatedPoId: sourceId } : current.source === "ticket" ? { relatedTicketId: sourceId } : {};
      const responsibleId = current.responsibleUserId == null ? null : Number(current.responsibleUserId);
      const roleRule = ruleMap.get(current.roleKey);
      const elapsedMinutes = task.currentMinutes ?? null;

      // One contextual PM V2 assignment/resume notification when a concrete person owns the current action.
      if (responsibleId && current.stageKey !== "technician_execution") {
        const sent = await this.deliverOnce({
          taskId: task.id,
          taskItemId: Number(current.taskItemId),
          recipientUserId: responsibleId,
          alertType: "responsibility",
          stageKey: current.stageKey,
          dedupeKey: `responsibility:${fingerprint}`,
          title: `PM V2 — إجراء مطلوب للمهمة ${task.taskNumber}`,
          message: `${current.stageLabel}. أنت المسؤول الحالي عن الإجراء في PM V2${current.since ? ` منذ ${current.since}` : ""}.`,
          notificationType: "info",
          ...linkArgs,
        });
        if (sent) delivered += 1;
      }

      if (roleRule?.isActive && roleRule.reminderMinutes && elapsedMinutes != null && elapsedMinutes >= roleRule.reminderMinutes) {
        const recipients: number[] = responsibleId ? [responsibleId] : managementUsers.map((user) => Number(user.id));
        const uniqueRecipients: number[] = Array.from(new Set<number>(recipients));
        for (const recipientUserId of uniqueRecipients) {
          const sent = await this.deliverOnce({
            taskId: task.id,
            taskItemId: Number(current.taskItemId),
            recipientUserId,
            alertType: "reminder",
            stageKey: current.stageKey,
            dedupeKey: `reminder:${fingerprint}:${roleRule.reminderMinutes}:${recipientUserId}`,
            title: `تذكير PM V2 — ${task.taskNumber}`,
            message: `${current.stageLabel}. الإجراء لدى ${current.responsibleUserName || current.roleLabel} منذ ${elapsedMinutes} دقيقة.`,
            notificationType: "warning",
            ...linkArgs,
          });
          if (sent) delivered += 1;
        }
      }

      if (task.sla.status === "overdue") {
        const recipients = new Set<number>(managementUsers.map((user) => Number(user.id)));
        if (responsibleId) recipients.add(responsibleId);
        for (const recipientUserId of recipients) {
          const sent = await this.deliverOnce({
            taskId: task.id,
            taskItemId: Number(current.taskItemId),
            recipientUserId,
            alertType: "sla",
            stageKey: current.stageKey,
            dedupeKey: `sla:${fingerprint}:${task.sla.slaMinutes}:${recipientUserId}`,
            title: `تجاوز SLA في PM V2 — ${task.taskNumber}`,
            message: `${current.stageLabel}. المسؤول الحالي: ${current.responsibleUserName || current.roleLabel}. تجاوز الزمن المعياري بـ ${task.sla.breachMinutes} دقيقة.`,
            notificationType: "error",
            ...linkArgs,
          });
          if (sent) delivered += 1;
        }
      }
    }

    return { checkedTasks: overview.items.length, delivered, generatedAt: new Date().toISOString() };
  }
}

export const pmv2AlertService = new Pmv2AlertService();
