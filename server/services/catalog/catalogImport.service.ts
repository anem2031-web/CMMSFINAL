import ExcelJS from "exceljs";
import * as schema from "../../../drizzle/schema";
import { eq } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface ParsedNode {
  code:       string;
  parentCode: string;
  nameAr:     string;
  nameEn:     string;
  level:      number;
}

export interface ParsedItem {
  code:         string;
  nodeCode:     string;
  nameAr:       string;
  nameEn:       string;
  unit:         string;
  manufacturer: string;
}

export interface ParsedCatalog {
  taxonomyNodes: ParsedNode[];
  items:         ParsedItem[];
}

export interface CatalogImportAuditContext {
  userId: number;
  ipAddress?: string;
  userAgent?: string;
}

function auditJson(value: Record<string, any> | null | undefined): string | null {
  return value ? JSON.stringify(value) : null;
}

async function writeImportAudit(
  db: any,
  audit: CatalogImportAuditContext | undefined,
  entry: {
    action: string;
    entityType: string;
    entityId?: number;
    oldValues?: Record<string, any> | null;
    newValues?: Record<string, any> | null;
  },
): Promise<void> {
  if (!audit) return;
  await db.insert(schema.catalogAuditLogs).values({
    userId: audit.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    oldValues: auditJson(entry.oldValues),
    newValues: auditJson(entry.newValues),
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  } as any);
}

// ─────────────────────────────────────────────────────────────────────────
// parseCatalogImportFile
// قراءة ملف Excel وتحويله إلى كائنات
// ─────────────────────────────────────────────────────────────────────────

export async function parseCatalogImportFile(
  fileBase64: string
): Promise<ParsedCatalog> {

  const workbook = new ExcelJS.Workbook();
  const buffer   = Buffer.from(fileBase64, "base64");
  await workbook.xlsx.load(buffer as any);

  // ── Taxonomy ──────────────────────────────────────────────

  const taxonomySheet = workbook.getWorksheet("taxonomy_nodes");
  const taxonomyNodes: ParsedNode[] = [];

  if (taxonomySheet) {
    taxonomySheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // تخطي الرأس

      const code = row.getCell(1).value?.toString().trim() ?? "";
      if (!code) return; // تخطي الصفوف الفارغة

      taxonomyNodes.push({
        code,
        parentCode: row.getCell(2).value?.toString().trim() ?? "",
        nameAr:     row.getCell(3).value?.toString().trim() ?? "",
        nameEn:     row.getCell(4).value?.toString().trim() ?? "",
        level:      Number(row.getCell(5).value) || code.length,
      });
    });
  }

  // ── Items ─────────────────────────────────────────────────

  const itemsSheet = workbook.getWorksheet("catalog_items");
  const items: ParsedItem[] = [];

  if (itemsSheet) {
    itemsSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const code = row.getCell(1).value?.toString().trim() ?? "";
      if (!code) return;

      items.push({
        code,
        nodeCode:     row.getCell(2).value?.toString().trim() ?? "",
        nameAr:       row.getCell(3).value?.toString().trim() ?? "",
        nameEn:       row.getCell(4).value?.toString().trim() ?? "",
        unit:         row.getCell(5).value?.toString().trim() ?? "",
        manufacturer: row.getCell(6).value?.toString().trim() ?? "",
      });
    });
  }

  return { taxonomyNodes, items };
}

// ─────────────────────────────────────────────────────────────────────────
// commitCatalogImport
// كتابة البيانات في قاعدة البيانات (upsert حقيقي) + Audit لكل تغيير
// ─────────────────────────────────────────────────────────────────────────

