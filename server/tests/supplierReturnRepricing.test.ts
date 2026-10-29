import { describe, expect, it } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { returnReplacementToDelegate } from "../supplier-return-followup/repricing";

function fixture(stage: "accounting" | "management" = "accounting") {
  const writes: string[] = [];
  const plan: any = { id: 7, caseId: 3, purchaseOrderId: 50, purchaseOrderItemId: 70,
    creditAllocationSettlementId: 15, fundingSettlementId: stage === "management" ? 16 : null,
    delegateId: 4, itemDelegateId: 4, handoverStatus: "accepted",
    status: stage === "accounting" ? "pending_accounting" : "pending_management",
    batchStatus: stage === "accounting" ? "pending_accounting" : "pending_management",
    purchasePackageSubmissionId: null, itemBatchId: 80, itemStatus: "estimated" };
  const tx: any = { async execute(query: any) {
    const { sql: text } = new MySqlDialect().sqlToQuery(query);
    if (text.startsWith("SELECT DATABASE()")) return [[{ databaseName: "copycmms2" }]];
    if (text.startsWith("SELECT id,role,isActive FROM users")) return [[{ id: 22, role: stage === "accounting" ? "accountant" : "senior_management", isActive: 1 }]];
    if (text.includes("FROM supplier_return_replacement_plans p")) return [[plan]];
    if (text.startsWith("SELECT id FROM purchase_order_items")) return [[{ id: 70 }]];
    if (text.includes("FROM supplier_return_settlements") && text.includes("credit_allocation")) return [[{ id: 15, status: stage === "accounting" ? "pending" : "accounting_approved" }]];
    if (text.includes("FROM supplier_return_settlements") && text.includes("additional_funding")) return [[{ id: 16, status: "accounting_approved" }]];
    if (/^(INSERT|UPDATE)/.test(text)) { writes.push(text); return [{ affectedRows: 1 }]; }
    throw Error(text);
  } };
  return { tx, plan, writes };
}

describe("rejected replacement pricing", () => {
  it("returns the same item to the delegate and frees its pending credit", async () => {
    const f = fixture();
    expect(await returnReplacementToDelegate(f.tx, 22, "accountant", "accounting", 80, 70, "السعر غير مناسب")).toBe(true);
    expect(f.writes.some(q => q.includes("SET status='pending',batchId=NULL"))).toBe(true);
    expect(f.writes.some(q => q.includes("SET status='pending_review'"))).toBe(true);
    expect(f.writes.filter(q => q.includes("supplier_return_settlements SET status='cancelled'"))).toHaveLength(1);
  });
  it("also releases approved funding when management rejects", async () => {
    const f = fixture("management");
    expect(await returnReplacementToDelegate(f.tx, 22, "senior_management", "management", 80, 70, "يلزم إعادة التسعير")).toBe(true);
    expect(f.writes.filter(q => q.includes("supplier_return_settlements SET status='cancelled'"))).toHaveLength(2);
  });
  it("does not mutate a changed stage", async () => {
    const f = fixture(); f.plan.status = "ready_to_purchase";
    await expect(returnReplacementToDelegate(f.tx, 22, "accountant", "accounting", 80, 70, "السعر غير مناسب")).rejects.toThrow();
    expect(f.writes).toHaveLength(0);
  });
});
