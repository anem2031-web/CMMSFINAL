import ar from "@/i18n/ar";
import en from "@/i18n/en";
import ur from "@/i18n/ur";

type DeliveryDocLanguage = "ar" | "en" | "ur";

// ============================================================
// قالب طباعة وثيقة تسليم المواد — مصدر واحد مشترك بين دورة الشراء
// ومركز المستندات — انتُزع حرفيًا من
// client/src/pages/purchase/PurchaseCycle.tsx بلا أي تعديل
// ============================================================

// يبني نص HTML الكامل للوثيقة (بلا فتح نافذة) — يُستخدم من الطباعة المباشرة
// ومن تصدير/عرض PDF الحقيقي عبر الخادم (Puppeteer) بنفس القالب حرفيًا
export const buildDeliveryReceiptHtml = (data: {
    itemName: string;
    quantity: number;
    unit: string;
    supplierName?: string;
    actualUnitCost?: string;
    warehousePhotoUrl?: string;
    deliveredByName: string;
    deliveredToName: string;
    assignedTechnicianName?: string;
    ticketNumber?: string;
    notes?: string;
    poNumber?: string;
    deliveryNumber?: string;
    lotCode?: string;
    deliveredAt: string;
    itemId: number;
    initialPrintCount?: number;
  }, languageOverride?: DeliveryDocLanguage): string => {
    const detected = languageOverride || (typeof document !== "undefined" ? document.documentElement.lang : "ar");
    const language: DeliveryDocLanguage = detected === "en" ? "en" : detected === "ur" ? "ur" : "ar";
    const t = language === "en" ? en : language === "ur" ? ur : ar;
    const dir = language === "en" ? "ltr" : "rtl";
    const locale = language === "en" ? "en-US" : language === "ur" ? "ur-PK" : "ar-SA";
    const imgTag = data.warehousePhotoUrl
      ? `<div class="photo-wrap"><p class="photo-label">${t.workflow.purchase.itemPhoto}</p><img src="${data.warehousePhotoUrl}" alt="${t.workflow.purchase.itemPhoto}" /></div>`
      : "";

    const docTitle = (data.deliveryNumber || t.workflow.purchase.materialDeliveryDocument) + " — " + data.itemName;
    const initialCount = (data.initialPrintCount ?? 0) + 1;

    const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${language}">
<head>
<meta charset="UTF-8"/>
<title>${docTitle}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${dir === "rtl" ? "'Cairo', Arial, sans-serif" : "Arial, sans-serif"}; background: #f4f6fa; color: #1a1a1a; font-size: 13px; }

  /* ── toolbar (hidden in print) ── */
  .toolbar { background: #1e3a5f; padding: 12px 24px; display: flex; align-items: center; gap: 12px; }
  .toolbar-title { color: #fff; font-size: 14px; font-weight: 700; flex: 1; }
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: 6px; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
  .btn-print { background: #fff; color: #1e3a5f; }
  .btn-pdf   { background: #e8f0fe; color: #1e3a5f; }
  .btn:hover { opacity: .88; }

  /* ── page ── */
  .page { background: #fff; max-width: 740px; margin: 24px auto; padding: 36px 44px; border-radius: 10px; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e3a5f; padding-bottom: 14px; margin-bottom: 20px; }
  .header-title { font-size: 20px; font-weight: 700; color: #1e3a5f; }
  .header-sub { font-size: 11px; color: #555; margin-top: 4px; }
  .header-meta { text-align: start; font-size: 11px; color: #555; line-height: 2; }
  .badge { display: inline-block; background: #1e3a5f; color: #fff; padding: 3px 10px; border-radius: 4px; font-size: 13px; font-weight: 700; }
  .section { margin-bottom: 16px; }
  .section-title { font-size: 12px; font-weight: 700; color: #1e3a5f; background: #eef3f9; padding: 5px 10px; border-radius: 4px; margin-bottom: 10px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
  .field { display: flex; flex-direction: column; gap: 2px; }
  .field-label { font-size: 10px; color: #777; }
  .field-value { font-size: 13px; font-weight: 600; color: #111; }
  .parties { display: grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: 16px; margin-bottom: 16px; }
  .party-box { border: 1px solid #dde3ea; border-radius: 8px; padding: 12px 14px; }
  .party-role { font-size: 10px; color: #777; margin-bottom: 4px; }
  .party-name { font-size: 15px; font-weight: 700; color: #1e3a5f; }
  .photo-wrap { margin-top: 8px; }
  .photo-label { font-size: 10px; color: #777; margin-bottom: 6px; }
  .photo-wrap img { width: 140px; height: 140px; object-fit: cover; border-radius: 8px; border: 1px solid #dde3ea; }
  .sig-section { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  .sig-box { border-top: 1px solid #bbb; padding-top: 8px; text-align: center; font-size: 11px; color: #555; }
  .footer { margin-top: 24px; border-top: 1px solid #eee; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #aaa; }
  .print-count { font-size: 11px; color: #888; background: #f4f6fa; border: 1px solid #dde3ea; border-radius: 20px; padding: 2px 12px; }

  @media print {
    .toolbar { display: none !important; }
    body { background: #fff; }
    .page { box-shadow: none; margin: 0; padding: 20px 28px; border-radius: 0; }
    @page { size: A4; margin: 10mm; }
  }
</style>
</head>
<body>

<div class="toolbar">
  <span class="toolbar-title">🚚 ${docTitle}</span>
  <button class="btn btn-print" onclick="doPrint()">🖨️ ${t.common.print}</button>
  <button class="btn btn-pdf"   onclick="doSavePDF()">⬇️ ${t.workflow.purchase.downloadPdf}</button>
</div>

<div class="page" id="doc">
  <div class="header">
    <div>
      <div class="header-title">🚚 ${t.workflow.purchase.materialDeliveryDocument}</div>
      <div class="header-sub">${t.workflow.purchase.integratedCmms}</div>
    </div>
    <div class="header-meta">
      <div>${t.workflow.purchase.dateWord}: <strong>${data.deliveredAt}</strong></div>
      ${data.deliveryNumber ? "<div><span class=\"badge\">" + data.deliveryNumber + "</span></div>" : ""}
      ${data.poNumber ? "<div>" + t.workflow.purchase.poWord + ": <strong>" + data.poNumber + "</strong></div>" : ""}
      ${data.ticketNumber ? "<div>" + t.workflow.purchase.ticketWord + ": <strong>" + data.ticketNumber + "</strong></div>" : ""}
      ${data.lotCode ? "<div>" + t.workflow.purchase.lotQrRequired.replace(" *", "") + ": <strong>" + data.lotCode + "</strong></div>" : ""}
    </div>
  </div>

  <div class="parties">
    <div class="party-box">
      <div class="party-role">${t.workflow.purchase.delivererLabel}</div>
      <div class="party-name">${data.deliveredByName}</div>
    </div>
    ${data.assignedTechnicianName ? "<div class=\"party-box\"><div class=\"party-role\">" + t.workflow.purchase.assignedTechnicianInline.replace(":", "") + "</div><div class=\"party-name\">" + data.assignedTechnicianName + "</div></div>" : ""}
    <div class="party-box">
      <div class="party-role">${t.workflow.purchase.actualTechnicianRecipient}</div>
      <div class="party-name">${data.deliveredToName}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">${t.workflow.purchase.itemData}</div>
    <div class="grid">
      <div class="field"><span class="field-label">${t.workflow.purchase.itemNameLabel}</span><span class="field-value">${data.itemName}</span></div>
      <div class="field"><span class="field-label">${t.workflow.purchase.deliveredQuantity}</span><span class="field-value">${data.quantity} ${data.unit || ""}</span></div>
      ${data.supplierName ? "<div class=\"field\"><span class=\"field-label\">" + t.workflow.purchase.supplierLabel + "</span><span class=\"field-value\">" + data.supplierName + "</span></div>" : ""}
      ${data.actualUnitCost ? "<div class=\"field\"><span class=\"field-label\">" + t.workflow.purchase.unitCostLabel + "</span><span class=\"field-value\">" + parseFloat(data.actualUnitCost).toLocaleString(locale) + " " + t.common.currency + "</span></div>" : ""}
      ${data.notes ? "<div class=\"field\" style=\"grid-column:1/-1\"><span class=\"field-label\">" + t.workflow.purchase.notesLabel2 + "</span><span class=\"field-value\">" + data.notes + "</span></div>" : ""}
    </div>
    ${imgTag}
  </div>

  <div class="sig-section">
    <div class="sig-box">${t.workflow.purchase.delivererSignature}<br/>${data.deliveredByName}</div>
    <div class="sig-box">${t.workflow.purchase.receiverSignature}<br/>${data.deliveredToName}</div>
  </div>

  <div class="footer">
    <span>${t.workflow.purchase.automatedCmmsDocument}</span>
    <span class="print-count" id="pc">${t.workflow.purchase.printCountLabel}: <strong>${initialCount}</strong></span>
  </div>
</div>

<script>
  const ITEM_ID = ${data.itemId};
  let printCount = ${initialCount};

  async function incrementCount() {
    try {
      const res = await fetch('/api/trpc/purchaseOrders.incrementPrintCount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { itemId: ITEM_ID } })
      });
      const json = await res.json();
      printCount = json?.result?.data?.json?.printCount ?? printCount;
      document.getElementById('pc').innerHTML = '${t.workflow.purchase.printCountLabel}: <strong>' + printCount + '</strong>';
    } catch(e) { console.warn('count update failed', e); }
  }

  function doPrint() {
    incrementCount();
    window.print();
  }

  function doSavePDF() {
    incrementCount();
    document.title = '${docTitle}';
    const style = document.createElement('style');
    style.textContent = '.toolbar{display:none!important}';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => style.remove(), 1000);
  }
<\/script>
</body>
</html>`;

    return html;
  };

// الطباعة المباشرة (نافذة منبثقة) — تستخدم نفس buildDeliveryReceiptHtml أعلاه
export const printDeliveryReceipt = (data: Parameters<typeof buildDeliveryReceiptHtml>[0], language?: DeliveryDocLanguage) => {
  const html = buildDeliveryReceiptHtml(data, language);
  const win = window.open("", "_blank", "width=860,height=780");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
};
