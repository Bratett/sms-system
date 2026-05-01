# Student Profile History Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "History" tab to the student profile page that surfaces audit-log rows scoped to one student (the Student record + related entities: medical records, documents, enrollments, guardian links, house assignments) as a paginated, action-filterable, click-to-expand-for-diff table.

**Architecture:** One new server action `getStudentHistoryAction` in the student module; one client component `history-tab.tsx` mounted from the existing tabbed profile; one prop `canViewHistory` threaded from the server page through `StudentProfile` to gate the tab trigger. Reuses `AUDIT_LOG_READ` permission, `auditLog` table, and the visual conventions of `/admin/audit-log` — no new schema, no new permission keys.

**Tech Stack:** Next.js 15 App Router, Prisma 6.x on PostgreSQL, vitest + vitest-mock-extended, React Server + Client components.

**Spec reference:** [`docs/superpowers/specs/2026-05-01-student-history-tab-design.md`](../specs/2026-05-01-student-history-tab-design.md)

**Branch base:** `feat/student-history-tab` (off `main`).

---

## File Structure

**Created:**
- `src/modules/student/actions/history.action.ts` — `getStudentHistoryAction(input)` server action
- `src/app/(dashboard)/students/[id]/history-tab.tsx` — client component with table, action filter, pagination, expand-for-diff
- `tests/unit/student/history.test.ts` — 7 unit tests (permission, school scoping, related-entity rollup, action filter, pagination, empty result, student-not-found)

**Modified:**
- `src/app/(dashboard)/students/[id]/page.tsx` — compute `canViewHistory` from session and pass it through to `StudentProfile`
- `src/app/(dashboard)/students/[id]/student-profile.tsx` — accept new `canViewHistory` prop, conditionally append a 9th (or 10th when boarding) tab labeled "History", render `<HistoryTab studentId={...} />` for that tab index

---

## Task 0: Branch + baseline

**Files:** none (git only)

- [ ] **Step 1: Confirm worktree state**

```bash
cd ../sms-system-history-tab && git status --short
```

Expected: working tree clean.

- [ ] **Step 2: Confirm baseline tests pass**

```bash
cd ../sms-system-history-tab && npm test -- tests/unit/student/medical.test.ts
```

Expected: all existing student tests pass. (Pick `medical.test.ts` as a representative; if anything fails on baseline, stop and surface to the user.)

- [ ] **Step 3: Verify the spec is on disk**

```bash
ls docs/superpowers/specs/2026-05-01-student-history-tab-design.md
```

Expected: file exists.

---

## Task 1: `getStudentHistoryAction` — TDD

The action queries `auditLog` for rows belonging to a single student. It pre-fetches the student's related-entity ID lists (medical records, documents, enrollments, guardian links, house assignments) so that audit rows for those entities (which carry the related record's id, not the studentId) are also included.

**Files:**
- Create: `src/modules/student/actions/history.action.ts`
- Create: `tests/unit/student/history.test.ts`

### Step 1: Write the failing test file (skeleton + 1 test)

`tests/unit/student/history.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { getStudentHistoryAction } from "@/modules/student/actions/history.action";

describe("getStudentHistoryAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("rejects unauthenticated callers", async () => {
    mockUnauthenticated();
    const result = await getStudentHistoryAction({ studentId: "s1" });
    expect(result).toEqual({ error: "Unauthorized" });
  });
});
```

### Step 2: Run, confirm fail

```bash
npm test -- tests/unit/student/history.test.ts
```

Expected: fail with "Cannot find module '@/modules/student/actions/history.action'".

### Step 3: Implement the action's auth + permission scaffold

