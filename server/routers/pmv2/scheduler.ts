import { z } from "zod";
import { router } from "../_shared/procedures";
import { pmv2SchedulerService } from "../../pmv2/scheduler/service";
import { pmv2ManagementProcedure } from "../../pmv2/security/procedures";

/** Controlled management endpoint for manual date-specific scheduler verification. */
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const pmv2SchedulerRouter = router({
  duePrograms: pmv2ManagementProcedure
    .input(z.object({ date: dateOnlySchema }))
    .query(({ input }) => pmv2SchedulerService.listDueProgramsForDate(input.date)),

  runForDate: pmv2ManagementProcedure
    .input(z.object({
      date: dateOnlySchema,
      programId: z.number().int().positive().optional(),
    }))
    .mutation(({ input }) => pmv2SchedulerService.runForDate(input.date, input.programId)),
});
