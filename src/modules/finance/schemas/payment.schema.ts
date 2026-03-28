import { z } from "zod";

export const recordPaymentSchema = z.object({
  studentBillId: z.string().min(1, "Student bill is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CHEQUE", "OTHER"], {
    message: "Invalid payment method",
  }),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const initiateReversalSchema = z.object({
  paymentId: z.string().min(1, "Payment ID is required"),
  reason: z.string().min(1, "Reason is required"),
});
export type InitiateReversalInput = z.infer<typeof initiateReversalSchema>;
