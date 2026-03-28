"use client";

import { useState, useTransition } from "react";
import { getAlumniAction } from "@/modules/graduation/actions/graduation.action";

// ─── Types ──────────────────────────────────────────────────────────

interface AlumniRow {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  gender: string;
  enrollmentDate: Date | string;
  certificateNumber: string | null;
  honours: string | null;
  batchName: string | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatDate(dateStr: Date | string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Component ──────────────────────────────────────────────────────

export function AlumniClient({
  alumni: initialAlumni,
  pagination: initialPagination,
}: {
  alumni: AlumniRow[];
  pagination: Pagination;
}) {
  const [isPending, startTransition] = useTransition();
  const [alumni, setAlumni] = useState<AlumniRow[]>(initialAlumni);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [searchTerm, setSearchTerm] = useState("");

  function handleSearch() {
    startTransition(async () => {
      const result = await getAlumniAction(searchTerm || undefined, 1, 20);
      if (result.data) {
        setAlumni(result.data as AlumniRow[]);
        setPagination(result.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 0 });
      }
    });
  }

  function handlePageChange(newPage: number) {
    startTransition(async () => {
      const result = await getAlumniAction(searchTerm || undefined, newPage, 20);
      if (result.data) {
        setAlumni(result.data as AlumniRow[]);
        setPagination(
          result.pagination ?? { page: newPage, pageSize: 20, total: 0, totalPages: 0 },
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search alumni by name or student ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="w-80 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={handleSearch}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Student ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Gender
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Batch
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Certificate #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Honours
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Enrolled
              </th>
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {alumni.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{a.studentId}</td>
                <td className="px-4 py-3 text-sm font-medium">
                  {a.firstName} {a.lastName}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{a.gender}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{a.batchName ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {a.certificateNumber ?? "-"}
                </td>
                <td className="px-4 py-3 text-sm">
                  {a.honours ? (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                      {a.honours}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDate(a.enrollmentDate)}
                </td>
              </tr>
            ))}
            {alumni.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No alumni found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || isPending}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isPending}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