`src/modules/student/actions/history.action.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { PAGINATION_DEFAULT } from "@/lib/constants";
import type { AuditAction, Prisma } from "@prisma/client";

export interface StudentHistoryFilters {
  studentId: string;
  action?: AuditAction;
  page?: number;
  pageSize?: number;
}

export interface StudentHistoryRow {
  id: string;
  timestamp: Date;
  action: string;
  entity: string;
  entityId: string | null;
  module: string;
  description: string;
  userName: string | null;
  userUsername: string | null;
  previousData: unknown;
  newData: unknown;
}

export async function getStudentHistoryAction(filters: StudentHistoryFilters) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.AUDIT_LOG_READ);
  if (denied) return denied;

  // Verify the student belongs to the caller's school
  const student = await db.student.findFirst({
    where: { id: filters.studentId, schoolId: ctx.schoolId },
    select: { id: true },
  });
  if (!student) return { error: "Student not found" };

  // Fetch related-entity ID lists (school-scoped) in parallel
  const [medicalIds, documentIds, enrollmentIds, guardianLinkIds, houseAssignmentIds] = await Promise.all([
    db.medicalRecord.findMany({ where: { studentId: filters.studentId, schoolId: ctx.schoolId }, select: { id: true } }),
    db.studentDocument.findMany({ where: { studentId: filters.studentId, schoolId: ctx.schoolId }, select: { id: true } }),
    db.enrollment.findMany({ where: { studentId: filters.studentId, schoolId: ctx.schoolId }, select: { id: true } }),
    db.studentGuardian.findMany({ where: { studentId: filters.studentId, schoolId: ctx.schoolId }, select: { id: true } }),
    db.studentHouse.findMany({ where: { studentId: filters.studentId, schoolId: ctx.schoolId }, select: { id: true } }),
  ]);

  const relatedIds = [
    ...medicalIds.map((r) => r.id),
    ...documentIds.map((r) => r.id),
    ...enrollmentIds.map((r) => r.id),
    ...guardianLinkIds.map((r) => r.id),
    ...houseAssignmentIds.map((r) => r.id),
  ];

  const orClauses: Prisma.AuditLogWhereInput[] = [
    { entity: "Student", entityId: filters.studentId },
  ];
  if (relatedIds.length > 0) {
    orClauses.push({ entityId: { in: relatedIds } });
  }

  const where: Prisma.AuditLogWhereInput = {
    schoolId: ctx.schoolId,
    OR: orClauses,
    ...(filters.action ? { action: filters.action } : {}),
  };

  const page = filters.page ?? PAGINATION_DEFAULT.page;
  const pageSize = Math.min(
    filters.pageSize ?? PAGINATION_DEFAULT.pageSize,
    PAGINATION_DEFAULT.maxPageSize,
  );
  const skip = (page - 1) * pageSize;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
      orderBy: { timestamp: "desc" },
      skip,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
  ]);

  const data: StudentHistoryRow[] = logs.map((log) => ({
    id: log.id,
    timestamp: log.timestamp,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    module: log.module,
    description: log.description,
    userName: log.user ? `${log.user.firstName} ${log.user.lastName}` : null,
    userUsername: log.user?.username ?? null,
    previousData: log.previousData,
    newData: log.newData,
  }));

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
```

### Step 4: Run, confirm test passes

```bash
npm test -- tests/unit/student/history.test.ts
```

Expected: pass.

### Step 5: Add the remaining 6 tests

Append to `tests/unit/student/history.test.ts` (inside the same `describe` block):

