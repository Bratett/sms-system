"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStaffAction } from "@/modules/hr/actions/staff.action";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Filter,
} from "lucide-react";

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
      if ("staff" in result) {
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
      if ("staff" in result) {
        setStaff(result.staff);
        setTotal(result.total ?? 0);
        setPage(1);
      }
    });
  }

  const hasActiveFilters = search || filterType || filterStatus || filterDepartment;
  const filterSelectClass =
    "h-8 rounded-lg border border-input bg-background px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <>
      {/* Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, staff ID, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSearch}
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            Search
          </button>
          <Link
            href="/hr/staff/new"
            className="rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Add Staff
          </Link>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className={filterSelectClass}
        >
          <option value="">All Types</option>
          <option value="TEACHING">Teaching</option>
          <option value="NON_TEACHING">Non-Teaching</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={filterSelectClass}
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
          className={filterSelectClass}
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
          className="h-8 rounded-lg bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
        >
          Apply
        </button>
        {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="flex h-8 items-center gap-1 rounded-lg border border-input px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {/* Results Info */}
      <div className="text-sm text-muted-foreground">
        Showing {staff.length} of {total} staff members
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Staff ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Position
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Department
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Phone
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="sr-only">Actions</span>
                </th>
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
                    <td className="px-4 py-3 text-muted-foreground">{s.position || "---"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.departmentName || "---"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.phone}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/hr/staff/${s.id}`}
                        className="text-xs font-medium text-primary hover:text-primary/80"
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
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="text-xs">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchStaff(1)}
              disabled={page <= 1 || isPending}
              className="rounded-md p-1.5 transition-colors hover:bg-accent disabled:opacity-30"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => fetchStaff(page - 1)}
              disabled={page <= 1 || isPending}
              className="rounded-md p-1.5 transition-colors hover:bg-accent disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p, idx, arr) => (
                <span key={p} className="flex items-center">
                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                    <span className="px-1 text-muted-foreground/50">...</span>
                  )}
                  <button
                    onClick={() => fetchStaff(p)}
                    disabled={isPending}
                    className={`min-w-[32px] rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      p === page ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    }`}
                  >
                    {p}
                  </button>
                </span>
              ))}
            <button
              onClick={() => fetchStaff(page + 1)}
              disabled={page >= totalPages || isPending}
              className="rounded-md p-1.5 transition-colors hover:bg-accent disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => fetchStaff(totalPages)}
              disabled={page >= totalPages || isPending}
              className="rounded-md p-1.5 transition-colors hover:bg-accent disabled:opacity-30"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
