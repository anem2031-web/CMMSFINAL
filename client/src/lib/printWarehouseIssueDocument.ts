function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatQty(value: unknown): string {
  const n = Number(value || 0);
  return Number.isFinite(n)
    ? n.toLocaleString("en-US", { maximumFractionDigits: 3 })
    : "0";
}

function formatDate(value: unknown): string {
  if (!value) return "—";
  const d = new Date(value as any);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type WarehouseIssuePrintData = {
  id: number;
  issueNumber: string;
  warehouseName: string;
  deliveredToName: string;
  issuedByName: string;
  notes?: string | null;
  beneficiarySiteName?: string | null;
  beneficiarySectionName?: string | null;
  itemsCount?: number | null;
  printCount?: number | null;
  createdAt: string | Date;
  items: Array<{
    id?: number;
    itemName: string;
    quantity: string | number;
    unit?: string | null;
    lotCode?: string | null;
    deliveryNumber?: string | null;
    referenceType?: string | null;
    referenceNumber?: string | null;
    beneficiarySiteName?: string | null;
    beneficiarySectionName?: string | null;
  }>;
};

export function buildWarehouseIssueHtml(data: WarehouseIssuePrintData): string {
  const rows = (data.items || []).map((item, index) => {
    const referenceLabel = item.referenceType === "ticket"
      ? "بلاغ"
      : item.referenceType === "pmv2"
        ? "PM V2"
        : item.referenceType === "purchase"
          ? "شراء"
          : "مرجع";
    const refs = [
      item.referenceNumber ? `${referenceLabel}: ${escapeHtml(item.referenceNumber)}` : "",
      item.deliveryNumber ? `DLV: ${escapeHtml(item.deliveryNumber)}` : "",
    ].filter(Boolean).join("<br/>");

    return `
      <tr>
        <td>${index + 1}</td>
        <td class="item-name">${escapeHtml(item.itemName)}</td>
        <td>${formatQty(item.quantity)}</td>
        <td>${escapeHtml(item.unit || "—")}</td>
        <td class="mono">${escapeHtml(item.lotCode || "—")}</td>
        <td class="refs">${refs || "—"}</td>
        <td>${escapeHtml([item.beneficiarySiteName, item.beneficiarySectionName].filter(Boolean).join(" / ") || "—")}</td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<title>${escapeHtml(data.issueNumber)} — سند صرف مخزني</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Tahoma, sans-serif; margin: 0; background: #f4f6f8; color: #111827; }
  .page { max-width: 900px; margin: 24px auto; background: #fff; padding: 34px 38px; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
  .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #1f3b5b; padding-bottom: 16px; margin-bottom: 18px; }
  h1 { margin: 0; font-size: 24px; color: #1f3b5b; }
  .sub { margin-top: 5px; color: #6b7280; font-size: 12px; }
  .number { font-weight: 700; font-size: 16px; border: 1px solid #1f3b5b; border-radius: 6px; padding: 6px 10px; color: #1f3b5b; display: inline-block; }
  .meta { margin-top: 8px; font-size: 12px; line-height: 1.8; color: #4b5563; text-align: left; }
  .parties { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px; }
  .cost-target { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 18px; }
  .box { border: 1px solid #dbe2ea; border-radius: 8px; padding: 11px 12px; }
  .label { color: #6b7280; font-size: 11px; margin-bottom: 4px; }
  .value { font-weight: 700; color: #1f3b5b; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
  th { background: #eef3f8; color: #1f3b5b; font-weight: 700; }
  th, td { border: 1px solid #dbe2ea; padding: 8px; text-align: right; vertical-align: top; }
  td:first-child, th:first-child { text-align: center; width: 42px; }
  .item-name { font-weight: 600; min-width: 180px; }
  .mono { direction: ltr; text-align: left; font-family: monospace; white-space: nowrap; }
  .refs { font-size: 11px; line-height: 1.6; }
  .notes { margin-top: 16px; border: 1px solid #dbe2ea; border-radius: 8px; padding: 10px 12px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 44px; margin-top: 42px; }
  .sig { border-top: 1px solid #9ca3af; padding-top: 8px; text-align: center; color: #4b5563; font-size: 12px; }
  .footer { border-top: 1px solid #e5e7eb; margin-top: 26px; padding-top: 10px; display: flex; justify-content: space-between; color: #9ca3af; font-size: 10px; }
  @media print {
    body { background: #fff; }
    .page { margin: 0; box-shadow: none; padding: 18px 22px; max-width: none; }
    @page { size: A4; margin: 9mm; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <h1>سند صرف مخزني</h1>
      <div class="sub">سند تجميعي لحركات الصرف الفعلية في نظام CMMS</div>
    </div>
    <div>
      <div class="number">${escapeHtml(data.issueNumber)}</div>
      <div class="meta">${formatDate(data.createdAt)}</div>
    </div>
  </div>

  <div class="parties">
    <div class="box"><div class="label">المخزن المصدر</div><div class="value">${escapeHtml(data.warehouseName)}</div></div>
    <div class="box"><div class="label">الفني المستلم</div><div class="value">${escapeHtml(data.deliveredToName)}</div></div>
    <div class="box"><div class="label">منفذ الصرف</div><div class="value">${escapeHtml(data.issuedByName)}</div></div>
  </div>

  <div class="cost-target">
    <div class="box"><div class="label">الموقع</div><div class="value">${escapeHtml(data.beneficiarySiteName || "—")}</div></div>
    <div class="box"><div class="label">القسم</div><div class="value">${escapeHtml(data.beneficiarySectionName || "—")}</div></div>
  </div>

  <table>
    <thead><tr><th>#</th><th>المادة</th><th>الكمية</th><th>الوحدة</th><th>اللوت</th><th>المرجع</th><th>الموقع / القسم</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  ${data.notes ? `<div class="notes"><div class="label">ملاحظات</div><div>${escapeHtml(data.notes)}</div></div>` : ""}

  <div class="signatures">
    <div class="sig">توقيع منفذ الصرف<br/>${escapeHtml(data.issuedByName)}</div>
    <div class="sig">توقيع المستلم<br/>${escapeHtml(data.deliveredToName)}</div>
  </div>

  <div class="footer">
    <span>وثيقة آلية — نظام CMMS</span>
    <span>عدد البنود: ${Number(data.itemsCount ?? data.items?.length ?? 0)} &nbsp; | &nbsp; مرات الطباعة: ${Number(data.printCount ?? 0) + 1}</span>
  </div>
</div>
</body>
</html>`;
}

export function printWarehouseIssueDocument(data: WarehouseIssuePrintData) {
  const win = window.open("", "_blank", "width=980,height=820");
  if (!win) return false;
  win.document.write(buildWarehouseIssueHtml(data));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
  return true;
}
