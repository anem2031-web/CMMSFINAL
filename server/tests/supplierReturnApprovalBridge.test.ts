import { describe, expect, it } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { approveReplacementAccounting, approveReplacementManagement } from "../supplier-return-followup/pricing-bridge";

function fixture() {
  const plan: any = { id: 7, caseId: 3, purchaseOrderId: 50, purchaseOrderItemId: 70, supplierCreditId: 9,
    creditAllocationSettlementId: 15, fundingSettlementId: null, delegateId: 4, handoverStatus: "accepted",
    status: "pending_accounting", batchStatus: "pending_accounting", purchasePackageSubmissionId: null,
    submittedById: 4, itemBatchId: 80, itemStatus: "estimated", estimatedTotalCost: "120.0000",
    quotedTotal: "120.0000", creditAllocated: "100.0000", additionalFunding: "20.0000" };
  const allocation: any = { id: 15, status: "pending", amount: "100.0000", sourceCreditId: 9 };
  const funding: any = { id: 16, status: "accounting_approved", amount: "20.0000" };
  const writes: string[] = [];
  const tx: any = { async execute(query: any) {
    const { sql: text } = new MySqlDialect().sqlToQuery(query);
    if (text.startsWith("SELECT DATABASE()")) return [[{ databaseName: "copycmms2" }]];
    if (text.includes("FROM supplier_return_replacement_plans p")) return [[plan]];
    if (text.includes("FROM supplier_return_settlements") && text.includes("credit_allocation")) return [[allocation]];
    if (text.includes("FROM supplier_return_settlements") && text.includes("additional_funding")) return [[funding]];
    if (/^(INSERT|UPDATE)/.test(text)) { writes.push(text);
      if (text.startsWith("INSERT INTO supplier_return_settlements")) return [{ insertId: 16 }];
      return [{ affectedRows: 1 }]; }
    throw Error(text);
  } };
  return { tx, plan, allocation, funding, writes };
}

describe("replacement funding approvals through the existing batch stages", () => {
  it("rejects full replacement price as custody and makes no write", async () => {
    const f = fixture();
    await expect(approveReplacementAccounting(f.tx, 22, 80, "120.0000", undefined, null)).rejects.toThrow("فرق سعر البديل");
    expect(f.writes).toHaveLength(0);
  });
  it("accepts the exact positive difference and reserves funding atomically", async () => {
    const f = fixture();
    expect(await approveReplacementAccounting(f.tx, 22, 80, "20.0000", "موافق", "sig")).toBe(true);
    expect(f.writes.filter(text => text.startsWith("INSERT INTO supplier_return_settlements"))).toHaveLength(1);
    expect(f.writes.some(text => text.includes("UPDATE po_pricing_batches"))).toBe(true);
    expect(f.writes.some(text => text.includes("UPDATE supplier_return_replacement_plans"))).toBe(true);
  });
  it("permits zero extra custody without inventing a funding record", async () => {
    const f = fixture(); f.plan.quotedTotal = f.plan.estimatedTotalCost = "80.0000";
    f.plan.creditAllocated = f.allocation.amount = "80.0000"; f.plan.additionalFunding = "0.0000";
    expect(await approveReplacementAccounting(f.tx, 22, 80, "0", undefined, null)).toBe(true);
    expect(f.writes.some(text => text.startsWith("INSERT INTO supplier_return_settlements"))).toBe(false);
  });
  it("advances the existing management batch and replacement plan together", async () => {
    const f = fixture(); f.plan.status = f.plan.batchStatus = "pending_management"; f.plan.accountingApprovedById = 22;
    f.plan.fundingSettlementId = 16; f.allocation.status = "accounting_approved";
    expect(await approveReplacementManagement(f.tx, 33, 80, "موافق")).toBe(true);
    expect(f.writes.some(text => text.includes("UPDATE purchase_order_items SET status='approved'"))).toBe(true);
    expect(f.writes.some(text => text.includes("UPDATE supplier_return_replacement_plans SET status='ready_to_purchase'"))).toBe(true);
  });
});
