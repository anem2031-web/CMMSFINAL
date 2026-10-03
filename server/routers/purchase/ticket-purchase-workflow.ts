import { TRPCError } from "@trpc/server";
import { APP_ROLE } from "@shared/roles";
import {
  ACTIVE_PATH_B_PURCHASE_ORDER_STATUSES,
  derivePathBTicketPurchaseStatus,
} from "@shared/pathBPurchaseWorkflow";
import * as db from "../../_core/db";
import { assertTicketWorkflowManageable, assertTicketItemWorkflowManageable } from "../tickets/tickets.access";

export const PATH_B_TICKET_PURCHASE_CREATOR_ROLES = new Set<string>([
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
  APP_ROLE.IT_MANAGER,
  APP_ROLE.ADMIN,
  APP_ROLE.OWNER,
]);

const TERMINAL_TICKET_STATUSES = new Set<string>([
  "in_progress",
  "ready_for_closure",
  "repaired",
  "verified",
  "closed",
  "requester_confirmed",
]);

const TERMINAL_ITEM_STATUSES = new Set<string>(["cancelled", "rejected"]);
export interface TicketPurchaseUser {
  id: number;
  role: string;
}

export interface AssertTicketPurchaseOptions {
  currentPurchaseOrderId?: number;
  submittingExistingDraft?: boolean;
  /**
   * بند البلاغ المستهدف — الخطوة 4 (2026-08-08). إن مُرِّر، يُفحص مسار وحالة
   * *البند* بدل البلاغ، والتعارض (طلب نشط واحد) يُفحص على مستوى البند لا
   * البلاغ كاملًا — كل بند على مسار B يحصل على طلب شراء مستقل تمامًا عن بقية
   * بنود نفس البلاغ. إن لم يُمرَّر: السلوك القديم حرفيًا (فحص على مستوى البلاغ)
   * — يغطي كل الطلبات القديمة والبلاغات أحادية البند دون أي تغيير.
   */
  ticketItemId?: number;
}

/**
 * Ticket-linked purchase orders are a Path B workflow action, not a generic
 * protected action. Standalone purchase orders remain governed by the normal
 * purchase-order authorization policy.
 */
export async function assertCanCreateTicketLinkedPurchaseOrder(
  user: TicketPurchaseUser,
  ticketId?: number,
  options: AssertTicketPurchaseOptions = {},
): Promise<any | null> {
  if (!ticketId) return null;

  const ticket = await db.getTicketById(ticketId);
  if (!ticket) {
    throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ المرتبط غير موجود" });
  }

  if (!PATH_B_TICKET_PURCHASE_CREATOR_ROLES.has(user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "إنشاء طلب شراء مرتبط ببلاغ متاح فقط لمسؤول المسار المخول لهذا البلاغ",
    });
  }

  let item: any = null;
  if (options.ticketItemId) {
    item = await db.getTicketItemById(options.ticketItemId);
    if (!item || item.ticketId !== ticketId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "بند البلاغ غير مطابق لهذا البلاغ" });
    }
    assertTicketItemWorkflowManageable(user, ticket as any, item as any);
  } else {
    assertTicketWorkflowManageable(user, ticket as any);
  }

  const relevantPath = item ? item.maintenancePath : ticket.maintenancePath;
  const relevantStatus = item ? item.status : ticket.status;

  if (relevantPath !== "B") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: item
        ? "لا يمكن إنشاء طلب شراء مرتبط إلا لبند تم اعتماد المسار B له"
        : "لا يمكن إنشاء طلب شراء مرتبط إلا لبلاغ تم اعتماد المسار B له",
    });
  }

  const allowedStatuses = options.submittingExistingDraft
    ? new Set(["work_approved", "needs_purchase"])
    : new Set(["work_approved"]);
  if (!allowedStatuses.has(relevantStatus)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `لا يمكن إنشاء طلب شراء جديد في الحالة الحالية: ${relevantStatus}`,
    });
  }

  const linkedOrders = item
    ? await db.getPurchaseOrdersByTicketItemId(options.ticketItemId!)
    : await db.getPurchaseOrdersByTicketId(ticketId);
  const conflictingOrder = linkedOrders.find((po: any) =>
    po.id !== options.currentPurchaseOrderId && ACTIVE_PATH_B_PURCHASE_ORDER_STATUSES.has(po.status)
  );
  if (conflictingOrder) {
    throw new TRPCError({
      code: "CONFLICT",
      message: item
        ? `يوجد طلب شراء نشط مرتبط بهذا البند بالفعل (${conflictingOrder.poNumber || conflictingOrder.id})`
        : `يوجد طلب شراء نشط مرتبط بهذا البلاغ بالفعل (${conflictingOrder.poNumber || conflictingOrder.id})`,
    });
  }

  return ticket;
}

