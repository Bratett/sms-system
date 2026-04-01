import { z } from "zod";

export const budgetLineSchema = z.object({
  expenseCategoryId: z.string().min(1, "Expense category is required"),
  departmentId: z.string().optional(),
  allocatedAmount: z.coerce.number().min(0, "Amount must be 0 or greater"),
  description: z.string().optional(),
});

export const createBudgetSchema = z.object({
  name: z.string().min(1, "Budget name is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  termId: z.string().optional(),
  lines: z.array(budgetLineSchema).min(1, "At least one budget line is required"),
});
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
