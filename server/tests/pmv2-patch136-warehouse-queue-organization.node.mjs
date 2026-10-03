import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const page = read("client/src/pages/pmv2/Pmv2WarehouseQueue.tsx");

const position = (text) => {
  const index = page.indexOf(text);
  assert.notEqual(index, -1, `missing expected UI text: ${text}`);
  return index;
};

test("warehouse queue puts action-needed requests before issue and return work", () => {
  const waiting = position("1. طلبات تحتاج معالجة المستودع");
  const ready = position("2. مواد PM V2 الجاهزة للصرف للمهمة");
  const returns = position("3. مرتجعات PM V2 المعلقة");
  const note = position("PM V2 لا ينفذ حركة مخزون بنفسه.");
  assert.ok(waiting < ready);
  assert.ok(ready < returns);
  assert.ok(returns < note);
});

test("top summary keeps the original warehouse and waiting-queue information", () => {
  assert.match(page, /ملخص عمل المستودع/);
  assert.match(page, /المستودع الرئيسي المستخدم للفحص/);
  assert.match(page, /طلبات تنتظر المستودع/);
  assert.match(page, /الحالة: waiting_warehouse/);
  assert.match(page, /مواد جاهزة للصرف للمهمة/);
  assert.match(page, /مرتجعات PM V2 المعلقة/);
});

test("waiting request cards retain every original quantity and destination field", () => {
  for (const label of [
    "احتياج المهمة",
    "المتاح في مخزن الفريق وقت الطلب",
    "النقص المسجل على المهمة",
    "المتبقي المطلوب تغطيته",
    "المتاح في الرئيسي الآن",
    "مخزن الفريق المستهدف",
    "الفريق:",
  ]) assert.match(page, new RegExp(label));
});

test("waiting request cards retain identity, maintenance, purchase and action information", () => {
  for (const label of [
    "كود الصنف:",
    "التصنيف:",
    "بند الصيانة:",
    "الاستحقاق:",
    "هوية المادة:",
    "طلبات شراء مرتبطة بهذا النقص:",
    "تحديد المادة من الدليل",
    "تحويل النقص إلى مخزن الفريق",
    "إنشاء طلب شراء للعجز",
    "لا تنشئ طلبًا مكررًا",
  ]) assert.match(page, new RegExp(label));
});

test("ready-to-issue work keeps recipient, lot, relink and issue controls", () => {
  for (const label of [
    "طالب المادة:",
    "توزيع الـLots الآلي:",
    "المستلم الفعلي",
    "إعادة ربط السند فقط — بدون صرف جديد",
    "صرف كامل الاحتياج للمهمة",
  ]) assert.match(page, new RegExp(label));
});

test("return work keeps quantity, lot allocation and confirmation controls", () => {
  for (const label of [
    "صُرف",
    "استخدم",
    "المتبقي للإرجاع",
    "المستلم السابق",
    "Lot المرتجع مثبت آليًا",
    "حدد من أي Lots عادت الكمية",
    "تأكيد استلام المرتجع",
  ]) assert.match(page, new RegExp(label));
});

test("PATCH136 remains presentation-only and keeps the existing operational handoffs", () => {
  assert.match(page, /prepareTransferHandoff\.useMutation/);
  assert.match(page, /preparePurchaseHandoff\.useMutation/);
  assert.match(page, /issueReadyRequirement\.useMutation/);
  assert.match(page, /confirmPendingReturn\.useMutation/);
  assert.match(page, /resolveMaterialIdentity\.useMutation/);
  assert.match(page, /linkConfirmedDelivery\.useMutation/);
});
