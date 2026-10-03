// ============================================================
// «سند استلام المشتريات» — قالب الطباعة الرسمي لسند الاستلام (RCV)
// يوثّق العملية كاملة من رفع فاتورة المورد وتحليل OCR حتى الحفظ:
//   • رقم السند RCV + QR + طلب الشراء المرتبط (إن وُجد)
//   • بيانات المورد وفاتورته (رقم/تاريخ/الرقم الضريبي)
//   • مصدر الإدخال: تحليل OCR (مع نسبة الثقة) أو إدخال يدوي
//   • جدول البنود: الكود الداخلي + باركود المصنع لكل صنف
//     (سواء وُلّد آلياً أو أُدخل يدوياً — نفس الحقل بالنظام)
//   • الإجماليات والفروقات والملاحظات + التوقيعات + عدّاد الطباعة
// بنفس أسلوب وثيقتي التسليم والمرتجع (نافذة منبثقة تطبع تلقائياً)
// ============================================================
import QRCode from "qrcode";
import { activeUiLanguage, purchaseOpsText } from "@/i18n/purchaseOpsUi";
import type { SupportedLanguage } from "@/contexts/LanguageContext";

const localeFor = (language: SupportedLanguage) => language === "en" ? "en-US" : language === "ur" ? "ur-PK" : "ar-SA";
const fmtMoney = (v: any, language: SupportedLanguage) => {
  const n = parseFloat(String(v ?? ""));
  return isNaN(n) ? "—" : n.toLocaleString(localeFor(language), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtQty = (v: any, language: SupportedLanguage) => {
  const n = parseFloat(String(v ?? ""));
  return isNaN(n) ? "—" : n.toLocaleString(localeFor(language), { maximumFractionDigits: 3 });
};
const esc = (s: any) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// يبني نص HTML الكامل للمستند (بلا فتح نافذة) — يُستخدم من الطباعة المباشرة
// ومن تصدير/عرض PDF الحقيقي عبر الخادم (Puppeteer) بنفس القالب حرفيًا
export async function buildReceiptHtml(receipt: any, language: SupportedLanguage = activeUiLanguage()): Promise<string> {
  const p = (source: string, vars?: Record<string, string | number | null | undefined>) => purchaseOpsText(language, source, vars);
  const locale = localeFor(language);
  const dir = language === "en" ? "ltr" : "rtl";
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(receipt.receiptNumber, { width: 110, margin: 1 });
  } catch { /* لو فشل التوليد نطبع بدون QR */ }

  const items: any[] = receipt.items ?? [];
  const anyOcr = items.some(i => i.ocrExtracted) || !!receipt.ocrConfidence;
  const ocrConf = receipt.ocrConfidence ? parseFloat(String(receipt.ocrConfidence)) : null;

  const sourceBadge = (i: any) =>
    i.ocrExtracted && i.manuallyEdited ? p("OCR + تعديل يدوي")
      : i.ocrExtracted ? p("تحليل OCR")
      : p("إدخال يدوي");

  const rowsHtml = items.map((i: any, idx: number) => `
<tr>
  <td>${idx + 1}</td>
  <td class="item-name">${esc(i.itemName)}<div class="src">${sourceBadge(i)}</div></td>
  <td class="mono">${esc(i.internalCode || "—")}</td>
  <td class="mono barcode-cell">${esc(i.manufacturerBarcode || "—")}</td>
  <td>${fmtQty(i.receivedQuantity, language)} ${esc(i.unit || "")}</td>
  <td>${fmtMoney(i.unitCost, language)}</td>
  <td>${fmtMoney(i.taxAmount, language)}</td>
  <td class="mono">${fmtMoney(i.lineTotal, language)}</td>
</tr>`).join("");

  const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${language}">
<head><meta charset="UTF-8"/><title>${esc(receipt.receiptNumber)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Cairo',Arial,sans-serif;background:#fff;color:#1a1a1a;padding:28px 36px;font-size:12px}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #14532d;padding-bottom:12px;margin-bottom:16px}
.header-title{font-size:20px;font-weight:700;color:#14532d}
.header-sub{font-size:11px;color:#555;margin-top:4px}
.header-meta{text-align:left;font-size:11px;color:#555;line-height:2}
.badge{display:inline-block;background:#14532d;color:#fff;padding:3px 10px;border-radius:4px;font-size:13px;font-weight:700}
.qr-row{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.section{margin-bottom:14px}
.section-title{font-size:12px;font-weight:700;color:#14532d;background:#f0fdf4;padding:5px 10px;border-radius:4px;margin-bottom:8px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 20px}
.field{display:flex;flex-direction:column;gap:1px}
.field-label{font-size:10px;color:#777}
.field-value{font-size:12px;font-weight:600;color:#111}
table{width:100%;border-collapse:collapse;font-size:11px}
th{background:#f0fdf4;color:#14532d;font-weight:700;padding:6px 6px;border:1px solid #d1e7d8;text-align:start}
td{padding:6px 6px;border:1px solid #e5e7eb;vertical-align:top}
.item-name{font-weight:600;min-width:130px}
.src{font-size:9px;color:#888;font-weight:400;margin-top:2px}
.mono{font-family:monospace;direction:ltr;text-align:start}
.barcode-cell{font-size:12px;font-weight:700}
.totals{margin-top:10px;margin-inline-start:auto;width:260px;font-size:12px}
.totals .t-row{display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid #eee}
.totals .t-grand{background:#f0fdf4;font-weight:700;color:#14532d;border-bottom:2px solid #14532d}
.warn-box{border:1px solid #f3d2a2;background:#fffbeb;border-radius:6px;padding:8px 12px;margin-top:8px;font-size:11px;color:#92400e}
.sig-section{margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:32px}
.sig-box{border-top:1px solid #bbb;padding-top:8px;text-align:center;font-size:11px;color:#555}
.footer{margin-top:20px;border-top:1px solid #eee;padding-top:8px;display:flex;justify-content:space-between;font-size:10px;color:#aaa}
.print-count{font-size:11px;color:#888;background:#f4f6fa;border:1px solid #dde3ea;border-radius:20px;padding:2px 12px}
@media print{@page{size:A4;margin:9mm}}
</style></head>
<body>
<div class="header">
  <div>
    <div class="header-title">🧾 ${p("سند استلام المشتريات")}</div>
    <div class="header-sub">${p("نظام إدارة الصيانة المتكامل")}</div>
  </div>
  <div class="header-meta">
    <div>${p("تاريخ الاستلام")}: <strong>${new Date(receipt.receivedAt || receipt.createdAt).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })}</strong></div>
    <div><span class="badge">${esc(receipt.receiptNumber)}</span></div>
    ${receipt.poNumber ? `<div>${p("طلب الشراء المرتبط")}: <strong>${esc(receipt.poNumber)}</strong></div>` : `<div>${p("استلام مستقل (بلا طلب شراء)")}</div>`}
  </div>
</div>

${qrDataUrl ? `<div class="qr-row">
  <img src="${qrDataUrl}" width="86" height="86" style="border:1px solid #eee;border-radius:6px"/>
  <div>
    <div class="field-label">${p("رقم سند الاستلام")}</div>
    <div class="field-value" style="font-size:16px;font-family:monospace">${esc(receipt.receiptNumber)}</div>
  </div>
</div>` : ""}

<div class="section">
  <div class="section-title">${p("بيانات المورد وفاتورته")}</div>
  <div class="grid">
    <div class="field"><span class="field-label">${p("اسم المورد")}</span><span class="field-value">${esc(receipt.vendorName || "—")}</span></div>
    <div class="field"><span class="field-label">${p("الرقم الضريبي")}</span><span class="field-value mono">${esc(receipt.vendorTaxNumber || "—")}</span></div>
    <div class="field"><span class="field-label">${p("رقم فاتورة المورد")}</span><span class="field-value mono">${esc(receipt.invoiceNumber || "—")}</span></div>
    <div class="field"><span class="field-label">${p("تاريخ الفاتورة")}</span><span class="field-value">${receipt.invoiceDate ? new Date(receipt.invoiceDate).toLocaleDateString(locale) : "—"}</span></div>
    <div class="field"><span class="field-label">${p("مصدر الإدخال")}</span><span class="field-value">${anyOcr ? `${p("تحليل آلي OCR")}${ocrConf != null ? ` (${ocrConf.toFixed(0)}%)` : ""}` : p("إدخال يدوي")}</span></div>
    <div class="field"><span class="field-label">${p("أمين المستودع (المستلم)")}</span><span class="field-value">${esc(receipt.receivedByName || "—")}</span></div>
  </div>
</div>

<div class="section">
  <div class="section-title">${p("الأصناف المستلمة ({count})", { count: items.length })}</div>
  <table>
    <thead><tr>
      <th style="width:26px">#</th>
      <th>${p("اسم الصنف")}</th>
      <th>${p("الكود الداخلي")}</th>
      <th>${p("باركود المصنع")}</th>
      <th>${p("الكمية")}</th>
      <th>${p("سعر الوحدة")}</th>
      <th>${p("الضريبة")}</th>
      <th>${p("الإجمالي")}</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="totals">
    <div class="t-row"><span>${p("الإجمالي قبل الضريبة")}</span><span class="mono">${fmtMoney(receipt.subtotal, language)}</span></div>
    <div class="t-row"><span>${p("ضريبة القيمة المضافة")}</span><span class="mono">${fmtMoney(receipt.taxAmount, language)}</span></div>
    <div class="t-row t-grand"><span>${p("الإجمالي الكلي")}</span><span class="mono">${fmtMoney(receipt.grandTotal, language)} ${language === "en" ? "SAR" : language === "ur" ? "سعودی ریال" : "ر.س"}</span></div>
  </div>
  ${receipt.hasDiscrepancy ? `<div class="warn-box">⚠️ ${p("سُجّلت فروقات أثناء الاستلام")}${receipt.discrepancyNotes ? `: ${esc(receipt.discrepancyNotes)}` : ""}</div>` : ""}
  ${receipt.notes ? `<div class="warn-box" style="background:#f8fafc;border-color:#dde3ea;color:#334155">📝 ${p("ملاحظات")}: ${esc(receipt.notes)}</div>` : ""}
</div>

<div class="sig-section">
  <div class="sig-box">${p("توقيع أمين المستودع")}<br/>${esc(receipt.receivedByName || "&nbsp;")}</div>
  <div class="sig-box">${p("توقيع المعتمد")}<br/>&nbsp;</div>
</div>
<div class="footer">
  <span>${p("وثيقة آلية — نظام CMMS")}</span>
  <span class="print-count">${p("عدد مرات الطباعة")}: <strong>${(receipt.printCount ?? 0) + 1}</strong></span>
</div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\\/script>
</body></html>`;

  return html;
}

// الطباعة المباشرة (نافذة منبثقة) — تستخدم نفس buildReceiptHtml أعلاه
export async function printReceiptDocument(receipt: any, onPrinted?: () => void) {
  onPrinted?.();
  // نفتح النافذة فوراً (متزامنة مع الضغطة) لتفادي حظر النوافذ المنبثقة
  const win = window.open("", "_blank", "width=920,height=800");
  const html = await buildReceiptHtml(receipt, activeUiLanguage());
  if (win) { win.document.write(html); win.document.close(); }
}
