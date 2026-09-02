import { beforeEach, describe, expect, it, vi } from "vitest";

const delegateDocs = [
  { id: 1, delegateId: 30, fileName: "delegate-30-a.pdf" },
  { id: 2, delegateId: 31, fileName: "delegate-31-a.pdf" },
  { id: 3, delegateId: 30, fileName: "delegate-30-b.pdf" },
];

const getDelegatePricingAttachmentsWithDelegate = vi.fn(async () => delegateDocs);
const getFinancialBatchAttachmentsWithDelegate = vi.fn(async () => [
  { id: 90, delegateId: 30, fileName: "financial.pdf" },
]);

vi.mock("../_core/db", () => ({
  getDelegatePricingAttachmentsWithDelegate,
  getFinancialBatchAttachmentsWithDelegate,
}));

vi.mock("../routers/uploads/attachments.access", () => ({
  assertCanAccessAttachments: vi.fn(async () => undefined),
}));

const { attachmentsRouter } = await import("../routers/uploads/attachments.router");

function caller(role: string, id: number) {
  return attachmentsRouter.createCaller({
    user: { id, role, name: `user-${id}` },
  } as any);
}

describe("Documents Center — صلاحيات وثائق التسعير الصادرة من المندوبين", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("المندوب يرى فقط وثائق التسعير الخاصة به", async () => {
    const result = await caller("delegate", 30).listByType({
      entityType: "delegate_pricing_documents",
    });

    expect(result).toEqual([
      { id: 1, delegateId: 30, fileName: "delegate-30-a.pdf" },
      { id: 3, delegateId: 30, fileName: "delegate-30-b.pdf" },
    ]);
  });

  it("مندوب آخر لا يرى وثائق مندوب غيره", async () => {
    const result = await caller("delegate", 99).listByType({
      entityType: "delegate_pricing_documents",
    });

    expect(result).toEqual([]);
  });

  it("المالك يرى جميع وثائق تسعير المندوبين", async () => {
    await expect(caller("owner", 1).listByType({
      entityType: "delegate_pricing_documents",
    })).resolves.toEqual(delegateDocs);
  });

  it("مدير النظام يرى جميع وثائق تسعير المندوبين", async () => {
    await expect(caller("admin", 2).listByType({
      entityType: "delegate_pricing_documents",
    })).resolves.toEqual(delegateDocs);
  });

  it("الحسابات والإدارة العليا وبقية الأدوار ممنوعون من API تبويب وثائق تسعير المندوبين", async () => {
    for (const role of ["accountant", "senior_management", "executive_director", "warehouse", "purchase_requester"]) {
      await expect(caller(role, 50).listByType({
        entityType: "delegate_pricing_documents",
      })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("صلاحيات الوثائق المالية المعتمدة تبقى كما هي ولا تُمنح للمندوب", async () => {
    await expect(caller("accountant", 70).listByType({
      entityType: "po_financial_batch",
    })).resolves.toEqual([{ id: 90, delegateId: 30, fileName: "financial.pdf" }]);

    await expect(caller("senior_management", 71).listByType({
      entityType: "po_financial_batch",
    })).resolves.toEqual([{ id: 90, delegateId: 30, fileName: "financial.pdf" }]);

    await expect(caller("delegate", 30).listByType({
      entityType: "po_financial_batch",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
