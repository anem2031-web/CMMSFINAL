import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure, warehouseProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";
import { issueCostAllocationsSchema } from "./issue-cost-allocation.schema";
import {
  hasActualDeliveryRecipient,
  isPendingTicketMaterialLink,
  shouldExposeTicketMaterialLink,
} from "@shared/ticketMaterialDelivery";
import { syncPathBTicketFromPurchaseOrder } from "../purchase/ticket-purchase-workflow";

interface InventoryTicketDeliveryContext {
  purchaseOrderItemId: number | null;
  purchaseOrderId: number | null;
  purchaseOrderItemStatus: string | null;
  purchaseSiteId: number | null;
  purchaseSectionId: number | null;
  ticketId: number | null;
  ticketNumber: string | null;
  ticketStatus: string | null;
  maintenancePath: string | null;
  ticketSiteId: number | null;
  ticketSectionId: number | null;
  ticketAssetId: number | null;
  assignedTechnicianId: number | null;
  assignedTechnicianName: string | null;
}

type WarehouseIssueCostTargetSuggestion = {
  beneficiarySiteId: number | null;
  beneficiarySectionId: number | null;
  beneficiaryAssetId: number | null;
  sourceType: "ticket" | "pmv2" | "purchase";
  sourceNumber: string | null;
  sourceLabel: string;
  complete: boolean;
};

type Pmv2WarehouseIssueContext = {
  materialRequestItemId: number;
  taskNumber: string | null;
  siteId: number | null;
  sectionId: number | null;
  assetId: number | null;
};

