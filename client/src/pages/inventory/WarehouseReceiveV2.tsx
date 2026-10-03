import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { trpc } from "@/lib/trpc";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowRight, Package, CheckCircle2, Loader2, AlertTriangle,
  Camera, Upload, ScanLine, Link2, X, ChevronDown, ChevronUp,
  Sparkles, FileText, RefreshCw, Eye, Copy, Building2, Search
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { mediaUrl } from "@/lib/mediaUrl";
import { printReceiptDocument } from "@/lib/printReceiptDocument";
import DropZone, { UploadedFile } from "@/components/common/DropZone";

// ── Types ────────────────────────────────────────────────────
type ItemType = "spare_part" | "consumable" | "tool" | "food";

interface ReceiveItem {
  purchaseOrderItemId:  number;
  itemName:             string;
  itemName_ar?:         string;
  itemName_en?:         string;
  itemType:             ItemType;
  requestedQuantity:    number;
  receivedQuantity:     number;
  purchaseUnit:         string;
  issueUnit?:           string;
  conversionFactor:     number;
  unitCost:             string;
  expectedUnitCost?:    string;
  taxRate:              number;
  taxAmount:            string;
  lineTotal:            string;
  manufacturerBarcode?: string;
  expiryDate?:          string;
  inventoryId?:         number;
  internalCode?:        string;
  // 2B-3: هوية Catalog Item المركزية منفصلة عن اسم/SKU المورد.
  linkedItemId?:        number;
  supplierItemCode?:    string;
  // 2B-4: قرار صريح بأن الصنف غير موجود في Catalog Master الحالي.
  isNewCatalogItem?:    boolean;
  catalogMatches?:      CatalogItemMatch[];
  catalogLinkSource?:   "po" | "supplier_memory" | "user";
  ocrExtracted:         boolean;
  manuallyEdited:       boolean;
  // UI state
  expanded:             boolean;
  hasDiff:              boolean;
  similarItems?:        any[];
  showSimilar:          boolean;
}

interface CatalogItemMatch {
  catalogItemId: number;
  code?: string | null;
  nameAr: string;
  nameEn?: string | null;
  unit?: string | null;
  score: number;
  reason: "supplier_code_exact" | "supplier_alias_exact" | "supplier_alias_similar" | "catalog_name_exact" | "catalog_semantic" | "catalog_local_strong" | "ai_semantic";
  measurementStatus: "compatible" | "conflict" | "unknown";
  measurementNote?: string | null;
  matchedAlias?: string | null;
  autoSelect: boolean;
  aiUsed?: boolean;
}

interface InvoiceData {
  vendorName?:      string;
  vendorNameEn?:    string;
  vendorTaxNumber?: string;
  invoiceNumber?:   string;
  invoiceDate?:     string;
  subtotal?:        number;
  taxAmount?:       number;
  grandTotal?:      number;
}

interface SupplierMatch {
  id: number;
  nameAr: string;
  nameEn?: string | null;
  taxNumber?: string | null;
  commercialRegistration?: string | null;
  score: number;
  reason: "tax_exact" | "alias_exact" | "name_exact" | "name_contains" | "name_tokens" | "weak";
  matchedText?: string | null;
}

type Step = "upload" | "review" | "items" | "confirm";

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  spare_part:  "قطعة غيار",
  consumable:  "مادة استهلاكية",
  tool:        "أداة / عدة",
  food:        "مادة غذائية",
};

const ITEM_TYPE_COLORS: Record<ItemType, string> = {
  spare_part:  "bg-blue-50 text-blue-700 border-blue-200",
  consumable:  "bg-gray-50 text-gray-700 border-gray-200",
  tool:        "bg-amber-50 text-amber-700 border-amber-200",
  food:        "bg-green-50 text-green-700 border-green-200",
};

const supplierMatchReasonLabel = (reason: SupplierMatch["reason"]) => ({
  tax_exact: "تطابق الرقم الضريبي",
  alias_exact: "اسم سابق معروف لهذا المورد",
  name_exact: "تطابق الاسم",
  name_contains: "تشابه قوي في الاسم",
  name_tokens: "تشابه كلمات الاسم",
  weak: "اقتراح تقريبي",
}[reason]);

const catalogMatchReasonLabel = (reason: CatalogItemMatch["reason"]) => ({
  supplier_code_exact: "SKU معروف لهذا المورد",
  supplier_alias_exact: "اسم معروف لهذا المورد",
  supplier_alias_similar: "اسم قريب من ذاكرة المورد",
  catalog_name_exact: "تطابق اسم الكتالوج",
  catalog_semantic: "تطابق دلالي",
  catalog_local_strong: "اقتراح بحث ذكي",
  ai_semantic: "ترتيب دلالي بمساعدة AI",
}[reason]);

// 2B-3 UAT: لا نعرض اقتراحات عامة ضعيفة لمجرد أنها أعلى النتائج.
// ذاكرة المورد والتطابق الحرفي موثوقان، أما التطابق الدلالي/AI فيحتاج
// درجة أعلى حتى يظهر ضمن «الاقتراحات الذكية». البحث اليدوي يبقى متاحاً دائماً.
const isReviewableCatalogMatch = (match: CatalogItemMatch) => {
  if (match.reason === "supplier_code_exact" || match.reason === "supplier_alias_exact") return true;
  if (match.reason === "supplier_alias_similar") return match.score >= 82;
  if (match.reason === "catalog_name_exact") return true;
  return match.score >= 75;
};

const createManualItemsFromPoCandidates = (candidates: any[]): ReceiveItem[] =>
  candidates.map((i: any) => ({
    purchaseOrderItemId:  i.id,
    linkedItemId:         i.catalogItemId || undefined,
    catalogLinkSource:    i.catalogItemId ? "po" : undefined,
    isNewCatalogItem:     false,
    itemName:             i.itemName,
    itemType:             "consumable" as ItemType,
    requestedQuantity:    i.quantity,
    receivedQuantity:     i.receivedQuantity || i.quantity,
    purchaseUnit:         i.unit || "قطعة",
    conversionFactor:     1,
    unitCost:             i.actualUnitCost || i.estimatedUnitCost || "",
    expectedUnitCost:     i.estimatedUnitCost || undefined,
    taxRate:              15,
    taxAmount:            "0",
    lineTotal:            "0",
    ocrExtracted:         false,
    manuallyEdited:       false,
    expanded:             true,
    hasDiff:              false,
    showSimilar:          false,
  }));

// ─────────────────────────────────────────────────────────────
export default function WarehouseReceiveV2() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const poId = params.get("poId") ? parseInt(params.get("poId")!) : null;
  // رقم فاتورة المورد الممرّر من تبويب "إدخال المخزون" — يحدد أي مجموعة أصناف
  // من الطلب سيتم استلامها في هذه الجلسة (طلب واحد قد يحتوي عدة فواتير موردين)
  const invoiceNumberParam = params.get("invoiceNumber") || null;

  return <WarehouseReceiveForm key={`${poId}:${invoiceNumberParam}`} poId={poId} invoiceNumberParam={invoiceNumberParam} />;
}

