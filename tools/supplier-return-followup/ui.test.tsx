import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { it, expect, vi } from "vitest";
const data = vi.hoisted(() => ({ enabled: true, role: "delegate", stage: "awaiting_delegate", resolution: null as string | null,refund:false }));
vi.mock("../../client/src/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 10, role: data.role } }) }));
vi.mock("../../client/src/lib/trpc", () => ({ trpc: { supplierReturns: {
  status: { useQuery: () => ({ data: { enabled: data.enabled } }) },
  list: { useQuery: () => ({ data: { total: 1, items: [{ id: 1, delegateId: 10, itemName: "صنف اختبار", returnNumber: "RTN-TEST", returnedQuantity: 2, returnedUnit: "قطعة", handoverStatus: data.stage, resolution: data.resolution,...(data.refund?{confirmedRefundId:2,confirmedRefundAmount:"20.0000",refundReference:"TEST-REFUND"}:{}) }] }, refetch: vi.fn() }) },
  command: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
  chooseReplacement: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
  confirmRefund: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
  cancelAfterRefund: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
} } }));
vi.mock("../../client/src/components/catalog/CatalogPickerDialog", () => ({ CatalogPickerDialog: () => null }));
import { SupplierReturns } from "../../client/src/components/purchase/SupplierReturns";
it("shows the confirmed refund and reference instead of offering another confirmation", () => {
  data.role="delegate";data.stage="accepted";data.resolution="refund";data.refund=true;
  const html=renderToStaticMarkup(<SupplierReturns/>);
  expect(html).toContain("تم تأكيد استرداد المبلغ");expect(html).toContain("TEST-REFUND");
  expect(html).not.toContain("تأكيد استلام مبلغ المرتجع");data.refund=false;
});
it("hides trial when server disables it", () => {
  data.enabled = false; expect(renderToStaticMarkup(<SupplierReturns />)).toBe(""); data.enabled = true;
});
it("shows receipt decisions and required reason before actions", () => {
  data.role = "delegate"; data.stage = "awaiting_delegate"; data.resolution = null;
  const html = renderToStaticMarkup(<SupplierReturns />);
  expect(html).toContain("استلمت المرتجع"); expect(html).toContain("سبب عدم الاستلام");
  expect(html).not.toContain("استبدال بنفس الصنف");
});
it("only accepted returns show the three choices", () => {
  data.role = "delegate"; data.stage = "accepted"; data.resolution = null;
  const html = renderToStaticMarkup(<SupplierReturns />);
  for (const text of ["استبدال بنفس الصنف", "طلب صنف بديل", "استرداد المبلغ"]) expect(html).toContain(text);
  expect(html).not.toContain("لم أستلم المرتجع");
});
it("warehouse sees resend but never delegate acceptance", () => {
  data.role = "warehouse"; data.stage = "rejected"; data.resolution = null;
  const html = renderToStaticMarkup(<SupplierReturns />);
  expect(html).toContain("إعادة التسليم للمندوب"); expect(html).not.toContain("استلمت المرتجع");
});
