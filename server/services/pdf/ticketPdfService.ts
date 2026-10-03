/**
 * Ticket PDF documents
 * - task: field work sheet available after classification
 * - archive: full closed-ticket record with the complete workflow trail
 */

import { htmlToPdf } from "./htmlToPdfService";
import { getEntityTranslations } from "../translation/translationEngine";
import {
  normalizeTicketPdfLanguage,
  ticketPdfDir,
  ticketPdfLocale,
  ticketPdfText,
  type TicketPdfLanguage,
} from "./ticketPdfI18n";
import { storageGetStream } from "../../_core/storage";
import {
  getAttachments,
  getAuditLogs,
  getInspectionResultsByTicket,
  getExternalMaintenanceJobByTicketId,
  getPurchaseOrders,
  getSections,
  getSiteById,
  getTechnicianById,
  getTicketById,
  getTicketConfirmation,
  getTicketHistory,
  getUserById,
} from "../../_core/db";

export type TicketPdfDocumentType = "task" | "archive";

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  pending_triage: "بانتظار الفرز والتصنيف",
  under_inspection: "قيد الفحص",
  work_approved: "تم اعتماد مسار التنفيذ",
  ready_for_closure: "جاهز للإغلاق",
  approved: "معتمد",
  assigned: "تم الإسناد",
  in_progress: "قيد التنفيذ",
  needs_purchase: "يحتاج طلب شراء",
  purchase_pending_estimate: "طلب الشراء بانتظار التسعير",
  purchase_pending_accounting: "طلب الشراء بانتظار الحسابات",
  purchase_pending_management: "طلب الشراء بانتظار الإدارة",
  purchase_approved: "تم اعتماد الشراء",
  partial_purchase: "شراء جزئي",
  purchased: "تم الشراء",
  received_warehouse: "تم الاستلام في المستودع",
  out_for_repair: "خرج للإصلاح الخارجي",
  repaired: "تم الإصلاح",
  verified: "تم التحقق",
  closed: "مغلق",
  requester_confirmed: "مغلق ومؤكد من مقدم البلاغ",
  rejected: "مرفوض",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  critical: "حرجة",
};

const CATEGORY_LABELS: Record<string, string> = {
  electrical: "كهرباء",
  plumbing: "سباكة",
  hvac: "تكييف",
  structural: "إنشائي",
  mechanical: "ميكانيكي",
  general: "عام",
  safety: "سلامة",
  cleaning: "نظافة",
  it: "تقنية المعلومات",
  elevator: "مصاعد",
  fire_safety: "سلامة وحريق",
  other: "أخرى",
};

const INSPECTION_STATUS_LABELS: Record<string, string> = {
  maintenance_inspection_result_draft: "مسودة محفوظة — لم تُرسل للمراجعة",
  maintenance_inspection_result_submitted: "مرسلة للمراجعة",
  maintenance_inspection_result_returned: "معادة للتصحيح",
  maintenance_inspection_result_approved: "معتمدة",
  maintenance_inspection_result_superseded: "مستبدلة",
};

const DEPARTMENT_LABELS: Record<string, string> = {
  maintenance_report_department_general: "الصيانة العامة",
  maintenance_report_department_construction: "قسم الإنشاءات",
  maintenance_report_department_it: "تقنية المعلومات",
};

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(value: unknown, language: TicketPdfLanguage, withTime = false): string {
  if (!value) return "—";
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) return "—";
  return withTime
    ? date.toLocaleString(ticketPdfLocale(language), { dateStyle: "medium", timeStyle: "short" })
    : date.toLocaleDateString(ticketPdfLocale(language), { year: "numeric", month: "long", day: "numeric" });
}

function fmtMoney(value: unknown, language: TicketPdfLanguage): string {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return escapeHtml(value);
  return new Intl.NumberFormat(ticketPdfLocale(language), { style: "currency", currency: "SAR", maximumFractionDigits: 2 }).format(number);
}

function resolveFileKey(value: any): string | null {
  const direct = value?.fileKey;
  if (typeof direct === "string" && direct.startsWith("cmms/")) return direct;
  const rawUrl = value?.fileUrl || value?.url;
  if (typeof rawUrl !== "string" || !rawUrl) return direct || null;
  try {
    const url = new URL(rawUrl, "http://local");
    const recovered = url.searchParams.get("key");
    return recovered ? decodeURIComponent(recovered) : direct || null;
  } catch {
    return direct || null;
  }
}

async function fileKeyToBase64(fileKey: string): Promise<string | null> {
  try {
    const { stream, contentType } = await storageGetStream(fileKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as any) chunks.push(Buffer.from(chunk));
    return `data:${contentType};base64,${Buffer.concat(chunks).toString("base64")}`;
  } catch (error) {
    console.error("[Ticket PDF] Failed to read image:", fileKey, error);
    return null;
  }
}