function toPositiveInt(value: unknown): number | null {
  const n = Number(value || 0);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function firstSqlRow(result: any): any | null {
  return ((result as any)?.[0] || [])[0] ?? null;
}

async function normalizeCostTarget(
  database: any,
  raw: { siteId?: number | null; sectionId?: number | null; assetId?: number | null },
): Promise<{ siteId: number | null; sectionId: number | null; assetId: number | null }> {
  let siteId = toPositiveInt(raw.siteId);
  let sectionId = toPositiveInt(raw.sectionId);
  let assetId = toPositiveInt(raw.assetId);

  // الأصل هو المرجع الأكثر تحديداً. إن كان صالحاً نشتق منه الموقع والقسم
  // حتى لو لم تكن الحقول مملوءة على المصدر نفسه.
  if (assetId) {
    const asset = firstSqlRow(await database.execute(`
      SELECT id, siteId, sectionId, status
      FROM assets
      WHERE id = ${assetId}
      LIMIT 1
    `));
    if (asset && String(asset.status || "") !== "disposed") {
      siteId = toPositiveInt(asset.siteId) ?? siteId;
      sectionId = toPositiveInt(asset.sectionId) ?? sectionId;
    } else {
      assetId = null;
    }
  }

  if (sectionId) {
    const section = firstSqlRow(await database.execute(`
      SELECT id, siteId, isActive
      FROM sections
      WHERE id = ${sectionId}
      LIMIT 1
    `));
    if (section && Number(section.isActive ?? 1) !== 0) {
      siteId = toPositiveInt(section.siteId) ?? siteId;
    } else {
      sectionId = null;
      assetId = null;
    }
  }

  if (siteId) {
    const site = firstSqlRow(await database.execute(`
      SELECT id, isActive
      FROM sites
      WHERE id = ${siteId}
      LIMIT 1
    `));
    if (!site || Number(site.isActive ?? 1) === 0) {
      siteId = null;
      sectionId = null;
      assetId = null;
    }
  }

  return { siteId, sectionId, assetId };
}

async function getPmv2WarehouseIssueContext(purchaseOrderItemId?: number | null): Promise<Pmv2WarehouseIssueContext | null> {
  const safePurchaseOrderItemId = toPositiveInt(purchaseOrderItemId);
  if (!safePurchaseOrderItemId) return null;
  const database = await db.getDb();
  if (!database) return null;

  const result = await database.execute(`
    SELECT
      link.materialRequestItemId,
      task.taskNumber,
      target.siteId,
      target.sectionId,
      target.assetId
    FROM pmv2_material_purchase_links link
    INNER JOIN pmv2_material_request_items requestItem
      ON requestItem.id = link.materialRequestItemId
    INNER JOIN pmv2_material_requests request
      ON request.id = requestItem.requestId
    INNER JOIN pmv2_task_items taskItem
      ON taskItem.id = request.taskItemId
    INNER JOIN pmv2_tasks task
      ON task.id = taskItem.taskId
    INNER JOIN pmv2_program_targets target
      ON target.id = task.programTargetId
    WHERE link.purchaseOrderItemId = ${safePurchaseOrderItemId}
    LIMIT 1
  `);
  const row = firstSqlRow(result);
  if (!row) return null;
  const normalized = await normalizeCostTarget(database, {
    siteId: toPositiveInt(row.siteId),
    sectionId: toPositiveInt(row.sectionId),
    assetId: toPositiveInt(row.assetId),
  });
  return {
    materialRequestItemId: Number(row.materialRequestItemId),
    taskNumber: row.taskNumber == null ? null : String(row.taskNumber),
    siteId: normalized.siteId,
    sectionId: normalized.sectionId,
    assetId: normalized.assetId,
  };
}

async function resolveCostTargetSuggestion(params: {
  context: InventoryTicketDeliveryContext | null;
  pmv2Context: Pmv2WarehouseIssueContext | null;
  poNumber: string | null;
}): Promise<WarehouseIssueCostTargetSuggestion | null> {
  const database = await db.getDb();
  if (!database) return null;

  // الأولوية: البلاغ > PM V2 > بيانات طلب الشراء.
  // هذا يضمن أن الجهة المستفيدة التشغيلية الأكثر تحديداً هي التي تملأ الحقول.
  if (params.context?.ticketId) {
    const normalized = await normalizeCostTarget(database, {
      siteId: params.context.ticketSiteId,
      sectionId: params.context.ticketSectionId,
      assetId: params.context.ticketAssetId,
    });
    if (normalized.siteId || normalized.sectionId || normalized.assetId) {
      return {
        beneficiarySiteId: normalized.siteId,
        beneficiarySectionId: normalized.sectionId,
        beneficiaryAssetId: normalized.assetId,
        sourceType: "ticket",
        sourceNumber: params.context.ticketNumber,
        sourceLabel: params.context.ticketNumber ? `البلاغ ${params.context.ticketNumber}` : "البلاغ المرتبط",
        complete: !!normalized.siteId && !!normalized.sectionId,
      };
    }
  }

  if (params.pmv2Context) {
    const { siteId, sectionId, assetId } = params.pmv2Context;
    if (siteId || sectionId || assetId) {
      return {
        beneficiarySiteId: siteId,
        beneficiarySectionId: sectionId,
        beneficiaryAssetId: assetId,
        sourceType: "pmv2",
        sourceNumber: params.pmv2Context.taskNumber,
        sourceLabel: params.pmv2Context.taskNumber ? `مهمة PM V2 ${params.pmv2Context.taskNumber}` : "مهمة PM V2 المرتبطة",
        complete: !!siteId && !!sectionId,
      };
    }
  }

  if (params.context?.purchaseOrderId) {
    const normalized = await normalizeCostTarget(database, {
      siteId: params.context.purchaseSiteId,
      sectionId: params.context.purchaseSectionId,
      assetId: null,
    });
    if (normalized.siteId || normalized.sectionId) {
      return {
        beneficiarySiteId: normalized.siteId,
        beneficiarySectionId: normalized.sectionId,
        beneficiaryAssetId: null,
        sourceType: "purchase",
        sourceNumber: params.poNumber,
        sourceLabel: params.poNumber ? `طلب الشراء ${params.poNumber}` : "طلب الشراء المرتبط",
        complete: !!normalized.siteId && !!normalized.sectionId,
      };
    }
  }

  return null;
}

// مطابق لمنطق شاشة دورة الشراء الحالية. نُبقيه هنا مؤقتاً حتى اعتماد WIS
// يدوياً؛ لا نغيّر مسارات الصرف الأربع القديمة في Patch 124.
async function getInventoryTicketDeliveryContext(
  inventoryId: number,
  purchaseOrderItemId?: number | null,
): Promise<InventoryTicketDeliveryContext | null> {
  const database = await db.getDb();
  if (!database) return null;

  const safePurchaseOrderItemId = purchaseOrderItemId ? Number(purchaseOrderItemId) : null;
  const safeInventoryId = Number(inventoryId);
  const rows = safePurchaseOrderItemId
    ? await database.execute(`
      SELECT
        poi.id AS purchaseOrderItemId,
        poi.purchaseOrderId,
        poi.status AS purchaseOrderItemStatus,
        po.siteId AS purchaseSiteId,
        po.sectionId AS purchaseSectionId,
        po.ticketId,
        t.ticketNumber,
        t.status AS ticketStatus,
        t.maintenancePath,
        t.siteId AS ticketSiteId,
        t.sectionId AS ticketSectionId,
        t.assetId AS ticketAssetId,
        t.assignedToId AS assignedTechnicianId,
        assigned.name AS assignedTechnicianName
      FROM purchase_order_items poi
      LEFT JOIN purchase_orders po ON po.id = poi.purchaseOrderId
      LEFT JOIN tickets t ON t.id = po.ticketId
      LEFT JOIN users assigned ON assigned.id = t.assignedToId
      WHERE poi.id = ${safePurchaseOrderItemId}
      LIMIT 1
    `)
    : await database.execute(`
      SELECT
        wri.purchaseOrderItemId,
        poi.purchaseOrderId,
        poi.status AS purchaseOrderItemStatus,
        po.siteId AS purchaseSiteId,
        po.sectionId AS purchaseSectionId,
        po.ticketId,
        t.ticketNumber,
        t.status AS ticketStatus,
        t.maintenancePath,
        t.siteId AS ticketSiteId,
        t.sectionId AS ticketSectionId,
        t.assetId AS ticketAssetId,
        t.assignedToId AS assignedTechnicianId,
        assigned.name AS assignedTechnicianName
      FROM inventory inv
      LEFT JOIN warehouse_receipt_items wri
        ON wri.inventoryId = inv.id
       AND wri.receiptId = inv.receiptId
      LEFT JOIN purchase_order_items poi
        ON poi.id = wri.purchaseOrderItemId
      LEFT JOIN purchase_orders po
        ON po.id = poi.purchaseOrderId
      LEFT JOIN tickets t
        ON t.id = po.ticketId
      LEFT JOIN users assigned
        ON assigned.id = t.assignedToId
      WHERE inv.id = ${safeInventoryId}
      ORDER BY wri.id DESC
      LIMIT 1
    `);

  const row = ((rows as any)?.[0] || [])[0] as any;
  if (!row) return null;
  return {
    purchaseOrderItemId: row.purchaseOrderItemId ? Number(row.purchaseOrderItemId) : null,
    purchaseOrderId: row.purchaseOrderId ? Number(row.purchaseOrderId) : null,
    purchaseOrderItemStatus: row.purchaseOrderItemStatus ?? null,
    purchaseSiteId: toPositiveInt(row.purchaseSiteId),
    purchaseSectionId: toPositiveInt(row.purchaseSectionId),
    ticketId: row.ticketId ? Number(row.ticketId) : null,
    ticketNumber: row.ticketNumber ?? null,
    ticketStatus: row.ticketStatus ?? null,
    maintenancePath: row.maintenancePath ?? null,
    ticketSiteId: toPositiveInt(row.ticketSiteId),
    ticketSectionId: toPositiveInt(row.ticketSectionId),
    ticketAssetId: toPositiveInt(row.ticketAssetId),
    assignedTechnicianId: row.assignedTechnicianId ? Number(row.assignedTechnicianId) : null,
    assignedTechnicianName: row.assignedTechnicianName ?? null,
  };
}

async function assertActualDeliveryRecipient(deliveredToId?: number | null): Promise<any> {
  if (!hasActualDeliveryRecipient(deliveredToId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "يجب اختيار الفني المستلم فعليًا قبل اعتماد سند الصرف" });
  }
  const recipient = await db.getUserById(Number(deliveredToId));
  if (!recipient || (recipient as any).isActive === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "الفني المستلم غير موجود أو غير نشط" });
  }
  if ((recipient as any).role !== "technician") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "المستلم الفعلي يجب أن يكون فنيًا" });
  }
  return recipient;
}

