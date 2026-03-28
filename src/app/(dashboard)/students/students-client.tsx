"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStudentsAction } from "@/modules/student/actions/student.action";

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

  const totalPages = Math.ceil(total / pageSize);

  function fetchStudents(newPage: number) {
    startTransition(async () => {
      const result = await getStudentsAction({
        search: search || undefined,
        classArmId: filterClassArm || undefined,
        programmeId: filterProgramme || undefined,
        status: filterStatus || undefined,
        gender: filterGender || undefined,
        boardingStatus: filterBoarding || undefined,
        page: newPage,
        pageSize,
      });
      if (result.students) {
        setStudents(result.students);
        setTotal(result.total ?? 0);
        setPage(result.page ?? 1);
      }
    });
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
    startTransition(async () => {
      const result = await getStudentsAction({ page: 1, pageSize });
      if (result.students) {
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

  return (
    <>
      {/* Toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              placeholder="Search by name or student ID..."
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
            href="/students/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 text-center"
          >
            Add Student
          </Link>
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterClassArm}
            onChange={(e) => {
              setFilterClassArm(e.target.value);
            }}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
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
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
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
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
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
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
          >
            <option value="">All Genders</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>

          <select
            value={filterBoarding}
            onChange={(e) => setFilterBoarding(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
          >
            <option value="">All Boarding</option>
            <option value="DAY">Day</option>
            <option value="BOARDING">Boarding</option>
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
          Showing {students.length} of {total} students
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Student ID</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-center font-medium">Gender</th>
                <th className="px-4 py-3 text-left font-medium">Class</th>
                <th className="px-4 py-3 text-left font-medium">Programme</th>
                <th className="px-4 py-3 text-center font-medium">Boarding</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No students found. Try adjusting your search or filters.
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => router.push(`/students/${s.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{s.studentId}</td>
                    <td className="px-4 py-3 font-medium">
                      {s.firstName} {s.otherNames ? `${s.otherNames} ` : ""}{s.lastName}
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
                            ? "bg-purple-100 text-purple-700"
                            : "bg-sky-100 text-sky-700"
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/students/${s.id}`}
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
            onClick={() => fetchStudents(page - 1)}
            disabled={page <= 1 || isPending}
            className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => {
              // Show first, last, and pages near current
              return p === 1 || p === totalPages || Math.abs(p - page) <= 2;
            })
            .map((p, idx, arr) => (
              <span key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && (
                  <span className="px-1 text-muted-foreground">...</span>
                )}
                <button
                  onClick={() => fetchStudents(p)}
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
            onClick={() => fetchStudents(page + 1)}
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
