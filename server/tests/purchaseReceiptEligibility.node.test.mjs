// Run: node --import tsx --test server/tests/purchaseReceiptEligibility.node.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { router } from '../routers/_shared/procedures.ts';
import { createPurchaseReceiptContextProcedure } from '../routers/inventory/purchaseReceiptContext.procedure.ts';
import { eligiblePurchaseReceiptItems, getPurchaseReceiptContext, validatePurchaseReceiptSelection, lockAndValidatePurchaseReceiptItems } from '../services/inventory/purchaseReceiptEligibility.ts';
import { isPOVisible } from '../_core/authz/engine.ts';

const poId = 3600147;
const wood = { id: 3570419, purchaseOrderId: poId, itemName: 'خشب ماهوجني', status: 'delivered_to_warehouse', supplierInvoiceNumber: '328652', quantity: 5 };
const lock = { id: 3570398, purchaseOrderId: poId, itemName: 'قفل', status: 'approved' };
const dialect = new MySqlDialect();
function database(responses) {
  const calls = [];
  return {
    calls,
    select(fields) {
      const result = responses[calls.length];
      const call = { fields: Object.keys(fields), locks: [], where: null, joins: [] }; calls.push(call);
      const q = {
        from() { return q; },
        innerJoin(table, condition) { call.joins.push(dialect.sqlToQuery(condition)); return q; },
        where(condition) { call.where = dialect.sqlToQuery(condition); return q; },
        limit() { return q; }, orderBy() { return q; },
        for(mode) { call.locks.push(mode); return q; },
        then(resolve, reject) { return Promise.resolve(typeof result === 'function' ? result(call) : result).then(resolve, reject); },
      };
      return q;
    },
  };
}
function api(db) { return router({ context: createPurchaseReceiptContextProcedure(async () => db) }); }
function caller(db, role) { return api(db).createCaller({ user: role ? { id: 9090247, role } : null }); }

