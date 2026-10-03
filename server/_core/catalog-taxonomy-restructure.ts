export interface CatalogNodeForMove {
  id: number;
  parentId?: number | null;
  code?: string | null;
  nameAr?: string | null;
  level: number;
  isActive?: number | boolean | null;
}

export interface CatalogItemForMove {
  id: number;
  nodeId: number;
  code?: string | null;
  nameAr?: string | null;
}

export interface CatalogCodeAliasForMove {
  entityType: "node" | "item";
  entityId: number;
  oldCode: string;
  newCode?: string | null;
}

export interface TaxonomyNodeChange {
  id: number;
  nameAr: string;
  oldParentId: number | null;
  newParentId: number | null;
  oldLevel: number;
  newLevel: number;
  oldCode: string;
  newCode: string;
}

export interface TaxonomyItemChange {
  id: number;
  nameAr: string;
  nodeId: number;
  oldCode: string;
  newCode: string;
}

export interface TaxonomyMovePlan {
  nodeId: number;
  targetParentId: number | null;
  oldParentId: number | null;
  oldRootCode: string;
  newRootCode: string;
  subtreeNodeIds: number[];
  nodeChanges: TaxonomyNodeChange[];
  itemChanges: TaxonomyItemChange[];
  unchangedItemIds: number[];
  maxLevelAfterMove: number;
}

function normalizedNumericCode(value: string | null | undefined, label: string): string {
  const code = String(value || "").trim();
  if (!code || !/^\d+$/.test(code)) {
    throw new Error(`${label} لا يحتوي على كود رقمي صالح`);
  }
  return code;
}

function nextRootCode(nodesOutsideSubtree: CatalogNodeForMove[], reservedCodes: Set<string>): string {
  let max = 0n;
  for (const node of nodesOutsideSubtree) {
    if (node.parentId != null) continue;
    const code = String(node.code || "").trim();
    if (!/^\d+$/.test(code)) continue;
    const value = BigInt(code);
    if (value > max) max = value;
  }

  let candidate = max + 1n;
  while (reservedCodes.has(candidate.toString())) candidate += 1n;
  return candidate.toString();
}

function nextChildCode(
  targetParent: CatalogNodeForMove,
  siblingNodesOutsideSubtree: CatalogNodeForMove[],
  reservedCodes: Set<string>,
): string {
  const parentCode = normalizedNumericCode(targetParent.code, `التصنيف الأب «${targetParent.nameAr || targetParent.id}»`);
  let maxSuffix = 0n;
  for (const sibling of siblingNodesOutsideSubtree) {
    const code = String(sibling.code || "").trim();
    if (!code.startsWith(parentCode)) continue;
    const suffix = code.slice(parentCode.length);
    if (!/^\d+$/.test(suffix)) continue;
    const value = BigInt(suffix);
    if (value > maxSuffix) maxSuffix = value;
  }

  let suffix = maxSuffix + 1n;
  let candidate = `${parentCode}${suffix.toString()}`;
  while (reservedCodes.has(candidate)) {
    suffix += 1n;
    candidate = `${parentCode}${suffix.toString()}`;
  }
  return candidate;
}

function remapItemCode(oldItemCode: string, oldNodeCode: string, newNodeCode: string): string {
  const current = String(oldItemCode || "").trim();
  if (!current) return "";

  const currentHyphenPrefix = `${oldNodeCode}-`;
  if (current.startsWith(currentHyphenPrefix)) {
    const suffix = current.slice(currentHyphenPrefix.length);
    if (!/^\d+$/.test(suffix)) {
      throw new Error(`كود الصنف ${current} لا يتبع ترقيم التصنيف ${oldNodeCode}`);
    }
    return `${newNodeCode}-${suffix}`;
  }

  if (current.startsWith(oldNodeCode)) {
    const suffix = current.slice(oldNodeCode.length);
    if (!/^\d+$/.test(suffix)) {
      throw new Error(`كود الصنف ${current} لا يتبع ترقيم التصنيف ${oldNodeCode}`);
    }
    return `${newNodeCode}${suffix}`;
  }

  throw new Error(`كود الصنف ${current} لا يتبع ترقيم التصنيف ${oldNodeCode}`);
}

