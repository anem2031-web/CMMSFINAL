export interface Pmv2MaterialUsageWrite {
  taskItemId: number;
  visitId: number;
  materialRequestItemId: number | null;
  warehouseId: number;
  catalogItemId: number;
  inventoryTransactionId: number | null;
  inventoryLotId: number | null;
  deliveryDocumentId: number | null;
  purchaseOrderItemId: number | null;
  usedQuantity: number;
  unitSnapshot: string | null;
  recordedById: number;
}

export class Pmv2MaterialUsageValidationError extends Error {
  readonly field: keyof Pmv2MaterialUsageWrite | "input";

  constructor(field: keyof Pmv2MaterialUsageWrite | "input", message: string) {
    super(message);
    this.name = "Pmv2MaterialUsageValidationError";
    this.field = field;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(
  value: unknown,
  field:
    | "taskItemId"
    | "visitId"
    | "materialRequestItemId"
    | "warehouseId"
    | "catalogItemId"
    | "inventoryTransactionId"
    | "inventoryLotId"
    | "deliveryDocumentId"
    | "purchaseOrderItemId"
    | "recordedById",
): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Pmv2MaterialUsageValidationError(
      field,
      `${field} يجب أن يكون رقمًا صحيحًا أكبر من صفر`,
    );
  }
  return Number(value);
}

function nullablePositiveInteger(
  value: unknown,
  field:
    | "materialRequestItemId"
    | "inventoryTransactionId"
    | "inventoryLotId"
    | "deliveryDocumentId"
    | "purchaseOrderItemId",
): number | null {
  return value == null ? null : positiveInteger(value, field);
}

/**
 * PM V2 write-boundary validation for Material Usage trace rows.
 *
 * This records evidence returned by the current Inventory/Delivery services;
 * it does not mutate stock. External IDs remain adapter-validated references.
 */
export function validatePmv2MaterialUsageWrite(
  input: unknown,
): Pmv2MaterialUsageWrite {
  if (!isRecord(input)) {
    throw new Pmv2MaterialUsageValidationError(
      "input",
      "بيانات استهلاك المادة غير صالحة",
    );
  }

  const usedQuantity = Number(input.usedQuantity);
  if (!Number.isFinite(usedQuantity) || usedQuantity <= 0) {
    throw new Pmv2MaterialUsageValidationError(
      "usedQuantity",
      "كمية الاستخدام يجب أن تكون أكبر من صفر",
    );
  }

  const unitSnapshot =
    input.unitSnapshot == null
      ? null
      : typeof input.unitSnapshot === "string"
        ? input.unitSnapshot.trim() || null
        : null;

  if (unitSnapshot !== null && unitSnapshot.length > 50) {
    throw new Pmv2MaterialUsageValidationError(
      "unitSnapshot",
      "وحدة المادة يجب ألا تتجاوز 50 حرف",
    );
  }

  return {
    taskItemId: positiveInteger(input.taskItemId, "taskItemId"),
    visitId: positiveInteger(input.visitId, "visitId"),
    materialRequestItemId: nullablePositiveInteger(
      input.materialRequestItemId,
      "materialRequestItemId",
    ),
    warehouseId: positiveInteger(input.warehouseId, "warehouseId"),
    catalogItemId: positiveInteger(input.catalogItemId, "catalogItemId"),
    inventoryTransactionId: nullablePositiveInteger(
      input.inventoryTransactionId,
      "inventoryTransactionId",
    ),
    inventoryLotId: nullablePositiveInteger(input.inventoryLotId, "inventoryLotId"),
    deliveryDocumentId: nullablePositiveInteger(
      input.deliveryDocumentId,
      "deliveryDocumentId",
    ),
    purchaseOrderItemId: nullablePositiveInteger(
      input.purchaseOrderItemId,
      "purchaseOrderItemId",
    ),
    usedQuantity,
    unitSnapshot,
    recordedById: positiveInteger(input.recordedById, "recordedById"),
  };
}
