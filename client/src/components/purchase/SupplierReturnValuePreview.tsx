import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

export function SupplierReturnValuePreview(props: { warehouseId: number; trackingToken: string; quantity: number }) {
  const valid = Number.isInteger(props.quantity) && props.quantity > 0;
  const key = `${props.warehouseId}:${props.trackingToken}:${props.quantity}`;
  const [settledKey, setSettledKey] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSettledKey(key), 300);
    return () => clearTimeout(timer);
  }, [key]);
  const query = trpc.supplierReturns.valuePreview.useQuery({ warehouseId: props.warehouseId,
    trackingToken: props.trackingToken, returnedQuantity: valid ? props.quantity : 1 },
  { enabled: valid && settledKey === key, retry: false });
  if (!valid) return null;
  if (settledKey !== key || query.isLoading) return <p className="text-xs text-muted-foreground" aria-live="polite">جارٍ حساب قيمة الكمية المرتجعة…</p>;
  if (query.error) return <p role="alert" className="text-sm text-destructive">{query.error.message}</p>;
  if (!query.data) return null;
  if (query.data.originalPurchaseValue == null) return <p role="status" className="text-sm text-amber-700">{query.data.unavailableReason}</p>;
  return <div className="rounded-md border bg-muted/40 p-3 text-sm" aria-live="polite">
    <p>قيمة الكمية المرتجعة من الفاتورة: <strong>{Number(query.data.originalPurchaseValue).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ر.س</strong></p>
    <p className="text-xs text-muted-foreground">{query.data.quantity} {query.data.unit} — شاملة الضريبة المسجلة. تُراجع القيمة والكمية عند التأكيد.</p>
  </div>;
}
