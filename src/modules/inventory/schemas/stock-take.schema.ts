import { z } from "zod";

export const createStockTakeSchema = z.object({
  storeId: z.string().min(1, "Store is required"),
  scheduledDate: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateStockTakeInput = z.infer<typeof createStockTakeSchema>;

export const recordCountSchema = z.object({
  counts: z
    .array(
      z.object({
        stockTakeItemId: z.string().min(1),
        physicalQuantity: z.coerce.number().int().min(0, "Quantity cannot be negative"),
        varianceReason: z.string().optional(),
      }),
    )
    .min(1, "At least one count is required"),
});
export type RecordCountInput = z.infer<typeof recordCountSchema>;
