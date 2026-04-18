import { z } from "zod";

export const journalLineSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  side: z.enum(["DEBIT", "CREDIT"]),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  narration: z.string().optional(),
  fundId: z.string().optional().nullable(),
});

export const createJournalTransactionSchema = z
  .object({
    date: z.coerce.date({ message: "Date is required" }),
    description: z.string().min(1, "Description is required"),
    referenceType: z.string().optional(),
    referenceId: z.string().optional(),
    lines: z.array(journalLineSchema).min(2, "At least two lines (one debit, one credit) are required"),
  })
  .refine(
    (data) => {
      const debits = data.lines.filter((l) => l.side === "DEBIT").reduce((s, l) => s + l.amount, 0);
      const credits = data.lines.filter((l) => l.side === "CREDIT").reduce((s, l) => s + l.amount, 0);
      return Math.abs(debits - credits) < 0.005;
    },
    { message: "Journal must balance — total debits must equal total credits.", path: ["lines"] },
  )
  .refine((data) => data.lines.some((l) => l.side === "DEBIT") && data.lines.some((l) => l.side === "CREDIT"), {
    message: "Journal must contain at least one DEBIT and one CREDIT line.",
    path: ["lines"],
  });

export type CreateJournalTransactionInput = z.infer<typeof createJournalTransactionSchema>;
export type JournalLineInput = z.infer<typeof journalLineSchema>;
