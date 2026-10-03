import ExcelJS from "exceljs";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  catalogItems,
  catalogCodeAliases,
  inventory,
  inventoryCountItems,
  inventoryCountOperations,
  inventoryLots,
  warehouses,
} from "../../../drizzle/schema";
import { getDb } from "../../_core/db/client";
import { getNextInventoryCode } from "../../_core/db/warehouse-receipts";
import { createInventoryItemV2 } from "../../_core/db/warehouse-returns";
import { normalizeInventoryQuantity, roundTo } from "../../_core/inventory-costing";
import { isInventoryLotsEnabled } from "../../_core/inventory-lots";

const SHEET_NAME = "Opening Stock";
const CATALOG_SHEET_NAME = "دليل الأصناف";
const MAX_IMPORT_ROWS = 10_000;
const QUERY_CHUNK = 500;

const HEADER_ALIASES = {
  itemCode: ["كود الصنف", "item code", "itemcode", "code"],
  quantity: ["الكمية الافتتاحية", "opening quantity", "quantity", "qty"],
  unitCost: ["تكلفة الوحدة", "التكلفة الافتتاحية", "unit cost", "cost"],
  expiryDate: ["تاريخ الانتهاء", "expiry date", "expiration date", "expiry"],
} as const;

type ParsedOpeningBalanceRow = {
  rowNumber: number;
  itemCode: string;
  quantity: number | null;
  unitCost: number | null;
  expiryDate: string | null;
  rawQuantity: string;
  rawUnitCost: string;
  rawExpiryDate: string;
  expiryInvalid: boolean;
};

export type OpeningBalancePreviewRow = ParsedOpeningBalanceRow & {
  valid: boolean;
  errors: string[];
  catalogItemId: number | null;
  itemName: string | null;
  unit: string | null;
  inventoryId: number | null;
  lineValue: number | null;
};

export type OpeningBalanceImportPreview = {
  operation: {
    id: number;
    operationNumber: string;
    warehouseId: number;
    warehouseName: string;
    status: string;
  };
  valid: boolean;
  rows: OpeningBalancePreviewRow[];
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    totalQuantity: number;
    totalValue: number;
  };
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeArabicDigits(value: string): string {
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const easternArabicIndic = "۰۱۲۳۴۵۶۷۸۹";
  return value
    .replace(/[٠-٩]/g, ch => String(arabicIndic.indexOf(ch)))
    .replace(/[۰-۹]/g, ch => String(easternArabicIndic.indexOf(ch)))
    .replace(/٬/g, "")
    .replace(/٫/g, ".");
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    const v: any = value;
    if (typeof v.text === "string") return v.text.trim();
    if (Array.isArray(v.richText)) return v.richText.map((p: any) => p?.text || "").join("").trim();
    if (v.result != null) return String(v.result).trim();
  }
  return String(value).trim();
}

function parseNumberCell(value: unknown): { value: number | null; raw: string } {
  if (typeof value === "number" && Number.isFinite(value)) return { value, raw: String(value) };
  const raw = cellText(value);
  if (!raw) return { value: null, raw };
  const normalized = normalizeArabicDigits(raw).replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return { value: Number.isFinite(parsed) ? parsed : null, raw };
}

