import { z } from "zod";
import { inventoryReadProcedure, router } from "../_shared/procedures";
import * as db from "../../_core/db";
import { queueTranslation } from "../../services/translation/translationEngine";
import { detectLanguage } from "../../services/translation/translation";


async function queueReturnDocumentTranslation(id: number, itemName?: string | null, reason?: string | null, userId?: number) {
  const fields = [
    { fieldName: "itemName", text: (itemName || "").trim() },
    { fieldName: "reason", text: (reason || "").trim() },
  ].filter(field => field.text);
  if (!fields.length) return;
  const sourceLanguage = await detectLanguage(fields[0].text).catch(() => "ar" as const);
  await queueTranslation({ entityType: "RETURN_DOCUMENT", entityId: id, fields, sourceLanguage, userId });
}

export const returnDocumentsRouter = router({

  // جلب كل وثائق المرتجعات — تُنشأ تلقائياً بالخادم مع كل مرتجع (لا حاجة
  // لإجراء "generate" منفصل تستدعيه الواجهة)
  list: inventoryReadProcedure.query(async ({ ctx }) => {
    const documents = await db.getReturnDocuments();
    await Promise.all((documents as any[]).map(doc =>
      queueReturnDocumentTranslation(Number(doc.id), doc.itemName, doc.reason, ctx.user.id).catch(() => undefined)
    ));
    return documents;
  }),

  incrementPrint: inventoryReadProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const count = await db.incrementReturnDocPrintCount(input.id);
    return { printCount: count };
  }),
});
