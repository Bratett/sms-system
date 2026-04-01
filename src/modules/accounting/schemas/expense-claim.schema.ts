import { z } from "zod";

export const expenseClaimItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  date: z.coerce.date({ message: "Date is required" }),
  receiptUrl: z.string().optional(),
  expenseCategoryId: z.string().optional(),
});

export const submitExpenseClaimSchema = z.object({
  description: z.string().min(1, "Claim description is required"),
  items: z.array(expenseClaimItemSchema).min(1, "At least one item is required"),
});
export type SubmitExpenseClaimInput = z.infer<typeof submitExpenseClaimSchema>;
