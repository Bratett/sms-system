import { z } from "zod";

export const createExpenseSchema = z.object({
  expenseCategoryId: z.string().min(1, "Expense category is required"),
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  date: z.coerce.date({ message: "Date is required" }),
  payee: z.string().optional(),
  referenceNumber: z.string().optional(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CHEQUE", "OTHER"]).optional(),
  departmentId: z.string().optional(),
  termId: z.string().optional(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  code: z.string().optional(),
  accountId: z.string().optional(),
  parentId: z.string().optional(),
});
export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;
