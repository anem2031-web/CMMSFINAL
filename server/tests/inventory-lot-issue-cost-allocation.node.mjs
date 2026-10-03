import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");

const schema = read("drizzle/schema.ts");
const lots = read("server/_core/inventory-lots.ts");
const core = read("server/_core/db/warehouse-returns.ts");
const inputSchema = read("server/routers/inventory/issue-cost-allocation.schema.ts");
const inventoryRouter = read("server/routers/inventory/inventory.router.ts");
const purchaseRouter = read("server/routers/purchase/purchase-orders.router.ts");
const editor = read("client/src/components/inventory/IssueCostAllocationEditor.tsx");
const inventoryUi = read("client/src/pages/inventory/Inventory.tsx");
const purchaseUi = read("client/src/pages/purchase/PurchaseCycle.tsx");

assert.match(schema, /inventoryIssueCostAllocations = mysqlTable\("inventory_issue_cost_allocations"/);
assert.match(schema, /index\("idx_issue_cost_tx"\)/);
assert.doesNotMatch(schema, /uniqueIndex\([^\n]*issue_cost_tx/);

assert.match(lots, /issueUnitCost: inventoryLots\.issueUnitCost/);
assert.match(inventoryRouter, /issueUnitCost: Number\(lot\.issueUnitCost \|\| 0\)/);

// Runtime contract: one beneficiary per delivery, site+section required, asset optional.
assert.match(inputSchema, /beneficiarySiteId: z\.number\(\)\.int\(\)\.positive\("الموقع مطلوب"\)/);
assert.match(inputSchema, /beneficiarySectionId: z\.number\(\)\.int\(\)\.positive\("القسم مطلوب"\)/);
assert.match(inputSchema, /beneficiaryAssetId: z\.number\(\)\.int\(\)\.positive\(\)\.nullable\(\)\.optional\(\)/);
assert.match(inputSchema, /\.length\(1, "كل عملية صرف يجب أن تُحمّل على جهة مستفيدة واحدة فقط"\)/);

assert.match(core, /allocations\.length !== 1/);
assert.match(core, /القسم المستفيد مطلوب/);
assert.match(core, /quantity !== deliveryQuantity/);
assert.match(core, /القسم المستفيد لا يتبع الموقع المحدد/);
assert.match(core, /الأصل المستفيد لا يتبع القسم المحدد/);
assert.match(core, /tx\.insert\(inventoryIssueCostAllocations\)/);
assert.match(core, /lotIssueUnitCostSnapshot\.toFixed\(4\)/);
assert.match(core, /calculateMovementTotal\(allocation\.quantity, lotIssueUnitCostSnapshot\)/);

// Existing inventory accounting movement remains on averageCost.
assert.match(core, /const deliveryUnitCost = parseFloat\(\(item as any\)\.averageCost \|\| "0"\)/);

// Every live delivery route accepts and forwards the attribution layer.
assert.match(inventoryRouter, /costAllocations: issueCostAllocationsSchema\.optional\(\)/);
assert.match(inventoryRouter, /costAllocations: input\.costAllocations/);
assert.equal((purchaseRouter.match(/costAllocations: issueCostAllocationsSchema\.optional\(\)/g) || []).length, 2);
assert.equal((purchaseRouter.match(/costAllocations: input\.costAllocations/g) || []).length, 2);

// Manager UI is intentionally simple: one vertically stacked beneficiary, no split button.
assert.doesNotMatch(editor, /إضافة جهة أخرى/);
assert.doesNotMatch(editor, /الجهة \{index \+ 1\}/);
assert.match(editor, /الموقع \*/);
assert.match(editor, /القسم \*/);
assert.match(editor, /الأصل \(اختياري\)/);
assert.match(editor, /اختر الموقع أولًا/);
assert.match(editor, /اختر القسم أولًا/);
assert.match(editor, /تكلفة الصرف لهذه الجهة/);
assert.match(editor, /beneficiarySectionId: sectionId/);
assert.match(editor, /quantity,/);
assert.match(inventoryUi, /buildIssueCostAllocationPayload\(deliverCostAllocations, qty\)/);
assert.match(purchaseUi, /buildIssueCostAllocationPayload\(deliveryCostAllocations, qty\)/);

console.log("PASS inventory lot issue cost allocation single-beneficiary regression");
