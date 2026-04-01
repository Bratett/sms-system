import { z } from "zod";

export const requestFeeWaiverSchema = z.object({
  studentBillId: z.string().min(1, "Student bill is required"),
  studentBillItemId: z.string().optional(),
  waiverType: z.enum(
    ["PERCENTAGE", "FIXED_AMOUNT", "FULL_WAIVER", "STAFF_CHILD_DISCOUNT", "SIBLING_DISCOUNT"],
    { message: "Invalid waiver type" }
  ),
  value: z.coerce.number().min(0, "Value must be 0 or greater"),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional(),
});
export type RequestFeeWaiverInput = z.infer<typeof requestFeeWaiverSchema>;

export const reviewFeeWaiverSchema = z.object({
  waiverId: z.string().min(1, "Waiver ID is required"),
  notes: z.string().optional(),
});
export type ReviewFeeWaiverInput = z.infer<typeof reviewFeeWaiverSchema>;