export function buildTaxonomyMovePlan(params: {
  nodes: CatalogNodeForMove[];
  items: CatalogItemForMove[];
  aliases?: CatalogCodeAliasForMove[];
  nodeId: number;
  targetParentId: number | null;
  maxLevel?: number;
}): TaxonomyMovePlan {
  const maxLevel = params.maxLevel ?? 6;
  const nodesById = new Map(params.nodes.map(node => [Number(node.id), node]));
  const root = nodesById.get(Number(params.nodeId));
  if (!root) throw new Error("التصنيف المراد نقله غير موجود");

  const targetParent = params.targetParentId == null ? null : nodesById.get(Number(params.targetParentId));
  if (params.targetParentId != null && !targetParent) throw new Error("التصنيف الهدف غير موجود");
  const currentParentId = root.parentId == null ? null : Number(root.parentId);
  const requestedParentId = params.targetParentId == null ? null : Number(params.targetParentId);
  if (currentParentId === requestedParentId) throw new Error("التصنيف موجود بالفعل في الموقع المختار");
  if (targetParent && Number(targetParent.isActive) === 0) throw new Error("لا يمكن النقل تحت تصنيف معطّل");

  const childrenByParent = new Map<number, CatalogNodeForMove[]>();
  for (const node of params.nodes) {
    if (node.parentId == null) continue;
    const list = childrenByParent.get(Number(node.parentId)) || [];
    list.push(node);
    childrenByParent.set(Number(node.parentId), list);
  }

  const subtree: CatalogNodeForMove[] = [];
  const queue = [root];
  const subtreeIds = new Set<number>();
  while (queue.length) {
    const node = queue.shift()!;
    if (subtreeIds.has(Number(node.id))) throw new Error("شجرة الكتالوج تحتوي على علاقة دائرية غير صالحة");
    subtreeIds.add(Number(node.id));
    subtree.push(node);
    queue.push(...(childrenByParent.get(Number(node.id)) || []));
  }

  if (targetParent && subtreeIds.has(Number(targetParent.id))) {
    throw new Error("لا يمكن نقل التصنيف تحت نفسه أو تحت أحد تفرعاته");
  }

  const oldRootCode = normalizedNumericCode(root.code, `التصنيف «${root.nameAr || root.id}»`);
  const aliases = params.aliases || [];
  const reservedNodeCodes = new Set<string>();
  for (const node of params.nodes) {
    if (!subtreeIds.has(Number(node.id))) {
      const code = String(node.code || "").trim();
      if (code) reservedNodeCodes.add(code);
    }
  }
  for (const alias of aliases) {
    if (alias.entityType === "node") {
      const oldCode = String(alias.oldCode || "").trim();
      if (oldCode) reservedNodeCodes.add(oldCode);
    }
  }

  const siblingsOutsideSubtree = params.nodes.filter(node =>
    !subtreeIds.has(Number(node.id)) &&
    Number(node.parentId || 0) === Number(params.targetParentId || 0),
  );

  const newRootCode = targetParent
    ? nextChildCode(targetParent, siblingsOutsideSubtree, reservedNodeCodes)
    : nextRootCode(params.nodes.filter(node => !subtreeIds.has(Number(node.id))), reservedNodeCodes);
  if (newRootCode.length > 20) {
    throw new Error(`الكود الناتج ${newRootCode} يتجاوز الحد الأقصى المسموح للتصنيف`);
  }

  const newLevelById = new Map<number, number>();
  const newCodeById = new Map<number, string>();
  newLevelById.set(Number(root.id), targetParent ? Number(targetParent.level) + 1 : 1);
  newCodeById.set(Number(root.id), newRootCode);

  const visitQueue = [root];
  while (visitQueue.length) {
    const parent = visitQueue.shift()!;
    const parentOldCode = normalizedNumericCode(parent.code, `التصنيف «${parent.nameAr || parent.id}»`);
    const parentNewCode = newCodeById.get(Number(parent.id))!;
    const parentNewLevel = newLevelById.get(Number(parent.id))!;

    for (const child of childrenByParent.get(Number(parent.id)) || []) {
      const childOldCode = normalizedNumericCode(child.code, `التصنيف «${child.nameAr || child.id}»`);
      if (!childOldCode.startsWith(parentOldCode)) {
        throw new Error(`كود التصنيف ${childOldCode} لا يتبع كود أبيه ${parentOldCode}`);
      }
      const localSuffix = childOldCode.slice(parentOldCode.length);
      if (!localSuffix || !/^\d+$/.test(localSuffix)) {
        throw new Error(`تعذر تحديد الجزء الفرعي من كود التصنيف ${childOldCode}`);
      }
      const childNewCode = `${parentNewCode}${localSuffix}`;
      if (childNewCode.length > 20) throw new Error(`الكود الناتج ${childNewCode} يتجاوز الحد الأقصى المسموح`);
      newCodeById.set(Number(child.id), childNewCode);
      newLevelById.set(Number(child.id), parentNewLevel + 1);
      visitQueue.push(child);
    }
  }

  const maxLevelAfterMove = Math.max(...Array.from(newLevelById.values()));
  if (maxLevelAfterMove > maxLevel) {
    throw new Error(`النقل سيجعل بعض التفرعات تتجاوز الحد الأقصى للمستويات (${maxLevel})`);
  }

  const plannedNodeCodes = new Map<string, number>();
  const nodeChanges: TaxonomyNodeChange[] = [];
  for (const node of subtree) {
    const oldCode = normalizedNumericCode(node.code, `التصنيف «${node.nameAr || node.id}»`);
    const newCode = newCodeById.get(Number(node.id))!;
    const duplicate = plannedNodeCodes.get(newCode);
    if (duplicate && duplicate !== Number(node.id)) throw new Error(`الكود الناتج ${newCode} مكرر داخل الفرع المنقول`);
    if (reservedNodeCodes.has(newCode)) throw new Error(`الكود الناتج ${newCode} مستخدم أو محجوز مسبقاً`);
    plannedNodeCodes.set(newCode, Number(node.id));
    nodeChanges.push({
      id: Number(node.id),
      nameAr: String(node.nameAr || `#${node.id}`),
      oldParentId: node.parentId == null ? null : Number(node.parentId),
      newParentId: Number(node.id) === Number(root.id)
        ? (params.targetParentId == null ? null : Number(params.targetParentId))
        : (node.parentId == null ? null : Number(node.parentId)),
      oldLevel: Number(node.level),
      newLevel: newLevelById.get(Number(node.id))!,
      oldCode,
      newCode,
    });
  }

  const reservedItemCodes = new Set<string>();
  const subtreeItemIds = new Set(params.items.filter(item => subtreeIds.has(Number(item.nodeId))).map(item => Number(item.id)));
  for (const item of params.items) {
    if (!subtreeItemIds.has(Number(item.id))) {
      const code = String(item.code || "").trim();
      if (code) reservedItemCodes.add(code);
    }
  }
  for (const alias of aliases) {
    if (alias.entityType === "item") {
      const oldCode = String(alias.oldCode || "").trim();
      if (oldCode) reservedItemCodes.add(oldCode);
    }
  }

  const plannedItemCodes = new Map<string, number>();
  const itemChanges: TaxonomyItemChange[] = [];
  const unchangedItemIds: number[] = [];
  for (const item of params.items) {
    if (!subtreeIds.has(Number(item.nodeId))) continue;
    const currentCode = String(item.code || "").trim();
    if (!currentCode) {
      unchangedItemIds.push(Number(item.id));
      continue;
    }
    const oldNodeCode = normalizedNumericCode(nodesById.get(Number(item.nodeId))?.code, `تصنيف الصنف «${item.nameAr || item.id}»`);
    const newNodeCode = newCodeById.get(Number(item.nodeId));
    if (!newNodeCode) throw new Error("تعذر تحديد كود التصنيف الجديد للصنف");
    const newCode = remapItemCode(currentCode, oldNodeCode, newNodeCode);
    if (newCode.length > 100) {
      throw new Error(`كود الصنف الناتج ${newCode} يتجاوز الحد الأقصى المسموح`);
    }
    const duplicate = plannedItemCodes.get(newCode);
    if (duplicate && duplicate !== Number(item.id)) throw new Error(`كود الصنف الناتج ${newCode} مكرر داخل الفرع المنقول`);
    if (reservedItemCodes.has(newCode)) throw new Error(`كود الصنف الناتج ${newCode} مستخدم أو محجوز مسبقاً`);
    plannedItemCodes.set(newCode, Number(item.id));
    if (newCode !== currentCode) {
      itemChanges.push({
        id: Number(item.id),
        nameAr: String(item.nameAr || `#${item.id}`),
        nodeId: Number(item.nodeId),
        oldCode: currentCode,
        newCode,
      });
    }
  }

  return {
    nodeId: Number(root.id),
    targetParentId: params.targetParentId == null ? null : Number(params.targetParentId),
    oldParentId: root.parentId == null ? null : Number(root.parentId),
    oldRootCode,
    newRootCode,
    subtreeNodeIds: Array.from(subtreeIds),
    nodeChanges,
    itemChanges,
    unchangedItemIds,
    maxLevelAfterMove,
  };
}
