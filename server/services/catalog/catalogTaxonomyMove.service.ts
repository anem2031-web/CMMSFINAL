import { and, eq, sql } from "drizzle-orm";
import {
  catalogAuditLogs,
  catalogCodeAliases,
  catalogItems,
  catalogNodes,
  catalogSettings,
  inventoryCountOperations,
  warehouses,
} from "../../../drizzle/schema";
import { catalogAuditJson } from "../../_core/catalog-audit";
import { buildTaxonomyMovePlan, type TaxonomyMovePlan } from "../../_core/catalog-taxonomy-restructure";

const FOOD_ROOT_SETTING_KEY = "food_warehouse_root_node_id";

export interface TaxonomyMovePreview {
  plan: TaxonomyMovePlan;
  blockers: string[];
  warnings: string[];
  affectedWarehouseLinks: Array<{ id: number; code: string; nameAr: string; catalogNodeId: number }>;
  openCountOperations: Array<{ id: number; operationNumber: string; catalogNodeId: number }>;
}

function ancestorIds(nodesById: Map<number, any>, startId: number | null): number[] {
  const result: number[] = [];
  const visited = new Set<number>();
  let currentId = startId;
  while (currentId != null) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    result.push(currentId);
    const row = nodesById.get(currentId);
    currentId = row?.parentId == null ? null : Number(row.parentId);
  }
  return result;
}

async function loadMoveState(writer: any) {
  const [nodes, items, aliases, warehouseRows, countRows] = await Promise.all([
    writer.select().from(catalogNodes),
    writer.select({ id: catalogItems.id, nodeId: catalogItems.nodeId, code: catalogItems.code, nameAr: catalogItems.nameAr }).from(catalogItems),
    writer.select().from(catalogCodeAliases),
    writer.select({ id: warehouses.id, code: warehouses.code, nameAr: warehouses.nameAr, catalogNodeId: warehouses.catalogNodeId }).from(warehouses),
    writer.select({ id: inventoryCountOperations.id, operationNumber: inventoryCountOperations.operationNumber, catalogNodeId: inventoryCountOperations.catalogNodeId })
      .from(inventoryCountOperations)
      .where(eq(inventoryCountOperations.status, "in_progress")),
  ]);
  return { nodes: nodes as any[], items: items as any[], aliases: aliases as any[], warehouseRows: warehouseRows as any[], countRows: countRows as any[] };
}

function buildGuards(state: Awaited<ReturnType<typeof loadMoveState>>, plan: TaxonomyMovePlan): Omit<TaxonomyMovePreview, "plan"> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const nodesById = new Map(state.nodes.map((node: any) => [Number(node.id), node]));
  const changesById = new Map(plan.nodeChanges.map(change => [change.id, change]));
  const subtreeIds = new Set(plan.subtreeNodeIds);

  const affectedWarehouseLinks = state.warehouseRows
    .filter((row: any) => row.catalogNodeId != null && subtreeIds.has(Number(row.catalogNodeId)))
    .map((row: any) => ({
      id: Number(row.id),
      code: String(row.code || ""),
      nameAr: String(row.nameAr || ""),
      catalogNodeId: Number(row.catalogNodeId),
    }));

  for (const warehouse of affectedWarehouseLinks) {
    const change = changesById.get(warehouse.catalogNodeId);
    if (change && change.newLevel !== 1) {
      blockers.push(`المستودع «${warehouse.nameAr || warehouse.code}» مرتبط بالتصنيف ${change.oldCode}، والنقل سيحوّله من المستوى الأول إلى المستوى ${change.newLevel}.`);
    }
  }

  const oldAncestors = ancestorIds(nodesById, plan.nodeId);
  const targetAncestors = ancestorIds(nodesById, plan.targetParentId);
  const countSensitiveIds = new Set<number>([...plan.subtreeNodeIds, ...oldAncestors, ...targetAncestors]);
  const openCountOperations = state.countRows
    .filter((row: any) => row.catalogNodeId != null && countSensitiveIds.has(Number(row.catalogNodeId)))
    .map((row: any) => ({
      id: Number(row.id),
      operationNumber: String(row.operationNumber || row.id),
      catalogNodeId: Number(row.catalogNodeId),
    }));

  if (openCountOperations.length > 0) {
    blockers.push(`يوجد ${openCountOperations.length} جرد تصنيفي مفتوح يتقاطع مع المسار القديم أو الجديد. يجب إكماله قبل النقل.`);
  }

  if (plan.unchangedItemIds.length > 0) {
    warnings.push(`يوجد ${plan.unchangedItemIds.length} صنف بدون كود؛ ستبقى أكوادها فارغة بينما تنتقل مع نفس التصنيف والهوية.`);
  }

  if (plan.oldParentId !== plan.targetParentId) {
    warnings.push("التصنيف الحالي للمخزون والتقارير والتحويلات المستقبلية سيُقرأ من المسار الجديد، بينما الأرصدة واللوتات والحركات السابقة لن تتغير.");
  }

  return { blockers, warnings, affectedWarehouseLinks, openCountOperations };
}

