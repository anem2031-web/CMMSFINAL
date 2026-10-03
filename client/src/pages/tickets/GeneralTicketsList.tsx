import { trpc } from "@/lib/trpc";
import { readHistoryEntryState, writeHistoryEntryState } from "@/lib/backStack";
import { summarizeSubTicketFamily } from "@shared/ticketUiRules";
import { keepPreviousData } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { STATUS_COLORS, PRIORITY_COLORS } from "@shared/types";
import { APP_ROLE, MAINTENANCE_INSPECTION_WORKFLOW_STATUS, MAINTENANCE_MANAGER_FAMILY } from "@shared/roles";
import { isTicketEditableBeforeTriage } from "@shared/ticketUiRules";
import { Plus, Search, ClipboardList, Pencil, Trash2, ChevronLeft, ChevronRight, ChevronDown, GitBranch } from "lucide-react";
import { ExportButton } from "@/components/common/ExportButton";
import { useState, useMemo, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { useStaticLabels } from "@/hooks/useContentTranslation";
import { useTranslatedField } from "@/hooks/useTranslatedField";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { localizeApiError } from "@/i18n/apiError";

// يبني قائمة أرقام الصفحات المطلوب عرضها (مع نقاط حذف "..." عند كثرة الصفحات)
// مثال لـ 10 صفحات وأنت بالصفحة 1: [1, 2, "dots", 10]
type TicketsListHistoryState = {
  search: string;
  statusFilter: string;
  priorityFilter: string;
  siteFilter: string;
  sectionFilter: string;
  technicianFilter: string;
  page: number;
  expandedFamilies: Record<number, boolean>;
  expandedSubTickets: Record<number, boolean>;
};

const TICKETS_LIST_HISTORY_KEY = "__cmmsTicketsListState";

function getPageNumbers(current: number, total: number): (number | "dots")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  const range: (number | "dots")[] = [1];
  if (left > 2) range.push("dots");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push("dots");
  range.push(total);
  return range;
}

