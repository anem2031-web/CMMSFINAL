import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  new URL('../../drizzle/2026_09_08_pmv2_material_usages.sql', import.meta.url),
  'utf8',
);

test('material usage belongs internally to one task item and visit', () => {
  assert.match(sql, /FOREIGN KEY \(`taskItemId`\)/);
  assert.match(sql, /REFERENCES `pmv2_task_items` \(`id`\)/);
  assert.match(sql, /FOREIGN KEY \(`visitId`\)/);
  assert.match(sql, /REFERENCES `pmv2_visits` \(`id`\)/);
});

test('material request item link is internal and nullable for team-stock usage', () => {
  assert.match(sql, /`materialRequestItemId` INT NULL/);
  assert.match(sql, /FOREIGN KEY \(`materialRequestItemId`\)/);
  assert.match(sql, /REFERENCES `pmv2_material_request_items` \(`id`\)/);
});

test('current inventory and delivery references stay external and indexed', () => {
  for (const indexName of [
    'idx_pmv2_material_usages_warehouse',
    'idx_pmv2_material_usages_catalog_item',
    'idx_pmv2_material_usages_inventory_tx',
    'idx_pmv2_material_usages_inventory_lot',
    'idx_pmv2_material_usages_delivery_document',
    'idx_pmv2_material_usages_po_item',
    'idx_pmv2_material_usages_recorded_by',
  ]) {
    assert.ok(sql.includes(`KEY \`${indexName}\``));
  }
  assert.doesNotMatch(sql, /REFERENCES `(warehouses|catalog_items|inventory_transactions|inventory_lots|delivery_documents|purchase_order_items|users)`/);
});

test('usage quantity is stored as a positive-domain decimal without ineffective TiDB CHECK', () => {
  assert.match(sql, /`usedQuantity` DECIMAL\(12,3\) NOT NULL/);
  assert.doesNotMatch(sql, /\bCHECK\s*\(/);
});

test('material usage table is trace only and carries no stock balance or workflow status', () => {
  assert.doesNotMatch(sql, /`status`/);
  assert.doesNotMatch(sql, /stockBalance|stock_balance|onHand|on_hand/);
});
