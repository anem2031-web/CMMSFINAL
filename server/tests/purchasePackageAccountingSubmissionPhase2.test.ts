import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../routers/_shared/router-helpers", () => ({
  notifyItemRejection: vi.fn(async () => undefined),
}));

vi.mock("../routers/purchase/purchase-orders.router", () => ({
  submitPricedBatchForPO: vi.fn(),
}));

vi.mock("../routers/purchase/ticket-purchase-workflow", () => ({
  syncPathBTicketFromPurchaseOrder: vi.fn(async () => undefined),
}));

vi.mock("../services/export/exportService", () => ({
  generatePurchaseRequestPDF: vi.fn(async () => Buffer.from("%PDF-package-submission")),
}));

vi.mock("../_core/storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ key })),
}));

vi.mock("../_core/db", () => {
  const submission: any = {
    id: 501,
    purchasePackageId: 10,
    subNumber: 1,
    createdById: 30,
    status: null,
    custodyBalance: null,
  };
  const pkg: any = { id: 10, packageNumber: "PB-2026-00010", createdById: 50 };
  const batches: any[] = [
    { id: 601, batchNumber: 1, purchaseOrderId: 101, status: "pending_accounting", totalEstimatedCost: "1000.00" },
    { id: 602, batchNumber: 1, purchaseOrderId: 102, status: "pending_accounting", totalEstimatedCost: "2000.00" },
  ];
  const pos: any[] = [
    { id: 101, poNumber: "PR-0101", status: "pending_accounting", requestedById: 1, packageId: 10 },
    { id: 102, poNumber: "PR-0102", status: "pending_accounting", requestedById: 2, packageId: 10 },
  ];
  const items: any[] = [
    { id: 1001, purchaseOrderId: 101, batchId: 601, status: "estimated", itemName: "Item A" },
    { id: 1002, purchaseOrderId: 102, batchId: 602, status: "estimated", itemName: "Item B" },
  ];

  return {
    getPurchasePackageSubmissionById: vi.fn(async (id: number) => id === submission.id ? { ...submission } : null),
    getPurchasePackageById: vi.fn(async (id: number) => id === pkg.id ? { ...pkg } : null),
    getPricingBatchesBySubmission: vi.fn(async () => batches.map((b) => ({ ...b }))),
    getPurchaseOrderById: vi.fn(async (id: number) => pos.find((p) => p.id === id) || null),
    getPOItems: vi.fn(async (poId: number) => items.filter((i) => i.purchaseOrderId === poId)),
    getUsersByRole: vi.fn(async (role: string) => role === "senior_management" ? [{ id: 90 }] : []),
    createNotification: vi.fn(async () => undefined),
    createAuditLog: vi.fn(async () => undefined),
    createAttachment: vi.fn(async () => 9001),
    approvePackageSubmissionAccountingAtomic: vi.fn(async ({ submissionId, actorId, custodyBalance }: any) => ({
      submissionId,
      purchasePackageId: 10,
      subNumber: 1,
      totalEstimatedCost: "3000.00",
      batchIds: [601, 602],
      poIds: [101, 102],
      batches: batches.map((b) => ({ ...b })),
      actorId,
      custodyBalance,
    })),
    getUserIdsByRole: vi.fn(async () => []),
    getPOItemsByDelegate: vi.fn(async () => []),

    // إجراءات أخرى موجودة في نفس الراوتر ولكن غير مستخدمة بهذه الاختبارات.
    getPurchaseOrdersByPackage: vi.fn(async () => pos),
    getPurchasePackagesList: vi.fn(async () => [pkg]),
    getPurchaseOrders: vi.fn(async () => pos),
    getPurchaseCards: vi.fn(async () => []),
    getPackageSubmissionsWithBatches: vi.fn(async () => []),
    createPurchasePackage: vi.fn(),
    addOrderToPackage: vi.fn(),
    removeOrderFromPackage: vi.fn(),
    deletePurchasePackage: vi.fn(),
    createPurchasePackageSubmission: vi.fn(),

    _submission: submission,
    _batches: batches,
    _items: items,
  };
});

