import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TechnicianCombobox } from "@/components/tickets/TechnicianCombobox";
import {
  IssueCostAllocationEditor,
  buildIssueCostAllocationPayload,
  createIssueCostAllocationDraft,
  type IssueCostAllocationDraft,
} from "@/components/inventory/IssueCostAllocationEditor";
import { printWarehouseIssueDocument } from "@/lib/printWarehouseIssueDocument";
import { toast } from "sonner";
import {
  Eye,
  FileText,
  History,
  Loader2,
  PackagePlus,
  Printer,
  QrCode,
  ScanLine,
  Trash2,
  Truck,
  Warehouse,
} from "lucide-react";

const MAX_LINES = 20;

type DraftLine = {
  inventoryId: number;
  lotId: number;
  lotCode: string;
  trackingToken: string;
  itemName: string;
  internalCode?: string | null;
  unit: string;
  availableQuantity: number;
  quantity: number;
  lotIssueUnitCost: number;
  costAllocationDrafts: IssueCostAllocationDraft[];
  linkedToTicket: boolean;
  ticketNumber?: string | null;
  assignedTechnicianName?: string | null;
  poNumber?: string | null;
  pmv2TaskNumber?: string | null;
};

function formatQty(value: number) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 3 });
}

function formatDateTime(value: unknown) {
  if (!value) return "—";
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ar-SA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createCostAllocationDraftsFromSuggestion(suggestion: any): IssueCostAllocationDraft[] {
  const draft = createIssueCostAllocationDraft();
  if (!suggestion) return [draft];
  return [{
    ...draft,
    beneficiarySiteId: suggestion.beneficiarySiteId ? String(suggestion.beneficiarySiteId) : "",
    beneficiarySectionId: suggestion.beneficiarySectionId ? String(suggestion.beneficiarySectionId) : "",
    beneficiaryAssetId: suggestion.beneficiaryAssetId ? String(suggestion.beneficiaryAssetId) : "",
  }];
}

export default function WarehouseIssue() {
  const utils = trpc.useUtils();
  const { data: warehouses = [] } = trpc.warehouse.list.useQuery();
  const { data: allUsers = [] } = trpc.users.list.useQuery();
  const { data: sites = [] } = trpc.sites.list.useQuery();
  const { data: sections = [] } = trpc.sections.list.useQuery(undefined);
  const { data: assets = [] } = trpc.assets.list.useQuery({});
  const { data: lotTrackingStatus } = trpc.inventoryCount.lotTrackingStatus.useQuery();
  const { data: issueHistory = [] } = trpc.warehouseIssueBatches.list.useQuery();
  const lotsEnabled = !!lotTrackingStatus?.enabled;

  const [warehouseId, setWarehouseId] = useState("");
  const [deliveredToId, setDeliveredToId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [lastCreatedId, setLastCreatedId] = useState<number | null>(null);
  const [historyDetailId, setHistoryDetailId] = useState<number | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [lotIdentifier, setLotIdentifier] = useState("");
  const [resolvedLot, setResolvedLot] = useState<any>(null);
  const [quantity, setQuantity] = useState("");
  const [costAllocationDrafts, setCostAllocationDrafts] = useState<IssueCostAllocationDraft[]>(() => [createIssueCostAllocationDraft()]);

  useEffect(() => {
    if (warehouseId || !(warehouses as any[]).length) return;
    const main = (warehouses as any[]).find((warehouse: any) => warehouse.type === "main" && Number(warehouse.isActive ?? 1) !== 0);
    const first = main || (warehouses as any[]).find((warehouse: any) => Number(warehouse.isActive ?? 1) !== 0);
    if (first) setWarehouseId(String(first.id));
  }, [warehouses, warehouseId]);

  const selectedWarehouse = useMemo(
    () => (warehouses as any[]).find((warehouse: any) => String(warehouse.id) === warehouseId),
    [warehouses, warehouseId],
  );
  const selectedRecipient = useMemo(
    () => (allUsers as any[]).find((user: any) => String(user.id) === deliveredToId),
    [allUsers, deliveredToId],
  );
  const technicianOptions = useMemo(
    () => (allUsers as any[])
      .filter((user: any) => user.role === "technician" && Number(user.isActive ?? 1) !== 0)
      .map((user: any) => ({ value: String(user.id), label: user.name })),
    [allUsers],
  );
  const siteNames = useMemo(
    () => new Map((sites as any[]).map((site: any) => [Number(site.id), String(site.name || `موقع #${site.id}`)])),
    [sites],
  );
  const sectionNames = useMemo(
    () => new Map((sections as any[]).map((section: any) => [Number(section.id), String(section.name || `قسم #${section.id}`)])),
    [sections],
  );
  const assetNames = useMemo(
    () => new Map((assets as any[]).map((asset: any) => [Number(asset.id), String(asset.name || asset.assetNumber || `أصل #${asset.id}`)])),
    [assets],
  );

  const { data: lastCreated, refetch: refetchLastCreated } = trpc.warehouseIssueBatches.getById.useQuery(
    { id: lastCreatedId || 0 },
    { enabled: !!lastCreatedId },
  );

  const { data: historyDetail } = trpc.warehouseIssueBatches.getById.useQuery(
    { id: historyDetailId || 0 },
    { enabled: !!historyDetailId },
  );

  const resolveLotMut = trpc.warehouseIssueBatches.resolveLot.useMutation({
    onSuccess: (data: any) => {
      setResolvedLot(data);
      setQuantity("");
      setCostAllocationDrafts(createCostAllocationDraftsFromSuggestion(data.costTargetSuggestion));
      toast.success(`تم التعرف على الدفعة ${data.lotCode}`);
      if (data.costTargetSuggestion?.complete) {
        toast.info(`تمت تعبئة الموقع والقسم تلقائيًا من ${data.costTargetSuggestion.sourceLabel}`);
      }
    },
    onError: (error: any) => {
      setResolvedLot(null);
      toast.error(error.message || "تعذر التحقق من الدفعة");
    },
  });

  const createBatchMut = trpc.warehouseIssueBatches.create.useMutation({
    onSuccess: async (result: any) => {
      setLastCreatedId(Number(result.id));
      setLines([]);
      setNotes("");
      toast.success(`تم الصرف بنجاح — ${result.issueNumber}`);
      if (Array.isArray(result.warnings)) {
        result.warnings.forEach((warning: string) => toast.warning(warning));
      }
      await Promise.all([
        utils.warehouseIssueBatches.list.invalidate(),
        utils.deliveryDocuments.list.invalidate(),
        utils.inventory.list.invalidate(),
      ]);
    },
    onError: (error: any) => toast.error(error.message || "فشل اعتماد سند الصرف"),
  });

  const incrementPrintMut = trpc.warehouseIssueBatches.incrementPrint.useMutation();

  const resetAddDialog = () => {
    setLotIdentifier("");
    setResolvedLot(null);
    setQuantity("");
    setCostAllocationDrafts([createIssueCostAllocationDraft()]);
  };

  const openAddDialog = () => {
    if (!warehouseId) {
      toast.error("اختر المخزن المصدر أولًا");
      return;
    }
    if (!deliveredToId) {
      toast.error("اختر الفني المستلم أولًا");
      return;
    }
    if (!lotsEnabled) {
      toast.error("شاشة الصرف المخزني المتعدد تعتمد على تتبع اللوتات، وهو غير مفعّل حاليًا");
      return;
    }
    if (lines.length >= MAX_LINES) {
      toast.error(`الحد الأعلى ${MAX_LINES} بندًا في سند واحد`);
      return;
    }
    resetAddDialog();
    setAddOpen(true);
  };

  const resolveLot = () => {
    if (!warehouseId) return toast.error("اختر المخزن المصدر أولًا");
    const code = lotIdentifier.trim();
    if (!code) return toast.error("أدخل QR الدفعة أو رقم اللوت");
    resolveLotMut.mutate({ warehouseId: Number(warehouseId), code });
  };

  const addLine = () => {
    if (!resolvedLot) return toast.error("تحقق من اللوت أولًا");
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 0.001) return toast.error("أدخل كمية صرف صحيحة");
    if (qty > Number(resolvedLot.lotBalanceQuantity || 0)) {
      return toast.error(`الكمية أكبر من رصيد الدفعة (${formatQty(Number(resolvedLot.lotBalanceQuantity || 0))})`);
    }

    let allocationPayload;
    try {
      allocationPayload = buildIssueCostAllocationPayload(costAllocationDrafts, qty);
    } catch (error: any) {
      return toast.error(error?.message || "تحقق من تحميل تكلفة الصرف");
    }

    const newTarget = allocationPayload[0];
    const sameLotLines = lines.filter(
      line => line.inventoryId === Number(resolvedLot.inventoryId) && line.lotId === Number(resolvedLot.lotId),
    );
    const hasSameCostTarget = sameLotLines.some(line => {
      const existingTarget = buildIssueCostAllocationPayload(line.costAllocationDrafts, line.quantity)[0];
      return existingTarget.beneficiarySiteId === newTarget.beneficiarySiteId
        && existingTarget.beneficiarySectionId === newTarget.beneficiarySectionId
        && (existingTarget.beneficiaryAssetId ?? null) === (newTarget.beneficiaryAssetId ?? null);
    });
    if (hasSameCostTarget) {
      return toast.error("هذا اللوت مضاف بالفعل لنفس الموقع والقسم والأصل؛ غيّر الجهة المستفيدة أو عدّل السطر الموجود");
    }

    const alreadyReserved = sameLotLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    const requestedTotal = Math.round((alreadyReserved + qty + Number.EPSILON) * 1000) / 1000;
    if (requestedTotal > Number(resolvedLot.lotBalanceQuantity || 0)) {
      return toast.error(`إجمالي الكمية المطلوبة من الدفعة (${formatQty(requestedTotal)}) أكبر من رصيدها المتاح (${formatQty(Number(resolvedLot.lotBalanceQuantity || 0))})`);
    }

    setLines(current => [...current, {
      inventoryId: Number(resolvedLot.inventoryId),
      lotId: Number(resolvedLot.lotId),
      lotCode: String(resolvedLot.lotCode),
      trackingToken: String(resolvedLot.trackingToken),
      itemName: String(resolvedLot.itemName),
      internalCode: resolvedLot.internalCode ?? null,
      unit: String(resolvedLot.unit || "وحدة"),
      availableQuantity: Number(resolvedLot.lotBalanceQuantity || 0),
      quantity: qty,
      lotIssueUnitCost: Number(resolvedLot.lotIssueUnitCost || 0),
      costAllocationDrafts,
      linkedToTicket: !!resolvedLot.linkedToTicket,
      ticketNumber: resolvedLot.ticketNumber ?? null,
      assignedTechnicianName: resolvedLot.assignedTechnicianName ?? null,
      poNumber: resolvedLot.poNumber ?? null,
      pmv2TaskNumber: resolvedLot.pmv2TaskNumber ?? null,
    }]);
    setAddOpen(false);
    resetAddDialog();
  };

  const submitBatch = () => {
    if (!warehouseId) return toast.error("اختر المخزن المصدر");
    if (!deliveredToId) return toast.error("اختر الفني المستلم");
    if (lines.length < 2) return toast.error("الصرف المخزني المتعدد يتطلب إضافة مادتين على الأقل");

    try {
      const payloadLines = lines.map(line => ({
        inventoryId: line.inventoryId,
        lotTrackingToken: line.trackingToken,
        quantity: line.quantity,
        unit: line.unit,
        costAllocations: buildIssueCostAllocationPayload(line.costAllocationDrafts, line.quantity),
      }));
      createBatchMut.mutate({
        warehouseId: Number(warehouseId),
        deliveredToId: Number(deliveredToId),
        notes: notes.trim() || undefined,
        lines: payloadLines,
      });
    } catch (error: any) {
      toast.error(error?.message || "تحقق من بيانات بنود الصرف");
    }
  };

  const printLastCreated = async () => {
    if (!lastCreated) return;
    const opened = printWarehouseIssueDocument(lastCreated as any);
    if (!opened) return toast.error("تعذر فتح نافذة الطباعة");
    incrementPrintMut.mutate({ id: Number((lastCreated as any).id) }, {
      onSuccess: () => {
        utils.warehouseIssueBatches.list.invalidate();
        refetchLastCreated();
      },
    });
  };

  const printHistoryDocument = async (id: number) => {
    try {
      const data = await utils.warehouseIssueBatches.getById.fetch({ id });
      const opened = printWarehouseIssueDocument(data as any);
      if (!opened) return toast.error("تعذر فتح نافذة الطباعة");
      incrementPrintMut.mutate({ id }, {
        onSuccess: () => utils.warehouseIssueBatches.list.invalidate(),
      });
    } catch (error: any) {
      toast.error(error?.message || "تعذر فتح سند الصرف");
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Warehouse className="h-6 w-6 text-primary" />
          الصرف المخزني المتعدد
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          مخصص لصرف مادتين أو أكثر من مخزن واحد إلى فني واحد ضمن سند WIS واحد، مع بقاء حركات DLV واللوتات والارتباطات الحالية كما هي.
        </p>
      </div>

      <Tabs defaultValue="create" className="space-y-5" dir="rtl">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="create" className="gap-2"><Truck className="h-4 w-4" /> إنشاء سند صرف</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> سجل الصرف</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
      {!lotsEnabled && lotTrackingStatus && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardContent className="p-4 text-sm text-amber-900">
            تتبع اللوتات غير مفعّل. لا يمكن استخدام الصرف المخزني المتعدد قبل تفعيل نظام اللوتات.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">بيانات الصرف</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>المخزن المصدر *</Label>
            <Select
              value={warehouseId || undefined}
              disabled={lines.length > 0 || createBatchMut.isPending}
              onValueChange={setWarehouseId}
            >
              <SelectTrigger><SelectValue placeholder="اختر المخزن" /></SelectTrigger>
              <SelectContent>
                {(warehouses as any[])
                  .filter((warehouse: any) => Number(warehouse.isActive ?? 1) !== 0)
                  .map((warehouse: any) => (
                    <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                      {warehouse.nameAr || warehouse.nameEn || warehouse.code}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {lines.length > 0 && <p className="text-xs text-muted-foreground">احذف البنود لتغيير المخزن المصدر.</p>}
          </div>

          <div className="space-y-1.5">
            <Label>الفني المستلم *</Label>
            <TechnicianCombobox
              value={deliveredToId}
              onValueChange={setDeliveredToId}
              placeholder="اختر الفني المستلم..."
              options={technicianOptions}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>ملاحظات عامة (اختياري)</Label>
            <Textarea
              value={notes}
              onChange={event => setNotes(event.target.value)}
              placeholder="ملاحظات تظهر على سند الصرف والحركات الناتجة..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">المواد المضافة</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">حد أقصى {MAX_LINES} بندًا. يمكن تكرار نفس Lot إذا اختلف الموقع أو القسم أو الأصل، مع عدم تجاوز إجمالي الكمية لرصيد اللوت.</p>
          </div>
          <Button className="gap-2" onClick={openAddDialog} disabled={createBatchMut.isPending || !lotsEnabled}>
            <PackagePlus className="h-4 w-4" /> إضافة مادة
          </Button>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              لم تتم إضافة مواد بعد. اختر المخزن والفني ثم اضغط «إضافة مادة».
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <Table className="min-w-[1180px] table-fixed border-collapse">
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[14%]" />
                  <col className="w-[10%]" />
                  <col className="w-[11%]" />
                  <col className="w-[17%]" />
                  <col className="w-[18%]" />
                  <col className="w-[6%]" />
                </colgroup>
                <TableHeader className="bg-muted/60 [&_tr]:border-0">
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead className="border border-border px-3 text-right font-semibold">المادة</TableHead>
                    <TableHead className="border border-border px-3 text-center font-semibold">اللوت</TableHead>
                    <TableHead className="border border-border px-3 text-center font-semibold">المتاح</TableHead>
                    <TableHead className="border border-border px-3 text-center font-semibold">كمية الصرف</TableHead>
                    <TableHead className="border border-border px-3 text-center font-semibold">الجهة المستفيدة</TableHead>
                    <TableHead className="border border-border px-3 text-center font-semibold">المرجع</TableHead>
                    <TableHead className="border border-border px-3 text-center font-semibold">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={`${line.inventoryId}-${line.lotId}-${index}`} className="border-0">
                      <TableCell className="border border-border px-3 py-3 align-middle whitespace-normal text-right">
                        <div className="font-medium leading-6">{line.itemName}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground break-words">
                          {line.internalCode || `Inventory #${line.inventoryId}`}
                        </div>
                      </TableCell>
                      <TableCell className="border border-border px-3 py-3 text-center align-middle whitespace-normal">
                        <span className="font-mono text-xs break-all" dir="ltr">{line.lotCode}</span>
                      </TableCell>
                      <TableCell className="border border-border px-3 py-3 text-center align-middle whitespace-normal">
                        {formatQty(line.availableQuantity)} {line.unit}
                      </TableCell>
                      <TableCell className="border border-border px-3 py-3 text-center align-middle whitespace-normal font-semibold">
                        {formatQty(line.quantity)} {line.unit}
                      </TableCell>
                      <TableCell className="border border-border px-3 py-3 align-middle whitespace-normal text-xs">
                        <div><strong>الموقع:</strong> {siteNames.get(Number(line.costAllocationDrafts[0]?.beneficiarySiteId)) || "—"}</div>
                        <div><strong>القسم:</strong> {sectionNames.get(Number(line.costAllocationDrafts[0]?.beneficiarySectionId)) || "—"}</div>
                        <div><strong>الأصل:</strong> {line.costAllocationDrafts[0]?.beneficiaryAssetId ? (assetNames.get(Number(line.costAllocationDrafts[0].beneficiaryAssetId)) || `#${line.costAllocationDrafts[0].beneficiaryAssetId}`) : "بدون أصل"}</div>
                      </TableCell>
                      <TableCell className="border border-border px-3 py-3 align-middle whitespace-normal">
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {line.ticketNumber && <Badge variant="outline">بلاغ {line.ticketNumber}</Badge>}
                          {line.pmv2TaskNumber && <Badge variant="outline">PM V2 {line.pmv2TaskNumber}</Badge>}
                          {line.poNumber && <Badge variant="secondary">شراء {line.poNumber}</Badge>}
                          {!line.ticketNumber && !line.pmv2TaskNumber && !line.poNumber && <span className="text-xs text-muted-foreground">مخزون عام</span>}
                        </div>
                      </TableCell>
                      <TableCell className="border border-border px-2 py-3 text-center align-middle">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="حذف البند"
                          onClick={() => setLines(current => current.filter((_, lineIndex) => lineIndex !== index))}
                          disabled={createBatchMut.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm">
            <div><strong>المخزن:</strong> {selectedWarehouse?.nameAr || selectedWarehouse?.nameEn || "—"}</div>
            <div><strong>المستلم:</strong> {selectedRecipient?.name || "—"}</div>
            <div><strong>عدد البنود:</strong> {lines.length}</div>
            <p className="text-xs text-muted-foreground mt-1">الاعتماد ذري: إذا فشل أي بند قبل الإكمال فلن يتم صرف أي بند من السند.</p>
          </div>
          <Button size="lg" className="gap-2 min-w-[180px]" disabled={createBatchMut.isPending || lines.length < 2} onClick={submitBatch}>
            {createBatchMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
            اعتماد وصرف
          </Button>
        </CardContent>
      </Card>

      {lastCreated && (
        <Card className="border-green-300 bg-green-50/40">
          <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold text-green-800 flex items-center gap-2"><FileText className="h-4 w-4" /> تم إنشاء سند الصرف</div>
              <div className="font-mono text-lg mt-1" dir="ltr">{(lastCreated as any).issueNumber}</div>
              <div className="text-xs text-muted-foreground">{(lastCreated as any).itemsCount} بند — {(lastCreated as any).warehouseName} → {(lastCreated as any).deliveredToName}</div>
            </div>
            <Button variant="outline" className="gap-2" onClick={printLastCreated}>
              <Printer className="h-4 w-4" /> طباعة السند
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={open => { setAddOpen(open); if (!open) resetAddDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>إضافة مادة إلى سند الصرف</DialogTitle></DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>QR الدفعة / رقم اللوت *</Label>
              <div className="flex gap-2">
                <Input
                  value={lotIdentifier}
                  onChange={event => { setLotIdentifier(event.target.value); setResolvedLot(null); }}
                  onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); resolveLot(); } }}
                  placeholder="امسح QR أو أدخل LOT-..."
                  dir="ltr"
                  autoFocus
                />
                <Button variant="outline" className="gap-2" disabled={resolveLotMut.isPending} onClick={resolveLot}>
                  {resolveLotMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                  تحقق
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><QrCode className="h-3.5 w-3.5" /> البحث مقيد بالمخزن المصدر المختار فقط.</p>
            </div>

            {resolvedLot && (
              <>
                <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <div className="font-semibold">{resolvedLot.itemName}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">اللوت:</span> <span className="font-mono" dir="ltr">{resolvedLot.lotCode}</span></div>
                    <div><span className="text-muted-foreground">المتاح:</span> {formatQty(Number(resolvedLot.lotBalanceQuantity || 0))} {resolvedLot.unit || "وحدة"}</div>
                    <div><span className="text-muted-foreground">الكود:</span> {resolvedLot.internalCode || "—"}</div>
                    <div><span className="text-muted-foreground">المصدر:</span> {resolvedLot.poNumber || "مخزون عام"}</div>
                  </div>
                  {resolvedLot.linkedToTicket && (
                    <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
                      مرتبط بالبلاغ <strong>{resolvedLot.ticketNumber}</strong>
                      {resolvedLot.assignedTechnicianName ? ` — الفني المسند: ${resolvedLot.assignedTechnicianName}` : ""}.
                      سيُطبّق نفس أثر التسليم المرتبط بالبلاغ عند الاعتماد.
                    </div>
                  )}
                </div>

                {resolvedLot.costTargetSuggestion && (
                  <div className={`rounded-md border p-3 text-xs ${resolvedLot.costTargetSuggestion.complete ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                    <div className="font-medium">
                      {resolvedLot.costTargetSuggestion.complete
                        ? `تمت تعبئة جهة تحميل التكلفة تلقائيًا من ${resolvedLot.costTargetSuggestion.sourceLabel}`
                        : `تمت تعبئة البيانات المتاحة من ${resolvedLot.costTargetSuggestion.sourceLabel}`}
                    </div>
                    <div className="mt-1 text-[11px] opacity-90">
                      يمكنك تعديل الموقع أو القسم أو الأصل يدويًا عند الحاجة.
                      {!resolvedLot.costTargetSuggestion.complete ? " يجب تحديد الموقع والقسم قبل إضافة المادة إلى السند." : ""}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>كمية الصرف *</Label>
                  <Input type="number" min={0.001} step={0.001} value={quantity} onChange={event => setQuantity(event.target.value)} dir="ltr" />
                </div>

                <IssueCostAllocationEditor
                  value={costAllocationDrafts}
                  onChange={setCostAllocationDrafts}
                  totalQuantity={Number(quantity) || 0}
                  lotUnitCost={Number(resolvedLot.lotIssueUnitCost || 0)}
                  unitLabel={resolvedLot.unit || "وحدة"}
                />
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button onClick={addLine} disabled={!resolvedLot}>إضافة للسند</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><History className="h-5 w-5" /> سجل الصرف</CardTitle>
            </CardHeader>
            <CardContent>
              {(issueHistory as any[]).length === 0 ? (
                <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                  لا توجد سندات صرف مخزني مسجلة بعد.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table className="min-w-[1180px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">رقم السند</TableHead>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">المخزن</TableHead>
                        <TableHead className="text-right">الفني المستلم</TableHead>
                        <TableHead className="text-right">الموقع</TableHead>
                        <TableHead className="text-right">القسم</TableHead>
                        <TableHead className="text-center">البنود</TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                        <TableHead className="text-center">إجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(issueHistory as any[]).map((row: any) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono font-semibold" dir="ltr">{row.issueNumber}</TableCell>
                          <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                          <TableCell>{row.warehouseName || "—"}</TableCell>
                          <TableCell>{row.deliveredToName || "—"}</TableCell>
                          <TableCell>{row.beneficiarySiteName || "—"}</TableCell>
                          <TableCell>{row.beneficiarySectionName || "—"}</TableCell>
                          <TableCell className="text-center">{row.itemsCount ?? 0}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={row.status === "completed" ? "secondary" : "outline"}>
                              {row.status === "completed" ? "مكتمل" : row.status === "cancelled" ? "ملغي" : row.status || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setHistoryDetailId(Number(row.id))}>
                                <Eye className="h-4 w-4" /> فتح
                              </Button>
                              <Button variant="ghost" size="sm" className="gap-1" onClick={() => printHistoryDocument(Number(row.id))}>
                                <Printer className="h-4 w-4" /> طباعة
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!historyDetailId} onOpenChange={(open) => { if (!open) setHistoryDetailId(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل سند الصرف {(historyDetail as any)?.issueNumber || ""}</DialogTitle>
          </DialogHeader>
          {historyDetail ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 text-sm">
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">المخزن المصدر</div><div className="font-medium mt-1">{(historyDetail as any).warehouseName || "—"}</div></div>
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">الفني المستلم</div><div className="font-medium mt-1">{(historyDetail as any).deliveredToName || "—"}</div></div>
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">منفذ الصرف</div><div className="font-medium mt-1">{(historyDetail as any).issuedByName || "—"}</div></div>
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">الموقع</div><div className="font-medium mt-1">{(historyDetail as any).beneficiarySiteName || "—"}</div></div>
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">القسم</div><div className="font-medium mt-1">{(historyDetail as any).beneficiarySectionName || "—"}</div></div>
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">التاريخ</div><div className="font-medium mt-1">{formatDateTime((historyDetail as any).createdAt)}</div></div>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المادة</TableHead>
                      <TableHead className="text-right">اللوت</TableHead>
                      <TableHead className="text-right">الكمية</TableHead>
                      <TableHead className="text-right">DLV</TableHead>
                      <TableHead className="text-right">المرجع</TableHead>
                      <TableHead className="text-right">الموقع / القسم</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {((historyDetail as any).items || []).map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.itemName}</TableCell>
                        <TableCell className="font-mono" dir="ltr">{item.lotCode || "—"}</TableCell>
                        <TableCell>{formatQty(Number(item.quantity || 0))} {item.unit || ""}</TableCell>
                        <TableCell className="font-mono" dir="ltr">{item.deliveryNumber || "—"}</TableCell>
                        <TableCell>{item.referenceNumber || "—"}</TableCell>
                        <TableCell>{[item.beneficiarySiteName, item.beneficiarySectionName].filter(Boolean).join(" / ") || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {(historyDetail as any).notes && (
                <div className="rounded-lg border p-3 text-sm">
                  <div className="text-xs text-muted-foreground mb-1">ملاحظات</div>
                  <div>{(historyDetail as any).notes}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDetailId(null)}>إغلاق</Button>
            {historyDetail && (
              <Button className="gap-2" onClick={() => printHistoryDocument(Number((historyDetail as any).id))}>
                <Printer className="h-4 w-4" /> طباعة السند
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
