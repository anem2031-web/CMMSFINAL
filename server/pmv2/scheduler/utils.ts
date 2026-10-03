export function buildPmv2TaskNumber(date: string, programId: number, targetId: number) {
  const compactDate = date.replaceAll("-", "");
  return `PMV2-${compactDate}-P${programId}-T${targetId}`;
}

export function getRiyadhDateOnly(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
