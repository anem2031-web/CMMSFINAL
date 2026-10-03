/**
 * Catalog audit helpers shared by Catalog governance mutations.
 *
 * catalog_audit_logs stores JSON snapshots in TEXT columns in the live DB, so
 * callers should pass the returned objects through JSON.stringify at insert time.
 */
export function pickAuditValues(source: Record<string, any> | null | undefined, patch: Record<string, any>) {
  const values: Record<string, any> = {};
  for (const key of Object.keys(patch)) {
    values[key] = source?.[key] ?? null;
  }
  return values;
}

export function catalogAuditJson(values: Record<string, any> | null | undefined): string | null {
  if (!values) return null;
  return JSON.stringify(values);
}

/**
 * Request metadata stored with new Catalog audit entries when an HTTP context is
 * available. User identity remains authoritative through userId; the Audit UI
 * resolves and displays the user's current name next to the exact createdAt time.
 */
export function catalogAuditRequestMeta(ctx: any): { ipAddress?: string; userAgent?: string } {
  const req = ctx?.req;
  if (!req) return {};

  const forwarded = req.headers?.["x-forwarded-for"];
  const ipAddress = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim())
    || req.headers?.["x-real-ip"]
    || req.socket?.remoteAddress
    || undefined;
  const userAgent = req.headers?.["user-agent"] || undefined;

  return {
    ...(ipAddress ? { ipAddress: String(ipAddress).slice(0, 45) } : {}),
    ...(userAgent ? { userAgent: String(userAgent) } : {}),
  };
}