async function loadImageData(items: any[], limit: number, language: TicketPdfLanguage): Promise<Array<{ src: string; label: string }>> {
  const seen = new Set<string>();
  const candidates: Array<{ key: string; label: string }> = [];
  for (const item of items) {
    const key = resolveFileKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    candidates.push({ key, label: item?.fileName || item?.label || ticketPdfText(language, "صورة البلاغ") });
    if (candidates.length >= limit) break;
  }
  const loaded = await Promise.all(candidates.map(async item => ({ ...item, src: await fileKeyToBase64(item.key) })));
  return loaded.filter((item): item is { key: string; label: string; src: string } => !!item.src)
    .map(({ src, label }) => ({ src, label }));
}

async function loadTicketContext(ticketId: number, language: TicketPdfLanguage) {
  const ticket: any = await getTicketById(ticketId);
  if (!ticket) throw new Error(ticketPdfText(language, "البلاغ غير موجود"));

  const [site, sections, attachments, history, auditLogs, inspectionResults, allPurchaseOrders, confirmation, externalTechnician, externalMaintenanceJob] = await Promise.all([
    ticket.siteId ? getSiteById(ticket.siteId) : null,
    getSections(ticket.siteId ?? undefined),
    getAttachments("ticket", ticketId),
    getTicketHistory(ticketId),
    getAuditLogs({ entityType: "ticket", entityId: ticketId }),
    getInspectionResultsByTicket(ticketId),
    getPurchaseOrders({}),
    getTicketConfirmation(ticketId),
    ticket.assignedTechnicianId ? getTechnicianById(ticket.assignedTechnicianId) : null,
    ticket.maintenancePath === "C" ? getExternalMaintenanceJobByTicketId(ticketId) : null,
  ]);

  const purchaseOrders = (allPurchaseOrders as any[]).filter(po => po.ticketId === ticketId);
  const section = (sections as any[])?.find(sectionRow => sectionRow.id === ticket.sectionId) || null;

  const userIds = new Set<number>();
  const addId = (id: unknown) => {
    const number = Number(id);
    if (Number.isInteger(number) && number > 0) userIds.add(number);
  };
  [
    ticket.reportedById,
    ticket.assignedToId,
    ticket.approvedById,
    ticket.supervisorId,
    ticket.inspectionPerformedById,
    ticket.inspectionRecordedById,
    ticket.inspectionSubmittedById,
    ticket.inspectionApprovedById,
    ticket.inspectionReturnedById,
    ticket.gateExitApprovedById,
    ticket.gateEntryApprovedById,
    ticket.externalRepairCompletedById,
    ticket.maintenanceResponsibleManagerId,
    ticket.maintenanceRoutedById,
    confirmation?.confirmedById,
    externalMaintenanceJob?.delegateId,
    externalMaintenanceJob?.warehousePreparedById,
    externalMaintenanceJob?.gateExitApprovedById,
    externalMaintenanceJob?.delegateReadyForReturnById,
    externalMaintenanceJob?.gateEntryApprovedById,
    externalMaintenanceJob?.warehouseReceivedById,
    externalMaintenanceJob?.assignedTechnicianId,
    externalMaintenanceJob?.actualRecipientId,
    externalMaintenanceJob?.handoverById,
  ].forEach(addId);
  (history as any[]).forEach(row => addId(row.changedById));
  (auditLogs as any[]).forEach(row => addId(row.userId));
  (inspectionResults as any[]).forEach(row => {
    addId(row.inspectorId);
    addId(row.performedById);
    addId(row.recordedById);
    addId(row.approvedById);
    addId(row.returnedById);
  });
  purchaseOrders.forEach(po => {
    addId(po.requestedById);
    addId(po.reviewedById);
    addId(po.accountingApprovedById);
    addId(po.managementApprovedById);
  });

  const users = await Promise.all([...userIds].map(async id => [id, await getUserById(id)] as const));
  const userMap = new Map<number, any>(users);
  const userName = (id: unknown) => {
    const user = userMap.get(Number(id));
    return user?.name || user?.username || user?.email || (id ? ticketPdfText(language, "مستخدم #{id}", { id: Number(id) }) : "—");
  };

  const imageItems = [
    ...(ticket.beforePhotoUrl ? [{ fileUrl: ticket.beforePhotoUrl, label: ticketPdfText(language, "صورة قبل التنفيذ") }] : []),
    ...(ticket.afterPhotoUrl ? [{ fileUrl: ticket.afterPhotoUrl, label: ticketPdfText(language, "صورة بعد التنفيذ") }] : []),
    ...(externalMaintenanceJob?.assetBeforePhotoUrl ? [{ fileUrl: externalMaintenanceJob.assetBeforePhotoUrl, label: ticketPdfText(language, "الأصل قبل خروجه للصيانة الخارجية") }] : []),
    ...(externalMaintenanceJob?.assetAfterReturnPhotoUrl ? [{ fileUrl: externalMaintenanceJob.assetAfterReturnPhotoUrl, label: ticketPdfText(language, "الأصل بعد عودته من الصيانة الخارجية") }] : []),
    ...(attachments as any[]).filter(a => a.mimeType?.startsWith("image/")),
  ];

  const ticketTranslations = await getEntityTranslations(
    "TICKET",
    ticketId,
    language,
    ["title", "description", "repairNotes", "inspectionNotes", "inspectionReturnReason", "justification", "triageNotes", "materialsUsed", "maintenanceRoutingNote"],
  );
  const translatedTicket = {
    ...ticket,
    title: ticketTranslations.title?.text || ticket.title,
    description: ticketTranslations.description?.text || ticket.description,
    repairNotes: ticketTranslations.repairNotes?.text || ticket.repairNotes,
    inspectionNotes: ticketTranslations.inspectionNotes?.text || ticket.inspectionNotes,
    inspectionReturnReason: ticketTranslations.inspectionReturnReason?.text || ticket.inspectionReturnReason,
    justification: ticketTranslations.justification?.text || ticket.justification,
    triageNotes: ticketTranslations.triageNotes?.text || ticket.triageNotes,
    materialsUsed: ticketTranslations.materialsUsed?.text || ticket.materialsUsed,
    maintenanceRoutingNote: ticketTranslations.maintenanceRoutingNote?.text || ticket.maintenanceRoutingNote,
  };
  const translatedInspectionResults = await Promise.all((inspectionResults as any[]).map(async (result) => {
    const tr = await getEntityTranslations(
      "INSPECTION_RESULT",
      result.id,
      language,
      ["rootCause", "findings", "recommendedAction", "inspectionNotes", "returnReason"],
    );
    return {
      ...result,
      rootCause: tr.rootCause?.text || result.rootCause,
      findings: tr.findings?.text || result.findings,
      recommendedAction: tr.recommendedAction?.text || result.recommendedAction,
      inspectionNotes: tr.inspectionNotes?.text || result.inspectionNotes,
      returnReason: tr.returnReason?.text || result.returnReason,
    };
  }));
  let translatedExternalMaintenanceJob = externalMaintenanceJob;
  if (externalMaintenanceJob?.id) {
    const tr = await getEntityTranslations(
      "EXTERNAL_MAINTENANCE_JOB",
      externalMaintenanceJob.id,
      language,
      ["assetName", "assetBeforeCondition", "warehouseNotes", "gateExitNotes", "gateEntryNotes", "returnCondition", "warehouseReturnNotes", "handoverNotes"],
    );
    translatedExternalMaintenanceJob = {
      ...externalMaintenanceJob,
      assetName: tr.assetName?.text || externalMaintenanceJob.assetName,
      assetBeforeCondition: tr.assetBeforeCondition?.text || externalMaintenanceJob.assetBeforeCondition,
      warehouseNotes: tr.warehouseNotes?.text || externalMaintenanceJob.warehouseNotes,
      gateExitNotes: tr.gateExitNotes?.text || externalMaintenanceJob.gateExitNotes,
      gateEntryNotes: tr.gateEntryNotes?.text || externalMaintenanceJob.gateEntryNotes,
      returnCondition: tr.returnCondition?.text || externalMaintenanceJob.returnCondition,
      warehouseReturnNotes: tr.warehouseReturnNotes?.text || externalMaintenanceJob.warehouseReturnNotes,
      handoverNotes: tr.handoverNotes?.text || externalMaintenanceJob.handoverNotes,
    };
  }

  return {
    language,
    ticket: translatedTicket,
    site,
    section,
    attachments: attachments as any[],
    history: history as any[],
    auditLogs: auditLogs as any[],
    inspectionResults: translatedInspectionResults,
    purchaseOrders,
    confirmation,
    externalTechnician,
    externalMaintenanceJob: translatedExternalMaintenanceJob,
    userName,
    images: await loadImageData(imageItems, 12, language),
  };
}

