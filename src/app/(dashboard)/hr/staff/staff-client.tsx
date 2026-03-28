"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStaffAction } from "@/modules/hr/actions/staff.action";

// ─── Types ──────────────────────────────────────────────────────────

interface StaffRow {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  gender: string;
  phone: string;
  email: string | null;
  staffType: string;
  status: string;
  position: string | null;
  departmentName: string | null;
  createdAt: Date;
}

interface DepartmentOption {
  id: string;
  name: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function StaffClient({
  initialStaff,
  initialTotal,
  initialPage,
  initialPageSize,
  departments,
}: {
  initialStaff: StaffRow[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  departments: DepartmentOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [staff, setStaff] = useState<StaffRow[]>(initialStaff);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(initialPageSize);

  // Filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");

  const totalPages = Math.ceil(total / pageSize);

  function fetchStaff(newPage: number) {
    startTransition(async () => {
      const result = await getStaffAction({
        search: search || undefined,
        staffType: filterType || undefined,
        status: filterStatus || undefined,
        departmentId: filterDepartment || undefined,
        page: newPage,
        pageSize,
      });
      if (result.staff) {
        setStaff(result.staff);
        setTotal(result.total ?? 0);
        setPage(result.page ?? 1);
      }
    });
  }

  function handleSearch() {
    fetchStaff(1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleSearch();
    }
  }

  function handleResetFilters() {
    setSearch("");
    setFilterType("");
    setFilterStatus("");
    setFilterDepartment("");
    startTransition(async () => {
      const result = await getStaffAction({ page: 1, pageSize });
      if (result.staff) {
        setStaff(result.staff);
        setTotal(result.total ?? 0);
        setPage(1);
      }
    });
  }

  return (
    <>
      {/* Toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              placeholder="Search by name, staff ID, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={handleSearch}
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Search
            </button>
          </div>
          <Link
            href="/hr/staff/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 text-center"
          >
            Add Staff
          </Link>
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
          >
            <option value="">All Types</option>
            <option value="TEACHING">Teaching</option>
            <option value="NON_TEACHING">Non-Teaching</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="TERMINATED">Terminated</option>
            <option value="RETIRED">Retired</option>
            <option value="TRANSFERRED">Transferred</option>
          </select>

          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleSearch}
            disabled={isPending}
            className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            Apply Filters
          </button>
          <button
            onClick={handleResetFilters}
            className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Results Info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {staff.length} of {total} staff members
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Staff ID</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-center font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Position</th>
                <th className="px-4 py-3 text-left font-medium">Department</th>
                <th className="px-4 py-3 text-left font-medium">Phone</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No staff members found. Try adjusting your search or filters.
                  </td>
                </tr>
              ) : (
                staff.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => router.push(`/hr/staff/${s.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{s.staffId}</td>
                    <td className="px-4 py-3 font-medium">
                      {s.firstName} {s.otherNames ? `${s.otherNames} ` : ""}
                      {s.lastName}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge
                        status={s.staffType}
                        className={
                          s.staffType === "TEACHING"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.position || "---"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.departmentName || "---"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.phone}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/hr/staff/${s.id}`}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => fetchStaff(page - 1)}
            disabled={page <= 1 || isPending}
            className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .map((p, idx, arr) => (
              <span key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && (
                  <span className="px-1 text-muted-foreground">...</span>
                )}
                <button
                  onClick={() => fetchStaff(p)}
                  disabled={isPending}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    p === page
                      ? "bg-primary text-primary-foreground"
                      : "border border-input hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              </span>
            ))}
          <button
            onClick={() => fetchStaff(page + 1)}
            disabled={page >= totalPages || isPending}
            className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