export async function commitCatalogImport(
  db:     any,
  parsed: ParsedCatalog,
  audit?: CatalogImportAuditContext,
): Promise<{ success: boolean; taxonomyCount: number; itemsCount: number }> {

  // ── 1. ترتيب النودز: الآباء أولاً (أقصر كود = أعلى مستوى) ───────────────

  const sortedNodes = [...parsed.taxonomyNodes].sort(
    (a, b) => a.code.length - b.code.length
  );

  // ── 2. upsert التصنيفات (بدون parent أولاً) ──────────────────────────────

  const codeToId = new Map<string, number>();
  const nodeStateByCode = new Map<string, any>();

  const existingNodes: any[] = await db
    .select()
    .from(schema.catalogNodes);
  const existingNodeById = new Map<number, any>();

  existingNodes.forEach((n: any) => {
    existingNodeById.set(Number(n.id), { ...n });
    if (n.code) {
      codeToId.set(n.code, n.id);
      nodeStateByCode.set(n.code, { ...n });
    }
  });

  const codeAliases: any[] = await db.select().from(schema.catalogCodeAliases);
  const nodeAliasByOldCode = new Map<string, number>();
  const itemAliasByOldCode = new Map<string, number>();
  const aliasedInputNodeCodes = new Set<string>();
  for (const alias of codeAliases) {
    const oldCode = String(alias.oldCode || "").trim();
    if (!oldCode) continue;
    if (alias.entityType === "node") {
      const entityId = Number(alias.entityId);
      nodeAliasByOldCode.set(oldCode, entityId);
      if (existingNodeById.has(entityId) && !codeToId.has(oldCode)) codeToId.set(oldCode, entityId);
    }
    if (alias.entityType === "item") itemAliasByOldCode.set(oldCode, Number(alias.entityId));
  }

  for (const node of sortedNodes) {
    const aliasNodeId = nodeAliasByOldCode.get(node.code);
    const existing = nodeStateByCode.get(node.code) || (aliasNodeId ? existingNodeById.get(aliasNodeId) : undefined);
    if (aliasNodeId && !existing) {
      throw new Error(`الكود التاريخي ${node.code} يشير إلى تصنيف غير موجود؛ أوقف الاستيراد وراجع سجل الأكواد التاريخية`);
    }
    if (existing) codeToId.set(node.code, Number(existing.id));
    const resolvedViaAlias = !!aliasNodeId && String(existing?.code || "") !== node.code;
    if (resolvedViaAlias) aliasedInputNodeCodes.add(node.code);
    const updateValues = resolvedViaAlias
      ? { nameAr: node.nameAr, nameEn: node.nameEn }
      : { nameAr: node.nameAr, nameEn: node.nameEn, level: node.level };

    if (existing) {
      await db
        .update(schema.catalogNodes)
        .set(updateValues)
        .where(eq(schema.catalogNodes.id, Number(existing.id)));

      await writeImportAudit(db, audit, {
        action: "import_update",
        entityType: "node",
        entityId: Number(existing.id),
        oldValues: {
          sourceCode: node.code,
          currentCode: existing.code,
          nameAr: existing.nameAr,
          nameEn: existing.nameEn,
          level: existing.level,
        },
        newValues: { sourceCode: node.code, currentCode: existing.code, ...updateValues, source: "catalog_import" },
      });
      nodeStateByCode.set(node.code, { ...existing, ...updateValues });
    } else {
      const insertValues = {
        code:     node.code,
        nameAr:   node.nameAr,
        nameEn:   node.nameEn,
        level:    node.level,
        isActive: 1,
      };
      const result = await db
        .insert(schema.catalogNodes)
        .values(insertValues);

      let insertId = Number(
        result[0]?.insertId ??
        result?.insertId   ??
        result[0]?.id      ??
        0
      );

      if (!insertId) {
        const fresh: any[] = await db
          .select()
          .from(schema.catalogNodes)
          .where(eq(schema.catalogNodes.code, node.code))
          .limit(1);
        insertId = Number(fresh[0]?.id || 0);
      }

      if (insertId) {
        codeToId.set(node.code, insertId);
        nodeStateByCode.set(node.code, { id: insertId, parentId: null, ...insertValues });
      }

      await writeImportAudit(db, audit, {
        action: "import_create",
        entityType: "node",
        entityId: insertId || undefined,
        newValues: { ...insertValues, source: "catalog_import" },
      });
    }
  }

  // ── 3. ربط الـ parentId بعد ما صارت كل النودز موجودة ────────────────────

  for (const node of sortedNodes) {
    if (!node.parentCode) continue;
    // A file that still uses a historical code must never move the node back to
    // its old parent/level. The alias is identity-only compatibility.
    if (aliasedInputNodeCodes.has(node.code)) continue;

    const parentId = codeToId.get(node.parentCode);
    const nodeId = codeToId.get(node.code);
    if (!parentId || !nodeId) continue;

    const current = nodeStateByCode.get(node.code) || {};
    if (Number(current.parentId || 0) === Number(parentId)) continue;

    await db
      .update(schema.catalogNodes)
      .set({ parentId })
      .where(eq(schema.catalogNodes.id, nodeId));

    await writeImportAudit(db, audit, {
      action: "import_update",
      entityType: "node",
      entityId: nodeId,
      oldValues: { code: node.code, parentId: current.parentId ?? null },
      newValues: { code: node.code, parentId, parentCode: node.parentCode, source: "catalog_import" },
    });
    nodeStateByCode.set(node.code, { ...current, parentId });
  }

  // ── 4. upsert الأصناف ─────────────────────────────────────────────────────

  let itemsCount = 0;

  for (const item of parsed.items) {
    const nodeId = codeToId.get(item.nodeCode);

    if (!nodeId) {
      console.warn(`SKIP item ${item.code}: nodeCode "${item.nodeCode}" not found`);
      continue;
    }

    let existing: any[] = await db
      .select()
      .from(schema.catalogItems)
      .where(eq(schema.catalogItems.code, item.code))
      .limit(1);

    if (existing.length === 0) {
      const aliasItemId = itemAliasByOldCode.get(item.code);
      if (aliasItemId) {
        existing = await db.select().from(schema.catalogItems)
          .where(eq(schema.catalogItems.id, aliasItemId))
          .limit(1);
        if (existing.length === 0) {
          throw new Error(`الكود التاريخي ${item.code} يشير إلى صنف غير موجود؛ أوقف الاستيراد وراجع سجل الأكواد التاريخية`);
        }
      }
    }

    const nextValues = {
      nameAr:       item.nameAr,
      nameEn:       item.nameEn,
      unit:         item.unit || null,
      manufacturer: item.manufacturer || null,
      nodeId,
    };

    if (existing.length > 0) {
      await db
        .update(schema.catalogItems)
        .set(nextValues)
        .where(eq(schema.catalogItems.id, Number(existing[0].id)));

      const before = existing[0] as any;
      await writeImportAudit(db, audit, {
        action: "import_update",
        entityType: "item",
        entityId: Number(before.id),
        oldValues: {
          sourceCode: item.code,
          currentCode: before.code,
          nameAr: before.nameAr,
          nameEn: before.nameEn,
          unit: before.unit,
          manufacturer: before.manufacturer,
          nodeId: before.nodeId,
        },
        newValues: { sourceCode: item.code, currentCode: before.code, ...nextValues, source: "catalog_import" },
      });
    } else {
      const insertValues = {
        code:         item.code,
        ...nextValues,
        isActive:     1,
      };
      const result = await db
        .insert(schema.catalogItems)
        .values(insertValues);
      const insertId = Number((result as any)[0]?.insertId || (result as any)?.insertId || 0) || undefined;

      await writeImportAudit(db, audit, {
        action: "import_create",
        entityType: "item",
        entityId: insertId,
        newValues: { ...insertValues, source: "catalog_import" },
      });
    }

    itemsCount++;
  }

  await writeImportAudit(db, audit, {
    action: "import_commit",
    entityType: "catalog_import",
    newValues: {
      taxonomyCount: sortedNodes.length,
      itemsCount,
      source: "catalog_import",
    },
  });

  return {
    success:       true,
    taxonomyCount: sortedNodes.length,
    itemsCount,
  };
}
