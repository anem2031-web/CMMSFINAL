import { z } from "zod";

export const issueCostAllocationSchema = z.object({
  beneficiarySiteId: z.number().int().positive("الموقع مطلوب"),
  beneficiarySectionId: z.number().int().positive("القسم مطلوب"),
  beneficiaryAssetId: z.number().int().positive().nullable().optional(),
  quantity: z.number().min(0.001, "كمية الصرف يجب أن تكون 0.001 أو أكثر"),
});

export const issueCostAllocationsSchema = z
  .array(issueCostAllocationSchema)
  .length(1, "كل عملية صرف يجب أن تُحمّل على جهة مستفيدة واحدة فقط");

export type IssueCostAllocationInput = z.infer<typeof issueCostAllocationSchema>;
