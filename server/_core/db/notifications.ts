// ============================================================
// db/notifications.ts — الإشعارات واشتراكات Push
// (مُقسَّم من db.ts الأصلي حسب المجال الوظيفي)
// ============================================================
import { eq, desc, asc, and, sql, count, sum, inArray, notInArray, like, or, gte, lte, lt, isNull, isNotNull, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { alias } from "drizzle-orm/mysql-core";
import mysql from "mysql2/promise";
import {
  InsertUser, users, tickets, purchaseOrders, purchaseOrderItems,
  inventory, inventoryTransactions, notifications, auditLogs,
  ticketStatusHistory, attachments, sites, backups,
  assets, preventivePlans, pmWorkOrders, assetSpareParts, pmJobs, assetMetrics,
  pmChecklistItems, pmWorkOrderBranches,
  twoFactorSecrets, twoFactorAuditLogs,
  pushSubscriptions, sections, technicians, inspectionResults,
  type InsertAsset, type InsertPreventivePlan, type PreventivePlan, type InsertPMWorkOrder,
  type InsertSection, type InsertInspectionResult,
  assetCategories,
  procurementComments,
  type InsertProcurementComment,
  warehouseReceipts,
  warehouseReturns,
  warehouseReceiptItems,
  ocrJobs,
  type InsertWarehouseReceipt,
  type InsertWarehouseReturn,
  ticketConfirmations,
  type InsertTicketConfirmation,
  deliveryDocuments,
  returnDocuments,
  deliveryNumberCounter,
  itemBarcodeCounter,
  disposalOperations,
  disposalItems,
  disposalNumberCounter,
  poPricingBatches,
  type InsertPOPricingBatch,
  inventoryCountOperations,
  inventoryCountItems,
  inventorySettlements,
  inventorySettlementItems,
  inventoryCountNumberCounter,
  inventorySettlementNumberCounter,
} from "../../../drizzle/schema";
import { ENV } from '../env';
import { APP_ROLE } from '../../../shared/roles';


import { getDb } from "./client";
import { getUserById } from "./deletes";

// ============================================================
// NOTIFICATIONS
// ============================================================
// Lazy import to avoid circular deps
let _webPush: typeof import('../../services/notifications/webPush') | null = null;
async function getWebPush() {
  if (!_webPush) _webPush = await import('../../services/notifications/webPush');
  return _webPush;
}

// Lazy import to avoid circular deps (translation engine also touches the db layer)
let _translationEngine: typeof import('../../services/translation/translationEngine') | null = null;
async function getTranslationEngine() {
  if (!_translationEngine) _translationEngine = await import('../../services/translation/translationEngine');
  return _translationEngine;
}

/**
 * كل عناوين/رسائل الإشعارات في الكود مكتوبة يدوياً بالعربية (انظر جميع نداءات
 * createNotification عبر tickets/purchase/inventory routers). لضمان وصول
 * الإشعار مترجَماً لأي مستخدم يفضّل الإنجليزية أو الأردية، نمرّر محتوى كل
 * إشعار جديد لمحرك الترجمة المركزي (نفس الآلية المستخدمة لعناوين/أوصاف
 * البلاغات) — تعمل في الخلفية (fire-and-forget) ولا تُبطئ إنشاء الإشعار.
 */
function queueNotificationTranslation(notificationId: number, title: string, message: string, userId: number) {
  getTranslationEngine().then(te => {
    te.queueTranslation({
      entityType: "NOTIFICATION",
      entityId: notificationId,
      fields: [
        { fieldName: "title", text: title },
        { fieldName: "message", text: message },
      ],
      sourceLanguage: "ar",
      userId,
    }).catch(e => console.error("[Notifications] Queue translation failed:", e));
  }).catch(() => {});
}

export async function createNotification(data: { userId: number; title: string; message: string; type?: string; relatedTicketId?: number; relatedPoId?: number; allowSeniorManagement?: boolean; allowItManager?: boolean }) {
  const db = await getDb();
  if (!db) return;

  // ── Restricted-role notification policies ───────────────────────────────
  // Senior Management receives only its explicit purchase-approval exception.
  // IT Manager receives only two explicit direct notifications:
  // 1) a newly routed IT ticket, 2) a newly generated PM V2 team task.
  // Default-deny here prevents purchase/SLA/closure/warehouse/general broadcasts
  // from leaking to the IT role when future notification call sites are added.
  if (!data.allowSeniorManagement || !data.allowItManager) {
    const recipient = await getUserById(data.userId);
    if (recipient?.role === APP_ROLE.SENIOR_MANAGEMENT && !data.allowSeniorManagement) {
      console.warn(
        `[Notifications] Blocked notification to senior_management (userId=${data.userId}): "${data.title}" — not in the allowed exception list.`
      );
      return;
    }
    if (recipient?.role === APP_ROLE.IT_MANAGER && !data.allowItManager) {
      console.warn(
        `[Notifications] Blocked notification to it_manager (userId=${data.userId}): "${data.title}" — only IT ticket routing and new PM V2 task notifications are allowed.`
      );
      return;
    }
  }

  const [notifInsertResult] = await db.insert(notifications).values({
    userId: data.userId,
    title: data.title,
    message: data.message,
    type: data.type as any,
    relatedTicketId: data.relatedTicketId,
    relatedPoId: data.relatedPoId,
  });
  if (notifInsertResult?.insertId) {
    queueNotificationTranslation(notifInsertResult.insertId, data.title, data.message, data.userId);
  }

  // ── تعميم تلقائي لـ"مدير المستودع الغذائي" على أي تحديث لاحق لطلب اعتمده ──
  // هذا الدور لا يستقبل أي إشعار عام (كـ"طلب جديد بانتظار المراجعة")، لكن لازم
  // يعرف بأي تطور لاحق يحصل على طلب هو شخصيًا اعتمده (reviewedById بجدول الطلب).
  // نطبّقها هنا مركزياً بدل تكرارها بكل نقطة إشعار بدورة الشراء.
  if (data.relatedPoId) {
    const poRows = await db.select({ reviewedById: purchaseOrders.reviewedById })
      .from(purchaseOrders).where(eq(purchaseOrders.id, data.relatedPoId)).limit(1);
    const reviewerId = poRows[0]?.reviewedById;
    if (reviewerId && reviewerId !== data.userId) {
      const reviewer = await getUserById(reviewerId);
      if (reviewer?.role === "food_warehouse_manager") {
        const [reviewerNotifResult] = await db.insert(notifications).values({
          userId: reviewerId,
          title: data.title,
          message: data.message,
          type: data.type as any,
          relatedTicketId: data.relatedTicketId,
          relatedPoId: data.relatedPoId,
        });
        if (reviewerNotifResult?.insertId) {
          queueNotificationTranslation(reviewerNotifResult.insertId, data.title, data.message, reviewerId);
        }
        getWebPush().then(wp => {
          const url = `/purchase-orders/${data.relatedPoId}`;
          wp.sendPushToUser(reviewerId, {
            title: data.title, body: data.message, type: data.type || "info",
            tag: `notif-${reviewerId}-${Date.now()}`, url,
          }).catch(() => {});
        }).catch(() => {});
      }
    }
  }

  // Send Web Push notification asynchronously (fire-and-forget)
  getWebPush().then(wp => {
    const url = data.relatedTicketId ? `/tickets/${data.relatedTicketId}` :
                data.relatedPoId ? `/purchase-orders/${data.relatedPoId}` : "/notifications";
    wp.sendPushToUser(data.userId, {
      title: data.title,
      body: data.message,
      type: data.type || "info",
      tag: `notif-${data.userId}-${Date.now()}`,
      url,
    }).catch(() => {}); // Ignore push errors
  }).catch(() => {});
}

export async function getUserNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(50);
}

