import { decimal4, format4 } from "./amounts";

/** Quantities must already be in the approved replacement unit (the existing
 * receipt unit converter owns purchase/issue conversion). Allocate cumulatively
 * to avoid rounding each partial receipt over-compensating the original need.
 */
export function replacementReceiptAllocation(input: {
  replacementQuantity: string;
  originalQuantityCovered: string;
  alreadyReceived: string;
  alreadyCompensated: string;
  receiving: string;
}) {
  const values = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, decimal4(value)]));
  for (const value of Object.values(values)) if (value % BigInt(10) !== BigInt(0)) throw Error("دقة الكمية لا تتجاوز ثلاث منازل عشرية");
  const { replacementQuantity: total, originalQuantityCovered: original, alreadyReceived: previous, alreadyCompensated: compensated, receiving: incoming } = values;
  if (total <= BigInt(0) || original <= BigInt(0) || incoming <= BigInt(0) || previous + incoming > total || compensated > original) throw Error("كمية الاستلام تتجاوز نطاق التعويض المعتمد");
  const priorTarget = (original * previous / total / BigInt(10)) * BigInt(10);
  if (compensated !== priorTarget) throw Error("سجل التعويض السابق لا يطابق الكميات المستلمة");
  const cumulative = previous + incoming;
  const target = cumulative === total ? original : (original * cumulative / total / BigInt(10)) * BigInt(10);
  return {
    compensatedOriginalQuantity: format4(target - compensated).slice(0, -1),
    cumulativeCompensated: format4(target).slice(0, -1),
    completed: cumulative === total,
  };
}
