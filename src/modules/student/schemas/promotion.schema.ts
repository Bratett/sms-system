import { z } from "zod";

export const createPromotionRunSchema = z.object({
  sourceClassArmId: z.string().cuid(),
});

export const updatePromotionRunItemSchema = z.object({
  itemId: z.string().cuid(),
  outcome: z.enum(["PROMOTE", "RETAIN", "GRADUATE", "WITHDRAW"]).optional(),
  destinationClassArmId: z.string().cuid().nullable().optional(),
  notes: z.string().max(500).optional(),
});

export const bulkUpdatePromotionRunItemsSchema = z.object({
  runId: z.string().cuid(),
  itemIds: z.array(z.string().cuid()).min(1),
  outcome: z.enum(["PROMOTE", "RETAIN", "GRADUATE", "WITHDRAW"]).optional(),
  destinationClassArmId: z.string().cuid().nullable().optional(),
});

export const revertPromotionRunSchema = z.object({
  runId: z.string().cuid(),
  reason: z.string().min(5).max(500),
});