/**
 * Recomputes the Path B ticket stage from all linked purchase orders. Final or
 * repair-stage tickets are immutable here, so a late PO update cannot reopen a
 * completed ticket.
 */
export async function syncPathBTicketFromTicketId(
  ticketId: number,
  actorId: number,
  notes = "مزامنة حالة البلاغ مع دورة طلب الشراء",
): Promise<void> {
  const ticket = await db.getTicketById(ticketId);
  if (!ticket || ticket.maintenancePath !== "B") return;
  if (TERMINAL_TICKET_STATUSES.has(ticket.status)) return;

  const linkedOrders = await db.getPurchaseOrdersByTicketId(ticketId);
  const allItems = (
    await Promise.all(linkedOrders.map((linked: any) => db.getPOItems(linked.id)))
  ).flat();

  const nextStatus = derivePathBTicketPurchaseStatus({
    purchaseOrders: linkedOrders.map((linked: any) => ({ id: linked.id, status: linked.status })),
    items: allItems.map((item: any) => ({ purchaseOrderId: item.purchaseOrderId, status: item.status })),
  });

  // حتى لو كان رأس البلاغ بالفعل في nextStatus، قد يكون بند التنفيذ الوحيد
  // متأخرًا بسبب إجراء legacy سابق. نزامنه أولًا ثم نتجنب History مكررًا.
  await db.syncSingleTicketItem(ticket.id, { status: nextStatus });
  if (nextStatus === ticket.status) return;
  await db.updateTicket(ticket.id, { status: nextStatus });
  await db.addTicketStatusHistory({
    ticketId: ticket.id,
    fromStatus: ticket.status,
    toStatus: nextStatus,
    changedById: actorId,
    notes,
  });
}

/**
 * نظير syncPathBTicketFromTicketId على مستوى البند — الخطوة 4 (2026-08-08).
 * تُحدِّث حالة *البند* من دورة طلبات الشراء المرتبطة به تحديدًا، لا كل طلبات
 * البلاغ. **توافق رجعي**: إن كان هذا البند الأول (`itemNumber === 1`)، يُعكَس
 * نفس التحديث على أعمدة البلاغ أيضًا — نفس مبدأ approveWorkForItem بالخطوة 3.
 */
export async function syncPathBTicketItemFromItemId(
  ticketItemId: number,
  actorId: number,
  notes = "مزامنة حالة البند مع دورة طلب الشراء",
): Promise<void> {
  const item = await db.getTicketItemById(ticketItemId);
  if (!item || item.maintenancePath !== "B") return;
  if (TERMINAL_TICKET_STATUSES.has(item.status)) return;

  const linkedOrders = await db.getPurchaseOrdersByTicketItemId(ticketItemId);
  const allItems = (
    await Promise.all(linkedOrders.map((linked: any) => db.getPOItems(linked.id)))
  ).flat();

  const nextStatus = derivePathBTicketPurchaseStatus({
    purchaseOrders: linkedOrders.map((linked: any) => ({ id: linked.id, status: linked.status })),
    items: allItems.map((poItem: any) => ({ purchaseOrderId: poItem.purchaseOrderId, status: poItem.status })),
  });

  if (nextStatus === item.status) return;
  await db.updateTicketItem(item.id, { status: nextStatus });
  await db.addTicketStatusHistory({
    ticketId: item.ticketId,
    fromStatus: item.status,
    toStatus: nextStatus,
    changedById: actorId,
    notes: `بند ${item.itemNumber} — ${notes}`,
  });

  if (item.itemNumber === 1) {
    await db.updateTicket(item.ticketId, { status: nextStatus });
  }
}

