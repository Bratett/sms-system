import { z } from "zod";

export const createDonorFundSchema = z.object({
  donorName: z.string().min(1, "Donor name is required"),
  donorType: z.enum(["INDIVIDUAL", "ORGANIZATION", "FOUNDATION", "ALUMNI", "CORPORATE"], {
    message: "Invalid donor type",
  }),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  totalPledged: z.coerce.number().min(0.01, "Pledged amount must be greater than 0"),
  purpose: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});
export type CreateDonorFundInput = z.infer<typeof createDonorFundSchema>;

export const updateDonorFundSchema = z.object({
  donorName: z.string().min(1).optional(),
  donorType: z.enum(["INDIVIDUAL", "ORGANIZATION", "FOUNDATION", "ALUMNI", "CORPORATE"]).optional(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  totalPledged: z.coerce.number().min(0.01).optional(),
  totalReceived: z.coerce.number().min(0).optional(),
  purpose: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});
export type UpdateDonorFundInput = z.infer<typeof updateDonorFundSchema>;

export const allocateDonorFundSchema = z.object({
  donorFundId: z.string().min(1, "Donor fund is required"),
  studentId: z.string().min(1, "Student is required"),
  termId: z.string().min(1, "Term is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  description: z.string().optional(),
});
export type AllocateDonorFundInput = z.infer<typeof allocateDonorFundSchema>;
