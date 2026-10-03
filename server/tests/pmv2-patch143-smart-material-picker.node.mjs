import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('inventory adapter exposes read-only Team-Warehouse stocked Catalog identities', async () => {
  const contracts = await read('server/pmv2/adapters/contracts.ts');
  const adapter = await read('server/pmv2/adapters/current-system.ts');
  assert.match(contracts, /listAvailableCatalogItemIds\(/);
  assert.match(adapter, /async listAvailableCatalogItemIds\(warehouseId, limit = 120\)/);
  assert.match(adapter, /eq\(inventory\.warehouseId, warehouseId\)/);
  assert.match(adapter, /gt\(inventoryLotBalances\.quantity, "0"\)/);
  assert.match(adapter, /gt\(inventory\.quantity, "0"\)/);
});

test('smart default uses real PM V2 usage history and current Team-Warehouse stock', async () => {
  const service = await read('server/pmv2/materials/request-service.ts');
  assert.match(service, /pmv2MaterialUsages/);
  assert.match(service, /eq\(pmv2Tasks\.teamId, context\.teamId\)/);
  assert.match(service, /Number\(row\.programTargetId\) === Number\(context\.programTargetId\)/);
  assert.match(service, /currentInventoryAdapter\.listAvailableCatalogItemIds\(context\.teamWarehouseId, 120\)/);
  assert.match(service, /inTeamStock \? 100000 : 0/);
  assert.match(service, /sameTargetUseCount > 0 \? 50000 : 0/);
  assert.match(service, /teamUseCount > 0 \? 30000 : 0/);
});

test('full Catalog search remains available and is enriched rather than hard-filtered', async () => {
  const service = await read('server/pmv2/materials/request-service.ts');
  assert.match(service, /currentCatalogAdapter\.searchActiveItems\(term, 50\)/);
  assert.match(service, /currentCatalogAdapter\.getItemsByIds\(candidateIds\)/);
  assert.match(service, /textScore\(item\)/);
  assert.doesNotMatch(service, /pmv2Specialties|specialtyCatalog|catalogSpecialty/i);
});

test('picker exposes stock/history priority, taxonomy path and full-Catalog search copy', async () => {
  const ui = await read('client/src/pages/pmv2/Pmv2MyTasks.tsx');
  assert.match(ui, /اقتراحات ذكية — مخزن الفريق أولًا/);
  assert.match(ui, /نتائج البحث في كامل الدليل/);
  assert.match(ui, /متوفر في مخزن الفريق/);
  assert.match(ui, /استخدم سابقًا لهذا الهدف/);
  assert.match(ui, /استخدمه الفريق سابقًا/);
  assert.match(ui, /التصنيف: \{item\.categoryPathAr\}/);
  assert.match(ui, /البحث في كامل الدليل بالاسم أو الكود/);
});

test('existing duplicate-state protections remain in the picker', async () => {
  const ui = await read('client/src/pages/pmv2/Pmv2MyTasks.tsx');
  assert.match(ui, /activeCatalogRequestIds/);
  assert.match(ui, /readyCatalogItemIds/);
  assert.match(ui, /blockedCatalogItemIds/);
  assert.match(ui, /مطلوب بالفعل/);
  assert.match(ui, /جاهز للاستلام/);
});
