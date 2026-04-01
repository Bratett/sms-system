import { z } from "zod";

export const createPettyCashFundSchema = z.object({
  name: z.string().min(1, "Fund name is required"),
  custodianId: z.string().min(1, "Custodian is required"),
  authorizedLimit: z.coerce.number().min(1, "Authorized limit must be greater than 0"),
});
export type CreatePettyCashFundInput = z.infer<typeof createPettyCashFundSchema>;

export const recordPettyCashTransactionSchema = z.object({
  pettyCashFundId: z.string().min(1, "Fund is required"),
  type: z.enum(["DISBURSEMENT", "REPLENISHMENT", "ADJUSTMENT"]),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  description: z.string().min(1, "Description is required"),
  receiptNumber: z.string().optional(),
  expenseCategoryId: z.string().optional(),
  date: z.coerce.date({ message: "Date is required" }),
});
export type RecordPettyCashTransactionInput = z.infer<typeof recordPettyCashTransactionSchema>;

export const requestReplenishmentSchema = z.object({
  pettyCashFundId: z.string().min(1, "Fund is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
});
export type RequestReplenishmentInput = z.infer<typeof requestReplenishmentSchema>;
