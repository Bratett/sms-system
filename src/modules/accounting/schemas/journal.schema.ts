import { z } from "zod";

export const journalEntryLineSchema = z.object({
  debitAccountId: z.string().min(1, "Debit account is required"),
  creditAccountId: z.string().min(1, "Credit account is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  narration: z.string().optional(),
});

export const createJournalTransactionSchema = z.object({
  date: z.coerce.date({ message: "Date is required" }),
  description: z.string().min(1, "Description is required"),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  entries: z.array(journalEntryLineSchema).min(1, "At least one journal entry is required"),
});
export type CreateJournalTransactionInput = z.infer<typeof createJournalTransactionSchema>;
