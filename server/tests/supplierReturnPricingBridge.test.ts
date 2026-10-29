import { describe, expect, it } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { reserveReplacementPricing, replacementFundingForBatch } from "../supplier-return-followup/pricing-bridge";

function fixture(overrides: Record<string, unknown> = {}, reservations: any[] = []) {
  const writes: string[] = [];
  const params: unknown[][] = [];
  const plan = { id: 7, caseId: 3, purchaseOrderId: 50, purchaseOrderItemId: 70, supplierCreditId: 9,
    delegateId: 4, handoverStatus: "accepted", status: "pending_review", originalPurchaseValue: "100.0000",
    caseCurrency: "SAR", caseBasis: "tax_inclusive", ...overrides };
  const tx = { async execute(query: any) {
    const rendered = new MySqlDialect().sqlToQuery(query);
    const text = rendered.sql;
    params.push(rendered.params);
    if (text.startsWith("SELECT DATABASE()")) return [[{ databaseName: "copycmms2" }]];
    if (text.includes("FROM supplier_return_replacement_plans p") && text.includes("INNER JOIN supplier_return_cases c")) return [[plan]];
    if (text.includes("FROM supplier_return_replacement_plans p") && text.includes("INNER JOIN po_pricing_batches b")) return [[{
      ...plan, status: "pending_accounting", quotedTotal: "120.0000", creditAllocated: "100.0000", additionalFunding: "20.0000",
      batchStatus: "pending_accounting", batchOrderId: 50, itemBatchId: 80,
    }]];
    if (text.includes("SELECT id,amount,currency,valuationBasis,status FROM supplier_return_settlements")) return [[{ id: Number(plan.supplierCreditId), amount: "100.0000", currency: "SAR", valuationBasis: "tax_inclusive", status: "completed" }]];
    if (text.includes("FROM supplier_return_settlements") && text.includes("type IN")) return [reservations];
    if (text.startsWith("INSERT INTO supplier_return_settlements")) { writes.push(text); return [{ insertId: 15 }]; }
    if (text.startsWith("UPDATE supplier_return_replacement_plans")) { writes.push(text); return [{ affectedRows: 1 }]; }
    throw Error(`Unexpected query: ${text}`);
  } };
  return { tx, writes, params };
}

describe("replacement pricing bridge (isolated SQL port)", () => {
  it("uses refunded cash retained by the delegate and requests only the increase", async () => {
    const f=fixture({resolution:"refund",supplierCreditId:19});
    const result=await reserveReplacementPricing(f.tx,4,50,[{id:70,estimatedTotalCost:"120.0000"}]);
    expect(result).toMatchObject({creditAllocated:"100.0000",additionalFunding:"20.0000"});
    expect(f.params.some(row=>row.includes("cash_refund"))).toBe(true);
    expect(f.params.some(row=>row.includes(19))).toBe(true);
  });
  it("does not spend supplier credit twice after the delegate has refunded it", async () => {
    const f = fixture({}, [{kind:"cash_refund",amount:"100.0000",status:"completed"}]);
    const result = await reserveReplacementPricing(f.tx,4,50,[{id:70,estimatedTotalCost:"120.0000"}]);
    expect(result).toMatchObject({creditAllocated:"0.0000",additionalFunding:"120.0000"});
  });
  it("reserves only the difference from a VAT-inclusive replacement quote", async () => {
    const f = fixture();
    const result = await reserveReplacementPricing(f.tx, 4, 50, [{ id: 70, estimatedTotalCost: "120.0000" }]);
    expect(result).toMatchObject({ total: "120.0000", creditAllocated: "100.0000", additionalFunding: "20.0000" });
    expect(f.writes).toHaveLength(2);
    expect(f.params.some(row => row.includes("100.0000"))).toBe(true);
    expect(f.params.some(row => row.includes("20.0000"))).toBe(true);
  });
  it("does not require extra funding when the new price is lower", async () => {
    const f = fixture();
    const result = await reserveReplacementPricing(f.tx, 4, 50, [{ id: 70, estimatedTotalCost: "80.0000" }]);
    expect(result).toMatchObject({ creditAllocated: "80.0000", additionalFunding: "0.0000", unallocatedCredit: "20.0000" });
  });
  it("uses a fresh reservation key after a rejected quote is repriced", async () => {
    const first = fixture({ revision: 1 });
    const second = fixture({ revision: 4 });
    await reserveReplacementPricing(first.tx, 4, 50, [{ id: 70, estimatedTotalCost: "120.0000" }]);
    await reserveReplacementPricing(second.tx, 4, 50, [{ id: 70, estimatedTotalCost: "110.0000" }]);
    expect(first.params.some(row => row.includes("replacement-plan:7:credit:1"))).toBe(true);
    expect(second.params.some(row => row.includes("replacement-plan:7:credit:4"))).toBe(true);
  });
  it("rejects a different delegate or item before any write", async () => {
    const f = fixture();
    await expect(reserveReplacementPricing(f.tx, 5, 50, [{ id: 70, estimatedTotalCost: "120.0000" }])).rejects.toThrow();
    await expect(reserveReplacementPricing(f.tx, 4, 50, [{ id: 71, estimatedTotalCost: "120.0000" }])).rejects.toThrow();
    expect(f.writes).toHaveLength(0);
  });
  it("exposes the exact additional custody for the existing accounting batch", async () => {
    const f = fixture();
    expect(await replacementFundingForBatch(f.tx, 80)).toMatchObject({ planId: 7, additionalFunding: "20.0000" });
  });
});
