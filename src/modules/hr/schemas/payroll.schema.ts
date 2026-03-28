import { z } from "zod";

export const createAllowanceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["FIXED", "PERCENTAGE"], { message: "Type is required" }),
  amount: z.number().min(0, "Amount must be 0 or more"),
});

export type CreateAllowanceInput = z.infer<typeof createAllowanceSchema>;

export const createDeductionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["FIXED", "PERCENTAGE"], { message: "Type is required" }),
  amount: z.number().min(0, "Amount must be 0 or more"),
  isStatutory: z.boolean().optional(),
});

export type CreateDeductionInput = z.infer<typeof createDeductionSchema>;

export const createPayrollPeriodSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

export type CreatePayrollPeriodInput = z.infer<typeof createPayrollPeriodSchema>;
