import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../routers/purchase/purchase-orders.router", () => ({
  submitPricedBatchForPO: vi.fn(async (purchaseOrderId: number) => ({
    success: true,
    batchId: 9000 + purchaseOrderId,
    batchNumber: 1,
    itemCount: 1,
    pricingDocumentArchived: null,
  })),
}));
vi.mock("../routers/purchase/ticket-purchase-workflow", () => ({ syncPathBTicketFromPurchaseOrder: vi.fn(async () => undefined) }));
vi.mock("../routers/_shared/router-helpers", () => ({ notifyItemRejection: vi.fn(async () => undefined) }));
vi.mock("../_core/authz/guard", () => ({
  assertCanPerformPOAction: vi.fn(),
  assertCanViewPurchaseOrder: vi.fn(async () => undefined),
  filterVisiblePurchaseOrders: vi.fn(async (_user: any, rows: any[]) => rows),
}));
vi.mock("../services/export/exportService", () => ({
  generatePurchaseRequestPDF: vi.fn(async () => Buffer.from("%PDF-package-pricing")),
}));
vi.mock("../_core/storage", () => ({ storagePut: vi.fn(async (key: string) => ({ key })) }));
vi.mock("../_core/db", () => {
  const pkg = { id: 10, packageNumber: "PB-2026-00010", createdById: 50 };
  const pos = [
    { id: 101, poNumber: "PR-0101", status: "pending_estimate", requestedById: 1, packageId: 10 },
    { id: 102, poNumber: "PR-0102", status: "pending_estimate", requestedById: 2, packageId: 10 },
  ];
  return {
    getPurchasePackageById: vi.fn(async (id: number) => id === 10 ? { ...pkg } : null),
    getPurchaseOrdersByPackage: vi.fn(async () => pos.map((p) => ({ ...p }))),
    createPurchasePackageSubmission: vi.fn(async () => ({ id: 501, subNumber: 1 })),
    createAttachment: vi.fn(async () => 9001),
    // بقية وظائف الراوتر غير مستخدمة هنا، لكنها متاحة كي يبقى الاستيراد معزولًا.
    getPurchasePackagesList: vi.fn(async () => [pkg]),
    getPurchaseOrders: vi.fn(async () => pos),
    getPOItems: vi.fn(async () => []),
    getPOItemsByDelegate: vi.fn(async () => []),
    getPurchaseCards: vi.fn(async () => []),
    getPackageSubmissionsWithBatches: vi.fn(async () => []),
    getUserIdsByRole: vi.fn(async () => []),
    createPurchasePackage: vi.fn(),
    addOrderToPackage: vi.fn(),
    removeOrderFromPackage: vi.fn(),
    deletePurchasePackage: vi.fn(),
  };
});

const { purchasePackagesRouter } = await import("../routers/purchase/purchase-packages.router");
const db = await import("../_core/db") as any;
const poRouter = await import("../routers/purchase/purchase-orders.router") as any;
const exportService = await import("../services/export/exportService") as any;
const storage = await import("../_core/storage") as any;

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;
function createContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 30,
    openId: "delegate-30",
    email: "delegate30@test.com",
    name: "Delegate 30",
    loginMethod: "manus",
    role: "delegate",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("Delegate pricing documents — purchase package submission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ينشئ مستندًا واحدًا فقط لدفعة الحزمة مهما كان عدد طلبات PR المرسلة داخلها", async () => {
    const caller = purchasePackagesRouter.createCaller(createContext());
    const result = await caller.submitPackageBatch({ packageId: 10 });

    expect(result).toMatchObject({
      success: true,
      submissionNumber: "PB-2026-00010-1",
      pricingDocumentArchived: true,
    });
    expect(result.sent).toHaveLength(2);
    expect(poRouter.submitPricedBatchForPO).toHaveBeenCalledTimes(2);
    expect(exportService.generatePurchaseRequestPDF).toHaveBeenCalledTimes(1);
    expect(exportService.generatePurchaseRequestPDF).toHaveBeenCalledWith(101, 30, undefined, 501);
    expect(storage.storagePut).toHaveBeenCalledTimes(1);
    expect(db.createAttachment).toHaveBeenCalledTimes(1);
    expect(db.createAttachment).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "delegate_package_submission_pricing",
      entityId: 501,
      fileName: "PB-2026-00010-1-تسعير-مندوب.pdf",
      uploadedById: 30,
    }));
  });

  it("لا يلغي إرسال الحزمة إذا فشل حفظ مستند التسعير ويعيد التنبيه للواجهة", async () => {
    storage.storagePut.mockRejectedValueOnce(new Error("storage unavailable"));
    const caller = purchasePackagesRouter.createCaller(createContext());

    const result = await caller.submitPackageBatch({ packageId: 10 });

    expect(result).toMatchObject({ success: true, pricingDocumentArchived: false });
    expect(db.createAttachment).not.toHaveBeenCalled();
  });
});
