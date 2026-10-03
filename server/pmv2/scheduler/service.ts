import { currentMaintenanceTargetAdapter } from "../adapters/current-system";
import { Pmv2SchedulerEngine } from "./engine";
import { Pmv2DbSchedulerRepository } from "./repository";

/** Production scheduler composition: current Master Data adapter + PM V2 DB repository. */
export class Pmv2SchedulerService extends Pmv2SchedulerEngine {
  constructor() {
    super(new Pmv2DbSchedulerRepository(), currentMaintenanceTargetAdapter);
  }
}

export const pmv2SchedulerService = new Pmv2SchedulerService();
export type { Pmv2SchedulerRunResult } from "./engine";