test('448: warehouse opens receipt context while general PO visibility still denies approved', async () => {
  assert.equal(isPOVisible({ role: 'warehouse', userId: 9090247 }, { id: poId, status: 'approved', requestedById: 3390036 }), false);
  const db = database([[{ id: poId, poNumber: 'PR-2026-0448' }], [wood], []]);
  const result = await caller(db, 'warehouse').context({ purchaseOrderId: poId, invoiceNumber: '328652' });
  assert.deepEqual(result.items, [wood]);
  assert.deepEqual(Object.keys(result).sort(), ['id', 'items', 'poNumber']);
  assert.deepEqual(db.calls[1].where.params, [poId, 'delivered_to_warehouse']);
  assert.deepEqual(db.calls[2].where.params, [poId, 'confirmed']);
  assert.ok(!db.calls[0].fields.includes('managementNotes'));
  assert.ok(!db.calls[1].fields.includes('notes'));
});
for (const role of ['admin', 'owner']) test(`${role} retains operational receipt access`, async () => {
  const result = await caller(database([[{ id: poId, poNumber: 'PR-2026-0448' }], [wood], []]), role).context({ purchaseOrderId: poId });
  assert.equal(result.items.length, 1);
});
for (const role of ['delegate', 'accountant', 'technician', null]) test(`${role ?? 'anonymous'} cannot call receipt context`, async () => {
  const db = database([]);
  await assert.rejects(caller(db, role).context({ purchaseOrderId: poId }), e => e.code === (role ? 'FORBIDDEN' : 'UNAUTHORIZED'));
  assert.equal(db.calls.length, 0);
});
test('unknown order and database failure are explicit errors', async () => {
  await assert.rejects(caller(database([[]]), 'warehouse').context({ purchaseOrderId: poId }), e => e.code === 'NOT_FOUND');
  await assert.rejects(caller(null, 'warehouse').context({ purchaseOrderId: poId }), e => e.code === 'INTERNAL_SERVER_ERROR');
});
test('invalid PO ids are rejected before database access', async () => {
  const db = database([]);
  for (const id of [0, -1, 1.5]) await assert.rejects(caller(db, 'warehouse').context({ purchaseOrderId: id }), e => e.code === 'BAD_REQUEST');
  assert.equal(db.calls.length, 0);
});
test('only delivered, unconfirmed items for the chosen invoice are returned', () => {
  const otherInvoice = { ...wood, id: 3, supplierInvoiceNumber: 'other' };
  const completed = { ...wood, id: 4 };
  const cancelled = { ...wood, id: 5, status: 'cancelled' };
  assert.deepEqual(eligiblePurchaseReceiptItems([wood, lock, otherInvoice, completed, cancelled], [4], '328652'), [wood]);
});
test('258: confirmed receipt excludes old wood; draft/rejected receipts do not count as confirmed', async () => {
  const old = { ...wood, id: 3510056, purchaseOrderId: 3540022 };
  const db = database([[{ id: 3540022, poNumber: 'PR-2026-0258' }], [old], [{ itemId: old.id }]]);
  assert.deepEqual((await getPurchaseReceiptContext(db, 3540022)).items, []);
  assert.ok(db.calls[2].where.params.includes('confirmed'));
  assert.deepEqual(eligiblePurchaseReceiptItems([old], []), [old]);
});
test('488 eligibility remains unchanged when a later batch changes only parent status', () => {
  const first = { ...wood, id: 3570520, purchaseOrderId: 3600202, supplierInvoiceNumber: '0030' };
  const second = { ...lock, id: 3570521, purchaseOrderId: 3600202 };
  for (const parentStatus of ['partial_purchase', 'pending_accounting', 'pending_management', 'approved']) {
    assert.deepEqual(eligiblePurchaseReceiptItems([first, second], [], '0030'), [first], parentStatus);
  }
});
test('empty and missing-invoice scopes end as an empty result, not an error or pending promise', async () => {
  assert.deepEqual((await getPurchaseReceiptContext(database([[{ id: poId }], [], []]), poId)).items, []);
  assert.deepEqual(eligiblePurchaseReceiptItems([wood], [], 'missing'), []);
  assert.equal(eligiblePurchaseReceiptItems([{ ...wood, supplierInvoiceNumber: null }], [], 'بدون رقم فاتورة').length, 1);
});
test('save rejects wrong-order, non-delivered, completed, duplicate and unlinked-only selections', () => {
  for (const current of [[], [lock], [{ ...wood, purchaseOrderId: 1 }], [{ ...wood, status: 'cancelled' }]]) {
    assert.throws(() => validatePurchaseReceiptSelection(poId, [wood.id], current, []), e => e.code === 'BAD_REQUEST');
  }
  assert.throws(() => validatePurchaseReceiptSelection(poId, [wood.id], [wood], [wood.id]), e => e.code === 'CONFLICT');
  assert.throws(() => validatePurchaseReceiptSelection(poId, [wood.id, wood.id], [wood], []), e => e.code === 'BAD_REQUEST');
  assert.throws(() => validatePurchaseReceiptSelection(poId, [], [wood], []), e => e.code === 'BAD_REQUEST');
});
test('save uses current row locks, rechecks eligibility and keeps invoice extras with a valid PO item', async () => {
  const db = database([[wood], []]);
  await lockAndValidatePurchaseReceiptItems(db, poId, [{ purchaseOrderItemId: wood.id }, {}]);
  assert.deepEqual(db.calls.map(c => c.locks), [['update'], ['update']]);
  assert.deepEqual(db.calls[0].where.params, [poId, wood.id]);
  assert.deepEqual(db.calls[1].where.params, [wood.id, 'confirmed']);
  await assert.rejects(lockAndValidatePurchaseReceiptItems(database([[wood], [{ itemId: wood.id }]]), poId, [{ purchaseOrderItemId: wood.id }]), e => e.code === 'CONFLICT');
  await assert.rejects(lockAndValidatePurchaseReceiptItems(database([[{ ...wood, status: 'cancelled' }], []]), poId, [{ purchaseOrderItemId: wood.id }]), e => e.code === 'BAD_REQUEST');
});
test('production save guard runs inside the transaction before receipt/inventory writes', () => {
  const source = readFileSync(new URL('../routers/inventory/receipts.v2.router.ts', import.meta.url), 'utf8').split('  receiveFromPurchaseV2:')[1];
  const transaction = source.indexOf('db.withTransaction(async (tx) => {');
  const guard = source.indexOf('await lockAndValidatePurchaseReceiptItems(tx, input.purchaseOrderId, input.items)');
  const write = source.indexOf('await db.createWarehouseReceiptV2(');
  assert.ok(transaction < guard && guard < write);
});
test('screen calls scoped endpoint and renders error/retry before loading or empty states', () => {
  const source = readFileSync(new URL('../../client/src/pages/inventory/WarehouseReceiveV2.tsx', import.meta.url), 'utf8');
  assert.ok(!source.includes('trpc.purchaseOrders.getById.useQuery'));
  assert.ok(source.includes('trpc.warehouseReceiptsV2.purchaseReceiptContext.useQuery'));
  assert.ok(source.indexOf('if (isPoError) return') < source.indexOf('if (isPoLoading || !initialized) return'));
  assert.ok(source.includes('refetchPo()'));
  assert.ok(source.includes('key={`${poId}:${invoiceNumberParam}`}'));
});
