import { and, desc, eq, inArray, lte, ne } from "drizzle-orm";
import {
  pmv2ItemActions,
  pmv2MaterialRequestItems,
  pmv2MaterialRequests,
  pmv2TaskItems,
  pmv2Tasks,
  pmv2TeamMembers,
} from "../../../drizzle/schema";
import { getDb } from "../../_core/db/client";
import { currentCatalogAdapter } from "../adapters/current-system";
import { getRiyadhDateOnly } from "../scheduler/utils";
import { pmv2TeamIssueHandoffService } from "./team-issue-handoff-service";

const MATERIAL_ROUTE_DECISION_ACTION = "material_route_decision";
const MATERIAL_IDENTITY_RESOLVED_ACTION = "material_identity_resolved";

type RouteSnapshot = {
  version: 1;
  route: "team_inventory" | "material_request";
  catalogItemId: number | null;
  itemNameSnapshot: string;
  requestedQuantity: number;
  unit: string;
  teamWarehouseId: number;
  availableQuantity: number | null;
  shortageQuantity: number;
  materialRequestItemId: number | null;
};

type IdentitySnapshot = {
  version: 1;
  materialRequestItemId: number;
  originalItemName: string;
  resolvedCatalogItemId: number;
  resolvedItemName: string;
  resolvedItemCode: string | null;
  requestedQuantity: number;
  unit: string | null;
  teamAvailableQuantity: number;
  shortageQuantity: number;
  route: "team_inventory" | "material_request";
  routeDecisionActionId: number;
};

function parseRoute(note: string | null | undefined): RouteSnapshot | null {
  if (!note) return null;
  try {
    const value = JSON.parse(note) as Partial<RouteSnapshot>;
    const requestedQuantity = Number(value.requestedQuantity);
    const shortageQuantity = Number(value.shortageQuantity);
    if (value.version !== 1 || (value.route !== "team_inventory" && value.route !== "material_request")) return null;
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) return null;
    if (!Number.isFinite(shortageQuantity) || shortageQuantity < 0) return null;
    return {
      version: 1,
      route: value.route,
      catalogItemId: value.catalogItemId == null ? null : Number(value.catalogItemId),
      itemNameSnapshot: String(value.itemNameSnapshot || ""),
      requestedQuantity,
      unit: String(value.unit || ""),
      teamWarehouseId: Number(value.teamWarehouseId || 0),
      availableQuantity: value.availableQuantity == null ? null : Number(value.availableQuantity),
      shortageQuantity,
      materialRequestItemId: value.materialRequestItemId == null ? null : Number(value.materialRequestItemId),
    };
  } catch {
    return null;
  }
}

function parseIdentity(note: string | null | undefined): IdentitySnapshot | null {
  if (!note) return null;
  try {
    const value = JSON.parse(note) as Partial<IdentitySnapshot>;
    const requestItemId = Number(value.materialRequestItemId);
    const catalogItemId = Number(value.resolvedCatalogItemId);
    const routeDecisionActionId = Number(value.routeDecisionActionId);
    if (value.version !== 1 || !Number.isInteger(requestItemId) || requestItemId <= 0) return null;
    if (!Number.isInteger(catalogItemId) || catalogItemId <= 0) return null;
    if (!Number.isInteger(routeDecisionActionId) || routeDecisionActionId <= 0) return null;
    if (value.route !== "team_inventory" && value.route !== "material_request") return null;
    return {
      version: 1,
      materialRequestItemId: requestItemId,
      originalItemName: String(value.originalItemName || ""),
      resolvedCatalogItemId: catalogItemId,
      resolvedItemName: String(value.resolvedItemName || ""),
      resolvedItemCode: value.resolvedItemCode ? String(value.resolvedItemCode) : null,
      requestedQuantity: Number(value.requestedQuantity || 0),
      unit: value.unit == null ? null : String(value.unit),
      teamAvailableQuantity: Number(value.teamAvailableQuantity || 0),
      shortageQuantity: Number(value.shortageQuantity || 0),
      route: value.route,
      routeDecisionActionId,
    };
  } catch {
    return null;
  }
}


function normalizeQuantity(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Number(numeric.toFixed(3));
}

function remainingShortage(initialShortage: unknown, issuedToTeam: unknown) {
  return Number(Math.max(0, normalizeQuantity(initialShortage) - normalizeQuantity(issuedToTeam)).toFixed(3));
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات");
  return db;
}