async function syncAndNotifyTicketMaterialDelivery(params: {
  purchaseOrderId: number;
  ticketId: number;
  actorId: number;
  actualRecipientId: number;
  actualRecipientName: string;
}): Promise<string | null> {
  const before = await db.getTicketById(params.ticketId);
  await syncPathBTicketFromPurchaseOrder(
    params.purchaseOrderId,
    params.actorId,
    "تم تسليم مادة مرتبطة بالبلاغ من سند الصرف المخزني",
  );
  const after = await db.getTicketById(params.ticketId);
  if (!after) return null;

  const justUnlockedRepair = before?.status !== "received_warehouse" && after.status === "received_warehouse";
  if (!justUnlockedRepair) return after.status;

  if (after.assignedToId) {
    await db.createNotification({
      userId: after.assignedToId,
      title: "📦 اكتمل تسليم مواد البلاغ - ابدأ الإصلاح",
      message: `اكتمل تسليم جميع مواد البلاغ ${after.ticketNumber}. المستلم الفعلي لآخر عملية: ${params.actualRecipientName}. يمكنك الآن بدء الإصلاح.`,
      type: "info",
      relatedTicketId: after.id,
    });
  }

  if (params.actualRecipientId !== after.assignedToId) {
    await db.createNotification({
      userId: params.actualRecipientId,
      title: "📦 استلام مواد نيابة عن فني البلاغ",
      message: `تم توثيق استلام مواد البلاغ ${after.ticketNumber} باسمك. يبقى البلاغ مسندًا للفني المسؤول المسجل في البلاغ.`,
      type: "info",
      relatedTicketId: after.id,
    });
  }

  const managers = await db.getTicketWorkflowManagerUsers(after);
  for (const manager of managers) {
    if (manager.id === params.actorId) continue;
    await db.createNotification({
      userId: manager.id,
      title: "📦 اكتمل تسليم مواد البلاغ",
      message: `اكتمل تسليم جميع مواد البلاغ ${after.ticketNumber}. المستلم الفعلي: ${params.actualRecipientName}. بانتظار بدء الإصلاح.`,
      type: "info",
      relatedTicketId: after.id,
    });
  }
  return after.status;
}

