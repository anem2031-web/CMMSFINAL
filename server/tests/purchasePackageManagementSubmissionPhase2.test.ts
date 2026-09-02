import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../routers/purchase/purchase-orders.router", () => ({
  submitPricedBatchForPO: vi.fn(),
}));

vi.mock("../routers/purchase/ticket-purchase-workflow", () => ({
  syncPathBTicketFromPurchaseOrder: vi.fn(async () => undefined),
}));

vi.mock("../routers/_shared/router-helpers", () => ({
  notifyItemRejection: vi.fn(async () => undefined),
}));

vi.mock("../_core/db", () => {
  const submission: any = {
    id: 501,
    purchasePackageId: 10,
    subNumber: 1,
    createdById: 30,
    status: "pending_management",
    custodyBalance: "4500.00",
    totalEstimatedCost: "3000.00",
  };
  const pkg: any = { id: 10, packageNumber: "PB-2026-00010", createdById: 50 };
  const batches: any[] = [
    { id: 601, batchNumber: 1, purchaseOrderId: 101, status: "pending_management", totalEstimatedCost: "1000.00" },
    { id: 602, batchNumber: 1, purchaseOrderId: 102, status: "pending_management", totalEstimatedCost: "2000.00" },
  ];
  const pos: any[] = [
    { id: 101, poNumber: "PR-0101", status: "pending_management", requestedById: 1, packageId: 10 },
    { id: 102, poNumber: "PR-0102", status: "pending_management", requestedById: 2, packageId: 10 },
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
    createNotification: vi.fn(async () => undefined),
    createAuditLog: vi.fn(async () => undefined),
    approvePackageSubmissionManagementAtomic: vi.fn(async ({ submissionId, actorId, rejections = [] }: any) => ({
      submissionId,
      purchasePackageId: 10,
      subNumber: 1,
      custodyBalance: "4500.00",
      totalEstimatedCost: "3000.00",
      submissionStatus: rejections.length === 2 ? "rejected" : "approved",
      batchIds: [601, 602],
      approvedBatchIds: rejections.length === 2 ? [] : [601, 602],
      rejectedBatchIds: rejections.length === 2 ? [601, 602] : [],
      poIds: [101, 102],
      approvedPoIds: rejections.length === 2 ? [] : [101, 102],
      rejectedPoIds: rejections.length === 2 ? [101, 102] : [],
      rejectedItems: rejections.map((r: any) => {
        const item = items.find((i) => i.id === r.itemId)!;
        return { itemId: item.id, itemName: item.itemName, poId: item.purchaseOrderId, reason: r.reason };
      }),
      delegateId: 30,
      actorId,
    })),

    // إجراءات أخرى موجودة في نفس الراوتر وغير مستخدمة مباشرة بهذه الاختبارات.
    getUsersByRole: vi.fn(async () => []),
    getUserIdsByRole: vi.fn(async () => []),
    getPOItemsByDelegate: vi.fn(async () => []),
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
    approvePackageSubmissionAccountingAtomic: vi.fn(),

    _submission: submission,
    _batches: batches,
    _items: items,
  };
});

const { purchasePackagesRouter } = await import("../routers/purchase/purchase-packages.router");
const db = await import("../_core/db") as any;
const ticketWorkflow = await import("../routers/purchase/ticket-purchase-workflow") as any;
const routerHelpers = await import("../routers/_shared/router-helpers") as any;

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

describe("Purchase Packages — Phase 2 management submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db._submission.status = "pending_management";
    db._batches[0].status = "pending_management";
    db._batches[1].status = "pending_management";
    db._items[0].status = "estimated";
    db._items[1].status = "estimated";
  });

  it("يعتمد الإدارة العليا دفعة الإرسال مرة واحدة ويُبقي العهدة على مستوى الإرسال", async () => {
    const caller = purchasePackagesRouter.createCaller(createContext("senior_management", 90));
    const result = await caller.approveManagementSubmission({ submissionId: 501 });

    expect(result).toMatchObject({
      success: true,
      submissionId: 501,
      submissionNumber: "PB-2026-00010-1",
      status: "approved",
      custodyBalance: "4500.00",
    });
    expect(db.approvePackageSubmissionManagementAtomic).toHaveBeenCalledTimes(1);
    expect(db.approvePackageSubmissionManagementAtomic).toHaveBeenCalledWith({
      submissionId: 501,
      actorId: 90,
      rejections: [],
    });
    expect(ticketWorkflow.syncPathBTicketFromPurchaseOrder).toHaveBeenCalledTimes(2);
  });

  it("يسمح بتحديد رفض صنف من داخل الدفعة ويُبقي الرفض على مستوى الصنف", async () => {
    const caller = purchasePackagesRouter.createCaller(createContext("senior_management", 90));
    await caller.approveManagementSubmission({
      submissionId: 501,
      rejections: [{ itemId: 1001, reason: "سبب إداري واضح لرفض الصنف" }],
    });

    expect(db.approvePackageSubmissionManagementAtomic).toHaveBeenCalledWith({
      submissionId: 501,
      actorId: 90,
      rejections: [{ itemId: 1001, reason: "سبب إداري واضح لرفض الصنف" }],
    });
    expect(routerHelpers.notifyItemRejection).toHaveBeenCalledTimes(1);
    expect(routerHelpers.notifyItemRejection).toHaveBeenCalledWith(expect.objectContaining({
      itemId: 1001,
      kind: "rejected",
    }));
  });

  it("يرفض اعتماد دفعة الإرسال إذا كانت إحدى دفعات التسعير خارج مرحلة الإدارة", async () => {
    db._batches[1].status = "pending_accounting";
    const caller = purchasePackagesRouter.createCaller(createContext("senior_management", 90));

    await expect(caller.approveManagementSubmission({ submissionId: 501 })).rejects.toThrow();
    expect(db.approvePackageSubmissionManagementAtomic).not.toHaveBeenCalled();
  });

  it("المدير التنفيذي يبقى استعراض فقط ولا يستطيع اعتماد دفعة الإرسال", async () => {
    const caller = purchasePackagesRouter.createCaller(createContext("executive_director", 91));
    await expect(caller.approveManagementSubmission({ submissionId: 501 })).rejects.toThrow();
    expect(db.approvePackageSubmissionManagementAtomic).not.toHaveBeenCalled();
  });

  it("لا يسمح لدور الحسابات باستدعاء اعتماد الإدارة", async () => {
    const caller = purchasePackagesRouter.createCaller(createContext("accountant", 70));
    await expect(caller.approveManagementSubmission({ submissionId: 501 })).rejects.toThrow();
    expect(db.approvePackageSubmissionManagementAtomic).not.toHaveBeenCalled();
  });
});
