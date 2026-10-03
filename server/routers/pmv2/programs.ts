import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../_shared/procedures";
import {
  Pmv2ProgramServiceError,
  pmv2ProgramService,
} from "../../pmv2/programs/service";
import { Pmv2ProgramTargetValidationError } from "../../pmv2/programs/target-validation";
import { pmv2ManagementProcedure } from "../../pmv2/security/procedures";

const targetSchema = z.discriminatedUnion("type", [
  z.object({ programId: z.number().int().positive(), type: z.literal("site"), siteId: z.number().int().positive() }),
  z.object({ programId: z.number().int().positive(), type: z.literal("section"), sectionId: z.number().int().positive() }),
  z.object({ programId: z.number().int().positive(), type: z.literal("asset"), assetId: z.number().int().positive() }),
]);

function actorFromContext(ctx: any) {
  return {
    userId: ctx.user.id,
    ipAddress: ctx.req.ip,
    userAgent: ctx.req.get?.("user-agent") ?? undefined,
  };
}

function toTrpcError(error: unknown): never {
  if (error instanceof Pmv2ProgramTargetValidationError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  if (error instanceof Pmv2ProgramServiceError) {
    const code =
      error.code === "NOT_FOUND"
        ? "NOT_FOUND"
        : error.code === "CONFLICT"
          ? "CONFLICT"
          : "BAD_REQUEST";
    throw new TRPCError({ code, message: error.message });
  }
  throw error;
}

export const pmv2ProgramsRouter = router({
  list: pmv2ManagementProcedure
    .input(z.object({ includeInactive: z.boolean().optional() }).optional())
    .query(({ input }) => pmv2ProgramService.listPrograms(input?.includeInactive ?? false)),

  get: pmv2ManagementProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => ({
      program: await pmv2ProgramService.getProgram(input.id),
      targets: await pmv2ProgramService.listTargets(input.id),
    })),

  create: pmv2ManagementProcedure
    .input(z.object({
      title: z.string().trim().max(200).nullable().optional(),
      teamId: z.number().int().positive(),
      checklistId: z.number().int().positive(),
      estimatedDurationMinutes: z.number().int().positive().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await pmv2ProgramService.createProgram(input, actorFromContext(ctx));
      } catch (error) {
        return toTrpcError(error);
      }
    }),

  update: pmv2ManagementProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().trim().max(200).nullable().optional(),
        teamId: z.number().int().positive().optional(),
        checklistId: z.number().int().positive().optional(),
        estimatedDurationMinutes: z.number().int().positive().nullable().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await pmv2ProgramService.updateProgram(input, actorFromContext(ctx));
      } catch (error) {
        return toTrpcError(error);
      }
    }),

  targets: router({
    list: pmv2ManagementProcedure
      .input(z.object({ programId: z.number().int().positive() }))
      .query(({ input }) => pmv2ProgramService.listTargets(input.programId)),
    add: pmv2ManagementProcedure
      .input(targetSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await pmv2ProgramService.addTarget(input, actorFromContext(ctx));
        } catch (error) {
          return toTrpcError(error);
        }
      }),
  }),
});
