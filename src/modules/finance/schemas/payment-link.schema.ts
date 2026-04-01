import { z } from "zod";

export const createPaymentLinkSchema = z.object({
  studentBillId: z.string().min(1, "Student bill is required"),
  amount: z.coerce.number().min(0.01).optional(),
  description: z.string().optional(),
  expiresInDays: z.coerce.number().int().min(1).max(90).optional().default(30),
  isOneTime: z.boolean().optional().default(true),
});
export type CreatePaymentLinkInput = z.infer<typeof createPaymentLinkSchema>;

export const uploadBankStatementSchema = z.object({
  bankName: z.string().min(1, "Bank name is required"),
  accountNumber: z.string().optional(),
  statementDate: z.coerce.date({ message: "Statement date is required" }),
  entries: z.array(z.object({
    transactionDate: z.coerce.date(),
    description: z.string().min(1),
    reference: z.string().optional(),
    debitAmount: z.coerce.number().min(0).optional(),
    creditAmount: z.coerce.number().min(0).optional(),
    balance: z.coerce.number().optional(),
  })).min(1, "At least one entry is required"),
});
export type UploadBankStatementInput = z.infer<typeof uploadBankStatementSchema>;