```typescript
  it("rejects callers without AUDIT_LOG_READ", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getStudentHistoryAction({ studentId: "s1" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error.toLowerCase()).toContain("permission");
  });

  it("returns 'Student not found' when caller cannot see the student (cross-school)", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null as never);
    const result = await getStudentHistoryAction({ studentId: "from-other-school" });
    expect(result).toEqual({ error: "Student not found" });
  });

  it("returns rows for the Student entity directly", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" } as never);
    prismaMock.medicalRecord.findMany.mockResolvedValue([] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);
    prismaMock.studentGuardian.findMany.mockResolvedValue([] as never);
    prismaMock.studentHouse.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.findMany.mockResolvedValue([
      {
        id: "log1", timestamp: new Date("2026-04-01"), action: "UPDATE",
        entity: "Student", entityId: "s1", module: "student",
        description: "Updated student name",
        previousData: { firstName: "Old" }, newData: { firstName: "New" },
        user: { id: "u1", firstName: "Admin", lastName: "Person", username: "admin" },
      },
    ] as never);
    prismaMock.auditLog.count.mockResolvedValue(1 as never);

    const result = await getStudentHistoryAction({ studentId: "s1" });
    expect(result).toHaveProperty("data");
    const data = result as { data: Array<{ entity: string; entityId: string | null; userName: string | null }>; pagination: { total: number } };
    expect(data.data.length).toBe(1);
    expect(data.data[0].entity).toBe("Student");
    expect(data.data[0].userName).toBe("Admin Person");
    expect(data.pagination.total).toBe(1);
  });

  it("includes related-entity audit rows via cross-reference IDs", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" } as never);
    prismaMock.medicalRecord.findMany.mockResolvedValue([{ id: "m1" }, { id: "m2" }] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([{ id: "d1" }] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);
    prismaMock.studentGuardian.findMany.mockResolvedValue([] as never);
    prismaMock.studentHouse.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.count.mockResolvedValue(0 as never);

    await getStudentHistoryAction({ studentId: "s1" });

    const findManyCall = prismaMock.auditLog.findMany.mock.calls.at(-1);
    expect(findManyCall?.[0]?.where).toMatchObject({
      schoolId: "default-school",
      OR: [
        { entity: "Student", entityId: "s1" },
        { entityId: { in: ["m1", "m2", "d1"] } },
      ],
    });
  });

  it("applies action filter when provided", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" } as never);
    prismaMock.medicalRecord.findMany.mockResolvedValue([] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);
    prismaMock.studentGuardian.findMany.mockResolvedValue([] as never);
    prismaMock.studentHouse.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.count.mockResolvedValue(0 as never);

    await getStudentHistoryAction({ studentId: "s1", action: "DELETE" });

    const findManyCall = prismaMock.auditLog.findMany.mock.calls.at(-1);
    expect(findManyCall?.[0]?.where).toMatchObject({ action: "DELETE" });
  });

  it("paginates: page 2 with pageSize 10 sets skip=10, take=10", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" } as never);
    prismaMock.medicalRecord.findMany.mockResolvedValue([] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);
    prismaMock.studentGuardian.findMany.mockResolvedValue([] as never);
    prismaMock.studentHouse.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.count.mockResolvedValue(45 as never);

    const result = await getStudentHistoryAction({ studentId: "s1", page: 2, pageSize: 10 });

    const findManyCall = prismaMock.auditLog.findMany.mock.calls.at(-1);
    expect(findManyCall?.[0]?.skip).toBe(10);
    expect(findManyCall?.[0]?.take).toBe(10);
    const data = result as { pagination: { page: number; pageSize: number; total: number; totalPages: number } };
    expect(data.pagination.totalPages).toBe(5); // ceil(45/10) = 5
  });

  it("returns empty data with zero pagination when student has no history", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" } as never);
    prismaMock.medicalRecord.findMany.mockResolvedValue([] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);
    prismaMock.studentGuardian.findMany.mockResolvedValue([] as never);
    prismaMock.studentHouse.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.count.mockResolvedValue(0 as never);

    const result = await getStudentHistoryAction({ studentId: "s1" });
    expect(result).toHaveProperty("data");
    const data = result as { data: unknown[]; pagination: { total: number; totalPages: number } };
    expect(data.data).toEqual([]);
    expect(data.pagination.total).toBe(0);
    expect(data.pagination.totalPages).toBe(0);
  });
```

### Step 6: Run all tests

```bash
npm test -- tests/unit/student/history.test.ts
```

Expected: 7 tests pass.

### Step 7: Run the full student folder to confirm no regressions

```bash
npm test -- tests/unit/student/
```

Expected: all student tests pass (existing + new 7).

### Step 8: Commit

```bash
git add src/modules/student/actions/history.action.ts tests/unit/student/history.test.ts
git commit -m "feat(students): add getStudentHistoryAction with related-entity rollup"
```

---

## Task 2: History tab client component

