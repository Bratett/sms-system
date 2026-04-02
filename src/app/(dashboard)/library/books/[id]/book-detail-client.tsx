"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  issueBookAction,
  returnBookAction,
} from "@/modules/library/actions/library.action";

// ─── Types ──────────────────────────────────────────────────────────

import type { Monetary } from "@/lib/monetary";
interface BookIssue {
  id: string;
  borrowerId: string;
  borrowerName: string;
  borrowerType: string;
  issuedAt: Date | string;
  dueDate: Date | string;
  returnedAt: Date | string | null;
  status: string;
  fineAmount: Monetary | null;
  [key: string]: unknown;
}

interface Book {
  id: string;
  isbn: string | null;
  title: string;
  author: string;
  publisher: string | null;
  publicationYear: number | null;
  category: string | null;
  shelfLocation: string | null;
  totalCopies: number;
  availableCopies: number;
  coverImageUrl: string | null;
  status: string;
  issues?: BookIssue[];
}

// ─── Component ──────────────────────────────────────────────────────

export function BookDetailClient({ book }: { book: Book }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Issue form
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueForm, setIssueForm] = useState({
    borrowerId: "",
    borrowerType: "STUDENT" as "STUDENT" | "STAFF",
    dueDate: "",
  });

  const activeIssues = (book.issues ?? []).filter((i) => !i.returnedAt);

  // ─── Status Badge ───────────────────────────────────────────────

  function statusBadge(s: string) {
    switch (s) {
      case "AVAILABLE":
        return (
          <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
            Available
          </span>
        );
      case "LOW_STOCK":
        return (
          <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">
            Low Stock
          </span>
        );
      case "OUT_OF_STOCK":
        return (
          <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
            Out of Stock
          </span>
        );
      case "ARCHIVED":
        return (
          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-950 dark:text-gray-400">
            Archived
          </span>
        );
      default:
        return (
          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-950 dark:text-gray-400">
            {s}
          </span>
        );
    }
  }

  // ─── Issue Book ─────────────────────────────────────────────────

  function handleIssueBook() {
    if (!issueForm.borrowerId.trim()) {
      toast.error("Borrower ID is required.");
      return;
    }
    if (!issueForm.dueDate) {
      toast.error("Due date is required.");
      return;
    }

    startTransition(async () => {
      const result = await issueBookAction({
        bookId: book.id,
        borrowerId: issueForm.borrowerId,
        borrowerType: issueForm.borrowerType,
        dueDate: new Date(issueForm.dueDate),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Book issued successfully.");
      setShowIssueForm(false);
      setIssueForm({ borrowerId: "", borrowerType: "STUDENT", dueDate: "" });
      router.refresh();
    });
  }

  function handleReturn(issueId: string) {
    if (!confirm("Mark this book as returned?")) return;

    startTransition(async () => {
      const result = await returnBookAction(issueId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Book returned successfully.");
      router.refresh();
    });
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Book Details Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Title</p>
              <p className="text-sm font-medium">{book.title}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Author</p>
              <p className="text-sm">{book.author}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">ISBN</p>
              <p className="text-sm">{book.isbn ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Publisher</p>
              <p className="text-sm">{book.publisher ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Publication Year</p>
              <p className="text-sm">{book.publicationYear ?? "-"}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Category</p>
              <p className="text-sm">{book.category ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Shelf Location</p>
              <p className="text-sm">{book.shelfLocation ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Copies</p>
              <p className="text-sm">{book.totalCopies}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Available Copies</p>
              <p className="text-sm font-medium">{book.availableCopies}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Status</p>
              <div className="mt-1">{statusBadge(book.status)}</div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={() => setShowIssueForm(true)}
            disabled={isPending || book.availableCopies <= 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Issue Book
          </button>
        </div>
      </div>

      {/* Active Issues */}
      {activeIssues.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="border-b px-6 py-4">
            <h2 className="text-lg font-semibold">Active Issues</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Borrower</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Issue Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Due Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-card">
                {activeIssues.map((issue) => {
                  const isOverdue = new Date(issue.dueDate) < new Date();
                  return (
                    <tr key={issue.id}>
                      <td className="px-4 py-3 text-sm font-medium">{issue.borrowerName}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                          {issue.borrowerType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(issue.issuedAt).toLocaleDateString()}
                      </td>
                      <td className={`px-4 py-3 text-sm ${isOverdue ? "font-medium text-red-600" : "text-muted-foreground"}`}>
                        {new Date(issue.dueDate).toLocaleDateString()}
                        {isOverdue && " (Overdue)"}
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
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Issue History */}
      {(book.issues ?? []).length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="border-b px-6 py-4">
            <h2 className="text-lg font-semibold">Issue History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Borrower</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Issue Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Return Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-card">
                {(book.issues ?? []).map((issue) => (
                  <tr key={issue.id}>
                    <td className="px-4 py-3 text-sm font-medium">{issue.borrowerName}</td>
                    <td className="px-4 py-3 text-sm">{issue.borrowerType}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(issue.issuedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(issue.dueDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {issue.returnedAt ? new Date(issue.returnedAt).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {issue.returnedAt ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
                          Returned
                        </span>
                      ) : new Date(issue.dueDate) < new Date() ? (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                          Overdue
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                          Issued
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Issue Book Modal */}
      {showIssueForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Issue Book</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Issue &quot;{book.title}&quot; to a borrower.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Borrower ID *</label>
                <input
                  type="text"
                  value={issueForm.borrowerId}
                  onChange={(e) => setIssueForm({ ...issueForm, borrowerId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Student or staff ID"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Borrower Type *</label>
                <select
                  value={issueForm.borrowerType}
                  onChange={(e) => setIssueForm({ ...issueForm, borrowerType: e.target.value as "STUDENT" | "STAFF" })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="STUDENT">Student</option>
                  <option value="STAFF">Staff</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Due Date *</label>
                <input
                  type="date"
                  value={issueForm.dueDate}
                  onChange={(e) => setIssueForm({ ...issueForm, dueDate: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowIssueForm(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleIssueBook}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Issuing..." : "Issue Book"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
