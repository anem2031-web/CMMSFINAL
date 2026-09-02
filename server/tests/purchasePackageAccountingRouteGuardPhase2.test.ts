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
const approvalsRouter = readFileSync(
  new URL("../routers/purchase/approvals.router.ts", import.meta.url),
  "utf8",
);
const serverIndex = readFileSync(
  new URL("../_core/index.ts", import.meta.url),
  "utf8",
);

describe("Purchase Packages — accounting must act on package submission", () => {
  it("يفتح الحسابات والإدارة دفعة الإرسال المحددة من بانتظار إجرائي", () => {
    expect(purchaseOrdersPage).toContain(
      "?submissionId=${sub.submissionId}",
    );
    expect(purchaseBatchDetail).toContain("focusedSubmissionId");
    expect(purchaseBatchDetail).toContain("visibleSubmissions");
    expect(purchaseBatchDetail).toContain("!isPackageSubmissionFocusView");
  });

  it("لا يعرض اعتماد الحسابات المنفرد داخل PR المرتبط بدفعة حزمة", () => {
    expect(purchaseOrderDetail).toContain(
      'isAccountant && batch.status === "pending_accounting" && batch.purchasePackageSubmissionId == null',
    );
    expect(purchaseOrderDetail).toContain(
      "العهدة واعتماد الحسابات لهذه الدفعة يتمان من دفعة الإرسال الرسمية فقط",
    );
    expect(purchaseOrderDetail).toContain("فتح دفعة الإرسال");
  });

  it("يستخدم الحسابات والمندوب مستند دفعة الإرسال الرسمي داخل PR الحزمة", () => {
    expect(purchaseOrderDetail).toContain(
      'isPackageSubmissionBatch && (role === "delegate" || isAccountant)',
    );
    expect(purchaseOrderDetail).toContain("تنزيل مستند دفعة الإرسال الرسمي");
  });

  it("الخادم يمنع اعتماد Pricing Batch منفرد إذا كان تابعًا لدفعة إرسال حزمة", () => {
    const start = approvalsRouter.indexOf("approveAccountingBatch: accountantProcedure");
    const end = approvalsRouter.indexOf("rejectAccountingBatchItem:", start);
    const block = approvalsRouter.slice(start, end);

    expect(block).toContain("batch.purchasePackageSubmissionId != null");
    expect(block).toContain("اعتماد الحسابات وإجمالي رصيد العهد يتمان من دفعة الإرسال فقط");
  });

  it("مسار PDF المباشر يمنع الحسابات من إصدار PDF مستقل لدفعة PR التابعة للحزمة", () => {
    expect(serverIndex).toContain(
      'const mustUsePackageOfficialDocument = ["delegate", "accountant"].includes(user?.role || "")',
    );
    expect(serverIndex).toContain("requestedBatch?.purchasePackageSubmissionId != null");
    expect(serverIndex).toContain("استخدم مستند دفعة الإرسال الرسمي لطلب العهدة");
  });
});
