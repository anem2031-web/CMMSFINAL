import { describe, it, expect, vi, beforeEach } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
const state = vi.hoisted(() => ({
  name: "copycmms2",
  queries: [] as string[],
  links: [] as any[],
  receipts: [] as any[],
  deliveries: [] as any[],
  fail: false,
}));
vi.mock("../_core/db/client", () => ({
  getDb: async () => ({
    execute: async (query: any) => {
      if (state.fail) throw Error("database unavailable");
      const text = new MySqlDialect().sqlToQuery(query).sql;
      state.queries.push(text);
      if (text.startsWith("SELECT DATABASE"))
        return [[{ databaseName: state.name }]];
      if (text.includes("FROM supplier_return_cases c")) return [state.links];
      if (text.includes("FROM inventory_lots l")) return [state.receipts];
      if (text.includes("FROM delivery_documents d")) return [state.deliveries];
      throw Error(text);
    },
  }),
}));
import { activePathBItemsAfterReplacement } from "../supplier-return-followup/path-b-replacement";
import { replacementNeedCoverage } from "../supplier-return-followup/need-coverage";
const source = { id: 10, purchaseOrderId: 1, status: "delivered_to_warehouse" };
const child = { id: 20, purchaseOrderId: 2, status: "delivered_to_requester" };
const receipts = [
  { itemId: 10, quantity: "10", unit: "حبة" },
  { itemId: 20, quantity: "2", unit: "كرتون" },
];
const link = {
  sourceItemId: 10,
  replacementItemId: 20,
  quantityCovered: "2",
  originalUnit: "حبة",
  received: true,
};
beforeEach(() => {
  state.name = "copycmms2";
  state.queries = [];
  state.links = [];
  state.receipts = [];
  state.deliveries = [];
  state.fail = false;
});
describe("quantity-based replacement fulfillment", () => {
  it("keeps a partially returned need blocked until both remaining stock and the alternative are delivered", () => {
    expect(
      replacementNeedCoverage(
        receipts,
        [
          { itemId: 10, quantity: "7", unit: "حبة" },
          { itemId: 20, quantity: "2", unit: "كرتون" },
        ],
        [link]
      ).get(10)
    ).toBe(false);
    expect(
      replacementNeedCoverage(
        receipts,
        [
          { itemId: 10, quantity: "8", unit: "حبة" },
          { itemId: 20, quantity: "2", unit: "كرتون" },
        ],
        [link]
      ).get(10)
    ).toBe(true);
  });
  it("requires physical delivery of a full replacement", () => {
    expect(
      replacementNeedCoverage(
        receipts,
        [],
        [{ ...link, quantityCovered: "10" }]
      ).get(10)
    ).toBe(false);
    expect(
      replacementNeedCoverage(
        receipts,
        [{ itemId: 20, quantity: "2", unit: "كرتون" }],
        [{ ...link, quantityCovered: "10" }]
      ).get(10)
    ).toBe(true);
  });
  it("does not count an unreceived replacement or mismatched original unit", () => {
    const delivery = [{ itemId: 20, quantity: "2", unit: "كرتون" }];
    expect(
      replacementNeedCoverage(receipts, delivery, [
        { ...link, quantityCovered: "10", received: false },
      ]).get(10)
    ).toBe(false);
    expect(
      replacementNeedCoverage(receipts, delivery, [
        { ...link, quantityCovered: "10", originalUnit: "علبة" },
      ]).get(10)
    ).toBe(false);
  });
  it("cannot mark a partially delivered replacement complete", () => {
    const result = replacementNeedCoverage(
      receipts,
      [
        { itemId: 10, quantity: "8", unit: "حبة" },
        { itemId: 20, quantity: "1", unit: "كرتون" },
      ],
      [link]
    );
    expect(result.get(10)).toBe(false);
    expect(result.get(20)).toBe(false);
  });
  it("counts multiple replacements without changing the original unit", () => {
    const result = replacementNeedCoverage(
      [...receipts, { itemId: 30, quantity: "1", unit: "قطعة" }],
      [
        { itemId: 20, quantity: "2", unit: "كرتون" },
        { itemId: 30, quantity: "1", unit: "قطعة" },
      ],
      [
        { ...link, quantityCovered: "6" },
        { ...link, replacementItemId: 30, quantityCovered: "4" },
      ]
    );
    expect(result.get(10)).toBe(true);
  });
  it("detects invalid cyclic provenance and invalid quantities", () => {
    expect(() =>
      replacementNeedCoverage(
        receipts,
        [],
        [
          link,
          {
            ...link,
            sourceItemId: 20,
            replacementItemId: 10,
            originalUnit: "كرتون",
          },
        ]
      )
    ).toThrow("Cyclic");
    expect(() =>
      replacementNeedCoverage(
        receipts,
        [{ itemId: 10, quantity: "-1", unit: "حبة" }],
        [link]
      )
    ).toThrow();
  });
  it("keeps ordinary orders unchanged and bounds reads by chunks", async () => {
    const items = Array.from({ length: 1200 }, (_, i) => ({
      ...source,
      id: i + 1,
    }));
    expect(await activePathBItemsAfterReplacement(items)).toEqual(items);
    expect(state.queries).toHaveLength(4);
  });
  it("updates only the derived status and preserves terminal items", async () => {
    state.links = [
      {
        sourceItemId: 10,
        replacementItemId: 20,
        originalQuantityCovered: "10",
        returnedUnit: "حبة",
        replacementStatus: "received",
      },
    ];
    state.receipts = receipts;
    state.deliveries = [{ itemId: 20, quantity: "2", unit: "كرتون" }];
    expect(await activePathBItemsAfterReplacement([source, child])).toEqual([
      { ...source, status: "delivered_to_requester" },
      child,
    ]);
    expect(
      (
        await activePathBItemsAfterReplacement([
          { ...source, status: "rejected" },
          child,
        ])
      )[0].status
    ).toBe("rejected");
  });
  it("does not treat a database failure as an ordinary incomplete need", async () => {
    state.fail = true;
    await expect(activePathBItemsAfterReplacement([source])).rejects.toThrow(
      "database unavailable"
    );
  });
  it("requires production enablement and uses independent snapshots", async () => {
    state.name = "cmms";
    vi.stubEnv("SUPPLIER_RETURN_FOLLOWUP_ENABLED", "false");
    try {
      expect(await activePathBItemsAfterReplacement([source, child])).toEqual([
        source,
        child,
      ]);
      expect(state.queries).toHaveLength(1);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
