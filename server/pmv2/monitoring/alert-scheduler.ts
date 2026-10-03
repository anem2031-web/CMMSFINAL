import { pmv2AlertService } from "./alert-service";

const GLOBAL_KEY = "__pmv2Patch139AlertScheduler";
const state = globalThis as any;

export function ensurePmv2AlertScheduler() {
  if (state[GLOBAL_KEY]) return;
  const run = () => {
    pmv2AlertService.sweep().catch((error) => {
      // Missing PATCH139 migration is intentionally non-fatal; the dashboard will explain it.
      console.error("[PMV2][PATCH139] alert sweep failed", error);
    });
  };
  const timer = setInterval(run, 5 * 60 * 1000);
  if (typeof (timer as any).unref === "function") (timer as any).unref();
  state[GLOBAL_KEY] = timer;
  const initialTimer = setTimeout(run, 60 * 1000);
  if (typeof (initialTimer as any).unref === "function") (initialTimer as any).unref();
}
