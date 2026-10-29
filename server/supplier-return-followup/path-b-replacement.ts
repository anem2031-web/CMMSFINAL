import { sql } from "drizzle-orm";
import { getDb } from "../_core/db/client";
import { supplierReturnDatabaseEnabled } from "./feature";
import {
  replacementNeedCoverage,
  type NeedReplacement,
  type NeedReceipt,
  type NeedDelivery,
} from "./need-coverage";
type PurchaseItem = { id: number; purchaseOrderId: number; status: string };
const chunkSize = 500;

/** Preserve original identities; derive fulfillment from net physical delivery.
 * Only items participating in an actual supplier return are adjusted. */
export async function activePathBItemsAfterReplacement<T extends PurchaseItem>(
  items: T[]
): Promise<T[]> {
  if (!items.length) return items;
  const db = await getDb();
  if (!db)
    throw Error("Database unavailable while checking replacement delivery");
  async function read(query: any): Promise<any[]> {
    const [rows] = await db!.execute(query);
    if (!Array.isArray(rows))
      throw Error("Invalid replacement delivery response");
    return rows;
  }
  const [database] = await read(sql`SELECT DATABASE() AS databaseName`);
  if (!supplierReturnDatabaseEnabled(database?.databaseName)) return items;
  const ids = Array.from(new Set(items.map(item => Number(item.id))));
  if (ids.some(id => !Number.isSafeInteger(id) || id <= 0))
    throw Error("Invalid purchase item ID");
  const included = new Set(ids),
    links: NeedReplacement[] = [];
  for (let offset = 0; offset < ids.length; offset += chunkSize) {
    const part = sql.join(
      ids.slice(offset, offset + chunkSize).map(id => sql`${id}`),
      sql`,`
    );
    const rows =
      await read(sql`SELECT c.purchaseOrderItemId AS sourceItemId,replacement.id AS replacementItemId,
        plan.originalQuantityCovered,c.returnedUnit,plan.status AS replacementStatus
      FROM supplier_return_cases c
      INNER JOIN purchase_order_items source ON source.id=c.purchaseOrderItemId AND source.purchaseOrderId=c.purchaseOrderId
      LEFT JOIN supplier_return_replacement_plans plan ON plan.caseId=c.id AND plan.planNumber=1
      LEFT JOIN purchase_order_items replacement ON replacement.id=plan.purchaseOrderItemId AND replacement.purchaseOrderId=plan.purchaseOrderId
      WHERE source.id IN (${part})`);
    for (const row of rows)
      links.push({
        sourceItemId: Number(row.sourceItemId),
        replacementItemId:
          row.replacementItemId == null ? null : Number(row.replacementItemId),
        quantityCovered: String(row.originalQuantityCovered ?? "0"),
        originalUnit: String(row.returnedUnit),
        received:
          row.replacementStatus === "received" &&
          included.has(Number(row.replacementItemId)),
      });
  }
  if (!links.length) return items;
  const involved = new Set(
    links.flatMap(link => [
      link.sourceItemId,
      ...(link.replacementItemId != null && included.has(link.replacementItemId)
        ? [link.replacementItemId]
        : []),
    ])
  );
  const receipts: NeedReceipt[] = [],
    deliveries: NeedDelivery[] = [],
    involvedIds = Array.from(involved);
  for (let offset = 0; offset < involvedIds.length; offset += chunkSize) {
    const part = sql.join(
      involvedIds.slice(offset, offset + chunkSize).map(id => sql`${id}`),
      sql`,`
    );
    const received =
      await read(sql`SELECT l.purchaseOrderItemId AS itemId,l.originalQuantity AS quantity,l.issueUnit AS unit
      FROM inventory_lots l INNER JOIN warehouse_receipt_items r ON r.id=l.receiptItemId AND r.receiptId=l.receiptId
        AND r.purchaseOrderItemId=l.purchaseOrderItemId
      WHERE l.sourceType='receipt' AND l.purchaseOrderItemId IN (${part})`);
    receipts.push(
      ...received.map(row => ({
        itemId: Number(row.itemId),
        quantity: String(row.quantity),
        unit: String(row.unit ?? ""),
      }))
    );
    const issued =
      await read(sql`SELECT d.poItemId AS itemId,d.unit,SUM(d.quantity-COALESCE(returned.quantity,0)) AS quantity
      FROM delivery_documents d LEFT JOIN (
        SELECT wr.sourceDeliveryDocumentId,SUM(wr.returnedQuantity) AS quantity FROM warehouse_returns wr
        INNER JOIN delivery_documents originalDelivery ON originalDelivery.id=wr.sourceDeliveryDocumentId
        WHERE originalDelivery.poItemId IN (${part}) GROUP BY wr.sourceDeliveryDocumentId
      ) returned ON returned.sourceDeliveryDocumentId=d.id
      WHERE d.poItemId IN (${part}) GROUP BY d.poItemId,d.unit`);
    deliveries.push(
      ...issued.map(row => ({
        itemId: Number(row.itemId),
        quantity: String(row.quantity),
        unit: String(row.unit ?? ""),
      }))
    );
  }
  const complete = replacementNeedCoverage(receipts, deliveries, links);
  return items.map(item =>
    !involved.has(Number(item.id)) ||
    !["purchased", "delivered_to_warehouse", "delivered_to_requester"].includes(
      item.status
    )
      ? item
      : {
          ...item,
          status: complete.get(Number(item.id))
            ? "delivered_to_requester"
            : item.status === "delivered_to_requester"
              ? "delivered_to_warehouse"
              : item.status,
        }
  );
}