function infoRow(label: string, value: unknown): string {
  return `<div class="info-row"><span class="info-label">${escapeHtml(label)}</span><span class="info-value">${escapeHtml(value)}</span></div>`;
}

function localizedLabel(language: TicketPdfLanguage, labels: Record<string, string>, value: unknown): string {
  const key = value == null ? "" : String(value);
  return ticketPdfText(language, labels[key] || key || "—");
}

const PURCHASE_STATUS_AR: Record<string, string> = {
  draft: "مسودة",
  pending_review: "بانتظار المراجعة",
  pending_estimate: "بانتظار التسعير",
  pending_accounting: "بانتظار اعتماد الحسابات",
  pending_management: "بانتظار اعتماد الإدارة",
  approved: "معتمد",
  partial_purchase: "شراء جزئي",
  purchased: "تم الشراء بالكامل",
  received: "تم الاستلام",
  cancelled: "ملغي",
  closed: "مغلق",
  rejected: "مرفوض",
  revision_needed: "يحتاج مراجعة",
};

function renderTaskPdf(ctx: Awaited<ReturnType<typeof loadTicketContext>>): string {
  const { language, ticket, site, section, externalTechnician, userName, images } = ctx;
  const L = (text: string, vars: Record<string, string | number> = {}) => ticketPdfText(language, text, vars);
  const date = (value: unknown, withTime = false) => fmtDate(value, language, withTime);
  const assignedName = ticket.assignedToId ? userName(ticket.assignedToId) : externalTechnician?.name || L("غير معين");
  const taskImages = images.slice(0, 4);
  const photos = taskImages.length
    ? `<section><h2>${L("صور البلاغ")}</h2><div class="photo-grid">${taskImages.map(image => `<figure><img src="${image.src}"/><figcaption>${escapeHtml(image.label)}</figcaption></figure>`).join("")}</div></section>`
    : "";
  const dir = ticketPdfDir(language);
  const textAlign = dir === "rtl" ? "right" : "left";
  const oppositeAlign = dir === "rtl" ? "left" : "right";

  return `<!doctype html><html lang="${language}" dir="${dir}"><head><meta charset="utf-8"/><style>
    @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;font-size:12px;line-height:1.55;margin:0;text-align:${textAlign}}
    .header{background:#1e3a8a;color:#fff;padding:14px 16px;border-radius:10px;display:flex;justify-content:space-between;align-items:center}.header h1{margin:0;font-size:20px}.num{font-size:18px;font-weight:800;direction:ltr}
    .badges{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.badge{padding:4px 10px;border-radius:999px;background:#eef2ff;font-weight:700}
    section{margin:10px 0;break-inside:avoid}h2{font-size:15px;color:#1e3a8a;border-bottom:2px solid #dbeafe;padding-bottom:5px;margin:0 0 7px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;border:1px solid #d9e2f2;border-radius:8px;padding:10px}.info-row{display:flex;justify-content:space-between;gap:12px;border-bottom:1px dashed #e5e7eb;padding:3px 0}.info-label{color:#64748b;font-weight:700}.info-value{font-weight:600;text-align:${oppositeAlign};unicode-bidi:plaintext}
    .description{border:1px solid #d9e2f2;border-radius:8px;padding:10px;background:#f8fafc;white-space:pre-wrap;unicode-bidi:plaintext}.photo-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.photo-grid figure{margin:0;border:1px solid #d9e2f2;border-radius:8px;overflow:hidden}.photo-grid img{width:100%;height:130px;object-fit:contain;background:#f8fafc}.photo-grid figcaption{text-align:center;padding:3px;color:#64748b;font-size:10px}
    .field{border:2px solid #1e3a8a;border-radius:10px;padding:12px;min-height:170px}.lines div{height:22px;border-bottom:1px dashed #94a3b8}.signatures{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:15px}.signature{text-align:center}.signature span{display:block;margin-bottom:22px;font-size:10px;color:#64748b}.signature i{display:block;border-bottom:1px solid #334155}
    .footer{margin-top:10px;border-top:1px solid #e5e7eb;padding-top:6px;color:#94a3b8;font-size:9px;display:flex;justify-content:space-between}
  </style></head><body>
    <div class="header"><div><h1>${L("نموذج مهمة صيانة")}</h1><div>${L("وثيقة عمل ميدانية بعد تصنيف البلاغ")}</div></div><div class="num">${escapeHtml(ticket.ticketNumber)}</div></div>
    <div class="badges"><span class="badge">${escapeHtml(localizedLabel(language, STATUS_LABELS, ticket.status))}</span><span class="badge">${L("الأولوية")}: ${escapeHtml(localizedLabel(language, PRIORITY_LABELS, ticket.priority))}</span><span class="badge">${L("التصنيف")}: ${escapeHtml(localizedLabel(language, CATEGORY_LABELS, ticket.category))}</span></div>
    <section><h2>${L("بيانات المهمة")}</h2><div class="grid">
      ${infoRow(L("العنوان"), ticket.title)}${infoRow(L("الموقع"), site?.name || ticket.locationDetail)}${infoRow(L("القسم"), section?.name)}${infoRow(L("مقدم البلاغ"), userName(ticket.reportedById))}
      ${infoRow(L("الجهة المسؤولة"), localizedLabel(language, DEPARTMENT_LABELS, ticket.maintenanceResponsibleDepartment))}${infoRow(L("مدير الجهة"), userName(ticket.maintenanceResponsibleManagerId))}${infoRow(L("الفني المسند"), assignedName)}${infoRow(L("تاريخ الإسناد"), date(ticket.assignedAt, true))}
    </div></section>
    <section><h2>${L("وصف البلاغ")}</h2><div class="description"><strong>${escapeHtml(ticket.title)}</strong><br/>${escapeHtml(ticket.description || L("لا يوجد وصف إضافي"))}</div></section>
    ${photos}
    <section><h2>${L("تسجيل العمل الميداني")}</h2><div class="field"><strong>${L("الملاحظات والإجراءات المنفذة")}</strong><div class="lines"><div></div><div></div><div></div><div></div><div></div></div><div class="signatures"><div class="signature"><span>${L("اسم الفني")}</span><i></i></div><div class="signature"><span>${L("التوقيع")}</span><i></i></div><div class="signature"><span>${L("التاريخ")}</span><i></i></div><div class="signature"><span>${L("اعتماد المسؤول")}</span><i></i></div></div></div></section>
    <div class="footer"><span>${L("طُبعت بتاريخ {date}", { date: date(new Date(), true) })}</span><span>${L("نظام الحارس المركزي")}</span></div>
  </body></html>`;
}

