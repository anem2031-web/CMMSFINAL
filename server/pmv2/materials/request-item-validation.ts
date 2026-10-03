export const PMV2_MATERIAL_REQUEST_ITEM_STATUSES = [
  "waiting_warehouse",
  "external_purchase",
  "received_warehouse",
  "issued_to_team",
  "consumed",
  "cancelled",
] as const;

export type Pmv2MaterialRequestItemStatus =
  (typeof PMV2_MATERIAL_REQUEST_ITEM_STATUSES)[number];

export interface Pmv2MaterialRequestItemWrite {
  requestId: number;
  catalogItemId: number | null;
  itemNameSnapshot: string;
  requestedQuantity: number;
  unitSnapshot: string | null;
  status: Pmv2MaterialRequestItemStatus;
  receivedWarehouseQuantity: number;
  issuedToTeamQuantity: number;
}

export class Pmv2MaterialRequestItemValidationError extends Error {
  readonly field: keyof Pmv2MaterialRequestItemWrite | "input";

  constructor(
    field: keyof Pmv2MaterialRequestItemWrite | "input",
    message: string,
  ) {
    super(message);
    this.name = "Pmv2MaterialRequestItemValidationError";
    this.field = field;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown, field: "requestId" | "catalogItemId"): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Pmv2MaterialRequestItemValidationError(
      field,
      `${field} يجب أن يكون رقمًا صحيحًا أكبر من صفر`,
    );
  }
  return Number(value);
}

function positiveQuantity(value: unknown): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new Pmv2MaterialRequestItemValidationError(
      "requestedQuantity",
      "الكمية المطلوبة يجب أن تكون أكبر من صفر",
    );
  }
  return numberValue;
}

function nonNegativeQuantity(
  value: unknown,
  field: "receivedWarehouseQuantity" | "issuedToTeamQuantity",
): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Pmv2MaterialRequestItemValidationError(
      field,
      `${field} يجب ألا تكون سالبة`,
    );
  }
  return numberValue;
}

/**
 * PM V2 write-boundary validation for Material Request Items.
 *
 * The live TiDB environment does not enforce CHECK constraints. Any Phase 4
 * command that inserts/updates a material-request item must pass through this
 * contract before persistence. Inventory/Purchase transitions remain owned by
 * their existing workflows and are not executed here.
 */
export function validatePmv2MaterialRequestItemWrite(
  input: unknown,
): Pmv2MaterialRequestItemWrite {
  if (!isRecord(input)) {
    throw new Pmv2MaterialRequestItemValidationError(
      "input",
      "بيانات بند طلب المواد غير صالحة",
    );
  }

  const itemNameSnapshot =
    typeof input.itemNameSnapshot === "string"
      ? input.itemNameSnapshot.trim()
      : "";
  if (!itemNameSnapshot || itemNameSnapshot.length > 300) {
    throw new Pmv2MaterialRequestItemValidationError(
      "itemNameSnapshot",
      "اسم المادة مطلوب ويجب ألا يتجاوز 300 حرف",
    );
  }

  const unitSnapshot =
    input.unitSnapshot == null
      ? null
      : typeof input.unitSnapshot === "string"
        ? input.unitSnapshot.trim() || null
        : null;
  if (unitSnapshot !== null && unitSnapshot.length > 50) {
    throw new Pmv2MaterialRequestItemValidationError(
      "unitSnapshot",
      "وحدة المادة يجب ألا تتجاوز 50 حرف",
    );
  }

  const status = input.status ?? "waiting_warehouse";
  if (
    typeof status !== "string" ||
    !PMV2_MATERIAL_REQUEST_ITEM_STATUSES.includes(
      status as Pmv2MaterialRequestItemStatus,
    )
  ) {
    throw new Pmv2MaterialRequestItemValidationError(
      "status",
      "حالة بند طلب المواد غير صالحة",
    );
  }

  return {
    requestId: positiveInteger(input.requestId, "requestId"),
    catalogItemId:
      input.catalogItemId == null
        ? null
        : positiveInteger(input.catalogItemId, "catalogItemId"),
    itemNameSnapshot,
    requestedQuantity: positiveQuantity(input.requestedQuantity),
    unitSnapshot,
    status: status as Pmv2MaterialRequestItemStatus,
    receivedWarehouseQuantity: nonNegativeQuantity(
      input.receivedWarehouseQuantity ?? 0,
      "receivedWarehouseQuantity",
    ),
    issuedToTeamQuantity: nonNegativeQuantity(
      input.issuedToTeamQuantity ?? 0,
      "issuedToTeamQuantity",
    ),
  };
}
