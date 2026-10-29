import { describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";

vi.mock("../supplier-return-followup/runtime", async importOriginal => {
  const actual = await importOriginal<typeof import("../supplier-return-followup/runtime")>();
  return { ...actual, trialEnabled: async () => true };
});

import { runTrialCreatorCancellation, runTrialCreatorReplacement } from "../supplier-return-followup/creator-choice";

const actor = { id: 12, role: "operator" };
const choice = { caseId: 1, expectedRevision: 3, catalogItemId: 44, quantity: 2, operationKey: "creator-choice-001" };

function fixture() {
  let state: any = {
    record: { id: 1, returnId: 2, inventoryId: 3, purchaseOrderId: 4, purchaseOrderItemId: 5,
      creatorId: 12, delegateId: 10, returnedQuantity: "1.000", revision: 3,
      handoverStatus: "accepted", resolution: "change_item", creatorDecision: "pending",
      originalPurchaseValue: "100.0000", currency: "SAR", valuationBasis: "tax_inclusive", closedAt: null },
    plans: [], events: [],
    refundConfirmed: false,
  };
  let serial = Promise.resolve();
  const writes: string[] = [];
  let failEvent = false;
  const port = { transaction<T>(work: (tx: any) => Promise<T>) {
    const run = serial.then(async () => {
      const next = structuredClone(state);
      const result = await work({ async execute(query: any) {
        const { sql: text, params } = new MySqlDialect().sqlToQuery(query);
        if (text.startsWith("SELECT id,role,isActive FROM users")) return [[{ id: params[0], role: "operator", isActive: 1 }]];
        if (text.startsWith("SELECT * FROM supplier_return_cases")) return [[next.record]];
        if (text.startsWith("SELECT r.id,r.inventoryId")) return [[{ id: 2, inventoryId: 3, purchaseOrderId: 4,
          purchaseOrderItemId: 5, requestedById: 12, originalCatalogItemId: 33, sourceDeliveryDocumentId: null }]];
        if (text.startsWith("SELECT actorId,requestHash")) return [next.events.filter((event: any) => event.key === params[1])];
        if (text.startsWith("SELECT id,nameAr,unit,isActive FROM catalog_items")) return [[{ id: params[0], nameAr: "مصباح بديل", unit: "قطعة", isActive: 1 }]];
        if (text.startsWith("SELECT id FROM supplier_return_settlements")) return [next.refundConfirmed ? [{id:77}] : []];
        if (text.startsWith("SELECT id FROM supplier_return_replacement_plans")) return [next.plans];
        if (text.startsWith("INSERT INTO supplier_return_replacement_plans")) {
          writes.push(text); next.plans.push({ id: 100, caseId: params[0], catalogItemId: params[1], quantity: params[3] });
          return [{ insertId: 100 }];
        }
        if (text.startsWith("UPDATE supplier_return_cases")) {
          writes.push(text); next.record.creatorDecision = "replace"; next.record.revision = params[0];
          return [{ affectedRows: 1 }];
        }
        if (text.startsWith("INSERT INTO supplier_return_events")) {
          if (failEvent) throw Error("event failure");
          writes.push(text); next.events.push({ actorId: params[1], key: params[2], requestHash: params[3], result: params[8] });
          return [{ affectedRows: 1 }];
        }
        throw Error(`Unexpected query: ${text}`);
      } });
      state = next;
      return result;
    });
    serial = run.then(() => undefined, () => undefined);
    return run;
  } };
  return { port, state: () => state, writes, failEvent: () => { failEvent = true; } };
}

describe("supplier return creator replacement (isolated transaction)", () => {
  it("creates one plan for the original creator and replays the same command", async () => {
    const f = fixture();
    const first = await runTrialCreatorReplacement(actor, choice, f.port);
    expect(first).toEqual({ caseId: 1, planId: 100, revision: 4 });
    expect(f.state().events[0].key).toBe(choice.operationKey);
    expect(await runTrialCreatorReplacement(actor, choice, f.port)).toEqual(first);
    expect(f.state().plans).toHaveLength(1);
    expect(f.state().events).toHaveLength(1);
    expect(f.writes.some(text => /inventory_transactions|inventory_lots/.test(text))).toBe(false);
  });
  it("denies another requester and a different command with a reused key", async () => {
    const f = fixture();
    await expect(runTrialCreatorReplacement({ id: 13, role: "operator" }, choice, f.port)).rejects.toThrow("منشئ الطلب");
    await runTrialCreatorReplacement(actor, choice, f.port);
    await expect(runTrialCreatorReplacement(actor, { ...choice, quantity: 3 }, f.port)).rejects.toThrow("مفتاح العملية");
    expect(f.state().plans).toHaveLength(1);
  });
  it("does not accept the original catalog item as a different replacement", async () => {
    const f = fixture();
    await expect(runTrialCreatorReplacement(actor, { ...choice, catalogItemId: 33 }, f.port)).rejects.toThrow("مختلفًا");
    expect(f.state().plans).toHaveLength(0);
  });
  it("waits for confirmed cash refund before the creator selects a new item", async () => {
    const f = fixture();
    f.state().record.resolution = "refund";
    await expect(runTrialCreatorReplacement(actor, choice, f.port)).rejects.toThrow("لم يؤكد");
    f.state().refundConfirmed = true;
    expect(await runTrialCreatorReplacement(actor, choice, f.port)).toMatchObject({planId:100});
  });
  it("rolls back plan and decision when the event write fails", async () => {
    const f = fixture(); f.failEvent();
    await expect(runTrialCreatorReplacement(actor, choice, f.port)).rejects.toThrow("event failure");
    expect(f.state().plans).toHaveLength(0);
    expect(f.state().record.creatorDecision).toBe("pending");
  });
});

describe("refunded unlinked item cancellation", () => {
  function cancellationFixture(link: "none" | "ticket" | "pmv2" | "operational" = "none") {
    const writes: string[] = [];
    const tx: any = { async execute(query: any) {
      const { sql: text } = new MySqlDialect().sqlToQuery(query);
      if (text.startsWith("SELECT id,role,isActive FROM users")) return [[{ id: 12, role: "operator", isActive: 1 }]];
      if (text.startsWith("SELECT * FROM supplier_return_cases")) return [[{ id:1,returnId:2,inventoryId:3,purchaseOrderId:4,purchaseOrderItemId:5,
        creatorId:12,delegateId:10,returnedQuantity:1,revision:3,handoverStatus:"accepted",resolution:"refund",creatorDecision:"pending",closedAt:null }]];
      if (text.startsWith("SELECT p.id,p.requestedById")) return [[{ id:4,itemId:5,requestedById:12,ticketId:link === "ticket" ? 6 : null,ticketItemId:null }]];
      if (text.startsWith("SELECT actorId,requestHash")) return [[]];
      if (text.startsWith("SELECT id FROM supplier_return_settlements")) return [[{ id:77 }]];
      if (text.startsWith("SELECT id FROM supplier_return_replacement_plans")) return [[]];
      if (text.startsWith("SELECT TABLE_NAME AS name")) return [[{ name:"pmv2_material_purchase_links" },{name:"operational_issue_purchase_links"}]];
      if (text.startsWith("SELECT id FROM pmv2_material_purchase_links")) return [link === "pmv2" ? [{ id:99 }] : []];
      if (text.startsWith("SELECT 1 AS linked FROM operational_issue_purchase_links")) return [link === "operational" ? [{linked:1}] : []];
      if (/^(INSERT|UPDATE)/.test(text)) { writes.push(text); return [{ affectedRows:1 }]; }
      throw Error(text);
    } };
    return { port: { transaction: (work: any) => work(tx) }, writes };
  }
  const cancel = { caseId:1,expectedRevision:3,operationKey:"creator-cancel-001" };
  it("closes only follow-up when the refund is confirmed and no need is linked", async () => {
    const f = cancellationFixture();
    expect(await runTrialCreatorCancellation(actor,cancel,f.port)).toEqual({caseId:1,revision:4,decision:"cancel"});
    expect(f.writes.some(text => text.includes("UPDATE supplier_return_cases SET creatorDecision='cancel'"))).toBe(true);
    expect(f.writes.some(text => /UPDATE purchase_order_items|UPDATE inventory/.test(text))).toBe(false);
  });
  it.each(["ticket", "pmv2", "operational"] as const)("blocks cancellation of a %s linked item", async link => {
    const f = cancellationFixture(link);
    await expect(runTrialCreatorCancellation(actor,cancel,f.port)).rejects.toThrow("مرتبط");
    expect(f.writes).toHaveLength(0);
  });
  it("denies a different creator before any write", async () => {
    const f = cancellationFixture();
    await expect(runTrialCreatorCancellation({ id: 13, role: "operator" }, cancel, f.port)).rejects.toThrow("منشئ الطلب الأصلي");
    expect(f.writes).toHaveLength(0);
  });
});
