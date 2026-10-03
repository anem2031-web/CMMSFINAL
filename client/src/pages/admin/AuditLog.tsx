import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, Search, Filter, ChevronDown, ChevronUp, Eye, User, Calendar, FileText, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { ExportButton } from "@/components/common/ExportButton";
import { useTranslation, useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700 border-emerald-200",
  update: "bg-blue-100 text-blue-700 border-blue-200",
  delete: "bg-red-100 text-red-700 border-red-200",
  import_create: "bg-emerald-100 text-emerald-700 border-emerald-200",
  import_update: "bg-blue-100 text-blue-700 border-blue-200",
  import_commit: "bg-indigo-100 text-indigo-700 border-indigo-200",
  assign_supplier_to_item: "bg-amber-100 text-amber-700 border-amber-200",
  update_item_supplier_link: "bg-blue-100 text-blue-700 border-blue-200",
  restore_item_supplier_link: "bg-emerald-100 text-emerald-700 border-emerald-200",
  remove_supplier_from_item: "bg-red-100 text-red-700 border-red-200",
  set_preferred_supplier: "bg-yellow-100 text-yellow-700 border-yellow-200",
  unset_preferred_supplier: "bg-gray-100 text-gray-700 border-gray-200",
  create_supplier_alias: "bg-amber-100 text-amber-700 border-amber-200",
  create_supplier_item_alias: "bg-teal-100 text-teal-700 border-teal-200",
  confirm_supplier_item_alias: "bg-cyan-100 text-cyan-700 border-cyan-200",
  create_item_candidate: "bg-teal-100 text-teal-700 border-teal-200",
  create_supplier_candidate: "bg-orange-100 text-orange-700 border-orange-200",
  add_attachment: "bg-violet-100 text-violet-700 border-violet-200",
  delete_attachment: "bg-red-100 text-red-700 border-red-200",
  approve: "bg-teal-100 text-teal-700 border-teal-200",
  reject: "bg-rose-100 text-rose-700 border-rose-200",
  assign: "bg-amber-100 text-amber-700 border-amber-200",
  login: "bg-gray-100 text-gray-700 border-gray-200",
  status_change: "bg-violet-100 text-violet-700 border-violet-200",
  purchase: "bg-cyan-100 text-cyan-700 border-cyan-200",
  receive: "bg-lime-100 text-lime-700 border-lime-200",
  deliver: "bg-indigo-100 text-indigo-700 border-indigo-200",
  pwa_update_now: "bg-blue-100 text-blue-700 border-blue-200",
  pwa_update_deferred: "bg-amber-100 text-amber-700 border-amber-200",
  pwa_update_forced: "bg-red-100 text-red-700 border-red-200",
};

const ACTION_ICONS: Record<string, string> = {
  create: "➕",
  update: "✏️",
  delete: "🗑️",
  import_create: "📥",
  import_update: "📥",
  import_commit: "📦",
  assign_supplier_to_item: "🔗",
  update_item_supplier_link: "✏️",
  restore_item_supplier_link: "♻️",
  remove_supplier_from_item: "🔓",
  set_preferred_supplier: "⭐",
  unset_preferred_supplier: "☆",
  create_supplier_alias: "🏷️",
  create_supplier_item_alias: "🔗",
  confirm_supplier_item_alias: "✅",
  create_item_candidate: "🆕",
  create_supplier_candidate: "🆕",
  add_attachment: "🖼️",
  delete_attachment: "🗑️",
  approve: "✅",
  reject: "❌",
  assign: "👤",
  login: "🔑",
  status_change: "🔄",
  purchase: "🛒",
  receive: "📦",
  deliver: "🚚",
  pwa_update_now: "🔄",
  pwa_update_deferred: "⏳",
  pwa_update_forced: "⚠️",
};

const ENTITY_COLORS: Record<string, string> = {
  ticket: "bg-blue-50 text-blue-700",
  purchase_order: "bg-amber-50 text-amber-700",
  purchase_order_item: "bg-orange-50 text-orange-700",
  inventory: "bg-green-50 text-green-700",
  site: "bg-purple-50 text-purple-700",
  user: "bg-red-50 text-red-700",
  notification: "bg-cyan-50 text-cyan-700",
  item: "bg-emerald-50 text-emerald-700",
  node: "bg-violet-50 text-violet-700",
  unit: "bg-cyan-50 text-cyan-700",
  supplier: "bg-amber-50 text-amber-700",
  catalog_item: "bg-emerald-50 text-emerald-700",
  item_supplier: "bg-amber-50 text-amber-700",
  supplier_alias: "bg-orange-50 text-orange-700",
  supplier_item_alias: "bg-teal-50 text-teal-700",
  catalog_import: "bg-indigo-50 text-indigo-700",
  catalog_ai_matching: "bg-cyan-50 text-cyan-700",
  catalog_item_candidate: "bg-teal-50 text-teal-700",
  supplier_candidate: "bg-orange-50 text-orange-700",
  application_update: "bg-blue-50 text-blue-700",
};

