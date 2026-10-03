import { auditLogs } from "../../../drizzle/schema";
import { createAuditLog } from "../../_core/db/audit";

export type Pmv2AuditEntity =
  | "specialty"
  | "team"
  | "team_member"
  | "program"
  | "program_target"
  | "checklist"
  | "checklist_item"
  | "task"
  | "task_item"
  | "visit"
  | "material_request"
  | "material_request_item";

export interface Pmv2AuditEvent {
  actorUserId?: number;
  action: string;
  entity: Pmv2AuditEntity;
  entityId?: number;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

export function buildPmv2AuditRecord(event: Pmv2AuditEvent) {
  return {
    userId: event.actorUserId,
    action: `pmv2.${event.action}`,
    entityType: `pmv2.${event.entity}`,
    entityId: event.entityId,
    oldValues: event.oldValues,
    newValues: event.newValues,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
  };
}

/** Reuses the CMMS audit log instead of creating a parallel audit master. */
export async function writePmv2Audit(event: Pmv2AuditEvent): Promise<void> {
  await createAuditLog(buildPmv2AuditRecord(event));
}

/**
 * Transaction-aware PM V2 audit path for atomic domain writes.
 * Existing callers keep using writePmv2Audit; transactional execution flows
 * pass their tx handle here so the mutation and audit record commit together.
 */
export async function writePmv2AuditWithDb(db: any, event: Pmv2AuditEvent): Promise<void> {
  await db.insert(auditLogs).values(buildPmv2AuditRecord(event) as any);
}
