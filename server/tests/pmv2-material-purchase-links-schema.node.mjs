import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  new URL('../../drizzle/2026_09_08_pmv2_material_purchase_links.sql', import.meta.url),
  'utf8',
);
const validation = readFileSync(
  new URL('../pmv2/materials/purchase-link-validation.ts', import.meta.url),
  'utf8',
);

test('purchase link belongs internally to one material request item', () => {
  assert.match(sql, /FOREIGN KEY \(`materialRequestItemId`\)/);
  assert.match(sql, /REFERENCES `pmv2_material_request_items` \(`id`\)/);
});

test('purchase order, purchase order item, and creator remain indexed external references without physical FKs', () => {
  assert.match(sql, /KEY `idx_pmv2_material_purchase_links_purchase_order` \(`purchaseOrderId`\)/);
  assert.match(sql, /KEY `idx_pmv2_material_purchase_links_created_by` \(`createdById`\)/);
  assert.doesNotMatch(sql, /FOREIGN KEY \(`purchaseOrderId`\)/);
  assert.doesNotMatch(sql, /FOREIGN KEY \(`purchaseOrderItemId`\)/);
  assert.doesNotMatch(sql, /FOREIGN KEY \(`createdById`\)/);
  assert.doesNotMatch(sql, /REFERENCES `purchase_orders`|REFERENCES `purchase_order_items`|REFERENCES `users`/);
});

test('one existing purchase order item cannot ambiguously represent multiple PM V2 source links', () => {
  assert.match(sql, /UNIQUE KEY `uq_pmv2_material_purchase_links_po_item` \(`purchaseOrderItemId`\)/);
  assert.match(
    sql,
    /UNIQUE KEY `uq_pmv2_material_purchase_links_request_po_item`\s*\(`materialRequestItemId`, `purchaseOrderItemId`\)/,
  );
});

test('linked quantity uses decimal precision and no ineffective TiDB CHECK constraint', () => {
  assert.match(sql, /`linkedQuantity` DECIMAL\(12,3\) NOT NULL/);
  assert.doesNotMatch(sql, /\bCHECK\s*\(/);
});

test('write-boundary validation owns positive and allocation quantity rules', () => {
  assert.match(validation, /linkedQuantity/);
  assert.match(validation, /requestedQuantity/);
  assert.match(validation, /alreadyLinkedQuantity \+ linkedQuantity > requestedQuantity/);
});

test('purchase workflow ownership remains outside PM V2 schema foundation', () => {
  assert.doesNotMatch(sql, /`status`/);
  assert.doesNotMatch(validation, /INSERT INTO `?purchase_orders|UPDATE `?purchase_orders|INSERT INTO `?purchase_order_items|UPDATE `?purchase_order_items/);
  assert.match(validation, /Purchase Adapter/);
});
