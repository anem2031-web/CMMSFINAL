import { decimal4 } from "./amounts";
export interface NeedReceipt {
  itemId: number;
  quantity: string;
  unit: string;
}
export interface NeedDelivery {
  itemId: number;
  quantity: string;
  unit: string;
}
export interface NeedReplacement {
  sourceItemId: number;
  replacementItemId: number | null;
  quantityCovered: string;
  originalUnit: string;
  received: boolean;
}

/** Use each lot's issue units. A replacement covers its source only in the
 * proportion physically delivered; purchase/receipt status alone is insufficient. */
export function replacementNeedCoverage(
  receipts: NeedReceipt[],
  deliveries: NeedDelivery[],
  replacements: NeedReplacement[]
) {
  const facts = new Map<
    number,
    { expected: bigint; delivered: bigint; unit: string; valid: boolean }
  >();
  for (const row of receipts) {
    const unit = row.unit.trim(),
      previous = facts.get(row.itemId),
      expected = decimal4(row.quantity);
    if (previous) {
      previous.expected += expected;
      previous.valid &&= previous.unit === unit && unit.length > 0;
    } else
      facts.set(row.itemId, {
        expected,
        delivered: BigInt(0),
        unit,
        valid: unit.length > 0 && expected > BigInt(0),
      });
  }
  for (const row of deliveries) {
    const fact = facts.get(row.itemId);
    if (!fact) continue;
    if (row.unit.trim() !== fact.unit) {
      fact.valid = false;
      continue;
    }
    fact.delivered += decimal4(row.quantity);
  }
  const memo = new Map<number, bigint>();
  function coverage(id: number, visiting: Set<number>): bigint {
    if (memo.has(id)) return memo.get(id)!;
    const fact = facts.get(id);
    if (!fact?.valid || fact.expected <= BigInt(0)) return BigInt(0);
    if (visiting.has(id)) throw Error("Cyclic supplier replacement provenance");
    const path = new Set(visiting);
    path.add(id);
    let supplied = fact.delivered;
    for (const link of replacements.filter(row => row.sourceItemId === id)) {
      if (
        !link.received ||
        link.replacementItemId == null ||
        link.originalUnit.trim() !== fact.unit
      )
        continue;
      const child = facts.get(link.replacementItemId);
      if (!child?.valid || child.expected <= BigInt(0)) continue;
      const childSupply = coverage(link.replacementItemId, path),
        usable = childSupply > child.expected ? child.expected : childSupply;
      supplied += (decimal4(link.quantityCovered) * usable) / child.expected;
    }
    const capped = supplied > fact.expected ? fact.expected : supplied;
    memo.set(id, capped);
    return capped;
  }
  const result = new Map<number, boolean>();
  facts.forEach((fact, id) =>
    result.set(id, fact.valid && coverage(id, new Set()) >= fact.expected)
  );
  return result;
}
