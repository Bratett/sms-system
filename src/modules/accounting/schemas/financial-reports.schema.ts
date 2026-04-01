import { z } from "zod";

export const generateReportSchema = z.object({
  reportType: z.enum([
    "BALANCE_SHEET", "INCOME_STATEMENT", "CASH_FLOW", "TRIAL_BALANCE",
    "GENERAL_LEDGER", "BUDGET_VS_ACTUAL", "BOARD_SUMMARY",
  ]),
  periodStart: z.coerce.date({ message: "Start date is required" }),
  periodEnd: z.coerce.date({ message: "End date is required" }),
});
export type GenerateReportInput = z.infer<typeof generateReportSchema>;

export const createTaxRecordSchema = z.object({
  taxType: z.enum(["PAYE", "VAT", "WITHHOLDING", "CORPORATE_TAX", "SSNIT"]),
  period: z.string().min(1, "Period is required"),
  amount: z.coerce.number().min(0, "Amount must be 0 or greater"),
  dueDate: z.coerce.date({ message: "Due date is required" }),
  referenceNumber: z.string().optional(),
});
export type CreateTaxRecordInput = z.infer<typeof createTaxRecordSchema>;
