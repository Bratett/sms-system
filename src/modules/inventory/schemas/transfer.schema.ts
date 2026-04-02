import { z } from "zod";

export const createTransferSchema = z.object({
  fromStoreId: z.string().min(1, "Source store is required"),
  toStoreId: z.string().min(1, "Destination store is required"),
  reason: z.string().optional(),
  items: z
    .array(
      z.object({
        storeItemId: z.string().min(1, "Item is required"),
        quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
      }),
    )
    .min(1, "At least one item is required"),
});
export type CreateTransferInput = z.infer<typeof createTransferSchema>;

export const receiveTransferSchema = z.object({
  items: z
    .array(
      z.object({
        storeTransferItemId: z.string().min(1),
        receivedQty: z.coerce.number().int().min(0, "Received quantity cannot be negative"),
      }),
    )
    .min(1, "At least one item is required"),
});
export type ReceiveTransferInput = z.infer<typeof receiveTransferSchema>;
