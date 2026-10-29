/** Exact DECIMAL(18,4) arithmetic. Never use binary floating point for balances.
 * All inputs must use the same currency and VAT basis, verified by the caller.
 */
const scale = BigInt(10000);
const max = BigInt("999999999999999999");
export function decimal4(value: string): bigint {
  if (!/^(0|[1-9]\d{0,13})(\.\d{1,4})?$/.test(value)) throw Error("قيمة مالية غير صحيحة؛ الحد الأقصى أربع منازل عشرية");
  const [whole, fraction = ""] = value.split(".");
  const result = BigInt(whole) * scale + BigInt(fraction.padEnd(4, "0"));
  if (result > max) throw Error("القيمة تتجاوز الحد المالي");
  return result;
}
export function format4(value: bigint): string {
  if (value < BigInt(0) || value > max) throw Error("قيمة مالية خارج النطاق");
  return `${value / scale}.${(value % scale).toString().padStart(4, "0")}`;
}
/** Cost attributable to returned issue units from the ORIGINAL invoice line.
 * originalIssueQuantity must be receipt purchase quantity × original factor.
 * This deliberately does not inspect or change inventory average cost.
 */
export function returnedInvoiceValue(lineTotal: string, originalIssueQuantity: string, returnedIssueQuantity: string): string {
  const total = decimal4(lineTotal), original = decimal4(originalIssueQuantity), returned = decimal4(returnedIssueQuantity);
  if (original <= BigInt(0) || returned <= BigInt(0) || returned > original) throw Error("كمية المرتجع لا تطابق مصدر الفاتورة");
  return format4((total * returned + original / BigInt(2)) / original);
}
export interface CreditEntry { kind: "credit_allocation" | "cash_refund"; amount: string; status: "pending" | "accounting_approved" | "management_approved" | "completed" | "rejected" | "cancelled"; }
/** Pending allocations/refunds reserve money too: two concurrent approvals must
 * never promise the same supplier credit to different replacement purchases.
 */
export function availableCredit(confirmedAmount: string, entries: CreditEntry[]): string {
  let available = decimal4(confirmedAmount);
  for (const entry of entries) {
    const amount = decimal4(entry.amount);
    if (entry.status !== "rejected" && entry.status !== "cancelled") available -= amount;
  }
  if (available < BigInt(0)) throw Error("تخصيصات رصيد المورد تتجاوز الرصيد المثبت");
  return format4(available);
}
export function compensationAmounts(replacementTotal: string, creditAvailable: string) {
  const total = decimal4(replacementTotal), credit = decimal4(creditAvailable);
  const allocated = total < credit ? total : credit;
  return { creditAllocated: format4(allocated), additionalFunding: format4(total-allocated), unallocatedCredit: format4(credit-allocated) };
}
