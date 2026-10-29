import { it, expect } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { createSupplierReturnOnce, type NewReturnRequest } from "../supplier-return-followup/create-once";
import type { FollowupPort } from "../supplier-return-followup/commands";

const actor = { id: 1, role: "warehouse" };
const input: NewReturnRequest = { operationKey: "creation-test-0001", trackingToken: "LOT-TEST", warehouseId: 1, delegateId: 2, returnedQuantity: 2, reason: "تالف" };
function fixture() {
  let state: any = { quantity: 10, record: null, active: true, delegateActive: true };
  let serial: Promise<any> = Promise.resolve();
  let working: any;
  let fail = false;
  const port: FollowupPort = { transaction(work) {
    const run = serial.then(async () => {
      working = structuredClone(state);
      const result = await work({ async execute(query) {
        const q = new MySqlDialect().sqlToQuery(query);
        if (q.sql.includes("FROM users")) return [[{ id: q.params[0], role: q.params[0] === 1 ? "warehouse" : "delegate", isActive: (q.params[0] === 1 ? working.active : working.delegateActive) ? 1 : 0 }]];
        if (q.sql.includes("FROM supplier_return_cases")) return [working.record ? [working.record] : []];
        throw Error("Unexpected creation query");
      } });
      state = working;
      return result;
    });
    serial = run.catch(() => {});
    return run;
  } };
  const writer: Parameters<typeof createSupplierReturnOnce>[3] = async (_tx, request, metadata) => {
    working.quantity -= request.returnedQuantity;
    if (fail) throw Error("insert failed");
    working.record = { id: 5, returnId: 6, ...metadata };
    return { caseId: 5, returnId: 6 };
  };
  return { port, writer, state: () => state, fail: () => { fail = true; }, deactivate: () => { state.active = false; }, disableDelegate: () => { state.delegateActive = false; } };
}
it("concurrent creation retry deducts stock only once", async () => {
  const f = fixture();
  const result = await Promise.all([createSupplierReturnOnce(f.port, actor, input, f.writer), createSupplierReturnOnce(f.port, actor, input, f.writer)]);
  expect(result[0]).toEqual(result[1]); expect(f.state().quantity).toBe(8);
});
it("creation failure rolls back stock", async () => {
  const f = fixture(); f.fail();
  await expect(createSupplierReturnOnce(f.port, actor, input, f.writer)).rejects.toThrow("insert failed");
  expect(f.state().quantity).toBe(10); expect(f.state().record).toBeNull();
});
it("same creation key cannot change quantity", async () => {
  const f = fixture(); await createSupplierReturnOnce(f.port, actor, input, f.writer);
  await expect(createSupplierReturnOnce(f.port, actor, { ...input, returnedQuantity: 3 }, f.writer)).rejects.toThrow("مفتاح إنشاء");
  expect(f.state().quantity).toBe(8);
});
it("replay rechecks current identity", async () => {
  const f = fixture(); await createSupplierReturnOnce(f.port, actor, input, f.writer); f.deactivate();
  await expect(createSupplierReturnOnce(f.port, actor, input, f.writer)).rejects.toThrow("الحساب");
});
it("inactive delegate cannot receive a new return", async () => {
  const f = fixture(); f.disableDelegate();
  await expect(createSupplierReturnOnce(f.port, actor, input, f.writer)).rejects.toThrow("المندوب");
  expect(f.state().quantity).toBe(10);
});
it("a writer omitting the creation record cannot commit", async () => {
  const f = fixture();
  await expect(createSupplierReturnOnce(f.port, actor, input, async () => ({ caseId: 5, returnId: 6 }))).rejects.toThrow("atomic creation key");
  expect(f.state().quantity).toBe(10);
});
