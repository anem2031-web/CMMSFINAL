import type { SupportedLanguage } from "@/contexts/LanguageContext";

type Pair = { en: string; ur: string };

const EXACT: Record<string, Pair> = {
  "تعذر الاتصال بقاعدة البيانات": { en: "Unable to connect to the database", ur: "ڈیٹابیس سے رابطہ نہیں ہو سکا" },
  "البلاغ غير موجود": { en: "Ticket not found", ur: "ٹکٹ نہیں ملا" },
  "بند البلاغ غير موجود": { en: "Ticket item not found", ur: "ٹکٹ آئٹم نہیں ملا" },
  "طلب الشراء غير موجود": { en: "Purchase request not found", ur: "خریداری درخواست نہیں ملی" },
  "الصنف غير موجود": { en: "Item not found", ur: "آئٹم نہیں ملا" },
  "حزمة الشراء غير موجودة": { en: "Purchase package not found", ur: "خریداری پیکیج نہیں ملا" },
  "دفعة التسعير غير موجودة": { en: "Pricing batch not found", ur: "قیمت بیچ نہیں ملا" },
  "دفعة الإرسال غير موجودة": { en: "Dispatch batch not found", ur: "ارسال بیچ نہیں ملا" },
  "البلاغ غير مسند إليك": { en: "This ticket is not assigned to you", ur: "یہ ٹکٹ آپ کو تفویض نہیں کیا گیا" },
  "هذا البند غير مسند إليك": { en: "This item is not assigned to you", ur: "یہ آئٹم آپ کو تفویض نہیں کیا گیا" },
  "ليس لديك صلاحية تنفيذ إجراء الفني على هذا البلاغ": { en: "You are not allowed to perform technician actions on this ticket", ur: "آپ کو اس ٹکٹ پر ٹیکنیشن کارروائی کی اجازت نہیں" },
  "البلاغ ليس في مرحلة الفرز": { en: "The ticket is not in the triage stage", ur: "ٹکٹ ٹرائیج مرحلے میں نہیں ہے" },
  "البلاغ ليس في مرحلة الفحص": { en: "The ticket is not in the inspection stage", ur: "ٹکٹ معائنہ مرحلے میں نہیں ہے" },
  "البلاغ يجب أن يكون قيد التنفيذ": { en: "The ticket must be in progress", ur: "ٹکٹ زیر عمل ہونا چاہیے" },
  "البلاغ يجب أن يكون جاهزاً للإغلاق": { en: "The ticket must be ready for closure", ur: "ٹکٹ بندش کے لیے تیار ہونا چاہیے" },
  "البلاغ يجب أن يكون مصلحاً": { en: "The ticket must be marked repaired", ur: "ٹکٹ کو مرمت شدہ ہونا چاہیے" },
  "البلاغ يجب أن يكون مغلقاً أولاً": { en: "The ticket must be closed first", ur: "ٹکٹ پہلے بند ہونا چاہیے" },
  "لا يمكن إغلاق البلاغ دون ملاحظات الإصلاح": { en: "Repair notes are required before closing the ticket", ur: "ٹکٹ بند کرنے سے پہلے مرمت نوٹس درکار ہیں" },
  "يجب كتابة ملاحظات الإصلاح قبل إرسال البلاغ للإغلاق": { en: "Enter repair notes before sending the ticket for closure", ur: "ٹکٹ بندش کے لیے بھیجنے سے پہلے مرمت نوٹس درج کریں" },
  "هذا الإجراء للمسار B فقط": { en: "This action is available only for Path B", ur: "یہ کارروائی صرف Path B کے لیے ہے" },
  "هذا الإجراء للمسار B أو C فقط": { en: "This action is available only for Path B or C", ur: "یہ کارروائی صرف Path B یا C کے لیے ہے" },
  "المسار C يتطلب مبرراً للصيانة الخارجية": { en: "Path C requires a justification for external maintenance", ur: "Path C کے لیے بیرونی مینٹیننس کی وجہ درکار ہے" },
  "الملاحظات الفنية مطلوبة عند إرسال نتيجة الفحص": { en: "Technical notes are required when submitting the inspection result", ur: "معائنہ نتیجہ بھیجتے وقت تکنیکی نوٹس درکار ہیں" },
  "مستوى الخطورة مطلوب عند إرسال نتيجة الفحص": { en: "Severity is required when submitting the inspection result", ur: "معائنہ نتیجہ بھیجتے وقت شدت درکار ہے" },
  "نتائج الفحص مطلوبة عند الإرسال": { en: "Inspection findings are required", ur: "معائنہ نتائج درکار ہیں" },
  "الإجراء الموصى به مطلوب عند الإرسال": { en: "Recommended action is required", ur: "تجویز کردہ کارروائی درکار ہے" },
  "سبب إعادة نتيجة الفحص للتصحيح مطلوب": { en: "A reason is required when returning the inspection for correction", ur: "معائنہ درستگی کے لیے واپس کرتے وقت وجہ درکار ہے" },
  "لا توجد نتيجة فحص مرسلة قابلة للمراجعة": { en: "There is no submitted inspection result available for review", ur: "جائزے کے لیے کوئی بھیجا ہوا معائنہ نتیجہ موجود نہیں" },
  "لا يمكن تحديد مسار التنفيذ قبل اعتماد نتيجة الفحص": { en: "The execution path cannot be selected before the inspection result is approved", ur: "معائنہ نتیجہ منظور ہونے سے پہلے عمل کا راستہ منتخب نہیں کیا جا سکتا" },
  "يجب إضافة صنف واحد على الأقل": { en: "Add at least one item", ur: "کم از کم ایک آئٹم شامل کریں" },
  "الحد الأقصى 20 صنف لكل طلب شراء": { en: "A purchase request can contain at most 20 items", ur: "خریداری درخواست میں زیادہ سے زیادہ 20 آئٹمز ہو سکتے ہیں" },
  "الطلب ليس مسودة": { en: "The request is not a draft", ur: "درخواست مسودہ نہیں ہے" },
  "لا يوجد أصناف في الطلب": { en: "The request has no items", ur: "درخواست میں کوئی آئٹم نہیں" },
  "المسودة غير موجودة": { en: "Draft not found", ur: "مسودہ نہیں ملا" },
  "لا يمكن تعديل طلب ليس مسودة": { en: "Only draft requests can be edited", ur: "صرف مسودہ درخواست میں ترمیم کی جا سکتی ہے" },
  "ليس لديك صلاحية لتعديل طلب الشراء": { en: "You are not allowed to edit this purchase request", ur: "آپ کو اس خریداری درخواست میں ترمیم کی اجازت نہیں" },
  "لا يمكنك اعتماد هذا الطلب": { en: "You are not allowed to approve this request", ur: "آپ کو اس درخواست کی منظوری کی اجازت نہیں" },
  "مبلغ العهدة إلزامي لاعتماد الطلب من الحسابات": { en: "Custody amount is required for Accounting approval", ur: "اکاؤنٹنگ منظوری کے لیے عہدہ رقم درکار ہے" },
  "مبلغ العهدة إلزامي لاعتماد الدفعة من الحسابات": { en: "Custody amount is required for Accounting batch approval", ur: "اکاؤنٹنگ بیچ منظوری کے لیے عہدہ رقم درکار ہے" },
  "هذه الدفعة ليست بانتظار اعتماد الحسابات": { en: "This batch is not waiting for Accounting approval", ur: "یہ بیچ اکاؤنٹنگ منظوری کا منتظر نہیں" },
  "هذه الدفعة ليست بانتظار اعتماد الإدارة": { en: "This batch is not waiting for Management approval", ur: "یہ بیچ انتظامیہ کی منظوری کا منتظر نہیں" },
  "لا توجد أصناف مسعّرة جاهزة للإرسال للحسابات": { en: "No priced items are ready to send to Accounting", ur: "اکاؤنٹنگ کو بھیجنے کے لیے کوئی قیمت شدہ آئٹم تیار نہیں" },
  "يجب اختيار الفني المستلم فعليًا قبل تأكيد التسليم": { en: "Select the actual recipient before confirming delivery", ur: "ترسیل کی تصدیق سے پہلے اصل وصول کنندہ منتخب کریں" },
  "الفني المستلم غير موجود أو غير نشط": { en: "The receiving technician does not exist or is inactive", ur: "وصول کنندہ ٹیکنیشن موجود نہیں یا غیر فعال ہے" },
  "يجب إدخال الصنف إلى المخزون أولًا قبل تسليمه للفني": { en: "The item must be received into inventory before delivery to the technician", ur: "ٹیکنیشن کو دینے سے پہلے آئٹم کو انوینٹری میں وصول کرنا ضروری ہے" },
  "الصنف غير موجود في المخزون": { en: "Item not found in inventory", ur: "آئٹم انوینٹری میں نہیں ملا" },
  "المورد غير موجود": { en: "Supplier not found", ur: "سپلائر نہیں ملا" },
  "إرسال دفعة التسعير متاح للمندوب فقط": { en: "Only the purchasing delegate can submit a pricing batch", ur: "صرف خریداری مندوب قیمت بیچ بھیج سکتا ہے" },
  "الحزمة لا تحتوي طلبات": { en: "The package contains no purchase requests", ur: "پیکیج میں کوئی خریداری درخواست نہیں" },
  "لا توجد أصناف مسعّرة جاهزة للإرسال في أي من طلبات الحزمة": { en: "No priced items are ready to submit in any request in this package", ur: "اس پیکیج کی کسی درخواست میں بھی قیمت شدہ آئٹم بھیجنے کے لیے تیار نہیں" },
  "ليس لديك صلاحية لإدارة PM V2": { en: "You are not allowed to manage PM V2", ur: "آپ کو PM V2 کا انتظام کرنے کی اجازت نہیں" },
  "ليس لديك صلاحية تنفيذ مهام PM V2 كفني": { en: "You are not allowed to execute PM V2 tasks", ur: "آپ کو PM V2 ٹاسکس انجام دینے کی اجازت نہیں" },
  "ليس لديك صلاحية لمعالجة طلبات مواد PM V2 في المستودع": { en: "You are not allowed to process PM V2 material requests in the warehouse", ur: "آپ کو گودام میں PM V2 مواد درخواستوں کی کارروائی کی اجازت نہیں" },
  "مهمة PM V2 غير موجودة": { en: "PM V2 task not found", ur: "PM V2 ٹاسک نہیں ملا" },
  "وحدة التكرار غير صالحة": { en: "Invalid recurrence unit", ur: "تکرار یونٹ درست نہیں" },
  "إعداد التكرار غير صالح": { en: "Invalid recurrence configuration", ur: "تکرار کی ترتیب درست نہیں" },
  "تاريخ بداية التكرار غير صالح": { en: "Invalid recurrence start date", ur: "تکرار کی شروع تاریخ درست نہیں" },
  "اختر يومًا واحدًا على الأقل من أيام الأسبوع": { en: "Select at least one weekday", ur: "کم از کم ایک ہفتہ وار دن منتخب کریں" },
  "اختر يومًا واحدًا على الأقل من أيام الشهر": { en: "Select at least one day of the month", ur: "مہینے کا کم از کم ایک دن منتخب کریں" },
  "سجل الصيانة الخارجية غير موجود": { en: "External maintenance record not found", ur: "بیرونی مینٹیننس ریکارڈ نہیں ملا" },
  "تعذر تنفيذ إجراء الصيانة الخارجية": { en: "The external maintenance action could not be completed", ur: "بیرونی مینٹیننس کارروائی مکمل نہیں ہو سکی" },
  "لا يمكن اعتماد الخروج في المرحلة الحالية": { en: "Gate exit cannot be approved at the current stage", ur: "موجودہ مرحلے میں گیٹ اخراج منظور نہیں ہو سکتا" },
  "لا يمكن اعتماد الدخول قبل اكتمال الصيانة الخارجية": { en: "Gate entry cannot be approved before external maintenance is complete", ur: "بیرونی مینٹیننس مکمل ہونے سے پہلے گیٹ داخلہ منظور نہیں ہو سکتا" },
  "لا يمكن استلام الأصل قبل موافقة الحراسة على الدخول": { en: "The asset cannot be received before Gate Security approves entry", ur: "گیٹ سیکیورٹی کی داخلہ منظوری سے پہلے اثاثہ وصول نہیں ہو سکتا" },
  "لا يمكن تسليم الأصل للفني قبل تسجيل استلامه في المستودع": { en: "The asset cannot be handed to the technician before warehouse receipt is recorded", ur: "گودام وصولی درج ہونے سے پہلے اثاثہ ٹیکنیشن کے حوالے نہیں کیا جا سکتا" },
  "الأصل غير جاهز للتسليم للفني": { en: "The asset is not ready for technician handover", ur: "اثاثہ ٹیکنیشن کے حوالے کرنے کے لیے تیار نہیں" },
  "يجب تحديد المندوب المسؤول قبل خروج الأصل": { en: "Select the responsible delegate before the asset leaves", ur: "اثاثہ نکلنے سے پہلے ذمہ دار مندوب منتخب کریں" },
  "البلاغ ليس جاهزًا لخروج الأصل في المسار C": { en: "The ticket is not ready for asset exit in Path C", ur: "Path C میں اثاثہ نکالنے کے لیے ٹکٹ تیار نہیں" },
  "يجب وجود فني مسند للبلاغ قبل تسليم الأصل لإعادة التركيب": { en: "An assignee is required before handing over the asset for reinstallation", ur: "دوبارہ تنصیب کے لیے اثاثہ حوالے کرنے سے پہلے ذمہ دار فرد مقرر ہونا ضروری ہے" },
  "يجب اختيار فني أو مسؤول صالح لاستلام الأصل": { en: "Select an eligible technician or responsible user to receive the asset", ur: "اثاثہ وصول کرنے کے لیے اہل ٹیکنیشن یا ذمہ دار صارف منتخب کریں" },
  "مدير تقنية المعلومات يمكنه استلام الأصل فقط لبلاغ IT المسند إليه": { en: "The IT Manager can receive an asset only for an IT ticket assigned to them", ur: "آئی ٹی مینیجر صرف اپنے تفویض شدہ آئی ٹی ٹکٹ کا اثاثہ وصول کر سکتا ہے" },
};