export default function GeneralTicketsList() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(useSearch());
  
  // Whitelist Validation & Initial Hydration (One-time only)
  const initialFilters = useMemo(() => {
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    
    return {
      status: ["open", "all"].includes(status || "") ? status : "all",
      priority: ["critical", "all"].includes(priority || "") ? priority : "all"
    };
  }, []); // Empty dependency array ensures this only runs once on mount

  const savedHistoryState = useMemo(
    () => readHistoryEntryState<TicketsListHistoryState>(TICKETS_LIST_HISTORY_KEY),
    [],
  );
  const [search, setSearch] = useState(savedHistoryState?.search ?? "");
  const [statusFilter, setStatusFilter] = useState(savedHistoryState?.statusFilter ?? initialFilters.status ?? "all");
  const [priorityFilter, setPriorityFilter] = useState(savedHistoryState?.priorityFilter ?? initialFilters.priority ?? "all");
  const [siteFilter, setSiteFilter] = useState(savedHistoryState?.siteFilter ?? "all");
  const [sectionFilter, setSectionFilter] = useState(savedHistoryState?.sectionFilter ?? "all");
  const [technicianFilter, setTechnicianFilter] = useState(savedHistoryState?.technicianFilter ?? "all");
  const [page, setPage] = useState(savedHistoryState?.page && savedHistoryState.page > 0 ? savedHistoryState.page : 1);
  // البلاغ الرئيسي يمثل "عائلة" واحدة في القائمة. التوسعة الأولى تعرض الرئيسي/الفرعيات،
  // والتوسعة الثانية تعرض بطاقات البلاغات الفرعية نفسها.
  const [expandedFamilies, setExpandedFamilies] = useState<Record<number, boolean>>(savedHistoryState?.expandedFamilies ?? {});
  const [expandedSubTickets, setExpandedSubTickets] = useState<Record<number, boolean>>(savedHistoryState?.expandedSubTickets ?? {});
  const didMountFilters = useRef(false);
  const PAGE_SIZE = 10;
  
  const { t, language, dir } = useTranslation();
  const wt = t.workflow.ticket;
  const { getStatusLabel, getPriorityLabel, getCategoryLabel } = useStaticLabels();
  const { getField } = useTranslatedField();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const isEditAdminOverride = !!user && [APP_ROLE.OWNER, APP_ROLE.ADMIN].includes(user.role as any);
  const isCreatorRestrictedManager = !!user && (MAINTENANCE_MANAGER_FAMILY as readonly string[]).includes(user.role);
  const canDelete = user && ["owner", "admin"].includes(user.role);
  const canEditTicketRow = (ticket: any) => {
    if (!user || !isTicketEditableBeforeTriage(ticket.status)) return false;
    const isReporter = ticket.reportedById === user.id;
    return (isEditAdminOverride || isReporter) && (!isCreatorRestrictedManager || isReporter);
  };

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [editData, setEditData] = useState({ title: "", description: "", priority: "", category: "" });

  const { data: sites = [] } = trpc.sites.list.useQuery();
  const { data: allSections } = trpc.sections.list.useQuery(undefined);
  const { data: userTechniciansList = [] } = trpc.users.listTechnicians.useQuery();
  const allTechnicians = userTechniciansList.map((u: any) => ({ id: u.id, name: u.name || u.email }));

  // أي تغيير في البحث أو الفلاتر يرجعنا تلقائياً لأول صفحة
  // (تفادياً للوقوف على صفحة فاضية بعد ما تتغير نتائج الفلترة)
  useEffect(() => {
    if (!didMountFilters.current) {
      didMountFilters.current = true;
      return;
    }
    setPage(1);
  }, [search, statusFilter, priorityFilter, siteFilter, sectionFilter, technicianFilter]);

  useEffect(() => {
    writeHistoryEntryState<TicketsListHistoryState>(TICKETS_LIST_HISTORY_KEY, {
      search,
      statusFilter,
      priorityFilter,
      siteFilter,
      sectionFilter,
      technicianFilter,
      page,
      expandedFamilies,
      expandedSubTickets,
    });
  }, [search, statusFilter, priorityFilter, siteFilter, sectionFilter, technicianFilter, page, expandedFamilies, expandedSubTickets]);

  const { data: ticketsData, isLoading } = trpc.tickets.listPaginated.useQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    siteId: siteFilter !== "all" ? Number(siteFilter) : undefined,
    sectionId: sectionFilter !== "all" ? Number(sectionFilter) : undefined,
    search: search || undefined,
    assignedToId: technicianFilter !== "all" ? Number(technicianFilter) : undefined,
    page,
    pageSize: PAGE_SIZE,
    // يمنع احتساب/عرض البلاغات الفرعية كسجلات مستقلة في هذه الصفحة فقط.
    groupSubTickets: true,
  }, {
    placeholderData: keepPreviousData, // يمنع اختفاء القائمة/الصفحات لحظياً عند التنقل بين الصفحات
  });

  const tickets = ticketsData?.tickets ?? [];
  const totalTickets = ticketsData?.total ?? 0;
  const totalPages = ticketsData?.totalPages ?? 1;
  const pageNumbers = useMemo(() => getPageNumbers(page, totalPages), [page, totalPages]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const updateMutation = trpc.tickets.update.useMutation({
    onSuccess: () => {
      toast.success(t.common.savedSuccessfully);
      utils.tickets.list.invalidate();
      utils.tickets.listPaginated.invalidate();
      setEditOpen(false);
    },
    onError: (err) => toast.error(localizeApiError(err.message)),
  });

  const deleteMutation = trpc.tickets.delete.useMutation({
    onSuccess: () => {
      toast.success(t.common.deletedSuccessfully);
      utils.tickets.list.invalidate();
      utils.tickets.listPaginated.invalidate();
      setDeleteOpen(false);
    },
    onError: (err) => toast.error(localizeApiError(err.message)),
  });

  const openEdit = (ticket: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTicket(ticket);
    setEditData({ title: ticket.title, description: ticket.description || "", priority: ticket.priority, category: ticket.category });
    setEditOpen(true);
  };

  const openDelete = (ticket: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTicket(ticket);
    setDeleteOpen(true);
  };

  const locale = language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US";
  const inspectionStatusLabel = (value?: string | null) => {
    switch (value) {
      case MAINTENANCE_INSPECTION_WORKFLOW_STATUS.PENDING_SUBMISSION: return wt.inspectionPending;
      case MAINTENANCE_INSPECTION_WORKFLOW_STATUS.SUBMITTED_FOR_REVIEW: return wt.inspectionManagerPending;
      case MAINTENANCE_INSPECTION_WORKFLOW_STATUS.RETURNED_FOR_CORRECTION: return wt.inspectionReturnedStatus;
      case MAINTENANCE_INSPECTION_WORKFLOW_STATUS.APPROVED: return wt.inspectionApprovedStatus;
      default: return null;
    }
  };

  return (
    <div dir={dir} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.tickets.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.tickets.description}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportButton endpoint="tickets" filename="tickets" />
          <Button onClick={() => setLocation("/tickets/new")} className="gap-2">
            <Plus className="w-4 h-4" />
            {t.tickets.createNew}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <span className="text-xs text-muted-foreground">{t.common.search}</span>
          <div className="relative">
            <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${dir === "rtl" ? "right-3" : "left-3"}`} />
            <Input
              placeholder={`${t.common.search}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={dir === "rtl" ? "pr-10" : "pl-10"}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t.common.status}</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t.common.status} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.common.all}</SelectItem>
              {Object.keys(t.ticketStatus).map(k => (
                <SelectItem key={k} value={k}>{getStatusLabel(k)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t.tickets.priority}</span>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t.tickets.priority} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.common.all}</SelectItem>
              {Object.keys(t.priority).map(k => (
                <SelectItem key={k} value={k}>{getPriorityLabel(k)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t.tickets.site}</span>
          <Select value={siteFilter} onValueChange={v => { setSiteFilter(v); setSectionFilter("all"); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t.tickets.site} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.common.all}</SelectItem>
              {sites.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {siteFilter !== "all" && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t.tickets.section}</span>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t.tickets.section} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.common.all}</SelectItem>
                {allSections?.filter((s: any) => s.siteId === Number(siteFilter)).map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {allTechnicians.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t.tickets.technician}</span>
            <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder={t.tickets.technician} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.common.all}</SelectItem>
                {allTechnicians.map((tech: any) => (
                  <SelectItem key={tech.id} value={String(tech.id)}>{tech.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : !tickets?.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-1">{t.tickets.noTickets}</h3>
            <p className="text-sm text-muted-foreground">{t.common.noData}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket: any) => {
            const subTickets = Array.isArray(ticket.subTickets) ? ticket.subTickets : [];
            const hasSubTickets = subTickets.length > 0;
            const familyExpanded = !!expandedFamilies[ticket.id];
            const subTicketsExpanded = !!expandedSubTickets[ticket.id];

            return (
              <Card
                key={ticket.id}
                className="hover:shadow-lg hover:border-primary/20 transition-all duration-200 cursor-pointer"
                onClick={() => {
                  if (!hasSubTickets) {
                    setLocation(`/tickets/${ticket.id}`);
                    return;
                  }
                  setExpandedFamilies(prev => ({ ...prev, [ticket.id]: !prev[ticket.id] }));
                }}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber}</span>
                        <Badge variant="outline" className={`text-[11px] ${PRIORITY_COLORS[ticket.priority] || ""}`}>
                          {getPriorityLabel(ticket.priority)}
                        </Badge>
                        {hasSubTickets && (() => {
                          // تمييز بصري فوري: بطاقتا "عائلة انتهت" و"عائلة قيد العمل"
                          // كانتا متطابقتين تمامًا قبل هذا — نفس شارة الحالة البنفسجية.
                          const summary = summarizeSubTicketFamily(subTickets);
                          return (
                            <>
                              <Badge variant="secondary" className="text-[10px] gap-1">
                                <GitBranch className="w-3 h-3" />
                                {wt.familySubTickets.replace("{count}", String(subTickets.length))}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-[10px] gap-1 ${summary.allFinished ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400" : "border-purple-300 text-purple-700 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300"}`}
                              >
                                {summary.allFinished
                                  ? wt.familyAllFinished
                                  : wt.familyProgress.replace("{percent}", String(summary.percent)).replace("{finished}", String(summary.finished)).replace("{total}", String(summary.total))}
                              </Badge>
                            </>
                          );
                        })()}
                      </div>
                      <h3 className="font-medium text-sm truncate">{getField(ticket, "title")}</h3>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        <span>{getCategoryLabel(ticket.category)}</span>
                        <span>{new Date(ticket.createdAt).toLocaleDateString(locale)}</span>
                        {(ticket.assignedToUserName || ticket.assignedTechnicianName) && (
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400" />
                            {ticket.assignedToUserName || ticket.assignedTechnicianName}
                          </span>
                        )}
                        {ticket.status === "under_inspection" && inspectionStatusLabel(ticket.inspectionWorkflowStatus) && (
                          <Badge variant="secondary" className="text-[10px]">
                            {inspectionStatusLabel(ticket.inspectionWorkflowStatus)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canEditTicketRow(ticket) && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => openEdit(ticket, e)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => openDelete(ticket, e)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Badge className={`status-badge ${STATUS_COLORS[ticket.status] || "bg-gray-100 text-gray-700"}`}>
                        {getStatusLabel(ticket.status)}
                      </Badge>
                      {hasSubTickets && (
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${familyExpanded ? "rotate-180" : ""}`} />
                      )}
                    </div>
                  </div>

                  {hasSubTickets && familyExpanded && (
                    <div
                      className="border-t pt-3 space-y-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="grid gap-2 md:grid-cols-2">
                        <button
                          type="button"
                          className="rounded-lg border bg-background p-3 text-start hover:bg-muted/50 transition-colors"
                          onClick={() => setLocation(`/tickets/${ticket.id}`)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground">{wt.mainTicket}</p>
                              <p className="font-mono font-semibold mt-1">{ticket.ticketNumber}</p>
                            </div>
                            <Badge className={`status-badge ${STATUS_COLORS[ticket.status] || "bg-gray-100 text-gray-700"}`}>
                              {getStatusLabel(ticket.status)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">{wt.openMainTicketHelp}</p>
                        </button>

                        <button
                          type="button"
                          className="rounded-lg border bg-background p-3 text-start hover:bg-muted/50 transition-colors"
                          onClick={() => setExpandedSubTickets(prev => ({ ...prev, [ticket.id]: !prev[ticket.id] }))}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground">{wt.subTickets}</p>
                              <p className="font-semibold mt-1">{wt.ticketsCount.replace("{count}", String(subTickets.length))}</p>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${subTicketsExpanded ? "rotate-180" : ""}`} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">{wt.showSubTicketsHelp}</p>
                        </button>
                      </div>

                      {subTicketsExpanded && (
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {subTickets.map((child: any) => (
                            <button
                              key={child.id}
                              type="button"
                              className="rounded-lg border bg-muted/20 p-3 text-start hover:border-primary/30 hover:bg-muted/40 transition-colors"
                              onClick={() => setLocation(`/tickets/${child.id}`)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <GitBranch className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <span className="font-mono text-xs font-semibold">{child.ticketNumber}</span>
                                  </div>
                                  <p className="text-sm font-medium truncate">{getField(child, "title")}</p>
                                </div>
                                <Badge className={`status-badge shrink-0 ${STATUS_COLORS[child.status] || "bg-gray-100 text-gray-700"}`}>
                                  {getStatusLabel(child.status)}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground flex-wrap">
                                <span>{getPriorityLabel(child.priority)}</span>
                                <span>{new Date(child.createdAt).toLocaleDateString(locale)}</span>
                                {(child.assignedToUserName || child.assignedTechnicianName) && (
                                  <span>{child.assignedToUserName || child.assignedTechnicianName}</span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!isLoading && tickets.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <span className="text-xs text-muted-foreground">
            {t.tickets.results}: {totalTickets}
          </span>
          {totalPages > 1 && (
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    size="default"
                    aria-label={t.common.previous}
                    onClick={e => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
                    className={`gap-1 px-2.5 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <ChevronLeft className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`} />
                    <span className="hidden sm:block">{t.common.previous}</span>
                  </PaginationLink>
                </PaginationItem>
                {pageNumbers.map((p, idx) =>
                  p === "dots" ? (
                    <PaginationItem key={`dots-${idx}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        isActive={p === page}
                        onClick={e => { e.preventDefault(); setPage(p as number); }}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    size="default"
                    aria-label={t.common.next}
                    onClick={e => { e.preventDefault(); if (page < totalPages) setPage(page + 1); }}
                    className={`gap-1 px-2.5 ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <span className="hidden sm:block">{t.common.next}</span>
                    <ChevronRight className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`} />
                  </PaginationLink>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t.common.edit} - {selectedTicket?.ticketNumber}</DialogTitle>
            <DialogDescription>{t.tickets.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t.tickets.title}</Label>
              <Input value={editData.title} onChange={e => setEditData({ ...editData, title: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>{t.tickets.description}</Label>
              <Textarea value={editData.description} onChange={e => setEditData({ ...editData, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t.tickets.priority}</Label>
                <Select value={editData.priority} onValueChange={v => setEditData({ ...editData, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(t.priority).map(k => (
                      <SelectItem key={k} value={k}>{getPriorityLabel(k)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t.tickets.category}</Label>
                <Select value={editData.category} onValueChange={v => setEditData({ ...editData, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(t.category).map(k => (
                      <SelectItem key={k} value={k}>{getCategoryLabel(k)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={() => updateMutation.mutate({ id: selectedTicket.id, ...editData })} disabled={updateMutation.isPending}>
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.common.delete} - {selectedTicket?.ticketNumber}</DialogTitle>
            <DialogDescription>{t.common.deleteWarning}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate({ id: selectedTicket.id })} disabled={deleteMutation.isPending}>
              {t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