export class Pmv2TechnicianMaterialAttentionService {
  async list(userId: number) {
    const db = await requireDb();
    const date = getRiyadhDateOnly();

    const routeRows = await db
      .select({
        actionId: pmv2ItemActions.id,
        note: pmv2ItemActions.note,
        performedById: pmv2ItemActions.performedById,
        taskId: pmv2Tasks.id,
        taskNumber: pmv2Tasks.taskNumber,
        dueDate: pmv2Tasks.dueDate,
        taskItemId: pmv2TaskItems.id,
        taskItemTitle: pmv2TaskItems.titleSnapshot,
      })
      .from(pmv2ItemActions)
      .innerJoin(pmv2TaskItems, eq(pmv2TaskItems.id, pmv2ItemActions.taskItemId))
      .innerJoin(pmv2Tasks, eq(pmv2Tasks.id, pmv2TaskItems.taskId))
      .innerJoin(
        pmv2TeamMembers,
        and(
          eq(pmv2TeamMembers.teamId, pmv2Tasks.teamId),
          eq(pmv2TeamMembers.userId, userId),
          eq(pmv2TeamMembers.isActive, 1),
        ),
      )
      .where(and(
        eq(pmv2ItemActions.action, MATERIAL_ROUTE_DECISION_ACTION),
        eq(pmv2TaskItems.status, "waiting_material"),
        eq(pmv2TaskItems.result, "needs_material"),
        ne(pmv2Tasks.status, "cancelled"),
        lte(pmv2Tasks.dueDate, date),
      ))
      .orderBy(desc(pmv2ItemActions.id));

    if (!routeRows.length) return { count: 0, actionableCount: 0, items: [] };

    const taskItemIds = [...new Set(routeRows.map((row) => Number(row.taskItemId)))];
    const identityRows = await db
      .select({ actionId: pmv2ItemActions.id, taskItemId: pmv2ItemActions.taskItemId, note: pmv2ItemActions.note })
      .from(pmv2ItemActions)
      .where(and(
        eq(pmv2ItemActions.action, MATERIAL_IDENTITY_RESOLVED_ACTION),
        inArray(pmv2ItemActions.taskItemId, taskItemIds),
      ))
      .orderBy(desc(pmv2ItemActions.id));

    const identityByRequestItem = new Map<number, IdentitySnapshot>();
    const identityByRouteAction = new Map<number, IdentitySnapshot>();
    for (const row of identityRows) {
      const identity = parseIdentity(row.note);
      if (!identity) continue;
      if (!identityByRequestItem.has(identity.materialRequestItemId)) identityByRequestItem.set(identity.materialRequestItemId, identity);
      if (!identityByRouteAction.has(identity.routeDecisionActionId)) identityByRouteAction.set(identity.routeDecisionActionId, identity);
    }

    const parsedRoutes = routeRows
      .map((row) => ({ row, snapshot: parseRoute(row.note) }))
      .filter((entry): entry is { row: typeof routeRows[number]; snapshot: RouteSnapshot } => Boolean(entry.snapshot));

    const requestItemIds = [...new Set(parsedRoutes.flatMap(({ row, snapshot }) => {
      const identity = identityByRouteAction.get(Number(row.actionId));
      const id = snapshot.materialRequestItemId ?? identity?.materialRequestItemId ?? null;
      return id ? [Number(id)] : [];
    }))];

    const requestRows = requestItemIds.length
      ? await db
          .select({
            requestItemId: pmv2MaterialRequestItems.id,
            requestedById: pmv2MaterialRequests.requestedById,
            status: pmv2MaterialRequestItems.status,
            requestedQuantity: pmv2MaterialRequestItems.requestedQuantity,
            receivedWarehouseQuantity: pmv2MaterialRequestItems.receivedWarehouseQuantity,
            issuedToTeamQuantity: pmv2MaterialRequestItems.issuedToTeamQuantity,
          })
          .from(pmv2MaterialRequestItems)
          .innerJoin(pmv2MaterialRequests, eq(pmv2MaterialRequests.id, pmv2MaterialRequestItems.requestId))
          .where(inArray(pmv2MaterialRequestItems.id, requestItemIds))
      : [];
    const requestById = new Map(requestRows.map((row) => [Number(row.requestItemId), row]));

    const readyQueue = await pmv2TeamIssueHandoffService.listReadyToIssueQueue();
    const readyByRouteAction = new Map(
      readyQueue
        .filter((item: any) => item.technicians?.some((technician: any) => Number(technician.id) === userId))
        .map((item: any) => [Number(item.routeDecisionActionId), item]),
    );

    const catalogIds = [...new Set(parsedRoutes
      .map(({ snapshot }) => Number(snapshot.catalogItemId || 0))
      .filter((id) => id > 0))];
    const catalogItems = catalogIds.length ? await currentCatalogAdapter.getItemsByIds(catalogIds) : [];
    const catalogById = new Map(catalogItems.map((item) => [Number(item.id), item]));

    const seen = new Set<string>();
    const items: any[] = [];

    for (const { row, snapshot } of parsedRoutes) {
      const actionId = Number(row.actionId);
      const routeIdentity = identityByRouteAction.get(actionId) ?? null;
      const requestItemId = snapshot.materialRequestItemId ?? routeIdentity?.materialRequestItemId ?? null;
      const requestIdentity = requestItemId ? identityByRequestItem.get(Number(requestItemId)) ?? null : null;
      const identity = routeIdentity ?? requestIdentity;

      // Once an unlisted material is resolved, its original pre-resolution route is history only.
      if (requestItemId && requestIdentity && requestIdentity.routeDecisionActionId !== actionId) continue;

      const key = requestItemId
        ? `request:${requestItemId}`
        : `direct:${row.taskItemId}:${snapshot.catalogItemId ?? snapshot.itemNameSnapshot}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const request = requestItemId ? requestById.get(Number(requestItemId)) ?? null : null;
      const ownerUserId = request ? Number(request.requestedById) : Number(row.performedById);
      if (ownerUserId !== userId) continue;

      const ready = readyByRouteAction.get(actionId) ?? null;
      const requestStatus = request ? String(request.status) : null;

      if (snapshot.route === "team_inventory" && !ready) continue;
      if (snapshot.route === "material_request" && ["consumed", "cancelled"].includes(String(requestStatus || ""))) continue;
      if (snapshot.route === "material_request" && requestStatus === "issued_to_team" && !ready) continue;

      let attentionStatus: "waiting_identity" | "waiting_warehouse" | "waiting_purchase" | "waiting_transfer" | "ready_to_receive" | "ready_blocked";
      if (ready) {
        attentionStatus = ready.canIssue ? "ready_to_receive" : "ready_blocked";
      } else if (snapshot.catalogItemId == null) {
        attentionStatus = "waiting_identity";
      } else if (requestStatus === "external_purchase") {
        attentionStatus = "waiting_purchase";
      } else if (requestStatus === "received_warehouse") {
        attentionStatus = "waiting_transfer";
      } else {
        attentionStatus = "waiting_warehouse";
      }

      const catalog = snapshot.catalogItemId ? catalogById.get(Number(snapshot.catalogItemId)) ?? null : null;
      const initialShortageQuantity = normalizeQuantity(identity?.shortageQuantity ?? snapshot.shortageQuantity);
      const warehouseRequestedQuantity = normalizeQuantity(request?.requestedQuantity ?? initialShortageQuantity);
      const warehouseReceivedQuantity = normalizeQuantity(request?.receivedWarehouseQuantity);
      const warehouseIssuedToTeamQuantity = normalizeQuantity(request?.issuedToTeamQuantity);
      const currentShortageQuantity = snapshot.route === "team_inventory"
        ? 0
        : remainingShortage(initialShortageQuantity, warehouseIssuedToTeamQuantity);

      items.push({
        id: `material-${actionId}`,
        routeDecisionActionId: actionId,
        materialRequestItemId: requestItemId ? Number(requestItemId) : null,
        taskId: Number(row.taskId),
        taskNumber: String(row.taskNumber),
        dueDate: String(row.dueDate),
        taskItemId: Number(row.taskItemId),
        taskItemTitle: String(row.taskItemTitle),
        attentionStatus,
        identityResolved: Boolean(identity),
        originalItemName: identity?.originalItemName || null,
        itemName: catalog?.nameAr || catalog?.nameEn || identity?.resolvedItemName || snapshot.itemNameSnapshot,
        itemCode: catalog?.code || identity?.resolvedItemCode || null,
        unit: snapshot.unit || identity?.unit || "",
        requiredQuantity: Number(snapshot.requestedQuantity || 0),
        teamAvailableQuantity: identity ? Number(identity.teamAvailableQuantity || 0) : snapshot.availableQuantity,
        initialShortageQuantity,
        shortageQuantity: currentShortageQuantity,
        warehouseRequestedQuantity,
        warehouseReceivedQuantity,
        warehouseIssuedToTeamQuantity,
        requestStatus,
        canReceive: Boolean(ready?.canIssue),
        blocker: ready?.blocker || null,
      });
    }

    const priority: Record<string, number> = {
      ready_to_receive: 0,
      ready_blocked: 1,
      waiting_identity: 2,
      waiting_transfer: 3,
      waiting_purchase: 4,
      waiting_warehouse: 5,
    };
    items.sort((a, b) => (priority[a.attentionStatus] ?? 9) - (priority[b.attentionStatus] ?? 9) || String(a.taskNumber).localeCompare(String(b.taskNumber)));

    return {
      count: items.length,
      actionableCount: items.filter((item) => item.attentionStatus === "ready_to_receive").length,
      items,
    };
  }
}

export const pmv2TechnicianMaterialAttentionService = new Pmv2TechnicianMaterialAttentionService();