The client renders the action filter, paginated table, and click-to-expand diff drawer. It manages its own state (page, action filter, expanded row id, fetched data) and calls `getStudentHistoryAction` on mount and on filter/page change.

**Files:**
- Create: `src/app/(dashboard)/students/[id]/history-tab.tsx`

### Step 1: Create the component

`src/app/(dashboard)/students/[id]/history-tab.tsx`:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getStudentHistoryAction,
  type StudentHistoryRow,
} from "@/modules/student/actions/history.action";

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "CREATE", label: "Created" },
  { value: "UPDATE", label: "Updated" },
  { value: "DELETE", label: "Deleted" },
  { value: "APPROVE", label: "Approved" },
  { value: "REJECT", label: "Rejected" },
  { value: "EXPORT", label: "Exported" },
] as const;

const ACTION_STYLES: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  APPROVE: "bg-emerald-100 text-emerald-800",
  REJECT: "bg-orange-100 text-orange-800",
  EXPORT: "bg-cyan-100 text-cyan-800",
  LOGIN: "bg-purple-100 text-purple-800",
  LOGOUT: "bg-gray-100 text-gray-800",
  IMPORT: "bg-teal-100 text-teal-800",
  READ: "bg-slate-100 text-slate-800",
  PUBLISH: "bg-indigo-100 text-indigo-800",
};

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function HistoryTab({ studentId }: { studentId: string }) {
  const [rows, setRows] = useState<StudentHistoryRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });
  const [actionFilter, setActionFilter] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getStudentHistoryAction({
        studentId,
        action: actionFilter ? (actionFilter as Parameters<typeof getStudentHistoryAction>[0]["action"]) : undefined,
        page,
        pageSize: 25,
      });
      if ("error" in result) {
        setError(result.error);
        setRows([]);
        setPagination({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
        return;
      }
      setError(null);
      setRows(result.data);
      setPagination(result.pagination);
    });
  }, [studentId, actionFilter, page]);

  const isFiltered = actionFilter !== "";
  const empty = rows.length === 0;

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-end gap-3">
        <label className="text-sm">
          <div className="mb-1 font-medium">Action</div>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
              setExpandedId(null);
            }}
            className="rounded-md border px-3 py-2 text-sm"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        {isPending && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Entity</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">By</th>
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {isFiltered
                    ? `No history matches the ${actionFilter.toLowerCase()} filter.`
                    : "No history yet for this student."}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isExpanded = expandedId === row.id;
                const actionStyle = ACTION_STYLES[row.action] ?? "bg-slate-100 text-slate-800";
                return (
                  <FragmentRow
                    key={row.id}
                    row={row}
                    isExpanded={isExpanded}
                    actionStyle={actionStyle}
                    onToggle={() => setExpandedId(isExpanded ? null : row.id)}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!empty && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.pageSize + 1}
            –{Math.min(pagination.page * pagination.pageSize, pagination.total)}
            {" of "}
            {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1 || isPending}
              className="rounded-md border px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages || isPending}
              className="rounded-md border px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FragmentRow({
  row,
  isExpanded,
  actionStyle,
  onToggle,
}: {
  row: StudentHistoryRow;
  isExpanded: boolean;
  actionStyle: string;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="cursor-pointer border-t border-border hover:bg-muted/30" onClick={onToggle}>
        <td className="px-3 py-2 whitespace-nowrap">
          {new Date(row.timestamp).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </td>
        <td className="px-3 py-2">
          <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${actionStyle}`}>
            {row.action}
          </span>
        </td>
        <td className="px-3 py-2 font-mono text-xs">{row.entity}</td>
        <td className="px-3 py-2">{row.description}</td>
        <td className="px-3 py-2">
          {row.userName ?? row.userUsername ?? "System"}
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-t border-border bg-muted/20">
          <td colSpan={5} className="px-3 py-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Previous</p>
                <pre className="overflow-auto rounded bg-card p-2 text-xs">
                  {row.previousData ? JSON.stringify(row.previousData, null, 2) : "—"}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">New</p>
                <pre className="overflow-auto rounded bg-card p-2 text-xs">
                  {row.newData ? JSON.stringify(row.newData, null, 2) : "—"}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
```

### Step 2: TypeScript check

```bash
npx tsc --noEmit 2>&1 | grep -E "history-tab\.tsx" | head -10
```

Expected: no errors.

### Step 3: Commit

```bash
git add 'src/app/(dashboard)/students/[id]/history-tab.tsx'
git commit -m "feat(students): add HistoryTab client component"
```

---

## Task 3: Wire the History tab into the student profile

The server page computes `canViewHistory` from session permissions. The profile component appends a "History" tab when `canViewHistory` is true and renders `<HistoryTab studentId={...} />` for that index.

**Files:**
- Modify: `src/app/(dashboard)/students/[id]/page.tsx`
- Modify: `src/app/(dashboard)/students/[id]/student-profile.tsx`

### Step 1: Update the server page to thread `canViewHistory` through

Open `src/app/(dashboard)/students/[id]/page.tsx`. Find the `<StudentProfile ...>` JSX and update it. Also import `PERMISSIONS`:

```typescript
// Add to the imports at the top:
import { PERMISSIONS } from "@/lib/permissions";
```

Inside the `StudentProfilePage` function, after `const session = await auth();` block (around line 18), compute the flag:

```typescript
  const perms = session.user.permissions ?? [];
  const canViewHistory = perms.includes("*") || perms.includes(PERMISSIONS.AUDIT_LOG_READ);
```

Then update the `<StudentProfile ...>` JSX (around line 76) to pass it:

```tsx
      <StudentProfile
        student={student}
        allGuardians={allGuardians}
        classArmOptions={classArmOptions}
        academicYears={academicYears}
        terms={terms}
        canViewHistory={canViewHistory}
      />
```

### Step 2: Update `student-profile.tsx` to accept the prop and add the tab

Open `src/app/(dashboard)/students/[id]/student-profile.tsx`.

**a)** Find the props interface (it's typed inline in the function signature `export function StudentProfile({ student, allGuardians, classArmOptions, academicYears, terms }: { ... })`). Add `canViewHistory: boolean` to the destructure AND to the type:

```typescript
export function StudentProfile({
  student,
  allGuardians,
  classArmOptions,
  academicYears,
  terms,
  canViewHistory,
}: {
  student: StudentWithRelations;
  allGuardians: GuardianOption[];
  classArmOptions: ClassArmOption[];
  academicYears: AcademicYearOption[];
  terms: TermOption[];
  canViewHistory: boolean;
}) {
```

(If the existing prop types use a separate named interface, add `canViewHistory: boolean` to that interface instead. Adjust accordingly.)

**b)** Add the `HistoryTab` import at the top:

```typescript
import { HistoryTab } from "./history-tab";
```

**c)** Find the `tabs` array (around line 169):