const PATTERNS: Array<{ re: RegExp; en: string; ur: string }> = [
  { re: /^لا يمكن بدء التنفيذ في الحالة الحالية:\s*(.+)$/u, en: "Execution cannot start in the current status: {1}", ur: "موجودہ حالت میں عمل شروع نہیں ہو سکتا: {1}" },
  { re: /^لا يمكن إعادة الإسناد في الحالة:\s*(.+)$/u, en: "Reassignment is not allowed in status: {1}", ur: "اس حالت میں دوبارہ تفویض ممکن نہیں: {1}" },
  { re: /^لا يمكن إنشاء طلب شراء جديد في الحالة الحالية:\s*(.+)$/u, en: "A new purchase request cannot be created in the current status: {1}", ur: "موجودہ حالت میں نئی خریداری درخواست نہیں بن سکتی: {1}" },
  { re: /^الكمية المطلوبة \((.+)\) أكبر من الرصيد \((.+)\)$/u, en: "Requested quantity ({1}) exceeds available balance ({2})", ur: "درخواست کردہ مقدار ({1}) دستیاب بیلنس ({2}) سے زیادہ ہے" },
  { re: /^الكمية المطلوبة \((.+)\) أكبر من كمية بند الطلب \((.+)\)$/u, en: "Requested quantity ({1}) exceeds the order-item quantity ({2})", ur: "درخواست کردہ مقدار ({1}) آرڈر آئٹم مقدار ({2}) سے زیادہ ہے" },
  { re: /^الحد الأقصى 20 صنف لكل طلب شراء\. لديك (.+) صنف$/u, en: "A purchase request can contain at most 20 items. You currently have {1} items", ur: "خریداری درخواست میں زیادہ سے زیادہ 20 آئٹمز ہو سکتے ہیں۔ آپ کے پاس {1} آئٹمز ہیں" },
  { re: /^طلب الشراء رقم (.+) غير موجود$/u, en: "Purchase request {1} was not found", ur: "خریداری درخواست {1} نہیں ملی" },
  { re: /^الصنف رقم (.+): يجب تعيين مندوب للأصناف المعتمدة$/u, en: "Item {1}: assign a delegate to approved items", ur: "آئٹم {1}: منظور شدہ آئٹمز کے لیے مندوب مقرر کریں" },
  { re: /^الصنف رقم (.+): يجب إدخال سبب رفض الأصناف المرفوضة$/u, en: "Item {1}: enter a rejection reason", ur: "آئٹم {1}: مسترد کرنے کی وجہ درج کریں" },
  { re: /^لا يوجد مدير تقنية معلومات نشط\./u, en: "No active IT Manager is configured. Assign one active IT Manager before creating IT tickets.", ur: "کوئی فعال آئی ٹی مینیجر مقرر نہیں۔ آئی ٹی ٹکٹ بنانے سے پہلے ایک فعال آئی ٹی مینیجر مقرر کریں۔" },
  { re: /^يوجد أكثر من مدير تقنية معلومات نشط\./u, en: "More than one active IT Manager exists. Keep one active IT Manager for automatic routing.", ur: "ایک سے زیادہ فعال آئی ٹی مینیجر موجود ہیں۔ خودکار روٹنگ کے لیے ایک فعال آئی ٹی مینیجر رکھیں۔" },
  { re: /^تم تعديل الصنف بواسطة مستخدم آخر/u, en: "The item was changed by another user. Refresh the page and try again.", ur: "آئٹم دوسرے صارف نے تبدیل کیا۔ صفحہ تازہ کریں اور دوبارہ کوشش کریں۔" },
  { re: /^تغيرت بيانات .* حدّث الصفحة/u, en: "The data changed while you were working. Refresh the page and try again.", ur: "کام کے دوران ڈیٹا بدل گیا۔ صفحہ تازہ کریں اور دوبارہ کوشش کریں۔" },
];