const { purchasePackagesRouter } = await import("../routers/purchase/purchase-packages.router");
const db = await import("../_core/db") as any;
const ticketWorkflow = await import("../routers/purchase/ticket-purchase-workflow") as any;
const exportService = await import("../services/export/exportService") as any;
const storage = await import("../_core/storage") as any;

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: string, userId: number): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@test.com`,
    name: `Test ${userId}`,
    loginMethod: "manus",
    role,
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

describe("Purchase Packages — Phase 2 accounting submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db._submission.status = null;
    db._batches[0].status = "pending_accounting";
    db._batches[1].status = "pending_accounting";
    db._items[0].status = "estimated";
    db._items[1].status = "estimated";
  });

  it("يعتمد دفعة الإرسال مرة واحدة بعهدة واحدة للحزمة الفرعية", async () => {
    const caller = purchasePackagesRouter.createCaller(createContext("accountant", 70));
    const result = await caller.approveAccountingSubmission({
      submissionId: 501,
      custodyBalance: "4500.00",
    });

    expect(result).toMatchObject({
      success: true,
      submissionId: 501,
      submissionNumber: "PB-2026-00010-1",
      batchCount: 2,
      totalEstimatedCost: "3000.00",
      custodyBalance: "4500.00",
    });
    expect(db.approvePackageSubmissionAccountingAtomic).toHaveBeenCalledTimes(1);
    expect(db.approvePackageSubmissionAccountingAtomic).toHaveBeenCalledWith({
      submissionId: 501,
      actorId: 70,
      custodyBalance: "4500.00",
    });
    expect(ticketWorkflow.syncPathBTicketFromPurchaseOrder).toHaveBeenCalledTimes(2);
    expect(exportService.generatePurchaseRequestPDF).toHaveBeenCalledWith(101, 70, undefined, 501);
    expect(storage.storagePut).toHaveBeenCalledTimes(1);
    expect(db.createAttachment).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "purchase_package_submission_financial",
      entityId: 501,
      fileName: "PB-2026-00010-1-معتمدة-حسابات.pdf",
      mimeType: "application/pdf",
      uploadedById: 70,
    }));
    expect(result.financialDocumentArchived).toBe(true);
  });

  it("يسمح باستمرار الدفعة إذا كانت إحدى دفعات التسعير مرفوضة بالكامل وبقيت أخرى بانتظار الحسابات", async () => {
    db._batches[1].status = "rejected";
    db._items[1].status = "rejected";
    const caller = purchasePackagesRouter.createCaller(createContext("accountant", 70));

    await expect(caller.approveAccountingSubmission({
      submissionId: 501,
      custodyBalance: "1500.00",
    })).resolves.toMatchObject({ success: true });

    expect(db.approvePackageSubmissionAccountingAtomic).toHaveBeenCalledTimes(1);
  });

  it("يرفض الاعتماد إذا كانت إحدى دفعات التسعير خرجت من مرحلة الحسابات", async () => {
    db._batches[1].status = "pending_management";
    const caller = purchasePackagesRouter.createCaller(createContext("accountant", 70));

    await expect(caller.approveAccountingSubmission({
      submissionId: 501,
      custodyBalance: "4500.00",
    })).rejects.toThrow();

    expect(db.approvePackageSubmissionAccountingAtomic).not.toHaveBeenCalled();
  });

  it("يرفض الاعتماد إذا لم يعد في إحدى دفعات التسعير صنف فعّال", async () => {
    db._items[1].status = "rejected";
    const caller = purchasePackagesRouter.createCaller(createContext("accountant", 70));

    await expect(caller.approveAccountingSubmission({
      submissionId: 501,
      custodyBalance: "4500.00",
    })).rejects.toThrow();

    expect(db.approvePackageSubmissionAccountingAtomic).not.toHaveBeenCalled();
  });

  it("لا يلغي اعتماد الحسابات إذا فشل تخزين المستند المالي بعد نجاح الاعتماد", async () => {
    storage.storagePut.mockRejectedValueOnce(new Error("storage unavailable"));
    const caller = purchasePackagesRouter.createCaller(createContext("accountant", 70));

    const result = await caller.approveAccountingSubmission({
      submissionId: 501,
      custodyBalance: "4500.00",
    });

    expect(result).toMatchObject({ success: true, financialDocumentArchived: false });
    expect(db.approvePackageSubmissionAccountingAtomic).toHaveBeenCalledTimes(1);
    expect(db.createAttachment).not.toHaveBeenCalled();
  });

  it("لا يسمح لغير الحسابات باستدعاء اعتماد دفعة الإرسال", async () => {
    const caller = purchasePackagesRouter.createCaller(createContext("delegate", 30));
    await expect(caller.approveAccountingSubmission({
      submissionId: 501,
      custodyBalance: "4500.00",
    })).rejects.toThrow();
    expect(db.approvePackageSubmissionAccountingAtomic).not.toHaveBeenCalled();
  });
});
