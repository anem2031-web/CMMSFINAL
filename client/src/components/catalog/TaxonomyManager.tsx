import React, { useState, useCallback } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { isCatalogAdminRole } from "@shared/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, ChevronRight, Loader2, FolderPlus, RotateCcw, Download, MoveRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────
interface TreeNode {
  id: number;
  code: string | null;
  nameAr: string;
  nameEn: string;
  nameUr?: string | null;
  level: number;
  parentId?: number | null;
  isActive: boolean;
}

type DialogMode = "addRoot" | "addChild" | "edit" | "move" | null;

// ── Main Component ─────────────────────────────────────────────────────────
export default function TaxonomyManager() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canDelete = isCatalogAdminRole(user?.role);
  const isCatalogAdmin = canDelete;
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [formData, setFormData] = useState({ nameAr: "", nameEn: "", nameUr: "", code: "" });
  const [codeError, setCodeError] = useState("");
  const [moveTarget, setMoveTarget] = useState<string>("__root__");
  const [movePreview, setMovePreview] = useState<any | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  // جلب جميع التصنيفات ثم نفلتر الجذور في الفرونت
  const { data: allNodes, isLoading, refetch } = trpc.catalog.nodes.list.useQuery(
    isCatalogAdmin ? { includeInactive: true } : {}
  );
  const roots = (allNodes || []).filter((n: any) => !n.parentId || n.parentId === null || n.parentId === 0);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMut = trpc.catalog.nodes.create.useMutation({
    onSuccess: () => { refetch(); closeDialog(); toast.success("تم إضافة التصنيف"); },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.catalog.nodes.update.useMutation({
    onSuccess: () => { refetch(); closeDialog(); toast.success("تم تعديل التصنيف"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.catalog.nodes.delete.useMutation({
    onSuccess: () => { refetch(); setSelectedNode(null); toast.success("تم تعطيل التصنيف"); },
    onError: (e) => toast.error(e.message),
  });

  const reactivateMut = trpc.catalog.nodes.reactivate.useMutation({
    onSuccess: () => { refetch(); setSelectedNode(null); toast.success("تمت إعادة تفعيل التصنيف"); },
    onError: (e) => toast.error(e.message),
  });

  const previewMoveMut = trpc.catalog.nodes.previewMove.useMutation({
    onSuccess: (data) => setMovePreview(data),
    onError: (e) => { setMovePreview(null); toast.error(e.message); },
  });

  const moveSubtreeMut = trpc.catalog.nodes.moveSubtree.useMutation({
    onSuccess: async (data) => {
      await refetch();
      closeDialog();
      toast.success(`تم نقل التصنيف وإعادة ترقيم ${data.plan.nodeChanges.length} تصنيف و${data.plan.itemChanges.length} صنف`);
    },
    onError: (e) => toast.error(e.message),
  });

  const exportTreeMut = trpc.catalog.importExport.exportTaxonomyTreeExcel.useMutation();

  const handleExportTree = async () => {
    try {
      const result = await exportTreeMut.mutateAsync({ includeInactive: isCatalogAdmin });
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.buffer}`;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("تم تصدير شجرة الكتالوج بنجاح");
    } catch (e: any) {
      toast.error(e.message ?? "حدث خطأ أثناء تصدير شجرة الكتالوج");
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const closeDialog = () => {
    setDialogMode(null);
    setFormData({ nameAr: "", nameEn: "", nameUr: "", code: "" });
    setCodeError("");
    setMovePreview(null);
    setMoveTarget("__root__");
  };

  const openAddRoot = () => {
    setSelectedNode(null);
    setFormData({ nameAr: "", nameEn: "", nameUr: "", code: "" });
    setDialogMode("addRoot");
  };

  const openAddChild = (parent: TreeNode) => {
    setSelectedNode(parent);
    setFormData({ nameAr: "", nameEn: "", nameUr: "", code: "" });
    setDialogMode("addChild");
  };

  const openEdit = (node: TreeNode) => {
    setSelectedNode(node);
    setFormData({
      nameAr: node.nameAr,
      nameEn: node.nameEn,
      nameUr: node.nameUr || "",
      code: node.code || "",
    });
    setDialogMode("edit");
  };

  const openMove = (node: TreeNode) => {
    setSelectedNode(node);
    setMovePreview(null);
    if (node.parentId != null) {
      setMoveTarget("__root__");
    } else {
      const descendants = new Set<number>([node.id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const candidate of (allNodes || []) as TreeNode[]) {
          if (candidate.parentId != null && descendants.has(Number(candidate.parentId)) && !descendants.has(candidate.id)) {
            descendants.add(candidate.id);
            changed = true;
          }
        }
      }
      const firstTarget = ((allNodes || []) as TreeNode[]).find(candidate =>
        !descendants.has(candidate.id) && Number((candidate as any).isActive) === 1 && candidate.level < 6,
      );
      setMoveTarget(firstTarget ? String(firstTarget.id) : "__root__");
    }
    setDialogMode("move");
  };

  const validateCode = (val: string) => {
    if (val && !/^\d+$/.test(val)) {
      setCodeError("الكود يجب أن يحتوي على أرقام فقط");
      return false;
    }
    setCodeError("");
    return true;
  };

  const toggleExpand = useCallback((nodeId: number) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
      return next;
    });
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!formData.nameAr || !formData.nameEn) {
      toast.error("الاسم بالعربية والإنجليزية مطلوبان");
      return;
    }
    if (!validateCode(formData.code)) return;

    if (dialogMode === "edit" && selectedNode) {
      await updateMut.mutateAsync({
        id: selectedNode.id,
        nameAr: formData.nameAr,
        nameEn: formData.nameEn,
        nameUr: formData.nameUr || undefined,
      });
    } else {
      const parentLevel = selectedNode?.level || 0;
      if (parentLevel >= 6) {
        toast.error("الحد الأقصى للمستويات هو 6");
        return;
      }
      await createMut.mutateAsync({
        nameAr: formData.nameAr,
        nameEn: formData.nameEn,
        nameUr: formData.nameUr || undefined,
        code: formData.code || undefined,
        parentId: selectedNode?.id ? Number(selectedNode.id) : undefined,
        level: parentLevel + 1,
      });
    }
  };

  const handlePreviewMove = async () => {
    if (!selectedNode) return;
    await previewMoveMut.mutateAsync({
      nodeId: selectedNode.id,
      targetParentId: moveTarget === "__root__" ? null : Number(moveTarget),
    });
  };

  const handleExecuteMove = async () => {
    if (!selectedNode || !movePreview || movePreview.blockers?.length) return;
    const ok = confirm(`سيتم نقل «${selectedNode.nameAr}» وإعادة ترقيم ${movePreview.plan.nodeChanges.length} تصنيف و${movePreview.plan.itemChanges.length} صنف.\nلن تتغير IDs أو الأرصدة أو اللوتات أو الحركات السابقة.\nهل تريد المتابعة؟`);
    if (!ok) return;
    await moveSubtreeMut.mutateAsync({
      nodeId: selectedNode.id,
      targetParentId: moveTarget === "__root__" ? null : Number(moveTarget),
    });
  };

  const handleDelete = async (node: TreeNode) => {
    if (!confirm(`هل أنت متأكد من تعطيل "${node.nameAr}"؟\nلا يمكن التعطيل إذا كان فيه فروع أو أصناف نشطة مرتبطة.`)) return;
    await deleteMut.mutateAsync(node.id);
  };

  const handleReactivate = async (node: TreeNode) => {
    if (!confirm(`هل تريد إعادة تفعيل "${node.nameAr}"؟`)) return;
    await reactivateMut.mutateAsync(node.id);
  };

  // ── Dialog Title ───────────────────────────────────────────────────────────
  const dialogTitle =
    dialogMode === "addRoot" ? "إضافة تصنيف رئيسي" :
    dialogMode === "addChild" ? `إضافة فرع تحت: ${selectedNode?.nameAr}` :
    dialogMode === "edit" ? `تعديل: ${selectedNode?.nameAr}` :
    dialogMode === "move" ? `نقل / إعادة هيكلة: ${selectedNode?.nameAr}` : "";

  const isPending = createMut.isPending || updateMut.isPending || moveSubtreeMut.isPending;

  const selectedSubtreeIds = (() => {
    const ids = new Set<number>();
    if (!selectedNode) return ids;
    ids.add(selectedNode.id);
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of (allNodes || []) as TreeNode[]) {
        if (node.parentId != null && ids.has(Number(node.parentId)) && !ids.has(node.id)) {
          ids.add(node.id);
          changed = true;
        }
      }
    }
    return ids;
  })();
  const moveTargets = ((allNodes || []) as TreeNode[]).filter(node =>
    !selectedSubtreeIds.has(node.id) &&
    Number((node as any).isActive) === 1 &&
    node.level < 6 &&
    Number(node.id) !== Number(selectedNode?.parentId || 0),
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{t.catalog.taxonomy.title}</h3>
        <div className="flex items-center gap-2">
          {isCatalogAdmin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleExportTree}
              disabled={exportTreeMut.isPending}
            >
              {exportTreeMut.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Download className="w-4 h-4" />}
              تصدير الشجرة إلى Excel
            </Button>
          )}
          <Button size="sm" className="gap-2" onClick={openAddRoot}>
            <Plus className="w-4 h-4" />
            {t.catalog.taxonomy.addRoot}
          </Button>
        </div>
      </div>

      {/* Tree */}
      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : roots && roots.length > 0 ? (
            <div className="space-y-1">
              {roots.map(node => (
                <TreeNodeItem
                  key={node.id}
                  node={node as TreeNode}
                  allNodes={(allNodes || []) as TreeNode[]}
                  isExpanded={expandedNodes.has(node.id)}
                  expandedNodes={expandedNodes}
                  onToggle={toggleExpand}
                  onAddChild={openAddChild}
                  onEdit={openEdit}
                  onMove={openMove}
                  onDelete={handleDelete}
                  onReactivate={handleReactivate}
                  canDelete={canDelete}
                  canMove={isCatalogAdmin}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FolderPlus className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>{t.catalog.taxonomy.empty}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={openAddRoot}>
                إضافة أول تصنيف
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={!!dialogMode} onOpenChange={() => closeDialog()}>
        <DialogContent className={dialogMode === "move" ? "sm:max-w-3xl max-h-[90vh] overflow-y-auto" : undefined}>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          {dialogMode === "move" ? (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span>التصنيف الحالي</span>
                  <span className="font-mono font-semibold" dir="ltr">{selectedNode?.code || "—"}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  سيتم نقل نفس التصنيف ونفس التفرعات والأصناف بالـ IDs الحالية. لا يتم إنشاء أصناف جديدة ولا تعديل الأرصدة أو اللوتات أو الحركات السابقة.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">الموقع الجديد *</label>
                <select
                  value={moveTarget}
                  onChange={e => { setMoveTarget(e.target.value); setMovePreview(null); }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="__root__" disabled={selectedNode?.parentId == null}>
                    تحويل إلى تصنيف رئيسي
                  </option>
                  {moveTargets.map(target => (
                    <option key={target.id} value={String(target.id)}>
                      {target.code || "—"} — {target.nameAr} (م{target.level})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  لا تظهر العقد الموجودة داخل الفرع نفسه، ولا الأب الحالي، ولا المستويات التي لا تسمح بإضافة مستوى جديد.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handlePreviewMove}
                disabled={previewMoveMut.isPending || !selectedNode || (moveTarget === "__root__" && selectedNode?.parentId == null)}
              >
                {previewMoveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                معاينة الترقيم قبل التنفيذ
              </Button>

              {movePreview && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                    <div className="rounded bg-muted/50 p-2">
                      <div className="text-xs text-muted-foreground">الكود القديم</div>
                      <div className="font-mono font-semibold" dir="ltr">{movePreview.plan.oldRootCode}</div>
                    </div>
                    <div className="rounded bg-muted/50 p-2">
                      <div className="text-xs text-muted-foreground">الكود الجديد</div>
                      <div className="font-mono font-semibold" dir="ltr">{movePreview.plan.newRootCode}</div>
                    </div>
                    <div className="rounded bg-muted/50 p-2">
                      <div className="text-xs text-muted-foreground">التصنيفات</div>
                      <div className="font-semibold">{movePreview.plan.nodeChanges.length}</div>
                    </div>
                    <div className="rounded bg-muted/50 p-2">
                      <div className="text-xs text-muted-foreground">الأصناف</div>
                      <div className="font-semibold">{movePreview.plan.itemChanges.length}</div>
                    </div>
                  </div>

                  {movePreview.blockers?.length > 0 && (
                    <div className="space-y-1 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                      <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> لا يمكن التنفيذ حالياً</div>
                      {movePreview.blockers.map((message: string, index: number) => (
                        <div key={index}>• {message}</div>
                      ))}
                    </div>
                  )}

                  {movePreview.warnings?.length > 0 && (
                    <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                      {movePreview.warnings.map((message: string, index: number) => (
                        <div key={index}>• {message}</div>
                      ))}
                    </div>
                  )}

                  <div className="max-h-56 overflow-auto rounded border">
                    <div className="sticky top-0 grid grid-cols-[1fr_120px_120px] gap-2 border-b bg-muted px-2 py-1.5 text-xs font-medium">
                      <span>العنصر</span><span>قبل</span><span>بعد</span>
                    </div>
                    {movePreview.plan.nodeChanges.slice(0, 20).map((change: any) => (
                      <div key={`n-${change.id}`} className="grid grid-cols-[1fr_120px_120px] gap-2 border-b px-2 py-1.5 text-xs last:border-b-0">
                        <span className="truncate">تصنيف: {change.nameAr}</span>
                        <span className="font-mono" dir="ltr">{change.oldCode}</span>
                        <span className="font-mono" dir="ltr">{change.newCode}</span>
                      </div>
                    ))}
                    {movePreview.plan.itemChanges.slice(0, 20).map((change: any) => (
                      <div key={`i-${change.id}`} className="grid grid-cols-[1fr_120px_120px] gap-2 border-b px-2 py-1.5 text-xs last:border-b-0">
                        <span className="truncate">صنف: {change.nameAr}</span>
                        <span className="font-mono" dir="ltr">{change.oldCode}</span>
                        <span className="font-mono" dir="ltr">{change.newCode}</span>
                      </div>
                    ))}
                  </div>
                  {(movePreview.plan.nodeChanges.length + movePreview.plan.itemChanges.length) > 40 && (
                    <p className="text-xs text-muted-foreground">تم عرض أول 40 تغييراً فقط في المعاينة؛ التنفيذ يشمل جميع السجلات الموضحة في العدد أعلاه.</p>
                  )}

                  <Button
                    className="w-full"
                    onClick={handleExecuteMove}
                    disabled={moveSubtreeMut.isPending || movePreview.blockers?.length > 0}
                  >
                    {moveSubtreeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <MoveRight className="w-4 h-4 ml-2" />}
                    اعتماد النقل وإعادة الترقيم
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  الكود
                  <span className="text-muted-foreground text-xs mr-2">
                    {dialogMode === "edit" ? "(يتغير فقط من إعادة الهيكلة)" : "(يُولَّد تلقائياً إذا تُرك فارغاً)"}
                  </span>
                </label>
                <Input
                  value={formData.code}
                  onChange={e => {
                    setFormData({ ...formData, code: e.target.value });
                    validateCode(e.target.value);
                  }}
                  readOnly={dialogMode === "edit"}
                  placeholder={
                    dialogMode === "addRoot" ? "مثال: 1" :
                    dialogMode === "addChild" ? `مثال: ${selectedNode?.code || ""}1` :
                    selectedNode?.code || ""
                  }
                  dir="ltr"
                  className={cn(codeError && "border-red-500", dialogMode === "edit" && "bg-muted")}
                />
                {codeError && <p className="text-xs text-red-500">{codeError}</p>}
                {dialogMode !== "edit" ? (
                  <p className="text-xs text-muted-foreground">
                    أرقام فقط — النظام سيولد الكود تلقائياً إذا تركته فارغاً
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    لحماية التفرعات والأصناف، لا يُعدّل الكود منفرداً. استخدم زر «نقل / إعادة هيكلة».
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">{t.catalog.fields.nameAr} *</label>
                <Input
                  value={formData.nameAr}
                  onChange={e => setFormData({ ...formData, nameAr: e.target.value })}
                  placeholder="مثال: قطع ميكانيكية"
                  dir="rtl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">{t.catalog.fields.nameEn} *</label>
                <Input
                  value={formData.nameEn}
                  onChange={e => setFormData({ ...formData, nameEn: e.target.value })}
                  placeholder="Example: Mechanical Parts"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {t.catalog.fields.nameUr}
                  <span className="text-muted-foreground text-xs mr-2">(اختياري)</span>
                </label>
                <Input
                  value={formData.nameUr}
                  onChange={e => setFormData({ ...formData, nameUr: e.target.value })}
                  placeholder="اختياري"
                />
              </div>

              <Button onClick={handleSubmit} disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isPending ? t.common.saving : t.common.save}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Tree Node Item ─────────────────────────────────────────────────────────
interface TreeNodeItemProps {
  node: TreeNode;
  allNodes: TreeNode[];
  isExpanded: boolean;
  expandedNodes: Set<number>;
  onToggle: (id: number) => void;
  onAddChild: (node: TreeNode) => void;
  onEdit: (node: TreeNode) => void;
  onMove: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
  onReactivate: (node: TreeNode) => void;
  canDelete: boolean;
  canMove: boolean;
  depth?: number;
}

function TreeNodeItem({
  node, allNodes, isExpanded, expandedNodes, onToggle, onAddChild, onEdit, onMove, onDelete, onReactivate, canDelete, canMove, depth = 0
}: TreeNodeItemProps) {
  const children = (allNodes || []).filter(n => Number(n.parentId) === Number(node.id));
  const hasChildren = children.length > 0;
  const isInactive = Number((node as any).isActive) !== 1;
  const canAddChild = node.level < 6 && !isInactive;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 py-1.5 px-2 rounded-lg transition-colors hover:bg-muted/50",
        )}
        style={{ paddingRight: `${depth * 20 + 8}px` }}
      >
        {/* زر التوسع */}
        <button
          onClick={() => onToggle(node.id)}
          className={cn(
            "w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors shrink-0",
            !hasChildren && "invisible"
          )}
        >
          <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", isExpanded && "rotate-90")} />
        </button>

        {/* الكود */}
        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0 min-w-[2.5rem] text-center">
          {node.code || "—"}
        </span>

        {/* الاسم */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <div className="min-w-0">
            <span className="text-sm font-medium truncate">{node.nameAr}</span>
            <span className="text-xs text-muted-foreground mr-2 truncate">{node.nameEn}</span>
          </div>
          {isInactive && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border shrink-0">
              معطّل
            </span>
          )}
        </div>

        {/* مستوى */}
        <span className="text-xs text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          م{node.level}
        </span>

        {/* أزرار الإجراءات */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {canAddChild && (
            <button
              onClick={e => { e.stopPropagation(); onAddChild(node); }}
              className="p-1 rounded hover:bg-green-100 hover:text-green-700 transition-colors"
              title="إضافة فرع"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onEdit(node); }}
            className="p-1 rounded hover:bg-blue-100 hover:text-blue-700 transition-colors"
            title="تعديل"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {canMove && !isInactive && (
            <button
              onClick={e => { e.stopPropagation(); onMove(node); }}
              className="p-1 rounded hover:bg-amber-100 hover:text-amber-700 transition-colors"
              title="نقل / إعادة هيكلة"
            >
              <MoveRight className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && !isInactive && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(node); }}
              className="p-1 rounded hover:bg-red-100 hover:text-red-700 transition-colors"
              title="تعطيل"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && isInactive && (
            <button
              onClick={e => { e.stopPropagation(); onReactivate(node); }}
              className="p-1 rounded hover:bg-green-100 hover:text-green-700 transition-colors"
              title="إعادة تفعيل"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* الأبناء */}
      {isExpanded && hasChildren && (
        <div className="border-r-2 border-muted mr-4">
          {children.map(child => (
            <TreeNodeItem
              key={child.id}
              node={child as TreeNode}
              allNodes={allNodes}
              isExpanded={expandedNodes.has(child.id)}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onMove={onMove}
              onDelete={onDelete}
              onReactivate={onReactivate}
              canDelete={canDelete}
              canMove={canMove}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
