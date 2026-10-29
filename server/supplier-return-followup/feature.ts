/** Production is enabled explicitly after the manual schema and acceptance checks.
 * Other databases remain excluded even when the flag is set.
 */
export function supplierReturnDatabaseEnabled(
  databaseName: unknown,
  enabled = process.env.SUPPLIER_RETURN_FOLLOWUP_ENABLED
): boolean {
  const name = String(databaseName ?? "").toLowerCase();
  return name === "copycmms2" || (name === "cmms" && enabled === "true");
}