function WarehouseReceiveForm({ poId, invoiceNumberParam }: { poId: number | null; invoiceNumberParam: string | null }) {
  const [, navigate] = useLocation();
  // ── State ──────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("upload");
  const [invoiceFile, setInvoiceFile]   = useState<UploadedFile | null>(null);
  const [goodsFile, setGoodsFile]       = useState<UploadedFile | null>(null);
  const [ocrJobId, setOcrJobId]         = useState<number | null>(null);
  const [invoiceData, setInvoiceData]   = useState<InvoiceData>({});
  const [items, setItems]               = useState<ReceiveItem[]>([]);
  // بنود طلب الشراء المرشّحة للربط (delivered_to_warehouse لنفس الفاتورة) —
  // هذه ليست الأصناف المعروضة للتعديل، فقط مصدر لربط كل صنف بالفاتورة ببنده
  // الأصلي بالطلب (مطلوب لتحديث حالة البند وسعره الفعلي عند الحفظ).
  const [poCandidates, setPoCandidates] = useState<any[]>([]);
  const [notes, setNotes]               = useState("");
  const [isDuplicate, setIsDuplicate]   = useState(false);
  const [initialized, setInitialized]   = useState(false);
  const [manualEntrySelected, setManualEntrySelected] = useState(false);
  const [manualItemsInitialized, setManualItemsInitialized] = useState(false);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  // 2B-2: قرار هوية المورد يتم في شاشة مراجعة الفاتورة. اسم الفاتورة يبقى
  // Snapshot كما هو، بينما selectedSupplier هو رابط Supplier Master.
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierMatch | null>(null);
  const [isNewSupplier, setIsNewSupplier] = useState(false);
  // 2B-3 fix: SKU المورد قد يُكتب بعد فتح شاشة الأصناف. نعيد فحص ذاكرة
  // المورد بعد توقف الكتابة بقليل، بدون استدعاء AI لكل ضغطة مفتاح.
  const skuMatchTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const skuMatchVersionRef = useRef<Map<number, number>>(new Map());
  // 2B-3 UAT: Single-flight/cache داخل جلسة مراجعة الفاتورة. إذا عاد المستخدم
  // من شاشة الأصناف وضغط «التالي» لنفس المورد ونفس بيانات الأصناف، نعيد نفس
  // النتيجة بدل تشغيل DeepSeek مرة أخرى. تغير الاسم/SKU/الوحدة/المورد ينتج key جديداً.
  const itemMatchRequestCacheRef = useRef<Map<string, Promise<any[]>>>(new Map());
  const [skuMatchingIndex, setSkuMatchingIndex] = useState<number | null>(null);
  // 2B-4 UAT: بعد أول محاولة انتقال من مراجعة الأصناف، نظهر أخطاء
  // قرار الكتالوج داخل البطاقات نفسها حتى يعرف المستخدم السطر المقصود
  // عند وجود فاتورة متعددة الأصناف.
  const [showCatalogDecisionErrors, setShowCatalogDecisionErrors] = useState(false);

  // ── Queries ────────────────────────────────────────────────
  const { data: po, isLoading: isPoLoading, isError: isPoError, error: poError, refetch: refetchPo } =
    trpc.warehouseReceiptsV2.purchaseReceiptContext.useQuery(
      { purchaseOrderId: poId!, invoiceNumber: invoiceNumberParam || undefined },
      { enabled: Number.isInteger(poId) && Number(poId) > 0, retry: false, refetchOnWindowFocus: false },
    );

  const supplierSearchName = (invoiceData.vendorName || invoiceData.vendorNameEn || "").trim();
  const { data: supplierMatches = [], isFetching: isMatchingSuppliers } = trpc.catalog.suppliers.match.useQuery(
    {
      query: supplierSearchName || undefined,
      taxNumber: invoiceData.vendorTaxNumber?.trim() || undefined,
      limit: 5,
    },
    {
      enabled: step === "review" && !isNewSupplier && (supplierSearchName.length >= 2 || !!invoiceData.vendorTaxNumber?.trim()),
    },
  );

  // تحميل بنود الطلب المرشّحة للربط (بحالة "توريد للمستودع" ونفس رقم الفاتورة)
  // — لا تُعرض كأصناف جاهزة، فقط قائمة نربط بها أصناف الفاتورة الحقيقية لاحقاً.
  useEffect(() => {
    if (!initialized && (po as any)?.items) {
      // Server scopes by PO/invoice and excludes confirmed receipt items.
      setPoCandidates(po!.items);
      setInitialized(true);
    }
  }, [po, initialized, invoiceNumberParam]);

  // إصلاح Race Condition في الإدخال اليدوي: قد يختار المستخدم الإدخال اليدوي
  // قبل وصول أصناف طلب الشراء. عند وصولها لاحقًا نهيّئ items مرة واحدة
  // ما دامت القائمة ما زالت فارغة، بدون الكتابة فوق أي تعديل/بيانات موجودة.
  useEffect(() => {
    if (!manualEntrySelected || manualItemsInitialized) return;

    // إن كانت هناك أصناف أصلًا (حالة رجوع/مسار سابق)، لا نكتب فوقها.
    if (items.length > 0) {
      setManualItemsInitialized(true);
      return;
    }

    if (poCandidates.length === 0) return;
    setItems(createManualItemsFromPoCandidates(poCandidates));
    setManualItemsInitialized(true);
  }, [manualEntrySelected, manualItemsInitialized, poCandidates, items.length]);

  useEffect(() => () => {
    skuMatchTimersRef.current.forEach(timer => clearTimeout(timer));
    skuMatchTimersRef.current.clear();
  }, []);

  // مطابقة تقريبية بالاسم لاقتراح ربط تلقائي بين صنف الفاتورة وبند الطلب —
  // اقتراح فقط قابل للتغيير يدوياً، وليس اعتماداً نهائياً
  const suggestPoMatch = (ocrItemName: string, used: Set<number>) => {
    const norm = (s: string) => (s || "").trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "");
    const target = norm(ocrItemName);
    const targetWords = new Set(target.split(/\s+/).filter(w => w.length > 1));
    let best: any = null;
    let bestScore = 0;
    for (const cand of poCandidates) {
      if (used.has(cand.id)) continue;
      const candWords = new Set(norm(cand.itemName).split(/\s+/).filter(w => w.length > 1));
      let score = 0;
      candWords.forEach(w => { if (targetWords.has(w)) score++; });
      if (score > bestScore) { bestScore = score; best = cand; }
    }
    return bestScore > 0 ? best : null;
  };

  // ── Mutations ──────────────────────────────────────────────
  const ocrMut = trpc.warehouseReceiptsV2.analyzeInvoice.useMutation({
    onSuccess: (data: any) => {
      setOcrJobId(data.ocrJobId);
      setIsDuplicate(data.isDuplicate);
      setOcrConfidence(data.confidence);

      // ملء بيانات الفاتورة
      const inv = data.invoiceData;
      setSelectedSupplier(null);
      setIsNewSupplier(false);
      setInvoiceData({
        vendorName:      inv.vendorName,
        vendorNameEn:    inv.vendorNameEn,
        vendorTaxNumber: inv.vendorTaxNumber,
        invoiceNumber:   inv.invoiceNumber,
        invoiceDate:     inv.invoiceDate,
        subtotal:        inv.subtotal,
        taxAmount:       inv.taxAmount,
        grandTotal:      inv.grandTotal,
      });

      // بناء قائمة الأصناف من الفاتورة الحقيقية نفسها — نفس العدد ونفس
      // المسميات كما استخرجها OCR، وليست دمجاً فوق أصناف الطلب. كل صنف
      // يُقترح ربطه تلقائياً ببند من الطلب (poCandidates) بالتشابه بالاسم،
      // ويبقى قابلاً للتعديل يدوياً من المستخدم قبل الحفظ.
      (async () => {
        if (inv.items?.length > 0) {
          let barcodes: string[] = [];
          try {
            const res = await generateBarcodesMut.mutateAsync({ count: inv.items.length });
            barcodes = res.barcodes;
          } catch {
            const year = new Date().getFullYear();
            barcodes = inv.items.map((_: any, i: number) => `${year}${i + 1}`);
          }

          const usedPoIds = new Set<number>();
          const newItems: ReceiveItem[] = inv.items.map((ocrItem: any, idx: number) => {
            const suggested = suggestPoMatch(ocrItem.itemName || "", usedPoIds);
            if (suggested) usedPoIds.add(suggested.id);

            const receivedQty = ocrItem.quantity || 1;
            const unitCost    = ocrItem.unitPrice?.toString() || "0";
            const taxAmt      = (ocrItem.taxAmount || 0).toFixed(2);
            const lineTotal   = ocrItem.lineTotal?.toFixed(2) || (receivedQty * parseFloat(unitCost) * 1.15).toFixed(2);
            const hasDiff     = suggested
              ? (suggested.estimatedUnitCost
                  ? Math.abs(parseFloat(unitCost) - parseFloat(suggested.estimatedUnitCost)) > 0.01
                  : false) || receivedQty !== suggested.quantity
              : false;

            return {
              // اسم الصنف كما في الفاتورة الفعلية — هذا هو المصدر الذي سيُدخَل
              // للمخزون، وليس اسم بند الطلب الأصلي
              itemName:            ocrItem.itemName || "صنف غير محدد",
              itemName_en:         ocrItem.itemNameEn,
              itemType:            "consumable" as const,
              // الربط ببند الطلب (0 = غير مربوط بعد، يجب اختياره يدوياً قبل الحفظ)
              purchaseOrderItemId: suggested?.id || 0,
              // 2B-1 + 2B-3: إذا كان بند الطلب من الكتالوج فهويته أقوى من أي مطابقة نصية.
              linkedItemId:        suggested?.catalogItemId || undefined,
              catalogLinkSource:   suggested?.catalogItemId ? "po" : undefined,
              supplierItemCode:    ocrItem.supplierItemCode || undefined,
              isNewCatalogItem:     false,
              requestedQuantity:   suggested?.quantity ?? receivedQty,
              receivedQuantity:    receivedQty,
              purchaseUnit:        ocrItem.unit || suggested?.unit || "قطعة",
              conversionFactor:    1,
              unitCost,
              expectedUnitCost:    suggested?.estimatedUnitCost || undefined,
              taxRate:             ocrItem.taxRate || 15,
              taxAmount:           taxAmt,
              lineTotal,
              manufacturerBarcode: barcodes[idx],
              ocrExtracted:        true,
              manuallyEdited:      false,
              expanded:            true,
              hasDiff,
              similarItems:        ocrItem.matchedItems || [],
              showSimilar:         ocrItem.existsInSystem,
            } as ReceiveItem;
          });

          setItems(newItems);

          const unlinkedCount = newItems.filter(i => !i.purchaseOrderItemId).length;
          if (unlinkedCount > 0) {
            toast.info(`${unlinkedCount} صنف بدون ربط ببند طلب — سيُستلم للمخزون مباشرة كصنف زائد عن الطلب`, {
              description: "يمكنك ربطه ببند إن كان يقابل طلباً فعلياً، أو تركه كما هو",
            });
          }
        } else {
          toast.error("لم يتمكن التحليل من استخراج أي أصناف من الفاتورة", {
            description: "تحقق من وضوح الصورة أو أدخل الأصناف يدوياً",
          });
        }
        toast.success("تم تحليل الفاتورة بنجاح", {
          description: `دقة التحليل: ${Math.round((data.confidence || 0) * 100)}%`,
        });
        setStep("review");
      })();
    },
    onError: (err: any) => {
      toast.error("تعذّر تحليل الفاتورة", { description: err.message });
    },
  });

  const [printItems, setPrintItems] = useState<any[]>([]);
  const [showPrint, setShowPrint] = useState(false);
  // معرّف السند المحفوظ — لطباعة «سند استلام المشتريات» الرسمي بعد الحفظ
  const [savedReceiptId, setSavedReceiptId] = useState<number | null>(null);
  const trpcUtils = trpc.useUtils();
  const incrementReceiptPrintMut = trpc.warehouseReceipts.incrementPrint.useMutation();

  const handlePrintReceiptDoc = async () => {
    if (!savedReceiptId) return;
    try {
      const receipt = await trpcUtils.warehouseReceipts.getForPrint.fetch({ id: savedReceiptId });
      await printReceiptDocument(receipt, () => incrementReceiptPrintMut.mutate({ id: savedReceiptId }));
    } catch (e: any) {
      toast.error(e.message || "تعذر تحميل بيانات السند");
    }
  };

  const itemMatchMut = trpc.catalog.itemSuppliers.matchInvoiceItems.useMutation();
  const skuMatchMut = trpc.catalog.itemSuppliers.matchInvoiceItems.useMutation();

  const receiveMut = trpc.warehouseReceiptsV2.receiveFromPurchaseV2.useMutation({
    onSuccess: (data: any) => {
      toast.success(`تم الاستلام — فاتورة ${data.receiptNumber}`, {
        description: data.hasDiscrepancy ? "⚠️ تم تسجيل الفروقات" : "تم تحديث المخزون",
      });
      setSavedReceiptId(data.receiptId ?? null);
      // 2B-8: عند تفعيل Lots نطبع QR الدفعة لكل عملية استلام؛ وإلا نبقي باركود Inventory التاريخي.
      if (data.lotLabels && data.lotLabels.length > 0) {
        setPrintItems(data.lotLabels);
        setShowPrint(true);
      } else if (data.inventoryItems && data.inventoryItems.length > 0) {
        setPrintItems(data.inventoryItems);
        setShowPrint(true);
      } else if (data.receiptId) {
        // لا أصناف جديدة تحتاج باركود — نعرض شاشة الطباعة للوصول لزر سند الاستلام
        setPrintItems([]);
        setShowPrint(true);
      } else {
        navigate("/inventory");
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ── توليد باركود تلقائي ─────────────────────────────────────
  const generateBarcodesMut = trpc.warehouseReceiptsV2.generateItemBarcodes.useMutation();

  const generateBarcodeForItem = async (index: number) => {
    const result = await generateBarcodeMut.mutateAsync();
    updateItem(index, { manufacturerBarcode: result.barcode });
  };

  // ── Helpers ────────────────────────────────────────────────
  const updateItem = (index: number, patch: Partial<ReceiveItem>) => {
    // إذا حُسم السطر كـ"صنف جديد"، ألغِ أي مطابقة SKU معلقة حتى لا تعيد
    // ربط Catalog Item بعد قرار المستخدم بسبب استجابة async متأخرة.
    if (patch.isNewCatalogItem === true) {
      const timer = skuMatchTimersRef.current.get(index);
      if (timer) clearTimeout(timer);
      skuMatchTimersRef.current.delete(index);
      skuMatchVersionRef.current.set(index, (skuMatchVersionRef.current.get(index) || 0) + 1);
      setSkuMatchingIndex(current => current === index ? null : current);
    }

    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      const updated = { ...item, ...patch, manuallyEdited: true };
      // إعادة حساب الإجمالي
      const qty   = updated.receivedQuantity;
      const cost  = parseFloat(updated.unitCost) || 0;
      const tax   = cost * qty * (updated.taxRate / 100);
      updated.taxAmount = tax.toFixed(2);
      updated.lineTotal = (cost * qty + tax).toFixed(2);
      return updated;
    }));
  };


  const rematchSupplierSku = async (index: number, itemSnapshot: ReceiveItem, supplierItemCode: string, version: number) => {
    const code = supplierItemCode.trim();
    if (!selectedSupplier || !code) return;
    if (itemSnapshot.catalogLinkSource === "po" || itemSnapshot.catalogLinkSource === "user") return;

    setSkuMatchingIndex(index);
    try {
      const result = await skuMatchMut.mutateAsync({
        supplierId: selectedSupplier.id,
        items: [{
          itemName: itemSnapshot.itemName,
          itemNameEn: itemSnapshot.itemName_en,
          supplierItemCode: code,
          unit: itemSnapshot.purchaseUnit,
        }],
        limitPerItem: 5,
        // إعادة مطابقة SKU أثناء الكتابة هدفها ذاكرة المورد فقط؛ AI يبقى
        // للمرور الرئيسي عند الانتقال من مراجعة الفاتورة إلى الأصناف.
        useAiFallback: false,
      });

      if (skuMatchVersionRef.current.get(index) !== version) return;

      const row = result?.[0] as any;
      const matches = (row?.matches || []) as CatalogItemMatch[];
      const supplierMemoryMatch = matches.some(match =>
        match.reason === "supplier_code_exact" ||
        match.reason === "supplier_alias_exact" ||
        match.reason === "supplier_alias_similar"
      );

      // إذا لم يعرف المورد هذا SKU/الاسم، نبقي اقتراحات الشاشة الحالية كما هي
      // بدل استبدال ترتيب AI السابق بنتائج أضعف لمجرد تغيير الحقل.
      if (!supplierMemoryMatch) return;

      const autoId = row?.autoSelectedCatalogItemId || undefined;
      setItems(prev => prev.map((current, idx) => {
        if (idx !== index) return current;
        if ((current.supplierItemCode || "").trim() !== code) return current;
        if (current.isNewCatalogItem) return current;
        if (current.catalogLinkSource === "po" || current.catalogLinkSource === "user") return current;

        return {
          ...current,
          catalogMatches: matches,
          linkedItemId: autoId || undefined,
          catalogLinkSource: autoId ? "supplier_memory" : undefined,
        };
      }));

      const exactSku = matches.find(match => match.reason === "supplier_code_exact");
      if (autoId && exactSku) {
        toast.success("تم التعرف على الصنف من SKU المورد", {
          description: `${exactSku.nameAr} — Catalog #${autoId}`,
        });
      } else if (exactSku?.measurementStatus === "conflict") {
        toast.warning("تم العثور على SKU معروف لكن توجد مواصفة/مقاس مختلف", {
          description: "راجع التحذير قبل ربط الصنف يدوياً.",
        });
      }
    } catch (err: any) {
      toast.error("تعذرت إعادة مطابقة SKU المورد", {
        description: err?.message || "يمكنك متابعة الربط اليدوي.",
      });
    } finally {
      if (skuMatchVersionRef.current.get(index) === version) {
        setSkuMatchingIndex(current => current === index ? null : current);
      }
    }
  };

  const handleSupplierItemCodeChange = (index: number, value: string) => {
    const current = items[index];
    if (!current) return;

    const existingTimer = skuMatchTimersRef.current.get(index);
    if (existingTimer) clearTimeout(existingTimer);
    const version = (skuMatchVersionRef.current.get(index) || 0) + 1;
    skuMatchVersionRef.current.set(index, version);

    const clearSupplierMemoryLink = current.catalogLinkSource === "supplier_memory";
    updateItem(index, {
      supplierItemCode: value,
      ...(clearSupplierMemoryLink
        ? { linkedItemId: undefined, catalogLinkSource: undefined, catalogMatches: undefined }
        : {}),
    });

    const code = value.trim();
    if (current.isNewCatalogItem) {
      skuMatchTimersRef.current.delete(index);
      return;
    }
    if (!selectedSupplier || !code) {
      skuMatchTimersRef.current.delete(index);
      return;
    }
    // هوية PO أو اختيار المستخدم أقوى من SKU؛ لا نكتب فوق قرار مؤكد.
    if (current.catalogLinkSource === "po" || current.catalogLinkSource === "user") return;

    const snapshot: ReceiveItem = {
      ...current,
      supplierItemCode: value,
      ...(clearSupplierMemoryLink
        ? { linkedItemId: undefined, catalogLinkSource: undefined, catalogMatches: undefined }
        : {}),
    };

    const timer = setTimeout(() => {
      skuMatchTimersRef.current.delete(index);
      void rematchSupplierSku(index, snapshot, value, version);
    }, 450);
    skuMatchTimersRef.current.set(index, timer);
  };

  const linkToInventory = (itemIndex: number, inventoryItem: any) => {
    setItems(prev => prev.map((item, idx) =>
      idx === itemIndex ? {
        ...item,
        inventoryId:  inventoryItem.id,
        internalCode: inventoryItem.internalCode,
        showSimilar:  false,
      } : item
    ));
    toast.success(`تم الربط بـ "${inventoryItem.itemName}"`);
  };

  const hasDiscrepancy = items.some(i => i.hasDiff);
  const undecidedCatalogIndexes = items.reduce<number[]>((indexes, item, index) => {
    if (!item.linkedItemId && !item.isNewCatalogItem) indexes.push(index);
    return indexes;
  }, []);
  const undecidedCatalogIndexSet = new Set(undecidedCatalogIndexes);

  const handleItemsNext = () => {
    if (undecidedCatalogIndexes.length > 0) {
      setShowCatalogDecisionErrors(true);
      const firstIndex = undecidedCatalogIndexes[0];

      // افتح أول بطاقة غير محسومة حتى تظهر خيارات الكتالوج والبيانات أمام المستخدم.
      setItems(prev => prev.map((item, index) =>
        index === firstIndex ? { ...item, expanded: true } : item
      ));

      toast.error(`يوجد ${undecidedCatalogIndexes.length} صنف يحتاج حسم مطابقة الكتالوج`, {
        description: 'تم تمييز الأصناف غير المحسومة. اربط كل صنف بالكتالوج أو فعّل «صنف جديد».',
      });

      // انتقل بصرياً لأول سطر يحتاج قراراً؛ باقي الأسطر تبقى مميزة بوضوح.
      window.setTimeout(() => {
        document.getElementById(`receive-item-card-${firstIndex}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 0);
      return;
    }

    setShowCatalogDecisionErrors(false);
    setStep('confirm');
  };

  const handleOcr = () => {
    if (!invoiceFile?.url) return;
    ocrMut.mutate({
      imageUrl:        invoiceFile.url,
      purchaseOrderId: poId || undefined,
    });
  };

  const handleSkipOcr = () => {
    setManualEntrySelected(true);
    setSelectedSupplier(null);
    setIsNewSupplier(false);
    // بدون OCR، نعتمد بنود الطلب نفسها كأصناف مبدئية قابلة للتعديل يدوياً.
    // إن لم تكن وصلت بعد، useEffect أعلاه سيهيّئها فور وصول poCandidates.
    if (items.length === 0 && poCandidates.length > 0) {
      setItems(createManualItemsFromPoCandidates(poCandidates));
      setManualItemsInitialized(true);
    } else if (items.length > 0) {
      setManualItemsInitialized(true);
    }
    setStep("review");
  };

  const handleReviewNext = async () => {
    if (isNewSupplier) {
      if (!invoiceData.vendorName?.trim()) {
        toast.error("اكتب اسم المورد قبل تحديد أنه مورد جديد");
        return;
      }
    } else if (!selectedSupplier) {
      toast.error("اختر المورد الصحيح من القائمة أو حدد «مورد جديد»");
      return;
    }

    // 2B-3: بنود PO المرتبطة بالكتالوج معروفة مسبقاً ولا نعيد تخمينها.
    // فقط البنود غير المرتبطة تمر عبر ذاكرة المورد ثم الكتالوج ثم AI fallback.
    const unresolved = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.linkedItemId);

    if (unresolved.length > 0) {
      try {
        const matchPayload = {
          supplierId: selectedSupplier?.id,
          items: unresolved.map(({ item }) => ({
            itemName: item.itemName,
            itemNameEn: item.itemName_en,
            supplierItemCode: item.supplierItemCode,
            unit: item.purchaseUnit,
          })),
          limitPerItem: 5,
          useAiFallback: true,
        };
        const matchCacheKey = JSON.stringify(matchPayload);
        let matchPromise = itemMatchRequestCacheRef.current.get(matchCacheKey);
        if (!matchPromise) {
          matchPromise = itemMatchMut.mutateAsync(matchPayload) as Promise<any[]>;
          itemMatchRequestCacheRef.current.set(matchCacheKey, matchPromise);
          matchPromise.catch(() => {
            if (itemMatchRequestCacheRef.current.get(matchCacheKey) === matchPromise) {
              itemMatchRequestCacheRef.current.delete(matchCacheKey);
            }
          });
        } else {
          console.info("[CatalogItemMatch] Reused review-session match cache");
        }
        const result = await matchPromise;

        let autoSelected = 0;
        let conflicts = 0;
        setItems(prev => {
          const next = [...prev];
          result.forEach((row: any, resultIndex: number) => {
            const targetIndex = unresolved[resultIndex]?.index;
            if (targetIndex == null || !next[targetIndex]) return;
            const matches = (row.matches || []) as CatalogItemMatch[];
            const autoId = row.autoSelectedCatalogItemId || undefined;
            if (autoId) autoSelected++;
            if (matches.some(m => m.measurementStatus === "conflict")) conflicts++;
            next[targetIndex] = {
              ...next[targetIndex],
              catalogMatches: matches,
              linkedItemId: autoId || next[targetIndex].linkedItemId,
              catalogLinkSource: autoId ? "supplier_memory" : next[targetIndex].catalogLinkSource,
            };
          });
          return next;
        });

        if (autoSelected > 0) {
          toast.success(`تم التعرف تلقائياً على ${autoSelected} صنف من ذاكرة المورد`);
        }
        if (conflicts > 0) {
          toast.warning(`يوجد ${conflicts} صنف به اختلاف مواصفة/مقاس — يحتاج تأكيداً يدوياً`);
        }
      } catch (err: any) {
        toast.error("تعذرت مطابقة أصناف الكتالوج", {
          description: err?.message || "يمكنك متابعة الاستلام والربط يدوياً لاحقاً",
        });
      }
    }

    setStep("items");
  };

  const handleSubmit = () => {
    const invalid = items.find(i => !i.unitCost || i.receivedQuantity < 0.001);
    if (invalid) {
      toast.error(`أكمل بيانات: ${invalid.itemName}`);
      return;
    }

    // 2B-4: كل سطر يجب أن يحسم قرار Catalog Master قبل تأكيد الاستلام:
    // إما Catalog Item موجود، أو "صنف جديد". علامة الصنف الجديد نفسها لا
    // تمنع الاستلام؛ هي فقط تحفظ قرار الـMaster Data للخطوة 2B-5.
    const undecidedCatalogItem = items.find(i => !i.linkedItemId && !i.isNewCatalogItem);
    if (undecidedCatalogItem) {
      toast.error(`احسم مطابقة الكتالوج للصنف: ${undecidedCatalogItem.itemName}`, {
        description: 'اختر صنفاً موجوداً من الاقتراحات/البحث، أو فعّل «صنف جديد».',
      });
      return;
    }

    const contradictoryCatalogItem = items.find(i => i.linkedItemId && i.isNewCatalogItem);
    if (contradictoryCatalogItem) {
      toast.error(`قرار كتالوج متعارض للصنف: ${contradictoryCatalogItem.itemName}`);
      return;
    }

    // الربط ببند طلب الشراء اختياري (قد يكون الصنف زائداً عن الطلب الأصلي)،
    // لكن لو رُبط أكثر من صنف بنفس البند بالخطأ فهذا تعارض منطقي نمنعه
    const idCounts = new Map<number, number>();
    items.filter(i => i.purchaseOrderItemId).forEach(i =>
      idCounts.set(i.purchaseOrderItemId, (idCounts.get(i.purchaseOrderItemId) || 0) + 1)
    );
    const duplicateLink = items.find(i => i.purchaseOrderItemId && (idCounts.get(i.purchaseOrderItemId) || 0) > 1);
    if (duplicateLink) {
      toast.error(`أكثر من صنف مربوط بنفس بند الطلب — راجع الربط لصنف "${duplicateLink.itemName}"`);
      return;
    }

    receiveMut.mutate({
      purchaseOrderId:  poId!,
      vendorName:       invoiceData.vendorName,
      vendorNameEn:     invoiceData.vendorNameEn,
      vendorTaxNumber:  invoiceData.vendorTaxNumber,
      catalogSupplierId: selectedSupplier?.id,
      isNewSupplier,
      invoiceNumber:    invoiceData.invoiceNumber,
      invoiceDate:      invoiceData.invoiceDate,
      subtotal:         invoiceData.subtotal,
      taxAmount:        invoiceData.taxAmount,
      grandTotal:       invoiceData.grandTotal,
      invoicePhotoUrl:  invoiceFile?.url,
      goodsPhotoUrl:    goodsFile?.url,
      ocrJobId:         ocrJobId || undefined,
      hasDiscrepancy,
      discrepancyNotes: hasDiscrepancy ? items.filter(i => i.hasDiff).map(i => i.itemName).join("، ") : undefined,
      notes,
      items: items.map(i => ({
        purchaseOrderItemId: i.purchaseOrderItemId || undefined,
        inventoryId:         i.inventoryId,
        linkedItemId:        i.linkedItemId,
        supplierItemCode:    i.supplierItemCode,
        isNewCatalogItem:    !!i.isNewCatalogItem,
        itemName:            i.itemName,
        itemName_ar:         i.itemName_ar,
        itemName_en:         i.itemName_en,
        itemType:            i.itemType,
        receivedQuantity:    i.receivedQuantity,
        expectedQuantity:    i.requestedQuantity,
        purchaseUnit:        i.purchaseUnit,
        issueUnit:           i.issueUnit,
        conversionFactor:    i.conversionFactor,
        unitCost:            i.unitCost,
        expectedUnitCost:    i.expectedUnitCost,
        taxRate:             i.taxRate,
        taxAmount:           i.taxAmount,
        lineTotal:           i.lineTotal,
        manufacturerBarcode: i.manufacturerBarcode,
        expiryDate:          i.expiryDate,
        ocrExtracted:        i.ocrExtracted,
        manuallyEdited:      i.manuallyEdited,
      })),
    });
  };

  if (!Number.isInteger(poId) || Number(poId) <= 0) return (
    <div className="p-8 text-center text-muted-foreground">لم يتم تحديد طلب الشراء</div>
  );

  if (isPoError) return (
    <div className="p-8 text-center space-y-3" role="alert">
      <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
      <p className="font-medium">تعذر تحميل أصناف الاستلام</p>
      <p className="text-sm text-muted-foreground">{poError?.message || "تعذر الاتصال بالسيرفر"}</p>
      <Button variant="outline" onClick={() => void refetchPo()}>إعادة المحاولة</Button>
      <Button variant="ghost" onClick={() => navigate("/purchase-cycle")}>العودة لدورة الشراء</Button>
    </div>
  );

  if (isPoLoading || !initialized) return (
    <div className="p-8 text-center text-muted-foreground" role="status">
      <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
      جاري تحميل أصناف الاستلام…
    </div>
  );

  if (initialized && poCandidates.length === 0) return (
    <div className="p-8 text-center text-muted-foreground space-y-2">
      <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" />
      <p className="font-medium">لا توجد أصناف متاحة لإدخال المخزون لهذه الفاتورة</p>
      <p className="text-xs">
        {invoiceNumberParam
          ? `رقم الفاتورة: ${invoiceNumberParam} — تحقق من التوريد، أو ربما اكتمل إدخال الأصناف للمخزون مسبقاً`
          : "تأكد من تأكيد التوريد للمستودع أولاً من تبويب \"توريد للمستودع\""}
      </p>
      <Button variant="outline" size="sm" onClick={() => navigate("/purchase-cycle")}>
        العودة لدورة الشراء
      </Button>
    </div>
  );

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  // ── شاشة طباعة الباركود ────────────────────────────────────
  if (showPrint) {
    return (
      <BarcodesPrintScreen
        items={printItems}
        onDone={() => navigate("/inventory")}
        onPrintReceipt={savedReceiptId ? handlePrintReceiptDoc : undefined}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24 space-y-4" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/inventory")}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">استلام من المشتريات</h1>
          {po && (
            <p className="text-sm text-muted-foreground">
              {(po as any).poNumber} · {items.length} صنف
            </p>
          )}
        </div>
        {isDuplicate && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="w-3 h-3" />
            فاتورة مكررة
          </Badge>
        )}
      </div>

      {/* ── Steps indicator ── */}
      <StepIndicator current={step} />

      {/* ══════════════════════════════════════════════════ */}
      {/* STEP 1: رفع الصور */}
      {/* ══════════════════════════════════════════════════ */}
      {step === "upload" && (
        <div className="space-y-4">

          {/* صورة الفاتورة */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm">صورة الفاتورة</span>
                <Badge variant="outline" className="text-xs">مطلوب للتحليل الذكي</Badge>
              </div>
              {invoiceFile ? (
                <div className="relative">
                  <img
                    src={mediaUrl(invoiceFile.url)}
                    alt="الفاتورة"
                    className="w-full max-h-48 object-contain rounded-lg border"
                  />
                  <Button
                    size="icon" variant="destructive"
                    className="absolute top-2 left-2 w-6 h-6"
                    onClick={() => setInvoiceFile(null)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                  {ocrConfidence !== null && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      <Sparkles className="w-3 h-3 inline ml-1" />
                      دقة OCR: {Math.round(ocrConfidence * 100)}%
                    </div>
                  )}
                </div>
              ) : (
                <DropZone
                  accept="image/*,application/pdf"
                  maxFiles={1}
                  maxSizeMB={15}
                  label="ارفع صورة الفاتورة أو PDF"
                  sublabel="اختر طريقة إضافة صورة الفاتورة"
                  enableCamera
                  enableScanner
                  onFilesUploaded={(files) => files[0]?.status === "done" && setInvoiceFile(files[0])}
                />
              )}
            </CardContent>
          </Card>

          {/* صورة البضاعة */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm">صورة البضاعة المستلمة</span>
                <Badge variant="outline" className="text-xs">مطلوب</Badge>
              </div>
              {goodsFile ? (
                <div className="relative">
                  <img
                    src={mediaUrl(goodsFile.url)}
                    alt="البضاعة"
                    className="w-full max-h-48 object-contain rounded-lg border"
                  />
                  <Button
                    size="icon" variant="destructive"
                    className="absolute top-2 left-2 w-6 h-6"
                    onClick={() => setGoodsFile(null)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <DropZone
                  accept="image/*"
                  maxFiles={1}
                  label="ارفع صورة البضاعة"
                  sublabel="اختر طريقة إضافة صورة البضاعة"
                  enableCamera
                  onFilesUploaded={(files) => files[0]?.status === "done" && setGoodsFile(files[0])}
                />
              )}
            </CardContent>
          </Card>

          {/* أزرار الانتقال */}
          <div className="space-y-2">
            {invoiceFile && (
              <Button
                className="w-full h-12 gap-2"
                onClick={handleOcr}
                disabled={ocrMut.isPending}
              >
                {ocrMut.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري تحليل الفاتورة...</>
                  : <><Sparkles className="w-4 h-4" /> تحليل الفاتورة بالذكاء الاصطناعي</>
                }
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleSkipOcr}
            >
              إدخال يدوي بدون تحليل
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* STEP 2: مراجعة بيانات الفاتورة */}
      {/* ══════════════════════════════════════════════════ */}
      {step === "review" && (
        <div className="space-y-4">

          {/* تحذير فاتورة مكررة */}
          {isDuplicate && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-red-800 text-sm">تحذير: فاتورة مكررة</p>
                <p className="text-sm text-red-700">رقم هذه الفاتورة موجود مسبقاً في النظام. تأكد قبل المتابعة.</p>
              </div>
            </div>
          )}

          {/* بيانات الفاتورة */}
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">بيانات الفاتورة</span>
                {ocrConfidence && (
                  <Badge className="gap-1 bg-primary/10 text-primary border-primary/20">
                    <Sparkles className="w-3 h-3" />
                    OCR {Math.round(ocrConfidence * 100)}%
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="اسم المورد">
                  <Input
                    value={invoiceData.vendorName || ""}
                    onChange={e => {
                      setInvoiceData(p => ({ ...p, vendorName: e.target.value }));
                      setSelectedSupplier(null);
                      setIsNewSupplier(false);
                    }}
                    placeholder="اسم المورد"
                  />
                </Field>
                <Field label="الرقم الضريبي">
                  <Input
                    value={invoiceData.vendorTaxNumber || ""}
                    onChange={e => {
                      setInvoiceData(p => ({ ...p, vendorTaxNumber: e.target.value }));
                      setSelectedSupplier(null);
                    }}
                    placeholder="3xxxxxxxxxxxxxx" dir="ltr" className="font-mono"
                  />
                </Field>

                {/* 2B-2 — Supplier Master resolution. AI/OCR يقرأ الاسم، والخوارزمية
                    ترتب الموردين الأقرب، والمستخدم يؤكد أو يحدد «مورد جديد». */}
                <div className="col-span-2 rounded-lg border bg-muted/20 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" /> تحديد المورد المركزي
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        نحتفظ باسم الفاتورة كما هو، ونربطه بالمورد المعتمد في الكتالوج.
                      </p>
                    </div>
                    {isMatchingSuppliers && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  </div>

                  {selectedSupplier && !isNewSupplier && (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-green-200 bg-green-50 p-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-green-800 truncate">{selectedSupplier.nameAr}</p>
                        <p className="text-xs text-green-700">تم تأكيد المورد المركزي · تطابق {selectedSupplier.score}%</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setSelectedSupplier(null)}>تغيير</Button>
                    </div>
                  )}

                  {!selectedSupplier && !isNewSupplier && supplierSearchName.length >= 2 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Search className="w-3.5 h-3.5" /> الموردون الأقرب
                      </p>
                      {supplierMatches.length > 0 ? (
                        <div className="space-y-1.5">
                          {(supplierMatches as SupplierMatch[]).map(match => (
                            <button
                              key={match.id}
                              type="button"
                              onClick={() => { setSelectedSupplier(match); setIsNewSupplier(false); }}
                              className="w-full text-right rounded-md border bg-background hover:bg-muted/60 p-2.5 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{match.nameAr}</p>
                                  {match.nameEn && <p className="text-xs text-muted-foreground truncate" dir="ltr">{match.nameEn}</p>}
                                </div>
                                <Badge variant="outline" className="shrink-0">{match.score}%</Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-1">
                                {supplierMatchReasonLabel(match.reason)}
                                {match.taxNumber ? ` · ضريبي: ${match.taxNumber}` : ""}
                              </p>
                            </button>
                          ))}
                        </div>
                      ) : !isMatchingSuppliers ? (
                        <p className="text-xs text-muted-foreground">لم نجد مورداً قريباً. إذا كان جديداً فعّل الخيار أدناه.</p>
                      ) : null}
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer rounded-md border p-2.5 bg-background">
                    <Checkbox
                      checked={isNewSupplier}
                      onCheckedChange={(checked) => {
                        const next = checked === true;
                        setIsNewSupplier(next);
                        if (next) setSelectedSupplier(null);
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium">مورد جديد</p>
                      <p className="text-xs text-muted-foreground">يستمر الاستلام طبيعيًا ويرسل المورد للمراجعة في الكتالوج.</p>
                    </div>
                  </label>

                  {isNewSupplier && (
                    <div className="text-xs rounded-md border border-amber-200 bg-amber-50 text-amber-800 p-2.5">
                      سيتم إنشاء Supplier Candidate بعد تأكيد الاستلام، ولن يتوقف المخزون بانتظار اعتماده.
                    </div>
                  )}
                </div>

                <Field label="رقم الفاتورة">
                  <Input value={invoiceData.invoiceNumber || ""} onChange={e => setInvoiceData(p => ({ ...p, invoiceNumber: e.target.value }))} placeholder="INV-001" dir="ltr" />
                </Field>
                <Field label="تاريخ الفاتورة">
                  <Input type="date" value={invoiceData.invoiceDate || ""} onChange={e => setInvoiceData(p => ({ ...p, invoiceDate: e.target.value }))} />
                </Field>
              </div>

              {/* الإجماليات — قابلة للإدخال اليدوي */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                <div>
                  <p className="text-xs text-muted-foreground text-center mb-1">قبل الضريبة</p>
                  <Input
                    type="number" min={0} step={0.01} dir="ltr"
                    value={invoiceData.subtotal || ""}
                    onChange={e => {
                      const sub = parseFloat(e.target.value) || 0;
                      const tax = Math.round(sub * 0.15 * 100) / 100;
                      setInvoiceData(p => ({ ...p, subtotal: sub, taxAmount: tax, grandTotal: Math.round((sub + tax) * 100) / 100 }));
                    }}
                    placeholder="0.00"
                    className="font-mono text-sm text-center"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground text-center mb-1">الضريبة 15%</p>
                  <Input
                    type="number" min={0} step={0.01} dir="ltr"
                    value={invoiceData.taxAmount || ""}
                    onChange={e => {
                      const tax = parseFloat(e.target.value) || 0;
                      const sub = invoiceData.subtotal || 0;
                      setInvoiceData(p => ({ ...p, taxAmount: tax, grandTotal: Math.round((sub + tax) * 100) / 100 }));
                    }}
                    placeholder="0.00"
                    className="font-mono text-sm text-center"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground text-center mb-1">الإجمالي</p>
                  <Input
                    type="number" min={0} step={0.01} dir="ltr"
                    value={invoiceData.grandTotal || ""}
                    onChange={e => setInvoiceData(p => ({ ...p, grandTotal: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className="font-mono text-sm text-center font-bold text-primary"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep("upload")}>
              <ArrowRight className="w-4 h-4 ml-1" /> رجوع
            </Button>
            <Button
              className="flex-1"
              disabled={itemMatchMut.isPending || (manualEntrySelected && (isPoLoading || !initialized || !manualItemsInitialized))}
              onClick={handleReviewNext}
            >
              {itemMatchMut.isPending ? (
                <><Loader2 className="w-4 h-4 ml-1 animate-spin" /> مطابقة أصناف الكتالوج...</>
              ) : manualEntrySelected && (isPoLoading || !initialized || !manualItemsInitialized) ? (
                <><Loader2 className="w-4 h-4 ml-1 animate-spin" /> جاري تحميل الأصناف...</>
              ) : (
                "التالي: مراجعة الأصناف"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* STEP 3: الأصناف */}
      {/* ══════════════════════════════════════════════════ */}
      {step === "items" && (
        <div className="space-y-3">
          {/* زر إضافة صنف يدوياً */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setItems(prev => [...prev, {
                purchaseOrderItemId: 0, // غير مربوط بعد — يجب اختيار بند الطلب قبل الحفظ
                itemName:            "صنف جديد",
                isNewCatalogItem:     false,
                itemType:            "consumable" as const,
                requestedQuantity:   1,
                receivedQuantity:    1,
                purchaseUnit:        "قطعة",
                conversionFactor:    1,
                unitCost:            "0",
                taxRate:             15,
                taxAmount:           "0",
                lineTotal:           "0",
                ocrExtracted:        false,
                manuallyEdited:      true,
                expanded:            true,
                hasDiff:             false,
                showSimilar:         false,
              }])}
            >
              <span className="text-lg leading-none">+</span> إضافة صنف
            </Button>
          </div>

          {hasDiscrepancy && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              يوجد فروقات في الكميات أو الأسعار — ستُسجَّل تلقائياً
            </div>
          )}

          {showCatalogDecisionErrors && undecidedCatalogIndexes.length > 0 && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">
                  يوجد {undecidedCatalogIndexes.length} صنف يحتاج حسم مطابقة الكتالوج قبل المتابعة.
                </p>
                <p className="mt-0.5 text-xs">
                  تم تمييز كل صنف غير محسوم أدناه. اختر صنفاً موجوداً في الكتالوج أو فعّل «صنف جديد».
                </p>
              </div>
            </div>
          )}

          {items.map((item, index) => (
            <ReceiveItemCard
              key={index}
              item={item}
              index={index}
              poCandidates={poCandidates}
              linkedElsewhereIds={new Set(items.filter((_, i) => i !== index).map(i => i.purchaseOrderItemId).filter(Boolean))}
              onUpdate={(patch) => updateItem(index, patch)}
              onSupplierItemCodeChange={(value) => handleSupplierItemCodeChange(index, value)}
              isSkuMatching={skuMatchingIndex === index}
              catalogDecisionError={showCatalogDecisionErrors && undecidedCatalogIndexSet.has(index)}
              onLink={(inv) => linkToInventory(index, inv)}
              onDelete={() => setItems(prev => prev.filter((_, i) => i !== index))}
            />
          ))}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep("review")}>
              <ArrowRight className="w-4 h-4 ml-1" /> رجوع
            </Button>
            <Button className="flex-1" onClick={handleItemsNext}>
              التالي: تأكيد الاستلام
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* STEP 4: تأكيد */}
      {/* ══════════════════════════════════════════════════ */}
      {step === "confirm" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <p className="font-medium text-sm">ملخص الاستلام</p>

              <div className="space-y-2">
                {invoiceData.vendorName && (
                  <SummaryRow label="اسم المورد في الفاتورة" value={invoiceData.vendorName} />
                )}
                <SummaryRow
                  label="هوية المورد"
                  value={isNewSupplier ? "مورد جديد — بانتظار مراجعة الكتالوج" : (selectedSupplier?.nameAr || "غير محدد")}
                />
                {invoiceData.invoiceNumber && (
                  <SummaryRow label="رقم الفاتورة" value={invoiceData.invoiceNumber} mono />
                )}
                <SummaryRow label="عدد الأصناف" value={`${items.length} صنف`} />
                {invoiceData.grandTotal && (
                  <SummaryRow label="إجمالي الفاتورة" value={`${invoiceData.grandTotal.toFixed(2)} ر.س`} bold />
                )}
              </div>

              {hasDiscrepancy && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-amber-700 font-medium mb-1">أصناف بها فروقات:</p>
                  {items.filter(i => i.hasDiff).map(i => (
                    <p key={i.purchaseOrderItemId} className="text-xs text-muted-foreground">• {i.itemName}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label className="text-sm">ملاحظات (اختياري)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="أي ملاحظات على عملية الاستلام..."
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep("items")}>
              <ArrowRight className="w-4 h-4 ml-1" /> رجوع
            </Button>
            <Button
              className="flex-1 h-12 gap-2"
              onClick={handleSubmit}
              disabled={receiveMut.isPending}
            >
              {receiveMut.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
                : <><CheckCircle2 className="w-4 h-4" /> تأكيد الاستلام</>
              }
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload",  label: "الصور" },
    { key: "review",  label: "الفاتورة" },
    { key: "items",   label: "الأصناف" },
    { key: "confirm", label: "تأكيد" },
  ];
  const idx = steps.findIndex(s => s.key === current);
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1 flex-1">
          <div className={cn(
            "flex-1 flex flex-col items-center gap-1",
          )}>
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
              i < idx  && "bg-primary text-primary-foreground",
              i === idx && "bg-primary text-primary-foreground ring-2 ring-primary/30",
              i > idx  && "bg-muted text-muted-foreground",
            )}>
              {i < idx ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span className={cn("text-xs", i === idx ? "text-primary font-medium" : "text-muted-foreground")}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn("h-0.5 flex-1 mb-4 transition-colors", i < idx ? "bg-primary" : "bg-border")} />
          )}
        </div>
      ))}
    </div>
  );
}

function ReceiveItemCard({ item, index, poCandidates, linkedElsewhereIds, onUpdate, onSupplierItemCodeChange, isSkuMatching, catalogDecisionError, onLink, onDelete }: {
  item:     ReceiveItem;
  index:    number;
  poCandidates: any[];
  linkedElsewhereIds: Set<number>;
  onUpdate: (patch: Partial<ReceiveItem>) => void;
  onSupplierItemCodeChange: (value: string) => void;
  isSkuMatching: boolean;
  catalogDecisionError: boolean;
  onLink:   (inv: any) => void;
  onDelete?: () => void;
}) {
  const [catalogMatchMode, setCatalogMatchMode] = useState<"smart" | "manual">("smart");
  const [catalogSearch, setCatalogSearch] = useState("");

  const similarQuery = trpc.warehouseReceiptsV2.findSimilarItems.useQuery(
    { itemName: item.itemName },
    { enabled: item.showSimilar && !item.inventoryId }
  );

  const manualCatalogQuery = trpc.catalog.items.list.useQuery(
    {
      search: catalogSearch.trim() || undefined,
      isActive: true,
      limit: 20,
      offset: 0,
    },
    {
      enabled: catalogMatchMode === "manual" && catalogSearch.trim().length >= 2,
    },
  );

  const smartMatches = (item.catalogMatches || [])
    .filter(isReviewableCatalogMatch)
    .slice(0, 3);

  return (
    <Card
      id={`receive-item-card-${index}`}
      className={cn(
        "transition-colors scroll-mt-4",
        item.hasDiff && "border-amber-300",
        catalogDecisionError && "border-destructive ring-1 ring-destructive/20",
      )}
    >
      <CardContent className="pt-4 space-y-3">

        {/* ربط الصنف ببند طلب الشراء — اختياري: قد يكون الصنف زائداً عن
            الطلب الأصلي ووارداً بالفاتورة فقط، فيُستلم للمخزون مباشرة */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">ربط ببند طلب الشراء (اختياري)</Label>
          <select
            className="w-full border rounded-md px-2 py-1.5 text-sm bg-background"
            value={item.purchaseOrderItemId || ""}
            onChange={e => {
              const id = parseInt(e.target.value);
              const cand = poCandidates.find(c => c.id === id);
              onUpdate({
                purchaseOrderItemId: id || 0,
                requestedQuantity:   cand?.quantity ?? item.requestedQuantity,
                expectedUnitCost:    cand?.estimatedUnitCost || undefined,
                purchaseUnit:        item.purchaseUnit || cand?.unit || "قطعة",
                ...(cand?.catalogItemId
                  ? { linkedItemId: cand.catalogItemId, catalogLinkSource: "po" as const }
                  : item.catalogLinkSource === "po"
                    ? { linkedItemId: undefined, catalogLinkSource: undefined }
                    : {}),
              });
            }}
          >
            <option value="">بدون ربط — صنف زائد عن الطلب</option>
            {poCandidates.map((cand: any) => (
              <option
                key={cand.id}
                value={cand.id}
                disabled={linkedElsewhereIds.has(cand.id)}
              >
                {cand.itemName} {linkedElsewhereIds.has(cand.id) ? "(مربوط بصنف آخر)" : ""}
              </option>
            ))}
          </select>
          {!item.purchaseOrderItemId && (
            <p className="text-xs text-muted-foreground">
              سيُستلم للمخزون مباشرة دون تحديث حالة أي بند بطلب الشراء
            </p>
          )}
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Package className="w-4 h-4 text-primary shrink-0" />
              <input
                className="font-medium text-sm flex-1 bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none truncate"
                value={item.itemName}
                onChange={e => onUpdate({
                  itemName: e.target.value,
                  ...(item.catalogLinkSource !== "po"
                    ? { linkedItemId: undefined, catalogLinkSource: undefined, catalogMatches: undefined }
                    : {}),
                })}
                placeholder="اسم الصنف"
              />
              {item.ocrExtracted && (
                <Badge className="text-xs bg-purple-50 text-purple-700 border-purple-200 gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> OCR
                </Badge>
              )}
              {item.hasDiff && (
                <Badge className="text-xs bg-amber-50 text-amber-700 border-amber-200 gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" /> فرق
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              المطلوب: {item.requestedQuantity} {item.purchaseUnit}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {onDelete && (
              <Button
                variant="ghost" size="icon"
                className="w-7 h-7 shrink-0 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              variant="ghost" size="icon"
              className="w-7 h-7 shrink-0"
              onClick={() => onUpdate({ expanded: !item.expanded })}
            >
              {item.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* نوع الصنف */}
        <div className="flex gap-1 flex-wrap">
          {(["spare_part", "consumable", "tool", "food"] as ItemType[]).map(t => (
            <button
              key={t}
              onClick={() => onUpdate({ itemType: t })}
              className={cn(
                "text-xs px-2 py-0.5 rounded border transition-colors",
                item.itemType === t ? ITEM_TYPE_COLORS[t] : "border-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              {ITEM_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {catalogDecisionError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-destructive"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-sm font-medium">يجب حسم مطابقة الكتالوج لهذا الصنف قبل المتابعة.</p>
              <p className="mt-0.5 text-xs">
                اختر صنفاً موجوداً من «الاقتراحات الذكية» أو «بحث في الكتالوج»، أو فعّل «صنف جديد».
              </p>
            </div>
          </div>
        )}

        {/* 2B-4: قرار "صنف جديد" يتم هنا أثناء مراجعة الفاتورة، وليس بعد الاستلام. */}
        <div className={cn(
          "rounded-lg border p-2.5",
          item.isNewCatalogItem ? "border-amber-300 bg-amber-50/60" : "bg-background"
        )}>
          <div className="flex items-start gap-2">
            <Checkbox
              id={`new-catalog-item-${index}`}
              checked={!!item.isNewCatalogItem}
              disabled={item.catalogLinkSource === "po"}
              onCheckedChange={(checked) => {
                const next = checked === true;
                if (next && item.catalogLinkSource === "po") return;

                if (next && item.linkedItemId) {
                  const confirmed = window.confirm(
                    "هذا السطر مرتبط حالياً بصنف في الكتالوج. تفعيل «صنف جديد» سيلغي هذا الربط لهذا السطر فقط. هل تريد المتابعة؟"
                  );
                  if (!confirmed) return;
                }

                onUpdate({
                  isNewCatalogItem: next,
                  ...(next
                    ? { linkedItemId: undefined, catalogLinkSource: undefined }
                    : {}),
                });
              }}
            />
            <div className="min-w-0">
              <Label htmlFor={`new-catalog-item-${index}`} className={cn(
                "text-sm font-medium",
                item.catalogLinkSource === "po" && "text-muted-foreground"
              )}>
                صنف جديد — غير موجود في الكتالوج
              </Label>
              {item.catalogLinkSource === "po" ? (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  بند طلب الشراء مرتبط مسبقاً بصنف Catalog، لذلك لا يمكن اعتباره صنفاً جديداً من هذه الشاشة.
                </p>
              ) : item.isNewCatalogItem ? (
                <p className="text-[11px] text-amber-800 mt-0.5">
                  تم تعليم هذا السطر كصنف جديد. بعد تأكيد الاستلام سيُنشأ له مرشح «Pending Catalog Review» تلقائياً بدون إيقاف الاستلام أو المخزون.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  فعّله فقط إذا لم تجد الصنف الصحيح في الاقتراحات الذكية أو البحث في الكتالوج.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 2B-3: مطابقة Catalog Item المركزية — منفصلة عن ربط سجل المخزون */}
        {!item.isNewCatalogItem && (
        <div className="space-y-2 rounded-lg border p-2.5 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-medium">مطابقة صنف الكتالوج</Label>
            {item.linkedItemId ? (
              <Badge className="text-xs bg-green-50 text-green-700 border-green-200">
                مرتبط #{item.linkedItemId}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">غير مرتبط</Badge>
            )}
          </div>

          {item.catalogLinkSource === "po" && item.linkedItemId && (
            <p className="text-xs text-green-700">هوية الكتالوج مأخوذة من بند طلب الشراء المرتبط مسبقاً.</p>
          )}

          {item.catalogLinkSource !== "po" && (
            <div className="grid grid-cols-2 gap-1 rounded-md bg-muted/60 p-1">
              <Button
                type="button"
                size="sm"
                variant={catalogMatchMode === "smart" ? "secondary" : "ghost"}
                className="h-8 gap-1.5 text-xs"
                onClick={() => setCatalogMatchMode("smart")}
              >
                <Sparkles className="w-3.5 h-3.5" /> اقتراحات ذكية
              </Button>
              <Button
                type="button"
                size="sm"
                variant={catalogMatchMode === "manual" ? "secondary" : "ghost"}
                className="h-8 gap-1.5 text-xs"
                onClick={() => setCatalogMatchMode("manual")}
              >
                <Search className="w-3.5 h-3.5" /> بحث في الكتالوج
              </Button>
            </div>
          )}

          {item.catalogLinkSource !== "po" && catalogMatchMode === "smart" && (
            <div className="space-y-1.5">
              {isSkuMatching && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> يتم فحص ذاكرة المورد...
                </div>
              )}

              {smartMatches.length > 0 ? smartMatches.map(match => {
                const selected = item.linkedItemId === match.catalogItemId;
                return (
                  <button
                    key={match.catalogItemId}
                    type="button"
                    className={cn(
                      "w-full text-right rounded border p-2 transition-colors",
                      selected ? "border-green-300 bg-green-50" : "hover:bg-muted/60",
                      match.measurementStatus === "conflict" && "border-amber-300 bg-amber-50/50",
                    )}
                    onClick={() => {
                      if (match.measurementStatus === "conflict") {
                        const ok = window.confirm(
                          `${match.measurementNote || "يوجد اختلاف في المقاس/المواصفة"}\n\nهل تريد تأكيد أن هذا هو نفس الصنف رغم الاختلاف؟`
                        );
                        if (!ok) return;
                      }
                      onUpdate({ linkedItemId: match.catalogItemId, catalogLinkSource: "user" });
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{match.nameAr}</p>
                        {match.nameEn && <p className="text-xs text-muted-foreground" dir="ltr">{match.nameEn}</p>}
                        <div className="flex gap-1 flex-wrap mt-1">
                          <Badge variant="outline" className="text-[10px]">{catalogMatchReasonLabel(match.reason)}</Badge>
                          <Badge variant="outline" className="text-[10px]">{match.score}%</Badge>
                          {match.measurementStatus === "compatible" && (
                            <Badge className="text-[10px] bg-green-50 text-green-700 border-green-200">المقاس متوافق</Badge>
                          )}
                          {match.measurementStatus === "conflict" && (
                            <Badge className="text-[10px] bg-amber-50 text-amber-800 border-amber-300">اختلاف مقاس</Badge>
                          )}
                        </div>
                        {match.measurementNote && (
                          <p className="text-[11px] text-amber-700 mt-1">{match.measurementNote}</p>
                        )}
                      </div>
                      {selected && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />}
                    </div>
                  </button>
                );
              }) : (
                <div className="rounded-md border border-dashed p-2.5 text-xs text-muted-foreground">
                  لم يتم العثور على تطابق موثوق. استخدم «بحث في الكتالوج» لاختيار الصنف يدوياً.
                </div>
              )}

              {(item.catalogMatches?.length || 0) > smartMatches.length && smartMatches.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  تم إخفاء الاقتراحات الضعيفة لتقليل الربط الخاطئ.
                </p>
              )}
            </div>
          )}

          {item.catalogLinkSource !== "po" && catalogMatchMode === "manual" && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  placeholder="ابحث باسم الصنف أو الاسم الإنجليزي أو كود الكتالوج"
                  className="pr-8"
                />
              </div>

              {catalogSearch.trim().length < 2 ? (
                <p className="text-xs text-muted-foreground">اكتب حرفين على الأقل للبحث في أصناف الكتالوج النشطة.</p>
              ) : manualCatalogQuery.isFetching ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري البحث في الكتالوج...
                </div>
              ) : (manualCatalogQuery.data || []).length > 0 ? (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                  {(manualCatalogQuery.data || []).map((catalogItem: any) => {
                    const selected = item.linkedItemId === catalogItem.id;
                    return (
                      <button
                        key={catalogItem.id}
                        type="button"
                        className={cn(
                          "w-full rounded border p-2 text-right transition-colors",
                          selected ? "border-green-300 bg-green-50" : "hover:bg-muted/60",
                        )}
                        onClick={() => {
                          onUpdate({ linkedItemId: catalogItem.id, catalogLinkSource: "user" });
                          toast.success("تم اختيار صنف الكتالوج", {
                            description: `${catalogItem.nameAr} — Catalog #${catalogItem.id}`,
                          });
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{catalogItem.nameAr}</p>
                            {catalogItem.nameEn && (
                              <p className="text-xs text-muted-foreground" dir="ltr">{catalogItem.nameEn}</p>
                            )}
                            <div className="flex gap-1 flex-wrap mt-1">
                              {catalogItem.code && <Badge variant="outline" className="text-[10px]">{catalogItem.code}</Badge>}
                              {catalogItem.unit && <Badge variant="outline" className="text-[10px]">{catalogItem.unit}</Badge>}
                              {catalogItem.manufacturer && <Badge variant="outline" className="text-[10px]">{catalogItem.manufacturer}</Badge>}
                            </div>
                          </div>
                          {selected && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">لا توجد نتائج بهذا البحث. جرّب جزءاً أقصر من الاسم أو كود الكتالوج.</p>
              )}

              <p className="text-[11px] text-muted-foreground">
                عند تأكيد الاستلام، سيُحفظ اسم الصنف الحالي كاسم معروف لهذا المورد للصنف الذي اخترته، حتى بدون SKU.
              </p>
            </div>
          )}
        </div>
        )}

        {/* الحقول */}
        {item.expanded && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="الكمية المستلمة">
                <div className="relative">
                  <Input
                    type="number" min={0} step={0.5}
                    value={item.receivedQuantity}
                    onChange={e => onUpdate({ receivedQuantity: parseFloat(e.target.value) || 0 })}
                    className={cn(item.receivedQuantity !== item.requestedQuantity && "border-amber-400")}
                  />
                  {item.receivedQuantity !== item.requestedQuantity && (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-amber-600">
                      ≠{item.requestedQuantity}
                    </span>
                  )}
                </div>
              </Field>
              <Field label="وحدة الشراء">
                <Input value={item.purchaseUnit} onChange={e => onUpdate({ purchaseUnit: e.target.value })} placeholder="كرتون / قطعة" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="سعر الوحدة">
                <div className="relative">
                  <Input
                    type="number" min={0} step={0.01} dir="ltr"
                    value={item.unitCost}
                    onChange={e => onUpdate({ unitCost: e.target.value })}
                    className={cn(
                      "font-mono",
                      item.expectedUnitCost && Math.abs(parseFloat(item.unitCost) - parseFloat(item.expectedUnitCost)) > 0.01 && "border-amber-400"
                    )}
                  />
                  {item.expectedUnitCost && (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      /{parseFloat(item.expectedUnitCost).toFixed(2)}
                    </span>
                  )}
                </div>
              </Field>
              <Field label="الإجمالي شامل الضريبة">
                <Input value={parseFloat(item.lineTotal || "0").toFixed(2)} readOnly dir="ltr" className="font-mono bg-muted/30" />
              </Field>
            </div>

            <Field label="كود / SKU الصنف لدى المورد (اختياري)">
              <div className="relative">
                <Input
                  value={item.supplierItemCode || ""}
                  onChange={e => onSupplierItemCodeChange(e.target.value)}
                  placeholder="كما هو مكتوب في فاتورة المورد"
                  dir="ltr"
                  className={cn("font-mono", isSkuMatching && "pe-9")}
                />
                {isSkuMatching && (
                  <Loader2 className="absolute end-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {isSkuMatching && (
                <p className="text-[11px] text-muted-foreground mt-1">جارٍ فحص SKU في ذاكرة المورد…</p>
              )}
            </Field>

            {/* باركود المصنع */}
            <Field label="باركود المصنع (اختياري)">
              <Input
                value={item.manufacturerBarcode || ""}
                onChange={e => onUpdate({ manufacturerBarcode: e.target.value })}
                placeholder="يُولَّد تلقائياً أو أدخل يدوياً"
                placeholder="امسح أو أدخل الباركود"
                dir="ltr" className="font-mono"
              />
            </Field>

            {/* تاريخ الصلاحية للمواد الغذائية */}
            {item.itemType === "food" && (
              <Field label="تاريخ انتهاء الصلاحية">
                <Input type="date" value={item.expiryDate || ""} onChange={e => onUpdate({ expiryDate: e.target.value })} />
              </Field>
            )}

            {/* ربط بمخزون */}
            {item.inventoryId ? (
              <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-sm text-green-700 flex-1">{item.internalCode}</span>
                <Button size="sm" variant="ghost" className="h-6 text-red-500"
                  onClick={() => onUpdate({ inventoryId: undefined, internalCode: undefined })}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div>
                <Button
                  size="sm" variant="outline"
                  className="gap-1 w-full"
                  onClick={() => onUpdate({ showSimilar: !item.showSimilar })}
                >
                  <Link2 className="w-3 h-3" />
                  {item.showSimilar ? "إخفاء الأصناف المشابهة" : "ربط بصنف موجود"}
                </Button>

                {item.showSimilar && (
                  <div className="mt-2 space-y-1">
                    {similarQuery.isLoading && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> جاري البحث...
                      </div>
                    )}
                    {similarQuery.data?.map((inv: any) => (
                      <button
                        key={inv.id}
                        onClick={() => onLink(inv)}
                        className="w-full text-right p-2 rounded border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{inv.itemName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{inv.internalCode} · {inv.quantity} {inv.unit}</p>
                          </div>
                          <Link2 className="w-3 h-3 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                    {similarQuery.data?.length === 0 && (
                      <p className="text-xs text-muted-foreground p-2">لا توجد أصناف مشابهة — سيُنشأ صنف جديد</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, mono, bold }: {
  label: string; value: string; mono?: boolean; bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(mono && "font-mono", bold && "font-bold text-primary")}>{value}</span>
    </div>
  );
}

// ============================================================
// مكوّن شاشة طباعة الباركود
// ============================================================
function QRCodeCanvas({ value, size = 120 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(console.error);
  }, [value, size]);

  return <canvas ref={canvasRef} width={size} height={size} />;
}

function BarcodesPrintScreen({ items, onDone, onPrintReceipt }: { items: any[]; onDone: () => void; onPrintReceipt?: () => void }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4" dir="rtl">
      {/* شريط العنوان */}
      <div className="print-hidden max-w-2xl mx-auto mb-4 flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold">{items.some((i: any) => i.trackingToken) ? "طباعة QR دفعات الاستلام" : "طباعة باركودات الأصناف"}</h1>
        <div className="flex gap-2 flex-wrap">
          {onPrintReceipt && (
            <button
              onClick={onPrintReceipt}
              className="bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
            >
              🧾 طباعة سند استلام المشتريات
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={handlePrint}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
            >
              {items.some((i: any) => i.trackingToken) ? "🖨️ طباعة QR الدفعات" : "🖨️ طباعة الباركودات"}
            </button>
          )}
          <button
            onClick={onDone}
            className="border px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted"
          >
            تخطي الطباعة
          </button>
        </div>
      </div>

      {/* بطاقات الباركود */}
      <div className="barcode-print-area flex flex-wrap gap-4 justify-center">
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              width: "56mm",
              height: "36mm",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-start",
              padding: "2px",
              gap: "4px",
              background: "#fff",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
            className="barcode-card"
          >
            {/* QR Code على اليسار */}
            <div style={{ flexShrink: 0 }}>
              <QRCodeCanvas value={item.trackingToken || item.manufacturerBarcode || item.internalCode || String(idx)} size={110} />
            </div>
            {/* الرقم + اسم الصنف على اليمين */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", overflow: "hidden", paddingRight: "2px", gap: "3px" }}>
              <span style={{ fontFamily: "monospace", fontWeight: "bold", fontSize: "13px", color: "#000", textAlign: "right", direction: "ltr" }}>
                {item.lotCode || item.manufacturerBarcode || item.internalCode}
              </span>
              <span style={{ fontSize: "10px", color: "#222", textAlign: "right", direction: "rtl", lineHeight: "1.3", wordBreak: "break-word", maxWidth: "100%" }}>
                {item.itemName}
              </span>
              {item.trackingToken && (
                <span style={{ fontSize: "8px", color: "#555", textAlign: "right", direction: "rtl" }}>
                  دفعة استلام — {item.quantity} {item.unit || ""}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* CSS للطباعة */}
      <style>{`
        @media print {
          @page {
            size: 58mm 38mm;
            margin: 0;
          }
          body * { visibility: hidden; }
          .barcode-print-area, .barcode-print-area * { visibility: visible; }
          .barcode-print-area {
            position: absolute;
            top: 0; left: 0;
          }
          .print-hidden { display: none !important; }
          .barcode-card {
            width: 56mm !important;
            height: 36mm !important;
            page-break-after: always;
            page-break-inside: avoid;
            display: flex !important;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 1mm;
          }
          .barcode-card:last-child {
            page-break-after: avoid;
          }
        }
      `}</style>
    </div>
  );
}
