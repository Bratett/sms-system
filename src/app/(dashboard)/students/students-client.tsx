"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStudentsAction } from "@/modules/student/actions/student.action";
import {
  listStudentsWithMissingDocsAction,
  listStudentsWithExpiringDocsAction,
} from "@/modules/student/actions/document.action";
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

interface StudentRow {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  gender: string;
  dateOfBirth: Date;
  boardingStatus: string;
  status: string;
  photoUrl: string | null;
  className: string | null;
  classArmName: string | null;
  programmeName: string | null;
  createdAt: Date;
}

interface ClassArmOption {
  id: string;
  label: string;
  className: string;
}

interface ProgrammeOption {
  id: string;
  name: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function StudentsClient({
  initialStudents,
  initialTotal,
  initialPage,
  initialPageSize,
  classArmOptions,
  programmes,
}: {
  initialStudents: StudentRow[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  classArmOptions: ClassArmOption[];
  programmes: ProgrammeOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [students, setStudents] = useState<StudentRow[]>(initialStudents);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(initialPageSize);

  // Filters
  const [search, setSearch] = useState("");
  const [filterClassArm, setFilterClassArm] = useState("");
  const [filterProgramme, setFilterProgramme] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterBoarding, setFilterBoarding] = useState("");

  // Document-cohort chip filter (mutually exclusive)
  type DocChip = "missing" | "expiring" | null;
  const [docChip, setDocChip] = useState<DocChip>(null);
  const [missingCount, setMissingCount] = useState<number | null>(null);
  const [expiringCount, setExpiringCount] = useState<number | null>(null);

  // Cached cohort IDs — populated when a chip toggles ON, reused across
  // pagination / filter changes to avoid refetching the (expensive) cohort
  // on every click. Cleared when the chip toggles OFF.
  const [missingDocIds, setMissingDocIds] = useState<string[] | null>(null);
  const [expiringDocIds, setExpiringDocIds] = useState<string[] | null>(null);

  // Load chip counts on mount
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [missing, expiring] = await Promise.all([
        listStudentsWithMissingDocsAction(),
        listStudentsWithExpiringDocsAction(),
      ]);
      if (cancelled) return;
      if ("data" in missing) setMissingCount(missing.data.length);
      if ("data" in expiring) setExpiringCount(expiring.data.length);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPages = Math.ceil(total / pageSize);
  const hasActiveFilters =
    search ||
    filterClassArm ||
    filterProgramme ||
    filterStatus ||
    filterGender ||
    filterBoarding ||
    docChip;

  function fetchStudents(
    newPage: number,
    overrideChip?: DocChip,
    overrideIds?: { missing?: string[] | null; expiring?: string[] | null },
  ) {
    const activeChip = overrideChip !== undefined ? overrideChip : docChip;
    const effectiveMissing =
      overrideIds?.missing !== undefined ? overrideIds.missing : missingDocIds;
    const effectiveExpiring =
      overrideIds?.expiring !== undefined ? overrideIds.expiring : expiringDocIds;
    startTransition(async () => {
      let idsFilter: string[] | undefined;
      if (activeChip === "missing") {
        idsFilter = effectiveMissing ?? [];
      } else if (activeChip === "expiring") {
        idsFilter = effectiveExpiring ?? [];
      }

      const result = await getStudentsAction({
        search: search || undefined,
        classArmId: filterClassArm || undefined,
        programmeId: filterProgramme || undefined,
        status: filterStatus || undefined,
        gender: filterGender || undefined,
        boardingStatus: filterBoarding || undefined,
        ids: idsFilter,
        page: newPage,
        pageSize,
      });
      if ("students" in result) {
        setStudents(result.students);
        setTotal(result.total ?? 0);
        setPage(result.page ?? 1);
      }
    });
  }

  async function toggleChip(chip: Exclude<DocChip, null>) {
    const next: DocChip = docChip === chip ? null : chip;
    setDocChip(next);

    if (next === null) {
      // Toggling OFF — clear caches and refetch without cohort filter.
      setMissingDocIds(null);
      setExpiringDocIds(null);
      fetchStudents(1, next, { missing: null, expiring: null });
      return;
    }

    // Toggling ON — fetch cohort IDs once, cache them, then fetch students.
    if (next === "missing") {
      if (missingDocIds !== null) {
        fetchStudents(1, next);
        return;
      }
      const res = await listStudentsWithMissingDocsAction();
      const ids = "data" in res ? res.data.map((s) => s.id) : [];
      setMissingDocIds(ids);
      setMissingCount(ids.length);
      fetchStudents(1, next, { missing: ids });
    } else {
      if (expiringDocIds !== null) {
        fetchStudents(1, next);
        return;
      }
      const res = await listStudentsWithExpiringDocsAction();
      const ids = "data" in res ? res.data.map((s) => s.id) : [];
      setExpiringDocIds(ids);
      setExpiringCount(ids.length);
      fetchStudents(1, next, { expiring: ids });
    }
  }

  function handleSearch() {
    fetchStudents(1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleSearch();
    }
  }

  function handleResetFilters() {
    setSearch("");
    setFilterClassArm("");
    setFilterProgramme("");
    setFilterStatus("");
    setFilterGender("");
    setFilterBoarding("");
    setDocChip(null);
    setMissingDocIds(null);
    setExpiringDocIds(null);
    startTransition(async () => {
      const result = await getStudentsAction({ page: 1, pageSize });
      if ("students" in result) {
        setStudents(result.students);
        setTotal(result.total ?? 0);
        setPage(1);
      }
    });
  }

  // Group class arm options by class name
  const classGroups = classArmOptions.reduce(
    (acc, arm) => {
      if (!acc[arm.className]) acc[arm.className] = [];
      acc[arm.className].push(arm);
      return acc;
    },
    {} as Record<string, ClassArmOption[]>,
  );

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
            placeholder="Search by name or student ID..."
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
            href="/students/new"
            className="rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Add Student
          </Link>
          <Link
            href="/students/promotion"
            className="rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Promotion
          </Link>
          <Link
            href="/students/analytics"
            className="rounded-lg border border-border bg-background px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-muted"
          >
            Analytics
          </Link>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          value={filterClassArm}
          onChange={(e) => setFilterClassArm(e.target.value)}
          className={filterSelectClass}
        >
          <option value="">All Classes</option>
          {Object.entries(classGroups).map(([className, arms]) => (
            <optgroup key={className} label={className}>
              {arms.map((arm) => (
                <option key={arm.id} value={arm.id}>
                  {arm.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <select
          value={filterProgramme}
          onChange={(e) => setFilterProgramme(e.target.value)}
          className={filterSelectClass}
        >
          <option value="">All Programmes</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={filterSelectClass}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="WITHDRAWN">Withdrawn</option>
          <option value="TRANSFERRED">Transferred</option>
          <option value="COMPLETED">Completed</option>
          <option value="GRADUATED">Graduated</option>
        </select>

        <select
          value={filterGender}
          onChange={(e) => setFilterGender(e.target.value)}
          className={filterSelectClass}
        >
          <option value="">All Genders</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
        </select>

        <select
          value={filterBoarding}
          onChange={(e) => setFilterBoarding(e.target.value)}
          className={filterSelectClass}
        >
          <option value="">Day / Boarding</option>
          <option value="DAY">Day</option>
          <option value="BOARDING">Boarding</option>
        </select>

        <button
          onClick={handleSearch}
          disabled={isPending}
          className="h-8 rounded-lg bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
        >
          Apply
        </button>

        {/* Document cohort chips */}
        <button
          type="button"
          onClick={() => toggleChip("missing")}
          disabled={isPending}
          aria-pressed={docChip === "missing"}
          title={
            docChip === "missing" && missingCount !== null && total !== missingCount
              ? `${total} of ${missingCount} cohort students match the current filters`
              : undefined
          }
          className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
            docChip === "missing"
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-background hover:bg-muted"
          }`}
        >
          Missing required docs
          {missingCount !== null && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                docChip === "missing"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {docChip === "missing" && total !== missingCount
                ? `${total} of ${missingCount}`
                : missingCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => toggleChip("expiring")}
          disabled={isPending}
          aria-pressed={docChip === "expiring"}
          title={
            docChip === "expiring" && expiringCount !== null && total !== expiringCount
              ? `${total} of ${expiringCount} cohort students match the current filters`
              : undefined
          }
          className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
            docChip === "expiring"
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-background hover:bg-muted"
          }`}
        >
          Docs expiring in 30 days
          {expiringCount !== null && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                docChip === "expiring"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {docChip === "expiring" && total !== expiringCount
                ? `${total} of ${expiringCount}`
                : expiringCount}
            </span>
          )}
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
        Showing {students.length} of {total} students
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Student ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Gender
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Class
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Programme
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Boarding
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
              {students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No students found. Try adjusting your search or filters.
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                    onClick={() => router.push(`/students/${s.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {s.studentId}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {s.firstName} {s.otherNames ? `${s.otherNames} ` : ""}
                      {s.lastName}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {s.gender === "MALE" ? "M" : "F"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.classArmName || "---"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.programmeName || "---"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge
                        status={s.boardingStatus}
                        className={
                          s.boardingStatus === "BOARDING"
                            ? "bg-purple-50 text-purple-700"
                            : "bg-sky-50 text-sky-700"
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/students/${s.id}`}
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
              onClick={() => fetchStudents(1)}
              disabled={page <= 1 || isPending}
              className="rounded-md p-1.5 transition-colors hover:bg-accent disabled:opacity-30"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => fetchStudents(page - 1)}
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
                    onClick={() => fetchStudents(p)}
                    disabled={isPending}
                    className={`min-w-[32px] rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      p === page
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    {p}
                  </button>
                </span>
              ))}

            <button
              onClick={() => fetchStudents(page + 1)}
              disabled={page >= totalPages || isPending}
              className="rounded-md p-1.5 transition-colors hover:bg-accent disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => fetchStudents(totalPages)}
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