const lineSchema = z.object({
  inventoryId: z.number().int().positive(),
  lotTrackingToken: z.string().trim().min(1, "QR الدفعة أو رقم اللوت مطلوب"),
  quantity: z.number().min(0.001),
  unit: z.string().trim().min(1, "الوحدة مطلوبة"),
  costAllocations: issueCostAllocationsSchema,
});

export const warehouseIssueBatchesRouter = router({
  resolveLot: warehouseProcedure
    .input(z.object({
      warehouseId: z.number().int().positive(),
      code: z.string().trim().min(1, "QR الدفعة أو رقم اللوت مطلوب"),
    }))
    .mutation(async ({ input }) => {
      try {
        const lot = await db.resolveWarehouseIssueLot({
          warehouseId: input.warehouseId,
          identifier: input.code,
        });
        const context = await getInventoryTicketDeliveryContext(lot.inventoryId, lot.purchaseOrderItemId);
        const linkToTicket = !!context && shouldExposeTicketMaterialLink(context);
        const po = lot.purchaseOrderId ? await db.getPurchaseOrderById(lot.purchaseOrderId) : null;
        const poNumber = (po as any)?.poNumber ? String((po as any).poNumber) : null;
        const pmv2Context = await getPmv2WarehouseIssueContext(lot.purchaseOrderItemId);
        const costTargetSuggestion = await resolveCostTargetSuggestion({ context, pmv2Context, poNumber });

        return {
          ...lot,
          poNumber,
          linkedToTicket: linkToTicket,
          ticketId: linkToTicket ? context?.ticketId ?? null : null,
          ticketNumber: linkToTicket ? context?.ticketNumber ?? null : null,
          assignedTechnicianId: linkToTicket ? context?.assignedTechnicianId ?? null : null,
          assignedTechnicianName: linkToTicket ? context?.assignedTechnicianName ?? null : null,
          pmv2MaterialRequestItemId: pmv2Context?.materialRequestItemId ?? null,
          pmv2TaskNumber: pmv2Context?.taskNumber ?? null,
          costTargetSuggestion,
        };
      } catch (error: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error?.message || "تعذر التحقق من الدفعة" });
      }
    }),

  create: warehouseProcedure
    .input(z.object({
      warehouseId: z.number().int().positive(),
      deliveredToId: z.number().int().positive(),
      notes: z.string().trim().max(2000).optional(),
      lines: z.array(lineSchema).min(2, "الصرف المخزني المتعدد يتطلب مادتين على الأقل").max(20, "الحد الأعلى 20 بندًا في سند الصرف الواحد"),
    }))
    .mutation(async ({ input, ctx }) => {
      const warehouse = await db.getWarehouseById(input.warehouseId);
      if (!warehouse || Number((warehouse as any).isActive ?? 1) === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "المخزن المصدر غير موجود أو غير نشط" });
      }
      const recipient = await assertActualDeliveryRecipient(input.deliveredToId);
      const performer = await db.getUserById(ctx.user.id);

      const duplicateCostTargetKeys = new Set<string>();
      const requestedQuantityByLot = new Map<string, number>();
      const purchaseItemsMarkedDelivered = new Set<number>();
      const preflight: Array<{
        line: z.infer<typeof lineSchema>;
        lot: Awaited<ReturnType<typeof db.resolveWarehouseIssueLot>>;
        context: InventoryTicketDeliveryContext | null;
        pmv2Context: Pmv2WarehouseIssueContext | null;
        linkToTicket: boolean;
        markPurchaseOrderItemDelivered: boolean;
        sourcePoNumber: string | null;
      }> = [];

      for (const line of input.lines) {
        let lot;
        try {
          lot = await db.resolveWarehouseIssueLot({
            warehouseId: input.warehouseId,
            identifier: line.lotTrackingToken,
          });
        } catch (error: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error?.message || "تعذر التحقق من أحد اللوتات" });
        }
        if (lot.inventoryId !== line.inventoryId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `بيانات الصنف لا تطابق الدفعة ${lot.lotCode}` });
        }
        if (line.quantity > lot.lotBalanceQuantity) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `كمية الصرف للصنف ${lot.itemName} (${line.quantity}) أكبر من رصيد الدفعة ${lot.lotCode} (${lot.lotBalanceQuantity})`,
          });
        }

        const lotKey = `${lot.inventoryId}:${lot.lotId}`;
        const allocation = line.costAllocations[0];
        const costTargetKey = `${lotKey}:${allocation.beneficiarySiteId}:${allocation.beneficiarySectionId}:${allocation.beneficiaryAssetId ?? 0}`;
        if (duplicateCostTargetKeys.has(costTargetKey)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `الدفعة ${lot.lotCode} مضافة أكثر من مرة لنفس الموقع والقسم والأصل؛ غيّر الجهة المستفيدة أو عدّل السطر الموجود`,
          });
        }
        duplicateCostTargetKeys.add(costTargetKey);

        const requestedQuantity = Math.round((((requestedQuantityByLot.get(lotKey) || 0) + line.quantity) + Number.EPSILON) * 1000) / 1000;
        if (requestedQuantity > Number(lot.lotBalanceQuantity || 0)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `إجمالي الكمية المطلوبة من الدفعة ${lot.lotCode} (${requestedQuantity}) أكبر من رصيدها المتاح (${lot.lotBalanceQuantity})`,
          });
        }
        requestedQuantityByLot.set(lotKey, requestedQuantity);

        const context = await getInventoryTicketDeliveryContext(lot.inventoryId, lot.purchaseOrderItemId);
        const pendingTicketMaterial = !!context && isPendingTicketMaterialLink(context);
        const linkToTicket = !!context && shouldExposeTicketMaterialLink(context);
        if (pendingTicketMaterial && !context?.assignedTechnicianId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `لا يمكن صرف ${lot.itemName}: البلاغ المرتبط لا يملك فنيًا مسندًا` });
        }
        // نحتفظ بمرجع طلب الشراء كمعلومة مصدر للسند حتى لو لم يكن الصرف
        // مرتبطًا ببلاغ. هذا Snapshot توثيقي فقط ولا يغيّر Workflow الشراء.
        const sourcePo = lot.purchaseOrderId ? await db.getPurchaseOrderById(lot.purchaseOrderId) : null;
        const sourcePoNumber = (sourcePo as any)?.poNumber ? String((sourcePo as any).poNumber) : null;
        const pmv2Context = await getPmv2WarehouseIssueContext(lot.purchaseOrderItemId);
        const purchaseOrderItemId = linkToTicket ? toPositiveInt(context?.purchaseOrderItemId) : null;
        const markPurchaseOrderItemDelivered = !!purchaseOrderItemId && !purchaseItemsMarkedDelivered.has(purchaseOrderItemId);
        if (markPurchaseOrderItemDelivered && purchaseOrderItemId) {
          purchaseItemsMarkedDelivered.add(purchaseOrderItemId);
        }
        preflight.push({ line, lot, context, pmv2Context, linkToTicket, markPurchaseOrderItemDelivered, sourcePoNumber });
      }

      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الاتصال بقاعدة البيانات" });

      let transactionResult: any;
      try {
        transactionResult = await database.transaction(async (tx: any) => {
          const issueNumber = await db.getNextWarehouseIssueBatchNumber(tx);
          const batchId = await db.createWarehouseIssueBatch({
            issueNumber,
            warehouseId: input.warehouseId,
            warehouseName: String((warehouse as any).nameAr || (warehouse as any).nameEn || (warehouse as any).code || `مخزن #${input.warehouseId}`),
            deliveredToId: input.deliveredToId,
            deliveredToName: String((recipient as any).name || `فني #${input.deliveredToId}`),
            issuedById: ctx.user.id,
            issuedByName: String((performer as any)?.name || ctx.user.name || "مستخدم المستودع"),
            notes: input.notes || null,
            itemsCount: preflight.length,
          }, tx);

          const issuedLines: any[] = [];
          for (const row of preflight) {
            const { line, lot, context, pmv2Context, linkToTicket, markPurchaseOrderItemDelivered, sourcePoNumber } = row;
            const delivery = await db.issueDelivery({
              inventoryId: line.inventoryId,
              quantity: line.quantity,
              unit: line.unit,
              performedById: ctx.user.id,
              deliveredToId: input.deliveredToId,
              purchaseOrderItemId: linkToTicket ? context?.purchaseOrderItemId ?? undefined : undefined,
              ticketId: linkToTicket ? context?.ticketId ?? undefined : undefined,
              ticketNumber: linkToTicket ? context?.ticketNumber ?? undefined : undefined,
              assignedTechnicianId: linkToTicket ? context?.assignedTechnicianId ?? undefined : undefined,
              assignedTechnicianName: linkToTicket ? context?.assignedTechnicianName ?? undefined : undefined,
              notes: input.notes || (linkToTicket ? "تسليم مادة مرتبطة ببلاغ عبر سند صرف مخزني" : `صرف مخزني مجمع ${issueNumber}`),
              markPurchaseOrderItemDelivered,
              lotTrackingToken: lot.trackingToken,
              costAllocations: line.costAllocations,
            }, tx);

            if (!delivery.deliveryDocumentId || !delivery.inventoryTransactionId) {
              throw new Error(`تعذر توثيق حركة الصرف للصنف ${lot.itemName}`);
            }

            const wisReference = linkToTicket && context?.ticketId
              ? { type: "ticket", id: context.ticketId, number: context.ticketNumber }
              : pmv2Context
                ? { type: "pmv2", id: pmv2Context.materialRequestItemId, number: pmv2Context.taskNumber }
                : sourcePoNumber
                  ? { type: "purchase", id: lot.purchaseOrderId, number: sourcePoNumber }
                  : { type: null, id: null, number: null };

            await db.createWarehouseIssueBatchItem({
              batchId,
              deliveryDocumentId: Number(delivery.deliveryDocumentId),
              deliveryNumber: String(delivery.deliveryNumber),
              inventoryTransactionId: Number(delivery.inventoryTransactionId),
              inventoryLotId: Number(delivery.lotId),
              lotCode: String(delivery.lotCode),
              inventoryId: line.inventoryId,
              catalogItemId: lot.linkedItemId ?? null,
              itemName: String(delivery.itemName || lot.itemName),
              itemCode: lot.internalCode ?? null,
              quantity: Number(delivery.quantity),
              unit: String(delivery.unit || line.unit || ""),
              // WIS يحتفظ بمرجع تجميعي واحد للعرض والطباعة فقط. العلاقات
              // التشغيلية الحقيقية تبقى على DLV / Inventory / Ticket / Purchase.
              referenceType: wisReference.type,
              referenceId: wisReference.id == null ? null : Number(wisReference.id),
              referenceNumber: wisReference.number == null ? null : String(wisReference.number),
            }, tx);

            issuedLines.push({
              ...delivery,
              inventoryId: line.inventoryId,
              purchaseOrderId: linkToTicket ? context?.purchaseOrderId ?? null : null,
              purchaseOrderItemId: linkToTicket ? context?.purchaseOrderItemId ?? null : null,
              linkedToTicket: linkToTicket,
              ticketId: linkToTicket ? context?.ticketId ?? null : null,
              ticketNumber: linkToTicket ? context?.ticketNumber ?? null : null,
            });
          }
          return { batchId, issueNumber, lines: issuedLines };
        });
      } catch (error: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error?.message || "فشل اعتماد سند الصرف ولم يتم صرف أي بند" });
      }

      // مزامنة Workflow البلاغ تتم بعد نجاح الحركات، مثل شاشة دورة الشراء الحالية.
      // أي فشل هنا لا يدفع المستخدم لإعادة الصرف؛ نعيده كتحذير حتى لا تتكرر الحركة.
      const warnings: string[] = [];
      const syncedTicketKeys = new Set<string>();
      for (const row of transactionResult.lines as any[]) {
        if (!row.linkedToTicket || !row.purchaseOrderId || !row.ticketId) continue;
        const key = `${row.purchaseOrderId}:${row.ticketId}`;
        if (syncedTicketKeys.has(key)) continue;
        syncedTicketKeys.add(key);
        try {
          await syncAndNotifyTicketMaterialDelivery({
            purchaseOrderId: row.purchaseOrderId,
            ticketId: row.ticketId,
            actorId: ctx.user.id,
            actualRecipientId: input.deliveredToId,
            actualRecipientName: String((recipient as any).name || "فني"),
          });
        } catch (error: any) {
          console.error("[WIS] Ticket sync failed after issue commit:", error);
          warnings.push(`تم الصرف لكن تعذرت مزامنة البلاغ ${row.ticketNumber || row.ticketId}`);
        }
      }

      // بعد Commit لا نُرجع خطأً للمستخدم بسبب Audit فقط، لأن إعادة المحاولة
      // قد تكرر الصرف الذي تم فعليًا. نسجّل التحذير ونبقي نتيجة الصرف ناجحة.
      try {
        for (const row of transactionResult.lines as any[]) {
          await db.createAuditLog({
            userId: ctx.user.id,
            action: row.linkedToTicket ? "warehouse_issue_batch_ticket_line" : "warehouse_issue_batch_line",
            entityType: "inventory",
            entityId: row.inventoryId,
            newValues: {
              warehouseIssueBatchId: transactionResult.batchId,
              warehouseIssueNumber: transactionResult.issueNumber,
              deliveryNumber: row.deliveryNumber,
              deliveryDocumentId: row.deliveryDocumentId,
              inventoryTransactionId: row.inventoryTransactionId,
              lotId: row.lotId,
              quantity: row.quantity,
              deliveredToId: input.deliveredToId,
              purchaseOrderItemId: row.purchaseOrderItemId,
              ticketId: row.ticketId,
            },
          });
        }

        await db.createAuditLog({
          userId: ctx.user.id,
          action: "create_warehouse_issue_batch",
          entityType: "warehouse_issue_batch",
          entityId: transactionResult.batchId,
          newValues: {
            issueNumber: transactionResult.issueNumber,
            warehouseId: input.warehouseId,
            deliveredToId: input.deliveredToId,
            itemsCount: transactionResult.lines.length,
            deliveryNumbers: transactionResult.lines.map((line: any) => line.deliveryNumber),
          },
        });
      } catch (error) {
        console.error("[WIS] Audit log failed after issue commit:", error);
        warnings.push("تم الصرف بنجاح لكن تعذر حفظ جزء من سجل التدقيق؛ لا تُعد تنفيذ الصرف");
      }

      return {
        success: true,
        id: transactionResult.batchId,
        issueNumber: transactionResult.issueNumber,
        itemsCount: transactionResult.lines.length,
        deliveryNumbers: transactionResult.lines.map((line: any) => line.deliveryNumber),
        warnings,
      };
    }),

  list: protectedProcedure.query(async () => db.getWarehouseIssueBatches()),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const row = await db.getWarehouseIssueBatchById(input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "سند الصرف المخزني غير موجود" });
      return row;
    }),

  incrementPrint: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => ({ printCount: await db.incrementWarehouseIssueBatchPrintCount(input.id) })),
});
