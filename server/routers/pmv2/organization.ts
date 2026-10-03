import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../_shared/procedures";
import { Pmv2ExternalReferenceError } from "../../pmv2/adapters/current-system";
import {
  Pmv2OrganizationError,
  pmv2OrganizationService,
} from "../../pmv2/organization/service";
import { pmv2ManagementProcedure } from "../../pmv2/security/procedures";

const nullablePositiveId = z.number().int().positive().nullable().optional();

function actorFromContext(ctx: any) {
  return {
    userId: ctx.user.id,
    ipAddress: ctx.req.ip,
    userAgent: ctx.req.get?.("user-agent") ?? undefined,
  };
}

function toTrpcError(error: unknown): never {
  if (error instanceof Pmv2ExternalReferenceError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  if (error instanceof Pmv2OrganizationError) {
    if (error.code === "NOT_FOUND") {
      throw new TRPCError({ code: "NOT_FOUND", message: error.message });
    }
    if (error.code === "CONFLICT") {
      throw new TRPCError({ code: "CONFLICT", message: error.message });
    }
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw error;
}

export const pmv2OrganizationRouter = router({
  references: router({
    users: pmv2ManagementProcedure.query(() =>
      pmv2OrganizationService.listActiveUsers(),
    ),
    warehouses: pmv2ManagementProcedure.query(() =>
      pmv2OrganizationService.listActiveWarehouses(),
    ),
  }),

  specialties: router({
    list: pmv2ManagementProcedure.query(() =>
      pmv2OrganizationService.listSpecialties(),
    ),
    create: pmv2ManagementProcedure
      .input(
        z.object({
          code: z.string().trim().min(1).max(50),
          name: z.string().trim().min(1).max(200),
          nameEn: z.string().trim().max(200).nullable().optional(),
          nameUr: z.string().trim().max(200).nullable().optional(),
          description: z.string().trim().nullable().optional(),
          managerUserId: nullablePositiveId,
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await pmv2OrganizationService.createSpecialty(
            input,
            actorFromContext(ctx),
          );
        } catch (error) {
          return toTrpcError(error);
        }
      }),
    update: pmv2ManagementProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          code: z.string().trim().min(1).max(50).optional(),
          name: z.string().trim().min(1).max(200).optional(),
          nameEn: z.string().trim().max(200).nullable().optional(),
          nameUr: z.string().trim().max(200).nullable().optional(),
          description: z.string().trim().nullable().optional(),
          managerUserId: nullablePositiveId,
          isActive: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await pmv2OrganizationService.updateSpecialty(
            input,
            actorFromContext(ctx),
          );
        } catch (error) {
          return toTrpcError(error);
        }
      }),
  }),

  teams: router({
    list: pmv2ManagementProcedure.query(() => pmv2OrganizationService.listTeams()),
    create: pmv2ManagementProcedure
      .input(
        z.object({
          specialtyId: z.number().int().positive(),
          code: z.string().trim().min(1).max(50),
          warehouseId: z.number().int().positive(),
          deviceUserId: nullablePositiveId,
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await pmv2OrganizationService.createTeam(
            input,
            actorFromContext(ctx),
          );
        } catch (error) {
          return toTrpcError(error);
        }
      }),
    update: pmv2ManagementProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          specialtyId: z.number().int().positive().optional(),
          code: z.string().trim().min(1).max(50).optional(),
          warehouseId: z.number().int().positive().optional(),
          deviceUserId: nullablePositiveId,
          isActive: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await pmv2OrganizationService.updateTeam(
            input,
            actorFromContext(ctx),
          );
        } catch (error) {
          return toTrpcError(error);
        }
      }),
    members: router({
      list: pmv2ManagementProcedure
        .input(z.object({ teamId: z.number().int().positive() }))
        .query(({ input }) => pmv2OrganizationService.listTeamMembers(input.teamId)),
      add: pmv2ManagementProcedure
        .input(
          z.object({
            teamId: z.number().int().positive(),
            userId: z.number().int().positive(),
          }),
        )
        .mutation(async ({ input, ctx }) => {
          try {
            return await pmv2OrganizationService.addTeamMember(
              input.teamId,
              input.userId,
              actorFromContext(ctx),
            );
          } catch (error) {
            return toTrpcError(error);
          }
        }),
      deactivate: pmv2ManagementProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input, ctx }) => {
          try {
            return await pmv2OrganizationService.deactivateTeamMember(
              input.id,
              actorFromContext(ctx),
            );
          } catch (error) {
            return toTrpcError(error);
          }
        }),
    }),
  }),
});
