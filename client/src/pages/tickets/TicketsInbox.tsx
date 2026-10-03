// ============================================================
// صندوق البلاغات — /tickets/inbox
// واجهة "قراءة ومتابعة" فقط لنفس بلاغات النظام الحالي:
//   • نفس مصدر البيانات: trpc.tickets.listPaginated (نفس إجراء صفحة البلاغات)
//   • نفس الصلاحيات: نطاق الأدوار يُطبَّق في الخادم (operator/technician) كما هو
//   • نفس الحالات والألوان والترجمات: STATUS_COLORS/PRIORITY_COLORS + useStaticLabels
//   • الـWorkflow بالكامل يتم من صفحة تفاصيل البلاغ الحالية (/tickets/:id)
//     — لا يوجد هنا أي منطق انتقال حالات أو mutations خاصة بالبلاغ.
// ============================================================
import { trpc } from "@/lib/trpc";
import { readHistoryEntryState, writeHistoryEntryState } from "@/lib/backStack";
import { keepPreviousData } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { STATUS_COLORS, PRIORITY_COLORS } from "@shared/types";
import { Search, RefreshCw, Inbox, ExternalLink, ChevronLeft, ChevronRight, UserX } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { useStaticLabels } from "@/hooks/useContentTranslation";
import { useTranslatedField } from "@/hooks/useTranslatedField";
import { useIsMobile } from "@/hooks/useMobile";
import { useAuth } from "@/_core/hooks/useAuth";
import { MAINTENANCE_RESPONSIBLE_DEPARTMENT } from "@shared/roles";
import {
  TICKET_LIST_TAB,
  canSeeAllTicketsTab,
  canSeeConstructionTicketsTab,
  resolveTicketListTab,
  ticketInboxUrl,
} from "@/pages/tickets/ticketTabs";

// نفس دالة ترقيم الصفحات المستخدمة في صفحة البلاغات الحالية
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

