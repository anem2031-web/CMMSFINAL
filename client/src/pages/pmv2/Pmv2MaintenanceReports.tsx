import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock3,
  FileText,
  History,
  MessageSquareText,
  RefreshCcw,
  UserRoundCheck,
  Users,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePmv2Text, pmv2Text, localizePmv2ServerText } from "@/i18n/pmv2Ui";
import type { SupportedLanguage } from "@/contexts/LanguageContext";
import { EntityTranslatedText } from "@/components/i18n/EntityTranslatedText";
import { Pmv2LocalizedTimelineText } from "@/components/i18n/Pmv2LocalizedTimelineText";
import { localizeApiError } from "@/i18n/apiError";

function riyadhToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function localeFor(language: SupportedLanguage) {
  return language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US";
}

function formatDateTime(value: unknown, language: SupportedLanguage) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(localeFor(language), {
    timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function formatTime(value: unknown, language: SupportedLanguage) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(localeFor(language), { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDuration(value: unknown, language: SupportedLanguage) {
  const minutes = Math.max(0, Math.trunc(Number(value) || 0));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainder = minutes % 60;
  const nf = new Intl.NumberFormat(localeFor(language));
  const parts: string[] = [];
  if (days) parts.push(`${nf.format(days)} ${pmv2Text(language, "ي")}`);
  if (hours) parts.push(`${nf.format(hours)} ${pmv2Text(language, "س")}`);
  if (remainder || !parts.length) parts.push(`${nf.format(remainder)} ${pmv2Text(language, "د")}`);
  return parts.join(" ");
}

function formatSince(value: unknown, language: SupportedLanguage) {
  if (!value) return pmv2Text(language, "الوقت غير محدد");
  const started = new Date(String(value)).getTime();
  if (!Number.isFinite(started)) return pmv2Text(language, "الوقت غير محدد");
  return formatDuration(Math.max(0, Math.floor((Date.now() - started) / 60000)), language);
}

function statusLabel(status: string, language: SupportedLanguage) {
  const source: Record<string, string> = {
    pending: "معلقة", in_progress: "قيد التنفيذ", waiting_material: "بانتظار مواد", waiting_ticket: "بانتظار بلاغ",
    ready_to_complete: "جاهزة للاستكمال", completed: "مكتملة", cancelled: "ملغاة",
  };
  return pmv2Text(language, source[status] || status);
}

function resultLabel(result: string, language: SupportedLanguage) {
  const source: Record<string, string> = { ok: "سليم", fixed: "تم الإصلاح", needs_material: "تحتاج مواد", needs_ticket: "تحتاج بلاغ" };
  return pmv2Text(language, source[result] || result);
}

function outcomeBadge(task: any, language: SupportedLanguage) {
  if (task.outcome === "completed") {
    return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">{pmv2Text(language, "منجزة اليوم")}</Badge>;
  }
  if (task.outcome === "worked_pending") {
    return <Badge className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">{pmv2Text(language, "بدأت ولم تكتمل")}</Badge>;
  }
  if (task.outcome === "not_started") {
    return <Badge variant="outline">{pmv2Text(language, "لم تبدأ اليوم")}</Badge>;
  }
  return <Badge className="border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-50">{pmv2Text(language, "مرحلة من يوم سابق")}</Badge>;
}

function TimelineDetails({ taskId }: { taskId: number }) {
  const { p, language } = usePmv2Text();
  const query = trpc.pmv2.monitoring.taskDetail.useQuery({ taskId });
  if (query.isLoading) return <p className="py-4 text-sm text-muted-foreground">{p("جاري تحميل المسار...")}</p>;
  if (query.error) return <p className="py-4 text-sm text-destructive">{localizeApiError(query.error.message)}</p>;
  const timeline = query.data?.timeline;
  if (!timeline) return <p className="py-4 text-sm text-muted-foreground">{p("لا توجد بيانات مسار.")}</p>;

  return (
    <div className="space-y-4 pt-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{p("عمر المهمة")}</p><p className="font-semibold">{formatDuration(timeline.summary.totalAgeMinutes, language)}</p></div>
        <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{p("تنفيذ فعلي")}</p><p className="font-semibold">{formatDuration(timeline.summary.actualWorkMinutes, language)}</p></div>
        <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{p("انتظار مواد")}</p><p className="font-semibold">{formatDuration(timeline.summary.waitingMaterialMinutes, language)}</p></div>
        <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{p("انتظار بلاغ")}</p><p className="font-semibold">{formatDuration(timeline.summary.waitingTicketMinutes, language)}</p></div>
      </div>

      <div>
        <h4 className="mb-2 font-semibold">{p("المسار الزمني")}</h4>
        <div className="space-y-2">
          {(timeline.events || []).map((event: any) => (
            <div key={event.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Pmv2LocalizedTimelineText className="font-medium" value={event.label} taskItemId={event.taskItemId} taskItemTitle={event.taskItemTitle} />
                <span className="text-xs text-muted-foreground">{formatDateTime(event.at, language)}</span>
              </div>
              {event.taskItemTitle ? <p className="mt-1 text-muted-foreground">{p("البند")}: <EntityTranslatedText entityType="PMV2_TASK_ITEM" entityId={Number(event.taskItemId)} field="titleSnapshot" original={event.taskItemTitle} /></p> : null}
              {event.detail ? <p className="mt-1">{String(event.id || "").startsWith("action-") ? (
                <EntityTranslatedText entityType="PMV2_ITEM_ACTION" entityId={Number(String(event.id).replace("action-", ""))} field="note" original={event.detail} />
              ) : (
                <Pmv2LocalizedTimelineText value={event.detail} taskItemId={event.taskItemId} taskItemTitle={event.taskItemTitle} />
              )}</p> : null}
              {(event.roleLabel || event.responsibleUserName) ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {p("الجهة")}: {event.roleLabel ? localizePmv2ServerText(language, event.roleLabel) : "—"}{event.responsibleUserName ? ` — ${event.responsibleUserName}` : ""}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TaskReportCard({ task, technicianUserId }: { task: any; technicianUserId: number | null }) {
  const { p, language } = usePmv2Text();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const current = task.currentResponsibility;

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold">{task.taskNumber}</span>
              {outcomeBadge(task, language)}
              {task.carryOver ? <Badge variant="secondary">{p("مرحّلة")}</Badge> : null}
              {task.hasOpenVisit ? <Badge className="border-red-200 bg-red-50 text-red-800 hover:bg-red-50">{p("زيارة ما زالت مفتوحة")}</Badge> : null}
            </div>
            <p className="font-medium"><EntityTranslatedText entityType="PMV2_CHECKLIST" entityId={Number(task.checklistId)} field="name" original={task.checklistName} /></p>
            <p className="text-sm text-muted-foreground">{task.targetLabel} • {p("فريق {code}", { code: task.teamCode })}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm lg:text-start">
            <span className="text-muted-foreground">{p("أول نشاط")}</span><span className="font-medium">{formatTime(task.firstActivityAt, language)}</span>
            <span className="text-muted-foreground">{p("آخر نشاط")}</span><span className="font-medium">{formatTime(task.lastActivityAt, language)}</span>
            <span className="text-muted-foreground">{p("وقت الزيارات اليوم")}</span><span className="font-medium">{formatDuration(task.visitMinutesToday, language)}</span>
          </div>
        </div>

        {technicianUserId ? (
          <div className={`rounded-lg border p-3 text-sm ${task.technicianParticipatedToday ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50/60"}`}>
            <span className="font-medium">{p("مشاركة الفني المحدد اليوم:")} </span>
            {task.technicianParticipatedToday ? p("نعم — توجد زيارة أو إجراء مسجل باسمه") : p("لا توجد مشاركة مسجلة باسمه اليوم")}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> {p("المشاركون اليوم")}</div>
            {task.participants.length ? (
              <div className="flex flex-wrap gap-2">
                {task.participants.map((participant: any) => (
                  <Badge key={participant.userId} variant="secondary">
                    {participant.name}{participant.isLeader ? ` — ${p("قائد الزيارة")}` : ""}
                  </Badge>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">{p("لا توجد مشاركة مسجلة اليوم.")}</p>}
          </div>

          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2 font-semibold"><MessageSquareText className="h-4 w-4" /> {p("ملاحظات الفني")}</div>
            {task.notes.length ? (
              <div className="space-y-2">
                {task.notes.map((note: any) => (
                  <div key={note.actionId} className="rounded-md bg-muted/50 p-2 text-sm">
                    <p className="font-medium"><EntityTranslatedText entityType="PMV2_TASK_ITEM" entityId={Number(note.taskItemId)} field="titleSnapshot" original={note.taskItemTitle} /></p>
                    <p className="mt-1 whitespace-pre-wrap"><EntityTranslatedText entityType="PMV2_ITEM_ACTION" entityId={Number(note.actionId)} field="note" original={note.note} /></p>
                    <p className="mt-1 text-xs text-muted-foreground">{note.performedByName} • {formatTime(note.at, language)}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">{p("لا توجد ملاحظة فنية مسجلة اليوم لهذه المهمة.")}</p>}
          </div>
        </div>

        {task.status !== "completed" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{p("الوضع الحالي للمهمة")}</p>
                <p className="mt-1 text-sm">{current?.stageLabel ? localizePmv2ServerText(language, current.stageLabel) : statusLabel(task.status, language)}</p>
                {current ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p("الجهة صاحبة الإجراء:")} {localizePmv2ServerText(language, current.roleLabel)}
                    {current.responsibleUserName ? ` — ${current.responsibleUserName}` : ` — ${p("غير معيّن لشخص")}`}
                  </p>
                ) : null}
              </div>
              {current?.since ? <Badge variant="outline">{p("منذ {duration}", { duration: formatSince(current.since, language) })}</Badge> : null}
            </div>
          </div>
        ) : null}

        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <div className="flex flex-wrap gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">
                {detailsOpen ? <ChevronUp className="ms-1 h-4 w-4" /> : <ChevronDown className="ms-1 h-4 w-4" />}
                {detailsOpen ? p("إخفاء تفاصيل البنود") : p("تفاصيل البنود")}
              </Button>
            </CollapsibleTrigger>
            <Button variant="outline" size="sm" onClick={() => setTimelineOpen((value) => !value)}>
              <History className="ms-1 h-4 w-4" />
              {timelineOpen ? p("إخفاء المسار") : p("عرض المسار الكامل")}
            </Button>
          </div>

          <CollapsibleContent className="pt-3">
            <div className="space-y-2">
              {task.items.map((item: any) => (
                <div key={item.id} className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium"><EntityTranslatedText entityType="PMV2_TASK_ITEM" entityId={Number(item.id)} field="titleSnapshot" original={item.title} /></span>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{statusLabel(item.status, language)}</Badge>
                    {item.result ? <Badge variant="secondary">{resultLabel(item.result, language)}</Badge> : null}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {timelineOpen ? <TimelineDetails taskId={task.id} /> : null}
      </CardContent>
    </Card>
  );
}

function ReportSection({ title, description, tasks, technicianUserId }: { title: string; description: string; tasks: any[]; technicianUserId: number | null }) {
  const { p } = usePmv2Text();
  return (
    <section className="space-y-3">
      <div>
        <div className="flex items-center gap-2"><h2 className="text-lg font-bold">{title}</h2><Badge variant="secondary">{tasks.length}</Badge></div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {tasks.length ? tasks.map((task) => <TaskReportCard key={task.id} task={task} technicianUserId={technicianUserId} />) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{p("لا توجد مهام في هذا القسم.")}</div>
      )}
    </section>
  );
}

export default function Pmv2MaintenanceReports() {
  const { p, language, dir } = usePmv2Text();
  const [date, setDate] = useState(riyadhToday());
  const [teamId, setTeamId] = useState("all");
  const [technicianUserId, setTechnicianUserId] = useState("all");
  const [reviewNote, setReviewNote] = useState("");
  const utils = trpc.useUtils();

  const filtersQuery = trpc.pmv2.reports.filters.useQuery();
  const reportQuery = trpc.pmv2.reports.daily.useQuery({
    date,
    teamId: teamId === "all" ? undefined : Number(teamId),
    technicianUserId: technicianUserId === "all" ? undefined : Number(technicianUserId),
  });

  const markReviewed = trpc.pmv2.reports.markReviewed.useMutation({
    onSuccess: async () => {
      toast.success(p("تم تسجيل مراجعة التقرير"));
      setReviewNote("");
      await utils.pmv2.reports.daily.invalidate();
    },
    onError: (error) => toast.error(localizeApiError(error.message)),
  });
  const clearReview = trpc.pmv2.reports.clearReview.useMutation({
    onSuccess: async () => {
      toast.success(p("تم إلغاء علامة المراجعة"));
      await utils.pmv2.reports.daily.invalidate();
    },
    onError: (error) => toast.error(localizeApiError(error.message)),
  });

  const technicians = useMemo(() => {
    const all = filtersQuery.data?.technicians ?? [];
    const scoped = teamId === "all" ? all : all.filter((item: any) => Number(item.teamId) === Number(teamId));
    const byUser = new Map<number, { userId: number; name: string; teamCodes: string[] }>();
    for (const item of scoped as any[]) {
      const userId = Number(item.userId);
      const current = byUser.get(userId) ?? { userId, name: item.name, teamCodes: [] };
      if (!current.teamCodes.includes(String(item.teamCode))) current.teamCodes.push(String(item.teamCode));
      byUser.set(userId, current);
    }
    return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name, localeFor(language)));
  }, [filtersQuery.data?.technicians, teamId]);

  const report = reportQuery.data;
  const selectedTechnicianId = technicianUserId === "all" ? null : Number(technicianUserId);
  const scheduledTasks = report?.tasks.filter((task: any) => task.scheduledForDate) ?? [];
  const completed = scheduledTasks.filter((task: any) => task.outcome === "completed");
  const pending = scheduledTasks.filter((task: any) => task.outcome === "worked_pending");
  const notStarted = scheduledTasks.filter((task: any) => task.outcome === "not_started");
  const carryOver = report?.tasks.filter((task: any) => task.carryOver) ?? [];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6" dir={dir}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><FileText className="h-7 w-7 text-primary" /><h1 className="text-2xl font-bold">{p("تقارير الصيانة المجدولة")}</h1></div>
          <p className="mt-1 text-sm text-muted-foreground">{p("مقارنة التكليف اليومي بالتنفيذ الفعلي، مع المعلّق وسببه ومكانه الحالي وملاحظات الفني لكل مهمة.")}</p>
        </div>
        <Button variant="outline" onClick={() => reportQuery.refetch()} disabled={reportQuery.isFetching}>
          <RefreshCcw className={`ms-2 h-4 w-4 ${reportQuery.isFetching ? "animate-spin" : ""}`} /> {p("تحديث")}
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="report-date">{p("اليوم")}</Label>
            <Input id="report-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{p("الفريق")}</Label>
            <Select value={teamId} onValueChange={(value) => { setTeamId(value); setTechnicianUserId("all"); }}>
              <SelectTrigger><SelectValue placeholder={p("كل الفرق")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{p("كل الفرق")}</SelectItem>
                {(filtersQuery.data?.teams ?? []).map((team: any) => <SelectItem key={team.id} value={String(team.id)}>{p("فريق {code}", { code: team.code })}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{p("الفني")}</Label>
            <Select value={technicianUserId} onValueChange={setTechnicianUserId}>
              <SelectTrigger><SelectValue placeholder={p("كل الفنيين")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{p("كل الفنيين")}</SelectItem>
                {technicians.map((tech: any) => <SelectItem key={tech.userId} value={String(tech.userId)}>{tech.name} — {tech.teamCodes.join(language === "en" ? ", " : "، ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {reportQuery.error ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{localizeApiError(reportQuery.error.message)}</div> : null}
      {reportQuery.isLoading ? <div className="rounded-lg border p-10 text-center text-muted-foreground">{p("جاري إعداد التقرير اليومي...")}</div> : null}

      {report ? (
        <>
          <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">{selectedTechnicianId ? p("PM V2 يكلّف المهمة على مستوى الفريق؛ مقارنة الفني تعرض مهام فريقه مع مشاركته الفعلية المسجلة في الزيارات والإجراءات.") : p("التكليف في PM V2 على مستوى الفريق، والتقرير يقارن مهام الفريق المجدولة بما تم تنفيذه فعليًا.")}</div>

          {teamId !== "all" ? (
            <Card className={report.review ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/30"}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{p("مراجعة مدير الصيانة لتقرير الفريق")}</p>
                      {report.review ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">{p("تمت المراجعة")}</Badge> : <Badge variant="outline">{p("لم تتم المراجعة")}</Badge>}
                    </div>
                    {report.review ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {p("بواسطة {name} • {date}", { name: report.review.reviewerName, date: formatDateTime(report.review.reviewedAt, language) })}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">{p("بعد مراجعة المنجز والمعلق وملاحظات الفني يمكن تثبيت أن تقرير هذا الفريق تمت مراجعته.")}</p>
                    )}
                  </div>
                  {report.review ? (
                    <Button variant="outline" size="sm" disabled={clearReview.isPending} onClick={() => clearReview.mutate({ date, teamId: Number(teamId) })}>{p("إلغاء المراجعة")}</Button>
                  ) : null}
                </div>

                {report.review?.note ? <div className="rounded-md border bg-background/70 p-3 text-sm"><span className="font-medium">{p("ملاحظة المراجع:")} </span><EntityTranslatedText entityType="PMV2_DAILY_REPORT_REVIEW" entityId={Number(report.review.id)} field="note" original={report.review.note} /></div> : null}

                {!report.review && technicianUserId === "all" ? (
                  <div className="space-y-2">
                    <Label htmlFor="review-note">{p("ملاحظة المراجع — اختيارية")}</Label>
                    <Textarea id="review-note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} maxLength={1000} placeholder={p("أي ملاحظة إدارية على تقرير الفريق لهذا اليوم")} />
                    <Button disabled={markReviewed.isPending} onClick={() => markReviewed.mutate({ date, teamId: Number(teamId), note: reviewNote.trim() || null })}>
                      <ClipboardCheck className="ms-2 h-4 w-4" /> {p("تسجيل المراجعة")}
                    </Button>
                  </div>
                ) : !report.review && technicianUserId !== "all" ? (
                  <p className="text-xs text-muted-foreground">{p("تسجيل المراجعة يخص تقرير الفريق كاملًا؛ اختر «كل الفنيين» لتسجيلها.")}</p>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{p("اختر فريقًا محددًا إذا أردت تسجيل أن تقريره اليومي تمت مراجعته.")}</div>
          )}

          {selectedTechnicianId ? (
            <Card className="border-blue-200 bg-blue-50/40">
              <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
                <div><p className="text-sm text-muted-foreground">{p("شارك الفني في مهام اليوم")}</p><p className="mt-1 text-xl font-bold">{report.summary.technicianParticipatedAssigned} {p("من")} {report.summary.assignedToday}</p></div>
                <div><p className="text-sm text-muted-foreground">{p("شارك في مهام أُنجزت اليوم")}</p><p className="mt-1 text-xl font-bold">{report.summary.technicianParticipatedCompleted}</p></div>
                <div><p className="text-sm text-muted-foreground">{p("وقت زيارات الفني المسجل")}</p><p className="mt-1 text-xl font-bold">{formatDuration(report.summary.technicianVisitMinutesToday, language)}</p></div>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground"><ClipboardCheck className="h-4 w-4" /> {p("المكلف اليوم")}</div><p className="mt-2 text-2xl font-bold">{report.summary.assignedToday}</p></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {p("المنجز")}</div><p className="mt-2 text-2xl font-bold">{report.summary.completedToday}</p></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-amber-700"><Wrench className="h-4 w-4" /> {p("بدأ ومعلق")}</div><p className="mt-2 text-2xl font-bold">{report.summary.workedPending}</p></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground"><Clock3 className="h-4 w-4" /> {p("لم يبدأ")}</div><p className="mt-2 text-2xl font-bold">{report.summary.notStarted}</p></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-blue-700"><History className="h-4 w-4" /> {p("مرحل مفتوح")}</div><p className="mt-2 text-2xl font-bold">{report.summary.carryOverOpen}</p></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground"><UserRoundCheck className="h-4 w-4" /> {p("فنيون نشطون")}</div><p className="mt-2 text-2xl font-bold">{report.summary.techniciansActive}</p></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" /> {p("نسبة الإنجاز")}</div><p className="mt-2 text-2xl font-bold">{report.summary.completionRate}%</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{p("ملخص اليوم")}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">{p("إجمالي وقت الزيارات المسجل اليوم")}</p><p className="mt-1 font-bold">{formatDuration(report.summary.visitMinutesToday, language)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">{p("مهام مرحلة تم العمل عليها اليوم")}</p><p className="mt-1 font-bold">{report.summary.carryOverWorked}</p></div>
              <div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">{p("مهام بها زيارة مفتوحة")}</p><p className="mt-1 font-bold">{report.summary.openVisits}</p></div>
              <div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">{p("وقت إنشاء التقرير")}</p><p className="mt-1 font-bold">{formatDateTime(report.generatedAt, language)}</p></div>
            </CardContent>
          </Card>

          <ReportSection title={p("تم إنجازه اليوم")} description={p("المهام المجدولة لهذا اليوم التي اكتملت فعليًا.")} tasks={completed} technicianUserId={selectedTechnicianId} />
          <ReportSection title={p("بدأت ولم تكتمل")} description={p("المهام التي عمل عليها الفريق اليوم وما زالت معلقة؛ يظهر السبب والجهة والمسؤول الحالي.")} tasks={pending} technicianUserId={selectedTechnicianId} />
          <ReportSection title={p("لم تبدأ اليوم")} description={p("مهام كانت ضمن جدول اليوم ولم يسجل عليها بدء تنفيذ أو زيارة.")} tasks={notStarted} technicianUserId={selectedTechnicianId} />
          <ReportSection title={p("المهام المرحلة المفتوحة")} description={p("مهام من أيام سابقة ما زالت مفتوحة، ويظهر وضعها الحالي ومكان الإجراء الآن.")} tasks={carryOver} technicianUserId={selectedTechnicianId} />
        </>
      ) : null}
    </div>
  );
}
