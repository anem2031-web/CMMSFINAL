import { z } from "zod";
import { router } from "../_shared/procedures";
import { currentMaintenanceTargetAdapter } from "../../pmv2/adapters/current-system";
import { pmv2ManagementProcedure } from "../../pmv2/security/procedures";

const targetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("site"), siteId: z.number().int().positive() }),
  z.object({ type: z.literal("section"), sectionId: z.number().int().positive() }),
  z.object({ type: z.literal("asset"), assetId: z.number().int().positive() }),
]);

/** Phase 1 read/validation boundary for current Site | Section | Asset master data. */
export const pmv2TargetsRouter = router({
  sites: pmv2ManagementProcedure.query(() =>
    currentMaintenanceTargetAdapter.listSites(),
  ),
  sections: pmv2ManagementProcedure
    .input(z.object({ siteId: z.number().int().positive().optional() }).optional())
    .query(({ input }) =>
      currentMaintenanceTargetAdapter.listSections(input?.siteId),
    ),
  assets: pmv2ManagementProcedure
    .input(
      z
        .object({
          siteId: z.number().int().positive().optional(),
          sectionId: z.number().int().positive().optional(),
        })
        .optional(),
    )
    .query(({ input }) => currentMaintenanceTargetAdapter.listAssets(input)),
  validate: pmv2ManagementProcedure
    .input(targetSchema)
    .query(async ({ input }) => ({
      valid: await currentMaintenanceTargetAdapter.validateTarget(input),
    })),
});