```typescript
  const tabs = [
    { title: "Personal", index: 0 },
    { title: "Guardians", index: 1 },
    { title: "Academic", index: 2 },
    { title: "Finance", index: 3 },
    { title: "Attendance", index: 4 },
    { title: "Discipline", index: 5 },
    { title: "Health", index: 6 },
    { title: "Documents", index: 7 },
    ...(hasBoarding ? [{ title: "Boarding", index: 8 }] : []),
  ];
```

Replace it with:

```typescript
  const tabs = [
    { title: "Personal", index: 0 },
    { title: "Guardians", index: 1 },
    { title: "Academic", index: 2 },
    { title: "Finance", index: 3 },
    { title: "Attendance", index: 4 },
    { title: "Discipline", index: 5 },
    { title: "Health", index: 6 },
    { title: "Documents", index: 7 },
    ...(hasBoarding ? [{ title: "Boarding", index: 8 }] : []),
    ...(canViewHistory ? [{ title: "History", index: 9 }] : []),
  ];
```

**d)** Find the tab content section (the file uses `{activeTab === N && (...)}` blocks). Locate the LAST such block (likely the Boarding tab, or whatever is at index 8). Append a new block AFTER it:

```tsx
        {/* ─── History Tab ──────────────────────────────── */}
        {activeTab === 9 && canViewHistory && (
          <HistoryTab studentId={student.id} />
        )}
```

