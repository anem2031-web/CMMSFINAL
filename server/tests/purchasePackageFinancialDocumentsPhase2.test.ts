import { beforeEach, describe, expect, it, vi } from "vitest";

const resultSets: any[][] = [];

class FakeSelectQuery {
  constructor(private readonly rows: any[]) {}
  from() { return this; }
  leftJoin() { return this; }
  where() { return this; }
  limit(count: number) { return Promise.resolve(this.rows.slice(0, count)); }
  then(resolve: (value: any[]) => unknown, reject?: (reason: unknown) => unknown) {
    return Promise.resolve(this.rows).then(resolve, reject);
  }
}

const fakeDb = {
  select: vi.fn(() => new FakeSelectQuery(resultSets.shift() || [])),
};

vi.mock("../_core/db/client", () => ({
  getDb: vi.fn(async () => fakeDb),
}));

// attachments.ts imports ENV even though this helper does not use it. Keep the
// test isolated from deployment secrets / .env validation.
vi.mock("../_core/env", () => ({ ENV: {} }));

const { getFinancialBatchAttachmentsWithDelegate } = await import("../_core/db/attachments");

describe("Purchase Packages — Phase 2 financial document archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resultSets.length = 0;
  });

  it("يجمع مستند الحزمة المعتمد مع المستندات المالية القديمة في نفس قائمة مركز المستندات", async () => {
    resultSets.push(
      [
        {
          id: 11,
          entityType: "po_financial_batch",
          entityId: 601,
          fileName: "PR-0101-دفعة1-معتمدة-حسابات.pdf",
          fileUrl: "/api/media?key=legacy",
          fileKey: "legacy",
          mimeType: "application/pdf",
          fileSize: 1200,
          uploadedById: 70,
          createdAt: new Date("2026-08-31T08:00:00Z"),
          delegateId: 30,
          delegateName: "مندوب قديم",
          totalEstimatedCost: "1000.00",
          custodyBalance: "1200.00",
          financialDocumentScope: "pricing_batch",
        },
      ],
      [
        {
          id: 12,
          entityType: "purchase_package_submission_financial",
          entityId: 501,
          fileName: "PB-2026-00010-1-معتمدة-حسابات.pdf",
          fileUrl: "/api/media?key=package",
          fileKey: "package",
          mimeType: "application/pdf",
          fileSize: 2200,
          uploadedById: 70,
          createdAt: new Date("2026-08-31T09:00:00Z"),
        },
      ],
      [{ id: 501, totalEstimatedCost: "3000.00", custodyBalance: "4500.00" }],
      [{ submittedById: 30 }],
      [{ name: "مندوب الحزمة" }],
    );

    const rows = await getFinancialBatchAttachmentsWithDelegate();

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 12,
      entityType: "purchase_package_submission_financial",
      entityId: 501,
      delegateId: 30,
      delegateName: "مندوب الحزمة",
      totalEstimatedCost: "3000.00",
      custodyBalance: "4500.00",
      financialDocumentScope: "package_submission",
    });
    expect(rows[1]).toMatchObject({
      id: 11,
      entityType: "po_financial_batch",
      financialDocumentScope: "pricing_batch",
    });
  });
});
