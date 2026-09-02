import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const purchaseOrdersPage = readFileSync(
  new URL("../../client/src/pages/purchase/PurchaseOrders.tsx", import.meta.url),
  "utf8",
);
const purchaseBatchDetail = readFileSync(
  new URL("../../client/src/pages/purchase/PurchaseBatchDetail.tsx", import.meta.url),
  "utf8",
);
const purchaseOrderDetail = readFileSync(
  new URL("../../client/src/pages/purchase/PurchaseOrderDetail.tsx", import.meta.url),
  "utf8",
);
const purchaseOrdersRouter = readFileSync(
  new URL("../routers/purchase/purchase-orders.router.ts", import.meta.url),
  "utf8",
);

describe("Purchase Packages — partial delegate pricing remains actionable", () => {
  it("يبني حزم بانتظار إجراء المندوب من أصناف التسعير المتبقية لا من حالة PR العامة", () => {
    expect(purchaseOrdersPage).toContain("purchaseOrders.pendingEstimateItems.useQuery");
    expect(purchaseOrdersPage).toContain("delegatePendingEstimateItems");
    expect(purchaseOrdersPage).toContain("متبقي للتسعير:");
    expect(purchaseOrdersPage).toContain("جاهز للإرسال:");
  });

  it("عند فتح PB للتسعير لا يعرض الأصناف التي دخلت دفعة إرسال سابقة", () => {
    expect(purchaseBatchDetail).toContain("isDelegatePricingActionView");
    expect(purchaseBatchDetail).toContain("!item.batchId");
    expect(purchaseBatchDetail).toContain('["pending", "estimated"].includes(item.status)');
    expect(purchaseBatchDetail).toContain("if (isDelegatePricingActionView && displayItems.length === 0) return null");
  });

  it("يفتح PR المعتمد من بانتظار إجرائي في سياق الشراء ويعرض أصناف الشراء فقط", () => {
    expect(purchaseOrdersPage).toContain('? "?action=purchase" : ""');
    expect(purchaseOrderDetail).toContain('new URLSearchParams(window.location.search).get("action") === "purchase"');
    expect(purchaseOrderDetail).toContain('["approved", "funded"].includes(item.status)');
  });

  it("لا يظهر زر إرسال الحسابات داخل PR تابع لحزمة", () => {
    expect(purchaseOrderDetail).toContain("readyToSubmitCount > 0 && !po.packageId");
  });

  it("الخادم يمنع الإرسال المنفرد لطلب داخل حزمة ويبقي مسار الحزمة عبر helper مستقلاً", () => {
    const directSubmitStart = purchaseOrdersRouter.indexOf("submitPricedBatch: delegateProcedure");
    const nextRoute = purchaseOrdersRouter.indexOf("listPricingBatches:", directSubmitStart);
    const directSubmitBlock = purchaseOrdersRouter.slice(directSubmitStart, nextRoute);

    expect(directSubmitBlock).toContain("if (po.packageId)");
    expect(directSubmitBlock).toContain("إرسال التسعير للحسابات يتم من خلال الحزمة فقط");
    expect(directSubmitBlock).toContain("return submitPricedBatchForPO(input.purchaseOrderId, ctx.user)");

    // مسار الحزمة يستدعي submitPricedBatchForPO مباشرة مع submission id،
    // لذلك الحارس أعلاه لا يغيّر Workflow الحزمة المعتمد سابقًا.
    expect(purchaseOrdersRouter).toContain("export async function submitPricedBatchForPO");
  });
});
