import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Building2, Layers, List, CircleCheck, Calendar, Clock,
  Flag, TrendingUp, AlertTriangle, Tag, Paperclip,
  CheckSquare, GitMerge, ChevronLeft, Plus, Trash2, Loader2,
  Save, DollarSign, Users, X, MessageSquare, Settings2,
  Package, MapPin, Hash
} from "lucide-react";

export type ModalEntityType = "project" | "phase" | "activity" | "task";
interface BreadcrumbItem { label: string; type: ModalEntityType }
interface Props {
  open: boolean;
  onClose: () => void;
  type: ModalEntityType;
  id: number;
  projectId: number;
  breadcrumb?: BreadcrumbItem[];
  onUpdated?: () => void;
}

const TYPE_LABELS: Record<ModalEntityType, string> = {
  project: "مشروع", phase: "مرحلة", activity: "نشاط", task: "مهمة",
};
const TYPE_ICONS: Record<ModalEntityType, React.ReactNode> = {
  project: <Building2 className="w-3.5 h-3.5" />,
  phase: <Layers className="w-3.5 h-3.5" />,
  activity: <List className="w-3.5 h-3.5" />,
  task: <CircleCheck className="w-3.5 h-3.5" />,
};
const TYPE_COLORS: Record<ModalEntityType, string> = {
  project: "bg-blue-50 text-blue-800 border-blue-200",
  phase: "bg-amber-50 text-amber-800 border-amber-200",
  activity: "bg-purple-50 text-purple-800 border-purple-200",
  task: "bg-teal-50 text-teal-800 border-teal-200",
};

const STATUS_OPTIONS = {
  project: [
    { value: "planning", label: "تخطيط", color: "bg-slate-100 text-slate-700" },
    { value: "active", label: "نشط", color: "bg-teal-100 text-teal-700" },
    { value: "on_hold", label: "موقوف", color: "bg-amber-100 text-amber-700" },
    { value: "completed", label: "مكتمل", color: "bg-green-100 text-green-700" },
    { value: "cancelled", label: "ملغي", color: "bg-red-100 text-red-700" },
  ],
  phase: [
    { value: "pending", label: "معلق", color: "bg-slate-100 text-slate-700" },
    { value: "active", label: "نشط", color: "bg-teal-100 text-teal-700" },
    { value: "on_hold", label: "موقوف", color: "bg-amber-100 text-amber-700" },
    { value: "completed", label: "مكتمل", color: "bg-green-100 text-green-700" },
  ],
  activity: [
    { value: "pending", label: "معلق", color: "bg-slate-100 text-slate-700" },
    { value: "active", label: "نشط", color: "bg-teal-100 text-teal-700" },
    { value: "on_hold", label: "موقوف", color: "bg-amber-100 text-amber-700" },
    { value: "completed", label: "مكتمل", color: "bg-green-100 text-green-700" },
  ],
  task: [
    { value: "new", label: "جديد", color: "bg-blue-100 text-blue-700" },
    { value: "in_progress", label: "قيد التنفيذ", color: "bg-teal-100 text-teal-700" },
    { value: "pending_approval", label: "انتظار موافقة", color: "bg-purple-100 text-purple-700" },
    { value: "pending_materials", label: "انتظار مواد", color: "bg-orange-100 text-orange-700" },
    { value: "on_hold", label: "موقوفة", color: "bg-amber-100 text-amber-700" },
    { value: "completed", label: "مكتملة", color: "bg-green-100 text-green-700" },
  ],
};

const PRIORITY_OPTIONS = [
  { value: "low", label: "منخفضة", color: "bg-slate-100 text-slate-700" },
  { value: "medium", label: "متوسطة", color: "bg-blue-100 text-blue-700" },
  { value: "high", label: "عالية", color: "bg-orange-100 text-orange-700" },
  { value: "critical", label: "حرجة", color: "bg-red-100 text-red-700" },
];

const ISSUE_LEVELS = [
  { value: "low", label: "منخفض" },
  { value: "medium", label: "متوسط" },
  { value: "high", label: "عالي" },
  { value: "critical", label: "حرج" },
];

type ChecklistItem = { id: string; text: string; done: boolean };
type AttachmentItem = { name: string; url: string; uploadedAt: string };
function genId() { return Math.random().toString(36).slice(2, 9); }

