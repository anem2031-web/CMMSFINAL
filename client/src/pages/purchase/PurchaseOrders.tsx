import { trpc } from "@/lib/trpc";
import { readHistoryEntryState, writeHistoryEntryState } from "@/lib/backStack";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Plus, ShoppingCart, Trash2, User, Package, Search } from "lucide-react";
import { useState, useEffect, Fragment, useMemo, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { useStaticLabels } from "@/hooks/useContentTranslation";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { ExportButton } from "@/components/common/ExportButton";
import { PurchaseCardList } from "@/components/purchase/PurchaseCardList";
import { PurchaseBatchCard } from "@/components/purchase/PurchaseBatchCard";
import { Boxes } from "lucide-react";

const PO_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_estimate: "bg-amber-100 text-amber-700",
  pending_accounting: "bg-orange-100 text-orange-700",
  pending_management: "bg-orange-100 text-orange-700",
  approved: "bg-teal-100 text-teal-700",
  partial_purchase: "bg-cyan-100 text-cyan-700",
  purchased: "bg-emerald-100 text-emerald-700",
  received: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-700",
  rejected: "bg-red-100 text-red-700",
};

// الأدوار التي تملك صلاحية رؤية فلتر المستخدم
const FULL_ACCESS_ROLES = ["owner", "admin", "maintenance_manager", "general_maintenance_manager", "construction_procurement_manager", "purchase_manager", "senior_management", "executive_director", "accountant", "warehouse"];

type PurchaseOrdersHistoryState = {
  statusFilter: string;
  dateFrom: string;
  dateTo: string;
  requestedById: string;
  searchQuery: string;
  currentPage: number;
  view: "actionable" | "all";
};

const PURCHASE_ORDERS_HISTORY_KEY = "__cmmsPurchaseOrdersState";

