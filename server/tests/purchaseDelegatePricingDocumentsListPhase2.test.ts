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
const fakeDb = { select: vi.fn(() => new FakeSelectQuery(resultSets.shift() || [])) };

vi.mock("../_core/db/client", () => ({ getDb: vi.fn(async () => fakeDb) }));
vi.mock("../_core/env", () => ({ ENV: {} }));

const { getDelegatePricingAttachmentsWithDelegate } = await import("../_core/db/attachments");

describe("Documents Center — delegate pricing documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resultSets.length = 0;
  });

  it("يجمع وثائق الطلبات المنفردة ودفعات الحزم في تبويب واحد مع بيانات المندوب والإجمالي", async () => {
    resultSets.push(
      [
        {
          id: 21,
          entityType: "delegate_pricing_batch",
          entityId: 601,
          fileName: "PR-0101-دفعة1-تسعير-مندوب.pdf",
          fileUrl: "/api/media?key=single",
          fileKey: "single",
          mimeType: "application/pdf",
          fileSize: 1000,
          uploadedById: 30,
          createdAt: new Date("2026-08-31T09:00:00Z"),
          delegateId: 30,
          delegateName: "مندوب الطلب",
          totalEstimatedCost: "1000.00",
          pricingDocumentScope: "pricing_batch",
        },
      ],
      [
        {
          id: 22,
          entityType: "delegate_package_submission_pricing",
          entityId: 501,
          fileName: "PB-2026-00010-1-تسعير-مندوب.pdf",
          fileUrl: "/api/media?key=package",
          fileKey: "package",
          mimeType: "application/pdf",
          fileSize: 2000,
          uploadedById: 30,
          createdAt: new Date("2026-08-31T10:00:00Z"),
        },
      ],
      [
        { submittedById: 30, totalEstimatedCost: "1500.00" },
        { submittedById: 30, totalEstimatedCost: "2500.00" },
      ],
      [{ name: "مندوب الحزمة" }],
    );

    const rows = await getDelegatePricingAttachmentsWithDelegate();

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 22,
      entityType: "delegate_package_submission_pricing",
      delegateId: 30,
      delegateName: "مندوب الحزمة",
      totalEstimatedCost: "4000.00",
      pricingDocumentScope: "package_submission",
    });
    expect(rows[1]).toMatchObject({
      id: 21,
      entityType: "delegate_pricing_batch",
      totalEstimatedCost: "1000.00",
      pricingDocumentScope: "pricing_batch",
    });
  });
});
