export interface Pmv2ChecklistItemOrderLike {
  sortOrder: number;
}

/**
 * Manager-created checklist items get the next stable position automatically.
 * We include inactive rows so a visible/history number is not silently reused.
 */
export function nextPmv2ChecklistItemSortOrder(
  existingItems: readonly Pmv2ChecklistItemOrderLike[],
): number {
  const highest = existingItems.reduce((maxValue, item) => {
    const value = Number(item.sortOrder);
    return Number.isInteger(value) && value >= 0
      ? Math.max(maxValue, value)
      : maxValue;
  }, 0);

  return highest + 1;
}
