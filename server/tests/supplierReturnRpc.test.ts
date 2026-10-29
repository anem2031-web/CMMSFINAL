import { it, expect, vi } from "vitest";
const calls = vi.hoisted(() => ({ status: vi.fn(async () => ({ enabled: true })), create: vi.fn(async () => ({ caseId: 1, returnId: 2 })), preview: vi.fn(async () => ({ originalPurchaseValue: "300.0000" })) }));
vi.mock("../supplier-return-followup/creator-choice", async original => {
  const actual = await original<any>();
  return { ...actual, runTrialCreatorReplacement: vi.fn(async () => ({ caseId: 1, planId: 2, revision: 3 })),
    runTrialCreatorCancellation: vi.fn(async () => ({ caseId: 1, revision: 3, decision: "cancel" })) };
});
vi.mock("../supplier-return-followup/refund", async original => {
  const actual = await original<any>();
  return { ...actual, confirmSupplierRefund: vi.fn(async () => ({ caseId: 1, revision: 3, amount: "100.0000", method: "cash" })) };
});
vi.mock("../supplier-return-followup/runtime", async original => {
  const actual = await original<any>();
  return { ...actual, trialPort: async () => ({}), supplierReturnStatus: calls.status, createTrialReturn: calls.create, supplierReturnValuePreview: calls.preview };
});
import { router } from "../_core/trpc";
import { supplierReturnsRouter } from "../routers/inventory/supplier-returns.router";
const api = router({ supplierReturns: supplierReturnsRouter });
const caller = (role: string) => api.createCaller({ user: { id: 10, role, isActive: 1 } } as any).supplierReturns;
const previewRequest = { warehouseId: 4, trackingToken: "LOT-31", returnedQuantity: 3 };
it.each(["warehouse", "admin", "owner"])("allows explicit %s value-preview RPC", async role => {
  expect(await caller(role).valuePreview(previewRequest)).toEqual({ originalPurchaseValue: "300.0000" });
});
it.each(["delegate", "accountant", "senior_management", "technician", "it_member", "maintenance_manager", "observer", "gate_security"])("denies direct %s value-preview RPC", async role => {
  await expect(caller(role).valuePreview(previewRequest)).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it.each(["delegate", "warehouse", "admin", "owner", "accountant", "senior_management", "maintenance_manager", "operator", "purchase_requester"])("allows reviewed %s status RPC", async role => {
  expect(await caller(role).status()).toEqual({ enabled: true });
});
it.each(["observer", "gate_security", "technician"])("denies direct %s RPC", async role => {
  await expect(caller(role).status()).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("delegate cannot call the warehouse creation RPC", async () => {
  const request = { operationKey: "creation-operation-test", trackingToken: "LOT-TEST", warehouseId: 1, delegateId: 10, returnedQuantity: 1, reason: "تالف" };
  await expect(caller("delegate").create(request)).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(await caller("warehouse").create(request)).toEqual({ caseId: 1, returnId: 2 });
});
it("creator choice has a distinct RPC while unrelated roles remain denied", async () => {
  const choice = { caseId: 1, expectedRevision: 2, catalogItemId: 5, quantity: 1, operationKey: "creator-choice-0001" };
  expect(await caller("accountant").chooseReplacement(choice)).toEqual({ caseId: 1, planId: 2, revision: 3 });
  await expect(caller("gate_security").chooseReplacement(choice)).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(caller("delegate").create({ operationKey: "creation-operation-test", trackingToken: "LOT-TEST", warehouseId: 1, delegateId: 10, returnedQuantity: 1, reason: "تالف" })).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("allows the delegate refund confirmation RPC but denies unrelated roles", async () => {
  const input = {caseId:1,expectedRevision:2,method:"cash" as const,reference:"REF-001",operationKey:"refund-confirmation-001"};
  expect(await caller("delegate").confirmRefund(input)).toMatchObject({caseId:1,amount:"100.0000"});
  await expect(caller("operator").confirmRefund(input)).rejects.toMatchObject({code:"FORBIDDEN"});
});
it("exposes cancellation only through the guarded business RPC", async () => {
  const input = { caseId:1,expectedRevision:2,operationKey:"creator-cancel-0001" };
  expect(await caller("accountant").cancelAfterRefund(input)).toMatchObject({ decision:"cancel" });
  await expect(caller("gate_security").cancelAfterRefund(input)).rejects.toMatchObject({ code:"FORBIDDEN" });
});