export default function PurchaseOrders() {
  const [, setLocation] = useLocation();
  const { t, language } = useTranslation();
  const { getPOStatusLabel, getPOItemStatusLabel } = useStaticLabels();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const savedHistoryState = useMemo(
    () => readHistoryEntryState<PurchaseOrdersHistoryState>(PURCHASE_ORDERS_HISTORY_KEY),
    [],
  );

  // فلاتر
  const [statusFilter, setStatusFilter] = useState(savedHistoryState?.statusFilter ?? "all");
  const [dateFrom, setDateFrom] = useState(savedHistoryState?.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(savedHistoryState?.dateTo ?? "");
  const [requestedById, setRequestedById] = useState(savedHistoryState?.requestedById ?? "all");
  const [searchQuery, setSearchQuery] = useState(savedHistoryState?.searchQuery ?? "");

  // ── تقسيم الصفحات (Pagination): 10 طلبات بكل صفحة ──
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(savedHistoryState?.currentPage && savedHistoryState.currentPage > 0 ? savedHistoryState.currentPage : 1);
  const didMountFilters = useRef(false);

  // ── عرض "بانتظار إجرائي" مقابل "جميع الطلبات" ──
  // مدير الصيانة دوره إشرافي ويتابع جميع الطلبات بغض النظر عن منشئها، لذلك
  // يبدأ من العرض الكامل. بقية الأدوار تبدأ من الطلبات التي تنتظر إجراءها.
  const [view, setView] = useState<"actionable" | "all">(savedHistoryState?.view ?? "actionable");
  useEffect(() => {
    if (["maintenance_manager", "general_maintenance_manager", "construction_procurement_manager"].includes(user?.role || "")) {
      setView("all");
    }
  }, [user?.role]);
  const { data: actionable, isLoading: actionableLoading } =
    trpc.purchaseOrders.actionableForMe.useQuery();
  const actionableItems = actionable?.items ?? [];

  // [PB-ACTIONABLE 2026-08-31] الحسابات والإدارة العليا تعملان على مستوى
  // دفعة الإرسال داخل الحزمة. نجلب تمثيل الدفعات مرة واحدة لتبويب
  // «بانتظار إجرائي» فقط، مع إبقاء الطلبات المفردة القديمة كما هي.
  const isPackageSubmissionActionRole =
    user?.role === "accountant" || user?.role === "senior_management";
  const { data: actionableSubmissions, isLoading: actionableSubmissionsLoading } =
    trpc.purchasePackages.actionableSubmissionsForMe.useQuery(undefined, {
      enabled: isPackageSubmissionActionRole,
    });
  const actionableSubmissionItems = actionableSubmissions?.items ?? [];

  const actionableSubmissionOrderIds = useMemo(() => {
    const ids = new Set<number>();
    for (const sub of actionableSubmissionItems as any[]) {
      for (const id of sub.orderIds ?? []) ids.add(Number(id));
    }
    return ids;
  }, [actionableSubmissionItems]);

  // [PB-DELEGATE-PARTIAL-PRICING 2026-09-02]
  // للمندوب، حقيقة «ما بقي للتسعير» هي حالة الصنف لا حالة PR العامة.
  // pendingEstimateItems تعيد الأصناف pending أو estimated غير المرسلة حتى لو
  // أصبح PR نفسه pending_accounting/approved بسبب دفعة سابقة؛ لذلك تبقى PB
  // ظاهرة في «بانتظار إجرائي» حتى ينتهي عمل المندوب على كل أصنافها.
  const isDelegatePricingActionRole = user?.role === "delegate";
  const { data: delegatePendingEstimateItems = [], isLoading: delegatePendingEstimateItemsLoading } =
    trpc.purchaseOrders.pendingEstimateItems.useQuery(undefined, {
      enabled: isDelegatePricingActionRole,
    });

  // [PB-REVIEWER-ACTIONABLE 2026-08-31] بعد أن يجمع المراجع طلبات pending_review
  // داخل حزمة، تصبح الحزمة هي وحدة العرض في «بانتظار إجرائي». لا نغيّر
  // actionableForMe ولا صلاحية reviewItems؛ كل PR يبقى مستقلاً عند فتحه.
  const isReviewerGroupingActionRole = !!user && [
    "owner",
    "admin",
    "maintenance_manager",
    "general_maintenance_manager",
    "construction_procurement_manager",
    "purchase_manager",
    "food_warehouse_manager",
  ].includes(user.role);
  const needsActionablePackageCards = isReviewerGroupingActionRole;
  const { data: actionablePackageCards = [], isLoading: actionablePackageCardsLoading } =
    trpc.purchasePackages.cards.useQuery(undefined, {
      enabled: needsActionablePackageCards,
    });

  const delegatePricingPackages = useMemo(() => {
    if (!isDelegatePricingActionRole) return [];

    const packages = new Map<number, any>();
    for (const item of delegatePendingEstimateItems as any[]) {
      const packageId = Number(item.packageId || 0);
      if (!packageId) continue;

      let pkg = packages.get(packageId);
      if (!pkg) {
        pkg = {
          id: packageId,
          packageNumber: item.packageNumber || `#${packageId}`,
          actionableOrders: [],
          _orders: new Map<number, any>(),
        };
        packages.set(packageId, pkg);
      }

      const orderId = Number(item.purchaseOrderId);
      let order = pkg._orders.get(orderId);
      if (!order) {
        order = {
          id: orderId,
          poNumber: item.purchaseOrderNumber || `#${orderId}`,
          items: [],
        };
        pkg._orders.set(orderId, order);
        pkg.actionableOrders.push(order);
      }
      order.items.push(item);
    }

    return Array.from(packages.values()).map(({ _orders, ...pkg }) => pkg);
  }, [delegatePendingEstimateItems, isDelegatePricingActionRole]);

  const delegatePricingPackagedOrderIds = useMemo(() => {
    const ids = new Set<number>();
    for (const pkg of delegatePricingPackages as any[]) {
      for (const po of pkg.actionableOrders ?? []) ids.add(Number(po.id));
    }
    return ids;
  }, [delegatePricingPackages]);

  const reviewerActionableOrderIds = useMemo(() =>
    new Set(
      actionableItems
        .filter((it: any) => it.status === "pending_review")
        .map((it: any) => Number(it.id))
    ),
  [actionableItems]);

  const reviewerActionablePackages = useMemo(() => {
    if (!isReviewerGroupingActionRole || reviewerActionableOrderIds.size === 0) return [];

    return (actionablePackageCards as any[]).flatMap((card: any) => {
      if (card.cardType !== "package") return [];
      const actionableOrders = (card.orders ?? []).filter((po: any) =>
        reviewerActionableOrderIds.has(Number(po.id)) && po.status === "pending_review"
      );
      return actionableOrders.length > 0 ? [{ ...card, actionableOrders }] : [];
    });
  }, [actionablePackageCards, isReviewerGroupingActionRole, reviewerActionableOrderIds]);

  const reviewerPackagedOrderIds = useMemo(() => {
    const ids = new Set<number>();
    for (const pkg of reviewerActionablePackages as any[]) {
      for (const po of pkg.actionableOrders ?? []) ids.add(Number(po.id));
    }
    return ids;
  }, [reviewerActionablePackages]);

  // نخفي PR فقط عندما أصبح له تمثيل موحّد في نفس تبويب «بانتظار إجرائي»:
  // - المراجع أثناء pending_review: بطاقة حزمة التجميع PB.
  // - الحسابات/الإدارة: دفعة الإرسال.
  // - المندوب أثناء التسعير: بطاقة الحزمة PB.
  // بعد اعتماد الإدارة يبقى شراء المندوب PR منفردًا كما اتفقنا.
  const standaloneActionableItems = useMemo(() =>
    actionableItems.filter((it: any) => {
      const id = Number(it.id);
      if (isPackageSubmissionActionRole && actionableSubmissionOrderIds.has(id)) return false;
      if (isDelegatePricingActionRole && it.status === "pending_estimate" && delegatePricingPackagedOrderIds.has(id)) return false;
      if (isReviewerGroupingActionRole && it.status === "pending_review" && reviewerPackagedOrderIds.has(id)) return false;
      return true;
    }),
  [
    actionableItems,
    actionableSubmissionOrderIds,
    delegatePricingPackagedOrderIds,
    reviewerPackagedOrderIds,
    isPackageSubmissionActionRole,
    isDelegatePricingActionRole,
    isReviewerGroupingActionRole,
  ]);

  const actionableDisplayCount =
    standaloneActionableItems.length +
    (isPackageSubmissionActionRole ? actionableSubmissionItems.length : 0) +
    (isDelegatePricingActionRole ? delegatePricingPackages.length : 0) +
    (isReviewerGroupingActionRole ? reviewerActionablePackages.length : 0);
  const actionableViewLoading =
    actionableLoading ||
    (isPackageSubmissionActionRole && actionableSubmissionsLoading) ||
    (isDelegatePricingActionRole && delegatePendingEstimateItemsLoading) ||
    (needsActionablePackageCards && actionablePackageCardsLoading);

  const canDelete = user && ["owner", "admin"].includes(user.role);
  const canFilterByUser = user && FULL_ACCESS_ROLES.includes(user.role);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);

  // جلب قائمة المستخدمين للفلتر (فقط للأدوار الكاملة الصلاحيات)
  const { data: allUsers = [] } = trpc.users.list.useQuery(undefined, {
    enabled: !!canFilterByUser,
  });

  // بناء الفلاتر المُرسلة للسيرفر
  const queryInput = {
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
    ...(canFilterByUser && requestedById !== "all" && { requestedById: Number(requestedById) }),
  };

  const { data: pos, isLoading } = trpc.purchaseOrders.list.useQuery(
    Object.keys(queryInput).length > 0 ? queryInput : undefined
  );

  const deleteMutation = trpc.purchaseOrders.delete.useMutation({
    onSuccess: () => {
      toast.success(t.common.deletedSuccessfully);
      utils.purchaseOrders.list.invalidate();
      setDeleteOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const openDelete = (po: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPO(po);
    setDeleteOpen(true);
  };

  const locale = language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US";
  const currency = t.common.currency;

  // البحث الديناميكي: رقم الطلب، اسم المنشئ، عدد الأصناف، أسماء الأصناف (مترجمة)، الحالة، الملاحظات، التاريخ
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredPos = (pos ?? []).filter((po: any) => {
    if (!normalizedSearch) return true;
    // اختر الأسماء بلغة المستخدم الحالية، وإلا ارجع للأصلية
    const localizedNames: string[] =
      language === "en" && (po.itemNames_en ?? []).length > 0 ? po.itemNames_en :
      language === "ur" && (po.itemNames_ur ?? []).length > 0 ? po.itemNames_ur :
      language === "ar" && (po.itemNames_ar ?? []).length > 0 ? po.itemNames_ar :
      (po.itemNames ?? []);
    const haystack: string[] = [
      po.poNumber,
      po.requestedByName,
      String(po.itemCount ?? ""),
      ...localizedNames,
      ...(po.itemNames ?? []), // أضف الأصلي دائماً للبحث الشامل
      getPOStatusLabel(po.status),
      po.notes,
      po.totalEstimatedCost != null ? String(po.totalEstimatedCost) : "",
      po.totalActualCost != null ? String(po.totalActualCost) : "",
      po.createdAt ? new Date(po.createdAt).toLocaleDateString(locale) : "",
    ].filter(Boolean).map(String);
    return haystack.some(field => field.toLowerCase().includes(normalizedSearch));
  });

  // إعادة التعيين للصفحة الأولى تلقائياً عند تغيّر أي فلتر أو البحث
  useEffect(() => {
    if (!didMountFilters.current) {
      didMountFilters.current = true;
      return;
    }
    setCurrentPage(1);
  }, [statusFilter, dateFrom, dateTo, requestedById, searchQuery]);

  useEffect(() => {
    writeHistoryEntryState<PurchaseOrdersHistoryState>(PURCHASE_ORDERS_HISTORY_KEY, {
      statusFilter,
      dateFrom,
      dateTo,
      requestedById,
      searchQuery,
      currentPage,
      view,
    });
  }, [statusFilter, dateFrom, dateTo, requestedById, searchQuery, currentPage, view]);

  // ── [PB] بناء البطاقات الموحّدة (2026-08-29) ──
  // القائمة تعرض نوعين من البطاقات: حزمة تضم عدة طلبات، أو طلب مفرد غير
  // مجمّع. التجميع يقع **بعد** الفلترة والبحث مباشرة، فتبقى دلالتهما كما
  // هي حرفيًا: الحزمة تظهر لو طابق أي طلب من طلباتها معايير البحث.
  // الترقيم ينتقل من مستوى الطلب لمستوى البطاقة — وهذا مقصود: البطاقة هي
  // الوحدة المعروضة للمستخدم. الطلب غير المجمّع (packageId = null، وهو حال
  // كل الطلبات القائمة) يبقى بطاقة مفردة بشكلها وسلوكها الحاليين تمامًا.
  const purchaseCards = useMemo(() => {
    const packagesMap = new Map<number, any>();
    const cards: any[] = [];
    const delegateIndividualStatuses = new Set([
      "approved",
      "partial_purchase",
      "purchased",
      "received",
      "closed",
    ]);

    for (const po of filteredPos as any[]) {
      // [PB-DELEGATE 2026-08-31] بعد اعتماد الإدارة تنتهي حاجة المندوب
      // لبطاقة الحزمة كوحدة عمل، ويعود التعامل إلى مستوى طلب الشراء ثم الصنف.
      // لذلك في "جميع الطلبات" نعرض PR منفردًا للمندوب في مراحل الشراء وما
      // بعدها، مطابقًا لسلوك "بانتظار إجرائي". أما أثناء التسعير/الحسابات/
      // الإدارة فتبقى PB مجمّعة حتى يظل الإرسال المتكرر للحسابات على مستوى
      // الحزمة كما هو، دون أي تغيير في الـWorkflow أو البيانات.
      const showAsIndividualDelegateOrder =
        user?.role === "delegate" && delegateIndividualStatuses.has(po.status);

      if (!po.packageId || showAsIndividualDelegateOrder) {
        cards.push({ cardType: "order", key: `po:${po.id}`, id: po.id, order: po });
        continue;
      }
      let pkg = packagesMap.get(po.packageId);
      if (!pkg) {
        pkg = {
          cardType: "package",
          key: `package:${po.packageId}`,
          id: po.packageId,
          packageNumber: po.packageNumber ?? `#${po.packageId}`,
          createdAt: po.createdAt,
          orders: [],
        };
        packagesMap.set(po.packageId, pkg);
        cards.push(pkg);
      }
      pkg.orders.push(po);
      // تاريخ الحزمة = أحدث طلب فيها، حتى لا تهبط لأسفل القائمة
      if (new Date(po.createdAt) > new Date(pkg.createdAt)) pkg.createdAt = po.createdAt;
    }

    return cards;
  }, [filteredPos, user?.role]);

  // ── [PB] تحديد الطلبات للتجميع ──
  // متاح فقط لأدوار المراجعة، وفقط على الطلبات بحالة pending_review غير
  // المنتمية لحزمة — نفس شرط الخادم بالضبط (purchase-packages.router.ts).
  const canGroup = user && ["owner", "admin", "maintenance_manager", "general_maintenance_manager", "construction_procurement_manager", "purchase_manager", "food_warehouse_manager"].includes(user.role);
  const [selectedForPackage, setSelectedForPackage] = useState<number[]>([]);

  const isGroupable = (po: any) => po.status === "pending_review" && !po.packageId;

  const toggleSelect = (poId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedForPackage(prev =>
      prev.includes(poId) ? prev.filter(id => id !== poId) : [...prev, poId]
    );
  };

  const createPackageMutation = trpc.purchasePackages.create.useMutation({
    onSuccess: (res) => {
      toast.success(`تم إنشاء حزمة الشراء ${res.packageNumber}`);
      setSelectedForPackage([]);
      utils.purchaseOrders.list.invalidate();
      // تحديث تمثيل «بانتظار إجرائي» فورًا بعد التجميع بدون Refresh يدوي.
      utils.purchasePackages.cards.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const totalPages = Math.max(1, Math.ceil(purchaseCards.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedCards = purchaseCards.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.purchaseOrders.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.purchaseOrders.justification}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportButton endpoint="purchase-orders" filename="purchase-orders" />
          <Button onClick={() => setLocation("/purchase-orders/new")} className="gap-2">
            <Plus className="w-4 h-4" /> {t.purchaseOrders.createNew}
          </Button>
        </div>
      </div>

      {/* ── ملخص + تبويبا العرض ─────────────────────────────────── */}
      {actionableViewLoading ? (
        <Skeleton className="h-6 w-64" />
      ) : (
        <p className="text-base font-medium">
          {actionableDisplayCount > 0
            ? (isPackageSubmissionActionRole || isReviewerGroupingActionRole)
              ? `لديك ${actionableDisplayCount} إجراء بانتظارك`
              : `لديك ${actionableDisplayCount} ${actionableDisplayCount === 1 ? "طلب بانتظار" : "طلبات بانتظار"} إجرائك`
            : "لا توجد طلبات بانتظار إجرائك حالياً"}
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button
          variant={view === "actionable" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("actionable")}
        >
          بانتظار إجرائي {actionableDisplayCount > 0 && `(${actionableDisplayCount})`}
        </Button>
        <Button
          variant={view === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("all")}
        >
          جميع الطلبات
        </Button>
      </div>

      {/* ── قائمة "بانتظار إجرائي" ────────────────────────────────── */}
      {view === "actionable" && (
        <div className="space-y-2">
          {actionableViewLoading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : actionableDisplayCount === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                لا توجد طلبات بانتظار إجرائك حالياً.
              </CardContent>
            </Card>
          ) : (
            <>
              {isReviewerGroupingActionRole && reviewerActionablePackages.map((pkg: any) => (
                <PurchaseBatchCard
                  key={`review-package:${pkg.id}`}
                  packageNumber={pkg.packageNumber}
                  createdAt={pkg.createdAt}
                  orders={pkg.actionableOrders ?? []}
                  defaultExpanded
                  locale={locale}
                  onOpenOrder={(orderId) => setLocation(`/purchase-orders/${orderId}`)}
                  actions={<Badge variant="outline">بانتظار المراجعة</Badge>}
                />
              ))}

              {isDelegatePricingActionRole && delegatePricingPackages.map((pkg: any) => {
                const remainingPricingCount = (pkg.actionableOrders ?? []).reduce(
                  (sum: number, po: any) =>
                    sum + (po.items ?? []).filter((item: any) => item.status === "pending").length,
                  0
                );
                const readyToSendCount = (pkg.actionableOrders ?? []).reduce(
                  (sum: number, po: any) =>
                    sum + (po.items ?? []).filter((item: any) => item.status === "estimated").length,
                  0
                );

                return (
                  <Card key={`delegate-package:${pkg.id}`} className="hover:shadow-sm transition-shadow border-amber-200">
                    <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Boxes className="w-4 h-4 text-amber-700" />
                          <div className="font-semibold font-mono">{pkg.packageNumber}</div>
                          <Badge variant="outline">دفعة شراء</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">دفعة شراء بانتظار إجرائك في التسعير</div>
                        <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                          <span>{pkg.actionableOrders.length} {pkg.actionableOrders.length === 1 ? "طلب" : "طلبات"}</span>
                          {remainingPricingCount > 0 && (
                            <span className="font-semibold text-amber-800">متبقي للتسعير: {remainingPricingCount} صنف</span>
                          )}
                          {readyToSendCount > 0 && (
                            <span className="font-semibold text-emerald-700">جاهز للإرسال: {readyToSendCount} صنف</span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setLocation(`/purchase-packages/${pkg.id}?action=pricing`)}
                      >
                        فتح للتسعير
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}

              {isPackageSubmissionActionRole && actionableSubmissionItems.map((sub: any) => (
                <Card key={`submission:${sub.submissionId}`} className="hover:shadow-sm transition-shadow border-primary/20">
                  <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Boxes className="w-4 h-4 text-primary" />
                        <div className="font-semibold font-mono">{sub.submissionNumber}</div>
                        <Badge variant="outline">دفعة إرسال</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">{sub.reason}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                        <span>{sub.orderCount} {sub.orderCount === 1 ? "طلب" : "طلبات"}</span>
                        {sub.poNumbers?.length > 0 && (
                          <span>{sub.poNumbers.join("، ")}</span>
                        )}
                        {Number(sub.totalEstimatedCost || 0) > 0 && (
                          <span>الإجمالي التقديري: {Number(sub.totalEstimatedCost).toLocaleString(locale)} {currency}</span>
                        )}
                        {sub.custodyBalance != null && (
                          <span>إجمالي رصيد العهد التي على المندوب: {Number(sub.custodyBalance).toLocaleString(locale)} {currency}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setLocation(`/purchase-packages/${sub.packageId}?submissionId=${sub.submissionId}`)}
                    >
                      {sub.actionLabel}
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {standaloneActionableItems.map((it: any) => (
                <Card key={`po:${it.id}`} className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-semibold">{it.poNumber}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">{it.reason}</div>
                      {it.itemsSummary && (
                        <div className="text-xs text-muted-foreground mt-1">{it.itemsSummary}</div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        const isDelegatePurchaseAction =
                          user?.role === "delegate" &&
                          ["approved", "partial_purchase"].includes(it.status);
                        setLocation(
                          `/purchase-orders/${it.id}${isDelegatePurchaseAction ? "?action=purchase" : ""}`
                        );
                      }}
                    >
                      {it.actionLabel}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── العرض الكامل (الجدول والفلاتر الحالية كما هي) ─────────── */}
      {view === "all" && (<>

      {/* خانة البحث الديناميكية */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t.common.searchPlaceholder}
          className="pr-9 max-w-md"
        />
      </div>

      {/* شريط الفلترة */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* فلتر الحالة */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t.common.status}</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder={t.common.status} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.common.all}</SelectItem>
              {Object.keys(t.poStatus).map(k => <SelectItem key={k} value={k}>{getPOStatusLabel(k)}</SelectItem>)}
              {/* ✅ فلترة إضافية على مستوى الصنف: طلبات تحتوي صنفًا واحدًا على الأقل بهذه
                  الحالة — وليست حالة للطلب نفسه، لذا بتسمية توضيحية مختلفة لتفادي اللبس */}
              <SelectItem value="purchase_cancelled">{`${t.common.contains || "يحتوي صنفًا"}: ${getPOItemStatusLabel("purchase_cancelled")}`}</SelectItem>
              <SelectItem value="needs_item_revision">{`${t.common.contains || "يحتوي صنفًا"}: ${getPOItemStatusLabel("needs_item_revision")}`}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* فلتر من تاريخ */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t.common.fromDate}</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="w-[160px]"
          />
        </div>

        {/* فلتر إلى تاريخ */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t.common.toDate}</span>
          <Input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="w-[160px]"
          />
        </div>

        {/* فلتر المنشئ — للأدوار التي يدعم الخادم تصفيتها حسب منشئ الطلب */}
        {canFilterByUser && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t.common.createdBy}</span>
            <Select value={requestedById} onValueChange={setRequestedById}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder={t.common.all} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.common.all}</SelectItem>
                {allUsers.map((u: any) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name || u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* زر مسح الفلاتر */}
        {(statusFilter !== "all" || dateFrom || dateTo || requestedById !== "all" || searchQuery) && (
          <Button
            variant="ghost"
            size="sm"
            className="self-end text-muted-foreground"
            onClick={() => {
              setStatusFilter("all");
              setDateFrom("");
              setDateTo("");
              setRequestedById("all");
              setSearchQuery("");
            }}
          >
            {t.common.clearFilters}
          </Button>
        )}
      </div>

      {/* [PB] شريط التجميع — يظهر فقط عند تحديد طلبين أو أكثر. التجميع فعل
          عرضي بحت: يربط الطلبات بحزمة واحدة دون تغيير حالة أي طلب أو صنف. */}
      {canGroup && selectedForPackage.length > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm flex items-center gap-2">
              <Boxes className="w-4 h-4 text-primary" />
              تم تحديد {selectedForPackage.length} طلب
              {selectedForPackage.length < 2 && (
                <span className="text-xs text-muted-foreground">(الحزمة تحتاج طلبين على الأقل)</span>
              )}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedForPackage([])}>
                إلغاء التحديد
              </Button>
              <Button
                size="sm"
                className="gap-2"
                disabled={selectedForPackage.length < 2 || createPackageMutation.isPending}
                onClick={() => createPackageMutation.mutate({ orderIds: selectedForPackage })}
              >
                <Boxes className="w-4 h-4" />
                تجميع في حزمة
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
      ) : !filteredPos?.length ? (
        <Card><CardContent className="p-12 text-center">
          <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">{t.purchaseOrders.noPOs}</h3>
          <p className="text-sm text-muted-foreground">{t.common.noData}</p>
        </CardContent></Card>
      ) : (
        <PurchaseCardList
          cards={paginatedCards}
          locale={locale}
          onOpenPackage={(id) => setLocation(`/purchase-packages/${id}`)}
          onOpenOrder={(id) => setLocation(`/purchase-orders/${id}`)}
          renderOrderCard={(po: any) => (
            <Card key={po.id} className="hover:shadow-lg hover:border-primary/20 transition-all duration-200 cursor-pointer" onClick={() => setLocation(`/purchase-orders/${po.id}`)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {/* [PB] مربع التحديد للتجميع — يظهر فقط لأدوار المراجعة
                          وفقط على الطلبات القابلة للتجميع. لا يغيّر شكل
                          البطاقة لبقية الأدوار أو الحالات إطلاقًا. */}
                      {canGroup && isGroupable(po) && (
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-input accent-primary cursor-pointer shrink-0"
                          checked={selectedForPackage.includes(po.id)}
                          onClick={(e) => toggleSelect(po.id, e)}
                          onChange={() => {}}
                          aria-label={`تحديد ${po.poNumber} للتجميع`}
                        />
                      )}
                      <span className="text-xs font-mono text-muted-foreground">{po.poNumber}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                      {/* منشئ الطلب */}
                      {po.requestedByName && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {po.requestedByName}
                        </span>
                      )}
                      {/* عدد الأصناف */}
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {(po as any).itemCount ?? 0} {t.purchaseOrders.items}
                      </span>
                      {po.totalEstimatedCost && <span>{t.purchaseOrders.totalEstimated}: {Number(po.totalEstimatedCost).toLocaleString(locale)} {currency}</span>}
                      {po.totalActualCost && <span>{t.purchaseOrders.totalActual}: {Number(po.totalActualCost).toLocaleString(locale)} {currency}</span>}
                      <span className="flex items-center gap-1 flex-wrap">
                        {new Date(po.createdAt).toLocaleDateString(locale)}
                        {(() => {
                          const breakdown = ((po as any).delegateBreakdown ?? []) as { delegateId: number; total: number; purchased: number }[];
                          if (breakdown.length === 0) return null;

                          const renderStats = (total: number, purchased: number) => {
                            const remaining = total - purchased;
                            const pct = total > 0 ? Math.round((purchased / total) * 100) : 0;
                            const stateEmoji = purchased === 0 ? "🔴" : remaining === 0 ? "🟢" : "🟡";
                            const stateText = purchased === 0 ? "لم يبدأ" : remaining === 0 ? "مكتمل" : "جاري";
                            return `المطلوب شراؤه: ${total}   تم الشراء: ${purchased}   المتبقي: ${remaining}   الحالة: ${stateEmoji} ${stateText} (${pct}%)`;
                          };

                          // الأدمن/مدير الصيانة/الإدارة العليا: يشوفون تفصيل كل مندوب على حدة (سطر منفصل لكل واحد)
                          const canSeeAllDelegates = ["admin", "owner", "maintenance_manager", "general_maintenance_manager", "construction_procurement_manager", "senior_management"].includes(user?.role || "");
                          if (canSeeAllDelegates && breakdown.length > 1) {
                            return (
                              <span className="block w-full text-amber-700 mt-1 space-y-0.5">
                                {breakdown.map(d => {
                                  const delegateUser = allUsers.find((u: any) => u.id === d.delegateId);
                                  return (
                                    <span key={d.delegateId} className="block">
                                      👤 {delegateUser?.name || `مندوب #${d.delegateId}`}: {renderStats(d.total, d.purchased)}
                                    </span>
                                  );
                                })}
                              </span>
                            );
                          }

                          // بقية الأدوار (بما فيهم المندوب نفسه): يشوفون فقط ما يخصهم هم
                          const myEntry = user ? breakdown.find(d => d.delegateId === user.id) : undefined;
                          if (!myEntry) return null;
                          return <span className="text-amber-700"> - {renderStats(myEntry.total, myEntry.purchased)}</span>;
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canDelete && !["funded", "partially_purchased", "completed"].includes(po.status) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => openDelete(po, e)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Badge className={`status-badge ${PO_STATUS_COLORS[po.status] || "bg-gray-100 text-gray-700"}`}>
                      {getPOStatusLabel(po.status)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        />
      )}

      {/* شريط التنقل بين الصفحات */}
      {!isLoading && purchaseCards.length > PAGE_SIZE && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-muted-foreground">
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, purchaseCards.length)} {t.common.of || "من"} {purchaseCards.length} {t.common.results || "نتيجة"}
          </p>
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }}
                  className={safePage === 1 ? "pointer-events-none opacity-40" : ""}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .map((p, idx, arr) => (
                  <Fragment key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <PaginationItem><span className="px-2 text-muted-foreground">…</span></PaginationItem>
                    )}
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        isActive={p === safePage}
                        onClick={(e) => { e.preventDefault(); setCurrentPage(p); }}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  </Fragment>
                ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }}
                  className={safePage === totalPages ? "pointer-events-none opacity-40" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      </>)}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">{t.common.confirmDelete}</DialogTitle>
            <DialogDescription>
              {t.common.deleteWarning} <strong>{selectedPO?.poNumber}</strong>? {t.common.cannotUndo}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate({ id: selectedPO.id })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? t.common.deleting : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
