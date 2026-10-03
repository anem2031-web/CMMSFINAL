import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const page = read("client/src/pages/pmv2/Pmv2WarehouseQueue.tsx");

const mustContain = (values) => {
  for (const value of values) assert.ok(page.includes(value), `missing expected UI/code text: ${value}`);
};

test("warehouse work is switched through exactly the three agreed operational tabs", () => {
  mustContain([
    'useState<"waiting" | "ready" | "returns">("waiting")',
    'role="tablist"',
    'setActiveSection("waiting")',
    'setActiveSection("ready")',
    'setActiveSection("returns")',
    'تحتاج معالجة',
    'جاهزة للصرف',
    'المرتجعات',
  ]);
  assert.equal((page.match(/role="tab"/g) || []).length, 3);
  assert.equal((page.match(/role="tabpanel"/g) || []).length, 3);
});

test("only the selected operational section is rendered at a time", () => {
  mustContain([
    'activeSection === "waiting" && (',
    'activeSection === "ready" && (',
    'activeSection === "returns" && (',
  ]);
});

test("cards start compact and progressively disclose the full existing content", () => {
  mustContain([
    '<details className="group">',
    'عرض التفاصيل والإجراء',
    'عرض التفاصيل والصرف',
    'عرض التفاصيل والاستلام',
    'إخفاء التفاصيل',
  ]);
  assert.equal((page.match(/<details className="group">/g) || []).length, 3);
});

test("PATCH137 keeps the complete waiting-request information and actions", () => {
  mustContain([
    'احتياج المهمة',
    'المتاح في مخزن الفريق وقت الطلب',
    'النقص المسجل على المهمة',
    'المتبقي المطلوب تغطيته',
    'المتاح في الرئيسي الآن',
    'مخزن الفريق المستهدف',
    'كود الصنف:',
    'التصنيف:',
    'بند الصيانة:',
    'الاستحقاق:',
    'طلبات شراء مرتبطة بهذا النقص:',
    'تحديد المادة من الدليل',
    'تحويل النقص إلى مخزن الفريق',
    'إنشاء طلب شراء للعجز',
    'لا تنشئ طلبًا مكررًا',
  ]);
});

test("PATCH137 keeps ready-to-issue and return controls inside their expandable cards", () => {
  mustContain([
    'توزيع الـLots الآلي:',
    'المستلم الفعلي',
    'إعادة ربط السند فقط — بدون صرف جديد',
    'صرف كامل الاحتياج للمهمة',
    'المتبقي للإرجاع',
    'المستلم السابق',
    'Lot المرتجع مثبت آليًا',
    'حدد من أي Lots عادت الكمية',
    'تأكيد استلام المرتجع',
  ]);
});

test("summary and PM V2 architecture notice are preserved", () => {
  mustContain([
    'ملخص عمل المستودع',
    'المستودع الرئيسي المستخدم للفحص',
    'طلبات تنتظر المستودع',
    'الحالة: waiting_warehouse',
    'PM V2 لا ينفذ حركة مخزون بنفسه.',
  ]);
});

test("PATCH137 remains UI-only and keeps all existing warehouse handoffs", () => {
  mustContain([
    'prepareTransferHandoff.useMutation',
    'preparePurchaseHandoff.useMutation',
    'issueReadyRequirement.useMutation',
    'confirmPendingReturn.useMutation',
    'resolveMaterialIdentity.useMutation',
    'linkConfirmedDelivery.useMutation',
  ]);
});
