import { beforeEach, describe, expect, it, vi } from "vitest";
import { purchasePackagesRouter } from "../routers/purchase/purchase-packages.router";
import type { TrpcContext } from "../_core/context";

vi.mock("../routers/_shared/router-helpers", () => ({
  notifyItemRejection: vi.fn(async () => undefined),
}));

vi.mock("../routers/purchase/purchase-orders.router", () => ({
  submitPricedBatchForPO: vi.fn(async (purchaseOrderId: number) => ({
    success: true,
    batchId: 9000 + purchaseOrderId,
    itemCount: 1,
  })),
}));

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

vi.mock("../_core/db", () => {
  const packages = [{ id: 10, packageNumber: "PB-2026-00010", createdById: 50, createdAt: new Date() }];
  const pos: any[] = [];
  const items: any[] = [];
  const submissions: any[] = [];

  const packageCards = () => [{
    cardType: "package" as const,
    key: "package:10",
    id: 10,
    packageNumber: "PB-2026-00010",
    createdById: 50,
    createdAt: new Date(),
    orders: pos.filter((p) => p.packageId === 10).map((p) => ({
      ...p,
      items: items.filter((i) => i.purchaseOrderId === p.id),
    })),
  }];

  return {
    getPurchasePackageById: vi.fn(async (id: number) => packages.find((p) => p.id === id) || null),
    getPurchasePackagesList: vi.fn(async () => [...packages]),
    getPurchaseOrdersByPackage: vi.fn(async (packageId: number) => pos.filter((p) => p.packageId === packageId)),
    getPurchaseOrderById: vi.fn(async (id: number) => pos.find((p) => p.id === id) || null),
    getPurchaseOrders: vi.fn(async () => [...pos]),
    getPOItems: vi.fn(async (poId: number) => items.filter((i) => i.purchaseOrderId === poId)),
    getPOItemsByDelegate: vi.fn(async (delegateId: number) => items.filter((i) => i.delegateId === delegateId)),
    getPurchaseCards: vi.fn(async () => packageCards()),
    getPackageSubmissionsWithBatches: vi.fn(async () => submissions),
    getUserIdsByRole: vi.fn(async (role: string) => role === "food_warehouse_assistant" ? [21, 22] : []),
    createPurchasePackage: vi.fn(async (orderIds: number[], createdById: number) => ({
      id: 11,
      packageNumber: "PB-2026-00011",
      createdById,
      orderIds,
    })),
    addOrderToPackage: vi.fn(async () => undefined),
    removeOrderFromPackage: vi.fn(async () => undefined),
    deletePurchasePackage: vi.fn(async () => undefined),
    createPurchasePackageSubmission: vi.fn(async () => ({ id: 701, subNumber: 1 })),

    _reset: () => {
      pos.length = 0;
      items.length = 0;
      submissions.length = 0;

      // طلب صاحب id=1 + طلب مستخدم آخر ضمن نفس الحزمة.
      pos.push({ id: 101, poNumber: "PR-0101", status: "pending_review", requestedById: 1, packageId: 10 });
      pos.push({ id: 102, poNumber: "PR-0102", status: "pending_review", requestedById: 999, packageId: 10 });
      items.push({ id: 1001, purchaseOrderId: 101, delegateId: null, itemName: "Own item" });
      items.push({ id: 1002, purchaseOrderId: 102, delegateId: null, itemName: "Hidden item" });

      submissions.push({
        id: 501,
        purchasePackageId: 10,
        subNumber: 1,
        createdById: 30,
        batches: [
          { id: 601, purchaseOrderId: 101, status: "pending_accounting" },
          { id: 602, purchaseOrderId: 102, status: "pending_accounting" },
        ],
      });
    },

    _setFoodScenario: () => {
      pos.length = 0;
      items.length = 0;
      submissions.length = 0;
      // مدير مستودع الأغذية id=20؛ مساعدوه 21 و22.
      pos.push({ id: 201, poNumber: "PR-0201", status: "pending_review", requestedById: 21, packageId: null });
      pos.push({ id: 202, poNumber: "PR-0202", status: "pending_review", requestedById: 22, packageId: null });
      pos.push({ id: 203, poNumber: "PR-0203", status: "pending_review", requestedById: 999, packageId: null });
    },

    _pos: pos,
    _items: items,
    _submissions: submissions,
  };
});

