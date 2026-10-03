import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Pmv2MaterialUsageValidationError,
  validatePmv2MaterialUsageWrite,
} from '../pmv2/materials/usage-validation.ts';

const valid = {
  taskItemId: 10,
  visitId: 20,
  materialRequestItemId: null,
  warehouseId: 30,
  catalogItemId: 40,
  inventoryTransactionId: 50,
  inventoryLotId: 60,
  deliveryDocumentId: 70,
  purchaseOrderItemId: null,
  usedQuantity: 2.5,
  unitSnapshot: 'PCS',
  recordedById: 80,
};

test('accepts a valid material usage trace', () => {
  const result = validatePmv2MaterialUsageWrite(valid);
  assert.equal(result.usedQuantity, 2.5);
  assert.equal(result.materialRequestItemId, null);
});

test('rejects zero usage quantity', () => {
  assert.throws(
    () => validatePmv2MaterialUsageWrite({ ...valid, usedQuantity: 0 }),
    Pmv2MaterialUsageValidationError,
  );
});

test('rejects negative usage quantity', () => {
  assert.throws(
    () => validatePmv2MaterialUsageWrite({ ...valid, usedQuantity: -1 }),
    Pmv2MaterialUsageValidationError,
  );
});

test('rejects invalid external reference ids', () => {
  assert.throws(
    () => validatePmv2MaterialUsageWrite({ ...valid, warehouseId: 0 }),
    Pmv2MaterialUsageValidationError,
  );
});

test('allows nullable request and external evidence references', () => {
  const result = validatePmv2MaterialUsageWrite({
    ...valid,
    materialRequestItemId: null,
    inventoryTransactionId: null,
    inventoryLotId: null,
    deliveryDocumentId: null,
    purchaseOrderItemId: null,
  });
  assert.equal(result.materialRequestItemId, null);
  assert.equal(result.inventoryTransactionId, null);
});
