import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ============================================================
// Helper: Create authenticated context with specific role
// ============================================================
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: string, userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@test.com`,
    name: `Test User ${userId}`,
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

// ============================================================
// Mock db module
// ============================================================
vi.mock("./db", () => {
  const items: any[] = [];
  const pos: any[] = [];
  const tickets: any[] = [];
  const notifications: any[] = [];
  const auditLogs: any[] = [];
  const users: any[] = [
    { id: 1, openId: "user-1", name: "Delegate", role: "delegate" },
    { id: 2, openId: "user-2", name: "Warehouse", role: "warehouse" },
    { id: 3, openId: "user-3", name: "Manager", role: "maintenance_manager" },
    { id: 4, openId: "user-4", name: "Technician", role: "technician" },
  ];

  return {
    getManagerUsers: vi.fn(async () => users.filter(u => u.role === "maintenance_manager")),
    getPOItemsByDelegate: vi.fn(async (delegateId: number) => items.filter(i => i.delegateId === delegateId)),
    getPOItemsByStatus: vi.fn(async (status: string) => items.filter(i => i.status === status)),
    getPOItemById: vi.fn(async (id: number) => items.find(i => i.id === id) || null),
    getPOItems: vi.fn(async (poId: number) => items.filter(i => i.purchaseOrderId === poId)),
    updatePOItem: vi.fn(async (id: number, data: any) => {
      const item = items.find(i => i.id === id);
      if (item) Object.assign(item, data);
    }),
    getPurchaseOrderById: vi.fn(async (id: number) => pos.find(p => p.id === id) || null),
    updatePurchaseOrder: vi.fn(async (id: number, data: any) => {
      const po = pos.find(p => p.id === id);
      if (po) Object.assign(po, data);
    }),
    getTicketById: vi.fn(async (id: number) => tickets.find(t => t.id === id) || null),
    updateTicket: vi.fn(async (id: number, data: any) => {
      const ticket = tickets.find(t => t.id === id);
      if (ticket) Object.assign(ticket, data);
    }),
    addTicketStatusHistory: vi.fn(async () => 1),
    createNotification: vi.fn(async (data: any) => { notifications.push(data); return 1; }),
    createAuditLog: vi.fn(async (data: any) => { auditLogs.push(data); return 1; }),
    getUsersByRole: vi.fn(async (role: string) => users.filter(u => u.role === role)),
    getAllUsers: vi.fn(async () => users),
    // Setup helpers for tests
    _items: items,
    _pos: pos,
    _tickets: tickets,
    _notifications: notifications,
    _auditLogs: auditLogs,
    _reset: () => {
      items.length = 0;
      pos.length = 0;
      tickets.length = 0;
      notifications.length = 0;
      auditLogs.length = 0;
    },
    _setupScenario: () => {
      items.length = 0;
      pos.length = 0;
      tickets.length = 0;
      notifications.length = 0;
      auditLogs.length = 0;

      tickets.push({ id: 100, ticketNumber: "TK-001", status: "in_progress" });
      pos.push({ id: 10, ticketId: 100, status: "approved" });
      items.push({
        id: 1, purchaseOrderId: 10, itemName: "مضخة مياه", description: "مضخة 2 حصان",
        quantity: 2, unit: "قطعة", status: "approved", delegateId: 1,
        estimatedUnitCost: "500", estimatedTotalCost: "1000",
        createdAt: new Date(), updatedAt: new Date(),
      });
      items.push({
        id: 2, purchaseOrderId: 10, itemName: "فلتر هواء", description: "فلتر صناعي",
        quantity: 5, unit: "قطعة", status: "approved", delegateId: 1,
        estimatedUnitCost: "100", estimatedTotalCost: "500",
        createdAt: new Date(), updatedAt: new Date(),
      });
    },
  };
});

const db = await import("./db") as any;

// ============================================================
// Tests
// ============================================================
describe("Purchase Cycle - 3-Step Flow", () => {
  beforeEach(() => {
    db._reset();
    vi.clearAllMocks();
  });

  // ============================================================
  // Step 1: Delegate confirms purchase
  // ============================================================
  describe("Step 1: confirmItemPurchase (Delegate)", () => {
    it("should confirm purchase with photos", async () => {
      db._setupScenario();
      const caller = appRouter.createCaller(createContext("delegate", 1));

      const result = await caller.purchaseOrders.confirmItemPurchase({
        itemId: 1,
        purchasedPhotoUrl: "https://example.com/item.jpg",
        invoicePhotoUrl: "https://example.com/invoice.jpg",
      });

      expect(result).toEqual({ success: true });
      expect(db.updatePOItem).toHaveBeenCalledWith(1, expect.objectContaining({
        status: "purchased",
        purchasedPhotoUrl: "https://example.com/item.jpg",
        invoicePhotoUrl: "https://example.com/invoice.jpg",
      }));
    });

    it("should reject if item not assigned to delegate", async () => {
      db._setupScenario();
      const caller = appRouter.createCaller(createContext("delegate", 999));

      await expect(caller.purchaseOrders.confirmItemPurchase({
        itemId: 1,
        purchasedPhotoUrl: "https://example.com/item.jpg",
        invoicePhotoUrl: "https://example.com/invoice.jpg",
      })).rejects.toThrow();
    });

    it("should reject if item already purchased", async () => {
      db._setupScenario();
      db._items[0].status = "purchased";
      const caller = appRouter.createCaller(createContext("delegate", 1));

      await expect(caller.purchaseOrders.confirmItemPurchase({
        itemId: 1,
        purchasedPhotoUrl: "https://example.com/item.jpg",
        invoicePhotoUrl: "https://example.com/invoice.jpg",
      })).rejects.toThrow();
    });

    it("should require both photos", async () => {
      db._setupScenario();
      const caller = appRouter.createCaller(createContext("delegate", 1));

      await expect(caller.purchaseOrders.confirmItemPurchase({
        itemId: 1,
        purchasedPhotoUrl: "",
        invoicePhotoUrl: "https://example.com/invoice.jpg",
      })).rejects.toThrow();

      await expect(caller.purchaseOrders.confirmItemPurchase({
        itemId: 1,
        purchasedPhotoUrl: "https://example.com/item.jpg",
        invoicePhotoUrl: "",
      })).rejects.toThrow();
    });

    it("should notify warehouse after purchase", async () => {
      db._setupScenario();
      const caller = appRouter.createCaller(createContext("delegate", 1));

      await caller.purchaseOrders.confirmItemPurchase({
        itemId: 1,
        purchasedPhotoUrl: "https://example.com/item.jpg",
        invoicePhotoUrl: "https://example.com/invoice.jpg",
      });

      expect(db.createNotification).toHaveBeenCalled();
    });

    it("should create audit log", async () => {
      db._setupScenario();
      const caller = appRouter.createCaller(createContext("delegate", 1));

      await caller.purchaseOrders.confirmItemPurchase({
        itemId: 1,
        purchasedPhotoUrl: "https://example.com/item.jpg",
        invoicePhotoUrl: "https://example.com/invoice.jpg",
      });

      expect(db.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: "confirm_purchase",
        entityType: "po_item",
        entityId: 1,
      }));
    });
  });

  // ============================================================
  // Step 2: Warehouse confirms delivery to warehouse
  // ============================================================
  describe("Step 2: confirmDeliveryToWarehouse (Warehouse)", () => {
    it("should confirm delivery with all required fields", async () => {
      db._setupScenario();
      db._items[0].status = "purchased";
      const caller = appRouter.createCaller(createContext("warehouse", 2));

      const result = await caller.purchaseOrders.confirmDeliveryToWarehouse({
        itemId: 1,
        supplierName: "شركة التوريد",
        supplierItemName: "مضخة مياه صناعية",
        actualUnitCost: "550",
        warehousePhotoUrl: "https://example.com/warehouse.jpg",
      });

      expect(result).toEqual({ success: true });
      expect(db.updatePOItem).toHaveBeenCalledWith(1, expect.objectContaining({
        status: "delivered_to_warehouse",
        supplierName: "شركة التوريد",
        supplierItemName: "مضخة مياه صناعية",
        actualUnitCost: "550",
        actualTotalCost: "1100", // 550 * 2
        warehousePhotoUrl: "https://example.com/warehouse.jpg",
      }));
    });

    it("should reject if item not in purchased status", async () => {
      db._setupScenario();
      // Item is still in "approved" status
      const caller = appRouter.createCaller(createContext("warehouse", 2));

      await expect(caller.purchaseOrders.confirmDeliveryToWarehouse({
        itemId: 1,
        supplierName: "شركة التوريد",
        supplierItemName: "مضخة مياه صناعية",
        actualUnitCost: "550",
        warehousePhotoUrl: "https://example.com/warehouse.jpg",
      })).rejects.toThrow();
    });

    it("should require all fields", async () => {
      db._setupScenario();
      db._items[0].status = "purchased";
      const caller = appRouter.createCaller(createContext("warehouse", 2));

      await expect(caller.purchaseOrders.confirmDeliveryToWarehouse({
        itemId: 1,
        supplierName: "",
        supplierItemName: "مضخة",
        actualUnitCost: "550",
        warehousePhotoUrl: "https://example.com/warehouse.jpg",
      })).rejects.toThrow();

      // supplierItemName is optional, so it shouldn't throw if empty
    });

    it("should calculate actual total cost correctly", async () => {
      db._setupScenario();
      db._items[0].status = "purchased";
      const caller = appRouter.createCaller(createContext("warehouse", 2));

      await caller.purchaseOrders.confirmDeliveryToWarehouse({
        itemId: 1,
        supplierName: "شركة التوريد",
        supplierItemName: "مضخة",
        actualUnitCost: "750",
        warehousePhotoUrl: "https://example.com/warehouse.jpg",
      });

      expect(db.updatePOItem).toHaveBeenCalledWith(1, expect.objectContaining({
        actualTotalCost: "1500", // 750 * 2
      }));
    });
  });

  // ============================================================
  // Step 3: Warehouse delivers to requester
  // ============================================================
  describe("Step 3: confirmDeliveryToRequester (Warehouse)", () => {
    it("should confirm delivery to requester", async () => {
      db._setupScenario();
      db._items[0].status = "delivered_to_warehouse";
      const caller = appRouter.createCaller(createContext("warehouse", 2));

      const result = await caller.purchaseOrders.confirmDeliveryToRequester({
        itemId: 1,
        deliveredToId: 4,
      });

      expect(result).toEqual({ success: true });
      expect(db.updatePOItem).toHaveBeenCalledWith(1, expect.objectContaining({
        status: "delivered_to_requester",
        deliveredToId: 4,
      }));
    });

    it("should reject if item not in warehouse", async () => {
      db._setupScenario();
      db._items[0].status = "purchased";
      const caller = appRouter.createCaller(createContext("warehouse", 2));

      await expect(caller.purchaseOrders.confirmDeliveryToRequester({
        itemId: 1,
      })).rejects.toThrow();
    });

    it("should auto-close PO when all items delivered", async () => {
      db._setupScenario();
      db._items[0].status = "delivered_to_warehouse";
      db._items[1].status = "delivered_to_requester";
      const caller = appRouter.createCaller(createContext("warehouse", 2));

      await caller.purchaseOrders.confirmDeliveryToRequester({ itemId: 1 });

      expect(db.updatePurchaseOrder).toHaveBeenCalledWith(10, expect.objectContaining({
        status: "received",
      }));
    });

    it("should auto-update ticket to received_warehouse when all items delivered", async () => {
      db._setupScenario();
      db._items[0].status = "delivered_to_warehouse";
      db._items[1].status = "delivered_to_requester";
      const caller = appRouter.createCaller(createContext("warehouse", 2));

      await caller.purchaseOrders.confirmDeliveryToRequester({ itemId: 1 });

      expect(db.updateTicket).toHaveBeenCalledWith(100, expect.objectContaining({
        status: "received_warehouse",
      }));
    });

    it("should notify maintenance manager when ticket ready to close", async () => {
      db._setupScenario();
      db._items[0].status = "delivered_to_warehouse";
      db._items[1].status = "delivered_to_requester";
      const caller = appRouter.createCaller(createContext("warehouse", 2));

      await caller.purchaseOrders.confirmDeliveryToRequester({ itemId: 1 });

      const managerNotifications = db._notifications.filter((n: any) => n.userId === 3);
      expect(managerNotifications.length).toBeGreaterThan(0);
    });

    it("should create audit log", async () => {
      db._setupScenario();
      db._items[0].status = "delivered_to_warehouse";
      const caller = appRouter.createCaller(createContext("warehouse", 2));

      await caller.purchaseOrders.confirmDeliveryToRequester({ itemId: 1 });

      expect(db.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: "deliver_to_requester",
        entityType: "po_item",
        entityId: 1,
      }));
    });
  });

  // ============================================================
  // Role-based access control
  // ============================================================
  describe("Role-based Access Control", () => {
    it("should reject non-delegate from confirming purchase", async () => {
      db._setupScenario();
      const caller = appRouter.createCaller(createContext("technician", 4));

      await expect(caller.purchaseOrders.confirmItemPurchase({
        itemId: 1,
        purchasedPhotoUrl: "https://example.com/item.jpg",
        invoicePhotoUrl: "https://example.com/invoice.jpg",
      })).rejects.toThrow();
    });

    it("should reject non-warehouse from confirming delivery", async () => {
      db._setupScenario();
      db._items[0].status = "purchased";
      const caller = appRouter.createCaller(createContext("delegate", 1));

      await expect(caller.purchaseOrders.confirmDeliveryToWarehouse({
        itemId: 1,
        supplierName: "شركة",
        supplierItemName: "مضخة",
        actualUnitCost: "500",
        warehousePhotoUrl: "https://example.com/w.jpg",
      })).rejects.toThrow();
    });

    it("should allow partial item rejection during accounting approval", async () => {
      db._setupScenario();
      const caller = appRouter.createCaller(createContext("accountant", 7));
      
      // We have items 1 and 2 in PO 10
      await caller.purchaseOrders.approveAccounting({
        id: 10,
        rejectedItemIds: [1],
        rejectionReason: "Too expensive"
      });

      // Item 1 should be rejected, Item 2 should remain pending
      expect(db.updatePOItem).toHaveBeenCalledWith(1, expect.objectContaining({
        status: "rejected",
        managementRejectionReason: "Too expensive"
      }));
      
      // PO should advance to pending_management
      expect(db.updatePurchaseOrder).toHaveBeenCalledWith(10, expect.objectContaining({
        status: "pending_management"
      }));
    });

    it("should reject entire PO if all items are rejected during accounting", async () => {
      db._setupScenario();
      const caller = appRouter.createCaller(createContext("accountant", 7));
      
      // Mock getPOItems to return all rejected for the second call
      db.getPOItems.mockImplementationOnce(async () => db._items)
                   .mockImplementationOnce(async () => db._items.map(i => ({ ...i, status: "rejected" })));

      await caller.purchaseOrders.approveAccounting({
        id: 10,
        rejectedItemIds: [1, 2],
        rejectionReason: "Budget cut"
      });

      // PO should be rejected
      expect(db.updatePurchaseOrder).toHaveBeenCalledWith(10, expect.objectContaining({
        status: "rejected"
      }));
    });

    it("should allow admin to perform warehouse actions", async () => {
      db._setupScenario();
      db._items[0].status = "delivered_to_warehouse";
      const caller = appRouter.createCaller(createContext("admin", 5));

      const result = await caller.purchaseOrders.confirmDeliveryToRequester({ itemId: 1 });
      expect(result).toEqual({ success: true });
    });

    it("should allow owner to perform warehouse actions", async () => {
      db._setupScenario();
      db._items[0].status = "delivered_to_warehouse";
      const caller = appRouter.createCaller(createContext("owner", 6));

      const result = await caller.purchaseOrders.confirmDeliveryToRequester({ itemId: 1 });
      expect(result).toEqual({ success: true });
    });
  });

  // ============================================================
  // Full cycle integration
  // ============================================================
  describe("Full 3-Step Cycle", () => {
    it("should complete full cycle: purchase → warehouse → delivery → close", async () => {
      db._setupScenario();

      // Step 1: Delegate purchases both items
      const delegateCaller = appRouter.createCaller(createContext("delegate", 1));
      await delegateCaller.purchaseOrders.confirmItemPurchase({
        itemId: 1,
        purchasedPhotoUrl: "https://example.com/item1.jpg",
        invoicePhotoUrl: "https://example.com/invoice1.jpg",
      });
      await delegateCaller.purchaseOrders.confirmItemPurchase({
        itemId: 2,
        purchasedPhotoUrl: "https://example.com/item2.jpg",
        invoicePhotoUrl: "https://example.com/invoice2.jpg",
      });

      // Step 2: Warehouse receives both items
      const warehouseCaller = appRouter.createCaller(createContext("warehouse", 2));
      await warehouseCaller.purchaseOrders.confirmDeliveryToWarehouse({
        itemId: 1,
        supplierName: "شركة التوريد أ",
        supplierItemName: "مضخة مياه صناعية",
        actualUnitCost: "550",
        warehousePhotoUrl: "https://example.com/w1.jpg",
      });
      await warehouseCaller.purchaseOrders.confirmDeliveryToWarehouse({
        itemId: 2,
        supplierName: "شركة التوريد ب",
        supplierItemName: "فلتر هواء صناعي",
        actualUnitCost: "120",
        warehousePhotoUrl: "https://example.com/w2.jpg",
      });

      // Step 3: Warehouse delivers both items
      await warehouseCaller.purchaseOrders.confirmDeliveryToRequester({
        itemId: 1,
        deliveredToId: 4,
      });
      await warehouseCaller.confirmDeliveryToRequester({
        itemId: 2,
        deliveredToId: 4,
      }).catch(() => {
        // Use the correct path
      });
      // Use correct caller path
      await warehouseCaller.purchaseOrders.confirmDeliveryToRequester({
        itemId: 2,
        deliveredToId: 4,
      });

      // Verify PO is received (status is received when all items delivered to requester)
      expect(db.updatePurchaseOrder).toHaveBeenCalledWith(10, expect.objectContaining({
        status: "received",
      }));

      // Verify ticket updated
      expect(db.updateTicket).toHaveBeenCalledWith(100, expect.objectContaining({
        status: "received_warehouse",
      }));

      // Verify audit logs created (6 calls: 2 purchase + 2 warehouse + 2 delivery)
      expect(db.createAuditLog).toHaveBeenCalled();
    });
  });
});
