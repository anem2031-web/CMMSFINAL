import { z } from "zod";
import { router } from "../_shared/procedures";
import { pmv2ManagementProcedure } from "../../pmv2/security/procedures";
import { pmv2TaskReadService } from "../../pmv2/tasks/read-service";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Phase 2 read-only surface used by the Scheduled Maintenance management UI. */
export const pmv2TasksRouter = router({
  dailyWorkload: pmv2ManagementProcedure
    .input(z.object({
      dateFrom: isoDate,
      dateTo: isoDate,
      teamId: z.number().int().positive().optional(),
    }).refine(value => value.dateFrom <= value.dateTo, {
      message: "نطاق التاريخ غير صالح",
      path: ["dateTo"],
    }))
    .query(({ input }) => pmv2TaskReadService.listDailyTeamWorkload(input)),

  list: pmv2ManagementProcedure
    .input(z.object({
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(50).optional(),
      search: z.string().max(120).optional(),
      teamId: z.number().int().positive().optional(),
      dateFrom: isoDate.optional(),
      dateTo: isoDate.optional(),
      overdueBefore: isoDate.optional(),
      excludeFinished: z.boolean().optional(),
      excludeCancelled: z.boolean().optional(),
    }).optional())
    .query(({ input }) => pmv2TaskReadService.listTasks(input ?? {})),

  items: pmv2ManagementProcedure
    .input(z.object({ taskId: z.number().int().positive() }))
    .query(({ input }) => pmv2TaskReadService.listTaskItems(input.taskId)),
});
