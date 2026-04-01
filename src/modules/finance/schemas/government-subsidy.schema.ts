import { z } from "zod";

export const createGovernmentSubsidySchema = z.object({
  name: z.string().min(1, "Subsidy name is required"),
  subsidyType: z.enum(["FREE_SHS", "GOVERNMENT_PLACEMENT", "CAPITATION_GRANT", "OTHER_GOVERNMENT"], {
    message: "Invalid subsidy type",
  }),
  academicYearId: z.string().min(1, "Academic year is required"),
  termId: z.string().optional(),
  expectedAmount: z.coerce.number().min(0.01, "Expected amount must be greater than 0"),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateGovernmentSubsidyInput = z.infer<typeof createGovernmentSubsidySchema>;

export const updateGovernmentSubsidySchema = z.object({
  name: z.string().min(1).optional(),
  expectedAmount: z.coerce.number().min(0.01).optional(),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["EXPECTED", "PARTIALLY_RECEIVED", "RECEIVED", "OVERDUE"]).optional(),
});
export type UpdateGovernmentSubsidyInput = z.infer<typeof updateGovernmentSubsidySchema>;

export const recordDisbursementSchema = z.object({
  governmentSubsidyId: z.string().min(1, "Subsidy is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  receivedAt: z.coerce.date({ message: "Date received is required" }),
  bankReference: z.string().optional(),
  notes: z.string().optional(),
});
export type RecordDisbursementInput = z.infer<typeof recordDisbursementSchema>;