export async function previewCatalogTaxonomyMove(writer: any, params: { nodeId: number; targetParentId: number | null }): Promise<TaxonomyMovePreview> {
  const state = await loadMoveState(writer);
  const plan = buildTaxonomyMovePlan({
    nodes: state.nodes as any,
    items: state.items as any,
    aliases: state.aliases as any,
    nodeId: params.nodeId,
    targetParentId: params.targetParentId,
    maxLevel: 6,
  });
  return { plan, ...buildGuards(state, plan) };
}

async function ensureFoodWarehouseRootSetting(tx: any): Promise<void> {
  const existing = await tx.select({ id: catalogSettings.id, settingValue: catalogSettings.settingValue })
    .from(catalogSettings)
    .where(eq(catalogSettings.settingKey, FOOD_ROOT_SETTING_KEY))
    .limit(1);
  if (existing.length > 0) return;

  const legacyRoot = await tx.select({ id: catalogNodes.id })
    .from(catalogNodes)
    .where(eq(catalogNodes.code, "95"))
    .limit(1);
  if (legacyRoot.length === 0) return;

  await tx.insert(catalogSettings).values({
    settingKey: FOOD_ROOT_SETTING_KEY,
    settingValue: String(legacyRoot[0].id),
    settingType: "number",
    descriptionAr: "معرّف تصنيف جذر المستودع الغذائي. يعتمد على ID الثابت وليس كود التصنيف المتغير.",
    descriptionEn: "Stable catalog node ID for the food warehouse root category.",
    isActive: 1,
  } as any);
}

async function persistAlias(tx: any, params: {
  entityType: "node" | "item";
  entityId: number;
  oldCode: string;
  newCode: string;
  userId: number;
}): Promise<void> {
  const existing = await tx.select().from(catalogCodeAliases)
    .where(and(eq(catalogCodeAliases.entityType, params.entityType), eq(catalogCodeAliases.oldCode, params.oldCode)))
    .limit(1);
  if (existing.length > 0 && Number(existing[0].entityId) !== params.entityId) {
    throw new Error(`الكود التاريخي ${params.oldCode} محجوز لكيان آخر ولا يمكن إعادة استخدامه`);
  }

  if (existing.length === 0) {
    await tx.insert(catalogCodeAliases).values({
      entityType: params.entityType,
      entityId: params.entityId,
      oldCode: params.oldCode,
      newCode: params.newCode,
      createdById: params.userId,
    } as any);
  }

  await tx.update(catalogCodeAliases)
    .set({ newCode: params.newCode } as any)
    .where(and(eq(catalogCodeAliases.entityType, params.entityType), eq(catalogCodeAliases.entityId, params.entityId)));
}

