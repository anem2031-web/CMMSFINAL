import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogAuditRequestMeta } from "../_core/catalog-audit";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Catalog full audit trail", () => {
  it("captures request IP/user-agent metadata without changing the audit schema", () => {
    const meta = catalogAuditRequestMeta({
      req: {
        headers: {
          "x-forwarded-for": "10.0.0.5, 10.0.0.6",
          "user-agent": "CMMS-Test-Agent",
        },
        socket: { remoteAddress: "127.0.0.1" },
      },
    });

    expect(meta).toEqual({ ipAddress: "10.0.0.5", userAgent: "CMMS-Test-Agent" });
  });

  it("audits every direct item-supplier relationship mutation", () => {
    const router = read("server/routers/catalog/catalog.router.ts");

    expect(router).toContain('action: "assign_supplier_to_item"');
    expect(router).toContain('action: Number(existing.isActive) === 1 ? "update_item_supplier_link" : "restore_item_supplier_link"');
    expect(router).toContain('action: "remove_supplier_from_item"');
    expect(router).toContain('action: shouldBePreferred ? "set_preferred_supplier" : "unset_preferred_supplier"');
    expect(router).toContain('entityType: "item_supplier"');
  });

  it("keeps item code/category changes in old/new audit snapshots", () => {
    const router = read("server/routers/catalog/catalog.router.ts");

    expect(router).toContain("oldValues: catalogAuditJson(pickAuditValues(existing, updateData))");
    expect(router).toContain("newValues: catalogAuditJson(updateData)");
    expect(router).toContain("const nodeChanged = targetNodeId !== existingNodeId");
    expect(router).toContain("const codeChanged = submittedCode !== undefined && submittedCode !== existingCode");
  });

  it("audits bulk catalog imports per changed node/item plus a commit summary", () => {
    const service = read("server/services/catalog/catalogImport.service.ts");
    const router = read("server/routers/catalog/catalogImportExport.router.ts");

    expect(service).toContain('action: "import_create"');
    expect(service).toContain('action: "import_update"');
    expect(service).toContain('action: "import_commit"');
    expect(service).toContain('entityType: "item"');
    expect(service).toContain('entityType: "node"');
    expect(router).toContain("userId: ctx.user.id");
    expect(router).toContain("catalogAuditRequestMeta(ctx)");
  });

  it("audits catalog master-data changes created by warehouse receiving", () => {
    const receipts = read("server/routers/inventory/receipts.v2.router.ts");
    const candidates = read("server/_core/catalog-item-candidate.ts");

    expect(receipts).toContain('action: "create_supplier_candidate"');
    expect(receipts).toContain('action: "create_supplier_alias"');
    expect(receipts).toContain('action: "create_supplier_item_alias"');
    expect(receipts).toContain('action: "confirm_supplier_item_alias"');
    expect(candidates).toContain('action: "create_item_candidate"');
  });

  it("keeps catalog image add/delete operations in the system audit with file identity", () => {
    const attachments = read("server/routers/uploads/attachments.router.ts");

    expect(attachments).toContain('action: "add_attachment"');
    expect(attachments).toContain('action: "delete_attachment"');
    expect(attachments).toContain("attachmentId: id");
    expect(attachments).toContain("fileKey: input.fileKey");
    expect(attachments).toContain('input.entityType === "catalog_item" ? catalogAuditRequestMeta(ctx) : {}');
  });

  it("renders catalog audit actions with user, exact timestamp and searchable before/after values", () => {
    const ui = read("client/src/pages/admin/AuditLog.tsx");

    expect(ui).toContain('assign_supplier_to_item: "ربط مورد بصنف"');
    expect(ui).toContain('catalog_item: language === "ar" ? "صورة/مرفق صنف الكتالوج"');
    expect(ui).toContain("second: \"2-digit\"");
    expect(ui).toContain("oldValues.includes(q)");
    expect(ui).toContain("newValues.includes(q)");
    expect(ui).toContain("getUserName(log.userId)");
  });
});