function renderArchivePdf(ctx: Awaited<ReturnType<typeof loadTicketContext>>): string {
  const { language, ticket, site, section, attachments, history, auditLogs, inspectionResults, purchaseOrders, confirmation, externalTechnician, externalMaintenanceJob, userName, images } = ctx;
  const L = (text: string, vars: Record<string, string | number> = {}) => ticketPdfText(language, text, vars);
  const date = (value: unknown, withTime = false) => fmtDate(value, language, withTime);
  const money = (value: unknown) => fmtMoney(value, language);
  const assignedName = ticket.assignedToId ? userName(ticket.assignedToId) : externalTechnician?.name || L("غير معين");
  const timeline = [...history].reverse();
  const nonImageAttachments = attachments.filter(a => !a.mimeType?.startsWith("image/"));
  const dir = ticketPdfDir(language);
  const textAlign = dir === "rtl" ? "right" : "left";
  const oppositeAlign = dir === "rtl" ? "left" : "right";

  const inspectionHtml = inspectionResults.length
    ? inspectionResults.map(result => `
      <article class="record">
        <div class="record-head"><strong>${L("نسخة نتيجة الفحص رقم {num}", { num: result.revisionNumber || 1 })}</strong><span class="status-chip">${escapeHtml(localizedLabel(language, INSPECTION_STATUS_LABELS, result.workflowStatus))}</span></div>
        <div class="two-col">
          ${infoRow(L("من قام بالفحص ميدانيًا"), userName(result.performedById || result.inspectorId))}
          ${infoRow(L("من أدخل النتيجة في النظام"), userName(result.recordedById || result.inspectorId))}
          ${infoRow(L("مستوى الخطورة"), localizedLabel(language, PRIORITY_LABELS, result.severity))}
          ${infoRow(L("تاريخ الإنشاء"), date(result.createdAt, true))}
          ${infoRow(L("تاريخ الإرسال"), date(result.submittedAt, true))}
          ${infoRow(L("تاريخ الاعتماد"), date(result.approvedAt, true))}
        </div>
        ${result.inspectionNotes ? `<div class="text-block"><b>${L("الملاحظات الفنية")}:</b> ${escapeHtml(result.inspectionNotes)}</div>` : ""}
        ${result.rootCause ? `<div class="text-block"><b>${L("السبب الجذري")}:</b> ${escapeHtml(result.rootCause)}</div>` : ""}
        ${result.findings ? `<div class="text-block"><b>${L("النتائج")}:</b> ${escapeHtml(result.findings)}</div>` : ""}
        ${result.recommendedAction ? `<div class="text-block"><b>${L("الإجراء الموصى به")}:</b> ${escapeHtml(result.recommendedAction)}</div>` : ""}
        ${result.returnReason ? `<div class="text-block warning"><b>${L("سبب الإعادة للتصحيح")}:</b> ${escapeHtml(result.returnReason)}</div>` : ""}
      </article>`).join("")
    : `<p class="empty">${L("لا توجد نتائج فحص مسجلة.")}</p>`;

  const purchaseHtml = purchaseOrders.length
    ? `<table><thead><tr><th>${L("رقم الطلب")}</th><th>${L("الحالة")}</th><th>${L("المنشئ")}</th><th>${L("التقديري")}</th><th>${L("الفعلي")}</th><th>${L("تاريخ الإنشاء")}</th></tr></thead><tbody>${purchaseOrders.map(po => `<tr><td>${escapeHtml(po.poNumber)}</td><td>${escapeHtml(localizedLabel(language, PURCHASE_STATUS_AR, po.status))}</td><td>${escapeHtml(po.requestedByName || userName(po.requestedById))}</td><td>${money(po.totalEstimatedCost)}</td><td>${money(po.totalActualCost)}</td><td>${date(po.createdAt, true)}</td></tr>`).join("")}</tbody></table>`
    : `<p class="empty">${L("لا توجد طلبات شراء مرتبطة.")}</p>`;

  const externalMaintenanceHtml = externalMaintenanceJob
    ? `<div class="two-col">
        ${infoRow(L("حالة دورة الصيانة الخارجية"), externalMaintenanceJob.status)}
        ${infoRow(L("اسم الأصل"), externalMaintenanceJob.assetName)}
        ${infoRow(L("المندوب المسؤول"), userName(externalMaintenanceJob.delegateId))}
        ${infoRow(L("وثيقة الخروج"), externalMaintenanceJob.exitDocumentNumber)}
        ${infoRow(L("جهزه المستودع"), userName(externalMaintenanceJob.warehousePreparedById))}
        ${infoRow(L("وقت تجهيز المستودع"), date(externalMaintenanceJob.warehousePreparedAt, true))}
        ${infoRow(L("اعتمد الخروج"), userName(externalMaintenanceJob.gateExitApprovedById))}
        ${infoRow(L("وقت الخروج"), date(externalMaintenanceJob.gateExitApprovedAt, true))}
        ${infoRow(L("حامل الأصل عند الخروج"), externalMaintenanceJob.gateExitCarrierName)}
        ${infoRow(L("اعتمد الدخول"), userName(externalMaintenanceJob.gateEntryApprovedById))}
        ${infoRow(L("وقت الدخول"), date(externalMaintenanceJob.gateEntryApprovedAt, true))}
        ${infoRow(L("معيد الأصل"), externalMaintenanceJob.gateEntryCarrierName)}
        ${infoRow(L("وثيقة استلام العودة"), externalMaintenanceJob.returnDocumentNumber)}
        ${infoRow(L("استلمه في المستودع"), userName(externalMaintenanceJob.warehouseReceivedById))}
        ${infoRow(L("وقت استلام المستودع"), date(externalMaintenanceJob.warehouseReceivedAt, true))}
        ${infoRow(L("حالة الأصل عند العودة"), externalMaintenanceJob.returnCondition)}
        ${infoRow(L("تقرير/فاتورة الورشة"), externalMaintenanceJob.workshopReportUrl)}
        ${infoRow(L("وثيقة التسليم للتركيب"), externalMaintenanceJob.handoverDocumentNumber)}
        ${infoRow(L("الفني المسند"), userName(externalMaintenanceJob.assignedTechnicianId))}
        ${infoRow(L("المستلم الفعلي"), userName(externalMaintenanceJob.actualRecipientId))}
        ${infoRow(L("سلّمه من المستودع"), userName(externalMaintenanceJob.handoverById))}
        ${infoRow(L("وقت التسليم للتركيب"), date(externalMaintenanceJob.handoverAt, true))}
      </div>
      ${externalMaintenanceJob.assetBeforeCondition ? `<div class="text-block"><b>${L("حالة الأصل قبل الخروج")}:</b> ${escapeHtml(externalMaintenanceJob.assetBeforeCondition)}</div>` : ""}
      ${externalMaintenanceJob.warehouseReturnNotes ? `<div class="text-block"><b>${L("ملاحظات استلام العودة")}:</b> ${escapeHtml(externalMaintenanceJob.warehouseReturnNotes)}</div>` : ""}
      ${externalMaintenanceJob.handoverNotes ? `<div class="text-block"><b>${L("ملاحظات التسليم للتركيب")}:</b> ${escapeHtml(externalMaintenanceJob.handoverNotes)}</div>` : ""}`
    : `<p class="empty">${L("لا توجد دورة صيانة خارجية مرتبطة.")}</p>`;

  const timelineHtml = timeline.length
    ? timeline.map((event, index) => `<div class="timeline-item"><div class="timeline-dot">${index + 1}</div><div><div class="timeline-title">${escapeHtml(event.fromStatus ? localizedLabel(language, STATUS_LABELS, event.fromStatus) : L("إنشاء البلاغ"))} ← ${escapeHtml(localizedLabel(language, STATUS_LABELS, event.toStatus))}</div><div class="muted">${date(event.createdAt, true)} — ${L("بواسطة {name}", { name: userName(event.changedById) })}</div>${event.notes ? `<div class="timeline-notes">${escapeHtml(event.notes)}</div>` : ""}</div></div>`).join("")
    : `<p class="empty">${L("لا يوجد سجل انتقالات.")}</p>`;

  const auditHtml = auditLogs.length
    ? [...auditLogs].reverse().map((entry, index) => `<div class="audit-item"><div><b>${index + 1}. ${escapeHtml(entry.action)}</b> — ${date(entry.createdAt, true)} — ${escapeHtml(userName(entry.userId))}</div>${entry.oldValues ? `<pre><b>${L("القيم السابقة")}:</b> ${escapeHtml(JSON.stringify(entry.oldValues, null, 2))}</pre>` : ""}${entry.newValues ? `<pre><b>${L("القيم الجديدة")}:</b> ${escapeHtml(JSON.stringify(entry.newValues, null, 2))}</pre>` : ""}</div>`).join("")
    : `<p class="empty">${L("لا توجد عمليات تدقيق إضافية.")}</p>`;

  const photosHtml = images.length
    ? `<div class="photo-grid">${images.map(image => `<figure><img src="${image.src}"/><figcaption>${escapeHtml(image.label)}</figcaption></figure>`).join("")}</div>`
    : `<p class="empty">${L("لا توجد صور محفوظة.")}</p>`;

  const attachmentsHtml = nonImageAttachments.length
    ? `<ul>${nonImageAttachments.map(file => `<li>${escapeHtml(file.fileName || file.fileKey)} — ${escapeHtml(file.mimeType || L("ملف"))}</li>`).join("")}</ul>`
    : `<p class="empty">${L("لا توجد مرفقات إضافية.")}</p>`;

  const shift = ticket.maintenancePath === "C" ? 1 : 0;
  return `<!doctype html><html lang="${language}" dir="${dir}"><head><meta charset="utf-8"/><style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;font-size:11px;line-height:1.6;margin:0;text-align:${textAlign}}.header{background:#0f3a67;color:#fff;padding:16px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.header h1{font-size:21px;margin:0}.header p{margin:3px 0 0;color:#dbeafe}.ticket-number{font-size:18px;font-weight:900;border:1px solid #93c5fd;border-radius:8px;padding:8px 14px;direction:ltr}
    .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:12px}.summary div{background:#f1f5f9;border:1px solid #dbe4ef;border-radius:7px;padding:7px}.summary b{display:block;color:#64748b;font-size:9px}.summary span{font-weight:800}
    section{margin:12px 0;break-inside:auto}h2{font-size:15px;color:#0f3a67;border-bottom:2px solid #bfdbfe;padding-bottom:5px;margin:0 0 8px}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:3px 16px}.info-row{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed #e2e8f0;padding:4px 0}.info-label{color:#64748b;font-weight:700}.info-value{text-align:${oppositeAlign};font-weight:600;unicode-bidi:plaintext}.text-block{background:#f8fafc;border-inline-start:3px solid #3b82f6;border-radius:5px;padding:7px;margin-top:6px;white-space:pre-wrap;unicode-bidi:plaintext}.warning{background:#fff7ed;border-color:#f97316}.record{border:1px solid #dbe4ef;border-radius:8px;padding:9px;margin-bottom:8px;break-inside:avoid}.record-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:5px}.status-chip{background:#e0e7ff;color:#3730a3;padding:2px 7px;border-radius:999px;font-size:9px;font-weight:700}
    table{width:100%;border-collapse:collapse;font-size:9.5px}th,td{border:1px solid #dbe4ef;padding:5px;text-align:${textAlign}}th{background:#eaf2fb;color:#0f3a67}.timeline-item{display:grid;grid-template-columns:25px 1fr;gap:8px;margin-bottom:8px;break-inside:avoid}.audit-item{border:1px solid #e2e8f0;border-radius:6px;padding:6px;margin-bottom:6px;break-inside:avoid}.audit-item pre{white-space:pre-wrap;word-break:break-word;background:#f8fafc;border-radius:4px;padding:5px;margin:4px 0 0;font-family:Arial,sans-serif;font-size:8.5px}.timeline-dot{width:22px;height:22px;background:#0f3a67;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px}.timeline-title{font-weight:800}.timeline-notes{background:#f8fafc;border-radius:4px;padding:4px;margin-top:3px;unicode-bidi:plaintext}.muted,.empty{color:#64748b}.photo-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.photo-grid figure{margin:0;border:1px solid #dbe4ef;border-radius:7px;overflow:hidden;break-inside:avoid}.photo-grid img{width:100%;height:170px;object-fit:contain;background:#f8fafc}.photo-grid figcaption{text-align:center;padding:4px;color:#64748b}.footer{margin-top:16px;border-top:1px solid #cbd5e1;padding-top:7px;color:#64748b;font-size:9px;display:flex;justify-content:space-between}ul{padding-inline-start:20px}
  </style></head><body>
    <div class="header"><div><h1>${L("التقرير الأرشيفي الكامل للبلاغ")}</h1><p>${L("وثيقة نهائية تشمل بيانات البلاغ وإجراءاته من الإنشاء حتى الإغلاق")}</p></div><div class="ticket-number">${escapeHtml(ticket.ticketNumber)}</div></div>
    <div class="summary"><div><b>${L("الحالة النهائية")}</b><span>${escapeHtml(localizedLabel(language, STATUS_LABELS, ticket.status))}</span></div><div><b>${L("الأولوية")}</b><span>${escapeHtml(localizedLabel(language, PRIORITY_LABELS, ticket.priority))}</span></div><div><b>${L("تاريخ الإنشاء")}</b><span>${date(ticket.createdAt)}</span></div><div><b>${L("تاريخ الإغلاق")}</b><span>${date(ticket.closedAt)}</span></div></div>

    <section><h2>1. ${L("بيانات البلاغ الأساسية")}</h2><div class="two-col">
      ${infoRow(L("العنوان"), ticket.title)}${infoRow(L("التصنيف الفني"), localizedLabel(language, CATEGORY_LABELS, ticket.category))}${infoRow(L("الموقع"), site?.name || ticket.locationDetail)}${infoRow(L("القسم"), section?.name)}${infoRow(L("مقدم البلاغ"), userName(ticket.reportedById))}${infoRow(L("نوع البلاغ"), ticket.ticketType)}${infoRow(L("اللغة الأصلية"), ticket.originalLanguage)}${infoRow(L("رقم الأصل"), ticket.assetId)}
    </div><div class="text-block"><b>${L("الوصف")}:</b> ${escapeHtml(ticket.description || L("لا يوجد وصف"))}</div></section>

    <section><h2>2. ${L("الفرز والتوجيه والمسؤوليات")}</h2><div class="two-col">
      ${infoRow(L("الجهة المسؤولة"), localizedLabel(language, DEPARTMENT_LABELS, ticket.maintenanceResponsibleDepartment))}${infoRow(L("مدير الجهة"), userName(ticket.maintenanceResponsibleManagerId))}${infoRow(L("من قام بالتوجيه"), userName(ticket.maintenanceRoutedById))}${infoRow(L("وقت التوجيه"), date(ticket.maintenanceRoutedAt, true))}${infoRow(L("الفني المسند"), assignedName)}${infoRow(L("وقت الإسناد"), date(ticket.assignedAt, true))}${infoRow(L("المشرف"), userName(ticket.supervisorId))}${infoRow(L("المسار التنفيذي"), ticket.maintenancePath)}
    </div>${ticket.triageNotes ? `<div class="text-block"><b>${L("ملاحظات الفرز")}:</b> ${escapeHtml(ticket.triageNotes)}</div>` : ""}${ticket.maintenanceRoutingNote ? `<div class="text-block"><b>${L("ملاحظات التوجيه")}:</b> ${escapeHtml(ticket.maintenanceRoutingNote)}</div>` : ""}${ticket.justification ? `<div class="text-block"><b>${L("مبرر المسار")}:</b> ${escapeHtml(ticket.justification)}</div>` : ""}</section>

    <section><h2>3. ${L("نتائج الفحص ومراجعاتها")}</h2>${inspectionHtml}</section>

    <section><h2>4. ${L("التنفيذ والإقفال")}</h2><div class="two-col">
      ${infoRow(L("اعتمد بواسطة"), userName(ticket.approvedById))}${infoRow(L("تكلفة تقديرية"), money(ticket.estimatedCost))}${infoRow(L("تكلفة فعلية"), money(ticket.actualCost))}${infoRow(L("تاريخ الإغلاق"), date(ticket.closedAt, true))}${infoRow(L("اعتماد الخروج"), userName(ticket.gateExitApprovedById))}${infoRow(L("وقت الخروج"), date(ticket.gateExitApprovedAt, true))}${infoRow(L("اعتماد الدخول"), userName(ticket.gateEntryApprovedById))}${infoRow(L("وقت الدخول"), date(ticket.gateEntryApprovedAt, true))}
    </div>${ticket.repairNotes ? `<div class="text-block"><b>${L("ملاحظات الإصلاح")}:</b> ${escapeHtml(ticket.repairNotes)}</div>` : ""}${ticket.materialsUsed ? `<div class="text-block"><b>${L("المواد المستخدمة")}:</b> ${escapeHtml(ticket.materialsUsed)}</div>` : ""}</section>

    ${ticket.maintenancePath === "C" ? `<section><h2>5. ${L("دورة الصيانة الخارجية وحركة الأصل")}</h2>${externalMaintenanceHtml}</section>` : ""}
    <section><h2>${5 + shift}. ${L("طلبات الشراء المرتبطة")}</h2>${purchaseHtml}</section>
    <section><h2>${6 + shift}. ${L("التسلسل الكامل لإجراءات البلاغ")}</h2>${timelineHtml}</section>
    <section><h2>${7 + shift}. ${L("سجل التدقيق التفصيلي")}</h2>${auditHtml}</section>
    <section><h2>${8 + shift}. ${L("الصور")}</h2>${photosHtml}</section>
    <section><h2>${9 + shift}. ${L("المرفقات الأخرى")}</h2>${attachmentsHtml}</section>
    ${confirmation ? `<section><h2>${10 + shift}. ${L("تأكيد مقدم البلاغ")}</h2><div class="two-col">${infoRow(L("المؤكد"), userName(confirmation.confirmedById))}${infoRow(L("وقت التأكيد"), date(confirmation.createdAt, true))}</div><div class="text-block"><b>${L("ملاحظة التأكيد")}:</b> ${escapeHtml(confirmation.note)}</div></section>` : ""}
    <div class="footer"><span>${L("تم إنشاء الوثيقة آليًا بتاريخ {date}", { date: date(new Date(), true) })}</span><span>${L("نظام الحارس المركزي — وثيقة أرشيفية")}</span></div>
  </body></html>`;
}

export async function generateTicketPDF(
  ticketId: number,
  documentType: TicketPdfDocumentType = "task",
  preferredLanguage: unknown = "ar",
): Promise<Buffer> {
  const language = normalizeTicketPdfLanguage(preferredLanguage);
  const context = await loadTicketContext(ticketId, language);
  return htmlToPdf(documentType === "archive" ? renderArchivePdf(context) : renderTaskPdf(context));
}
