import { expect, it } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { prepareReplacementPurchase } from "../supplier-return-followup/purchase-bridge";

const actor = { id: 9, role: "admin", isActive: 1 };
const replacement = { catalogItemId: 1140037, itemName: "قفازات اختبار", quantity: 1, unit: "كيس", siteId: 5, sectionId: 8, categoryId: 12 };
function fixture(recorded: Record<string, number | null> = {}) {
  const plan = {
    id: 1, caseId: 7, status: "pending_review", purchaseOrderId: null, purchaseOrderItemId: null,
    creatorId: 2, requestedById: 2, originalQuantityCovered: "1", returnedQuantity: "1",
    handoverStatus: "accepted", resolution: "same_item", creatorDecision: null,
    originalPurchaseValue: "14.7200", currency: "SAR", valuationBasis: "tax_inclusive",
    catalogItemId: 1140037, itemName: "قفازات اختبار", replacementQuantity: "1", replacementUnit: "كيس",
    originalOrderId: 22, originalTicketId: null, originalTicketItemId: null,
    originalSiteId: null, originalSectionId: null, originalCategoryId: null, originalAssetId: null,
    originalItemSiteId: null, originalItemSectionId: null, originalItemCategoryId: null, originalItemAssetId: null,
    ...recorded,
  };
  const tx: any = { execute: async (statement: any) => {
    const query = new MySqlDialect().sqlToQuery(statement).sql.replace(/\s+/g, " ");
    if (query.includes("SELECT DATABASE()")) return [[{ databaseName: "copycmms2" }]];
    if (query.includes("FROM users")) return [[{ id: 9, role: "admin", isActive: 1 }]];
    if (query.includes("FROM supplier_return_replacement_plans p")) return [[plan]];
    if (query.includes("FROM supplier_return_settlements")) return [[{ id: 10, amount: "14.7200", currency: "SAR", valuationBasis: "tax_inclusive" }]];
    throw Error(`Unexpected query: ${query}`);
  } };
  const input = { ticketId: null, ticketItemId: null, items: [replacement], context: { siteId: 5, sectionId: 8, categoryId: 12, assetId: null } };
  return { tx, input };
}

it("fills missing historical purchase context only on the replacement order", async () => {
  const { tx, input } = fixture();
  await expect(prepareReplacementPurchase(tx, actor, 1, input)).resolves.toMatchObject({ planId: 1, originalOrderId: 22 });
});

it("still rejects changing a recorded source location or item category", async () => {
  const location = fixture({ originalSiteId: 3 });
  await expect(prepareReplacementPurchase(location.tx, actor, 1, location.input)).rejects.toThrow("سياق طلب التعويض");
  const category = fixture({ originalItemCategoryId: 44 });
  await expect(prepareReplacementPurchase(category.tx, actor, 1, category.input)).rejects.toThrow("تصنيف صنف البديل");
});
