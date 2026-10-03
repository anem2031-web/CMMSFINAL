import { z } from "zod";
import { router } from "../_shared/procedures";
import { pmv2ManagementProcedure } from "../../pmv2/security/procedures";
import { pmv2MonitoringService } from "../../pmv2/monitoring/service";
import { pmv2SlaService, PMV2_SLA_ROLE_CATALOG } from "../../pmv2/monitoring/sla-service";
import { pmv2AlertService } from "../../pmv2/monitoring/alert-service";

const nullableMinutes = z.number().int().min(1).max(60 * 24 * 90).nullable();

export const pmv2MonitoringRouter = router({
  overview: pmv2ManagementProcedure.query(() => pmv2MonitoringService.getOverview()),

  taskDetail: pmv2ManagementProcedure
    .input(z.object({ taskId: z.number().int().positive() }))
    .query(({ input }) => pmv2MonitoringService.getTaskDetail(input.taskId)),

  slaRules: pmv2ManagementProcedure.query(() => pmv2SlaService.listRules()),

  updateSlaRule: pmv2ManagementProcedure
    .input(z.object({
      roleKey: z.string().refine((value) => PMV2_SLA_ROLE_CATALOG.some((item) => item.roleKey === value), "دور SLA غير معتمد"),
      slaMinutes: nullableMinutes,
      reminderMinutes: nullableMinutes,
      isActive: z.boolean(),
    }))
    .mutation(({ input, ctx }) => pmv2SlaService.upsertRule({ ...input, updatedById: ctx.user.id })),

  runAlertSweep: pmv2ManagementProcedure
    .mutation(() => pmv2AlertService.sweep()),
});
