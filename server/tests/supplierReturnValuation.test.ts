import { describe, expect, it } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { valueReturnedQuantity, previewReturnValuation, savedReturnValuation, type InvoiceLotSource } from "../supplier-return-followup/valuation";
import { supplierReturnValuePreview } from "../supplier-return-followup/runtime";

const invoice: InvoiceLotSource = { lotId: 31, receiptItemId: 21, originalQuantity: "10.000", conversionFactor: "1.0000",
  purchaseUnit: "قطعة", issueUnit: "قطعة", receiptQuantity: "10.000", receiptPurchaseUnit: "قطعة", invoiceUnitCost: "100.0000", invoiceTaxAmount: "0.00", invoiceLineTotal: "1000.00" };
function source() {
  return { ...invoice, sourceType: "receipt", receiptId: 20, actualReceiptId: 20, actualReceiptItemId: 21, lineReceiptId: 20,
    purchaseOrderId: 11, actualOrderId: 11, purchaseOrderItemId: 12, actualOrderItemId: 12, linePurchaseOrderItemId: 12, itemOrderId: 11,
    catalogItemId: 41, lineCatalogItemId: 41, inventoryCatalogItemId: 41, inventoryUnit: "قطعة",
    remainingQuantity: "10.000", availableQuantity: "10.000", inventoryQuantity: 50, lotCode: "LOT-31", vendorName: "المورد", invoiceNumber: "INV-1",
    returnedQuantity: 3, returnOrderId: 11, returnOrderItemId: 12, returnReceiptId: 20 };
}
function reader() {
  let active = true, databaseName = "copycmms2", role = "warehouse", fail = false;
  let result: any[] = [source()], prior = "0";
  const queries: { sql: string; params: any[] }[] = [];
  const tx = { async execute(query: any) {
    const q = new MySqlDialect().sqlToQuery(query); queries.push(q);
    if (fail) throw Error("connection lost");
    if (q.sql.includes("FROM users")) return [[{ id: 1, role, isActive: Number(active) }]];
    if (q.sql.includes("SELECT DATABASE")) return [[{ databaseName }]];
    if (q.sql.includes("SUM(returnedQuantity)")) return [[{ quantity: prior }]];
    if (q.sql.includes("SELECT id,returnedQuantity")) return [[{ id: 10, returnedQuantity: prior }]];
    return [result];
  } };
  return { tx, queries, rows: (value: any[]) => { result = value; }, prior: (value: string) => { prior = value; },
    inactive: () => { active = false; }, role: (value: string) => { role = value; }, database: (value: string) => { databaseName = value; }, fail: () => { fail = true; } };
}
const request = { warehouseId: 4, trackingToken: "LOT-31", returnedQuantity: 3 };
describe("returned invoice quantity", () => {
  it("values partial/full quantity, leaving source and stock valuation untouched", () => {
    const before = structuredClone(invoice);
    expect(valueReturnedQuantity(invoice, "3").originalPurchaseValue).toBe("300.0000");
    expect(valueReturnedQuantity(invoice, "10").originalPurchaseValue).toBe("1000.0000");
    expect(invoice).toEqual(before);
  });
  it("uses original purchase-to-issue conversion and the invoice tax", () => {
    expect(valueReturnedQuantity({ ...invoice, purchaseUnit: "كرتون", receiptPurchaseUnit: "كرتون", receiptQuantity: "2.000", conversionFactor: "12.0000", originalQuantity: "24.000", invoiceTaxAmount: "30.00", invoiceLineTotal: "230.00" }, "6")).toMatchObject({ originalPurchaseValue: "57.5000", currency: "SAR", valuationBasis: "tax_inclusive" });
  });
  it("allocates rounding cumulatively across separate partial returns", () => {
    const thirds = { ...invoice, originalQuantity: "3.000", receiptQuantity: "3.000", invoiceUnitCost: "0.3333", invoiceLineTotal: "1.00" };
    expect([0, 1, 2].map(previous => valueReturnedQuantity(thirds, "1", String(previous)).originalPurchaseValue)).toEqual(["0.3333", "0.3334", "0.3333"]);
    expect(valueReturnedQuantity(thirds, "2", "1").originalPurchaseValue).toBe("0.6667");
  });
  it.each(["", "-1", "0", "1e2", "NaN", "0.0001"])("rejects invalid return quantity %s", quantity => {
    expect(() => valueReturnedQuantity(invoice, quantity)).toThrow();
  });
  it.each([
    { receiptItemId: null }, { purchaseUnit: null }, { receiptPurchaseUnit: "كرتون" }, { originalQuantity: "0" },
    { conversionFactor: "2" }, { invoiceLineTotal: "0" }, { invoiceLineTotal: null }, { invoiceTaxAmount: null }, { invoiceUnitCost: "NaN" },
  ])("leaves missing/inconsistent legacy invoice value unknown: %j", override => {
    expect(valueReturnedQuantity({ ...invoice, ...override }, "1")).toMatchObject({ originalPurchaseValue: null, currency: null, unavailableReason: expect.any(String) });
  });
  it("allows a genuinely zero-priced line, and rejects cumulative over-return value", () => {
    expect(valueReturnedQuantity({ ...invoice, invoiceUnitCost: "0", invoiceLineTotal: "0" }, "1").originalPurchaseValue).toBe("0.0000");
    expect(valueReturnedQuantity(invoice, "3", "8").originalPurchaseValue).toBeNull();
  });
});
describe("lot source scope and fresh preview", () => {
  it.each(["warehouse", "admin", "owner"])("allows %s using explicit current warehouse and positive balance only", async role => {
    const f = reader(); f.role(role);
    expect(await supplierReturnValuePreview({ id: 1, role }, request, f.tx)).toMatchObject({ originalPurchaseValue: "300.0000", vendorName: "المورد", quantity: 3 });
    expect(f.queries).toHaveLength(4);
    expect(f.queries[2].sql).toContain("w.id=? AND w.isActive=1 AND b.quantity>0");
    expect(f.queries[2].params).toEqual([4, "LOT-31", "LOT-31"]);
    expect(f.queries[3].sql).toContain("sourceDeliveryDocumentId IS NULL");
  });
  it.each(["delegate", "accountant", "senior_management", "executive_director", "technician", "it_member", "observer"])("denies %s without reading inventory", async role => {
    const f = reader(); f.role(role);
    await expect(supplierReturnValuePreview({ id: 1, role }, request, f.tx)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(f.queries).toHaveLength(0);
  });
  it("does not cache identity, environment, stock, or valuation across requests", async () => {
    const f = reader(); const actor = { id: 1, role: "warehouse" };
    await supplierReturnValuePreview(actor, request, f.tx);
    f.rows([{ ...source(), availableQuantity: "2.000" }]);
    await expect(supplierReturnValuePreview(actor, request, f.tx)).rejects.toMatchObject({ code: "INVALID" });
    f.rows([source()]); f.database("cmms");
    await expect(supplierReturnValuePreview(actor, request, f.tx)).rejects.toMatchObject({ code: "FORBIDDEN" });
    f.database("COPYCMMS2"); f.inactive();
    await expect(supplierReturnValuePreview(actor, request, f.tx)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it.each([[], [source(), source()], [{ ...source(), actualReceiptId: null }], [{ ...source(), actualReceiptItemId: null }],
    [{ ...source(), lineReceiptId: 99 }], [{ ...source(), itemOrderId: 99 }], [{ ...source(), actualOrderId: null }],
    [{ ...source(), inventoryCatalogItemId: 99 }], [{ ...source(), inventoryUnit: "كرتون" }], [{ ...source(), sourceType: "opening_balance" }],
    [{ ...source(), linePurchaseOrderItemId: 99 }], [{ ...source(), lineCatalogItemId: 99 }]].map(rows => ({ rows })))("denies missing, ambiguous or mismatched source %#", async ({ rows }) => {
    const f = reader(); f.rows(rows);
    await expect(previewReturnValuation(f.tx, request)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it.each(["availableQuantity", "inventoryQuantity", "remainingQuantity"])("bounds quantity by %s", async field => {
    const f = reader(); f.rows([{ ...source(), [field]: "2.000" }]);
    await expect(previewReturnValuation(f.tx, request)).rejects.toMatchObject({ code: "INVALID" });
  });
  it("accepts numeric ID strings and locks source/previous supplier returns for persistence", async () => {
    const f = reader(); f.rows([{ ...source(), linePurchaseOrderItemId: "12", returnOrderItemId: "12", returnedQuantity: 2 }]); f.prior("3.000");
    const result = await savedReturnValuation(f.tx, 99);
    expect(result.valuation.originalPurchaseValue).toBe("200.0000");
    expect(f.queries).toHaveLength(2);
    expect(f.queries.every(q => q.sql.endsWith("FOR UPDATE"))).toBe(true);
    expect(f.queries[1].params).toEqual([31, 99]);
  });
  it("rejects a return attached to a different source and propagates infrastructure failures", async () => {
    const f = reader(); f.rows([{ ...source(), returnReceiptId: 99 }]);
    await expect(savedReturnValuation(f.tx, 1)).rejects.toMatchObject({ code: "CONFLICT" });
    f.fail();
    await expect(previewReturnValuation(f.tx, request)).rejects.toThrow("connection lost");
  });
});
