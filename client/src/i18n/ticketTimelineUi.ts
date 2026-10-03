import type { SupportedLanguage } from "@/contexts/LanguageContext";

type Entry = { en: string; ur: string };

const EXACT: Record<string, Entry> = {
  "تم توجيه البلاغ آليًا إلى تقنية المعلومات لبدء تحليل وإنشاء المهام": {
    en: "The ticket was routed automatically to IT for task planning",
    ur: "ٹکٹ خودکار طور پر ٹاسک پلاننگ کے لیے آئی ٹی کو بھیج دیا گیا",
  },
  "تم إنشاء طلب شراء مرتبط بالبلاغ": { en: "A purchase order linked to the ticket was created", ur: "ٹکٹ سے منسلک خریداری آرڈر بنایا گیا" },
  "تم إرسال طلب الشراء للمراجعة": { en: "The purchase order was sent for review", ur: "خریداری آرڈر جائزے کے لیے بھیج دیا گیا" },
  "تمت مراجعة أصناف طلب الشراء": { en: "Purchase order items were reviewed", ur: "خریداری آرڈر آئٹمز کا جائزہ لیا گیا" },
  "تم إرسال دفعة التسعير إلى الحسابات": { en: "The pricing batch was sent to Accounting", ur: "قیمتوں کا بیچ اکاؤنٹنگ کو بھیج دیا گیا" },
  "تم اعتماد طلب الشراء من الحسابات": { en: "The purchase order was approved by Accounting", ur: "خریداری آرڈر اکاؤنٹنگ سے منظور ہوگیا" },
  "تم اعتماد دفعة تسعير من الحسابات": { en: "The pricing batch was approved by Accounting", ur: "قیمتوں کا بیچ اکاؤنٹنگ سے منظور ہوگیا" },
  "تم اعتماد طلب الشراء من الإدارة": { en: "The purchase order was approved by Management", ur: "خریداری آرڈر انتظامیہ سے منظور ہوگیا" },
  "تم اعتماد دفعة تسعير من الإدارة": { en: "The pricing batch was approved by Management", ur: "قیمتوں کا بیچ انتظامیہ سے منظور ہوگیا" },
  "تم تحديث شراء أصناف طلب الشراء": { en: "Purchase progress for the order items was updated", ur: "خریداری آرڈر آئٹمز کی خریداری پیش رفت اپ ڈیٹ ہوگئی" },
  "تم استلام مواد طلب الشراء في المستودع": { en: "Purchase order materials were received at the warehouse", ur: "خریداری آرڈر کا مواد گودام میں وصول ہوگیا" },
  "تم تسليم مادة مرتبطة بالبلاغ من المخزون": { en: "A ticket-linked material was delivered from inventory", ur: "ٹکٹ سے منسلک مواد انوینٹری سے فراہم کیا گیا" },
  "تم تحديث تسليم مواد طلب الشراء إلى الفني": { en: "Delivery of purchase order materials to the technician was updated", ur: "خریداری آرڈر کے مواد کی ٹیکنیشن کو حوالگی اپ ڈیٹ ہوگئی" },
  "تم تحديث حالة شراء صنف مرتبط بالبلاغ": { en: "The purchase status of a ticket-linked item was updated", ur: "ٹکٹ سے منسلک آئٹم کی خریداری حالت اپ ڈیٹ ہوگئی" },
  "تم إغلاق طلب الشراء": { en: "The purchase order was closed", ur: "خریداری آرڈر بند کردیا گیا" },
  "تم رفض طلب الشراء": { en: "The purchase order was rejected", ur: "خریداری آرڈر مسترد کردیا گیا" },
  "رُفضت جميع أصناف طلب الشراء": { en: "All purchase order items were rejected", ur: "خریداری آرڈر کے تمام آئٹمز مسترد کردیئے گئے" },
  "تم إلغاء صنف من طلب الشراء": { en: "A purchase order item was cancelled", ur: "خریداری آرڈر کا ایک آئٹم منسوخ کردیا گیا" },
  "أعيد طلب الشراء للمراجعة": { en: "The purchase order was returned for review", ur: "خریداری آرڈر دوبارہ جائزے کے لیے بھیجا گیا" },
  "أعيد إرسال طلب الشراء للمراجعة": { en: "The purchase order was resubmitted for review", ur: "خریداری آرڈر دوبارہ جائزے کے لیے جمع کیا گیا" },
  "طُلبت مراجعة أحد أصناف طلب الشراء": { en: "A purchase order item revision was requested", ur: "خریداری آرڈر کے ایک آئٹم کی نظرثانی طلب کی گئی" },
  "أعيد الصنف الملغى إلى مرحلة الشراء": { en: "The cancelled item was returned to the purchase stage", ur: "منسوخ آئٹم کو خریداری مرحلے میں واپس کردیا گیا" },
  "تم حسم الصنف الملغى نهائيًا": { en: "The cancelled item was finalized", ur: "منسوخ آئٹم کا معاملہ حتمی کردیا گیا" },
  "أعيد الصنف للتسعير بعد المراجعة": { en: "The item was returned for pricing after review", ur: "جائزے کے بعد آئٹم دوبارہ قیمت لگانے کے لیے بھیجا گیا" },
  "تم حذف طلب شراء مرتبط بالبلاغ": { en: "A purchase order linked to the ticket was deleted", ur: "ٹکٹ سے منسلک خریداری آرڈر حذف کردیا گیا" },
  "تم اعتماد دفعة إرسال الحزمة من الحسابات": { en: "The package submission batch was approved by Accounting", ur: "پیکیج جمع کرانے کا بیچ اکاؤنٹنگ سے منظور ہوگیا" },
  "تم اعتماد دفعة إرسال الحزمة من الإدارة العليا": { en: "The package submission batch was approved by Senior Management", ur: "پیکیج جمع کرانے کا بیچ اعلیٰ انتظامیہ سے منظور ہوگیا" },
  "تم تعديل صنف معاد وإرساله مجددًا ضمن دورة الشراء": { en: "A returned item was revised and resubmitted into the purchase cycle", ur: "واپس کیے گئے آئٹم میں ترمیم کرکے خریداری مرحلے میں دوبارہ جمع کیا گیا" },
};