export async function executeCatalogTaxonomyMove(db: any, params: {
  nodeId: number;
  targetParentId: number | null;
  userId: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<TaxonomyMovePreview & { batchId: string }> {
  return await db.transaction(async (tx: any) => {
    // Serialize taxonomy restructuring and item renumbering. This protects the
    // preview assumptions against concurrent node/item creation while the move runs.
    await tx.execute(sql`SELECT id FROM catalog_nodes FOR UPDATE`);
    await tx.execute(sql`SELECT id FROM catalog_items FOR UPDATE`);
    await tx.execute(sql`SELECT id FROM inventory_count_operations WHERE status = 'in_progress' FOR UPDATE`);
    await tx.execute(sql`SELECT id FROM warehouses WHERE catalogNodeId IS NOT NULL FOR UPDATE`);

    const preview = await previewCatalogTaxonomyMove(tx, {
      nodeId: params.nodeId,
      targetParentId: params.targetParentId,
    });
    if (preview.blockers.length > 0) {
      throw new Error(preview.blockers.join("\n"));
    }

    await ensureFoodWarehouseRootSetting(tx);

    const batchId = `taxonomy-move-${Date.now()}-${params.userId}`;

    // Temporary codes avoid transient collisions with the existing UNIQUE node
    // constraint while a whole subtree is being renamed inside one transaction.
    for (const change of preview.plan.nodeChanges) {
      if (change.oldCode !== change.newCode) {
        await tx.update(catalogNodes).set({ code: `_M${change.id}` } as any).where(eq(catalogNodes.id, change.id));
      }
    }
    for (const change of preview.plan.itemChanges) {
      await tx.update(catalogItems).set({ code: `_M${change.id}` } as any).where(eq(catalogItems.id, change.id));
    }

    for (const change of preview.plan.nodeChanges) {
      const setValues: any = { level: change.newLevel, code: change.newCode };
      if (change.id === preview.plan.nodeId) setValues.parentId = change.newParentId;
      await tx.update(catalogNodes).set(setValues).where(eq(catalogNodes.id, change.id));

      if (change.oldCode !== change.newCode) {
        await persistAlias(tx, {
          entityType: "node",
          entityId: change.id,
          oldCode: change.oldCode,
          newCode: change.newCode,
          userId: params.userId,
        });
      }

      await tx.insert(catalogAuditLogs).values({
        userId: params.userId,
        action: "move_taxonomy_subtree_node",
        entityType: "node",
        entityId: change.id,
        oldValues: catalogAuditJson({ batchId, parentId: change.oldParentId, level: change.oldLevel, code: change.oldCode }),
        newValues: catalogAuditJson({ batchId, parentId: change.newParentId, level: change.newLevel, code: change.newCode }),
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      } as any);
    }

    for (const change of preview.plan.itemChanges) {
      await tx.update(catalogItems).set({ code: change.newCode } as any).where(eq(catalogItems.id, change.id));
      await persistAlias(tx, {
        entityType: "item",
        entityId: change.id,
        oldCode: change.oldCode,
        newCode: change.newCode,
        userId: params.userId,
      });
      await tx.insert(catalogAuditLogs).values({
        userId: params.userId,
        action: "move_taxonomy_subtree_item_code",
        entityType: "item",
        entityId: change.id,
        oldValues: catalogAuditJson({ batchId, code: change.oldCode, nodeId: change.nodeId }),
        newValues: catalogAuditJson({ batchId, code: change.newCode, nodeId: change.nodeId }),
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      } as any);
    }

    await tx.insert(catalogAuditLogs).values({
      userId: params.userId,
      action: "move_taxonomy_subtree",
      entityType: "taxonomy_move",
      entityId: preview.plan.nodeId,
      oldValues: catalogAuditJson({
        batchId,
        parentId: preview.plan.oldParentId,
        rootCode: preview.plan.oldRootCode,
      }),
      newValues: catalogAuditJson({
        batchId,
        parentId: preview.plan.targetParentId,
        rootCode: preview.plan.newRootCode,
        nodeCount: preview.plan.nodeChanges.length,
        itemCount: preview.plan.itemChanges.length,
      }),
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
    } as any);

    return { ...preview, batchId };
  });
}
