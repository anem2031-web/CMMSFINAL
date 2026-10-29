import { describe, expect, it } from "vitest";
import { supplierReturnDatabaseEnabled } from "../supplier-return-followup/feature";
import { confirmSupplierRefundInput } from "../supplier-return-followup/refund";

describe("supplier return rollout scope", () => {
  it("keeps the trial available and requires an explicit production switch", () => {
    expect(supplierReturnDatabaseEnabled("COPYCMMS2", "false")).toBe(true);
    expect(supplierReturnDatabaseEnabled("cmms", "false")).toBe(false);
    expect(supplierReturnDatabaseEnabled("cmms", "true")).toBe(true);
    expect(supplierReturnDatabaseEnabled("CMMS", "true")).toBe(true);
  });
  it.each([null, undefined, "", "copycmms", "cmms_backup", "cmms2"])(
    "denies unrelated database %s even with production enabled",
    name => {
      expect(supplierReturnDatabaseEnabled(name, "true")).toBe(false);
    }
  );
  it("rejects a refund reference longer than the actual database field", () => {
    const command = {
      caseId: 1,
      expectedRevision: 0,
      method: "transfer",
      reference: "x".repeat(100),
      operationKey: "refund-reference-001",
    };
    expect(confirmSupplierRefundInput.safeParse(command).success).toBe(true);
    expect(
      confirmSupplierRefundInput.safeParse({
        ...command,
        reference: "x".repeat(101),
      }).success
    ).toBe(false);
  });
});