function formatDateYmd(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseExpiryCell(value: unknown): { value: string | null; raw: string; invalid: boolean } {
  if (value == null || value === "") return { value: null, raw: "", invalid: false };
  if (value instanceof Date) {
    const formatted = formatDateYmd(value);
    return { value: formatted, raw: formatted || "", invalid: !formatted };
  }
  const raw = cellText(value);
  if (!raw) return { value: null, raw: "", invalid: false };
  const normalized = normalizeArabicDigits(raw).replace(/[/.]/g, "-");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return { value: null, raw, invalid: true };
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(Date.UTC(y, m - 1, d));
  const valid = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  if (!valid) return { value: null, raw, invalid: true };
  return { value: `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, raw, invalid: false };
}

function decimalPlaces(value: number): number {
  const s = String(value);
  if (s.includes("e-")) return Number(s.split("e-")[1] || 0);
  return s.includes(".") ? s.split(".")[1].length : 0;
}

function findHeaderColumn(headers: Map<string, number>, aliases: readonly string[]): number | null {
  for (const alias of aliases) {
    const found = headers.get(normalizeHeader(alias));
    if (found) return found;
  }
  return null;
}

export async function parseOpeningBalanceExcel(fileBase64: string): Promise<ParsedOpeningBalanceRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(fileBase64, "base64") as any);

  const sheet = workbook.getWorksheet(SHEET_NAME) || workbook.worksheets[0];
  if (!sheet) throw new Error("ملف Excel لا يحتوي ورقة بيانات");

  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const normalized = normalizeHeader(cellText(cell.value));
    if (normalized) headers.set(normalized, colNumber);
  });

  const itemCodeCol = findHeaderColumn(headers, HEADER_ALIASES.itemCode);
  const quantityCol = findHeaderColumn(headers, HEADER_ALIASES.quantity);
  const unitCostCol = findHeaderColumn(headers, HEADER_ALIASES.unitCost);
  const expiryDateCol = findHeaderColumn(headers, HEADER_ALIASES.expiryDate);

  const missing: string[] = [];
  if (!itemCodeCol) missing.push("كود الصنف");
  if (!quantityCol) missing.push("الكمية الافتتاحية");
  if (!unitCostCol) missing.push("تكلفة الوحدة");
  if (!expiryDateCol) missing.push("تاريخ الانتهاء");
  if (missing.length) throw new Error(`القالب غير صحيح. الأعمدة المطلوبة: ${missing.join("، ")}`);

  const rows: ParsedOpeningBalanceRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const itemCode = cellText(row.getCell(itemCodeCol).value);
    const quantityParsed = parseNumberCell(row.getCell(quantityCol).value);
    const costParsed = parseNumberCell(row.getCell(unitCostCol).value);
    const expiryParsed = parseExpiryCell(row.getCell(expiryDateCol).value);
    if (!itemCode && !quantityParsed.raw && !costParsed.raw && !expiryParsed.raw) continue;

    rows.push({
      rowNumber,
      itemCode,
      quantity: quantityParsed.value,
      unitCost: costParsed.value,
      expiryDate: expiryParsed.value,
      rawQuantity: quantityParsed.raw,
      rawUnitCost: costParsed.raw,
      rawExpiryDate: expiryParsed.raw,
      expiryInvalid: expiryParsed.invalid,
    });
  }

  if (rows.length === 0) throw new Error("ملف المخزون الافتتاحي لا يحتوي أي صفوف بيانات");
  if (rows.length > MAX_IMPORT_ROWS) throw new Error(`الحد الأقصى للاستيراد هو ${MAX_IMPORT_ROWS.toLocaleString("en-US")} صف في العملية الواحدة`);
  return rows;
}

async function selectInChunks<T>(values: number[] | string[], query: (chunk: any[]) => Promise<T[]>): Promise<T[]> {
  const result: T[] = [];
  for (let i = 0; i < values.length; i += QUERY_CHUNK) {
    result.push(...await query(values.slice(i, i + QUERY_CHUNK)));
  }
  return result;
}

async function loadOperation(writer: any, operationId: number, requireInProgress: boolean) {
  const rows = await writer.select({
    id: inventoryCountOperations.id,
    operationNumber: inventoryCountOperations.operationNumber,
    countType: inventoryCountOperations.countType,
    warehouseId: inventoryCountOperations.warehouseId,
    status: inventoryCountOperations.status,
    warehouseName: warehouses.nameAr,
  }).from(inventoryCountOperations)
    .leftJoin(warehouses, eq(warehouses.id, inventoryCountOperations.warehouseId))
    .where(eq(inventoryCountOperations.id, operationId))
    .limit(1);
  const op = rows[0];
  if (!op) throw new Error("عملية الرصيد الافتتاحي غير موجودة");
  if (op.countType !== "opening_balance") throw new Error("هذه العملية ليست رصيداً افتتاحياً");
  if (!op.warehouseId) throw new Error("عملية الرصيد الافتتاحي غير مرتبطة بمستودع");
  if (requireInProgress && op.status !== "in_progress") throw new Error("عملية الرصيد الافتتاحي محفوظة نهائياً ولا يمكن الاستيراد إليها");
  if (!isInventoryLotsEnabled()) throw new Error("الرصيد الافتتاحي بنظام الدفعات غير مفعّل");
  return {
    id: Number(op.id),
    operationNumber: String(op.operationNumber),
    warehouseId: Number(op.warehouseId),
    warehouseName: String(op.warehouseName || `#${op.warehouseId}`),
    status: String(op.status),
  };
}

async function validateParsedRows(writer: any, operationId: number, parsedRows: ParsedOpeningBalanceRow[], requireInProgress = true): Promise<OpeningBalanceImportPreview> {
  const op = await loadOperation(writer, operationId, requireInProgress);
  const codes = Array.from(new Set(parsedRows.map(r => r.itemCode.trim()).filter(Boolean)));

  const catalogRows = codes.length
    ? await selectInChunks<any>(codes, chunk => writer.select({
        id: catalogItems.id,
        code: catalogItems.code,
        nameAr: catalogItems.nameAr,
        unit: catalogItems.unit,
      }).from(catalogItems).where(and(inArray(catalogItems.code, chunk), eq(catalogItems.isActive, 1))))
    : [];

  const catalogByCode = new Map<string, any[]>();
  for (const item of catalogRows) {
    const code = String(item.code || "").trim();
    const list = catalogByCode.get(code) || [];
    list.push(item);
    catalogByCode.set(code, list);
  }

  // Historical codes produced by taxonomy restructuring remain valid for old
  // Excel files. Direct current codes always win; aliases are only a fallback.
  const missingCodes = codes.filter(code => !catalogByCode.has(code));
  const aliasRows = missingCodes.length
    ? await selectInChunks<any>(missingCodes, chunk => writer.select({
        oldCode: catalogCodeAliases.oldCode,
        entityId: catalogCodeAliases.entityId,
      }).from(catalogCodeAliases).where(and(
        eq(catalogCodeAliases.entityType, "item"),
        inArray(catalogCodeAliases.oldCode, chunk),
      )))
    : [];
  const aliasItemIds = Array.from(new Set(aliasRows.map((row: any) => Number(row.entityId)).filter(Boolean)));
  const aliasCatalogRows = aliasItemIds.length
    ? await selectInChunks<any>(aliasItemIds, chunk => writer.select({
        id: catalogItems.id,
        code: catalogItems.code,
        nameAr: catalogItems.nameAr,
        unit: catalogItems.unit,
      }).from(catalogItems).where(and(inArray(catalogItems.id, chunk), eq(catalogItems.isActive, 1))))
    : [];
  const aliasItemById = new Map(aliasCatalogRows.map((row: any) => [Number(row.id), row]));
  for (const alias of aliasRows) {
    const oldCode = String(alias.oldCode || "").trim();
    if (!oldCode || catalogByCode.has(oldCode)) continue;
    const item = aliasItemById.get(Number(alias.entityId));
    if (item) catalogByCode.set(oldCode, [item]);
  }

  const catalogIds = Array.from(new Set([
    ...catalogRows.map((r: any) => Number(r.id)),
    ...aliasCatalogRows.map((r: any) => Number(r.id)),
  ]));
  const inventoryRows = catalogIds.length
    ? await selectInChunks<any>(catalogIds, chunk => writer.select({
        id: inventory.id,
        linkedItemId: inventory.linkedItemId,
        quantity: inventory.quantity,
      }).from(inventory).where(and(eq(inventory.warehouseId, op.warehouseId), inArray(inventory.linkedItemId, chunk))))
    : [];

  const inventoryByCatalogId = new Map<number, any[]>();
  for (const row of inventoryRows) {
    const id = Number(row.linkedItemId || 0);
    const list = inventoryByCatalogId.get(id) || [];
    list.push(row);
    inventoryByCatalogId.set(id, list);
  }

  const existingCountRows = await writer.select({ linkedItemId: inventory.linkedItemId })
    .from(inventoryCountItems)
    .innerJoin(inventory, eq(inventory.id, inventoryCountItems.inventoryId))
    .where(eq(inventoryCountItems.operationId, operationId));
  const existingCatalogIds = new Set(existingCountRows.map((r: any) => Number(r.linkedItemId || 0)).filter(Boolean));

  const fileCodeCounts = new Map<string, number>();
  for (const row of parsedRows) {
    const code = row.itemCode.trim();
    if (code) fileCodeCounts.set(code, (fileCodeCounts.get(code) || 0) + 1);
  }

  const previewRows: OpeningBalancePreviewRow[] = parsedRows.map(row => {
    const errors: string[] = [];
    const code = row.itemCode.trim();
    if (!code) errors.push("كود الصنف مطلوب");
    if (code && (fileCodeCounts.get(code) || 0) > 1) errors.push("كود الصنف مكرر داخل الملف");

    if (row.quantity == null) errors.push("الكمية الافتتاحية غير صالحة أو فارغة");
    else {
      if (!(row.quantity > 0)) errors.push("الكمية الافتتاحية يجب أن تكون أكبر من صفر");
      if (decimalPlaces(row.quantity) > 3) errors.push("الكمية الافتتاحية تسمح بحد أقصى 3 منازل عشرية");
    }

    if (row.unitCost == null) errors.push("تكلفة الوحدة مطلوبة ويجب إدخالها صراحة، ويمكن أن تكون 0");
    else {
      if (row.unitCost < 0) errors.push("تكلفة الوحدة لا يمكن أن تكون سالبة");
      if (decimalPlaces(row.unitCost) > 4) errors.push("تكلفة الوحدة تسمح بحد أقصى 4 منازل عشرية");
    }

    if (row.expiryInvalid) errors.push("تاريخ الانتهاء غير صالح؛ استخدم YYYY-MM-DD");

    const matches = code ? (catalogByCode.get(code) || []) : [];
    if (code && matches.length === 0) errors.push("كود الصنف غير موجود كصنف فعال في Master Catalog");
    if (matches.length > 1) errors.push("يوجد أكثر من صنف فعال بنفس الكود في الكتالوج؛ يجب معالجة التكرار قبل الاستيراد");

    const catalog = matches.length === 1 ? matches[0] : null;
    const invMatches = catalog ? (inventoryByCatalogId.get(Number(catalog.id)) || []) : [];
    if (invMatches.length > 1) errors.push("يوجد أكثر من سجل Inventory لنفس الصنف داخل المستودع");
    const inv = invMatches.length === 1 ? invMatches[0] : null;
    if (inv && normalizeInventoryQuantity(Number(inv.quantity || 0)) !== 0) {
      errors.push("هذا الصنف لديه رصيد قائم في المستودع؛ الرصيد الافتتاحي مخصص للرصيد الصفري فقط");
    }
    if (catalog && existingCatalogIds.has(Number(catalog.id))) {
      errors.push("هذا الصنف مضاف بالفعل إلى عملية الرصيد الافتتاحي الحالية");
    }

    const qty = row.quantity != null ? normalizeInventoryQuantity(row.quantity) : null;
    const cost = row.unitCost != null ? roundTo(row.unitCost, 4) : null;
    return {
      ...row,
      itemCode: code,
      quantity: qty,
      unitCost: cost,
      valid: errors.length === 0,
      errors,
      catalogItemId: catalog ? Number(catalog.id) : null,
      itemName: catalog?.nameAr || null,
      unit: catalog?.unit || null,
      inventoryId: inv ? Number(inv.id) : null,
      lineValue: qty != null && cost != null ? roundTo(qty * cost, 2) : null,
    };
  });

  const validRows = previewRows.filter(row => row.valid);
  return {
    operation: op,
    valid: previewRows.length > 0 && validRows.length === previewRows.length,
    rows: previewRows,
    summary: {
      totalRows: previewRows.length,
      validRows: validRows.length,
      errorRows: previewRows.length - validRows.length,
      totalQuantity: roundTo(validRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0), 3),
      totalValue: roundTo(validRows.reduce((sum, row) => sum + Number(row.lineValue || 0), 0), 2),
    },
  };
}