export default function ConstructionDetailModal({
  open, onClose, type, id, projectId, breadcrumb = [], onUpdated,
}: Props) {
  const utils = trpc.useUtils();

  // Data queries
  const projectQ = trpc.construction.projects.getById.useQuery({ id }, { enabled: open && type === "project" });
  const phaseQ = trpc.construction.phases.getById.useQuery({ id }, { enabled: open && type === "phase" });
  const taskQ = trpc.construction.tasks.getById.useQuery({ id }, { enabled: open && type === "task" });

  // Task-specific queries
  const commentsQ = trpc.construction.taskComments.list.useQuery(
    { taskId: id }, { enabled: open && type === "task" }
  );
  const quantityQ = trpc.construction.quantityTracking.list.useQuery(
    { taskId: id }, { enabled: open && type === "task" }
  );
  const customFieldsQ = trpc.construction.customFields.list.useQuery(
    { projectId }, { enabled: open && type === "task" }
  );
  const dependenciesQ = trpc.construction.taskDependencies.list.useQuery(
    { taskId: id }, { enabled: open && type === "task" }
  );

  const rawData = type === "project" ? projectQ.data
    : type === "phase" ? phaseQ.data
    : type === "task" ? taskQ.data
    : null;

  const isLoading = type === "project" ? projectQ.isLoading
    : type === "phase" ? phaseQ.isLoading
    : type === "task" ? taskQ.isLoading
    : false;

  const [tab, setTab] = useState("details");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [newCheckItem, setNewCheckItem] = useState("");
  const [newTag, setNewTag] = useState("");

  const [fields, setFields] = useState({
    name: "", description: "", status: "", priority: "medium",
    startDatePlanned: "", endDatePlanned: "",
    budgetPlanned: "", budgetActual: "", laborCost: "",
    estimatedHours: "", actualHours: "",
    issueLevel: "" as string,
    tags: [] as string[],
    locationDetail: "",
  });
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!rawData) return;
    const d = rawData as any;
    setFields({
      name: d.name ?? d.title ?? "",
      description: d.description ?? "",
      status: d.status ?? "",
      priority: d.priority ?? "medium",
      startDatePlanned: d.startDatePlanned ?? "",
      endDatePlanned: d.endDatePlanned ?? "",
      budgetPlanned: d.budgetPlanned ?? d.estimatedCost ?? "",
      budgetActual: d.budgetActual ?? d.actualCost ?? "",
      laborCost: d.laborCost ?? "",
      estimatedHours: d.estimatedHours ?? "",
      actualHours: d.actualHours ?? "",
      issueLevel: d.issueLevel ?? "",
      tags: d.tags ?? [],
      locationDetail: d.locationDetail ?? "",
    });
    setChecklist(d.checklist ?? []);
    setAttachments(d.attachments ?? []);
    setDirty(false);
  }, [rawData]);

  const set = (key: string, val: any) => { setFields(f => ({ ...f, [key]: val })); setDirty(true); };

  // Mutations
  const updateProject = trpc.construction.projects.update.useMutation({
    onSuccess: () => { toast.success("تم الحفظ"); setSaving(false); setDirty(false); utils.construction.projects.getById.invalidate({ id }); onUpdated?.(); },
    onError: e => { toast.error(e.message); setSaving(false); },
  });
  const updatePhase = trpc.construction.phases.update.useMutation({
    onSuccess: () => { toast.success("تم الحفظ"); setSaving(false); setDirty(false); utils.construction.phases.list.invalidate({ projectId }); onUpdated?.(); },
    onError: e => { toast.error(e.message); setSaving(false); },
  });
  const updateActivity = trpc.construction.activities.update.useMutation({
    onSuccess: () => { toast.success("تم الحفظ"); setSaving(false); setDirty(false); utils.construction.activities.listByProject.invalidate({ projectId }); onUpdated?.(); },
    onError: e => { toast.error(e.message); setSaving(false); },
  });
  const updateTask = trpc.construction.tasks.update.useMutation({
    onSuccess: () => { toast.success("تم الحفظ"); setSaving(false); setDirty(false); utils.construction.tasks.getById.invalidate({ id }); onUpdated?.(); },
    onError: e => { toast.error(e.message); setSaving(false); },
  });
  const createComment = trpc.construction.taskComments.create.useMutation({
    onSuccess: () => { commentsQ.refetch(); setNewComment(""); toast.success("تم إضافة التعليق"); },
    onError: e => toast.error(e.message),
  });

  const handleSave = () => {
    setSaving(true);
    const common = {
      id,
      description: fields.description || undefined,
      status: fields.status as any || undefined,
      startDatePlanned: fields.startDatePlanned || undefined,
      endDatePlanned: fields.endDatePlanned || undefined,
      laborCost: fields.laborCost || undefined,
      issueLevel: (fields.issueLevel as any) || undefined,
      tags: fields.tags,
      checklist,
      attachments,
    };
    if (type === "project") {
      updateProject.mutate({ ...common, name: fields.name, budgetPlanned: fields.budgetPlanned || undefined, budgetActual: fields.budgetActual || undefined, priority: fields.priority as any });
    } else if (type === "phase") {
      updatePhase.mutate({ ...common, name: fields.name, budgetPlanned: fields.budgetPlanned || undefined, budgetActual: fields.budgetActual || undefined });
    } else if (type === "activity") {
      updateActivity.mutate({ ...common, name: fields.name, budgetPlanned: fields.budgetPlanned || undefined, budgetActual: fields.budgetActual || undefined });
    } else if (type === "task") {
      updateTask.mutate({ ...common, title: fields.name, estimatedCost: fields.budgetPlanned || undefined, actualCost: fields.budgetActual || undefined, estimatedHours: fields.estimatedHours || undefined, actualHours: fields.actualHours || undefined, priority: fields.priority as any, locationDetail: fields.locationDetail || undefined });
    }
  };

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    setChecklist(c => [...c, { id: genId(), text: newCheckItem.trim(), done: false }]);
    setNewCheckItem(""); setDirty(true);
  };
  const toggleCheck = (itemId: string) => { setChecklist(c => c.map(i => i.id === itemId ? { ...i, done: !i.done } : i)); setDirty(true); };
  const removeCheck = (itemId: string) => { setChecklist(c => c.filter(i => i.id !== itemId)); setDirty(true); };
  const addTag = () => {
    const t = newTag.trim();
    if (!t || fields.tags.includes(t)) return;
    set("tags", [...fields.tags, t]); setNewTag("");
  };
  const removeTag = (tag: string) => set("tags", fields.tags.filter(t => t !== tag));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const newAtt: AttachmentItem = { name: file.name, url: URL.createObjectURL(file), uploadedAt: new Date().toISOString() };
    setAttachments(a => [...a, newAtt]);
    setDirty(true);
    e.target.value = "";
  };

  const d = rawData as any;
  const progress = d?.progressPercent ? Number(d.progressPercent) : 0;
  const statusOptions = STATUS_OPTIONS[type];
  const currentStatus = statusOptions.find(s => s.value === fields.status);
  const currentPriority = PRIORITY_OPTIONS.find(p => p.value === fields.priority);
  const entityNumber = d?.projectNumber ?? d?.taskNumber ?? null;
  const checkDone = checklist.filter(i => i.done).length;
  const checkTotal = checklist.length;

  const tabs = [
    { value: "details", label: "التفاصيل" },
    { value: "costs", label: "التكاليف" },
    { value: "checklist", label: `القائمة (${checkTotal})` },
    { value: "tags", label: "العلامات" },
    ...(type === "task" ? [
      { value: "comments", label: "التعليقات" },
      { value: "quantities", label: "الكميات" },
      { value: "custom", label: "الحقول المخصصة" },
    ] : []),
    { value: "activity", label: "السجل" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0" dir="rtl">

        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <div className="flex items-center gap-1.5 px-5 py-2 bg-slate-50 border-b border-slate-100 text-xs text-slate-500 flex-wrap">
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronLeft className="w-3 h-3" />}
                <span className={i === breadcrumb.length - 1 ? "text-[#1A2B4A] font-medium" : ""}>{b.label}</span>
              </span>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="px-5 pt-3 pb-3 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Type badge + number */}
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${TYPE_COLORS[type]}`}>
                  {TYPE_ICONS[type]} {TYPE_LABELS[type]}
                </span>
                {entityNumber && (
                  <span className="flex items-center gap-1 text-xs font-mono text-slate-400">
                    <Hash className="w-3 h-3" />{entityNumber}
                  </span>
                )}
                {(type === "project" || type === "task") && currentPriority && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${currentPriority.color}`}>
                    {currentPriority.label}
                  </span>
                )}
              </div>
              {/* Editable name */}
              <Input
                value={fields.name}
                onChange={e => set("name", e.target.value)}
                className="text-lg font-semibold border-0 p-0 h-auto text-[#1A2B4A] focus-visible:ring-0 bg-transparent"
                placeholder="الاسم"
              />
            </div>
            {dirty && (
              <Button size="sm" onClick={handleSave} disabled={saving}
                className="bg-[#E07B39] hover:bg-[#c96b2e] text-white gap-1.5 flex-shrink-0">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                حفظ
              </Button>
            )}
          </div>

          {/* Progress bar */}
          {progress > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> الإنجاز</span>
                <span className="font-semibold text-[#1A2B4A]">{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Quick info row */}
          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
            {fields.startDatePlanned && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Calendar className="w-3 h-3" /> {fields.startDatePlanned}
              </span>
            )}
            {fields.endDatePlanned && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                → {fields.endDatePlanned}
              </span>
            )}
            {type === "task" && fields.estimatedHours && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3 h-3" /> {fields.estimatedHours} ساعة مقدرة
              </span>
            )}
            {type === "task" && fields.actualHours && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                / {fields.actualHours} فعلية
              </span>
            )}
          </div>

          {/* Action buttons — task only */}
          {type === "task" && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                <Paperclip className="w-3.5 h-3.5" /> إرفاق ملف
              </button>
              <button onClick={() => setTab("checklist")}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                <CheckSquare className="w-3.5 h-3.5" /> قائمة مهام
              </button>
              <button onClick={() => setTab("details")}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                <GitMerge className="w-3.5 h-3.5" /> تبعيات
              </button>
              <button onClick={() => setTab("details")}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                <MapPin className="w-3.5 h-3.5" /> الموقع
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Tabs */}
            <div className="flex border-b border-slate-100 px-5 overflow-x-auto">
              {tabs.map(t => (
                <button key={t.value} onClick={() => setTab(t.value)}
                  className={`text-sm px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${
                    tab === t.value ? "border-[#0D9488] text-[#0D9488] font-medium" : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Details Tab ── */}
            {tab === "details" && (
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">الوصف</label>
                  <Textarea value={fields.description} onChange={e => set("description", e.target.value)}
                    placeholder="أضف وصفاً أو استخدم الذكاء الاصطناعي لتوليد محتوى..."
                    rows={3} className="text-right resize-none text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Status */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5" /> الحالة
                    </label>
                    <Select value={fields.status} onValueChange={v => set("status", v)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(s => (
                          <SelectItem key={s.value} value={s.value}>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${s.color}`}>{s.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority */}
                  {(type === "project" || type === "task") && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                        <Flag className="w-3.5 h-3.5" /> الأولوية
                      </label>
                      <Select value={fields.priority} onValueChange={v => set("priority", v)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map(p => (
                            <SelectItem key={p.value} value={p.value}>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${p.color}`}>{p.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Start Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> تاريخ البدء
                    </label>
                    <Input type="date" value={fields.startDatePlanned}
                      onChange={e => set("startDatePlanned", e.target.value)} className="h-9 text-sm" />
                  </div>

                  {/* End Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> تاريخ الانتهاء
                    </label>
                    <Input type="date" value={fields.endDatePlanned}
                      onChange={e => set("endDatePlanned", e.target.value)} className="h-9 text-sm" />
                  </div>

                  {/* Hours — task only */}
                  {type === "task" && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> الساعات المقدرة
                        </label>
                        <Input type="number" min={0} placeholder="0" value={fields.estimatedHours}
                          onChange={e => set("estimatedHours", e.target.value)} className="h-9 text-sm text-center" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> الساعات الفعلية
                        </label>
                        <Input type="number" min={0} placeholder="0" value={fields.actualHours}
                          onChange={e => set("actualHours", e.target.value)} className="h-9 text-sm text-center" />
                      </div>
                    </>
                  )}

                  {/* Issue Level */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> مستوى المشكلة
                    </label>
                    <Select value={fields.issueLevel || "none"} onValueChange={v => set("issueLevel", v === "none" ? "" : v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="غير محدد" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— غير محدد</SelectItem>
                        {ISSUE_LEVELS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Location — task only */}
                  {type === "task" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" /> موقع العمل
                      </label>
                      <Input placeholder="مثال: الدور الثالث" value={fields.locationDetail}
                        onChange={e => set("locationDetail", e.target.value)} className="h-9 text-sm" />
                    </div>
                  )}
                </div>

                {/* Stats */}
                {d?.stats && (
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <p className="text-xl font-bold text-[#0D9488]">{d.stats.taskTotal ?? 0}</p>
                      <p className="text-xs text-slate-500 mt-0.5">إجمالي المهام</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <p className="text-xl font-bold text-[#16A34A]">{d.stats.taskCompleted ?? 0}</p>
                      <p className="text-xs text-slate-500 mt-0.5">مكتملة</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <p className="text-xl font-bold text-[#DC2626]">{d.stats.taskOverdue ?? 0}</p>
                      <p className="text-xs text-slate-500 mt-0.5">متأخرة</p>
                    </div>
                  </div>
                )}

                {/* Attachments list */}
                {attachments.length > 0 && (
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5" /> المرفقات ({attachments.length})
                    </p>
                    <div className="space-y-1.5">
                      {attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg group">
                          <Paperclip className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <a href={att.url} target="_blank" rel="noopener noreferrer"
                            className="flex-1 text-xs text-[#0D9488] hover:underline truncate">{att.name}</a>
                          <button onClick={() => { setAttachments(a => a.filter((_, j) => j !== i)); setDirty(true); }}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Costs Tab ── */}
            {tab === "costs" && (
              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-blue-500" /> التكلفة المخططة (ر.س)
                  </label>
                  <Input type="number" min={0} placeholder="0.00" value={fields.budgetPlanned}
                    onChange={e => set("budgetPlanned", e.target.value)} className="h-10 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-teal-500" /> التكلفة الفعلية (ر.س)
                  </label>
                  <Input type="number" min={0} placeholder="0.00" value={fields.budgetActual}
                    onChange={e => set("budgetActual", e.target.value)} className="h-10 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-500" /> تكلفة العمالة (ر.س)
                  </label>
                  <Input type="number" min={0} placeholder="0.00" value={fields.laborCost}
                    onChange={e => set("laborCost", e.target.value)} className="h-10 text-sm" />
                </div>
                {(fields.budgetPlanned || fields.budgetActual || fields.laborCost) && (
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-2">
                    <p className="text-xs font-medium text-slate-500">ملخص التكاليف</p>
                    {fields.budgetPlanned && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">المخططة</span>
                        <span className="font-medium text-blue-700">{Number(fields.budgetPlanned).toLocaleString()} ر.س</span>
                      </div>
                    )}
                    {fields.budgetActual && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">الفعلية</span>
                        <span className="font-medium text-teal-700">{Number(fields.budgetActual).toLocaleString()} ر.س</span>
                      </div>
                    )}
                    {fields.laborCost && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">العمالة</span>
                        <span className="font-medium text-amber-700">{Number(fields.laborCost).toLocaleString()} ر.س</span>
                      </div>
                    )}
                    {fields.budgetPlanned && fields.budgetActual && (
                      <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-medium">
                        <span className="text-slate-600">الفرق</span>
                        <span className={Number(fields.budgetActual) > Number(fields.budgetPlanned) ? "text-red-600" : "text-green-600"}>
                          {(Number(fields.budgetActual) - Number(fields.budgetPlanned)).toLocaleString()} ر.س
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Checklist Tab ── */}
            {tab === "checklist" && (
              <div className="p-5 space-y-3">
                {checkTotal > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                      <span>التقدم</span>
                      <span>{checkDone} / {checkTotal}</span>
                    </div>
                    <Progress value={checkTotal > 0 ? (checkDone / checkTotal) * 100 : 0} className="h-1.5" />
                  </div>
                )}
                <div className="space-y-1.5">
                  {checklist.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 group">
                      <Checkbox checked={item.done} onCheckedChange={() => toggleCheck(item.id)} />
                      <span className={`flex-1 text-sm ${item.done ? "line-through text-slate-400" : "text-slate-700"}`}>{item.text}</span>
                      <button onClick={() => removeCheck(item.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <Input placeholder="أضف بنداً..." value={newCheckItem}
                    onChange={e => setNewCheckItem(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addCheckItem()}
                    className="text-right text-sm h-9" />
                  <Button size="sm" variant="outline" onClick={addCheckItem} disabled={!newCheckItem.trim()}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Tags Tab ── */}
            {tab === "tags" && (
              <div className="p-5 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {fields.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#E1F5EE] text-[#085041] text-xs rounded-full font-medium">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                  {fields.tags.length === 0 && <p className="text-sm text-slate-400">لا توجد علامات بعد</p>}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="علامة جديدة..." value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addTag()}
                    className="text-right text-sm h-9" />
                  <Button size="sm" variant="outline" onClick={addTag} disabled={!newTag.trim()}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Comments Tab (task only) ── */}
            {tab === "comments" && type === "task" && (
              <div className="p-5 space-y-4">
                <div className="space-y-3">
                  {commentsQ.data && commentsQ.data.length > 0 ? (
                    commentsQ.data.map(c => (
                      <div key={c.id} className="flex gap-3 pb-3 border-b border-slate-100 last:border-0">
                        <div className="w-8 h-8 rounded-full bg-[#E1F5EE] flex items-center justify-center text-[#085041] text-xs font-medium flex-shrink-0">
                          {c.userName?.charAt(0) ?? "؟"}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium text-[#1A2B4A]">{c.userName}</span>
                            <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString("ar-SA")}</span>
                          </div>
                          <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">{c.comment}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm">لا توجد تعليقات بعد</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Input placeholder="اكتب تعليقاً..." value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && newComment.trim() && createComment.mutate({ taskId: id, projectId, comment: newComment.trim() })}
                    className="text-right text-sm h-9" />
                  <Button size="sm" onClick={() => { if (newComment.trim()) createComment.mutate({ taskId: id, projectId, comment: newComment.trim() }); }}
                    disabled={!newComment.trim() || createComment.isPending}
                    className="bg-[#0D9488] hover:bg-[#0b7e6e] text-white">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Quantities Tab (task only) ── */}
            {tab === "quantities" && type === "task" && (
              <div className="p-5">
                {quantityQ.data && quantityQ.data.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2 text-xs font-medium text-slate-500 pb-2 border-b border-slate-100">
                      <span>المادة</span><span className="text-center">الوحدة</span>
                      <span className="text-center">مخطط</span><span className="text-center">فعلي</span>
                    </div>
                    {quantityQ.data.map(q => (
                      <div key={q.id} className="grid grid-cols-4 gap-2 text-sm py-2 border-b border-slate-50 last:border-0">
                        <span className="text-[#1A2B4A] font-medium">{q.materialName}</span>
                        <span className="text-center text-slate-500">{q.unit}</span>
                        <span className="text-center text-blue-700">{Number(q.quantityPlanned ?? 0).toLocaleString()}</span>
                        <span className="text-center text-teal-700">{Number(q.quantityActual ?? 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">لا توجد كميات مسجلة</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Custom Fields Tab (task only) ── */}
            {tab === "custom" && type === "task" && (
              <div className="p-5">
                {customFieldsQ.data && customFieldsQ.data.length > 0 ? (
                  <div className="space-y-3">
                    {customFieldsQ.data.map(field => {
                      const val = (taskQ.data as any)?.fieldValues?.find((fv: any) => fv.field?.id === field.id);
                      return (
                        <div key={field.id} className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                            <Settings2 className="w-3.5 h-3.5" /> {field.name}
                            {field.isRequired && <span className="text-red-500">*</span>}
                          </label>
                          <Input placeholder={`أدخل ${field.name}...`}
                            defaultValue={val?.value?.value ?? ""}
                            className="h-9 text-sm" readOnly />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Settings2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">لا توجد حقول مخصصة</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Activity Log Tab ── */}
            {tab === "activity" && (
              <div className="p-5 space-y-3">
                {d?.comments && d.comments.length > 0 ? (
                  d.comments.map((c: any) => (
                    <div key={c.id} className="flex gap-3 pb-3 border-b border-slate-100 last:border-0">
                      <div className="w-7 h-7 rounded-full bg-[#E1F5EE] flex items-center justify-center text-[#085041] text-xs font-medium flex-shrink-0">
                        {c.userName?.charAt(0) ?? "؟"}
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-[#1A2B4A]">{c.userName}</span>
                          <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString("ar-SA")}</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">{c.comment}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">لا يوجد سجل نشاط بعد</p>
                  </div>
                )}
                {d?.createdAt && (
                  <div className="flex items-center gap-2 pt-2 text-xs text-slate-400 border-t border-slate-100">
                    <div className="w-2 h-2 rounded-full bg-[#1D9E75]" />
                    <span>تم الإنشاء في {new Date(d.createdAt).toLocaleDateString("ar-SA")}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {currentStatus && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${currentStatus.color}`}>
                {currentStatus.label}
              </span>
            )}
            {(type === "project" || type === "task") && currentPriority && (
              <span className={`text-xs px-2.5 py-1 rounded-full ${currentPriority.color}`}>
                {currentPriority.label}
              </span>
            )}
            {fields.tags.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Tag className="w-3 h-3" /> {fields.tags.length} علامة
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>إغلاق</Button>
            {dirty && (
              <Button size="sm" onClick={handleSave} disabled={saving}
                className="bg-[#E07B39] hover:bg-[#c96b2e] text-white gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                حفظ التغييرات
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