const db = await import("../_core/db") as any;
const purchaseOrderRouterModule = await import("../routers/purchase/purchase-orders.router") as any;

describe("Purchase Packages — Phase 1 visibility parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db._reset();
  });

  it("getById يعيد لصاحب الطلب طلبه فقط ولا يكشف الطلب الآخر في نفس الحزمة", async () => {
    const caller = purchasePackagesRouter.createCaller(createContext("purchase_requester", 1));
    const result = await caller.getById({ id: 10 });
    expect(result.orders.map((po: any) => po.id)).toEqual([101]);
    expect(result.orders[0].items.map((i: any) => i.id)).toEqual([1001]);
  });

  it("cards لا تجعل الحزمة طريقًا جانبيًا لرؤية طلب مستخدم آخر", async () => {
    const caller = purchasePackagesRouter.createCaller(createContext("purchase_requester", 1));
    const result = await caller.cards();
    expect(result).toHaveLength(1);
    expect(result[0].cardType).toBe("package");
    expect((result[0] as any).orders.map((po: any) => po.id)).toEqual([101]);
  });

  it("submissions تخفي Pricing Batch المرتبط بطلب غير مرئي", async () => {
    const caller = purchasePackagesRouter.createCaller(createContext("purchase_requester", 1));
    const result = await caller.submissions({ packageId: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].batches.map((b: any) => b.purchaseOrderId)).toEqual([101]);
  });

  it("إرسال المندوب يعالج فقط طلبات الحزمة التي تقع ضمن نطاق رؤيته الحالي", async () => {
    db._items.length = 0;
    db._items.push({ id: 1101, purchaseOrderId: 101, delegateId: 30, itemName: "Assigned" });
    db._items.push({ id: 1102, purchaseOrderId: 102, delegateId: 99, itemName: "Other delegate" });

    const caller = purchasePackagesRouter.createCaller(createContext("delegate", 30));
    const result = await caller.submitPackageBatch({ packageId: 10 });

    expect(result.sent.map((row: any) => row.poNumber)).toEqual(["PR-0101"]);
    expect(purchaseOrderRouterModule.submitPricedBatchForPO).toHaveBeenCalledTimes(1);
    expect(purchaseOrderRouterModule.submitPricedBatchForPO).toHaveBeenCalledWith(
      101,
      expect.objectContaining({ id: 30, role: "delegate" }),
      { purchasePackageSubmissionId: 701 }
    );
  });

  it("مدير مستودع الأغذية يستطيع تجميع طلبات المساعدين ضمن نطاقه", async () => {
    db._setFoodScenario();
    const caller = purchasePackagesRouter.createCaller(createContext("food_warehouse_manager", 20));
    await expect(caller.create({ orderIds: [201, 202] })).resolves.toMatchObject({ id: 11 });
  });

  it("مدير مستودع الأغذية لا يستطيع إدخال طلب خارج نطاقه في الحزمة", async () => {
    db._setFoodScenario();
    const caller = purchasePackagesRouter.createCaller(createContext("food_warehouse_manager", 20));
    await expect(caller.create({ orderIds: [201, 203] })).rejects.toThrow();
  });

  it("مدير مستودع الأغذية لا يستطيع إضافة طلب مسموح له إلى حزمة تحتوي طلبًا خارج نطاقه", async () => {
    db._setFoodScenario();
    db._pos.find((p: any) => p.id === 203).packageId = 10;

    const caller = purchasePackagesRouter.createCaller(createContext("food_warehouse_manager", 20));
    await expect(caller.addOrder({ packageId: 10, orderId: 201 })).rejects.toThrow();
    expect(db.addOrderToPackage).not.toHaveBeenCalled();
  });

  it("المستخدم غير المخول بإدارة التجميع لا يستطيع حذف حزمة فارغة", async () => {
    for (const po of db._pos) po.packageId = null;

    const caller = purchasePackagesRouter.createCaller(createContext("purchase_requester", 1));
    await expect(caller.delete({ id: 10 })).rejects.toThrow();
    expect(db.deletePurchasePackage).not.toHaveBeenCalled();
  });
});
