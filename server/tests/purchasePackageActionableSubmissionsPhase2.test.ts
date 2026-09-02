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
  const pkg: any = { id: 10, packageNumber: "PB-2026-00010", createdById: 50 };
  const pos: any[] = [
    { id: 101, poNumber: "PR-0101", status: "pending_accounting", requestedById: 1, packageId: 10 },
    { id: 102, poNumber: "PR-0102", status: "pending_accounting", requestedById: 2, packageId: 10 },
    { id: 103, poNumber: "PR-0103", status: "pending_management", requestedById: 3, packageId: 10 },
  ];
  const submissions: any[] = [
    {
      id: 501,
      purchasePackageId: 10,
      subNumber: 1,
      createdById: 30,
      status: null,
      custodyBalance: null,
      totalEstimatedCost: null,
      createdAt: "2026-08-31T06:00:00.000Z",
      batches: [
        { id: 601, purchaseOrderId: 101, status: "pending_accounting", totalEstimatedCost: "1000.00" },
        { id: 602, purchaseOrderId: 102, status: "pending_accounting", totalEstimatedCost: "2000.00" },
      ],
    },
    {
      id: 502,
      purchasePackageId: 10,
      subNumber: 2,
      createdById: 30,
      status: "pending_management",
      custodyBalance: "4500.00",
      totalEstimatedCost: "1500.00",
      createdAt: "2026-08-31T07:00:00.000Z",
      batches: [
        { id: 603, purchaseOrderId: 103, status: "pending_management", totalEstimatedCost: "1500.00" },
      ],
    },
    {
      id: 503,
      purchasePackageId: 10,
      subNumber: 3,
      createdById: 30,
      status: "approved",
      custodyBalance: "5000.00",
      totalEstimatedCost: "900.00",
      createdAt: "2026-08-31T08:00:00.000Z",
      batches: [
        { id: 604, purchaseOrderId: 101, status: "approved", totalEstimatedCost: "900.00" },
      ],
    },
  ];

  return {
    getPurchasePackagesList: vi.fn(async () => [pkg]),
    getPurchaseOrders: vi.fn(async () => pos.map((p) => ({ ...p }))),
    getPackageSubmissionsWithBatches: vi.fn(async () => submissions.map((s) => ({
      ...s,
      batches: s.batches.map((b: any) => ({ ...b })),
    }))),

    // بقية دوال الراوتر غير مطلوبة هنا، لكنها موجودة لمنع أي استيراد جانبي.
    getUserIdsByRole: vi.fn(async () => []),
    getPOItemsByDelegate: vi.fn(async () => []),
    getPurchaseOrdersByPackage: vi.fn(async () => pos),
    getPurchaseCards: vi.fn(async () => []),
    getPurchasePackageById: vi.fn(async () => pkg),
    getPurchasePackageSubmissionById: vi.fn(async () => null),
    getPricingBatchesBySubmission: vi.fn(async () => []),
    getPurchaseOrderById: vi.fn(async (id: number) => pos.find((p) => p.id === id) || null),
    getPOItems: vi.fn(async () => []),
    getUsersByRole: vi.fn(async () => []),
    createNotification: vi.fn(async () => undefined),
    createAuditLog: vi.fn(async () => undefined),
    createPurchasePackage: vi.fn(),
    addOrderToPackage: vi.fn(),
    removeOrderFromPackage: vi.fn(),
    deletePurchasePackage: vi.fn(),
    createPurchasePackageSubmission: vi.fn(),
    approvePackageSubmissionAccountingAtomic: vi.fn(),
    approvePackageSubmissionManagementAtomic: vi.fn(),
  };
});

const { purchasePackagesRouter } = await import("../routers/purchase/purchase-packages.router");

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

describe("Purchase Packages — actionable submissions in Phase 2", () => {
  beforeEach(() => vi.clearAllMocks());

  it("الحسابات ترى دفعة الإرسال مرة واحدة بدل تكرار طلباتها", async () => {
    const caller = purchasePackagesRouter.createCaller(createContext("accountant", 70));
    const result = await caller.actionableSubmissionsForMe();

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      submissionId: 501,
      packageId: 10,
      submissionNumber: "PB-2026-00010-1",
      status: "pending_accounting",
      orderIds: [101, 102],
      orderCount: 2,
      totalEstimatedCost: "3000.00",
    });
  });

  it("الإدارة العليا ترى فقط دفعة الإرسال التي وصلت لمرحلتها", async () => {
    const caller = purchasePackagesRouter.createCaller(createContext("senior_management", 90));
    const result = await caller.actionableSubmissionsForMe();

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      submissionId: 502,
      submissionNumber: "PB-2026-00010-2",
      status: "pending_management",
      orderIds: [103],
      orderCount: 1,
      custodyBalance: "4500.00",
      totalEstimatedCost: "1500.00",
    });
  });

  it("الدفعة المعتمدة نهائيًا لا تظهر كإجراء للحسابات أو الإدارة", async () => {
    const accountant = purchasePackagesRouter.createCaller(createContext("accountant", 70));
    const management = purchasePackagesRouter.createCaller(createContext("senior_management", 90));

    const [accountingResult, managementResult] = await Promise.all([
      accountant.actionableSubmissionsForMe(),
      management.actionableSubmissionsForMe(),
    ]);

    expect(accountingResult.items.some((item: any) => item.submissionId === 503)).toBe(false);
    expect(managementResult.items.some((item: any) => item.submissionId === 503)).toBe(false);
  });

  it("لا يضيف تبويب الدفعات إجراءً جديدًا للمدير التنفيذي أو المندوب", async () => {
    const executive = purchasePackagesRouter.createCaller(createContext("executive_director", 91));
    const delegate = purchasePackagesRouter.createCaller(createContext("delegate", 30));

    await expect(executive.actionableSubmissionsForMe()).resolves.toEqual({ items: [], total: 0 });
    await expect(delegate.actionableSubmissionsForMe()).resolves.toEqual({ items: [], total: 0 });
  });
});
