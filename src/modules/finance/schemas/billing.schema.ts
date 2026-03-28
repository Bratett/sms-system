import { z } from "zod";

export const generateBillsSchema = z.object({
  feeStructureId: z.string().min(1, "Fee structure is required"),
  classArmId: z.string().optional(),
});
export type GenerateBillsInput = z.infer<typeof generateBillsSchema>;
