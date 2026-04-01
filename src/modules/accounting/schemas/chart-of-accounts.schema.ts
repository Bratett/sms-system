import { z } from "zod";

export const createAccountCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
});
export type CreateAccountCategoryInput = z.infer<typeof createAccountCategorySchema>;

export const createAccountSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  parentId: z.string().optional(),
  code: z.string().min(1, "Account code is required"),
  name: z.string().min(1, "Account name is required"),
  description: z.string().optional(),
  normalBalance: z.enum(["DEBIT", "CREDIT"]),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
