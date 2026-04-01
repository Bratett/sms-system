import { z } from "zod";

export const feeTemplateItemSchema = z.object({
  name: z.string().min(1, "Fee item name is required"),
  code: z.string().optional(),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  isOptional: z.boolean().optional().default(false),
  description: z.string().optional(),
});

export const createFeeTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  boardingStatus: z.enum(["DAY", "BOARDING"]).optional(),
  programmeId: z.string().optional(),
  items: z.array(feeTemplateItemSchema).min(1, "At least one fee item is required"),
});
export type CreateFeeTemplateInput = z.infer<typeof createFeeTemplateSchema>;

export const updateFeeTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").optional(),
  description: z.string().optional().nullable(),
  boardingStatus: z.enum(["DAY", "BOARDING"]).optional().nullable(),
  programmeId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});
export type UpdateFeeTemplateInput = z.infer<typeof updateFeeTemplateSchema>;

export const createFromTemplateSchema = z.object({
  feeTemplateId: z.string().min(1, "Fee template is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  termId: z.string().min(1, "Term is required"),
  name: z.string().min(1, "Fee structure name is required"),
  adjustments: z
    .array(
      z.object({
        itemName: z.string(),
        newAmount: z.coerce.number().min(0, "Amount cannot be negative").optional(),
      })
    )
    .optional(),
});
export type CreateFromTemplateInput = z.infer<typeof createFromTemplateSchema>;
