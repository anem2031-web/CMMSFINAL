import { useState, useMemo } from "react";
import { useTranslatedField, getLocalizedName } from "@/hooks/useTranslatedField";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { APP_ROLE, MAINTENANCE_RESPONSIBLE_DEPARTMENT } from "@shared/roles";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { SLATimer } from "@/components/tickets/SLATimer";
import { TechnicianCombobox } from "@/components/tickets/TechnicianCombobox";
import {
  ClipboardList, AlertTriangle, Eye, CheckCircle2,
  Zap, Search, ArrowRight, Clock, Microscope, Filter,
  X, MapPin, Tag, ChevronDown
} from "lucide-react";
import { localizeApiError } from "@/i18n/apiError";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  electrical: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  plumbing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  hvac: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  structural: "bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-300",
  mechanical: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  general: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  safety: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cleaning: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  it: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveView = "all_pending" | "all_inspection" | "critical_pending";

// ─── Component ────────────────────────────────────────────────────────────────

export default function TriageDashboard() {
  const { getField } = useTranslatedField();
  const { t, language, dir } = useLanguage();
  const priorityLabels: Record<string, string> = {
    low: t.priority.low, medium: t.priority.medium, high: t.priority.high, critical: t.priority.critical,
  };
  const categoryLabels: Record<string, string> = {
    electrical: `⚡ ${t.category.electrical}`,
    plumbing: `🔧 ${t.category.plumbing}`,
    hvac: `❄️ ${t.category.hvac}`,
    structural: `🏗️ ${t.category.structural}`,
    mechanical: `⚙️ ${t.category.mechanical}`,
    general: `📋 ${t.category.general}`,
    safety: `🦺 ${t.category.safety}`,
    cleaning: `🧹 ${t.category.cleaning}`,
    it: `💻 ${t.category.it}`,
  };
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: pendingTickets = [], isLoading: loadingPending } =
    trpc.tickets.list.useQuery({ status: "pending_triage" });

  const { data: inspectionTicketsRaw = [], isLoading: loadingInspection } =
    trpc.tickets.list.useQuery({ status: "under_inspection" });

  const { data: users = [] } = trpc.users.list.useQuery();
  // Inspection assignment requires a system user account so the technician can record the result.
  const { data: userTechniciansList = [] } = trpc.users.listTechnicians.useQuery();
  const { data: sites = [] } = trpc.sites.list.useQuery();

  // ── Active view (card click) ──────────────────────────────────────────────
  const [activeView, setActiveView] = useState<ActiveView>("all_pending");

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [filterSiteId, setFilterSiteId] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const hasActiveFilters = searchText || filterSiteId !== "all" || filterCategory !== "all" || filterPriority !== "all";

  const clearFilters = () => {
    setSearchText("");
    setFilterSiteId("all");
    setFilterCategory("all");
    setFilterPriority("all");
  };

  // ── Dialogs ───────────────────────────────────────────────────────────────
  const [triageDialog, setTriageDialog] = useState<any>(null);
  const [triageForm, setTriageForm] = useState({
    ticketType: "internal" as "internal" | "external" | "procurement",
    priority: "",
    triageNotes: "",
    assignedToId: "",
    maintenanceResponsibleDepartment: "",
    maintenanceResponsibleManagerId: "",
  });

  // ── الفرز المتعدد الجهات (2026-08-08) ─────────────────────────────────────
  // الهيكل الجديد هو الافتراضي والإلزامي بالواجهة: جهة واحدة أو أكثر ثم المهام.
  // يبقى مسار single القديم بالكود للتوافق الرجعي فقط ولا تعرضه الواجهة الجديدة.
  const [triageMode, setTriageMode] = useState<"single" | "multi">("multi");
  const [multiAssignments, setMultiAssignments] = useState<Record<string, { selected: boolean; managerId: string; organizationalTitle: string }>>({});

  const emptyMultiAssignments = () => ({
    [MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL]: { selected: false, managerId: "", organizationalTitle: "" },
    [MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION]: { selected: false, managerId: "", organizationalTitle: "" },
  });

  const updateAssignment = (dept: string, patch: Partial<{ selected: boolean; managerId: string; organizationalTitle: string }>) =>
    setMultiAssignments(prev => ({ ...prev, [dept]: { ...prev[dept], ...patch } }));


  // ── Quick Triage Dialog ───────────────────────────────────────────────────
  const [quickTriageDialog, setQuickTriageDialog] = useState<any>(null);
  const [quickTriageAssignedTo, setQuickTriageAssignedTo] = useState<string>("");
  const [quickTriageDepartment, setQuickTriageDepartment] = useState<string>("");
  const [quickTriageManagerId, setQuickTriageManagerId] = useState<string>("");

  // ── Mutations ─────────────────────────────────────────────────────────────
  const quickTriageMut = trpc.tickets.triageTicket.useMutation({
    onSuccess: () => {
      toast.success(t.triage.movedToInspection);
      utils.tickets.list.invalidate();
    },
    onError: (e: any) => toast.error(localizeApiError(e.message)),
  });

  const triageMut = trpc.tickets.triage.useMutation({
    onSuccess: () => {
      toast.success(t.triage.sortedSuccess);
      utils.tickets.list.invalidate();
      setTriageDialog(null);
    },
    onError: (e: any) => toast.error(localizeApiError(e.message)),
  });

  // الفرز المتعدد الجهات (2026-08-08) — إجراء مستقل، لا يمس triage العادي.
  const triageMultiMut = trpc.tickets.triageMulti.useMutation({
    onSuccess: (res: any) => {
      toast.success(t.workflow.ticket.multiDepartmentsApproved.replace("{count}", String(res?.departmentsCreated ?? 0)));
      utils.tickets.list.invalidate();
      setTriageDialog(null);
    },
    onError: (e: any) => toast.error(localizeApiError(e.message)),
  });


  // ── Derived data ──────────────────────────────────────────────────────────
  // Only active technician users are eligible for direct inspection assignment.
  const technicians = userTechniciansList.length > 0
    ? userTechniciansList.map((u: any) => ({ ...u, id: u.id, name: u.name || u.email, role: u.role, specialty: u.specialty }))
    : users.filter((u: any) => u.role === APP_ROLE.TECHNICIAN && u.isActive !== 0);

  const constructionManagers = users.filter((u: any) => u.role === APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER && u.isActive !== 0);
  const generalManagers = users.filter((u: any) =>
    [APP_ROLE.GENERAL_MAINTENANCE_MANAGER, APP_ROLE.MAINTENANCE_MANAGER].includes(u.role as any) && u.isActive !== 0
  );
  const inspectionTickets = inspectionTicketsRaw.filter((ticket: any) =>
    ticket.maintenanceResponsibleDepartment !== MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION
  );
  const managersForDepartment = (department: string) =>
    department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION ? constructionManagers : generalManagers;

  const criticalPending = useMemo(
    () => pendingTickets.filter((t: any) => t.priority === "critical"),
    [pendingTickets]
  );

  // Determine base list from active view
  const baseTickets = useMemo(() => {
    if (activeView === "all_pending") return pendingTickets;
    if (activeView === "all_inspection") return inspectionTickets;
    if (activeView === "critical_pending") return criticalPending;
    return pendingTickets;
  }, [activeView, pendingTickets, inspectionTickets, criticalPending]);

  // Apply local filters
  const filteredTickets = useMemo(() => {
    return baseTickets.filter((ticket: any) => {
      if (searchText && !ticket.title?.toLowerCase().includes(searchText.toLowerCase()) &&
          !ticket.ticketNumber?.toLowerCase().includes(searchText.toLowerCase())) return false;
      if (filterSiteId !== "all" && ticket.siteId !== parseInt(filterSiteId)) return false;
      if (filterCategory !== "all" && ticket.category !== filterCategory) return false;
      if (filterPriority !== "all" && ticket.priority !== filterPriority) return false;
      return true;
    });
  }, [baseTickets, searchText, filterSiteId, filterCategory, filterPriority]);

  const isLoading = activeView === "all_inspection" ? loadingInspection : loadingPending;
  const isInspectionView = activeView === "all_inspection";

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFullTriage = () => {
    if (!triageDialog) return;
    if (
      triageForm.maintenanceResponsibleDepartment === MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL &&
      !triageForm.assignedToId
    ) {
      toast.error(t.workflow.ticket.generalTechnicianRequired);
      return;
    }
    triageMut.mutate({
      id: triageDialog.id,
      ticketType: triageForm.ticketType,
      priority: triageForm.priority || undefined,
      triageNotes: triageForm.triageNotes || undefined,
      assignedToId: triageForm.maintenanceResponsibleDepartment === MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL && triageForm.assignedToId
        ? parseInt(triageForm.assignedToId)
        : undefined,
      maintenanceResponsibleDepartment: triageForm.maintenanceResponsibleDepartment as any,
      maintenanceResponsibleManagerId: triageForm.maintenanceResponsibleManagerId
        ? parseInt(triageForm.maintenanceResponsibleManagerId)
        : managersForDepartment(triageForm.maintenanceResponsibleDepartment).length === 1
          ? managersForDepartment(triageForm.maintenanceResponsibleDepartment)[0].id
          : undefined,
    });
  };

  // الفرز المتعدد الجهات (2026-08-08)
  const selectedDepartments = Object.entries(multiAssignments).filter(([, v]) => v?.selected);

  // معمَّمة لتخدم كلتا النافذتين (الفرز السريع والفرز الكامل) بلا تكرار منطق —
  // 2026-08-08، بعد أن أصبح خيار الفرز المتعدد متاحًا من نافذة الفرز السريع أيضًا.
  const handleMultiTriageFor = (ticket: any, onDone?: () => void) => {
    if (!ticket) return;
    if (selectedDepartments.length === 0) {
      toast.error(t.workflow.ticket.chooseOneDepartment);
      return;
    }
    for (const [dept, v] of selectedDepartments) {
      const mgrs = managersForDepartment(dept);
      if (mgrs.length === 0) {
        toast.error(t.workflow.ticket.noActiveDepartmentManager);
        return;
      }
      if (mgrs.length > 1 && !v.managerId) {
        toast.error(t.workflow.ticket.chooseEveryDepartmentManager);
        return;
      }
      if (dept === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION && !v.organizationalTitle.trim()) {
        toast.error(t.workflow.ticket.constructionTitleValidation);
        return;
      }
    }
    triageMultiMut.mutate({
      id: ticket.id,
      ticketType: triageForm.ticketType,
      priority: triageForm.priority || undefined,
      triageNotes: triageForm.triageNotes || undefined,
      assignments: selectedDepartments.map(([dept, v]) => {
        const mgrs = managersForDepartment(dept);
        return {
          department: dept as any,
          responsibleManagerId: v.managerId
            ? parseInt(v.managerId)
            : mgrs.length === 1 ? mgrs[0].id : undefined,
          organizationalTitle: dept === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION ? v.organizationalTitle.trim() : undefined,
        };
      }),
    }, { onSuccess: onDone });
  };

  // مستخدَمة حاليًا من نافذة الفرز الكامل فقط (معطَّلة الظهور — راجع الملاحظة أدناه).
  const handleMultiTriage = () => handleMultiTriageFor(triageDialog, () => setTriageDialog(null));

  const openTriageDialog = (ticket: any) => {
    setTriageMode("multi");
    setMultiAssignments(emptyMultiAssignments());
    setTriageForm({
      ticketType: "internal",
      priority: ticket.priority || "medium",
      triageNotes: "",
      assignedToId: ticket.assignedToId?.toString() || "",
      maintenanceResponsibleDepartment: "",
      maintenanceResponsibleManagerId: "",
    });
    setTriageDialog(ticket);
  };


  // ── Stat cards config ─────────────────────────────────────────────────────
  const statCards = [
    {
      id: "all_pending" as ActiveView,
      label: t.triage.awaitingSort,
      count: pendingTickets.length,
      icon: AlertTriangle,
      color: "purple",
      border: "border-purple-200",
      bg: "bg-purple-50/50 dark:bg-purple-900/10",
      countColor: "text-purple-700 dark:text-purple-300",
      iconColor: "text-purple-400",
      activeBorder: "border-purple-500",
      activeBg: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      id: "all_inspection" as ActiveView,
      label: t.triage.awaitingInspection,
      count: inspectionTickets.length,
      icon: Microscope,
      color: "blue",
      border: "border-blue-200",
      bg: "bg-blue-50/50 dark:bg-blue-900/10",
      countColor: "text-blue-700 dark:text-blue-300",
      iconColor: "text-blue-400",
      activeBorder: "border-blue-500",
      activeBg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      id: "critical_pending" as ActiveView,
      label: t.triage.awaitingApproval,
      count: criticalPending.length,
      icon: AlertTriangle,
      color: "orange",
      border: "border-orange-200",
      bg: "bg-orange-50/50 dark:bg-orange-900/10",
      countColor: "text-orange-700 dark:text-orange-300",
      iconColor: "text-orange-400",
      activeBorder: "border-orange-500",
      activeBg: "bg-orange-50 dark:bg-orange-900/20",
    },
  ];

  const canAccessTriage = !!user && [
    APP_ROLE.MAINTENANCE_MANAGER,
    APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
    APP_ROLE.OWNER,
    APP_ROLE.ADMIN,
  ].includes(user.role as any);

  if (!canAccessTriage) {
    return (
      <Card className="max-w-xl mx-auto mt-10">
        <CardContent className="p-8 text-center space-y-2">
          <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
          <h2 className="font-semibold text-lg">{t.workflow.ticket.noTriagePermission}</h2>
          <p className="text-sm text-muted-foreground">{t.workflow.ticket.triagePermissionHint}</p>
        </CardContent>
      </Card>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.triage.title}</h1>
          <p className="text-sm text-muted-foreground">{t.triage.subtitle}</p>
        </div>
      </div>

      {/* ── Stat Cards (clickable) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const isActive = activeView === card.id;
          return (
            <button
              key={card.id}
              onClick={() => setActiveView(card.id)}
              className={`text-start w-full rounded-xl border-2 p-4 transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-400 ${
                isActive
                  ? `${card.activeBorder} ${card.activeBg} shadow-md`
                  : `${card.border} ${card.bg} hover:${card.activeBg}`
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-start">
                  <p className="text-sm text-muted-foreground font-medium">{card.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${card.countColor}`}>{card.count}</p>
                  {isActive && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {filteredTickets.length !== baseTickets.length
                        ? t.workflow.ticket.resultCountFiltered.replace("{shown}", String(filteredTickets.length)).replace("{total}", String(card.count))
                        : t.workflow.ticket.clickToView}
                    </p>
                  )}
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isActive ? `bg-white/60 dark:bg-black/20` : `bg-white/40 dark:bg-black/10`
                }`}>
                  <Icon className={`w-6 h-6 ${card.iconColor}`} />
                </div>
              </div>
              {isActive && (
                <div className={`mt-3 h-1 rounded-full bg-gradient-to-r ${
                  card.color === "purple" ? "from-purple-400 to-purple-600" :
                  card.color === "blue" ? "from-blue-400 to-blue-600" :
                  "from-orange-400 to-orange-600"
                }`} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Filter Bar ── */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${dir === "rtl" ? "right-3" : "left-3"}`} />
            <Input
              placeholder={t.workflow.ticket.searchTicketPlaceholder}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className={dir === "rtl" ? "pr-9" : "pl-9"}
            />
          </div>

          {/* Toggle filters */}
          <CollapsibleTrigger asChild>
            <Button variant="outline" className={`gap-2 shrink-0 ${hasActiveFilters ? "border-purple-400 text-purple-700 bg-purple-50 dark:bg-purple-900/20" : ""}`}>
              <Filter className="w-4 h-4" />
              {t.workflow.ticket.advancedFilters}
              {hasActiveFilters && (
                <Badge className="bg-purple-600 text-white text-xs px-1.5 py-0 h-4">
                  {[filterSiteId !== "all", filterCategory !== "all", filterPriority !== "all"].filter(Boolean).length}
                </Badge>
              )}
              <ChevronDown className={`w-4 h-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="icon" onClick={clearFilters} title={t.workflow.ticket.clearFilters}>
              <X className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
        </div>

        <CollapsibleContent>
          <div className="mt-3 p-4 rounded-xl border bg-muted/30 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Site filter */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <MapPin className="w-3.5 h-3.5" />
                {t.workflow.ticket.siteLabel}
              </Label>
              <Select value={filterSiteId} onValueChange={setFilterSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder={t.workflow.ticket.allSites} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🌐 {t.workflow.ticket.allSites}</SelectItem>
                  {(sites as any[]).map((site: any) => (
                    <SelectItem key={site.id} value={site.id.toString()}>
                      📍 {getLocalizedName(site, language)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category filter */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Tag className="w-3.5 h-3.5" />
                {t.workflow.ticket.categoryLabel}
              </Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue placeholder={t.workflow.ticket.allCategories} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">📋 {t.workflow.ticket.allCategories}</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority filter */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <AlertTriangle className="w-3.5 h-3.5" />
                {t.workflow.ticket.priorityLabel}
              </Label>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger>
                  <SelectValue placeholder={t.workflow.ticket.allPriorities} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🔘 {t.workflow.ticket.allPriorities}</SelectItem>
                  <SelectItem value="critical">🔴 {t.priority.critical}</SelectItem>
                  <SelectItem value="high">🟠 {t.priority.high}</SelectItem>
                  <SelectItem value="medium">🟡 {t.priority.medium}</SelectItem>
                  <SelectItem value="low">🟢 {t.priority.low}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ── Section title ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">
                      {activeView === "all_pending" && t.triage.awaitingSort}
                      {activeView === "all_inspection" && t.triage.awaitingInspection}
                      {activeView === "critical_pending" && t.triage.awaitingApproval}
          </h2>
          <Badge variant="secondary" className="font-mono">
            {filteredTickets.length}
            {filteredTickets.length !== baseTickets.length && ` / ${baseTickets.length}`}
          </Badge>
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            {t.workflow.ticket.clearFilters}
          </button>
        )}
      </div>

      {/* ── Tickets List ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto mb-4" />
            <p className="text-base font-medium text-muted-foreground">
              {hasActiveFilters ? t.workflow.ticket.noFilterResults :
               activeView === "all_pending" ? t.workflow.ticket.noPendingTriage :
               activeView === "all_inspection" ? t.workflow.ticket.noInspectionTickets :
               t.workflow.ticket.noCriticalPending}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                {t.workflow.ticket.clearFilters}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket: any) => (
            <Card
              key={ticket.id}
              className={`hover:shadow-md transition-all duration-200 border-l-4 ${
                isInspectionView ? "border-l-blue-400" :
                ticket.priority === "critical" ? "border-l-red-500" :
                ticket.priority === "high" ? "border-l-orange-400" :
                "border-l-purple-400"
              }`}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">

                  {/* ── Ticket Info ── */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {ticket.ticketNumber}
                      </span>
                      <Badge className={`text-xs ${PRIORITY_COLORS[ticket.priority] || "bg-gray-100 text-gray-700"}`}>
                        {priorityLabels[ticket.priority] || ticket.priority}
                      </Badge>
                      {ticket.category && (
                        <Badge className={`text-xs ${CATEGORY_BADGE_COLORS[ticket.category] || "bg-gray-100 text-gray-700"}`}>
                          {categoryLabels[ticket.category] || ticket.category}
                        </Badge>
                      )}
                    </div>

                    <h3 className="font-semibold text-base leading-snug">{getField(ticket, "title")}</h3>

                    {ticket.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{getField(ticket, "description")}</p>
                    )}

                    <div className="flex items-center gap-4 mt-2.5 text-xs text-muted-foreground flex-wrap">
                      <SLATimer
                        createdAt={ticket.createdAt}
                        statusChangedAt={ticket.updatedAt}
                        statusLabel={isInspectionView ? t.triage.awaitingInspection : t.triage.awaitingSort}
                        compact
                      />
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(ticket.createdAt).toLocaleString(language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US")}
                      </span>
                      {ticket.siteName && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {ticket.siteName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Actions ── */}
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.location.href = `/tickets/${ticket.id}`}
                    >
                      <Eye className="w-4 h-4 ml-1" />
                      {t.triage.viewDetails}
                    </Button>

                    {/* PENDING_TRIAGE actions */}
                    {!isInspectionView && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          onClick={() => {
                            setQuickTriageDialog(ticket);
                            setQuickTriageAssignedTo("");
                            setQuickTriageDepartment("");
                            setQuickTriageManagerId("");
                            setTriageMode("multi");
                            setMultiAssignments(emptyMultiAssignments());
                          }}
                          title={t.workflow.ticket.quickMoveInspection}
                        >
                          <Zap className="w-4 h-4 ml-1" />
                          {t.triage.sortTicket}
                        </Button>
                        {/* الزر الثالث (الفرز الكامل) مُعطَّل الظهور بطلب صريح 2026-08-08 — الكود محفوظ
                            بلا حذف (النافذة نفسها لا تزال موجودة أدناه وتعمل، فقط بلا زر يفتحها من هنا).
                            لإعادة تفعيله لاحقًا: أزل التعليق عن الكتلة التالية.
                        <Button
                          size="sm"
                          onClick={() => openTriageDialog(ticket)}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          <ClipboardList className="w-4 h-4 ml-1" />
                          {t.triage.sortTicket}
                        </Button>
                        */}
                      </>
                    )}

                    {/* UNDER_INSPECTION action */}
                    {isInspectionView && (
                      <Button
                        size="sm"
                        onClick={() => { window.location.href = `/tickets/${ticket.id}`; }}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Search className="w-4 h-4 ml-1" />
                        {t.workflow.ticket.openInspectionForm}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Quick Triage Dialog ── */}
      <Dialog open={!!quickTriageDialog} onOpenChange={() => setQuickTriageDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              {t.workflow.ticket.quickTriage}
            </DialogTitle>
          </DialogHeader>
          {quickTriageDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium text-sm">{quickTriageDialog.ticketNumber}</p>
                <p className="text-sm text-muted-foreground">{quickTriageDialog.title}</p>
              </div>

              {/* الهيكل الجديد إلزامي للبلاغات الجديدة: جهة واحدة أو أكثر ثم المهام. */}
              <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/20 p-3">
                <p className="text-sm font-medium">{t.workflow.ticket.multiTriageTitle}</p>
                <p className="text-xs text-muted-foreground mt-1">{t.workflow.ticket.multiTriageHelp}</p>
              </div>

              {triageMode === "single" && (
              <div className="space-y-2">
                <Label>{t.workflow.ticket.responsibleDepartmentRequired}</Label>
                <Select value={quickTriageDepartment} onValueChange={(value) => {
                  setQuickTriageDepartment(value);
                  setQuickTriageAssignedTo("");
                  setQuickTriageManagerId("");
                }}>
                  <SelectTrigger><SelectValue placeholder={t.workflow.ticket.chooseResponsibleDepartment} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL}>{t.workflow.ticket.departmentGeneral}</SelectItem>
                    <SelectItem value={MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION}>{t.workflow.ticket.departmentConstruction}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              )}
              {triageMode === "single" && managersForDepartment(quickTriageDepartment).length > 1 && (
                <div className="space-y-2">
                  <Label>{t.workflow.ticket.receivingManagerRequired}</Label>
                  <Select value={quickTriageManagerId} onValueChange={setQuickTriageManagerId}>
                    <SelectTrigger><SelectValue placeholder={t.workflow.ticket.chooseManager} /></SelectTrigger>
                    <SelectContent>
                      {managersForDepartment(quickTriageDepartment).map((manager: any) => (
                        <SelectItem key={manager.id} value={String(manager.id)}>{manager.name || manager.username}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {triageMode === "single" && quickTriageDepartment === MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL && (
                <div className="space-y-2">
                  <Label>{t.workflow.ticket.assignedTechnicianRequired}</Label>
                  <TechnicianCombobox
                    value={quickTriageAssignedTo}
                    onValueChange={setQuickTriageAssignedTo}
                    placeholder={t.workflow.ticket.chooseInspectionTechnician}
                    options={technicians.map((tech: any) => ({ value: tech.id.toString(), label: tech.name }))}
                  />
                </div>
              )}
              {triageMode === "single" && (
              <p className="text-xs text-muted-foreground">
                {quickTriageDepartment === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION
                  ? t.workflow.ticket.constructionWillChooseTech
                  : t.workflow.ticket.generalRouteHint}
              </p>
              )}

              {/* الفرز المتعدد الجهات — 2026-08-08. نفس بنية نافذة الفرز الكامل حرفيًا. */}
              {triageMode === "multi" && (
                <div className="space-y-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 p-3">
                  <p className="text-xs text-muted-foreground">
                    {t.workflow.ticket.triageDepartmentsHelp}
                  </p>
                  {[
                    { key: MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL, label: t.workflow.ticket.departmentGeneral },
                    { key: MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION, label: t.workflow.ticket.departmentConstruction },
                  ].map(({ key, label }) => {
                    const a = multiAssignments[key] || { selected: false, managerId: "", organizationalTitle: "" };
                    const mgrs = managersForDepartment(key);
                    return (
                      <div key={key} className="rounded-md border bg-background p-3 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={a.selected}
                            onChange={(e) => updateAssignment(key, { selected: e.target.checked })}
                            className="w-4 h-4 accent-purple-600"
                          />
                          <span className="text-sm font-medium">{label}</span>
                        </label>

                        {a.selected && (
                          <div className="space-y-2 pt-1">
                            {mgrs.length > 1 ? (
                              <>
                                <Label className="text-xs">{t.workflow.ticket.departmentManagerRequired}</Label>
                                <Select value={a.managerId} onValueChange={(v) => updateAssignment(key, { managerId: v })}>
                                  <SelectTrigger><SelectValue placeholder={t.workflow.ticket.chooseManager} /></SelectTrigger>
                                  <SelectContent>
                                    {mgrs.map((m: any) => (
                                      <SelectItem key={m.id} value={String(m.id)}>{m.name || m.username}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </>
                            ) : mgrs.length === 1 ? (
                              <p className="text-xs text-muted-foreground">{t.workflow.ticket.departmentManagerColon} {mgrs[0].name || mgrs[0].username}</p>
                            ) : null}
                            {key === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION && (
                              <div className="space-y-1">
                                <Label className="text-xs">{t.workflow.ticket.constructionTitleRequired}</Label>
                                <Input
                                  value={a.organizationalTitle}
                                  maxLength={300}
                                  onChange={(e) => updateAssignment(key, { organizationalTitle: e.target.value })}
                                  placeholder={t.workflow.ticket.constructionTitlePlaceholder}
                                />
                                <p className="text-[11px] text-muted-foreground">{t.workflow.ticket.constructionTitleOnly}</p>
                              </div>
                            )}
                            <p className="text-[11px] text-muted-foreground">{t.workflow.ticket.tasksAssignedLater}</p>

                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickTriageDialog(null)}>{t.workflow.ticket.cancel}</Button>
            <Button
              onClick={() => {
                if (!quickTriageDialog) return;
                if (triageMode === "multi") {
                  handleMultiTriageFor(quickTriageDialog, () => setQuickTriageDialog(null));
                  return;
                }
                const assignedToId = quickTriageAssignedTo
                  ? parseInt(quickTriageAssignedTo)
                  : undefined;
                const departmentManagers = managersForDepartment(quickTriageDepartment);
                quickTriageMut.mutate({
                  id: quickTriageDialog.id,
                  assignedToId: quickTriageDepartment === MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL ? assignedToId : undefined,
                  maintenanceResponsibleDepartment: quickTriageDepartment as any,
                  maintenanceResponsibleManagerId: quickTriageManagerId
                    ? parseInt(quickTriageManagerId)
                    : departmentManagers.length === 1 ? departmentManagers[0].id : undefined,
                });
                setQuickTriageDialog(null);
              }}
              disabled={
                triageMode === "multi"
                  ? (triageMultiMut.isPending || selectedDepartments.length === 0)
                  : (
                    quickTriageMut.isPending ||
                    !quickTriageDepartment ||
                    managersForDepartment(quickTriageDepartment).length === 0 ||
                    (managersForDepartment(quickTriageDepartment).length > 1 && !quickTriageManagerId) ||
                    (quickTriageDepartment === MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL && !quickTriageAssignedTo)
                  )
              }
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Zap className="w-4 h-4 ml-1" />
              {(triageMode === "multi" ? triageMultiMut.isPending : quickTriageMut.isPending)
                ? t.workflow.ticket.working
                : triageMode === "multi" ? t.workflow.ticket.confirmMultiTriageCount.replace("{count}", String(selectedDepartments.length)) : t.workflow.ticket.confirmTriage}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Full Triage Dialog (معطَّل الظهور — 2026-08-08، الكود محفوظ للاستخدام المستقبلي) ── */}
      {/* راجع docs/CHANGELOG_TECHNICAL.md لسبب التعطيل. لإعادة تفعيله: أعد زر "فرز وتصنيف البلاغ"
          (البنفسجي) ببطاقة البلاغ الذي كان يستدعي openTriageDialog. */}
      <Dialog open={!!triageDialog} onOpenChange={() => setTriageDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-purple-600" />
              {t.workflow.ticket.triageAndClassify}
            </DialogTitle>
          </DialogHeader>
          {triageDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium text-sm">{triageDialog.ticketNumber}</p>
                <p className="text-sm text-muted-foreground">{triageDialog.title}</p>
              </div>

              {/* الهيكل الجديد إلزامي للبلاغات الجديدة: جهة واحدة أو أكثر ثم المهام. */}
              <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/20 p-3">
                <p className="text-sm font-medium">{t.workflow.ticket.multiTriageTitle}</p>
                <p className="text-xs text-muted-foreground mt-1">{t.workflow.ticket.multiTriageHelp}</p>
              </div>

              <div className="space-y-2">
                <Label>{t.workflow.ticket.ticketTypeRequired}</Label>
                <Select
                  value={triageForm.ticketType}
                  onValueChange={(v: any) => setTriageForm(f => ({ ...f, ticketType: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">{t.workflow.ticket.ticketTypeInternal}</SelectItem>
                    <SelectItem value="external">{t.workflow.ticket.ticketTypeExternal}</SelectItem>
                    <SelectItem value="procurement">{t.workflow.ticket.ticketTypeProcurement}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t.workflow.ticket.priorityLabel}</Label>
                <Select
                  value={triageForm.priority}
                  onValueChange={(v) => setTriageForm(f => ({ ...f, priority: v }))}
                >
                  <SelectTrigger><SelectValue placeholder={t.workflow.ticket.choosePriority} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">🟢 {t.priority.low}</SelectItem>
                    <SelectItem value="medium">🟡 {t.priority.medium}</SelectItem>
                    <SelectItem value="high">🟠 {t.priority.high}</SelectItem>
                    <SelectItem value="critical">🔴 {t.priority.critical}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {triageMode === "single" && (
              <div className="space-y-2">
                <Label>{t.workflow.ticket.responsibleDepartmentRequired}</Label>
                <Select
                  value={triageForm.maintenanceResponsibleDepartment}
                  onValueChange={(value) => setTriageForm(f => ({
                    ...f,
                    maintenanceResponsibleDepartment: value,
                    maintenanceResponsibleManagerId: "",
                    assignedToId: "",
                  }))}
                >
                  <SelectTrigger><SelectValue placeholder={t.workflow.ticket.chooseResponsibleDepartment} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL}>{t.workflow.ticket.departmentGeneral}</SelectItem>
                    <SelectItem value={MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION}>{t.workflow.ticket.departmentConstruction}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              )}

              {/* الفرز المتعدد الجهات — 2026-08-08 */}
              {triageMode === "multi" && (
                <div className="space-y-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 p-3">
                  <p className="text-xs text-muted-foreground">
                    {t.workflow.ticket.triageDepartmentsHelp}
                  </p>
                  {[
                    { key: MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL, label: t.workflow.ticket.departmentGeneral },
                    { key: MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION, label: t.workflow.ticket.departmentConstruction },
                  ].map(({ key, label }) => {
                    const a = multiAssignments[key] || { selected: false, managerId: "", organizationalTitle: "" };
                    const mgrs = managersForDepartment(key);
                    return (
                      <div key={key} className="rounded-md border bg-background p-3 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={a.selected}
                            onChange={(e) => updateAssignment(key, { selected: e.target.checked })}
                            className="w-4 h-4 accent-purple-600"
                          />
                          <span className="text-sm font-medium">{label}</span>
                        </label>

                        {a.selected && (
                          <div className="space-y-2 pt-1">
                            {mgrs.length > 1 ? (
                              <>
                                <Label className="text-xs">{t.workflow.ticket.departmentManagerRequired}</Label>
                                <Select value={a.managerId} onValueChange={(v) => updateAssignment(key, { managerId: v })}>
                                  <SelectTrigger><SelectValue placeholder={t.workflow.ticket.chooseManager} /></SelectTrigger>
                                  <SelectContent>
                                    {mgrs.map((m: any) => (
                                      <SelectItem key={m.id} value={String(m.id)}>{m.name || m.username}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </>
                            ) : mgrs.length === 1 ? (
                              <p className="text-xs text-muted-foreground">{t.workflow.ticket.departmentManagerColon} {mgrs[0].name || mgrs[0].username}</p>
                            ) : null}
                            {key === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION && (
                              <div className="space-y-1">
                                <Label className="text-xs">{t.workflow.ticket.constructionTitleRequired}</Label>
                                <Input
                                  value={a.organizationalTitle}
                                  maxLength={300}
                                  onChange={(e) => updateAssignment(key, { organizationalTitle: e.target.value })}
                                  placeholder={t.workflow.ticket.constructionTitlePlaceholder}
                                />
                                <p className="text-[11px] text-muted-foreground">{t.workflow.ticket.constructionTitleOnly}</p>
                              </div>
                            )}
                            <p className="text-[11px] text-muted-foreground">{t.workflow.ticket.tasksAssignedLater}</p>

                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {triageMode === "single" && managersForDepartment(triageForm.maintenanceResponsibleDepartment).length > 1 && (
                <div className="space-y-2">
                  <Label>{t.workflow.ticket.receivingManagerRequired}</Label>
                  <Select
                    value={triageForm.maintenanceResponsibleManagerId}
                    onValueChange={(value) => setTriageForm(f => ({ ...f, maintenanceResponsibleManagerId: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder={t.workflow.ticket.chooseManager} /></SelectTrigger>
                    <SelectContent>
                      {managersForDepartment(triageForm.maintenanceResponsibleDepartment).map((manager: any) => (
                        <SelectItem key={manager.id} value={String(manager.id)}>{manager.name || manager.username}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {triageMode === "single" && triageForm.maintenanceResponsibleDepartment === MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL && (
              <div className="space-y-2">
                <Label>{t.workflow.ticket.assignedTechnicianRequired}</Label>
                <TechnicianCombobox
                  value={triageForm.assignedToId}
                  onValueChange={(v) => setTriageForm(f => ({ ...f, assignedToId: v }))}
                  placeholder={t.workflow.ticket.chooseResponsibleTechnician}
                  options={technicians.map((tech: any) => ({
                    value: tech.id.toString(),
                    label: `${tech.name} (${t.roles.technician})`,
                  }))}
                />
              </div>
              )}

              <div className="space-y-2">
                <Label>{t.workflow.ticket.triageNotesLabel}</Label>
                <Textarea
                  value={triageForm.triageNotes}
                  onChange={(e) => setTriageForm(f => ({ ...f, triageNotes: e.target.value }))}
                  placeholder={t.workflow.ticket.triageNotesPlaceholder}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTriageDialog(null)}>{t.workflow.ticket.cancel}</Button>
            <Button
              onClick={triageMode === "multi" ? handleMultiTriage : handleFullTriage}
              disabled={
                triageMode === "multi"
                  ? (triageMultiMut.isPending || selectedDepartments.length === 0)
                  : (
                    triageMut.isPending ||
                    !triageForm.maintenanceResponsibleDepartment ||
                    managersForDepartment(triageForm.maintenanceResponsibleDepartment).length === 0 ||
                    (managersForDepartment(triageForm.maintenanceResponsibleDepartment).length > 1 && !triageForm.maintenanceResponsibleManagerId) ||
                    (triageForm.maintenanceResponsibleDepartment === MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL && !triageForm.assignedToId)
                  )
              }
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <ArrowRight className={`w-4 h-4 ${dir === "rtl" ? "rotate-180 ms-1" : "me-1"}`} />
              {(triageMode === "multi" ? triageMultiMut.isPending : triageMut.isPending)
                ? t.workflow.ticket.saving
                : triageMode === "multi" ? t.workflow.ticket.confirmMultiTriageCount.replace("{count}", String(selectedDepartments.length)) : t.workflow.ticket.confirmTriage}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