Place this immediately before the closing `</div>` of the tab-content wrapper, in the same indentation as the other `{activeTab === N && ...}` blocks.

### Step 3: TypeScript check

```bash
npx tsc --noEmit 2>&1 | grep -E "(student-profile|page\.tsx)" | head -10
```

Expected: no NEW errors mentioning these two files. (Pre-existing errors elsewhere in the repo are fine.)

### Step 4: Smoke test build

```bash
npm test -- tests/unit/student/
```

Expected: all student tests pass.

### Step 5: Commit

```bash
git add 'src/app/(dashboard)/students/[id]/page.tsx' 'src/app/(dashboard)/students/[id]/student-profile.tsx'
git commit -m "feat(students): wire History tab into profile (gated by AUDIT_LOG_READ)"
```

---

## Task 4: Final verification + PR-readiness

### Step 1: Full test sweep

```bash
npm test -- tests/unit/student/
```

Expected: all green.

### Step 2: TypeScript check

```bash
npx tsc --noEmit 2>&1 | grep -E "history|student-profile|students/\[id\]" | head -20
```

Expected: no NEW errors related to the files in this PR.

### Step 3: Git log

```bash
git log --oneline main..HEAD
```

Expected: 4 commits — the spec/plan docs commit (already there), and three new feat commits from Tasks 1, 2, 3.

### Step 4: Browser verification (manual checklist)

Start the dev server (`npm run dev`) and walk through:

1. Navigate to `/students/[id]` for any student. Confirm the "History" tab appears (when logged in as super_admin).
2. Click the History tab. Confirm the table renders or shows "No history yet for this student."
3. Make a small change to the student's profile (e.g., update the name via the existing edit flow), then return to the History tab. Confirm a new row appears at the top.
4. Toggle the action filter to "Updated". Confirm only UPDATE rows show.
5. Click an UPDATE row. Confirm the diff drawer opens with `previousData` / `newData`.
6. Click a CREATE row. Confirm the drawer shows `newData` only (`previousData` is null → renders "—").
7. Page through if there are >25 rows: confirm pagination works.
8. Log in as a teacher account (no `AUDIT_LOG_READ`). Navigate to the same student profile. Confirm the History tab is NOT rendered.
9. Log in as a user from school B. Navigate directly to the URL of a school-A student. Confirm the page returns `notFound()` (existing behavior — student is not visible to this user; the History tab never renders).

### Step 5: Push and open PR

```bash
git push -u origin feat/student-history-tab
gh pr create --base main --title "feat(students): student profile history tab (Tier 3 #10)" --body "$(cat <<'EOF'
## Summary

Adds a "History" tab to the student profile page that surfaces existing AuditLog rows scoped to one student (the Student record itself plus related entities: medical records, documents, enrollments, guardian links, and house assignments).

- Reuses `AUDIT_LOG_READ` permission — tab is hidden for users without it
- Mirrors the table/expand UX of `/admin/audit-log`
- Action filter dropdown; click-to-expand for previousData/newData diff
- Strict tenant isolation (school-scoped at every layer)

## Test plan
- [ ] CI green (unit + lint + typecheck)
- [ ] Manual: log in as super_admin, navigate to a student profile, click History tab, verify rows appear, toggle action filter, click row to see diff
- [ ] Manual: log in as a teacher (no AUDIT_LOG_READ), confirm tab is hidden
- [ ] Manual: try cross-school access via direct URL — confirm not-found

## Spec / plan
- Spec: `docs/superpowers/specs/2026-05-01-student-history-tab-design.md`
- Plan: `docs/superpowers/plans/2026-05-01-student-history-tab.md`

Closes Tier 3 #10 from the Students-module feature-depth review.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(If `gh auth` is expired, the implementer should report back so the user can open the PR via browser at the URL the push command prints.)

---
