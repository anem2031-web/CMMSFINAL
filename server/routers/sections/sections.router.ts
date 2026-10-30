import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../_shared/procedures";
import { detectLanguage } from "../../services/translation/translation";
import * as db from "../../_core/db";
import { localizeNamedRecords } from "../../services/translation/localizedMasterData";
import { queueTranslation } from "../../services/translation/translationEngine";

export const sectionsRouter = router({
  list: protectedProcedure.input(z.object({ siteId: z.number().optional() }).optional()).query(async ({ input, ctx }) => {
    const rows = await db.getSections(input?.siteId);
    return localizeNamedRecords("SECTION", rows as any[], (ctx.user.preferredLanguage || "ar") as any, { translateMissing: false });
  }),

  create: protectedProcedure.input(z.object({
    name: z.string().min(1),
    siteId: z.number(),
    description: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const name = input.name.trim();
    const id = await db.createSection({ ...input, name, isActive: true });
    if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر حفظ القسم" });
    const sourceLanguage = await detectLanguage(name);
    await Promise.all([
      db.createAuditLog({ userId: ctx.user.id, action: "create_section", entityType: "section", entityId: id, newValues: input }),
      queueTranslation({ entityType: "SECTION", entityId: id, fields: [{ fieldName: "name", text: name }], sourceLanguage, userId: ctx.user.id })
        .catch(error => console.error("[SECTION] translation queue failed:", error)),
    ]);
    return { id };
  }),

  update: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
  })).mutation(async ({ input, ctx }) => {
    const { id, ...updateData } = input;
    const current = await db.getSectionById(id);
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "القسم غير موجود" });
    const name = updateData.name?.trim();
    const nameChanged = name !== undefined && name !== current.name.trim();
    const { name: _submittedName, ...otherFields } = updateData;
    await db.updateSection(id, {
      ...otherFields,
      ...(nameChanged ? { name, nameEn: null, nameUr: null } : {}),
    });
    await Promise.all([
      db.createAuditLog({ userId: ctx.user.id, action: "update_section", entityType: "section", entityId: id, newValues: updateData }),
      ...(nameChanged ? [queueTranslation({ entityType: "SECTION", entityId: id, fields: [{ fieldName: "name", text: name! }], sourceLanguage: await detectLanguage(name!), userId: ctx.user.id })
        .catch(error => console.error("[SECTION] re-translation queue failed:", error))] : []),
    ]);
    return { success: true };
  }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await db.deleteSection(input.id);
    await db.createAuditLog({ userId: ctx.user.id, action: "delete_section", entityType: "section", entityId: input.id });
    return { success: true };
  }),
});
