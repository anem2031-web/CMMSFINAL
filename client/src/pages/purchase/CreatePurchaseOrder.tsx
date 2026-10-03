import { trpc } from "@/lib/trpc";
import { goBackOrFallback } from "@/lib/backStack";
import { useLocation, useSearch, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, Plus, Trash2, Loader2, ShoppingCart, Camera, Link2, Upload, BookOpen, FilePlus, Search, ChevronDown, ChevronRight, FolderOpen, Save, AlertCircle } from "lucide-react";
import DropZone, { type UploadedFile } from "@/components/common/DropZone";
import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { localizeApiError } from "@/i18n/apiError";
import { getLocalizedItemField } from "@/hooks/useContentTranslation";
import { getLocalizedCatalogDescription, getLocalizedCatalogName, getLocalizedCatalogUnitName, resolveCatalogUnit } from "@/i18n/catalogMasterData";

type ItemForm = {
  sourceType: "catalog" | "manual";
  // 2B-1: رابط Master Item؛ يبقى مخفيًا عن العرض ويُحفظ مع بند الطلب.
  catalogItemId: number | null;

  itemName: string;
  description: string;

  quantity: number;
  unit: string;

  photoUrls: string[];
  notes: string;
  _catalogNameAr?: string;
  _catalogNameEn?: string;
};

const emptyItem = (defaultUnit = ""): ItemForm => ({
  sourceType: "manual",
  catalogItemId: null,

  itemName: "",
  description: "",

  quantity: 1,
  unit: defaultUnit,

  photoUrls: [],
  notes: ""
});

// ── Catalog Item Picker Dialog ─────────────────────────────────────────────
interface CatalogNode {
  id: number;
  code: string | null;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  level: number;
  parentId: number | null;
}

function CatalogPickerDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
onSelect: (item: {
  id: number;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  primaryImageUrl?: string;
  unit?: string;
}) => void;
}) {
  const { t, language, dir, isRTL } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // debounce: انتظر 350ms بعد توقف الكتابة ثم ابعث للسيرفر
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: allNodes } = trpc.catalog.nodes.list.useQuery(
    { isActive: true },
    { enabled: open }
  );

  const { data: catalogUnits } = trpc.catalog.units.list.useQuery(undefined, { enabled: open });

  // جمع ID التصنيف المختار + كل أحفاده بشكل تكراري
  const getDescendantIds = (nodeId: number, nodes: CatalogNode[]): number[] => {
    const children = nodes.filter(n => n.parentId === nodeId);
    return [nodeId, ...children.flatMap(c => getDescendantIds(c.id, nodes))];
  };

  const selectedNodeIds = useMemo(() => {
    if (!selectedNodeId || !allNodes) return undefined;
    return getDescendantIds(selectedNodeId, allNodes);
  }, [selectedNodeId, allNodes]);

  // ✅ البحث على السيرفر — يجلب فقط ما يطابق البحث أو التصنيف المختار
  const { data: serverItems, isFetching } = trpc.catalog.items.list.useQuery(
    {
      isActive: true,
      limit: 80,
      search: debouncedSearch || undefined,
      nodeIds: selectedNodeIds,
    },
    { enabled: open }
  );

  // إعادة ضبط الحالة عند كل فتح للنافذة
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSearchQuery("");
      setDebouncedSearch("");
      setSelectedNodeId(null);
    }
  }, [open]);

  const roots = useMemo(
    () => (allNodes || []).filter((n: CatalogNode) => !n.parentId),
    [allNodes]
  );

  const getChildren = (parentId: number) =>
    (allNodes || []).filter((n: CatalogNode) => n.parentId === parentId);

  const toggle = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const items = serverItems || [];

  const renderNode = (node: CatalogNode, depth = 0): React.ReactNode => {
    const children = getChildren(node.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedNodeId === node.id;

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-1.5 py-1.5 px-2 rounded cursor-pointer hover:bg-muted/60 transition-colors text-sm",
            isSelected && "bg-primary/10 text-primary font-medium"
          )}
          style={isRTL ? { paddingRight: `${depth * 14 + 8}px` } : { paddingLeft: `${depth * 14 + 8}px` }}
          onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
        >
          <button
            onClick={e => toggle(node.id, e)}
            className={cn("w-4 h-4 shrink-0 text-muted-foreground", !hasChildren && "invisible")}
          >
            {isExpanded
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`} />}
          </button>
          {node.code && (
            <span className="text-xs font-mono bg-muted px-1 py-0.5 rounded text-muted-foreground shrink-0">
              {node.code}
            </span>
          )}
          <span className="truncate" dir={language === "ar" ? "rtl" : "ltr"}>{getLocalizedCatalogName(node, language)}</span>
        </div>
        {isExpanded && hasChildren && (
          <div>{children.map(child => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="!max-w-none w-[42rem] max-h-[85vh] flex flex-col p-0 resize overflow-auto min-w-[320px] min-h-[300px]">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            {t.workflow.purchase.catalogPickItem}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">

          {/* Sidebar — شجرة التصنيفات */}
          <div className={`w-48 shrink-0 overflow-y-auto p-2 bg-muted/20 ${isRTL ? "border-l" : "border-r"}`}>
            <p className="text-xs text-muted-foreground px-2 pb-2 font-medium">{t.workflow.purchase.categoriesLabel}</p>
            <button
              onClick={() => setSelectedNodeId(null)}
              className={cn(
                "w-full text-start text-sm px-2 py-1.5 rounded hover:bg-muted/60 transition-colors",
                !selectedNodeId && "bg-primary/10 text-primary font-medium"
              )}
            >
              {t.common.all}
            </button>
            {roots.map(node => renderNode(node))}
          </div>

          {/* Main — البحث والنتائج */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
                <Input
                  ref={inputRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t.common.searchPlaceholder}
                  className={isRTL ? "pr-9" : "pl-9"}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 h-4">
                {isFetching
                  ? t.common.loading
                  : items.length > 0
                    ? `${items.length} ${t.purchaseOrders.items}`
                    : ""}
              </p>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isFetching ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  {t.common.loading}
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  {t.common.noData}
                </div>
              ) : (
                items.map((item: any) => (
                  <button
                    key={item.id}
                    onClick={() => {
                        onSelect({
                          id: item.id,
                          nameAr: item.nameAr,
                          nameEn: item.nameEn,
                          descriptionAr: item.descriptionAr,
                          descriptionEn: item.descriptionEn,
                          primaryImageUrl: item.primaryImageUrl || "",
                          unit: item.unit || "",
                        });

                      onClose();
                    }}

                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-primary/5 hover:border-primary/20 border border-transparent transition-colors text-start"
                  >
                    {/* صورة */}
                    <div className="w-10 h-10 rounded-md bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                      {item.primaryImageUrl ? (
                        <img src={item.primaryImageUrl} alt={getLocalizedCatalogName(item, language)} className="w-full h-full object-cover" />
                      ) : (
                        <FolderOpen className="w-4 h-4 text-muted-foreground/40" />
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0 text-start">
                      <p className="text-sm font-medium truncate" dir={language === "ar" ? "rtl" : "ltr"}>{getLocalizedCatalogName(item, language)}</p>
                      {getLocalizedCatalogDescription(item, language) ? (
                        <p className="text-xs text-muted-foreground truncate" dir={language === "ar" ? "rtl" : "ltr"}>{getLocalizedCatalogDescription(item, language)}</p>
                      ) : getLocalizedCatalogUnitName(item.unit, catalogUnits as any[] | undefined, language) ? (
                        <p className="text-xs text-muted-foreground truncate" dir={language === "ar" ? "rtl" : "ltr"}>{getLocalizedCatalogUnitName(item.unit, catalogUnits as any[] | undefined, language)}</p>
                      ) : null}
                    </div>
                    {/* Code */}
                    {item.code && (
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
                        {item.code}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Item Choice Dialog ─────────────────────────────────────────────────
function AddItemChoiceDialog({
  open,
  onClose,
  onChooseCatalog,
  onChooseNew,
}: {
  open: boolean;
  onClose: () => void;
  onChooseCatalog: () => void;
  onChooseNew: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">{t.workflow.purchase.addItem}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => { onClose(); onChooseCatalog(); }}
            className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-primary/20 hover:border-primary hover:bg-primary/5 transition-all"
          >
            <div className="p-3 rounded-full bg-primary/10">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm">{t.workflow.purchase.fromCatalog}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.workflow.purchase.chooseRegisteredItems}</p>
            </div>
          </button>
          <button
            onClick={() => { onClose(); onChooseNew(); }}
            className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-muted hover:border-muted-foreground/40 hover:bg-muted/30 transition-all"
          >
            <div className="p-3 rounded-full bg-muted">
              <FilePlus className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm">{t.workflow.purchase.newItem}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.workflow.purchase.enterManually}</p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function CreatePurchaseOrder() {
  const [, setLocation] = useLocation();
  const { t, language, dir } = useTranslation();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const ticketId = params.get("ticketId") ? parseInt(params.get("ticketId")!) : undefined;
  // بند بلاغ محدد ضمن بلاغ متعدد الجهات — الخطوة 4 (2026-08-08). غير مُمرَّر
  // لأي طلب شراء "عادي" مرتبط ببلاغ أحادي البند، فيسلك المسار القديم حرفيًا.
  const ticketItemId = params.get("ticketItemId") ? parseInt(params.get("ticketItemId")!) : undefined;
  const fromIdeaId = params.get("fromIdeaId") ? parseInt(params.get("fromIdeaId")!) : undefined;
  const prefillNotes = params.get("prefillNotes") || "";
  const pmv2RequestItemId = params.get("pmv2RequestItemId") ? parseInt(params.get("pmv2RequestItemId")!) : undefined;
  const pmv2RequestId = params.get("pmv2RequestId") ? parseInt(params.get("pmv2RequestId")!) : undefined;
  const pmv2CatalogItemId = params.get("pmv2CatalogItemId") ? parseInt(params.get("pmv2CatalogItemId")!) : undefined;
  const pmv2TaskNumber = params.get("pmv2TaskNumber") || "";
  const pmv2ItemName = params.get("pmv2ItemName") || "";
  const pmv2ItemCode = params.get("pmv2ItemCode") || "";
  const pmv2Unit = params.get("pmv2Unit") || "";
  const pmv2UnitIdRaw = Number(params.get("pmv2UnitId") || 0);
  const pmv2UnitId = Number.isInteger(pmv2UnitIdRaw) && pmv2UnitIdRaw > 0 ? pmv2UnitIdRaw : undefined;
  const pmv2MinimumQuantityRaw = Number(params.get("pmv2MinimumQuantity") || 0);
  const pmv2MinimumQuantity = Number.isFinite(pmv2MinimumQuantityRaw) && pmv2MinimumQuantityRaw > 0
    ? pmv2MinimumQuantityRaw
    : 0;
  const pmv2TaskNeedQuantityRaw = Number(params.get("pmv2TaskNeedQuantity") || 0);
  const pmv2TaskNeedQuantity = Number.isFinite(pmv2TaskNeedQuantityRaw) && pmv2TaskNeedQuantityRaw > 0
    ? pmv2TaskNeedQuantityRaw
    : 0;
  const pmv2TeamAvailableAtRequestRaw = Number(params.get("pmv2TeamAvailableAtRequest") || -1);
  const pmv2TeamAvailableAtRequest = Number.isFinite(pmv2TeamAvailableAtRequestRaw) && pmv2TeamAvailableAtRequestRaw >= 0
    ? pmv2TeamAvailableAtRequestRaw
    : null;
  const hasPmv2PurchaseContext = Boolean(pmv2RequestItemId && pmv2CatalogItemId && pmv2ItemName && pmv2MinimumQuantity > 0);
  const pmv2MinimumPurchaseUnits = Math.max(1, Math.ceil(pmv2MinimumQuantity || 1));
  const linkIdeaMut = trpc.improvementIdeas.linkToPurchaseOrder.useMutation();

  // قراءة draftId من الـ URL إذا كنا نعدّل مسودة
  const [matchEdit, editParams] = useRoute("/purchase-orders/edit-draft/:id");
  const draftId = matchEdit ? parseInt(editParams?.id || "0") : undefined;

  const { data: draftPO } = trpc.purchaseOrders.getById.useQuery(
    { id: draftId || 0 },
    { enabled: !!draftId }
  );

  const linkedTicketId = ticketId ?? draftPO?.ticketId ?? undefined;
  const linkedTicketItemId = ticketItemId ?? draftPO?.ticketItemId ?? undefined;
  const { data: ticket, isLoading: isLinkedTicketLoading } = trpc.tickets.getById.useQuery(
    { id: linkedTicketId || 0 },
    { enabled: !!linkedTicketId }
  );
  // بند البلاغ المستهدف (إن وُجد) — للتحقق من مساره وحالته بدل البلاغ كاملًا.
  const { data: linkedTicketItems } = trpc.tickets.items.useQuery(
    { ticketId: linkedTicketId || 0 },
    { enabled: !!linkedTicketId && !!linkedTicketItemId }
  );
  const linkedTicketItem = linkedTicketItemId
    ? linkedTicketItems?.find((i: any) => i.id === linkedTicketItemId)
    : undefined;

  const allowedLinkedTicketStatuses = draftId
    ? ["work_approved", "needs_purchase"]
    : ["work_approved"];
  // ⚠️ 2026-08-08 — الخطوة 4: إن وُجد ticketItemId، يُفحص مسار وحالة *البند* بدل
  // البلاغ. البلاغ أحادي البند (الأغلبية الساحقة) لا يمرّر ticketItemId إطلاقًا
  // فيسلك المسار القديم حرفيًا (فحص على ticket مباشرة).
  const relevantMaintenancePath = linkedTicketItemId ? linkedTicketItem?.maintenancePath : ticket?.maintenancePath;
  const relevantStatus = linkedTicketItemId ? linkedTicketItem?.status : ticket?.status;
  const isLinkedTicketInvalid = Boolean(
    linkedTicketId &&
    ticket &&
    (!linkedTicketItemId || linkedTicketItem) &&
    (relevantMaintenancePath !== "B" || !allowedLinkedTicketStatuses.includes(relevantStatus || ""))
  );
  const isLinkedTicketActionBlocked = Boolean(
    linkedTicketId && (
      isLinkedTicketLoading || !ticket ||
      (linkedTicketItemId && !linkedTicketItem) ||
      isLinkedTicketInvalid
    )
  );

  // ✅ وحدات القياس من الكاتلوج — تُحدّث القائمة فور إضافة وحدة جديدة من تبويب الكاتلوج
  const { data: catalogUnits } = trpc.catalog.units.list.useQuery();
  const pmv2ResolvedCatalogUnit = useMemo(() => {
    if (!hasPmv2PurchaseContext || !catalogUnits?.length || !pmv2UnitId) return null;
    return (catalogUnits as any[]).find((unit: any) => Number(unit.id) === pmv2UnitId) || null;
  }, [hasPmv2PurchaseContext, catalogUnits, pmv2UnitId]);


  const createMut = trpc.purchaseOrders.create.useMutation({
    onSuccess: async (data) => {
      toast.success(
        data.pmv2Linked
          ? `${t.purchaseOrders.createNew} ${data.poNumber} — ${t.workflow.purchase.pmv2LinkedAutomatically}`
          : `${t.purchaseOrders.createNew} ${data.poNumber}`,
      );
      if (fromIdeaId) {
        linkIdeaMut.mutate({ id: fromIdeaId, purchaseOrderId: data.id! });
      }
      setLocation(`/purchase-orders/${data.id}`);
    },
    onError: (err) => toast.error(localizeApiError(err.message)),
  });

  const saveDraftMut = trpc.purchaseOrders.saveDraft.useMutation({
    onSuccess: async (data) => {
      toast.success(`${t.purchaseOrders.saveDraft} — ${data.poNumber}`);
      setLocation(`/purchase-orders/${data.id}`);
    },
    onError: (err) => toast.error(localizeApiError(err.message)),
  });

  const updateDraftMut = trpc.purchaseOrders.updateDraft.useMutation({
    onSuccess: () => {
      toast.success(t.purchaseOrders.saveChangesSuccess);
      setLocation(`/purchase-orders/${draftId}`);
    },
    onError: (err) => toast.error(localizeApiError(err.message)),
  });

  const [draftLoaded, setDraftLoaded] = useState(false);
  const [items, setItems] = useState<ItemForm[]>(() => hasPmv2PurchaseContext
    ? [{
        sourceType: "catalog",
        catalogItemId: pmv2CatalogItemId!,
        itemName: pmv2ItemName,
        description: "",
        quantity: pmv2MinimumPurchaseUnits,
        unit: pmv2Unit,
        photoUrls: [],
        notes: `PM V2 ${pmv2TaskNumber}${pmv2ItemCode ? ` · ${t.workflow.purchase.pmv2CodeLabel} ${pmv2ItemCode}` : ""} · ${t.workflow.purchase.pmv2ShortageLinkedQty} ${pmv2MinimumPurchaseUnits} ${pmv2Unit}`.trim(),
      }]
    : [emptyItem()]);

  // Catalog item names are governed master data. If the viewer changes the UI
  // language while the form is still open, keep the read-only catalog name in
  // sync with the Arabic/English master fields (Urdu deliberately uses English).
  useEffect(() => {
    setItems(prev => prev.map(item => {
      if (item.sourceType !== "catalog" || (!item._catalogNameAr && !item._catalogNameEn)) return item;
      const localized = language === "ar"
        ? (item._catalogNameAr || item._catalogNameEn || item.itemName)
        : (item._catalogNameEn || item._catalogNameAr || item.itemName);
      return localized === item.itemName ? item : { ...item, itemName: localized };
    }));
  }, [language]);

  // PM V2 passes a stable Catalog Unit ID when the current Master Data can resolve it.
  // Canonicalize the bound PO item to the active Arabic unit name expected by this form.
  // If the unit cannot be resolved, keep the field editable as an explicit fallback.
  useEffect(() => {
    if (!hasPmv2PurchaseContext || !pmv2CatalogItemId || !pmv2ResolvedCatalogUnit?.nameAr) return;
    const canonicalUnit = String(pmv2ResolvedCatalogUnit.nameAr).trim();
    if (!canonicalUnit) return;
    setItems(prev => {
      const idx = prev.findIndex(item => Number(item.catalogItemId) === pmv2CatalogItemId);
      if (idx < 0 || prev[idx].unit === canonicalUnit) return prev;
      return prev.map((item, itemIndex) => itemIndex === idx ? { ...item, unit: canonicalUnit } : item);
    });
  }, [hasPmv2PurchaseContext, pmv2CatalogItemId, pmv2ResolvedCatalogUnit?.nameAr]);

  // PM V2-linked Purchase is intentionally one shortage item = one Purchase item.
  // Keep the linked identity and exact shortage quantity authoritative even if stale UI state exists.
  useEffect(() => {
    if (!hasPmv2PurchaseContext || !pmv2CatalogItemId) return;
    setItems(prev => {
      const current = prev.find(item => Number(item.catalogItemId) === pmv2CatalogItemId) || prev[0];
      const canonicalUnit = String(pmv2ResolvedCatalogUnit?.nameAr || current?.unit || pmv2Unit || "").trim();
      const lockedItem: ItemForm = {
        ...(current || emptyItem()),
        sourceType: "catalog",
        catalogItemId: pmv2CatalogItemId,
        itemName: pmv2ItemName,
        quantity: pmv2MinimumPurchaseUnits,
        unit: canonicalUnit,
      };
      const alreadyLocked = prev.length === 1
        && prev[0].sourceType === "catalog"
        && Number(prev[0].catalogItemId) === pmv2CatalogItemId
        && prev[0].itemName === pmv2ItemName
        && Number(prev[0].quantity) === pmv2MinimumPurchaseUnits
        && prev[0].unit === canonicalUnit;
      return alreadyLocked ? prev : [lockedItem];
    });
  }, [hasPmv2PurchaseContext, pmv2CatalogItemId, pmv2ItemName, pmv2MinimumPurchaseUnits, pmv2ResolvedCatalogUnit?.nameAr, pmv2Unit, draftLoaded]);

  // تحميل أصناف المسودة عند فتح صفحة التعديل
  useEffect(() => {
    if (draftPO && !draftLoaded) {
      setNotes(draftPO.notes || "");
      if (draftPO.items && draftPO.items.length > 0) {
        setItems(draftPO.items.map((i: any) => ({
          sourceType: i.catalogItemId ? "catalog" as const : "manual" as const,
          catalogItemId: i.catalogItemId ?? null,
          itemName: getLocalizedItemField(i, "itemName", language) || i.itemName || "",
          description: getLocalizedItemField(i, "description", language) || i.description || "",
          quantity: i.quantity || 1,
          unit: i.unit || t.purchaseOrders.defaultUnit,
          photoUrls: i.photoUrls || (i.photoUrl ? [i.photoUrl] : []),
          notes: i.notes || "",
          _existingId: i.id, // نحفظ id الصنف الأصلي
        })));
      }
      setDraftLoaded(true);
    }
  }, [draftPO, draftLoaded]);
  const [notes, setNotes] = useState(prefillNotes);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [showDropZoneIdx, setShowDropZoneIdx] = useState<number | null>(null);

  // ── Dialog States ──────────────────────────────────────────
  const [showChoiceDialog, setShowChoiceDialog] = useState(true);
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);
  const [catalogTargetIndex, setCatalogTargetIndex] = useState<number | null>(null);

  const updateItem = (idx: number, field: keyof ItemForm, value: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

const handleUpload = async (idx: number, file: File) => {
  setUploadingIdx(idx);
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.url) {
      const current = items[idx].photoUrls || [];
      if (current.length < 4) {
        updateItem(idx, "photoUrls", [...current, data.url]);
        toast.success(t.common.save);
      } else {
        toast.error(t.purchaseOrders.maxPhotos);
      }
    }
  } catch { toast.error(t.common.close); }
  setUploadingIdx(null);
};

  // عند اختيار صنف من الكاتلوج
const handleCatalogSelect = (catalogItem: any) => {
  if (catalogTargetIndex === null) return;

  setItems(prev =>
    prev.map((item, i) =>
      i === catalogTargetIndex
        ? {
            ...item,
            sourceType: "catalog",
            catalogItemId: catalogItem.id,

            itemName: getLocalizedCatalogName(catalogItem, language),
            description: getLocalizedCatalogDescription(catalogItem, language),
            _catalogNameAr: catalogItem.nameAr || "",
            _catalogNameEn: catalogItem.nameEn || "",
            // Keep the canonical stored value in Arabic, while the Select renders
            // the Arabic/English master label according to the viewer language.
            unit: resolveCatalogUnit(catalogItem.unit, catalogUnits as any[] | undefined)?.nameAr || "",

            photoUrls: catalogItem.primaryImageUrl ? [catalogItem.primaryImageUrl] : [],
          }
        : item
    )
  );
};

  const purchaseItemsForSubmit = () => {
    if (!hasPmv2PurchaseContext || !pmv2CatalogItemId) return items.filter(i => i.itemName.trim());
    const boundItem = items.find(i => Number(i.catalogItemId) === pmv2CatalogItemId);
    return boundItem ? [{ ...boundItem, quantity: pmv2MinimumPurchaseUnits }] : [];
  };

  const buildItemsPayload = () =>
    purchaseItemsForSubmit().map(i => ({
      catalogItemId: i.catalogItemId,
      itemName:    i.itemName,
      description: i.description || undefined,
      quantity:    hasPmv2PurchaseContext ? pmv2MinimumPurchaseUnits : i.quantity,
      unit:        i.unit || undefined,
      photoUrl:    i.photoUrls?.[0] || undefined,
      photoUrls:   i.photoUrls?.length ? i.photoUrls : undefined,
      notes:       i.notes || undefined,
    }));

  const validatePmv2LinkedPurchase = () => {
    if (!hasPmv2PurchaseContext || !pmv2CatalogItemId) return true;
    const boundItem = items.find((item) => Number(item.catalogItemId) === pmv2CatalogItemId);
    if (!boundItem || items.length !== 1 || boundItem.sourceType !== "catalog") {
      toast.error(t.workflow.purchase.pmv2SingleShortageOnly);
      return false;
    }
    if (Number(boundItem.quantity || 0) !== pmv2MinimumPurchaseUnits) {
      toast.error(`${t.workflow.purchase.pmv2ShortageQtyFixed} ${pmv2MinimumPurchaseUnits} ${getLocalizedCatalogUnitName(pmv2ResolvedCatalogUnit?.nameAr || pmv2Unit, catalogUnits as any[] | undefined, language)}`);
      return false;
    }
    if (!String(boundItem.unit || "").trim()) {
      toast.error(t.workflow.purchase.pmv2UnitAutoFailed);
      return false;
    }
    return true;
  };

  const handleUpdateDraft = () => {
    if (isLinkedTicketActionBlocked) {
      toast.error(t.workflow.purchase.linkedPoEditPathBOnly);
      return;
    }
    if (!validatePmv2LinkedPurchase()) return;
    const sourceItems = purchaseItemsForSubmit();
    if (sourceItems.length === 0) { toast.error(t.purchaseOrders.items); return; }
    updateDraftMut.mutate({
      id: draftId!,
      notes: notes || undefined,
      items: (sourceItems as any[]).map(i => ({
        id: i._existingId || undefined,
        catalogItemId: i.catalogItemId ?? null,
        itemName: i.itemName,
        description: i.description || undefined,
        quantity: hasPmv2PurchaseContext ? pmv2MinimumPurchaseUnits : i.quantity,
        unit: i.unit || undefined,
        photoUrl: i.photoUrls?.[0] || undefined,
        photoUrls: i.photoUrls?.length ? i.photoUrls : undefined,
        notes: i.notes || undefined,
      })),
    });
  };

  const handleSaveDraft = () => {
    if (!validatePmv2LinkedPurchase()) return;
    if (isLinkedTicketActionBlocked) {
      toast.error(t.workflow.purchase.linkedPoSavePathBOnly);
      return;
    }
    const validItems = buildItemsPayload();
    if (validItems.length === 0) { toast.error(t.purchaseOrders.items); return; }
    saveDraftMut.mutate({ ticketId, ticketItemId, notes: notes || undefined, items: validItems });
  };

  const handleSubmit = () => {
    if (!validatePmv2LinkedPurchase()) return;
    if (isLinkedTicketActionBlocked) {
      toast.error(t.workflow.purchase.linkedPoSubmitPathBOnly);
      return;
    }
    const validItems = purchaseItemsForSubmit();
    if (validItems.length === 0) { toast.error(t.purchaseOrders.items); return; }
    createMut.mutate({
      ticketId,
      ticketItemId,
      pmv2RequestItemId: hasPmv2PurchaseContext ? pmv2RequestItemId : undefined,
      notes: notes || undefined,
      items: buildItemsPayload(),
    });
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => goBackOrFallback(setLocation, linkedTicketId ? `/tickets/${linkedTicketId}` : hasPmv2PurchaseContext ? "/scheduled-maintenance/warehouse-requests" : "/purchase-orders")}>
          <ArrowRight className={`w-5 h-5 ${dir === "ltr" ? "rotate-180" : ""}`} />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{draftId ? `${t.purchaseOrders.editDraft || "Edit draft"} ${draftPO?.poNumber || ""}` : t.purchaseOrders.createNew}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t.purchaseOrders.items}</p>
        </div>
      </div>

      {ticket && (
        <Card className="border-teal-200 bg-teal-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Link2 className="w-5 h-5 text-teal-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-teal-800">{t.purchaseOrders.relatedTicket}: {ticket.ticketNumber}</p>
              <p className="text-xs text-teal-600">{ticket.title} — {ticket.locationDetail || ""}</p>
            </div>
            <Button variant="ghost" size="sm" className="mr-auto text-xs" onClick={() => goBackOrFallback(setLocation, `/tickets/${linkedTicketId}`)}>
              {t.common.back}
            </Button>
          </CardContent>
        </Card>
      )}

      {hasPmv2PurchaseContext && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <ShoppingCart className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">{t.workflow.purchase.pmv2ShortagePoTitle}</p>
                  <p className="text-xs text-amber-700">{t.workflow.purchase.pmv2ShortagePoHelp}</p>
                </div>
              </div>
              <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900">
                {t.workflow.purchase.pmv2LinkedTask}
              </Badge>
            </div>
            <div className="grid gap-2 rounded-md border border-amber-200 bg-white/60 p-3 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">{t.workflow.purchase.referenceLabel}</span> <span className="font-medium">PM V2</span></p>
              <p><span className="text-muted-foreground">{t.workflow.purchase.linkedTaskLabel}</span> <span className="font-medium">{pmv2TaskNumber}</span></p>
              <p><span className="text-muted-foreground">{t.workflow.purchase.requestReasonLabel}</span> <span className="font-medium">{t.workflow.purchase.scheduledMaterialShortage}</span></p>
              <p><span className="text-muted-foreground">{t.workflow.purchase.linkedItemLabel}</span> <span className="font-medium">{pmv2ItemName}{pmv2ItemCode ? ` · ${pmv2ItemCode}` : ""}</span></p>
              {pmv2TaskNeedQuantity > 0 && (
                <p><span className="text-muted-foreground">{t.workflow.purchase.taskNeedLabel}</span> <span className="font-medium">{pmv2TaskNeedQuantity} {pmv2Unit}</span></p>
              )}
              {pmv2TeamAvailableAtRequest != null && (
                <p><span className="text-muted-foreground">{t.workflow.purchase.teamAvailableAtShortage}</span> <span className="font-medium">{pmv2TeamAvailableAtRequest} {pmv2Unit}</span></p>
              )}
              <p><span className="text-muted-foreground">{t.workflow.purchase.purchaseQtyLabel}</span> <span className="font-semibold text-amber-900">{pmv2MinimumPurchaseUnits} {getLocalizedCatalogUnitName(pmv2ResolvedCatalogUnit?.nameAr || pmv2Unit, catalogUnits as any[] | undefined, language)}</span></p>
              {pmv2RequestId && pmv2RequestItemId && (
                <p><span className="text-muted-foreground">{t.workflow.purchase.pmv2MaterialReference}</span> <span className="font-medium">{t.workflow.purchase.requestNumber} #{pmv2RequestId} · {t.workflow.purchase.itemNumber} #{pmv2RequestItemId}</span></p>
              )}
            </div>
            <p className="text-xs text-amber-800">
              {t.workflow.purchase.pmv2PoFixedScopeHelp}
            </p>
          </CardContent>
        </Card>
      )}

      {isLinkedTicketInvalid && ticket && (
        <Card className="border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-start gap-3 text-red-800 dark:text-red-300">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">{t.workflow.purchase.cannotCreateEditPo}</p>
              <p className="text-sm">
                {t.workflow.purchase.linkedPoPathBHelp}
                {t.workflow.purchase.currentPath} {ticket.maintenancePath || t.workflow.purchase.unspecified} — {t.workflow.purchase.currentStatus} {ticket.status}.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

{items.map((item, idx) => {
  const isPmv2BoundItem = Boolean(hasPmv2PurchaseContext && idx === 0 && item.catalogItemId === pmv2CatalogItemId);
  const minimumQuantity = isPmv2BoundItem ? pmv2MinimumPurchaseUnits : 1;
  return (
  <Card key={idx}>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm">
          {t.purchaseOrders.itemName} #{idx + 1}
        </CardTitle>

        {items.length > 1 && !isPmv2BoundItem && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() =>
              setItems(prev => prev.filter((_, i) => i !== idx))
            }
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </CardHeader>

    <CardContent className="space-y-4">

      {/* نوع الصنف */}
      <div className="space-y-2">
        <Label>{t.purchaseOrders.itemSourceType}</Label>

        <select
          value={item.sourceType}
          disabled={isPmv2BoundItem}
          onChange={(e) => {
            const value = e.target.value as "catalog" | "manual";

            setItems(prev => prev.map((current, i) =>
              i === idx
                ? {
                    ...current,
                    sourceType: value,
                    // الرجوع للإدخال اليدوي يفصل الرابط فعليًا حتى لا يبقى
                    // بند يدوي مرتبطًا بصنف كتالوج قديم بالخطأ.
                    catalogItemId: value === "manual" ? null : current.catalogItemId,
                  }
                : current
            ));

            if (value === "catalog") {
              setCatalogTargetIndex(idx);
              setShowCatalogPicker(true);
            }
          }}
          className="w-full h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="manual">{t.purchaseOrders.itemSourceManual}</option>
          <option value="catalog">{t.purchaseOrders.itemSourceCatalog}</option>
        </select>
      </div>

      {/* اسم الصنف */}
      <div className="space-y-2">
        <Label>{t.purchaseOrders.itemName} *</Label>

        <Textarea
          dir="auto"
          value={item.itemName}
          readOnly={item.sourceType === "catalog"}
          maxLength={300}
          rows={2}
          onClick={() => {
            if (item.sourceType === "catalog" && !isPmv2BoundItem) {
              setCatalogTargetIndex(idx);
              setShowCatalogPicker(true);
            }
          }}
          onChange={e =>
            updateItem(idx, "itemName", e.target.value.slice(0, 300))
          }
        />
        <p className="text-[11px] text-muted-foreground text-start">
          {item.itemName.length} / 300
        </p>
      </div>

      {/* الوصف */}
      <div className="space-y-2">
        <Label>{t.tickets.description}</Label>

        <Textarea
          dir="auto"
          value={item.description}
          maxLength={1500}
          onChange={e =>
            updateItem(idx, "description", e.target.value.slice(0, 1500))
          }
          rows={2}
        />
        <p className="text-[11px] text-muted-foreground text-start">
          {item.description.length} / 1500
        </p>
      </div>

      {/* الكمية والوحدة والصورة */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

        {/* الكمية */}
        <div className="space-y-2">
          <Label>{t.purchaseOrders.quantity} *</Label>

          <Input
            type="number"
            min={minimumQuantity}
            value={item.quantity}
            disabled={isPmv2BoundItem}
            onChange={e =>
              updateItem(
                idx,
                "quantity",
                Math.max(minimumQuantity, parseInt(e.target.value) || minimumQuantity)
              )
            }
          />
          {isPmv2BoundItem && (
            <p className="text-xs text-muted-foreground">{t.workflow.purchase.pmv2QtyFixed}</p>
          )}
        </div>

        {/* الوحدة */}
        <div className="space-y-2">
          <Label>{t.purchaseOrders.unit}</Label>

          <Select
            value={item.unit}
            onValueChange={value => updateItem(idx, "unit", value)}
            disabled={isPmv2BoundItem && Boolean(pmv2ResolvedCatalogUnit)}
          >
            <SelectTrigger dir="auto">
              <SelectValue placeholder={t.purchaseOrders.unit} />
            </SelectTrigger>
            <SelectContent>
              {(catalogUnits || []).map((u: any) => (
                <SelectItem key={u.id} value={u.nameAr}>
                  <span dir={language === "ar" ? "rtl" : "ltr"}>{getLocalizedCatalogUnitName(u.nameAr, catalogUnits as any[] | undefined, language)}</span>
                </SelectItem>
              ))}
              {/* مسودة تاريخية فقط: نُظهر الوحدة القديمة كقيمة محفوظة غير قابلة للاختيار من جديد. */}
              {(item as any)._existingId && item.unit && !(catalogUnits || []).some((u: any) => u.nameAr === item.unit || u.nameEn === item.unit) && (
                <SelectItem value={item.unit} disabled>{getLocalizedCatalogUnitName(item.unit, catalogUnits as any[] | undefined, language)} ({t.workflow.purchase.historicalDisabled})</SelectItem>
              )}
            </SelectContent>
          </Select>
          {isPmv2BoundItem && !pmv2ResolvedCatalogUnit && (
            <p className="text-xs text-amber-700">
              {t.workflow.purchase.pmv2UnitNeedsSelection}
            </p>
          )}
        </div>

{/* الصور — حتى 4 */}
<div className="space-y-2">
  <Label>
    {t.tickets.photos}
    <span className="text-xs text-muted-foreground ms-2">
      ({(item.photoUrls || []).length}/4)
    </span>
  </Label>

  {/* عرض الصور المرفوعة */}
  {(item.photoUrls || []).length > 0 && (
    <div className="grid grid-cols-4 gap-2">
      {(item.photoUrls || []).map((url, pIdx) => (
        <div key={pIdx} className="relative">
          <img
            src={url}
            alt=""
            className="w-full h-16 rounded-lg object-cover border"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-0.5 left-0.5 h-5 w-5"
            onClick={() => {
              const updated = (item.photoUrls || []).filter((_, i) => i !== pIdx);
              updateItem(idx, "photoUrls", updated);
            }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
    </div>
  )}

  {/* أزرار الرفع — تظهر فقط إذا أقل من 4 */}
  {(item.photoUrls || []).length < 4 && (
    showDropZoneIdx === idx ? (
      <DropZone
        maxFiles={4 - (item.photoUrls || []).length}
        accept="image/*"
        label={t.purchaseOrders.dragItemPhoto}
        sublabel={`${t.purchaseOrders.maxPhotos}`}
        onFilesUploaded={(files: UploadedFile[]) => {
          const uploaded = files
            .filter(f => f.status === "done" && f.url)
            .map(f => f.url!);
          if (uploaded.length > 0) {
            const current = item.photoUrls || [];
            const combined = [...current, ...uploaded].slice(0, 4);
            updateItem(idx, "photoUrls", combined);
            setShowDropZoneIdx(null);
          }
        }}
      />
    ) : (
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-16 border-dashed gap-1"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.multiple = true;
            input.onchange = async (e: any) => {
              const files: File[] = Array.from(e.target.files || []);
              const remaining = 4 - (item.photoUrls || []).length;
              for (const file of files.slice(0, remaining)) {
                await handleUpload(idx, file);
              }
            };
            input.click();
          }}
          disabled={uploadingIdx === idx}
        >
          {uploadingIdx === idx ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
          {uploadingIdx === idx ? "..." : t.common.upload}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-16 px-3 border-dashed"
          onClick={() => setShowDropZoneIdx(idx)}
          title={t.purchaseOrders.dragAndDrop}
        >
          <Upload className="w-4 h-4" />
        </Button>
      </div>
    )
  )}
</div> {/* إغلاق div الصور space-y-2 */}

      </div> {/* إغلاق grid grid-cols-2 md:grid-cols-3 */}

      {/* المبررات */}
      <div className="space-y-2">
        <Label>{t.purchaseOrders.justification}</Label>

        <Textarea
          dir="auto"
          value={item.notes}
          maxLength={200}
          rows={2}
          onChange={e =>
            updateItem(idx, "notes", e.target.value.slice(0, 200))
          }
        />
        <p className="text-[11px] text-muted-foreground text-start">
          {item.notes.length} / 200
        </p>
      </div>

    </CardContent>
  </Card>
  );
})}

{/* طلب PM V2 المرتبط = عجز واحد / صنف واحد، لذلك لا يظهر زر إضافة صنف. */}
{!hasPmv2PurchaseContext && (
  <Button
    variant="outline"
    onClick={() => setItems(prev => [...prev, emptyItem()])}
    className="w-full gap-2 border-dashed h-12"
  >
    <Plus className="w-4 h-4" /> {t.common.add}
  </Button>
)}

      <div className="space-y-3">
        <Textarea
          dir="auto"
          placeholder={t.purchaseOrders.justification}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-muted-foreground">
                {items.filter(i => i.itemName.trim()).length} {t.purchaseOrders.items}
              </span>
              {ticket && (
                <span className="text-xs text-muted-foreground">
                  {t.purchaseOrders.relatedTicket}: {ticket.ticketNumber}
                </span>
              )}
            </div>
            {draftId ? (
              <Button
                onClick={handleUpdateDraft}
                disabled={updateDraftMut.isPending || isLinkedTicketActionBlocked}
                className="w-full gap-2"
                size="lg"
              >
                {updateDraftMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t.purchaseOrders.saveChanges}
              </Button>
            ) : (
            <div className="flex gap-2">
              {!hasPmv2PurchaseContext && (
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={saveDraftMut.isPending || createMut.isPending || isLinkedTicketActionBlocked}
                  className="flex-1 gap-2"
                  size="lg"
                >
                  {saveDraftMut.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <BookOpen className="w-4 h-4" />}
                  {t.purchaseOrders.saveDraft}
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={createMut.isPending || saveDraftMut.isPending || isLinkedTicketActionBlocked}
                className="flex-1 gap-2"
                size="lg"
              >
                {createMut.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <ShoppingCart className="w-4 h-4" />}
                {t.common.submit}
              </Button>
            </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog اختيار طريقة الإضافة */}

      {/* Dialog الكاتلوج */}
      <CatalogPickerDialog
        open={showCatalogPicker}
        onClose={() => setShowCatalogPicker(false)}
        onSelect={handleCatalogSelect}
      />
    </div>
  );
}
