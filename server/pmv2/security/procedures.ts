import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../../_core/trpc";
import {
  canAccessPmv2TechnicianExecution,
  canAccessPmv2WarehouseQueue,
  canManagePmv2Foundation,
} from "./policy";

/** Server-side guard for PM V2 configuration-management endpoints (Phases 1–2 baseline). */
export const pmv2ManagementProcedure = protectedProcedure.use(
  ({ ctx, next }) => {
    if (!canManagePmv2Foundation(ctx.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "ليس لديك صلاحية لإدارة PM V2",
      });
    }

    return next({ ctx });
  },
);

/** Phase 3 scoped technician guard; task membership is enforced by the technician service. */
export const pmv2TechnicianProcedure = protectedProcedure.use(
  ({ ctx, next }) => {
    if (!canAccessPmv2TechnicianExecution(ctx.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "ليس لديك صلاحية تنفيذ مهام PM V2 كفني",
      });
    }

    return next({ ctx });
  },
);

/** Phase 4 warehouse-side guard. Request visibility is intentionally distinct from PM V2 management. */
export const pmv2WarehouseProcedure = protectedProcedure.use(
  ({ ctx, next }) => {
    if (!canAccessPmv2WarehouseQueue(ctx.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "ليس لديك صلاحية لمعالجة طلبات مواد PM V2 في المستودع",
      });
    }

    return next({ ctx });
  },
);
