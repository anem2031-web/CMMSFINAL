import { useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

let allocationKeyCounter = 0;

export type IssueCostAllocationDraft = {
  key: string;
  beneficiarySiteId: string;
  beneficiarySectionId: string;
  beneficiaryAssetId: string;
  quantity: string;
};

export type IssueCostAllocationPayload = {
  beneficiarySiteId: number;
  beneficiarySectionId: number;
  beneficiaryAssetId?: number | null;
  quantity: number;
};

export function createIssueCostAllocationDraft(quantity = ""): IssueCostAllocationDraft {
  allocationKeyCounter += 1;
  return {
    key: `issue-cost-${allocationKeyCounter}`,
    beneficiarySiteId: "",
    beneficiarySectionId: "",
    beneficiaryAssetId: "",
    quantity,
  };
}

function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/**
 * كل عملية تسليم في الواجهة الحالية تخص جهة مستفيدة واحدة فقط.
 * كمية التحميل هي كامل كمية الصرف نفسها، لذلك لا نسمح بتقسيم الحركة
 * على عدة مواقع/أقسام داخل نفس عملية التسليم.
 */
export function buildIssueCostAllocationPayload(
  drafts: IssueCostAllocationDraft[],
  totalQuantity: number,
): IssueCostAllocationPayload[] {
  if (drafts.length !== 1) {
    throw new Error("كل عملية صرف يجب أن تُحمّل على جهة مستفيدة واحدة فقط");
  }

  const row = drafts[0];
  const siteId = Number(row.beneficiarySiteId);
  const sectionId = Number(row.beneficiarySectionId);
  const assetId = row.beneficiaryAssetId ? Number(row.beneficiaryAssetId) : null;
  const quantity = roundQuantity(Number(totalQuantity));

  if (!Number.isFinite(quantity) || quantity < 0.001) {
    throw new Error("أدخل كمية صرف صحيحة أولًا");
  }
  if (!Number.isInteger(siteId) || siteId <= 0) {
    throw new Error("اختر الموقع المستفيد");
  }
  if (!Number.isInteger(sectionId) || sectionId <= 0) {
    throw new Error("اختر القسم المستفيد");
  }
  if (assetId != null && (!Number.isInteger(assetId) || assetId <= 0)) {
    throw new Error("الأصل المحدد غير صالح");
  }

  return [{
    beneficiarySiteId: siteId,
    beneficiarySectionId: sectionId,
    beneficiaryAssetId: assetId,
    quantity,
  }];
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function IssueCostAllocationEditor({
  value,
  onChange,
  totalQuantity,
  lotUnitCost,
  unitLabel,
}: {
  value: IssueCostAllocationDraft[];
  onChange: (next: IssueCostAllocationDraft[]) => void;
  totalQuantity: number;
  lotUnitCost: number;
  unitLabel?: string;
}) {
  const { data: sites = [] } = trpc.sites.list.useQuery();
  const { data: sections = [] } = trpc.sections.list.useQuery(undefined);
  const { data: assets = [] } = trpc.assets.list.useQuery({});
  // حماية من أي state قديم أثناء hot reload: هذه الواجهة تقبل جهة واحدة فقط.
  useEffect(() => {
    if (value.length === 1) return;
    const quantity = roundQuantity(Number(totalQuantity || 0));
    onChange([
      value[0] ?? createIssueCostAllocationDraft(quantity > 0 ? String(quantity) : ""),
    ]);
  }, [value, onChange, totalQuantity]);

  // كمية الجهة هي كامل كمية الصرف؛ تتبع حقل الكمية الرئيسي تلقائيًا.
  useEffect(() => {
    if (value.length !== 1) return;
    const normalizedTotal = roundQuantity(Number(totalQuantity || 0));
    const current = value[0];
    const nextQuantity = normalizedTotal > 0 ? String(normalizedTotal) : "";
    if (current.quantity !== nextQuantity) {
      onChange([{ ...current, quantity: nextQuantity }]);
    }
  }, [totalQuantity, value, onChange]);

  const activeSites = useMemo(
    () => (sites as any[]).filter(site => Number(site.isActive ?? 1) !== 0),
    [sites],
  );

  const row = value[0];
  if (!row) return null;

  const siteId = row.beneficiarySiteId ? Number(row.beneficiarySiteId) : null;
  const sectionId = row.beneficiarySectionId ? Number(row.beneficiarySectionId) : null;

  const availableSections = (sections as any[]).filter(section =>
    Number(section.isActive ?? 1) !== 0 && siteId != null && Number(section.siteId) === siteId,
  );

  const availableAssets = (assets as any[]).filter(asset => {
    if (asset.status === "disposed") return false;
    if (siteId == null || sectionId == null) return false;
    if (Number(asset.siteId) !== siteId) return false;
    if (Number(asset.sectionId) !== sectionId) return false;
    return true;
  });

  const updateRow = (patch: Partial<IssueCostAllocationDraft>) => {
    onChange([{ ...row, ...patch }]);
  };

  const normalizedQuantity = roundQuantity(Number(totalQuantity || 0));
  const totalCost = normalizedQuantity * Number(lotUnitCost || 0);

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold">تحميل تكلفة الصرف</p>
        <p className="text-xs text-muted-foreground">
          حدّد الجهة المستفيدة من كامل كمية الصرف. الموقع والقسم إلزاميان، والأصل اختياري. التكلفة تُحسب تلقائيًا من اللوت المصروف.
        </p>
      </div>

      <div className="rounded-md border bg-background p-3 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">كمية الصرف</Label>
          <Input
            value={normalizedQuantity > 0 ? `${normalizedQuantity} ${unitLabel || "وحدة"}` : "أدخل الكمية أعلاه أولًا"}
            readOnly
            disabled
            className="bg-muted/40"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">الموقع *</Label>
          <Select
            value={row.beneficiarySiteId || undefined}
            onValueChange={site => updateRow({
              beneficiarySiteId: site,
              beneficiarySectionId: "",
              beneficiaryAssetId: "",
            })}
          >
            <SelectTrigger><SelectValue placeholder="اختر الموقع" /></SelectTrigger>
            <SelectContent>
              {activeSites.map((site: any) => (
                <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">القسم *</Label>
          <Select
            disabled={!siteId}
            value={row.beneficiarySectionId || undefined}
            onValueChange={section => updateRow({
              beneficiarySectionId: section,
              beneficiaryAssetId: "",
            })}
          >
            <SelectTrigger><SelectValue placeholder={siteId ? "اختر القسم" : "اختر الموقع أولًا"} /></SelectTrigger>
            <SelectContent>
              {availableSections.map((section: any) => (
                <SelectItem key={section.id} value={String(section.id)}>{section.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">الأصل (اختياري)</Label>
          <Select
            disabled={!siteId || !sectionId}
            value={row.beneficiaryAssetId || "__none__"}
            onValueChange={asset => updateRow({
              beneficiaryAssetId: asset === "__none__" ? "" : asset,
            })}
          >
            <SelectTrigger><SelectValue placeholder={sectionId ? "بدون أصل" : "اختر القسم أولًا"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">بدون أصل</SelectItem>
              {availableAssets.map((asset: any) => (
                <SelectItem key={asset.id} value={String(asset.id)}>
                  {asset.name}{asset.assetNumber ? ` — ${asset.assetNumber}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">تكلفة وحدة اللوت</span>
            <strong>{formatMoney(lotUnitCost)} ر.س</strong>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">تكلفة الصرف لهذه الجهة</span>
            <strong className="text-foreground">{formatMoney(totalCost)} ر.س</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
