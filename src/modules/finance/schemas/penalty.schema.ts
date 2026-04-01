import { z } from "zod";

export const createLatePenaltyRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required"),
  feeStructureId: z.string().optional(),
  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "DAILY_PERCENTAGE", "DAILY_FIXED"], {
    message: "Invalid penalty type",
  }),
  value: z.coerce.number().min(0.01, "Penalty value must be greater than 0"),
  gracePeriodDays: z.coerce.number().int().min(0, "Grace period must be 0 or greater").default(0),
  maxPenalty: z.coerce.number().min(0).optional().nullable(),
});
export type CreateLatePenaltyRuleInput = z.infer<typeof createLatePenaltyRuleSchema>;

export const updateLatePenaltyRuleSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "DAILY_PERCENTAGE", "DAILY_FIXED"]).optional(),
  value: z.coerce.number().min(0.01).optional(),
  gracePeriodDays: z.coerce.number().int().min(0).optional(),
  maxPenalty: z.coerce.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
});
export type UpdateLatePenaltyRuleInput = z.infer<typeof updateLatePenaltyRuleSchema>;