export async function previewOpeningBalanceImport(operationId: number, fileBase64: string): Promise<OpeningBalanceImportPreview> {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات");
  return validateParsedRows(db, operationId, await parseOpeningBalanceExcel(fileBase64), true);
}

export async function commitOpeningBalanceImport(operationId: number, fileBase64: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات");
  const parsed = await parseOpeningBalanceExcel(fileBase64);

  return db.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT id FROM inventory_count_operations WHERE id = ${operationId} FOR UPDATE`);
    const preview = await validateParsedRows(tx, operationId, parsed, true);
    if (!preview.valid) {
      const firstErrors = preview.rows.filter(row => !row.valid).slice(0, 5)
        .map(row => `السطر ${row.rowNumber}: ${row.errors.join("، ")}`);
      throw new Error(`تعذر اعتماد الاستيراد؛ يوجد ${preview.summary.errorRows} صف به أخطاء. ${firstErrors.join(" | ")}`);
    }

    let createdInventoryCount = 0;
    let reusedZeroInventoryCount = 0;
    for (const row of preview.rows) {
      if (!row.catalogItemId || row.quantity == null || row.unitCost == null) throw new Error(`فشل التحقق الداخلي للسطر ${row.rowNumber}`);
      const catalogRows = await tx.select().from(catalogItems)
        .where(and(eq(catalogItems.id, row.catalogItemId), eq(catalogItems.isActive, 1))).limit(1);
      const catalog = catalogRows[0];
      if (!catalog) throw new Error(`السطر ${row.rowNumber}: صنف الكتالوج لم يعد متاحاً`);

      let inventoryId = row.inventoryId;
      if (inventoryId) {
        const lockedRows = await tx.select().from(inventory)
          .where(and(eq(inventory.id, inventoryId), eq(inventory.warehouseId, preview.operation.warehouseId))).limit(1);
        const existing = lockedRows[0];
        if (!existing || normalizeInventoryQuantity(Number(existing.quantity || 0)) !== 0) {
          throw new Error(`السطر ${row.rowNumber}: تغير رصيد الصنف بعد المعاينة؛ أعد رفع الملف`);
        }
        await tx.update(inventory).set({
          linkedItemId: catalog.id,
          itemName: catalog.nameAr,
          itemNameAr: catalog.nameAr,
          itemNameEn: catalog.nameEn,
          unit: catalog.unit || (existing as any).unit || "قطعة",
          purchaseUnit: catalog.unit || (existing as any).purchaseUnit || (existing as any).unit || "قطعة",
          issueUnit: catalog.unit || (existing as any).issueUnit || (existing as any).unit || "قطعة",
          averageCost: Number(row.unitCost).toFixed(4),
          totalCostValue: "0.00",
          updatedAt: new Date(),
        } as any).where(eq(inventory.id, inventoryId));
        reusedZeroInventoryCount++;
      } else {
        const internalCode = await getNextInventoryCode(tx);
        inventoryId = Number(await createInventoryItemV2({
          itemName: catalog.nameAr,
          itemNameAr: catalog.nameAr,
          itemNameEn: catalog.nameEn,
          quantity: 0,
          unit: catalog.unit || "قطعة",
          purchaseUnit: catalog.unit || "قطعة",
          issueUnit: catalog.unit || "قطعة",
          conversionFactor: "1.0000",
          internalCode,
          averageCost: Number(row.unitCost).toFixed(4),
          totalCostValue: "0.00",
          linkedItemId: catalog.id,
          warehouseId: preview.operation.warehouseId,
        }, tx));
        if (!inventoryId) throw new Error(`السطر ${row.rowNumber}: تعذر إنشاء سجل المخزون`);
        createdInventoryCount++;
      }

      const duplicateRows = await tx.select({ id: inventoryCountItems.id }).from(inventoryCountItems)
        .where(and(eq(inventoryCountItems.operationId, operationId), eq(inventoryCountItems.inventoryId, inventoryId))).limit(1);
      if (duplicateRows[0]) throw new Error(`السطر ${row.rowNumber}: الصنف أضيف للعملية أثناء الاستيراد؛ أعد المحاولة`);

      await tx.insert(inventoryCountItems).values({
        operationId,
        inventoryId,
        systemQuantity: "0.000",
        countedQuantity: Number(row.quantity).toFixed(3),
        diffQuantity: Number(row.quantity).toFixed(3),
        expiryDate: row.expiryDate || null,
        countedById: userId,
        countedAt: new Date(),
        notes: "رصيد افتتاحي مستورد من Excel — بانتظار تطبيق التسوية وإنشاء LOT وQR",
      } as any);
    }

    return {
      success: true,
      importedRows: preview.summary.totalRows,
      totalQuantity: preview.summary.totalQuantity,
      totalValue: preview.summary.totalValue,
      createdInventoryCount,
      reusedZeroInventoryCount,
      operationNumber: preview.operation.operationNumber,
    };
  });
}

function styleOpeningSheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ rightToLeft: true, state: "frozen", ySplit: 1 }];
  sheet.columns = [
    { header: "كود الصنف", key: "itemCode", width: 24, style: { numFmt: "@" } },
    { header: "الكمية الافتتاحية", key: "quantity", width: 22, style: { numFmt: "0.000" } },
    { header: "تكلفة الوحدة", key: "unitCost", width: 20, style: { numFmt: "0.0000" } },
    { header: "تاريخ الانتهاء", key: "expiryDate", width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("A1").note = "إلزامي: نفس كود الصنف الموجود في Master Catalog. لا تستخدم رقم LOT.";
  sheet.getCell("B1").note = "إلزامي: كمية أكبر من صفر، بحد أقصى 3 منازل عشرية.";
  sheet.getCell("C1").note = "إلزامي: تكلفة الوحدة الافتتاحية، ويمكن إدخال 0 صراحة، بحد أقصى 4 منازل عشرية.";
  sheet.getCell("D1").note = "اختياري. الصيغة المعتمدة: YYYY-MM-DD";
  sheet.getColumn(1).numFmt = "@";
}

export async function createOpeningBalanceTemplate() {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CMMS";
  styleOpeningSheet(workbook.addWorksheet(SHEET_NAME));

  const guide = workbook.addWorksheet(CATALOG_SHEET_NAME);
  guide.views = [{ rightToLeft: true, state: "frozen", ySplit: 1 }];
  guide.columns = [
    { header: "كود الصنف", key: "code", width: 24, style: { numFmt: "@" } },
    { header: "اسم الصنف", key: "nameAr", width: 42 },
    { header: "الوحدة", key: "unit", width: 18 },
  ];
  guide.getRow(1).font = { bold: true };
  const items = await db.select({ code: catalogItems.code, nameAr: catalogItems.nameAr, unit: catalogItems.unit })
    .from(catalogItems).where(eq(catalogItems.isActive, 1));
  for (const item of items) if (item.code) guide.addRow({ code: String(item.code), nameAr: item.nameAr, unit: item.unit || "" });
  guide.getColumn(1).numFmt = "@";
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function exportOpeningBalanceOperation(operationId: number) {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات");
  const op = await loadOperation(db, operationId, false);
  const rows = await db.select({
    itemCode: catalogItems.code,
    quantity: inventoryCountItems.countedQuantity,
    stagedUnitCost: inventory.averageCost,
    postedUnitCost: inventoryLots.issueUnitCost,
    expiryDate: inventoryCountItems.expiryDate,
    lotExpiryDate: inventoryLots.expiryDate,
  }).from(inventoryCountItems)
    .innerJoin(inventory, eq(inventory.id, inventoryCountItems.inventoryId))
    .leftJoin(catalogItems, eq(catalogItems.id, inventory.linkedItemId))
    .leftJoin(inventoryLots, eq(inventoryLots.id, inventoryCountItems.lotId))
    .where(eq(inventoryCountItems.operationId, operationId));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CMMS";
  const sheet = workbook.addWorksheet(SHEET_NAME);
  styleOpeningSheet(sheet);
  for (const row of rows) sheet.addRow({
    itemCode: row.itemCode || "",
    quantity: Number(row.quantity || 0),
    unitCost: Number(row.postedUnitCost ?? row.stagedUnitCost ?? 0),
    expiryDate: row.expiryDate || row.lotExpiryDate || "",
  });
  return {
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    fileName: `opening-stock-${op.operationNumber}.xlsx`,
    rowCount: rows.length,
  };
}