export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ cnt: count() }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result[0]?.cnt || 0;
}

// ============================================================
// PUSH SUBSCRIPTIONS
// ============================================================
export async function savePushSubscription(data: {
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  // Upsert by endpoint
  const existing = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, data.endpoint)).limit(1);
  if (existing.length > 0) {
    await db.update(pushSubscriptions).set({ userId: data.userId, p256dh: data.p256dh, auth: data.auth }).where(eq(pushSubscriptions.endpoint, data.endpoint));
    return existing[0].id;
  }
  const result = await db.insert(pushSubscriptions).values(data);
  return result[0].insertId;
}

export async function deletePushSubscription(endpoint: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function getPushSubscriptionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

export async function getAllPushSubscriptions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pushSubscriptions);
}

export async function getAllPOItems() {
  const db = await getDb();
  if (!db) return [];
  const items = await db.select().from(purchaseOrderItems).orderBy(desc(purchaseOrderItems.createdAt));
  return items.map(i => ({
    ...i,
    estimatedById: i.estimatedById ? Number(i.estimatedById) : null,
    delegateId: i.delegateId ? Number(i.delegateId) : null,
    purchasedById: i.purchasedById ? Number(i.purchasedById) : null,
    receivedById: i.receivedById ? Number(i.receivedById) : null,
    deliveredById: i.deliveredById ? Number(i.deliveredById) : null,
    deliveredToId: i.deliveredToId ? Number(i.deliveredToId) : null,
  }));
}

