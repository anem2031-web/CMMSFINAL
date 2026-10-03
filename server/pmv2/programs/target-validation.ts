export interface Pmv2ProgramTargetWrite {
  programId: number;
  siteId: number | null;
  sectionId: number | null;
  assetId: number | null;
}

export class Pmv2ProgramTargetValidationError extends Error {
  readonly field: "programId" | "target";

  constructor(
    field: "programId" | "target",
    message: string,
  ) {
    super(message);
    this.name = "Pmv2ProgramTargetValidationError";
    this.field = field;
  }
}

function positiveIntegerOrNull(value: unknown): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Pmv2ProgramTargetValidationError(
      "target",
      "معرف هدف الصيانة يجب أن يكون رقمًا صحيحًا أكبر من صفر",
    );
  }
  return Number(value);
}

/**
 * Phase 1 write-boundary invariant for Program Targets.
 *
 * TiDB CHECK constraints are not relied on in the current CMMS baseline, so
 * PM V2 must enforce Exactly One of Site | Section | Asset before every write.
 * The write service must also validate the selected external reference through
 * currentMaintenanceTargetAdapter before INSERT/UPDATE.
 */
export function validatePmv2ProgramTargetWrite(
  input: unknown,
): Pmv2ProgramTargetWrite {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Pmv2ProgramTargetValidationError("target", "بيانات هدف برنامج الصيانة غير صالحة");
  }

  const data = input as Record<string, unknown>;
  if (!Number.isInteger(data.programId) || Number(data.programId) <= 0) {
    throw new Pmv2ProgramTargetValidationError(
      "programId",
      "معرف برنامج الصيانة يجب أن يكون رقمًا صحيحًا أكبر من صفر",
    );
  }

  const siteId = positiveIntegerOrNull(data.siteId);
  const sectionId = positiveIntegerOrNull(data.sectionId);
  const assetId = positiveIntegerOrNull(data.assetId);
  const selected = [siteId, sectionId, assetId].filter((value) => value !== null);

  if (selected.length !== 1) {
    throw new Pmv2ProgramTargetValidationError(
      "target",
      "يجب اختيار هدف صيانة واحد فقط: موقع أو قسم أو أصل",
    );
  }

  return {
    programId: Number(data.programId),
    siteId,
    sectionId,
    assetId,
  };
}
