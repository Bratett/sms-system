"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { returnBookAction } from "@/modules/library/actions/library.action";

// ─── Types ──────────────────────────────────────────────────────────

interface BookIssue {
  id: string;
  bookTitle: string;
  borrowerId: string;
  borrowerName: string;
  borrowerType: string;
  issuedAt: Date | string;
  dueDate: Date | string;
  daysOverdue: number;
  estimatedFine: number;
  [key: string]: unknown;
}

// ─── Component ──────────────────────────────────────────────────────

export function OverdueClient({ issues }: { issues: BookIssue[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function calculateDaysOverdue(dueDate: string | Date): number {
    const due = new Date(dueDate);
    const now = new Date();
    const diff = now.getTime() - due.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  function handleReturn(issueId: string) {
    if (!confirm("Mark this book as returned?")) return;

    startTransition(async () => {
      const result = await returnBookAction(issueId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Book returned successfully.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg border bg-card p-6">
        <p className="text-sm font-medium text-muted-foreground">Total Overdue</p>
        <p className={`mt-2 text-3xl font-bold ${issues.length > 0 ? "text-red-600" : ""}`}>
          {issues.length}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Book Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Borrower</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Borrower Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Issue Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Due Date</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Days Overdue</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {issues.map((issue) => {
              const daysOverdue = calculateDaysOverdue(issue.dueDate);
              return (
                <tr key={issue.id}>
                  <td className="px-4 py-3 text-sm font-medium">{issue.bookTitle}</td>
                  <td className="px-4 py-3 text-sm">{issue.borrowerName}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                      {issue.borrowerType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(issue.issuedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(issue.dueDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                      {daysOverdue} days
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleReturn(issue.id)}
                      disabled={isPending}
                      className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Return
                    </button>
                  </td>
                </tr>
              );
            })}
            {issues.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No overdue books. All clear!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
