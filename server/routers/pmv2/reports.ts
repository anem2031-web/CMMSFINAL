import { z } from "zod";
import { router } from "../_shared/procedures";
import { pmv2ManagementProcedure } from "../../pmv2/security/procedures";
import { pmv2DailyReportService } from "../../pmv2/reports/daily-report-service";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const pmv2ReportsRouter = router({
  filters: pmv2ManagementProcedure.query(() => pmv2DailyReportService.listFilters()),

  daily: pmv2ManagementProcedure
    .input(z.object({
      date: isoDate,
      teamId: z.number().int().positive().optional(),
      technicianUserId: z.number().int().positive().optional(),
    }))
    .query(({ input }) => pmv2DailyReportService.getDailyReport(input)),

  markReviewed: pmv2ManagementProcedure
    .input(z.object({
      date: isoDate,
      teamId: z.number().int().positive(),
      note: z.string().max(1000).nullable().optional(),
    }))
    .mutation(({ input, ctx }) => pmv2DailyReportService.markReviewed({
      date: input.date,
      teamId: input.teamId,
      reviewedById: ctx.user.id,
      note: input.note ?? null,
    })),

  clearReview: pmv2ManagementProcedure
    .input(z.object({ date: isoDate, teamId: z.number().int().positive() }))
    .mutation(({ input }) => pmv2DailyReportService.clearReview(input.date, input.teamId)),
});
