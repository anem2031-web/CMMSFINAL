import { describe, it, expect } from "vitest";
import { availableCredit, compensationAmounts, decimal4, returnedInvoiceValue } from "../supplier-return-followup/amounts";
import { approveReplacementFunding, assertReplacementPurchase, quoteReplacement, type ReplacementPlan } from "../supplier-return-followup/replacement-policy";
import { replacementReceiptAllocation } from "../supplier-return-followup/receipt-allocation";
const delegate = { id: 10, role: "delegate", active: true };
const plan: ReplacementPlan = { stage: "pricing", revision: 0, delegateId: 10, creatorId: 20, currency: "SAR", valuationBasis: "tax_inclusive", total: "0", creditAllocated: "0", additionalFunding: "0", accountingApprovedById: null, managementApprovedById: null };
const credit = { available: "100", currency: "SAR", valuationBasis: "tax_inclusive" as const, confirmed: true };
describe("replacement money and approvals", () => {
  it.each([["100", "0.0000", "0.0000"], ["80", "0.0000", "20.0000"], ["130", "30.0000", "0.0000"]])("calculates %s against original credit", (total, additional, remaining) => {
    const money = compensationAmounts(total, "100");
    expect(money.additionalFunding).toBe(additional); expect(money.unallocatedCredit).toBe(remaining);
  });
  it("calculates fractional original invoice cost without inventory average", () => {
    expect(returnedInvoiceValue("115", "10", "2")).toBe("23.0000");
    expect(returnedInvoiceValue("1", "3", "1")).toBe("0.3333");
  });
  it.each(["-1", "NaN", "1e3", "1.00001", "100000000000000", "", " 1"])("rejects invalid money %s", value => expect(() => decimal4(value)).toThrow());
  it("subtracts pending refunds and allocations, not rejected/cancelled entries", () => {
    expect(availableCredit("100", [
      { kind: "cash_refund", amount: "20", status: "pending" },
      { kind: "credit_allocation", amount: "30", status: "completed" },
      { kind: "credit_allocation", amount: "90", status: "cancelled" },
    ])).toBe("50.0000");
    expect(() => availableCredit("10", [{ kind: "cash_refund", amount: "11", status: "pending" }])).toThrow();
  });
  it("requires both exact approval stages for the additional amount only", () => {
    const quoted = quoteReplacement(delegate, plan, 0, "130", credit);
    expect(quoted.stage).toBe("pending_accounting"); expect(quoted.additionalFunding).toBe("30.0000");
    expect(() => assertReplacementPurchase(delegate, quoted, 1)).toThrow();
    expect(() => approveReplacementFunding({ id: 30, role: "senior_management", active: true }, quoted, 1)).toThrow();
    const accounted = approveReplacementFunding({ id: 31, role: "accountant", active: true }, quoted, 1);
    expect(() => assertReplacementPurchase(delegate, accounted, 2)).toThrow();
    const approved = approveReplacementFunding({ id: 30, role: "senior_management", active: true }, accounted, 2);
    expect(() => assertReplacementPurchase(delegate, approved, 3)).not.toThrow();
  });
  it("equal/lower replacement requires no fictitious positive funding", () => {
    const quoted = quoteReplacement(delegate, plan, 0, "80", credit);
    expect(quoted.stage).toBe("ready_to_purchase"); expect(quoted.additionalFunding).toBe("0.0000");
    expect(() => assertReplacementPurchase(delegate, quoted, 1)).not.toThrow();
  });
  it("repricing resets previous accounting and management decisions", () => {
    const previous = { ...plan, stage: "ready_to_purchase" as const, revision: 4, accountingApprovedById: 31, managementApprovedById: 30 };
    const quoted = quoteReplacement(delegate, previous, 4, "130", credit);
    expect(quoted.accountingApprovedById).toBeNull(); expect(quoted.managementApprovedById).toBeNull();
  });
  it("rejects foreign delegate, inactive account, stale revision and mixed valuation basis", () => {
    expect(() => quoteReplacement({ ...delegate, id: 99 }, plan, 0, "100", credit)).toThrow();
    expect(() => quoteReplacement({ ...delegate, active: false }, plan, 0, "100", credit)).toThrow();
    expect(() => quoteReplacement(delegate, plan, 2, "100", credit)).toThrow();
    expect(() => quoteReplacement(delegate, plan, 0, "100", { ...credit, currency: "USD" })).toThrow();
    expect(() => quoteReplacement(delegate, plan, 0, "100", { ...credit, valuationBasis: "tax_exclusive" })).toThrow();
    expect(() => quoteReplacement(delegate, plan, 0, "100", { ...credit, confirmed: false })).toThrow();
  });
});
describe("partial replacement receipt", () => {
  it("allocates cumulative quantities exactly, closing only at full receipt", () => {
    let compensated = "0";
    for (let previous = 0; previous < 3; previous++) {
      const result = replacementReceiptAllocation({ replacementQuantity: "3", originalQuantityCovered: "1", alreadyReceived: String(previous), alreadyCompensated: compensated, receiving: "1" });
      expect(result.compensatedOriginalQuantity).toBe(previous === 2 ? "0.334" : "0.333");
      expect(result.completed).toBe(previous === 2); compensated = result.cumulativeCompensated;
    }
    expect(compensated).toBe("1.000");
  });
  it("rejects receipt beyond approved quantity and inconsistent historical allocation", () => {
    const request = { replacementQuantity: "3", originalQuantityCovered: "1", alreadyReceived: "3", alreadyCompensated: "1", receiving: "1" };
    expect(() => replacementReceiptAllocation(request)).toThrow();
    expect(() => replacementReceiptAllocation({ ...request, alreadyReceived: "1", alreadyCompensated: "0.5" })).toThrow();
  });
});
