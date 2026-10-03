export interface Pmv2MaterialPurchaseLinkWrite {
  materialRequestItemId: number;
  purchaseOrderId: number;
  purchaseOrderItemId: number;
  linkedQuantity: number;
  requestedQuantity: number;
  alreadyLinkedQuantity: number;
  createdById: number;
}

export class Pmv2MaterialPurchaseLinkValidationError extends Error {
  readonly field:
    | keyof Pmv2MaterialPurchaseLinkWrite
    | "quantityAllocation";

  constructor(
    field: keyof Pmv2MaterialPurchaseLinkWrite | "quantityAllocation",
    message: string,
  ) {
    super(message);
    this.name = "Pmv2MaterialPurchaseLinkValidationError";
    this.field = field;
  }
}

function positiveInteger(
  value: unknown,
  field:
    | "materialRequestItemId"
    | "purchaseOrderId"
    | "purchaseOrderItemId"
    | "createdById",
): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Pmv2MaterialPurchaseLinkValidationError(
      field,
      `${field} يجب أن يكون رقمًا صحيحًا أكبر من صفر`,
    );
  }
  return Number(value);
}

function positiveQuantity(
  value: unknown,
  field: "linkedQuantity" | "requestedQuantity",
): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new Pmv2MaterialPurchaseLinkValidationError(
      field,
      `${field} يجب أن تكون أكبر من صفر`,
    );
  }
  return numberValue;
}

function nonNegativeQuantity(value: unknown): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Pmv2MaterialPurchaseLinkValidationError(
      "alreadyLinkedQuantity",
      "الكمية المرتبطة سابقًا لا يمكن أن تكون سالبة",
    );
  }
  return numberValue;
}

/**
 * PM V2 write-boundary contract for Purchase Source Links.
 *
 * This function validates only PM V2-owned invariants. The Purchase Adapter
 * must still verify that purchaseOrderItemId belongs to purchaseOrderId and
 * that both references are valid in the current Purchase workflow.
 *
 * No Purchase Order/Item state is stored or mutated here.
 */
export function validatePmv2MaterialPurchaseLinkWrite(
  input: Pmv2MaterialPurchaseLinkWrite,
): Pmv2MaterialPurchaseLinkWrite {
  const materialRequestItemId = positiveInteger(
    input.materialRequestItemId,
    "materialRequestItemId",
  );
  const purchaseOrderId = positiveInteger(
    input.purchaseOrderId,
    "purchaseOrderId",
  );
  const purchaseOrderItemId = positiveInteger(
    input.purchaseOrderItemId,
    "purchaseOrderItemId",
  );
  const createdById = positiveInteger(input.createdById, "createdById");
  const linkedQuantity = positiveQuantity(
    input.linkedQuantity,
    "linkedQuantity",
  );
  const requestedQuantity = positiveQuantity(
    input.requestedQuantity,
    "requestedQuantity",
  );
  const alreadyLinkedQuantity = nonNegativeQuantity(
    input.alreadyLinkedQuantity,
  );

  if (alreadyLinkedQuantity + linkedQuantity > requestedQuantity) {
    throw new Pmv2MaterialPurchaseLinkValidationError(
      "quantityAllocation",
      "إجمالي الكمية المرتبطة بالشراء لا يجوز أن يتجاوز الكمية المطلوبة",
    );
  }

  return {
    materialRequestItemId,
    purchaseOrderId,
    purchaseOrderItemId,
    linkedQuantity,
    requestedQuantity,
    alreadyLinkedQuantity,
    createdById,
  };
}
