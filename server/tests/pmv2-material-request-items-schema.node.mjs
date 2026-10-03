import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../drizzle/2026_09_08_pmv2_material_request_items.sql', import.meta.url), 'utf8');
const validation = readFileSync(new URL('../pmv2/materials/request-item-validation.ts', import.meta.url), 'utf8');

test('material request item belongs to material request through an internal PM V2 FK', () => {
  assert.match(sql, /FOREIGN KEY \(`requestId`\)/);
  assert.match(sql, /REFERENCES `pmv2_material_requests` \(`id`\)/);
});

test('catalog item remains an indexed external reference without a physical FK', () => {
  assert.match(sql, /KEY `idx_pmv2_material_request_items_catalog_item` \(`catalogItemId`\)/);
  assert.doesNotMatch(sql, /FOREIGN KEY \(`catalogItemId`\)/);
  assert.doesNotMatch(sql, /REFERENCES `catalog_items`/);
});

test('material request item freezes the six approved domain states', () => {
  for (const state of ['waiting_warehouse','external_purchase','received_warehouse','issued_to_team','consumed','cancelled']) {
    assert.match(sql, new RegExp(`'${state}'`));
  }
});

test('requested and projected quantities use decimal precision and no ineffective CHECK constraints', () => {
  assert.match(sql, /`requestedQuantity` DECIMAL\(12,3\) NOT NULL/);
  assert.match(sql, /`receivedWarehouseQuantity` DECIMAL\(12,3\) NOT NULL DEFAULT 0\.000/);
  assert.match(sql, /`issuedToTeamQuantity` DECIMAL\(12,3\) NOT NULL DEFAULT 0\.000/);
  assert.doesNotMatch(sql, /\bCHECK\s*\(/);
});

test('application validation explicitly owns positive/non-negative quantity invariants in current TiDB', () => {
  assert.match(validation, /requestedQuantity/);
  assert.match(validation, /numberValue <= 0/);
  assert.match(validation, /receivedWarehouseQuantity/);
  assert.match(validation, /issuedToTeamQuantity/);
  assert.match(validation, /numberValue < 0/);
});

test('schema foundation does not perform stock or purchase workflow writes', () => {
  assert.doesNotMatch(sql, /inventory_transactions|purchase_orders|purchase_order_items/);
  assert.doesNotMatch(validation, /INSERT INTO|UPDATE inventory|UPDATE purchase/);
});
