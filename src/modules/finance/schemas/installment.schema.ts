import { z } from "zod";

export const installmentScheduleSchema = z.object({
  installmentNumber: z.coerce.number().int().min(1, "Installment number must be at least 1"),
  percentageOfTotal: z.coerce.number().min(0.01, "Percentage must be greater than 0").max(100, "Percentage cannot exceed 100"),
  dueDaysFromStart: z.coerce.number().int().min(0, "Due days must be 0 or greater"),
  label: z.string().optional(),
});

export const createInstallmentPlanSchema = z
  .object({
    name: z.string().min(1, "Plan name is required"),
    feeStructureId: z.string().optional(),
    numberOfInstallments: z.coerce.number().int().min(2, "Must have at least 2 installments"),
    schedules: z.array(installmentScheduleSchema).min(2, "At least 2 installment schedules are required"),
  })
  .refine(
    (data) => {
      const totalPercentage = data.schedules.reduce((sum, s) => sum + s.percentageOfTotal, 0);
      return Math.abs(totalPercentage - 100) < 0.01;
    },
    { message: "Installment percentages must sum to 100%", path: ["schedules"] }
  );
export type CreateInstallmentPlanInput = z.infer<typeof createInstallmentPlanSchema>;

export const applyInstallmentPlanSchema = z.object({
  studentBillId: z.string().min(1, "Student bill is required"),
  installmentPlanId: z.string().min(1, "Installment plan is required"),
  termStartDate: z.coerce.date({ message: "Term start date is required" }),
});
export type ApplyInstallmentPlanInput = z.infer<typeof applyInstallmentPlanSchema>;
