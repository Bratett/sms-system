import { z } from "zod";

export const createRequisitionSchema = z.object({
  storeId: z.string().min(1, "Store is required"),
  department: z.string().min(1, "Department is required"),
  purpose: z.string().optional(),
  items: z
    .array(
      z.object({
        storeItemId: z.string().min(1, "Item is required"),
        quantityRequested: z.coerce.number().int().min(1, "Quantity must be at least 1"),
      }),
    )
    .min(1, "At least one item is required"),
});
export type CreateRequisitionInput = z.infer<typeof createRequisitionSchema>;

export const issueRequisitionSchema = z.object({
  items: z
    .array(
      z.object({
        requisitionItemId: z.string().min(1),
        quantityIssued: z.coerce.number().int().min(0, "Quantity cannot be negative"),
      }),
    )
    .min(1, "At least one item is required"),
});
export type IssueRequisitionInput = z.infer<typeof issueRequisitionSchema>;