// وقت نسبي («منذ ساعتين»، «قبل 5 أيام») بلغة الواجهة الحالية
function relativeTime(dateInput: string | Date, locale: string, justNow: string): string {
  const date = new Date(dateInput);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return justNow;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return rtf.format(-diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return rtf.format(-diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  if (diffMonth < 12) return rtf.format(-diffMonth, "month");
  return rtf.format(-Math.round(diffMonth / 12), "year");
}

type QuickFilter = "all" | "critical" | "unassigned" | "stale" | "ready_for_closure";
type SortMode = "important" | "newest" | "oldest" | "updated";

type TicketsInboxHistoryState = {
  search: string;
  quickFilter: QuickFilter;
  sort: SortMode;
  statusFilter: string;
  priorityFilter: string;
  siteFilter: string;
  sectionFilter: string;
  technicianFilter: string;
  dateFrom: string;
  dateTo: string;
  page: number;
};

const TICKETS_INBOX_HISTORY_KEY = "__cmmsTicketsInboxState";

export default function TicketsInbox() {
  const [, setLocation] = useLocation();
  const searchParamsText = useSearch();
  const isMobile = useIsMobile();
  const { t, language, dir } = useTranslation();
  const { getStatusLabel, getPriorityLabel, getCategoryLabel } = useStaticLabels();
  const { getField } = useTranslatedField();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const requestedTab = useMemo(
    () => new URLSearchParams(searchParamsText).get("tab"),
    [searchParamsText],
  );
  const activeTab = resolveTicketListTab(user?.role, requestedTab);
  const showAllTab = canSeeAllTicketsTab(user?.role);
  const showConstructionTab = canSeeConstructionTicketsTab(user?.role);

  const savedHistoryState = useMemo(
    () => readHistoryEntryState<TicketsInboxHistoryState>(TICKETS_INBOX_HISTORY_KEY),
    [],
  );
  const [search, setSearch] = useState(savedHistoryState?.search ?? "");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(savedHistoryState?.quickFilter ?? "all");
  const [sort, setSort] = useState<SortMode>(savedHistoryState?.sort ?? "important");
  const [statusFilter, setStatusFilter] = useState(savedHistoryState?.statusFilter ?? "all");
  const [priorityFilter, setPriorityFilter] = useState(savedHistoryState?.priorityFilter ?? "all");
  const [siteFilter, setSiteFilter] = useState(savedHistoryState?.siteFilter ?? "all");
  const [sectionFilter, setSectionFilter] = useState(savedHistoryState?.sectionFilter ?? "all");
  const [technicianFilter, setTechnicianFilter] = useState(savedHistoryState?.technicianFilter ?? "all");
  // فلترة بتاريخ إنشاء البلاغ (نطاق اختياري YYYY-MM-DD)
  const [dateFrom, setDateFrom] = useState(savedHistoryState?.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(savedHistoryState?.dateTo ?? "");
  const [page, setPage] = useState(savedHistoryState?.page && savedHistoryState.page > 0 ? savedHistoryState.page : 1);
  const didMountFilters = useRef(false);
  const PAGE_SIZE = 10;

  const [previewTicket, setPreviewTicket] = useState<any>(null);
  const previewOpen = !!previewTicket;

  // نفس مصادر خيارات الفلاتر في صفحة البلاغات الحالية
  const { data: sites = [] } = trpc.sites.list.useQuery();
  const { data: allSections } = trpc.sections.list.useQuery(undefined);
  const { data: userTechniciansList = [] } = trpc.users.listTechnicians.useQuery();
  const allTechnicians = userTechniciansList.map((u: any) => ({ id: u.id, name: u.name || u.email }));

  // خرائط أسماء المواقع والأقسام للعرض في الجدول والمعاينة
  const siteNameById = useMemo(() => {
    const m = new Map<number, string>();
    (sites as any[]).forEach(s => m.set(s.id, s.name));
    return m;
  }, [sites]);
  const sectionNameById = useMemo(() => {
    const m = new Map<number, string>();
    (allSections as any[] | undefined)?.forEach(s => m.set(s.id, s.name));
    return m;
  }, [allSections]);

  // أي تغيير في البحث/الفلاتر/الترتيب يعيدنا لأول صفحة (نفس سلوك الصفحة الحالية)
  useEffect(() => {
    if (!didMountFilters.current) {
      didMountFilters.current = true;
      return;
    }
    setPage(1);
  }, [search, quickFilter, sort, statusFilter, priorityFilter, siteFilter, sectionFilter, technicianFilter, dateFrom, dateTo, activeTab]);

  useEffect(() => {
    writeHistoryEntryState<TicketsInboxHistoryState>(TICKETS_INBOX_HISTORY_KEY, {
      search,
      quickFilter,
      sort,
      statusFilter,
      priorityFilter,
      siteFilter,
      sectionFilter,
      technicianFilter,
      dateFrom,
      dateTo,
      page,
    });
  }, [search, quickFilter, sort, statusFilter, priorityFilter, siteFilter, sectionFilter, technicianFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    const invalidRequestedTab = requestedTab && requestedTab !== activeTab;
    const constructionOnlyUserMissingTab =
      !showAllTab && showConstructionTab && requestedTab !== TICKET_LIST_TAB.CONSTRUCTION;

    if (invalidRequestedTab || constructionOnlyUserMissingTab) {
      setLocation(ticketInboxUrl(activeTab));
    }
  }, [activeTab, requestedTab, setLocation, showAllTab, showConstructionTab]);

  // الفلاتر الأساسية المشتركة بين القائمة والعدادات — تُنفَّذ في الخادم على كامل النتائج
  const baseFilters = {
    status: statusFilter !== "all" ? statusFilter : undefined,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    siteId: siteFilter !== "all" ? Number(siteFilter) : undefined,
    sectionId: sectionFilter !== "all" ? Number(sectionFilter) : undefined,
    assignedToId: technicianFilter !== "all" ? Number(technicianFilter) : undefined,
    search: search || undefined,
    createdFrom: dateFrom || undefined,
    createdTo: dateTo || undefined,
    maintenanceResponsibleDepartment: activeTab === TICKET_LIST_TAB.CONSTRUCTION
      ? MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION
      : undefined,
  };

  // نفس إجراء صفحة البلاغات الحالية (listPaginated) — مع خيارات العرض الإضافية فقط
  const { data: ticketsData, isLoading, isFetching } = trpc.tickets.listPaginated.useQuery({
    ...baseFilters,
    quickFilter,
    sort,
    page,
    pageSize: PAGE_SIZE,
  }, {
    placeholderData: keepPreviousData,
  });

  // عدادات الفلاتر السريعة — نفس الفلاتر ونفس نطاق الصلاحيات في الخادم
  const { data: counts } = trpc.tickets.inboxCounts.useQuery(baseFilters);

  // آخر ثلاثة أحداث للبلاغ المعروض في المعاينة — نفس إجراء tickets.history الحالي
  const { data: previewHistory = [] } = trpc.tickets.history.useQuery(
    { ticketId: previewTicket?.id ?? 0 },
    { enabled: previewOpen }
  );

  const tickets = ticketsData?.tickets ?? [];
  const totalTickets = ticketsData?.total ?? 0;
  const totalPages = ticketsData?.totalPages ?? 1;
  const pageNumbers = useMemo(() => getPageNumbers(page, totalPages), [page, totalPages]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const locale = language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US";
  const ti = t.ticketsInbox;

  const refresh = () => {
    utils.tickets.listPaginated.invalidate();
    utils.tickets.inboxCounts.invalidate();
  };

  const openDetails = (id: number) => setLocation(`/tickets/${id}`);

  const quickFilters: { key: QuickFilter; label: string; count: number }[] = [
    { key: "all", label: ti.quickAll, count: counts?.all ?? 0 },
    { key: "critical", label: ti.quickCritical, count: counts?.critical ?? 0 },
    { key: "unassigned", label: ti.quickUnassigned, count: counts?.unassigned ?? 0 },
    { key: "stale", label: ti.quickStale, count: counts?.stale ?? 0 },
    { key: "ready_for_closure", label: ti.quickReadyForClosure, count: counts?.ready_for_closure ?? 0 },
  ];

  const assigneeName = (ticket: any) =>
    ticket.assignedToUserName || ticket.assignedTechnicianName || null;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setSiteFilter("all");
    setSectionFilter("all");
    setTechnicianFilter("all");
    setQuickFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  // خلية/سطر «البلاغ»: العنوان + الرقم + الأولوية + التصنيف
  const TicketCell = ({ ticket }: { ticket: any }) => (
    <div className="min-w-0">
      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
        <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber}</span>
        <Badge variant="outline" className={`text-[11px] ${PRIORITY_COLORS[ticket.priority] || ""}`}>
          {getPriorityLabel(ticket.priority)}
        </Badge>
      </div>
      <div className="font-medium text-sm truncate">{getField(ticket, "title")}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{getCategoryLabel(ticket.category)}</div>
    </div>
  );

  const AssigneeCell = ({ ticket }: { ticket: any }) => {
    const name = assigneeName(ticket);
    return name ? (
      <span className="text-sm">{name}</span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 font-medium">
        <UserX className="w-3.5 h-3.5" />
        {ti.unassigned}
      </span>
    );
  };

  const LocationCell = ({ ticket }: { ticket: any }) => (
    <div className="min-w-0">
      <div className="text-sm truncate">
        {ticket.siteId ? (siteNameById.get(ticket.siteId) ?? "—") : "—"}
      </div>
      {ticket.sectionId && sectionNameById.get(ticket.sectionId) && (
        <div className="text-xs text-muted-foreground truncate">{sectionNameById.get(ticket.sectionId)}</div>
      )}
    </div>
  );

  const StatusBadge = ({ status }: { status: string }) => (
    <Badge className={`status-badge ${STATUS_COLORS[status] || "bg-gray-100 text-gray-700"}`}>
      {getStatusLabel(status)}
    </Badge>
  );

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Inbox className="w-6 h-6 text-primary" />
            {ti.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{ti.description}</p>
        </div>
        <Button variant="outline" onClick={refresh} className="gap-2" disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          {ti.refresh}
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setLocation(ticketInboxUrl(resolveTicketListTab(user?.role, value)))}
        dir={language === "en" ? "ltr" : "rtl"}
      >
        <TabsList className="h-auto flex-wrap">
          {showAllTab && (
            <TabsTrigger value={TICKET_LIST_TAB.ALL}>{t.nav.tickets}</TabsTrigger>
          )}
          {showConstructionTab && (
            <TabsTrigger value={TICKET_LIST_TAB.CONSTRUCTION}>{t.nav.construction.tickets}</TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {/* البحث */}
      <div className="relative max-w-md">
        <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${dir === "rtl" ? "right-3" : "left-3"}`} />
        <Input
          placeholder={`${t.common.search}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={dir === "rtl" ? "pr-10" : "pl-10"}
        />
      </div>

      {/* الفلاتر السريعة مع العدادات */}
      <div className="flex gap-2 flex-wrap">
        {quickFilters.map(f => (
          <Button
            key={f.key}
            size="sm"
            variant={quickFilter === f.key ? "default" : "outline"}
            className="gap-2 h-8"
            onClick={() => setQuickFilter(f.key)}
          >
            {f.label}
            <Badge
              variant="secondary"
              className={`text-[11px] px-1.5 min-w-5 justify-center ${quickFilter === f.key ? "bg-primary-foreground/20 text-primary-foreground" : ""}`}
            >
              {f.count}
            </Badge>
          </Button>
        ))}
      </div>

      {/* الفلاتر الأساسية + الترتيب */}
      <div className="flex flex-wrap gap-3 items-end">
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
            <SelectTrigger className="w-[150px]">
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
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t.tickets.site} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.common.all}</SelectItem>
              {(sites as any[]).map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t.tickets.section}</span>
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t.tickets.section} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.common.all}</SelectItem>
              {(allSections as any[] | undefined)
                ?.filter((s: any) => siteFilter === "all" || s.siteId === Number(siteFilter))
                .map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        {allTechnicians.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t.tickets.technician}</span>
            <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
              <SelectTrigger className="w-[160px]">
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
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{ti.createdFrom}</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            max={dateTo || undefined}
            className="w-[150px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{ti.createdTo}</span>
          <Input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            min={dateFrom || undefined}
            className="w-[150px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{ti.sortLabel}</span>
          <Select value={sort} onValueChange={v => setSort(v as SortMode)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={ti.sortLabel} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="important">{ti.sortImportant}</SelectItem>
              <SelectItem value="newest">{ti.sortNewest}</SelectItem>
              <SelectItem value="oldest">{ti.sortOldest}</SelectItem>
              <SelectItem value="updated">{ti.sortUpdated}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
          {t.tickets.clearFilters}
        </Button>
      </div>

      {/* المحتوى */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-14 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : !tickets.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Inbox className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-1">{t.tickets.noTickets}</h3>
            <p className="text-sm text-muted-foreground">{t.common.noData}</p>
          </CardContent>
        </Card>
      ) : isMobile ? (
        // عرض الجوال — بطاقات
        <div className="space-y-2">
          {tickets.map((ticket: any) => (
            <Card
              key={ticket.id}
              className="cursor-pointer hover:shadow-md transition-all"
              onClick={() => setPreviewTicket(ticket)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <TicketCell ticket={ticket} />
                  <StatusBadge status={ticket.status} />
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground flex-wrap">
                  <LocationCell ticket={ticket} />
                  <AssigneeCell ticket={ticket} />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{ti.colAge}: {relativeTime(ticket.createdAt, locale, ti.justNow)}</span>
                  <span>•</span>
                  <span>{ti.colUpdated}: {relativeTime(ticket.updatedAt, locale, ti.justNow)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // عرض سطح المكتب — جدول
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{ti.colTicket}</TableHead>
                <TableHead className="text-start">{ti.colLocation}</TableHead>
                <TableHead className="text-start">{ti.colStatus}</TableHead>
                <TableHead className="text-start">{ti.colAssignee}</TableHead>
                <TableHead className="text-start">{ti.colAge}</TableHead>
                <TableHead className="text-start">{ti.colUpdated}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket: any) => (
                <TableRow
                  key={ticket.id}
                  className="cursor-pointer"
                  onClick={() => setPreviewTicket(ticket)}
                >
                  <TableCell className="max-w-[320px]"><TicketCell ticket={ticket} /></TableCell>
                  <TableCell className="max-w-[180px]"><LocationCell ticket={ticket} /></TableCell>
                  <TableCell><StatusBadge status={ticket.status} /></TableCell>
                  <TableCell><AssigneeCell ticket={ticket} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {relativeTime(ticket.createdAt, locale, ti.justNow)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {relativeTime(ticket.updatedAt, locale, ti.justNow)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* الترقيم — نفس نمط صفحة البلاغات الحالية */}
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

      {/* المعاينة الجانبية — قراءة فقط؛ كل الإجراءات من صفحة التفاصيل الحالية */}
      <Sheet open={previewOpen} onOpenChange={open => { if (!open) setPreviewTicket(null); }}>
        <SheetContent
          side={language === "en" ? "right" : "left"}
          className="w-full sm:max-w-md overflow-y-auto"
        >
          {previewTicket && (
            <>
              <SheetHeader className="text-start">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-muted-foreground">{previewTicket.ticketNumber}</span>
                  <Badge variant="outline" className={`text-[11px] ${PRIORITY_COLORS[previewTicket.priority] || ""}`}>
                    {getPriorityLabel(previewTicket.priority)}
                  </Badge>
                  <StatusBadge status={previewTicket.status} />
                </div>
                <SheetTitle className="text-start leading-snug">{getField(previewTicket, "title")}</SheetTitle>
                <SheetDescription className="text-start">{ti.preview}</SheetDescription>
              </SheetHeader>

              <div className="px-4 pb-4 space-y-4">
                <Button className="w-full gap-2" onClick={() => openDetails(previewTicket.id)}>
                  <ExternalLink className="w-4 h-4" />
                  {ti.openDetails}
                </Button>

                <Separator />

                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">{t.tickets.site}</div>
                    <div>{previewTicket.siteId ? (siteNameById.get(previewTicket.siteId) ?? "—") : "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">{t.tickets.section}</div>
                    <div>{previewTicket.sectionId ? (sectionNameById.get(previewTicket.sectionId) ?? "—") : "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">{t.tickets.category}</div>
                    <div>{getCategoryLabel(previewTicket.category)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">{ti.colAssignee}</div>
                    <div><AssigneeCell ticket={previewTicket} /></div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">{ti.reporter}</div>
                    <div>{previewTicket.reportedByName || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">{ti.createdAt}</div>
                    <div title={new Date(previewTicket.createdAt).toLocaleString(locale)}>
                      {relativeTime(previewTicket.createdAt, locale, ti.justNow)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">{ti.updatedAt}</div>
                    <div title={new Date(previewTicket.updatedAt).toLocaleString(locale)}>
                      {relativeTime(previewTicket.updatedAt, locale, ti.justNow)}
                    </div>
                  </div>
                </div>

                {getField(previewTicket, "description") && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">{t.tickets.description}</div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {getField(previewTicket, "description")}
                      </p>
                    </div>
                  </>
                )}

                <Separator />

                {/* آخر ثلاثة أحداث من سجل الحالات الحالي (tickets.history) */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2">{ti.lastEvents}</div>
                  {previewHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{ti.noEvents}</p>
                  ) : (
                    <div className="space-y-2">
                      {(previewHistory as any[]).slice(0, 3).map((ev: any) => (
                        <div key={ev.id} className="flex items-start gap-2 text-sm">
                          <span className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {ev.fromStatus && (
                                <>
                                  <span className="text-muted-foreground">{getStatusLabel(ev.fromStatus)}</span>
                                  <span className="text-muted-foreground">←</span>
                                </>
                              )}
                              <span className="font-medium">{getStatusLabel(ev.toStatus)}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {relativeTime(ev.createdAt, locale, ti.justNow)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
