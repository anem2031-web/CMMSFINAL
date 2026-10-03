import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const lotsSource = () => read("server/_core/inventory-lots.ts");

function functionBlock(source: string, name: string, nextName?: string) {
  const start = source.indexOf(`export async function ${name}`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const end = nextName ? source.indexOf(`export async function ${nextName}`, start + 1) : -1;
  return source.slice(start, end > start ? end : undefined);
}

describe("Inventory Lot identifier resolution — QR trackingToken + manual lotCode", () => {
  it("centralizes user-facing Lot identifier matching on the two unique identifiers", () => {
    const source = lotsSource();
    const start = source.indexOf("function matchInventoryLotIdentifier");
    const end = source.indexOf("export async function resolveInventoryLotForIssue", start);
    const block = source.slice(start, end);

    expect(block).toContain("eq(inventoryLots.trackingToken, identifier)");
    expect(block).toContain("eq(inventoryLots.lotCode, identifier)");
    expect(block).toContain("return or(");
  });

  it.each([
    ["resolveInventoryLotForIssue", "resolveInventoryLotForWarehouseTransfer"],
    ["resolveInventoryLotForWarehouseTransfer", "moveInventoryLotBalanceForTransfer"],
    ["resolveInventoryLotForDisposal", "resolveInventoryLotForCount"],
    ["resolveInventoryLotForCount", "applyInventoryLotCountAdjustment"],
    ["resolveInventoryLotForSupplierReturn", "consumeInventoryLotForIssue"],
  ])("uses the shared identifier matcher in %s", (name, nextName) => {
    const block = functionBlock(lotsSource(), name, nextName);
    expect(block).toContain("matchInventoryLotIdentifier(token)");
  });

  it("uses the same identifier matcher when disposal and supplier-return diagnose a known Lot in another warehouse", () => {
    const source = lotsSource();
    const disposal = functionBlock(source, "resolveInventoryLotForDisposal", "resolveInventoryLotForCount");
    const supplierReturn = functionBlock(source, "resolveInventoryLotForSupplierReturn", "consumeInventoryLotForIssue");

    expect((disposal.match(/matchInventoryLotIdentifier\(token\)/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((supplierReturn.match(/matchInventoryLotIdentifier\(token\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it("keeps warehouse/inventory scoping and positive-balance guards in movement resolvers", () => {
    const source = lotsSource();
    const transfer = functionBlock(source, "resolveInventoryLotForWarehouseTransfer", "moveInventoryLotBalanceForTransfer");
    const disposal = functionBlock(source, "resolveInventoryLotForDisposal", "resolveInventoryLotForCount");
    const supplierReturn = functionBlock(source, "resolveInventoryLotForSupplierReturn", "consumeInventoryLotForIssue");

    expect(transfer).toContain("eq(inventory.warehouseId, params.fromWarehouseId)");
    expect(transfer).toContain("eq(inventory.id, params.fromInventoryId)");
    expect(transfer).toContain("balanceQuantity");
    expect(disposal).toContain("eq(inventory.warehouseId, params.warehouseId)");
    expect(disposal).toContain("positiveRows");
    expect(supplierReturn).toContain("eq(inventory.warehouseId, params.warehouseId)");
    expect(supplierReturn).toContain("sourceType !== \"receipt\"");
  });

  it("stores/uses the canonical trackingToken returned by a successful transfer resolution", () => {
    const ui = read("client/src/pages/inventory/WarehouseTransfer.tsx");
    expect(ui).toContain("lotTrackingToken: lotsEnabled ? transferLotInfo?.trackingToken : undefined");
    expect(ui).toContain("lotCode: lotsEnabled ? transferLotInfo?.lotCode : undefined");
  });

  it("tells operators that manual Lot Code is accepted in affected workflows", () => {
    expect(read("client/src/pages/inventory/WarehouseTransfer.tsx")).toContain("امسح QR الدفعة أو أدخل رقم اللوت");
    expect(read("client/src/pages/inventory/WarehouseReturn.tsx")).toContain("إدخال رقم اللوت");
    expect(read("client/src/pages/inventory/InventoryOperations.tsx")).toContain("أدخل رقم اللوت");
  });
});