function pick(entry: Entry, language: SupportedLanguage | string): string {
  return language === "ur" ? entry.ur : entry.en;
}

export function localizeTicketTimelineSystemText(
  value: string | null | undefined,
  language: SupportedLanguage | string,
): string {
  const text = String(value || "").trim();
  if (!text || language === "ar") return text;
  const exact = EXACT[text];
  if (exact) return pick(exact, language);

  let m = text.match(/^المسار:\s*([ABC])$/i);
  if (m) return language === "ur" ? `مسار: ${m[1].toUpperCase()}` : `Path: ${m[1].toUpperCase()}`;

  m = text.match(/^تم تسجيل واعتماد نتيجة الفحص — المراجعة رقم\s*(\d+)$/);
  if (m) return language === "ur" ? `معائنہ نتیجہ درج اور منظور — نظرثانی نمبر ${m[1]}` : `Inspection result recorded and approved — revision ${m[1]}`;

  m = text.match(/^تم إرسال نتيجة الفحص للمراجعة — المراجعة رقم\s*(\d+)$/);
  if (m) return language === "ur" ? `معائنہ نتیجہ جائزے کے لیے بھیجا گیا — نظرثانی نمبر ${m[1]}` : `Inspection result sent for review — revision ${m[1]}`;

  m = text.match(/^تم اعتماد نتيجة الفحص — المراجعة رقم\s*(\d+)$/);
  if (m) return language === "ur" ? `معائنہ نتیجہ منظور — نظرثانی نمبر ${m[1]}` : `Inspection result approved — revision ${m[1]}`;

  m = text.match(/^أعيدت نتيجة الفحص للتصحيح — السبب:\s*(.+)$/s);
  if (m) return language === "ur" ? `معائنہ نتیجہ تصحیح کے لیے واپس — وجہ: ${m[1]}` : `Inspection result returned for correction — reason: ${m[1]}`;

  m = text.match(/^تم تحويل البلاغ من تقنية المعلومات إلى (.+?)\. التبرير:\s*(.+)$/s);
  if (m) return language === "ur"
    ? `ٹکٹ آئی ٹی سے ${m[1]} کو منتقل کیا گیا۔ جواز: ${m[2]}`
    : `Ticket transferred from IT to ${m[1]}. Justification: ${m[2]}`;

  m = text.match(/^تم اعتماد (\d+) جهة وبدء مرحلة تحليل المهام$/);
  if (m) return language === "ur" ? `${m[1]} شعبے منظور ہوئے اور ٹاسک تجزیہ شروع ہوا` : `${m[1]} department(s) approved and task analysis started`;

  m = text.match(/^تم إنشاء البلاغ الفرعي من المهمة (.+?) التابعة للبلاغ (.+)$/);
  if (m) return language === "ur" ? `ذیلی ٹکٹ ٹاسک ${m[1]} سے، ٹکٹ ${m[2]} کے تحت بنایا گیا` : `Child ticket created from task ${m[1]} under ticket ${m[2]}`;

  return text;
}