export async function syncPathBTicketFromPurchaseOrder(
  purchaseOrderId: number,
  actorId: number,
  notes = "مزامنة حالة البلاغ مع دورة طلب الشراء",
): Promise<void> {
  const po = await db.getPurchaseOrderById(purchaseOrderId);
  if (!po?.ticketId) return;
  if (po.ticketItemId) {
    await syncPathBTicketItemFromItemId(po.ticketItemId, actorId, notes);
    return;
  }
  await syncPathBTicketFromTicketId(po.ticketId, actorId, notes);
}

export async function assertPathBMaterialsDeliveredToTechnician(ticketId: number): Promise<void> {
  const ticket = await db.getTicketById(ticketId);
  if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
  if (ticket.maintenancePath !== "B") return;

  const linkedOrders = await db.getPurchaseOrdersByTicketId(ticketId);
  const activeOrders = linkedOrders.filter((po: any) => ACTIVE_PATH_B_PURCHASE_ORDER_STATUSES.has(po.status));
  if (activeOrders.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "لا يوجد طلب شراء نشط مرتبط بالبلاغ" });
  }

  const allItems = (
    await Promise.all(activeOrders.map((po: any) => db.getPOItems(po.id)))
  ).flat().filter((item: any) => !TERMINAL_ITEM_STATUSES.has(item.status));

  if (allItems.length === 0 || !allItems.every((item: any) => item.status === "delivered_to_requester")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "لا يمكن بدء إصلاح المسار B قبل تسليم جميع المواد الفعالة إلى الفني فعليًا",
    });
  }
}

/**
 * نظير assertPathBMaterialsDeliveredToTechnician على مستوى البند — المرحلة 6
 * التكميلية (2026-08-10)، سدًا للثغرة الموثَّقة عند بناء startRepairForItem:
 * كان بند مسار B يستطيع بدء التنفيذ دون التحقق من وصول مواده فعليًا، لأن
 * الفحص القديم يعمل على `ticket.maintenancePath` فقط (يعكس البند الأول دومًا،
 * لا بند تحديدًا). **لا تُستدعى إلا من `startRepairForItem`** — الإجراء
 * القديم `startRepair` يبقى يستدعي النسخة الأصلية أعلاه بلا أي تغيير.
 */
export async function assertPathBMaterialsDeliveredToTechnicianForItem(ticketItemId: number): Promise<void> {
  const item = await db.getTicketItemById(ticketItemId);
  if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "بند البلاغ غير موجود" });
  if (item.maintenancePath !== "B") return;

  const linkedOrders = await db.getPurchaseOrdersByTicketItemId(ticketItemId);
  const activeOrders = linkedOrders.filter((po: any) => ACTIVE_PATH_B_PURCHASE_ORDER_STATUSES.has(po.status));
  if (activeOrders.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "لا يوجد طلب شراء نشط مرتبط بهذا البند" });
  }

  const allItems = (
    await Promise.all(activeOrders.map((po: any) => db.getPOItems(po.id)))
  ).flat().filter((poItem: any) => !TERMINAL_ITEM_STATUSES.has(poItem.status));

  if (allItems.length === 0 || !allItems.every((poItem: any) => poItem.status === "delivered_to_requester")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "لا يمكن بدء تنفيذ هذا البند قبل تسليم جميع المواد الفعالة إلى الفني فعليًا",
    });
  }
}
