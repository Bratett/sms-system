"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  approveSubstitutionAction,
  rejectSubstitutionAction,
} from "@/modules/timetable/actions/substitution.action";

interface SubstitutionRow {
  id: string;
  date: Date;
  status: string;
  reason: string | null;
  originalTeacher: string;
  substituteTeacher: string;
  subject: string;
  className: string;
  period: string;
  createdAt: Date;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  COMPLETED: "bg-blue-100 text-blue-700",
};

export function SubstitutionsClient({
  substitutions,
  pagination,
  filters,
}: {
  substitutions: SubstitutionRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  filters: { date?: string; status?: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveSubstitutionAction(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Substitution approved.");
        router.refresh();
      }
    });
  }

  function handleReject(id: string) {
    if (!confirm("Reject this substitution?")) return;
    startTransition(async () => {
      const result = await rejectSubstitutionAction(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Substitution rejected.");
        router.refresh();
      }
    });
  }

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams();
    if (key === "status" && value) params.set("status", value);
    else if (filters.status) params.set("status", filters.status);
    if (key === "date" && value) params.set("date", value);
    else if (filters.date) params.set("date", filters.date);
    router.push(`/timetable/substitutions?${params.toString()}`);
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Date</label>
          <input
            type="date"
            value={filters.date ?? ""}
            onChange={(e) => applyFilter("date", e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
          <select
            value={filters.status ?? ""}
            onChange={(e) => applyFilter("status", e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
        <p className="ml-auto text-sm text-muted-foreground">{pagination.total} substitution(s)</p>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Class</th>
              <th className="px-4 py-3 text-left font-medium">Subject</th>
              <th className="px-4 py-3 text-left font-medium">Period</th>
              <th className="px-4 py-3 text-left font-medium">Original Teacher</th>
              <th className="px-4 py-3 text-left font-medium">Substitute</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {substitutions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No substitutions found.
                </td>
              </tr>
            ) : (
              substitutions.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {format(new Date(s.date), "dd MMM yyyy")}
                  </td>
                  <td className="px-4 py-3">{s.className}</td>
                  <td className="px-4 py-3 font-medium">{s.subject}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.period}</td>
                  <td className="px-4 py-3">{s.originalTeacher}</td>
                  <td className="px-4 py-3 font-medium">{s.substituteTeacher}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status] ?? ""}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.status === "PENDING" && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleApprove(s.id)}
                          disabled={isPending}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(s.id)}
                          disabled={isPending}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {s.reason && (
                      <div className="mt-1 text-xs text-muted-foreground">{s.reason}</div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
