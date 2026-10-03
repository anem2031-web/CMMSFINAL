import { useState, useEffect } from "react";
import { Clock, AlertTriangle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/contexts/LanguageContext";

interface SLATimerProps {
  createdAt: number | Date;
  statusChangedAt?: number | Date | null;
  statusLabel?: string;
  compact?: boolean;
}

function getElapsed(from: number | Date): { hours: number; minutes: number; totalHours: number } {
  const fromMs = from instanceof Date ? from.getTime() : from;
  const diffMs = Date.now() - fromMs;
  const totalHours = diffMs / (1000 * 60 * 60);
  const hours = Math.floor(totalHours);
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return { hours, minutes, totalHours };
}

function formatElapsed(hours: number, minutes: number, labels: { minute: string; hour: string; day: string; and: string }): string {
  if (hours === 0) return `${minutes} ${labels.minute}`;
  if (hours < 24) return `${hours} ${labels.hour}${minutes > 0 ? ` ${labels.and} ${minutes} ${labels.minute}` : ""}`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days} ${labels.day}${remHours > 0 ? ` ${labels.and} ${remHours} ${labels.hour}` : ""}`;
}

export function SLATimer({ createdAt, statusChangedAt, statusLabel, compact = false }: SLATimerProps) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(() => getElapsed(statusChangedAt || createdAt));

  useEffect(() => {
    const interval = setInterval(() => setElapsed(getElapsed(statusChangedAt || createdAt)), 60_000);
    return () => clearInterval(interval);
  }, [createdAt, statusChangedAt]);

  const { hours, minutes, totalHours } = elapsed;
  const isRed = totalHours >= 48;
  const isOrange = totalHours >= 24 && !isRed;
  const colorClass = isRed
    ? "text-red-600 bg-red-50 border-red-200"
    : isOrange
    ? "text-orange-600 bg-orange-50 border-orange-200"
    : "text-emerald-600 bg-emerald-50 border-emerald-200";
  const Icon = isRed ? AlertCircle : isOrange ? AlertTriangle : Clock;
  const duration = formatElapsed(hours, minutes, {
    minute: t.workflow.ticket.slaMinute,
    hour: t.workflow.ticket.slaHour,
    day: t.workflow.ticket.slaDay,
    and: t.workflow.ticket.slaAnd,
  });
  const label = statusLabel ? `${statusLabel} ${t.workflow.ticket.slaSince} ${duration}` : `${t.workflow.ticket.slaSince} ${duration}`;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`gap-1 text-xs font-medium border ${colorClass} cursor-default`}>
              <Icon className="h-3 w-3" />
              {duration}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{label}</p>
            {isRed && <p className="text-red-500 font-semibold">{t.workflow.ticket.slaOver48}</p>}
            {isOrange && <p className="text-orange-500 font-semibold">{t.workflow.ticket.slaOver24}</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${colorClass}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      {isRed && <span className="font-bold">⚠️</span>}
    </div>
  );
}

export function SLABadge({ createdAt, statusChangedAt }: { createdAt: number | Date; statusChangedAt?: number | Date | null }) {
  const { t } = useTranslation();
  const { totalHours } = getElapsed(statusChangedAt || createdAt);
  if (totalHours >= 48) {
    return <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold"><AlertCircle className="h-3 w-3" />{t.workflow.ticket.slaVeryLate}</span>;
  }
  if (totalHours >= 24) {
    return <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-semibold"><AlertTriangle className="h-3 w-3" />{t.workflow.ticket.slaNeedsReview}</span>;
  }
  return null;
}
