import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { useStaticLabels } from "@/hooks/useContentTranslation";
import { AlertCircle, CheckCircle2, Clock, Wrench, TrendingUp, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

export default function Reports() {
  const { t } = useTranslation();
  const { getStatusLabel, getPriorityLabel } = useStaticLabels();
  const [, setLocation] = useLocation();
  
  // Data Queries
  const { data: byStatus, isLoading: l1 } = trpc.reports.ticketsByStatus.useQuery();
  const { data: byCategory, isLoading: l2 } = trpc.reports.ticketsByCategory.useQuery();
  const { data: byPriority, isLoading: l3 } = trpc.reports.ticketsByPriority.useQuery();
  const { data: monthly, isLoading: l5 } = trpc.reports.monthlySummary.useQuery();

  // Summary Calculations
  const openTickets = byStatus?.filter(d => d.status !== 'closed' && d.status !== 'cancelled')
    .reduce((sum, d) => sum + d.count, 0) || 0;
  
  const criticalTickets = byPriority?.find(d => d.priority === 'critical')?.count || 0;
  
  const currentMonthData = monthly?.[monthly.length - 1];
  const completedThisMonth = currentMonthData?.closed || 0;
  const createdThisMonth = currentMonthData?.created || 0;

  // Formatted Data for Tables
  const statusData = byStatus?.map(d => ({ label: getStatusLabel(d.status), value: d.count })) || [];
  const priorityData = byPriority?.map(d => ({ label: getPriorityLabel(d.priority), value: d.count })) || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      {/* Page Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 px-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t.reports.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.reports.overview}</p>
        </div>
      </div>

      {/* 1. EXECUTIVE SUMMARY STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard 
          title="البلاغات المفتوحة" 
          value={openTickets} 
          icon={<Wrench className="w-5 h-5 text-blue-500" />}
          loading={l1}
          onClick={() => setLocation('/tickets')}
          clickable
        />
        <SummaryCard 
          title="البلاغات الحرجة" 
          value={criticalTickets} 
          icon={<AlertCircle className="w-5 h-5 text-red-500" />}
          loading={l3}
          highlight={criticalTickets > 0}
          onClick={() => setLocation('/tickets')}
          clickable
        />
        <SummaryCard 
          title="أنجز هذا الشهر" 
          value={completedThisMonth} 
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          loading={l5}
        />
        <SummaryCard 
          title="بلاغات جديدة (شهر)" 
          value={createdThisMonth} 
          icon={<Clock className="w-5 h-5 text-amber-500" />}
          loading={l5}
        />
      </div>

      {/* 2. CALM OPERATIONAL PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution Table */}
        <Card className="lg:col-span-1 border-slate-200/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-50">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              {t.reports.ticketsByStatus}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {l1 ? <SkeletonList /> : (
              <div className="space-y-3">
                {statusData.length > 0 ? statusData.map((item, i) => (
                  <OperationalRow key={i} label={item.label} value={item.value} />
                )) : <EmptyState />}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Priority Distribution Table */}
        <Card className="lg:col-span-1 border-slate-200/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-50">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              {t.reports.ticketsByPriority}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {l3 ? <SkeletonList /> : (
              <div className="space-y-3">
                {priorityData.length > 0 ? priorityData.map((item, i) => (
                  <OperationalRow key={i} label={item.label} value={item.value} />
                )) : <EmptyState />}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. SIMPLIFIED VISUAL HIERARCHY - Monthly Operational Trend */}
        <Card className="lg:col-span-1 border-slate-200/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-50">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              {t.reports.monthlyTrend}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {l5 ? <Skeleton className="h-40 w-full" /> : monthly && monthly.length > 0 ? (
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthly} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="month" 
                      hide={false} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      dy={10}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '12px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="created" 
                      stroke="#94a3b8" 
                      strokeWidth={1.5} 
                      dot={false} 
                      activeDot={{ r: 4, strokeWidth: 0 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="closed" 
                      stroke="#10b981" 
                      strokeWidth={2} 
                      dot={false} 
                      activeDot={{ r: 4, strokeWidth: 0 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Sub-components for Cleanliness ---

function SummaryCard({ title, value, icon, loading, highlight, onClick, clickable }: any) {
  return (
    <Card 
      className={cn(
        "border-slate-200/60 shadow-sm overflow-hidden transition-all duration-200", 
        highlight && "border-red-100 bg-red-50/30",
        clickable && "cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50 active:scale-[0.98]"
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
            {loading ? <Skeleton className="h-8 w-16" /> : (
              <p className={cn("text-2xl font-bold text-slate-900 dark:text-slate-100", highlight && "text-red-600")}>
                {value}
              </p>
            )}
          </div>
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OperationalRow({ label, value }: { label: string, value: number }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-5 w-full" />)}
    </div>
  );
}

function EmptyState() {
  return <p className="text-xs text-muted-foreground text-center py-8 italic opacity-60">لا توجد بيانات كافية</p>;
}
