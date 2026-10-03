import { z } from "zod";
import { router, protectedProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";
import { TRPCError } from "@trpc/server";
import { assertTicketReadable } from "./tickets.access";
import { detectLanguage } from "../../services/translation/translation";
import { queueTranslation } from "../../services/translation/translationEngine";

export const ticketsHistoryRouter = router({
  history: protectedProcedure.input(z.object({ ticketId: z.number() })).query(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.ticketId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    await assertTicketReadable(ctx.user, ticket as any);
    const rows = await db.getTicketHistory(input.ticketId);
    for (const row of rows as any[]) {
      const notes = String(row?.notes || "").trim();
      if (!notes || !row?.id) continue;
      void detectLanguage(notes)
        .then((sourceLanguage) => queueTranslation({
          entityType: "TICKET_STATUS_HISTORY",
          entityId: Number(row.id),
          fields: [{ fieldName: "notes", text: notes }],
          sourceLanguage,
          userId: ctx.user.id,
        }))
        .catch((error) => console.error("[TICKET_STATUS_HISTORY] Queue translation failed:", error));
    }
    return rows;
  }),
});
