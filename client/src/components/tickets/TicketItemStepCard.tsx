import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";
import { STATUS_COLORS } from "@shared/types";
import { TICKET_ITEM_STEPS, getTicketItemStepIndex } from "@/lib/ticketItemSteps";
import { useTranslation } from "@/contexts/LanguageContext";
import { EntityTranslatedText } from "@/components/i18n/EntityTranslatedText";

/**
 * بطاقة بند بلاغ — الخطوة 2 من ميزة "البلاغ متعدد الجهات والمسارات" (2026-08-08).
 * تعرض البند كأنه بلاغ مستقل: رقم + عنوان (من المطلوب من الجهة) + حالة + خطوات
 * تنفيذ مرتبة، بدل نص حر. مُستخدَمة من TicketDetail.tsx حاليًا، ومُصمَّمة لإعادة
 * الاستخدام لاحقًا من صفحات القوائم (بلاغات الإنشاءات، الصيانة العامة).
 */
export function TicketItemStepCard({
  item,
  getStatusLabel,
}: {
  item: {
    id: number;
    itemNumber: number;
    title?: string | null;
    description?: string | null;
    status: string;
    maintenancePath?: string | null;
    responsibleDepartment?: string | null;
    isLegacySingleItem?: number;
  };
  getStatusLabel: (status: string) => string;
}) {
  const { t } = useTranslation();
  const currentStep = getTicketItemStepIndex(item.status, item.maintenancePath);
  const departmentLabels: Record<string, string> = {
    maintenance_report_department_general: t.workflow.ticket.deptGeneral,
    maintenance_report_department_construction: t.workflow.ticket.deptConstruction,
    maintenance_report_department_it: t.workflow.ticket.deptIt,
  };
  const pathLabels: Record<string, string> = {
    A: t.workflow.ticket.pathDirect,
    B: t.workflow.ticket.pathPurchase,
    C: t.workflow.ticket.pathExternal,
  };
  const deptLabel = item.responsibleDepartment ? departmentLabels[item.responsibleDepartment] : null;
  const pathLabel = item.maintenancePath ? pathLabels[item.maintenancePath] : null;
  const stepLabels: Record<string, string> = {
    inspect: t.workflow.ticket.itemStepInspect,
    path: t.workflow.ticket.itemStepPath,
    execute: t.workflow.ticket.itemStepExecute,
    close: t.workflow.ticket.itemStepClose,
  };

  return (
    <div className="rounded-lg border bg-background p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground">{t.workflow.ticket.itemLabel} {item.itemNumber}</span>
          <Badge className={STATUS_COLORS[item.status] || "bg-gray-100 text-gray-700"}>
            {getStatusLabel(item.status)}
          </Badge>
          {deptLabel && <Badge variant="outline">{deptLabel}</Badge>}
          {pathLabel && <Badge variant="secondary">{t.workflow.ticket.pathLabel} {item.maintenancePath} — {pathLabel}</Badge>}
        </div>
      </div>

      {item.description && (
        <EntityTranslatedText as="p" className="text-sm" entityType="TICKET_ITEM" entityId={item.id} field="description" original={item.description} />
      )}

      {/* خطوات مرتبة بدل نص حر */}
      <div className="flex items-center gap-1.5 pt-1">
        {TICKET_ITEM_STEPS.map((step, idx) => (
          <div key={step.key} className="flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              {idx < currentStep ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : idx === currentStep ? (
                <Circle className="w-3.5 h-3.5 text-blue-600 fill-blue-100" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-muted-foreground/30" />
              )}
              <span className={`text-[11px] ${idx === currentStep ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {stepLabels[step.key] ?? step.label}
              </span>
            </div>
            {idx < TICKET_ITEM_STEPS.length - 1 && (
              <div className={`w-3 h-px ${idx < currentStep ? "bg-emerald-400" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
