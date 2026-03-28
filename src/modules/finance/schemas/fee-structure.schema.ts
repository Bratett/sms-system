import { z } from "zod";

export const feeItemSchema = z.object({
  name: z.string().min(1, "Fee item name is required"),
  code: z.string().optional(),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  isOptional: z.boolean().optional().default(false),
  description: z.string().optional(),
});
export type FeeItemInput = z.infer<typeof feeItemSchema>;

export const createFeeStructureSchema = z.object({
  name: z.string().min(1, "Name is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  termId: z.string().min(1, "Term is required"),
  programmeId: z.string().optional(),
  boardingStatus: z.enum(["DAY", "BOARDING"], { message: "Invalid boarding status" }).optional(),
  feeItems: z.array(feeItemSchema).min(1, "At least one fee item is required"),
});
export type CreateFeeStructureInput = z.infer<typeof createFeeStructureSchema>;

export const updateFeeStructureSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  programmeId: z.string().optional().nullable(),
  boardingStatus: z.enum(["DAY", "BOARDING"], { message: "Invalid boarding status" }).optional().nullable(),
});
export type UpdateFeeStructureInput = z.infer<typeof updateFeeStructureSchema>;

export const addFeeItemSchema = feeItemSchema;
export type AddFeeItemInput = FeeItemInput;