function currentLanguage(): SupportedLanguage {
  if (typeof document !== "undefined") {
    const lang = document.documentElement.lang;
    if (lang === "en" || lang === "ur" || lang === "ar") return lang;
  }
  if (typeof window !== "undefined") {
    const lang = window.localStorage.getItem("cmms-language");
    if (lang === "en" || lang === "ur" || lang === "ar") return lang;
  }
  return "ar";
}

function applyPattern(template: string, match: RegExpMatchArray) {
  return template.replace(/\{(\d+)\}/g, (_, index) => match[Number(index)] ?? "");
}

export function localizeApiError(message: unknown, language: SupportedLanguage = currentLanguage()) {
  const text = message == null ? "" : String(message);
  if (!text || language === "ar" || !/[\u0600-\u06ff]/u.test(text)) return text;
  const exact = EXACT[text];
  if (exact) return exact[language];
  for (const pattern of PATTERNS) {
    const match = text.match(pattern.re);
    if (match) return applyPattern(pattern[language], match);
  }
  return language === "ur"
    ? "کارروائی مکمل نہیں ہو سکی۔ موجودہ مرحلہ اور معلومات چیک کریں، پھر دوبارہ کوشش کریں۔"
    : "The operation could not be completed. Check the current stage and data, then try again.";
}