export default function AuditLog() {
  const { user } = useAuth();
  const { t: tr } = useLanguage();
  const { t, language } = useTranslation();
  const locale = language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US";
  const isRTL = language === "ar" || language === "ur";

  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [detailLog, setDetailLog] = useState<any>(null);

  const canViewAudit = user?.role === "owner" || user?.role === "admin";
  const queryFilters = {
    ...(actionFilter !== "all" ? { action: actionFilter } : {}),
    ...(entityFilter !== "all" ? { entityType: entityFilter } : {}),
  } as any;

  const { data: systemLogs, isLoading: systemLogsLoading } = trpc.audit.list.useQuery(
    queryFilters,
    { enabled: canViewAudit }
  );
  const { data: catalogLogs, isLoading: catalogLogsLoading } = trpc.catalog.audit.list.useQuery(
    queryFilters,
    { enabled: canViewAudit }
  );
  const { data: users } = trpc.users.list.useQuery();

  const logs = useMemo(() => {
    const system = (systemLogs || []).map((log: any) => ({ ...log, auditSource: "system" }));
    const catalog = catalogLogs || [];
    return [...system, ...catalog]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 500);
  }, [systemLogs, catalogLogs]);
  const isLoading = systemLogsLoading || catalogLogsLoading;

  const getActionLabel = (action: string) => {
    const pwaLabels: Record<string, Record<string, string>> = {
      ar: {
        pwa_update_now: "اختار تحديث الآن",
        pwa_update_deferred: "اختار لاحقًا",
        pwa_update_forced: "تحديث إجباري",
      },
      en: {
        pwa_update_now: "Chose update now",
        pwa_update_deferred: "Chose later",
        pwa_update_forced: "Forced update",
      },
      ur: {
        pwa_update_now: "ابھی اپ ڈیٹ منتخب کیا",
        pwa_update_deferred: "بعد میں منتخب کیا",
        pwa_update_forced: "لازمی اپ ڈیٹ",
      },
    };
    const catalogLabels: Record<string, Record<string, string>> = {
      ar: {
        import_create: "إنشاء عبر استيراد الكتالوج",
        import_update: "تعديل عبر استيراد الكتالوج",
        import_commit: "اعتماد استيراد الكتالوج",
        assign_supplier_to_item: "ربط مورد بصنف",
        update_item_supplier_link: "تعديل ربط مورد بصنف",
        restore_item_supplier_link: "إعادة تفعيل ربط مورد بصنف",
        remove_supplier_from_item: "فك ربط مورد من صنف",
        set_preferred_supplier: "تحديد المورد المفضل",
        unset_preferred_supplier: "إلغاء المورد المفضل",
        create_supplier_alias: "إضافة اسم بديل للمورد",
        create_supplier_item_alias: "إضافة ذاكرة صنف للمورد",
        confirm_supplier_item_alias: "تأكيد ذاكرة صنف للمورد",
        create_item_candidate: "إنشاء مرشح صنف جديد",
        create_supplier_candidate: "إنشاء مرشح مورد جديد",
        add_attachment: "إضافة صورة/مرفق",
        delete_attachment: "حذف صورة/مرفق",
      },
      en: {
        import_create: "Create via catalog import",
        import_update: "Update via catalog import",
        import_commit: "Commit catalog import",
        assign_supplier_to_item: "Link supplier to item",
        update_item_supplier_link: "Update item supplier link",
        restore_item_supplier_link: "Restore item supplier link",
        remove_supplier_from_item: "Unlink supplier from item",
        set_preferred_supplier: "Set preferred supplier",
        unset_preferred_supplier: "Unset preferred supplier",
        create_supplier_alias: "Create supplier alias",
        create_supplier_item_alias: "Create supplier item memory",
        confirm_supplier_item_alias: "Confirm supplier item memory",
        create_item_candidate: "Create item candidate",
        create_supplier_candidate: "Create supplier candidate",
        add_attachment: "Add image/attachment",
        delete_attachment: "Delete image/attachment",
      },
      ur: {
        import_create: "کیٹلاگ درآمد سے نیا ریکارڈ",
        import_update: "کیٹلاگ درآمد سے ترمیم",
        import_commit: "کیٹلاگ درآمد منظور",
        assign_supplier_to_item: "سپلائر کو آئٹم سے جوڑنا",
        update_item_supplier_link: "سپلائر-آئٹم ربط میں ترمیم",
        restore_item_supplier_link: "سپلائر-آئٹم ربط بحال",
        remove_supplier_from_item: "سپلائر کا ربط ختم",
        set_preferred_supplier: "ترجیحی سپلائر مقرر",
        unset_preferred_supplier: "ترجیحی سپلائر ختم",
        create_supplier_alias: "سپلائر متبادل نام شامل",
        create_supplier_item_alias: "سپلائر آئٹم یادداشت شامل",
        confirm_supplier_item_alias: "سپلائر آئٹم یادداشت کی تصدیق",
        create_item_candidate: "نیا آئٹم امیدوار",
        create_supplier_candidate: "نیا سپلائر امیدوار",
        add_attachment: "تصویر/منسلکہ شامل",
        delete_attachment: "تصویر/منسلکہ حذف",
      },
    };
    return pwaLabels[language]?.[action] || catalogLabels[language]?.[action] || (t.audit as any)[action] || action;
  };
  const getUserName = (userId: number | null) => {
    if (!userId) return t.common.all;
    const u = users?.find(u => u.id === userId);
    return u?.name || u?.email || `#${userId}`;
  };

  const getEntityLabel = (entityType: string) => {
    const labels: Record<string, string> = {
      ticket: language === "ar" ? "بلاغ" : language === "ur" ? "ٹکٹ" : "Ticket",
      purchase_order: language === "ar" ? "طلب شراء" : language === "ur" ? "خریداری آرڈر" : "Purchase Order",
      purchase_order_item: language === "ar" ? "صنف طلب شراء" : language === "ur" ? "خریداری آئٹم" : "PO Item",
      inventory: language === "ar" ? "مخزون" : language === "ur" ? "انوینٹری" : "Inventory",
      site: language === "ar" ? "موقع" : language === "ur" ? "سائٹ" : "Site",
      user: language === "ar" ? "مستخدم" : language === "ur" ? "صارف" : "User",
      notification: language === "ar" ? "إشعار" : language === "ur" ? "اطلاع" : "Notification",
      item: language === "ar" ? "صنف الكتالوج" : language === "ur" ? "کیٹلاگ آئٹم" : "Catalog Item",
      node: language === "ar" ? "تصنيف الكتالوج" : language === "ur" ? "کیٹلاگ زمرہ" : "Catalog Category",
      unit: language === "ar" ? "وحدة قياس" : language === "ur" ? "پیمائش یونٹ" : "Catalog Unit",
      supplier: language === "ar" ? "مورد الكتالوج" : language === "ur" ? "کیٹلاگ سپلائر" : "Catalog Supplier",
      catalog_item: language === "ar" ? "صورة/مرفق صنف الكتالوج" : language === "ur" ? "کیٹلاگ آئٹم منسلکہ" : "Catalog Item Attachment",
      item_supplier: language === "ar" ? "ربط الصنف بالمورد" : language === "ur" ? "آئٹم-سپلائر ربط" : "Item Supplier Link",
      supplier_alias: language === "ar" ? "اسم بديل للمورد" : language === "ur" ? "سپلائر متبادل نام" : "Supplier Alias",
      supplier_item_alias: language === "ar" ? "ذاكرة صنف المورد" : language === "ur" ? "سپلائر آئٹم یادداشت" : "Supplier Item Memory",
      catalog_import: language === "ar" ? "استيراد الكتالوج" : language === "ur" ? "کیٹلاگ درآمد" : "Catalog Import",
      catalog_ai_matching: language === "ar" ? "مطابقة الكتالوج الذكية" : language === "ur" ? "کیٹلاگ AI میچنگ" : "Catalog AI Matching",
      catalog_item_candidate: language === "ar" ? "مرشح صنف" : language === "ur" ? "آئٹم امیدوار" : "Item Candidate",
      supplier_candidate: language === "ar" ? "مرشح مورد" : language === "ur" ? "سپلائر امیدوار" : "Supplier Candidate",
      application_update: language === "ar" ? "تحديث التطبيق" : language === "ur" ? "ایپ اپ ڈیٹ" : "Application Update",
    };
    return labels[entityType] || entityType;
  };

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter((log: any) => {
      const actor = getUserName(log.userId).toLowerCase();
      const entity = getEntityLabel(log.entityType).toLowerCase();
      const action = getActionLabel(log.action).toLowerCase();
      const details = log.details ? JSON.stringify(log.details).toLowerCase() : "";
      const oldValues = log.oldValues ? JSON.stringify(log.oldValues).toLowerCase() : "";
      const newValues = log.newValues ? JSON.stringify(log.newValues).toLowerCase() : "";
      return actor.includes(q) || entity.includes(q) || action.includes(q) || details.includes(q) || oldValues.includes(q) || newValues.includes(q) || String(log.entityId).includes(q);
    });
  }, [logs, searchQuery, users]);

  const parseMaybeJson = (value: any) => {
    if (value === null || value === undefined || value === "") return undefined;
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const parseChanges = (log: any) => {
    const oldValues = parseMaybeJson(log.oldValues);
    const newValues = parseMaybeJson(log.newValues);
    if (oldValues !== undefined || newValues !== undefined) {
      return { oldValues, newValues };
    }
    if (!log.details) return null;
    try {
      const details = typeof log.details === "string" ? JSON.parse(log.details) : log.details;
      if (details.oldValues && details.newValues) {
        return { oldValues: details.oldValues, newValues: details.newValues };
      }
      if (details.changes) return { changes: details.changes };
      return { raw: details };
    } catch {
      return { raw: log.details };
    }
  };

  const uniqueActions = useMemo(() => {
    if (!logs) return [];
    return Array.from(new Set(logs.map((l: any) => l.action)));
  }, [logs]);

  const uniqueEntities = useMemo(() => {
    if (!logs) return [];
    return Array.from(new Set(logs.map((l: any) => l.entityType)));
  }, [logs]);

  if (user && !canViewAudit) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">
            {language === "ar" ? "ليس لديك صلاحية لعرض سجل التدقيق" : "You do not have permission to view the audit log"}
          </h3>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            {t.audit.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredLogs.length} {language === "ar" ? "سجل" : language === "ur" ? "ریکارڈ" : "records"}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton endpoint="audit-logs" filename="audit-logs" />
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4" />
            {t.common.filter}
            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Search className={`w-4 h-4 absolute top-3 ${isRTL ? "right-3" : "left-3"} text-muted-foreground`} />
                <Input
                  placeholder={t.common.search + "..."}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={isRTL ? "pr-9" : "pl-9"}
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t.audit.action} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.common.all} - {t.audit.action}</SelectItem>
                  {uniqueActions.map(a => (
                    <SelectItem key={a} value={a}>
                      <span className="flex items-center gap-2">
                        <span>{ACTION_ICONS[a] || "📋"}</span>
                        {getActionLabel(a)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "نوع الكيان" : "Entity Type"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.common.all} - {language === "ar" ? "الكيانات" : "Entities"}</SelectItem>
                  {uniqueEntities.map(e => (
                    <SelectItem key={e} value={e}>{getEntityLabel(e)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs List */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-14 w-full" /></CardContent></Card>)}</div>
      ) : !filteredLogs?.length ? (
        <Card><CardContent className="p-12 text-center">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">{t.common.noData}</h3>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log: any) => {
            const changes = parseChanges(log);
            const hasDetails = changes && (changes.oldValues || changes.newValues || changes.changes || changes.raw);
            return (
              <Card key={`${log.auditSource || "system"}:${log.id}`} className={`hover:shadow-md transition-all duration-200 ${log.action === "delete" ? "border-l-4 border-l-red-400" : log.action === "update" ? "border-l-4 border-l-blue-400" : log.action === "create" ? "border-l-4 border-l-emerald-400" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="text-xl shrink-0">{ACTION_ICONS[log.action] || "📋"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge className={`text-[10px] ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-700"}`}>
                            {getActionLabel(log.action)}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${ENTITY_COLORS[log.entityType] || ""}`}>
                            {getEntityLabel(log.entityType)} {log.entityId ? `#${log.entityId}` : ""}
                          </Badge>
                          {log.auditSource === "catalog" && (
                            <Badge variant="secondary" className="text-[10px]">Catalog Audit</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {getUserName(log.userId)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(log.createdAt).toLocaleString(locale, {
                              year: "numeric", month: "2-digit", day: "2-digit",
                              hour: "2-digit", minute: "2-digit", second: "2-digit",
                            })}
                          </span>
                        </div>
                        {/* Inline preview of changes */}
                        {changes?.oldValues && changes?.newValues && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {Object.keys(changes.newValues).slice(0, 3).map(key => (
                              <span key={key} className="inline-flex items-center gap-1 text-[10px] bg-muted rounded-md px-1.5 py-0.5">
                                <span className="font-medium">{key}:</span>
                                <span className="text-red-600 line-through">{String(changes.oldValues[key] ?? "-").slice(0, 20)}</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                                <span className="text-green-600">{String(changes.newValues[key] ?? "-").slice(0, 20)}</span>
                              </span>
                            ))}
                            {Object.keys(changes.newValues).length > 3 && (
                              <span className="text-[10px] text-muted-foreground">+{Object.keys(changes.newValues).length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {hasDetails && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setDetailLog(log)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {t.common.details} - {detailLog && getActionLabel(detailLog.action)} {detailLog && getEntityLabel(detailLog.entityType)}
            </DialogTitle>
          </DialogHeader>
          {detailLog && (() => {
            const changes = parseChanges(detailLog);
            return (
              <div className="space-y-4">
                {/* Meta info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <span className="text-muted-foreground text-xs block mb-1">{t.audit.action}</span>
                    <Badge className={`${ACTION_COLORS[detailLog.action] || "bg-gray-100"}`}>
                      {ACTION_ICONS[detailLog.action]} {getActionLabel(detailLog.action)}
                    </Badge>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <span className="text-muted-foreground text-xs block mb-1">{language === "ar" ? "الكيان" : "Entity"}</span>
                    <span className="font-medium">{getEntityLabel(detailLog.entityType)}{detailLog.entityId ? ` #${detailLog.entityId}` : ""}</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <span className="text-muted-foreground text-xs block mb-1">{language === "ar" ? "المستخدم" : "User"}</span>
                    <span className="font-medium">{getUserName(detailLog.userId)}</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <span className="text-muted-foreground text-xs block mb-1">{t.common.date}</span>
                    <span className="font-medium">{new Date(detailLog.createdAt).toLocaleString(locale)}</span>
                  </div>
                </div>

                {/* Changes diff */}
                {changes?.oldValues && changes?.newValues && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">{language === "ar" ? "التغييرات" : "Changes"}</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-start p-2 text-xs font-medium">{language === "ar" ? "الحقل" : "Field"}</th>
                            <th className="text-start p-2 text-xs font-medium text-red-600">{language === "ar" ? "القيمة القديمة" : "Old Value"}</th>
                            <th className="text-start p-2 text-xs font-medium text-green-600">{language === "ar" ? "القيمة الجديدة" : "New Value"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(changes.newValues).map(key => (
                            <tr key={key} className="border-t">
                              <td className="p-2 font-medium text-xs">{key}</td>
                              <td className="p-2 text-xs text-red-600 bg-red-50/50">
                                {String(changes.oldValues[key] ?? "-")}
                              </td>
                              <td className="p-2 text-xs text-green-600 bg-green-50/50">
                                {String(changes.newValues[key] ?? "-")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!changes?.oldValues && changes?.newValues && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">{language === "ar" ? "القيم الجديدة" : "New Values"}</h4>
                    <pre className="bg-muted/50 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap" dir="ltr">
                      {typeof changes.newValues === "string" ? changes.newValues : JSON.stringify(changes.newValues, null, 2)}
                    </pre>
                  </div>
                )}

                {changes?.oldValues && !changes?.newValues && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">{language === "ar" ? "القيم السابقة" : "Previous Values"}</h4>
                    <pre className="bg-muted/50 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap" dir="ltr">
                      {typeof changes.oldValues === "string" ? changes.oldValues : JSON.stringify(changes.oldValues, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Raw details */}
                {changes?.raw && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">{t.common.details}</h4>
                    <pre className="bg-muted/50 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap" dir="ltr">
                      {typeof changes.raw === "string" ? changes.raw : JSON.stringify(changes.raw, null, 2)}
                    </pre>
                  </div>
                )}

                {changes?.changes && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">{language === "ar" ? "التغييرات" : "Changes"}</h4>
                    <pre className="bg-muted/50 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap" dir="ltr">
                      {JSON.stringify(changes.changes, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
