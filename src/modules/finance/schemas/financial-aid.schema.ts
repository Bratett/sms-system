import { z } from "zod";

export const createFinancialAidApplicationSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  termId: z.string().min(1, "Term is required"),
  aidType: z.enum(["NEEDS_BASED", "MERIT_BASED", "HARDSHIP", "ORPHAN_SUPPORT", "COMMUNITY_SPONSORED"], {
    message: "Invalid aid type",
  }),
  requestedAmount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  reason: z.string().min(1, "Reason is required"),
  householdIncome: z.coerce.number().min(0).optional(),
  numberOfDependents: z.coerce.number().int().min(0).optional(),
  supportingDocs: z.array(z.string()).default([]),
});
export type CreateFinancialAidApplicationInput = z.infer<typeof createFinancialAidApplicationSchema>;

export const reviewFinancialAidSchema = z.object({
  applicationId: z.string().min(1, "Application is required"),
  status: z.enum(["APPROVED", "REJECTED"], { message: "Status must be APPROVED or REJECTED" }),
  approvedAmount: z.coerce.number().min(0).optional(),
  reviewNotes: z.string().optional(),
});
export type ReviewFinancialAidInput = z.infer<typeof reviewFinancialAidSchema>;
