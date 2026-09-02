import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_core/db", () => {
  const state: any = {
    po: { id: 101, poNumber: "PR-0101", status: "pending_estimate", requestedById: 1 },
    items: [] as any[],
    nextBatchId: 601,
    nextBatchNumber: 1,
  };
  return {
    getPurchaseOrderById: vi.fn(async (id: number) => id === state.po.id ? { ...state.po } : null),
    getPOItems: vi.fn(async () => state.items.map((i: any) => ({ ...i }))),
    getNextBatchNumber: vi.fn(async () => state.nextBatchNumber),
    createPOPricingBatch: vi.fn(async () => state.nextBatchId),
    updatePOItem: vi.fn(async (id: number, patch: any) => {
      const item = state.items.find((i: any) => i.id === id);
      if (item) Object.assign(item, patch);
    }),
    updatePurchaseOrder: vi.fn(async (_id: number, patch: any) => Object.assign(state.po, patch)),
    getUsersByRole: vi.fn(async (role: string) => role === "accountant" ? [{ id: 70 }] : []),
    createNotification: vi.fn(async () => undefined),
    createAuditLog: vi.fn(async () => undefined),
    createAttachment: vi.fn(async () => 9001),
    _state: state,
  };
});

vi.mock("../_core/notification", () => ({ notifyOwner: vi.fn(async () => undefined) }));
vi.mock("../services/translation/translation", () => ({ detectLanguage: vi.fn(async () => "ar") }));
vi.mock("../services/translation/translationEngine", () => ({ queueTranslation: vi.fn(async () => undefined) }));
vi.mock("../routers/_shared/router-helpers", () => ({ notifyItemRejection: vi.fn(async () => undefined) }));
vi.mock("../services/export/exportService", () => ({
  generatePurchaseRequestPDF: vi.fn(async () => Buffer.from("%PDF-delegate-pricing")),
}));
vi.mock("../_core/storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ key })),
}));
vi.mock("../_core/catalog-unit-governance", () => ({ findKnownInactiveCatalogUnitNames: vi.fn(async () => []) }));
vi.mock("../_core/authz/guard", () => ({
  assertCanViewPurchaseOrder: vi.fn(),
  filterVisiblePurchaseOrders: vi.fn(async (_user: any, rows: any[]) => rows),
  assertCanPerformPOAction: vi.fn(),
  assertCanPerformItemPOAction: vi.fn(),
  assertPOItemAssignedToDelegate: vi.fn(),
  isItemAssignedToPODelegate: vi.fn((user: any, item: any) => item.delegateId === user.id),
  assertCanPerformItemStatusPOAction: vi.fn(),
  assertCanResolveReturnedPOItem: vi.fn(),
  assertCanRequestDelegateChange: vi.fn(),
  assertCanResolveDelegateChange: vi.fn(),
}));
vi.mock("../routers/purchase/actionable", () => ({ computeActionablePOs: vi.fn(() => []) }));
vi.mock("../routers/purchase/pricing-batch-state", () => ({ rejectEmptyPendingPricingBatches: vi.fn(async () => undefined) }));
vi.mock("../routers/purchase/ticket-purchase-workflow", () => ({
  assertCanCreateTicketLinkedPurchaseOrder: vi.fn(async () => null),
  syncPathBTicketFromPurchaseOrder: vi.fn(async () => undefined),
  syncPathBTicketFromTicketId: vi.fn(async () => undefined),
}));

const { submitPricedBatchForPO } = await import("../routers/purchase/purchase-orders.router");
const db = await import("../_core/db") as any;
const exportService = await import("../services/export/exportService") as any;
const storage = await import("../_core/storage") as any;

describe("Delegate pricing documents — standalone purchase orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db._state.po.status = "pending_estimate";
    db._state.nextBatchId = 601;
    db._state.nextBatchNumber = 1;
  });

  it("يؤرشف وثيقة واحدة عند إرسال دفعة جزئية من طلب شراء منفرد", async () => {
    db._state.items = [
      { id: 1001, purchaseOrderId: 101, delegateId: 30, status: "estimated", batchId: null, delegateChangeRequestedAt: null, estimatedTotalCost: "100.00" },
      { id: 1002, purchaseOrderId: 101, delegateId: 30, status: "pending", batchId: null, delegateChangeRequestedAt: null, estimatedTotalCost: null },
    ];

    const result = await submitPricedBatchForPO(101, { id: 30, role: "delegate" });

    expect(result).toMatchObject({ success: true, itemCount: 1, pricingDocumentArchived: true });
    expect(exportService.generatePurchaseRequestPDF).toHaveBeenCalledTimes(1);
    expect(exportService.generatePurchaseRequestPDF).toHaveBeenCalledWith(101, 30, 601);
    expect(storage.storagePut).toHaveBeenCalledTimes(1);
    expect(db.createAttachment).toHaveBeenCalledTimes(1);
    expect(db.createAttachment).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "delegate_pricing_batch",
      entityId: 601,
      fileName: "PR-0101-دفعة1-تسعير-مندوب.pdf",
      uploadedById: 30,
    }));
  });

  it("يؤرشف وثيقة واحدة أيضًا عندما يكون إرسال الطلب المنفرد كاملًا", async () => {
    db._state.items = [
      { id: 1001, purchaseOrderId: 101, delegateId: 30, status: "estimated", batchId: null, delegateChangeRequestedAt: null, estimatedTotalCost: "100.00" },
      { id: 1002, purchaseOrderId: 101, delegateId: 30, status: "estimated", batchId: null, delegateChangeRequestedAt: null, estimatedTotalCost: "200.00" },
    ];

    const result = await submitPricedBatchForPO(101, { id: 30, role: "delegate" });

    expect(result).toMatchObject({ success: true, itemCount: 2, pricingDocumentArchived: true });
    expect(db.createAttachment).toHaveBeenCalledTimes(1);
    expect(db.createAttachment).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "delegate_pricing_batch",
      entityId: 601,
    }));
  });

  it("لا يلغي إرسال التسعير إذا فشل تخزين وثيقة المندوب ويعيد حالة الأرشفة للواجهة", async () => {
    db._state.items = [
      { id: 1001, purchaseOrderId: 101, delegateId: 30, status: "estimated", batchId: null, delegateChangeRequestedAt: null, estimatedTotalCost: "100.00" },
    ];
    storage.storagePut.mockRejectedValueOnce(new Error("storage unavailable"));

    const result = await submitPricedBatchForPO(101, { id: 30, role: "delegate" });

    expect(result).toMatchObject({ success: true, pricingDocumentArchived: false });
    expect(db.createAttachment).not.toHaveBeenCalled();
  });
});
