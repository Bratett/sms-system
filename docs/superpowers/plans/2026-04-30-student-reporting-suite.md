# Student Reporting Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 canonical student-centric reports (class roster, student census, nominal roll, form master's register, birthday list, missing-documents list) under a new `/reports/students` hub, each with bookmarkable URL filters, paginated preview, and XLSX (always) + PDF (where applicable) download routes. Every download writes one `AuditLog` row.

**Architecture:** Extend the existing `src/modules/reports/` module — one server action file per new report, mirroring the pattern of sibling reports (`admissions-report.action.ts`, etc.). Six XLSX renderer functions live in one shared file using `generateExport()` from `src/lib/export`. Three new react-pdf templates live in `src/lib/pdf/templates/`. Six binary download routes under `src/app/api/reports/students/<report>/<format>/route.ts` re-check permissions, call the same actions that drive the preview pages, render to Buffer, and emit `Content-Disposition: attachment`. UI mirrors `/reports/enrollment` — a server-component page reads `searchParams`, the action runs server-side, the client component renders the filter form (URL-driven via `router.push`), preview table (first 50 rows + total count badge), and download buttons.

**Tech Stack:** Next.js 15 App Router, Prisma 6.x on PostgreSQL, vitest + vitest-mock-extended, react-pdf (`@react-pdf/renderer`), `xlsx` + `papaparse` (already wrapped by `src/lib/export`).

**Spec reference:** [`docs/superpowers/specs/2026-04-30-student-reporting-suite-design.md`](../specs/2026-04-30-student-reporting-suite-design.md)

**Branch base:** `feat/student-reporting-suite` (off `main`).

---

## File Structure

**Created:**
- `src/modules/reports/actions/student-census.action.ts`
- `src/modules/reports/actions/student-nominal-roll.action.ts`
- `src/modules/reports/actions/student-form-register.action.ts`
- `src/modules/reports/actions/student-birthday-list.action.ts`
- `src/modules/reports/actions/student-missing-docs.action.ts`
- `src/modules/reports/xlsx/student-reports.ts` — six renderer functions
- `src/modules/reports/audit-helpers.ts` — small `auditReportDownload()` wrapper used by all 9 download routes
- `src/lib/pdf/templates/student-roster.tsx`
- `src/lib/pdf/templates/student-nominal-roll.tsx`
- `src/lib/pdf/templates/student-form-register.tsx`
- `src/app/(dashboard)/reports/students/page.tsx` + `students-reports-client.tsx`
- `src/app/(dashboard)/reports/students/roster/page.tsx` + `roster-client.tsx`
- `src/app/(dashboard)/reports/students/census/page.tsx` + `census-client.tsx`
- `src/app/(dashboard)/reports/students/nominal-roll/page.tsx` + `nominal-roll-client.tsx`
- `src/app/(dashboard)/reports/students/form-register/page.tsx` + `form-register-client.tsx`
- `src/app/(dashboard)/reports/students/birthdays/page.tsx` + `birthdays-client.tsx`
- `src/app/(dashboard)/reports/students/missing-documents/page.tsx` + `missing-documents-client.tsx`
- `src/app/api/reports/students/roster/xlsx/route.ts`
- `src/app/api/reports/students/roster/pdf/route.ts`
- `src/app/api/reports/students/census/xlsx/route.ts`
- `src/app/api/reports/students/nominal-roll/xlsx/route.ts`
- `src/app/api/reports/students/nominal-roll/pdf/route.ts`
- `src/app/api/reports/students/form-register/xlsx/route.ts`
- `src/app/api/reports/students/form-register/pdf/route.ts`
- `src/app/api/reports/students/birthdays/xlsx/route.ts`
- `src/app/api/reports/students/missing-documents/xlsx/route.ts`
- `tests/unit/reports/student-census.test.ts`
- `tests/unit/reports/student-nominal-roll.test.ts`
- `tests/unit/reports/student-form-register.test.ts`
- `tests/unit/reports/student-birthday-list.test.ts`
- `tests/unit/reports/student-missing-docs.test.ts`
- `tests/unit/reports/student-reports-xlsx.test.ts`
- `tests/unit/reports/student-reports-pdf.test.ts`
- `tests/integration/reports/student-report-downloads.test.ts`

**Modified:**
- `src/modules/reports/actions/student-report.action.ts` — add `assertPermission` (currently missing), accept extended filter shape (already has classArmId + academicYearId), no behavior change otherwise; new comment block linking to spec
- `src/app/(dashboard)/students/students-client.tsx` — add a "Reports" link button to the page header toolbar pointing to `/reports/students`
- `tests/unit/reports/reports.test.ts` — add a permission-required test for `getStudentRegisterReportAction` after the assertion is added

---

## Task 0: Branch + scratchpad

**Files:** none (git only)

- [ ] **Step 1: Create the feature branch**

```bash
git checkout main
git pull --ff-only
git checkout -b feat/student-reporting-suite
```

- [ ] **Step 2: Confirm baseline tests pass**

```bash
npm test -- tests/unit/reports/reports.test.ts
```

Expected: all existing report tests pass. If anything fails on `main`, stop and surface the failure to the user — do not proceed.

- [ ] **Step 3: Verify the spec is on disk**

```bash
ls docs/superpowers/specs/2026-04-30-student-reporting-suite-design.md
```

Expected: the file exists.

---

## Task 1: Add permission assertion to existing roster action

The existing `getStudentRegisterReportAction` imports `PERMISSIONS` and `assertPermission` but never calls `assertPermission`. Sibling actions (admissions, finance, audit) all do. Fix this first; the unit test for it lands now.

**Files:**
- Modify: `src/modules/reports/actions/student-report.action.ts:7-21`
- Modify: `tests/unit/reports/reports.test.ts` (append a new `describe` block)

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/reports/reports.test.ts`:

```typescript
// ─── getStudentRegisterReportAction permission ─────────────────────

describe("getStudentRegisterReportAction permission gate", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: [] });
  });

  it("rejects callers without REPORTS_ENROLLMENT_READ", async () => {
    const result = await getStudentRegisterReportAction();
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error.toLowerCase()).toContain("permission");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npm test -- tests/unit/reports/reports.test.ts -t "permission gate"
```

Expected: test fails because the action currently returns data without checking permissions.

- [ ] **Step 3: Add the permission assertion**

Edit `src/modules/reports/actions/student-report.action.ts`. After the existing line `if ("error" in ctx) return ctx;` (around line 13), insert:

```typescript
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORTS_ENROLLMENT_READ);
  if (denied) return denied;
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
npm test -- tests/unit/reports/reports.test.ts -t "permission gate"
```

Expected: passes. Then run the full reports file to ensure no regressions:

```bash
npm test -- tests/unit/reports/reports.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Add row-cap test (5001 rows triggers error)**

Append to the same `describe("getStudentRegisterReportAction permission gate", ...)` block — replace its closing `});` with a sibling `describe`:

```typescript
describe("getStudentRegisterReportAction row cap", () => {
  beforeEach(() => { mockAuthenticatedUser(); });

  it("returns an error when result set exceeds 5000 rows", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue({ id: "ay-1", isCurrent: true } as never);
    prismaMock.enrollment.count.mockResolvedValue(5001 as never);
    const result = await getStudentRegisterReportAction();
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/too large/i);
  });
});
```

- [ ] **Step 6: Run, confirm fail** — `npm test -- tests/unit/reports/reports.test.ts -t "row cap"`

- [ ] **Step 7: Add the row-cap guard to the action**

Edit `src/modules/reports/actions/student-report.action.ts`. After the academic-year resolution block (just before the `enrollmentWhere` declaration around line 27), insert:

```typescript
  const ROW_CAP = 5000;
  const totalCount = await db.enrollment.count({
    where: {
      academicYearId,
      status: "ACTIVE",
      ...(filters?.classArmId ? { classArmId: filters.classArmId } : {}),
    },
  });
  if (totalCount > ROW_CAP) {
    return { error: `Result set too large (${totalCount} rows). Apply tighter filters.` };
  }
```

- [ ] **Step 8: Run, confirm row-cap test passes; confirm full file passes**

```bash
npm test -- tests/unit/reports/reports.test.ts
```

- [ ] **Step 9: Commit**

```bash
git add src/modules/reports/actions/student-report.action.ts tests/unit/reports/reports.test.ts
git commit -m "fix(reports): add permission gate and 5000-row cap to student register action"
```

---

## Task 2: Hub index page at /reports/students

A landing page with 6 cards. No data fetching of its own — pure navigation hub.

**Files:**
- Create: `src/app/(dashboard)/reports/students/page.tsx`
- Create: `src/app/(dashboard)/reports/students/students-reports-client.tsx`

- [ ] **Step 1: Create the server-component page**

`src/app/(dashboard)/reports/students/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { StudentsReportsClient } from "./students-reports-client";

export default async function StudentsReportsHubPage() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Reports"
        description="Class rosters, census, nominal rolls, registers, birthdays, and missing-document follow-ups."
      />
      <StudentsReportsClient />
    </div>
  );
}
```

- [ ] **Step 2: Create the client component with 6 cards**

`src/app/(dashboard)/reports/students/students-reports-client.tsx`:

```tsx
"use client";

import Link from "next/link";

const REPORTS = [
  {
    slug: "roster",
    title: "Class Roster",
    description: "Student list per class arm with gender / boarding totals. PDF + XLSX.",
  },
  {
    slug: "census",
    title: "Student Census",
    description: "Aggregate counts by class, programme, region, gender, boarding, or religion. XLSX.",
  },
  {
    slug: "nominal-roll",
    title: "Nominal Roll",
    description: "Official student listing for one class arm — surnames uppercased. PDF + XLSX.",
  },
  {
    slug: "form-register",
    title: "Form Master's Register",
    description: "Printable attendance register with configurable weeks × days grid. PDF + XLSX.",
  },
  {
    slug: "birthdays",
    title: "Birthday List",
    description: "Birthdays in a chosen month or upcoming N days. XLSX.",
  },
  {
    slug: "missing-documents",
    title: "Missing Documents",
    description: "Active students missing or expired on required document types. XLSX.",
  },
];

export function StudentsReportsClient() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {REPORTS.map((r) => (
        <Link
          key={r.slug}
          href={`/reports/students/${r.slug}`}
          className="block rounded-lg border bg-card p-6 hover:border-primary hover:shadow-sm"
        >
          <h3 className="text-base font-semibold">{r.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Smoke check the page compiles**

```bash
npm run typecheck 2>&1 | tail -20
```

Expected: no new TypeScript errors. (If `typecheck` script doesn't exist, use `npx tsc --noEmit`.)

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/reports/students/
git commit -m "feat(reports): add student reports hub page with 6 cards"
```

---

## Task 3: Audit helper for downloads

A tiny helper called from every download route. Centralizing it means the audit shape stays consistent across 9 routes.

**Files:**
- Create: `src/modules/reports/audit-helpers.ts`
- Create: `tests/unit/reports/audit-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/reports/audit-helpers.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { audit } from "@/lib/audit";
import { auditReportDownload } from "@/modules/reports/audit-helpers";

vi.mock("@/lib/audit", () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

describe("auditReportDownload", () => {
  beforeEach(() => {
    vi.mocked(audit).mockClear();
  });

  it("writes one AuditLog row with EXPORT action and report slug", async () => {
    await auditReportDownload({
      userId: "u1",
      schoolId: "s1",
      reportSlug: "STUDENT_ROSTER",
      reportName: "Class Roster",
      format: "xlsx",
      filters: { academicYearId: "ay1" },
      rowCount: 42,
    });

    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        schoolId: "s1",
        action: "EXPORT",
        entity: "STUDENT_ROSTER",
        module: "reports",
        description: expect.stringContaining("Class Roster"),
        metadata: expect.objectContaining({
          format: "xlsx",
          filters: { academicYearId: "ay1" },
          rowCount: 42,
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npm test -- tests/unit/reports/audit-helpers.test.ts
```

Expected: fail with "Cannot find module '@/modules/reports/audit-helpers'".

- [ ] **Step 3: Implement the helper**

`src/modules/reports/audit-helpers.ts`:

```typescript
import { audit } from "@/lib/audit";

export type ReportDownloadFormat = "xlsx" | "pdf";

export interface AuditReportDownloadParams {
  userId: string;
  schoolId: string;
  reportSlug: string; // e.g., "STUDENT_ROSTER"
  reportName: string; // e.g., "Class Roster"
  format: ReportDownloadFormat;
  filters: Record<string, unknown>;
  rowCount: number;
}

export async function auditReportDownload(params: AuditReportDownloadParams): Promise<void> {
  await audit({
    userId: params.userId,
    schoolId: params.schoolId,
    action: "EXPORT",
    entity: params.reportSlug,
    module: "reports",
    description: `Downloaded ${params.reportName} as ${params.format.toUpperCase()}`,
    metadata: {
      format: params.format,
      filters: params.filters,
      rowCount: params.rowCount,
    },
  });
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
npm test -- tests/unit/reports/audit-helpers.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/reports/audit-helpers.ts tests/unit/reports/audit-helpers.test.ts
git commit -m "feat(reports): add auditReportDownload helper"
```

---

## Task 4: Roster report — XLSX renderer, PDF template, page, download routes

Roster action already exists. We add the XLSX renderer, the PDF template, the preview page, and two download routes.

**Files:**
- Create: `src/modules/reports/xlsx/student-reports.ts` (start with `renderRosterXlsx`)
- Create: `src/lib/pdf/templates/student-roster.tsx`
- Create: `src/app/(dashboard)/reports/students/roster/page.tsx` + `roster-client.tsx`
- Create: `src/app/api/reports/students/roster/xlsx/route.ts`
- Create: `src/app/api/reports/students/roster/pdf/route.ts`
- Create: `tests/unit/reports/student-reports-xlsx.test.ts` (start with roster cases)
- Create: `tests/unit/reports/student-reports-pdf.test.ts` (start with roster cases)

### Step 1: Roster XLSX renderer — failing test

`tests/unit/reports/student-reports-xlsx.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { renderRosterXlsx } from "@/modules/reports/xlsx/student-reports";

describe("renderRosterXlsx", () => {
  it("returns a Buffer with one row per student plus header", () => {
    const buffer = renderRosterXlsx({
      schoolName: "Demo SHS",
      filterSummary: "Form 2A · 2025/2026",
      generatedAt: new Date("2026-04-30T10:00:00Z"),
      generatedBy: "Test Admin",
      data: {
        totalStudents: 2,
        students: [
          {
            id: "s1",
            studentId: "SCH/2024/0001",
            name: "Adwoa Mensah",
            className: "Form 2 A",
            gender: "FEMALE",
            boardingStatus: "DAY",
            status: "ACTIVE",
          },
          {
            id: "s2",
            studentId: "SCH/2024/0002",
            name: "Kwame Boateng",
            className: "Form 2 A",
            gender: "MALE",
            boardingStatus: "BOARDING",
            status: "ACTIVE",
          },
        ],
        genderDistribution: { MALE: 1, FEMALE: 1 },
        boardingBreakdown: { DAY: 1, BOARDING: 1 },
        statusBreakdown: [{ status: "ACTIVE", count: 2 }],
      },
    });

    expect(buffer).toBeInstanceOf(Buffer);
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    expect(rows.length).toBe(2);
    expect(rows[0]["Student ID"]).toBe("SCH/2024/0001");
    expect(rows[0]["Name"]).toBe("Adwoa Mensah");
  });
});
```

- [ ] **Run the test, confirm it fails**

```bash
npm test -- tests/unit/reports/student-reports-xlsx.test.ts
```

Expected: fail with "Cannot find module".

### Step 2: Implement the roster XLSX renderer

`src/modules/reports/xlsx/student-reports.ts`:

```typescript
import { generateExport } from "@/lib/export";

export interface RosterStudentRow {
  id: string;
  studentId: string;
  name: string;
  className: string;
  gender: string;
  boardingStatus: string;
  status: string;
}

export interface RosterXlsxInput {
  schoolName: string;
  filterSummary: string;
  generatedAt: Date;
  generatedBy: string;
  data: {
    totalStudents: number;
    students: RosterStudentRow[];
    genderDistribution: { MALE: number; FEMALE: number };
    boardingBreakdown: { DAY: number; BOARDING: number };
    statusBreakdown: { status: string; count: number }[];
  };
}

export function renderRosterXlsx(input: RosterXlsxInput): Buffer {
  return generateExport({
    filename: "student-roster",
    sheetName: "Roster",
    format: "xlsx",
    columns: [
      { key: "studentId", header: "Student ID" },
      { key: "name", header: "Name" },
      { key: "className", header: "Class" },
      { key: "gender", header: "Gender" },
      { key: "boardingStatus", header: "Boarding" },
      { key: "status", header: "Status" },
    ],
    data: input.data.students as unknown as Record<string, unknown>[],
  });
}
```

- [ ] **Run the test, confirm it passes**

```bash
npm test -- tests/unit/reports/student-reports-xlsx.test.ts
```

Expected: pass.

### Step 3: Roster PDF template — smoke test

`tests/unit/reports/student-reports-pdf.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { StudentRosterPdf } from "@/lib/pdf/templates/student-roster";
import React from "react";

describe("StudentRosterPdf", () => {
  it("renders a non-empty PDF buffer", async () => {
    const buffer = await renderPdfToBuffer(
      React.createElement(StudentRosterPdf, {
        schoolName: "Demo SHS",
        schoolMotto: "Knowledge & Service",
        schoolLogoUrl: null,
        title: "Class Roster",
        filterSummary: "Form 2A · 2025/2026",
        generatedAt: new Date("2026-04-30T10:00:00Z"),
        generatedBy: "Test Admin",
        students: [
          {
            studentId: "SCH/2024/0001",
            name: "Adwoa Mensah",
            className: "Form 2 A",
            gender: "FEMALE",
            boardingStatus: "DAY",
            status: "ACTIVE",
          },
        ],
        totals: { total: 1, male: 0, female: 1, day: 1, boarding: 0 },
      }),
    );
    expect(buffer.length).toBeGreaterThan(1000);
    // PDF magic header
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
```

- [ ] **Run the test, confirm it fails**

```bash
npm test -- tests/unit/reports/student-reports-pdf.test.ts
```

Expected: fail with "Cannot find module".

### Step 4: Implement the roster PDF template

`src/lib/pdf/templates/student-roster.tsx`:

```tsx
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";

export interface RosterPdfStudent {
  studentId: string;
  name: string;
  className: string;
  gender: string;
  boardingStatus: string;
  status: string;
}

export interface RosterPdfProps {
  schoolName: string;
  schoolMotto?: string | null;
  schoolLogoUrl?: string | null;
  title: string;
  filterSummary: string;
  generatedAt: Date;
  generatedBy: string;
  students: RosterPdfStudent[];
  totals: { total: number; male: number; female: number; day: number; boarding: number };
}

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: "Helvetica" },
  header: {
    alignItems: "center",
    borderBottom: "2px solid #1a1a1a",
    paddingBottom: 8,
    marginBottom: 12,
  },
  schoolName: { fontSize: 16, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  motto: { fontSize: 9, fontStyle: "italic", color: "#555" },
  title: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 6 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, fontSize: 8, color: "#444" },
  table: { borderTop: "1px solid #888" },
  row: { flexDirection: "row", borderBottom: "1px solid #ccc", paddingVertical: 3 },
  rowHead: { flexDirection: "row", borderBottom: "1px solid #888", paddingVertical: 4, backgroundColor: "#f3f3f3" },
  cellNum: { width: 24, textAlign: "right", paddingRight: 4 },
  cellId: { width: 80 },
  cellName: { flex: 2 },
  cellClass: { flex: 1 },
  cellShort: { width: 50 },
  totals: { marginTop: 12, fontSize: 9 },
  signatureRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 30 },
  sig: { width: "40%", borderTop: "1px solid #1a1a1a", paddingTop: 4, fontSize: 9 },
});

export function StudentRosterPdf(props: RosterPdfProps) {
  const { schoolName, schoolMotto, title, filterSummary, generatedAt, generatedBy, students, totals } = props;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          {schoolMotto ? <Text style={styles.motto}>{schoolMotto}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text>{filterSummary}</Text>
          <Text>Generated {generatedAt.toISOString().slice(0, 10)} by {generatedBy}</Text>
        </View>
        <View style={styles.rowHead}>
          <Text style={styles.cellNum}>#</Text>
          <Text style={styles.cellId}>Student ID</Text>
          <Text style={styles.cellName}>Name</Text>
          <Text style={styles.cellClass}>Class</Text>
          <Text style={styles.cellShort}>Sex</Text>
          <Text style={styles.cellShort}>Boarding</Text>
        </View>
        {students.map((s, i) => (
          <View key={s.studentId} style={styles.row}>
            <Text style={styles.cellNum}>{i + 1}</Text>
            <Text style={styles.cellId}>{s.studentId}</Text>
            <Text style={styles.cellName}>{s.name}</Text>
            <Text style={styles.cellClass}>{s.className}</Text>
            <Text style={styles.cellShort}>{s.gender}</Text>
            <Text style={styles.cellShort}>{s.boardingStatus}</Text>
          </View>
        ))}
        <View style={styles.totals}>
          <Text>Total: {totals.total}  ·  Male: {totals.male}  ·  Female: {totals.female}  ·  Day: {totals.day}  ·  Boarding: {totals.boarding}</Text>
        </View>
        <View style={styles.signatureRow}>
          <Text style={styles.sig}>Form Master / Mistress</Text>
          <Text style={styles.sig}>Headmaster / Headmistress</Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Run the test, confirm it passes**

```bash
npm test -- tests/unit/reports/student-reports-pdf.test.ts
```

Expected: pass; the buffer starts with `%PDF`.

### Step 5: Roster preview page — server component

`src/app/(dashboard)/reports/students/roster/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getReportFiltersAction } from "@/modules/reports/actions/report.action";
import { getStudentRegisterReportAction } from "@/modules/reports/actions/student-report.action";
import { RosterClient } from "./roster-client";

export default async function RosterReportPage({
  searchParams,
}: {
  searchParams: Promise<{ academicYearId?: string; classArmId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const sp = await searchParams;
  const [filtersResult, reportResult] = await Promise.all([
    getReportFiltersAction(),
    getStudentRegisterReportAction({
      academicYearId: sp.academicYearId,
      classArmId: sp.classArmId,
    }),
  ]);

  const filters = "data" in filtersResult ? filtersResult.data : { academicYears: [], terms: [], classArms: [] };
  const report = "data" in reportResult ? reportResult.data : null;
  const error = "error" in reportResult ? reportResult.error : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Class Roster"
        description="Per-class arm student listing with totals."
      />
      <RosterClient
        filters={filters}
        report={report}
        error={error}
        appliedFilters={sp}
      />
    </div>
  );
}
```

### Step 6: Roster client component

`src/app/(dashboard)/reports/students/roster/roster-client.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface ClientProps {
  filters: {
    academicYears: { id: string; name: string; isCurrent: boolean }[];
    classArms: { id: string; name: string; class?: { name: string } }[];
  };
  report: {
    totalStudents: number;
    students: Array<{
      id: string;
      studentId: string;
      name: string;
      className: string;
      gender: string;
      boardingStatus: string;
      status: string;
    }>;
    genderDistribution: { MALE: number; FEMALE: number };
    boardingBreakdown: { DAY: number; BOARDING: number };
  } | null;
  error: string | null;
  appliedFilters: { academicYearId?: string; classArmId?: string };
}

export function RosterClient({ filters, report, error, appliedFilters }: ClientProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [yearId, setYearId] = useState(appliedFilters.academicYearId ?? "");
  const [classArmId, setClassArmId] = useState(appliedFilters.classArmId ?? "");

  function applyFilters() {
    const next = new URLSearchParams(params);
    yearId ? next.set("academicYearId", yearId) : next.delete("academicYearId");
    classArmId ? next.set("classArmId", classArmId) : next.delete("classArmId");
    router.push(`?${next.toString()}`);
  }

  function downloadUrl(format: "xlsx" | "pdf") {
    const u = new URLSearchParams();
    if (appliedFilters.academicYearId) u.set("academicYearId", appliedFilters.academicYearId);
    if (appliedFilters.classArmId) u.set("classArmId", appliedFilters.classArmId);
    return `/api/reports/students/roster/${format}?${u.toString()}`;
  }

  const empty = !report || report.totalStudents === 0;
  const previewRows = report?.students.slice(0, 50) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <label className="text-sm">
          <div className="mb-1 font-medium">Academic Year</div>
          <select className="rounded-md border px-3 py-2 text-sm" value={yearId} onChange={(e) => setYearId(e.target.value)}>
            <option value="">(Current)</option>
            {filters.academicYears.map((y) => (
              <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? " (Current)" : ""}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">Class Arm</div>
          <select className="rounded-md border px-3 py-2 text-sm" value={classArmId} onChange={(e) => setClassArmId(e.target.value)}>
            <option value="">All</option>
            {filters.classArms.map((c) => (
              <option key={c.id} value={c.id}>{c.class?.name ? `${c.class.name} ${c.name}` : c.name}</option>
            ))}
          </select>
        </label>
        <button onClick={applyFilters} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Apply</button>
        <div className="ml-auto flex gap-2">
          <a href={downloadUrl("xlsx")} aria-disabled={empty} className={`rounded-md border px-3 py-2 text-sm ${empty ? "pointer-events-none opacity-40" : ""}`}>Download XLSX</a>
          <a href={downloadUrl("pdf")} aria-disabled={empty} className={`rounded-md border px-3 py-2 text-sm ${empty ? "pointer-events-none opacity-40" : ""}`}>Download PDF</a>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {report && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm">
            <strong>{report.totalStudents}</strong> student{report.totalStudents === 1 ? "" : "s"} match — showing first {previewRows.length}.
          </p>
          {empty ? (
            <p className="text-sm text-muted-foreground">No students match these filters.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left">
                <tr><th className="py-2">#</th><th>Student ID</th><th>Name</th><th>Class</th><th>Sex</th><th>Boarding</th></tr>
              </thead>
              <tbody>
                {previewRows.map((s, i) => (
                  <tr key={s.id} className="border-b">
                    <td className="py-1.5">{i + 1}</td>
                    <td>{s.studentId}</td>
                    <td>{s.name}</td>
                    <td>{s.className}</td>
                    <td>{s.gender}</td>
                    <td>{s.boardingStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
```

### Step 7: Roster XLSX download route

`src/app/api/reports/students/roster/xlsx/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentRegisterReportAction } from "@/modules/reports/actions/student-report.action";
import { renderRosterXlsx } from "@/modules/reports/xlsx/student-reports";
import { auditReportDownload } from "@/modules/reports/audit-helpers";
import { getExportContentType } from "@/lib/export";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = session.user.permissions ?? [];
  if (!perms.includes("*") && !perms.includes(PERMISSIONS.REPORTS_ENROLLMENT_READ)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const academicYearId = sp.get("academicYearId") || undefined;
  const classArmId = sp.get("classArmId") || undefined;

  const result = await getStudentRegisterReportAction({ academicYearId, classArmId });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const buffer = renderRosterXlsx({
    schoolName: session.user.schoolName ?? "School",
    filterSummary: classArmId ? `Class arm filter applied` : "All class arms",
    generatedAt: new Date(),
    generatedBy: session.user.name ?? "Unknown",
    data: result.data!,
  });

  await auditReportDownload({
    userId: session.user.id,
    schoolId: session.user.schoolId!,
    reportSlug: "STUDENT_ROSTER",
    reportName: "Class Roster",
    format: "xlsx",
    filters: { academicYearId, classArmId },
    rowCount: result.data!.totalStudents,
  });

  const filename = `roster-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": getExportContentType("xlsx"),
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

### Step 8: Roster PDF download route

`src/app/api/reports/students/roster/pdf/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentRegisterReportAction } from "@/modules/reports/actions/student-report.action";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { StudentRosterPdf } from "@/lib/pdf/templates/student-roster";
import { auditReportDownload } from "@/modules/reports/audit-helpers";
import React from "react";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = session.user.permissions ?? [];
  if (!perms.includes("*") && !perms.includes(PERMISSIONS.REPORTS_ENROLLMENT_READ)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const academicYearId = sp.get("academicYearId") || undefined;
  const classArmId = sp.get("classArmId") || undefined;

  const result = await getStudentRegisterReportAction({ academicYearId, classArmId });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const school = await db.school.findUnique({
    where: { id: session.user.schoolId! },
    select: { name: true, motto: true, logoUrl: true },
  });

  const data = result.data!;
  const totals = {
    total: data.totalStudents,
    male: data.genderDistribution.MALE,
    female: data.genderDistribution.FEMALE,
    day: data.boardingBreakdown.DAY,
    boarding: data.boardingBreakdown.BOARDING,
  };

  const buffer = await renderPdfToBuffer(
    React.createElement(StudentRosterPdf, {
      schoolName: school?.name ?? session.user.schoolName ?? "School",
      schoolMotto: school?.motto ?? null,
      schoolLogoUrl: school?.logoUrl ?? null,
      title: "Class Roster",
      filterSummary: classArmId ? "Single class arm" : "All class arms",
      generatedAt: new Date(),
      generatedBy: session.user.name ?? "Unknown",
      students: data.students,
      totals,
    }),
  );

  await auditReportDownload({
    userId: session.user.id,
    schoolId: session.user.schoolId!,
    reportSlug: "STUDENT_ROSTER",
    reportName: "Class Roster",
    format: "pdf",
    filters: { academicYearId, classArmId },
    rowCount: data.totalStudents,
  });

  const filename = `roster-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 9: Run all roster-related tests**

```bash
npm test -- tests/unit/reports/student-reports-xlsx.test.ts tests/unit/reports/student-reports-pdf.test.ts tests/unit/reports/audit-helpers.test.ts tests/unit/reports/reports.test.ts
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src/modules/reports/xlsx/ src/lib/pdf/templates/student-roster.tsx src/app/\(dashboard\)/reports/students/roster/ src/app/api/reports/students/roster/ tests/unit/reports/student-reports-xlsx.test.ts tests/unit/reports/student-reports-pdf.test.ts
git commit -m "feat(reports): roster preview page + XLSX/PDF downloads"
```

---

## Task 5: Census report

Aggregate counts by class / programme / region / gender / boarding / religion. XLSX-only. Single Prisma `groupBy` keeps it fast.

**Files:**
- Create: `src/modules/reports/actions/student-census.action.ts`
- Create: `src/app/(dashboard)/reports/students/census/page.tsx` + `census-client.tsx`
- Create: `src/app/api/reports/students/census/xlsx/route.ts`
- Create: `tests/unit/reports/student-census.test.ts`
- Modify: `src/modules/reports/xlsx/student-reports.ts` (add `renderCensusXlsx`)
- Modify: `tests/unit/reports/student-reports-xlsx.test.ts` (add census case)

### Step 1: Action — failing tests

`tests/unit/reports/student-census.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import { getStudentCensusAction } from "@/modules/reports/actions/student-census.action";

describe("getStudentCensusAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: "ay-1", name: "2025/2026", isCurrent: true,
    } as never);
  });

  it("rejects callers without REPORTS_ENROLLMENT_READ", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getStudentCensusAction({ groupBy: "gender" });
    expect(result).toHaveProperty("error");
  });

  it("returns rows grouped by gender with totals", async () => {
    prismaMock.enrollment.findMany.mockResolvedValue([
      { student: { gender: "MALE", boardingStatus: "DAY", region: null, religion: null }, classArm: { class: { name: "Form 1", programmeId: "p1" } } },
      { student: { gender: "MALE", boardingStatus: "BOARDING", region: null, religion: null }, classArm: { class: { name: "Form 1", programmeId: "p1" } } },
      { student: { gender: "FEMALE", boardingStatus: "DAY", region: null, religion: null }, classArm: { class: { name: "Form 1", programmeId: "p1" } } },
    ] as never);
    prismaMock.programme.findMany.mockResolvedValue([] as never);

    const result = await getStudentCensusAction({ groupBy: "gender" });
    expect(result).toHaveProperty("data");
    const rows = (result as { data: { rows: Array<Record<string, unknown>> } }).data.rows;
    const male = rows.find((r) => r.groupKey === "MALE");
    const female = rows.find((r) => r.groupKey === "FEMALE");
    expect(male).toEqual(expect.objectContaining({ total: 2, male: 2, female: 0, day: 1, boarding: 1 }));
    expect(female).toEqual(expect.objectContaining({ total: 1 }));
  });
});
```

- [ ] **Run, confirm it fails** — `npm test -- tests/unit/reports/student-census.test.ts`

### Step 2: Implement the action

`src/modules/reports/actions/student-census.action.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

export type CensusGroupBy = "class" | "programme" | "region" | "gender" | "boarding" | "religion";

export interface CensusRow {
  groupKey: string;
  groupLabel: string;
  total: number;
  male: number;
  female: number;
  day: number;
  boarding: number;
}

export async function getStudentCensusAction(filters: {
  academicYearId?: string;
  groupBy: CensusGroupBy;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORTS_ENROLLMENT_READ);
  if (denied) return denied;

  let academicYearId = filters.academicYearId;
  if (!academicYearId) {
    const current = await db.academicYear.findFirst({
      where: { schoolId: ctx.schoolId, isCurrent: true },
    });
    academicYearId = current?.id;
  }
  if (!academicYearId) return { error: "No academic year found." };

  const enrollments = await db.enrollment.findMany({
    where: { academicYearId, status: "ACTIVE", classArm: { class: { schoolId: ctx.schoolId } } },
    select: {
      student: { select: { gender: true, boardingStatus: true, region: true, religion: true } },
      classArm: { select: { class: { select: { name: true, programmeId: true } } } },
    },
  });

  const programmes = await db.programme.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true },
  });
  const progName = new Map(programmes.map((p) => [p.id, p.name]));

  const buckets = new Map<string, CensusRow>();
  for (const e of enrollments) {
    const s = e.student;
    let key: string;
    let label: string;
    switch (filters.groupBy) {
      case "class": key = e.classArm.class.name; label = key; break;
      case "programme": key = e.classArm.class.programmeId ?? "UNASSIGNED"; label = progName.get(key) ?? "Unassigned"; break;
      case "region": key = s.region ?? "UNKNOWN"; label = key; break;
      case "gender": key = s.gender; label = key; break;
      case "boarding": key = s.boardingStatus; label = key; break;
      case "religion": key = s.religion ?? "UNKNOWN"; label = key; break;
    }
    if (!buckets.has(key)) buckets.set(key, { groupKey: key, groupLabel: label, total: 0, male: 0, female: 0, day: 0, boarding: 0 });
    const b = buckets.get(key)!;
    b.total++;
    if (s.gender === "MALE") b.male++;
    if (s.gender === "FEMALE") b.female++;
    if (s.boardingStatus === "DAY") b.day++;
    if (s.boardingStatus === "BOARDING") b.boarding++;
  }

  const rows = [...buckets.values()].sort((a, b) => b.total - a.total);
  return { data: { rows, total: enrollments.length, groupBy: filters.groupBy } };
}
```

- [ ] **Run, confirm test passes** — `npm test -- tests/unit/reports/student-census.test.ts`

### Step 3: XLSX renderer for census

Append to `src/modules/reports/xlsx/student-reports.ts`:

```typescript
import type { CensusRow } from "@/modules/reports/actions/student-census.action";

export function renderCensusXlsx(input: {
  schoolName: string;
  generatedAt: Date;
  generatedBy: string;
  groupBy: string;
  rows: CensusRow[];
}): Buffer {
  return generateExport({
    filename: "student-census",
    sheetName: `Census by ${input.groupBy}`,
    format: "xlsx",
    columns: [
      { key: "groupLabel", header: input.groupBy.charAt(0).toUpperCase() + input.groupBy.slice(1) },
      { key: "total", header: "Total" },
      { key: "male", header: "Male" },
      { key: "female", header: "Female" },
      { key: "day", header: "Day" },
      { key: "boarding", header: "Boarding" },
    ],
    data: input.rows as unknown as Record<string, unknown>[],
  });
}
```

Append to `tests/unit/reports/student-reports-xlsx.test.ts`:

```typescript
import { renderCensusXlsx } from "@/modules/reports/xlsx/student-reports";

describe("renderCensusXlsx", () => {
  it("returns a Buffer with one row per group", () => {
    const buffer = renderCensusXlsx({
      schoolName: "Demo SHS",
      generatedAt: new Date(),
      generatedBy: "Test Admin",
      groupBy: "gender",
      rows: [
        { groupKey: "MALE", groupLabel: "MALE", total: 5, male: 5, female: 0, day: 3, boarding: 2 },
        { groupKey: "FEMALE", groupLabel: "FEMALE", total: 4, male: 0, female: 4, day: 4, boarding: 0 },
      ],
    });
    expect(buffer).toBeInstanceOf(Buffer);
    const wb = XLSX.read(buffer, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
    expect(rows.length).toBe(2);
  });
});
```

- [ ] **Run xlsx tests, confirm pass** — `npm test -- tests/unit/reports/student-reports-xlsx.test.ts`

### Step 4: Census preview page + client

`src/app/(dashboard)/reports/students/census/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getReportFiltersAction } from "@/modules/reports/actions/report.action";
import { getStudentCensusAction, type CensusGroupBy } from "@/modules/reports/actions/student-census.action";
import { CensusClient } from "./census-client";

const ALLOWED: CensusGroupBy[] = ["class", "programme", "region", "gender", "boarding", "religion"];

export default async function CensusPage({ searchParams }: { searchParams: Promise<{ academicYearId?: string; groupBy?: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const sp = await searchParams;
  const groupBy = (ALLOWED.includes(sp.groupBy as CensusGroupBy) ? sp.groupBy : "class") as CensusGroupBy;

  const [filters, report] = await Promise.all([
    getReportFiltersAction(),
    getStudentCensusAction({ academicYearId: sp.academicYearId, groupBy }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Student Census" description="Aggregate student counts." />
      <CensusClient
        academicYears={"data" in filters ? filters.data.academicYears : []}
        report={"data" in report ? report.data : null}
        error={"error" in report ? report.error : null}
        appliedFilters={{ academicYearId: sp.academicYearId, groupBy }}
      />
    </div>
  );
}
```

`src/app/(dashboard)/reports/students/census/census-client.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const GROUP_OPTIONS = [
  { value: "class", label: "Class" },
  { value: "programme", label: "Programme" },
  { value: "region", label: "Region" },
  { value: "gender", label: "Gender" },
  { value: "boarding", label: "Boarding status" },
  { value: "religion", label: "Religion" },
];

interface Props {
  academicYears: { id: string; name: string; isCurrent: boolean }[];
  report: { rows: Array<{ groupKey: string; groupLabel: string; total: number; male: number; female: number; day: number; boarding: number }>; total: number; groupBy: string } | null;
  error: string | null;
  appliedFilters: { academicYearId?: string; groupBy: string };
}

export function CensusClient({ academicYears, report, error, appliedFilters }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [yearId, setYearId] = useState(appliedFilters.academicYearId ?? "");
  const [groupBy, setGroupBy] = useState(appliedFilters.groupBy);

  function apply() {
    const next = new URLSearchParams(params);
    yearId ? next.set("academicYearId", yearId) : next.delete("academicYearId");
    next.set("groupBy", groupBy);
    router.push(`?${next.toString()}`);
  }

  function downloadUrl() {
    const u = new URLSearchParams();
    if (appliedFilters.academicYearId) u.set("academicYearId", appliedFilters.academicYearId);
    u.set("groupBy", appliedFilters.groupBy);
    return `/api/reports/students/census/xlsx?${u.toString()}`;
  }

  const empty = !report || report.rows.length === 0;
  const previewRows = report?.rows.slice(0, 50) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <label className="text-sm">
          <div className="mb-1 font-medium">Academic Year</div>
          <select value={yearId} onChange={(e) => setYearId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">(Current)</option>
            {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? " (Current)" : ""}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">Group by</div>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            {GROUP_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </label>
        <button onClick={apply} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Apply</button>
        <a href={downloadUrl()} aria-disabled={empty} className={`ml-auto rounded-md border px-3 py-2 text-sm ${empty ? "pointer-events-none opacity-40" : ""}`}>Download XLSX</a>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {report && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm">Total active students: <strong>{report.total}</strong></p>
          {empty ? (
            <p className="text-sm text-muted-foreground">No data.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left"><tr><th className="py-2">Group</th><th>Total</th><th>Male</th><th>Female</th><th>Day</th><th>Boarding</th></tr></thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.groupKey} className="border-b"><td className="py-1.5">{r.groupLabel}</td><td>{r.total}</td><td>{r.male}</td><td>{r.female}</td><td>{r.day}</td><td>{r.boarding}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
```

### Step 5: Census XLSX download route

`src/app/api/reports/students/census/xlsx/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentCensusAction, type CensusGroupBy } from "@/modules/reports/actions/student-census.action";
import { renderCensusXlsx } from "@/modules/reports/xlsx/student-reports";
import { auditReportDownload } from "@/modules/reports/audit-helpers";
import { getExportContentType } from "@/lib/export";

const ALLOWED: CensusGroupBy[] = ["class", "programme", "region", "gender", "boarding", "religion"];

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perms = session.user.permissions ?? [];
  if (!perms.includes("*") && !perms.includes(PERMISSIONS.REPORTS_ENROLLMENT_READ)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const academicYearId = sp.get("academicYearId") || undefined;
  const groupParam = sp.get("groupBy");
  const groupBy = (ALLOWED.includes(groupParam as CensusGroupBy) ? groupParam : "class") as CensusGroupBy;

  const result = await getStudentCensusAction({ academicYearId, groupBy });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const buffer = renderCensusXlsx({
    schoolName: session.user.schoolName ?? "School",
    generatedAt: new Date(),
    generatedBy: session.user.name ?? "Unknown",
    groupBy,
    rows: result.data!.rows,
  });

  await auditReportDownload({
    userId: session.user.id,
    schoolId: session.user.schoolId!,
    reportSlug: "STUDENT_CENSUS",
    reportName: "Student Census",
    format: "xlsx",
    filters: { academicYearId, groupBy },
    rowCount: result.data!.rows.length,
  });

  const filename = `student-census-${groupBy}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": getExportContentType("xlsx"),
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 6: Run all tests, confirm all pass**

```bash
npm test -- tests/unit/reports/
```

- [ ] **Step 7: Commit**

```bash
git add src/modules/reports/actions/student-census.action.ts src/modules/reports/xlsx/ src/app/\(dashboard\)/reports/students/census/ src/app/api/reports/students/census/ tests/unit/reports/student-census.test.ts tests/unit/reports/student-reports-xlsx.test.ts
git commit -m "feat(reports): student census report (XLSX) with 6 group-by axes"
```

---

## Task 6: Nominal roll report

Single class arm. Surnames uppercased in PDF, raw case in XLSX. Includes primary guardian phone.

**Files:**
- Create: `src/modules/reports/actions/student-nominal-roll.action.ts`
- Create: `src/lib/pdf/templates/student-nominal-roll.tsx`
- Create: `src/app/(dashboard)/reports/students/nominal-roll/page.tsx` + `nominal-roll-client.tsx`
- Create: `src/app/api/reports/students/nominal-roll/xlsx/route.ts` + `pdf/route.ts`
- Create: `tests/unit/reports/student-nominal-roll.test.ts`
- Modify: `src/modules/reports/xlsx/student-reports.ts` (add `renderNominalRollXlsx`)
- Modify: `tests/unit/reports/student-reports-xlsx.test.ts` (add nominal roll case)
- Modify: `tests/unit/reports/student-reports-pdf.test.ts` (add nominal roll smoke test)

### Step 1: Action — failing tests

`tests/unit/reports/student-nominal-roll.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import { getStudentNominalRollAction } from "@/modules/reports/actions/student-nominal-roll.action";

describe("getStudentNominalRollAction", () => {
  beforeEach(() => { mockAuthenticatedUser(); });

  it("requires classArmId", async () => {
    const result = await getStudentNominalRollAction({ academicYearId: "ay1" } as never);
    expect(result).toHaveProperty("error");
  });

  it("rejects without permission", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getStudentNominalRollAction({ academicYearId: "ay1", classArmId: "ca1" });
    expect(result).toHaveProperty("error");
  });

  it("returns an error when result set exceeds 5000 rows", async () => {
    prismaMock.enrollment.count.mockResolvedValue(5001 as never);
    const result = await getStudentNominalRollAction({ academicYearId: "ay1", classArmId: "ca1" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/too large/i);
  });

  it("returns rows sorted by surname with primary guardian phone", async () => {
    prismaMock.enrollment.count.mockResolvedValue(2 as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      {
        student: {
          id: "s1", studentId: "SCH/2024/0002",
          firstName: "Kwame", lastName: "Boateng", otherNames: null,
          gender: "MALE", dateOfBirth: new Date("2008-04-01"),
          guardians: [{ isPrimary: true, guardian: { phone: "0240000000" } }],
        },
      },
      {
        student: {
          id: "s2", studentId: "SCH/2024/0001",
          firstName: "Adwoa", lastName: "Mensah", otherNames: null,
          gender: "FEMALE", dateOfBirth: new Date("2008-05-01"),
          guardians: [{ isPrimary: false, guardian: { phone: "0270000000" } }],
        },
      },
    ] as never);

    const result = await getStudentNominalRollAction({ academicYearId: "ay1", classArmId: "ca1" });
    expect(result).toHaveProperty("data");
    const rows = (result as { data: { rows: Array<Record<string, unknown>> } }).data.rows;
    expect(rows[0].surname).toBe("Boateng"); // 'B' before 'M'
    expect(rows[0].primaryGuardianPhone).toBe("0240000000");
    expect(rows[1].primaryGuardianPhone).toBe("0270000000"); // fallback to first
  });
});
```

- [ ] **Run, confirm fail** — `npm test -- tests/unit/reports/student-nominal-roll.test.ts`

### Step 2: Implement the action

`src/modules/reports/actions/student-nominal-roll.action.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

const ROW_CAP = 5000;

export interface NominalRollRow {
  row: number;
  studentId: string;
  surname: string;
  otherNames: string;
  gender: string;
  dateOfBirth: Date;
  primaryGuardianPhone: string | null;
}

export async function getStudentNominalRollAction(filters: {
  academicYearId?: string;
  classArmId?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORTS_ENROLLMENT_READ);
  if (denied) return denied;

  if (!filters.classArmId) return { error: "Class arm is required for nominal roll." };

  let academicYearId = filters.academicYearId;
  if (!academicYearId) {
    const current = await db.academicYear.findFirst({ where: { schoolId: ctx.schoolId, isCurrent: true } });
    academicYearId = current?.id;
  }
  if (!academicYearId) return { error: "No academic year found." };

  const count = await db.enrollment.count({
    where: { academicYearId, status: "ACTIVE", classArmId: filters.classArmId, classArm: { class: { schoolId: ctx.schoolId } } },
  });
  if (count > ROW_CAP) {
    return { error: `Result set too large (${count} rows). Apply tighter filters.` };
  }

  const enrollments = await db.enrollment.findMany({
    where: { academicYearId, status: "ACTIVE", classArmId: filters.classArmId, classArm: { class: { schoolId: ctx.schoolId } } },
    select: {
      student: {
        select: {
          id: true, studentId: true, firstName: true, lastName: true, otherNames: true,
          gender: true, dateOfBirth: true,
          guardians: {
            select: { isPrimary: true, guardian: { select: { phone: true } } },
          },
        },
      },
    },
  });

  const rows: NominalRollRow[] = enrollments
    .map((e) => {
      const s = e.student;
      const primary = s.guardians.find((g) => g.isPrimary) ?? s.guardians[0] ?? null;
      return {
        row: 0,
        studentId: s.studentId,
        surname: s.lastName,
        otherNames: [s.firstName, s.otherNames].filter(Boolean).join(" "),
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        primaryGuardianPhone: primary?.guardian.phone ?? null,
      };
    })
    .sort((a, b) => a.surname.localeCompare(b.surname))
    .map((r, i) => ({ ...r, row: i + 1 }));

  return { data: { rows, total: rows.length, classArmId: filters.classArmId, academicYearId } };
}
```

- [ ] **Run, confirm pass** — `npm test -- tests/unit/reports/student-nominal-roll.test.ts`

### Step 3: XLSX renderer + test

Append to `src/modules/reports/xlsx/student-reports.ts`:

```typescript
import type { NominalRollRow } from "@/modules/reports/actions/student-nominal-roll.action";

export function renderNominalRollXlsx(input: {
  schoolName: string;
  filterSummary: string;
  generatedAt: Date;
  generatedBy: string;
  rows: NominalRollRow[];
}): Buffer {
  return generateExport({
    filename: "nominal-roll",
    sheetName: "Nominal Roll",
    format: "xlsx",
    columns: [
      { key: "row", header: "#" },
      { key: "studentId", header: "Student ID" },
      { key: "surname", header: "Surname" },
      { key: "otherNames", header: "Other Names" },
      { key: "gender", header: "Sex" },
      { key: "dateOfBirth", header: "DOB", transform: (v) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "") },
      { key: "primaryGuardianPhone", header: "Guardian Phone" },
    ],
    data: input.rows as unknown as Record<string, unknown>[],
  });
}
```

Append to `tests/unit/reports/student-reports-xlsx.test.ts`:

```typescript
import { renderNominalRollXlsx } from "@/modules/reports/xlsx/student-reports";

describe("renderNominalRollXlsx", () => {
  it("emits one row per student with date formatted as ISO date", () => {
    const buffer = renderNominalRollXlsx({
      schoolName: "Demo SHS",
      filterSummary: "Form 2A",
      generatedAt: new Date(),
      generatedBy: "Admin",
      rows: [{
        row: 1, studentId: "SCH/2024/0001", surname: "Mensah", otherNames: "Adwoa",
        gender: "FEMALE", dateOfBirth: new Date("2008-05-15"), primaryGuardianPhone: "0270000000",
      }],
    });
    const wb = XLSX.read(buffer, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]]);
    expect(rows[0]["DOB"]).toBe("2008-05-15");
    expect(rows[0]["Surname"]).toBe("Mensah");
  });
});
```

- [ ] **Run xlsx tests** — `npm test -- tests/unit/reports/student-reports-xlsx.test.ts`

### Step 4: PDF template + smoke test

Append to `tests/unit/reports/student-reports-pdf.test.ts`:

```typescript
import { StudentNominalRollPdf } from "@/lib/pdf/templates/student-nominal-roll";

describe("StudentNominalRollPdf", () => {
  it("renders a non-empty PDF buffer with surnames uppercased", async () => {
    const buffer = await renderPdfToBuffer(
      React.createElement(StudentNominalRollPdf, {
        schoolName: "Demo SHS",
        schoolMotto: null,
        title: "Nominal Roll",
        filterSummary: "Form 2A",
        generatedAt: new Date(),
        generatedBy: "Admin",
        rows: [{
          row: 1, studentId: "SCH/2024/0001", surname: "Mensah",
          otherNames: "Adwoa", gender: "FEMALE",
          dateOfBirth: new Date("2008-05-15"), primaryGuardianPhone: "0270000000",
        }],
      }),
    );
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
```

- [ ] **Run, confirm fail** — `npm test -- tests/unit/reports/student-reports-pdf.test.ts -t "NominalRoll"`

`src/lib/pdf/templates/student-nominal-roll.tsx`:

```tsx
import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

export interface NominalRollPdfRow {
  row: number;
  studentId: string;
  surname: string;
  otherNames: string;
  gender: string;
  dateOfBirth: Date;
  primaryGuardianPhone: string | null;
}

export interface NominalRollPdfProps {
  schoolName: string;
  schoolMotto?: string | null;
  title: string;
  filterSummary: string;
  generatedAt: Date;
  generatedBy: string;
  rows: NominalRollPdfRow[];
}

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: "Helvetica" },
  header: { alignItems: "center", borderBottom: "2px solid #1a1a1a", paddingBottom: 8, marginBottom: 12 },
  schoolName: { fontSize: 16, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  motto: { fontSize: 9, fontStyle: "italic", color: "#555" },
  title: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 6 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, fontSize: 8, color: "#444" },
  rowHead: { flexDirection: "row", borderBottom: "1px solid #888", paddingVertical: 4, backgroundColor: "#f3f3f3" },
  row: { flexDirection: "row", borderBottom: "1px solid #ccc", paddingVertical: 3 },
  cellNum: { width: 24, textAlign: "right", paddingRight: 4 },
  cellId: { width: 80 },
  cellSurname: { flex: 1, fontFamily: "Helvetica-Bold" },
  cellOther: { flex: 1.5 },
  cellShort: { width: 40 },
  cellDob: { width: 70 },
  cellPhone: { width: 80 },
});

export function StudentNominalRollPdf(props: NominalRollPdfProps) {
  const { schoolName, schoolMotto, title, filterSummary, generatedAt, generatedBy, rows } = props;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          {schoolMotto ? <Text style={styles.motto}>{schoolMotto}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.meta}>
          <Text>{filterSummary}</Text>
          <Text>Generated {generatedAt.toISOString().slice(0, 10)} by {generatedBy}</Text>
        </View>
        <View style={styles.rowHead}>
          <Text style={styles.cellNum}>#</Text>
          <Text style={styles.cellId}>Student ID</Text>
          <Text style={styles.cellSurname}>SURNAME</Text>
          <Text style={styles.cellOther}>Other Names</Text>
          <Text style={styles.cellShort}>Sex</Text>
          <Text style={styles.cellDob}>DOB</Text>
          <Text style={styles.cellPhone}>Phone</Text>
        </View>
        {rows.map((r) => (
          <View key={r.studentId} style={styles.row}>
            <Text style={styles.cellNum}>{r.row}</Text>
            <Text style={styles.cellId}>{r.studentId}</Text>
            <Text style={styles.cellSurname}>{r.surname.toUpperCase()}</Text>
            <Text style={styles.cellOther}>{r.otherNames}</Text>
            <Text style={styles.cellShort}>{r.gender}</Text>
            <Text style={styles.cellDob}>{r.dateOfBirth.toISOString().slice(0, 10)}</Text>
            <Text style={styles.cellPhone}>{r.primaryGuardianPhone ?? "—"}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
```

- [ ] **Run, confirm pass** — `npm test -- tests/unit/reports/student-reports-pdf.test.ts`

### Step 5: Page + client + download routes

`src/app/(dashboard)/reports/students/nominal-roll/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getReportFiltersAction } from "@/modules/reports/actions/report.action";
import { getStudentNominalRollAction } from "@/modules/reports/actions/student-nominal-roll.action";
import { NominalRollClient } from "./nominal-roll-client";

export default async function NominalRollPage({ searchParams }: { searchParams: Promise<{ academicYearId?: string; classArmId?: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const sp = await searchParams;

  const [filtersR, reportR] = await Promise.all([
    getReportFiltersAction(),
    sp.classArmId
      ? getStudentNominalRollAction({ academicYearId: sp.academicYearId, classArmId: sp.classArmId })
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Nominal Roll" description="Official student listing per class arm." />
      <NominalRollClient
        academicYears={"data" in filtersR ? filtersR.data.academicYears : []}
        classArms={"data" in filtersR ? filtersR.data.classArms : []}
        report={"data" in reportR ? (reportR as { data: { rows: unknown[]; total: number } | null }).data : null}
        error={"error" in reportR ? (reportR as { error: string }).error : null}
        appliedFilters={sp}
      />
    </div>
  );
}
```

`src/app/(dashboard)/reports/students/nominal-roll/nominal-roll-client.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface Row {
  row: number; studentId: string; surname: string; otherNames: string;
  gender: string; dateOfBirth: string | Date; primaryGuardianPhone: string | null;
}

interface Props {
  academicYears: { id: string; name: string; isCurrent: boolean }[];
  classArms: { id: string; name: string; class?: { name: string } }[];
  report: { rows: Row[]; total: number } | null;
  error: string | null;
  appliedFilters: { academicYearId?: string; classArmId?: string };
}

export function NominalRollClient({ academicYears, classArms, report, error, appliedFilters }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [yearId, setYearId] = useState(appliedFilters.academicYearId ?? "");
  const [classArmId, setClassArmId] = useState(appliedFilters.classArmId ?? "");

  function apply() {
    const next = new URLSearchParams(params);
    yearId ? next.set("academicYearId", yearId) : next.delete("academicYearId");
    classArmId ? next.set("classArmId", classArmId) : next.delete("classArmId");
    router.push(`?${next.toString()}`);
  }

  function downloadUrl(format: "xlsx" | "pdf") {
    const u = new URLSearchParams();
    if (appliedFilters.academicYearId) u.set("academicYearId", appliedFilters.academicYearId);
    if (appliedFilters.classArmId) u.set("classArmId", appliedFilters.classArmId);
    return `/api/reports/students/nominal-roll/${format}?${u.toString()}`;
  }

  const empty = !report || report.rows.length === 0;
  const previewRows = (report?.rows ?? []).slice(0, 50);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <label className="text-sm">
          <div className="mb-1 font-medium">Academic Year</div>
          <select value={yearId} onChange={(e) => setYearId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">(Current)</option>
            {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">Class Arm <span className="text-red-500">*</span></div>
          <select value={classArmId} onChange={(e) => setClassArmId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">— Select —</option>
            {classArms.map((c) => <option key={c.id} value={c.id}>{c.class?.name ? `${c.class.name} ${c.name}` : c.name}</option>)}
          </select>
        </label>
        <button onClick={apply} disabled={!classArmId} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">Apply</button>
        <div className="ml-auto flex gap-2">
          <a href={downloadUrl("xlsx")} aria-disabled={empty} className={`rounded-md border px-3 py-2 text-sm ${empty ? "pointer-events-none opacity-40" : ""}`}>Download XLSX</a>
          <a href={downloadUrl("pdf")} aria-disabled={empty} className={`rounded-md border px-3 py-2 text-sm ${empty ? "pointer-events-none opacity-40" : ""}`}>Download PDF</a>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!classArmId && !report && <p className="text-sm text-muted-foreground">Select a class arm to generate the nominal roll.</p>}
      {report && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm"><strong>{report.total}</strong> students — showing first {previewRows.length}.</p>
          {empty ? <p className="text-sm text-muted-foreground">No students found.</p> : (
            <table className="w-full text-sm">
              <thead className="border-b text-left"><tr><th className="py-2">#</th><th>Student ID</th><th>Surname</th><th>Other Names</th><th>Sex</th><th>DOB</th><th>Phone</th></tr></thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.studentId} className="border-b">
                    <td className="py-1.5">{r.row}</td><td>{r.studentId}</td>
                    <td className="font-semibold">{r.surname}</td><td>{r.otherNames}</td>
                    <td>{r.gender}</td>
                    <td>{r.dateOfBirth instanceof Date ? r.dateOfBirth.toISOString().slice(0, 10) : String(r.dateOfBirth).slice(0, 10)}</td>
                    <td>{r.primaryGuardianPhone ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
```

`src/app/api/reports/students/nominal-roll/xlsx/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentNominalRollAction } from "@/modules/reports/actions/student-nominal-roll.action";
import { renderNominalRollXlsx } from "@/modules/reports/xlsx/student-reports";
import { auditReportDownload } from "@/modules/reports/audit-helpers";
import { getExportContentType } from "@/lib/export";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perms = session.user.permissions ?? [];
  if (!perms.includes("*") && !perms.includes(PERMISSIONS.REPORTS_ENROLLMENT_READ)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const academicYearId = sp.get("academicYearId") || undefined;
  const classArmId = sp.get("classArmId") || undefined;

  const result = await getStudentNominalRollAction({ academicYearId, classArmId });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const buffer = renderNominalRollXlsx({
    schoolName: session.user.schoolName ?? "School",
    filterSummary: `Class arm ${classArmId ?? ""}`,
    generatedAt: new Date(),
    generatedBy: session.user.name ?? "Unknown",
    rows: result.data!.rows,
  });

  await auditReportDownload({
    userId: session.user.id, schoolId: session.user.schoolId!,
    reportSlug: "STUDENT_NOMINAL_ROLL", reportName: "Nominal Roll",
    format: "xlsx", filters: { academicYearId, classArmId }, rowCount: result.data!.total,
  });

  const filename = `nominal-roll-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": getExportContentType("xlsx"), "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
```

`src/app/api/reports/students/nominal-roll/pdf/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentNominalRollAction } from "@/modules/reports/actions/student-nominal-roll.action";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { StudentNominalRollPdf } from "@/lib/pdf/templates/student-nominal-roll";
import { auditReportDownload } from "@/modules/reports/audit-helpers";
import React from "react";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perms = session.user.permissions ?? [];
  if (!perms.includes("*") && !perms.includes(PERMISSIONS.REPORTS_ENROLLMENT_READ)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const academicYearId = sp.get("academicYearId") || undefined;
  const classArmId = sp.get("classArmId") || undefined;

  const result = await getStudentNominalRollAction({ academicYearId, classArmId });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const school = await db.school.findUnique({
    where: { id: session.user.schoolId! }, select: { name: true, motto: true },
  });

  const buffer = await renderPdfToBuffer(
    React.createElement(StudentNominalRollPdf, {
      schoolName: school?.name ?? session.user.schoolName ?? "School",
      schoolMotto: school?.motto ?? null,
      title: "Nominal Roll",
      filterSummary: `Class arm ${classArmId ?? ""}`,
      generatedAt: new Date(),
      generatedBy: session.user.name ?? "Unknown",
      rows: result.data!.rows,
    }),
  );

  await auditReportDownload({
    userId: session.user.id, schoolId: session.user.schoolId!,
    reportSlug: "STUDENT_NOMINAL_ROLL", reportName: "Nominal Roll",
    format: "pdf", filters: { academicYearId, classArmId }, rowCount: result.data!.total,
  });

  const filename = `nominal-roll-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
```

- [ ] **Step 6: Run all reports tests** — `npm test -- tests/unit/reports/`

- [ ] **Step 7: Commit**

```bash
git add src/modules/reports/actions/student-nominal-roll.action.ts src/lib/pdf/templates/student-nominal-roll.tsx src/modules/reports/xlsx/ src/app/\(dashboard\)/reports/students/nominal-roll/ src/app/api/reports/students/nominal-roll/ tests/unit/reports/student-nominal-roll.test.ts tests/unit/reports/student-reports-xlsx.test.ts tests/unit/reports/student-reports-pdf.test.ts
git commit -m "feat(reports): nominal roll report (PDF + XLSX)"
```

---

## Task 7: Form master's register

Same student list as nominal roll, but landscape PDF with `weeks × daysPerWeek` empty grid. The action reuses nominal-roll's data shape; the PDF template is new.

**Files:**
- Create: `src/modules/reports/actions/student-form-register.action.ts`
- Create: `src/lib/pdf/templates/student-form-register.tsx`
- Create: `src/app/(dashboard)/reports/students/form-register/page.tsx` + `form-register-client.tsx`
- Create: `src/app/api/reports/students/form-register/xlsx/route.ts` + `pdf/route.ts`
- Create: `tests/unit/reports/student-form-register.test.ts`
- Modify: `src/modules/reports/xlsx/student-reports.ts` (add `renderFormRegisterXlsx`)
- Modify: `tests/unit/reports/student-reports-xlsx.test.ts` (form register case)
- Modify: `tests/unit/reports/student-reports-pdf.test.ts` (form register smoke test)

### Step 1: Action — failing test

`tests/unit/reports/student-form-register.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import { getStudentFormRegisterAction } from "@/modules/reports/actions/student-form-register.action";

describe("getStudentFormRegisterAction", () => {
  beforeEach(() => { mockAuthenticatedUser(); });

  it("rejects callers without REPORTS_ENROLLMENT_READ", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getStudentFormRegisterAction({ academicYearId: "ay1", classArmId: "ca1" });
    expect(result).toHaveProperty("error");
  });

  it("returns an error when result set exceeds 5000 rows", async () => {
    prismaMock.enrollment.count.mockResolvedValue(5001 as never);
    const result = await getStudentFormRegisterAction({ academicYearId: "ay1", classArmId: "ca1" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/too large/i);
  });

  it("clamps weeks and daysPerWeek to allowed range", async () => {
    prismaMock.enrollment.count.mockResolvedValue(0 as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);
    const result = await getStudentFormRegisterAction({
      academicYearId: "ay1", classArmId: "ca1", weeks: 99, daysPerWeek: 9,
    });
    expect(result).toHaveProperty("data");
    const data = (result as { data: { weeks: number; daysPerWeek: number } }).data;
    expect(data.weeks).toBeLessThanOrEqual(15);
    expect([5, 6, 7]).toContain(data.daysPerWeek);
  });

  it("requires classArmId", async () => {
    const result = await getStudentFormRegisterAction({ academicYearId: "ay1", classArmId: undefined as never });
    expect(result).toHaveProperty("error");
  });
});
```

- [ ] **Run, confirm fail**

### Step 2: Implement the action

`src/modules/reports/actions/student-form-register.action.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

const ROW_CAP = 5000;

export interface FormRegisterRow {
  row: number;
  studentId: string;
  fullName: string;
  gender: string;
}

export async function getStudentFormRegisterAction(filters: {
  academicYearId?: string;
  classArmId?: string;
  weeks?: number;
  daysPerWeek?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORTS_ENROLLMENT_READ);
  if (denied) return denied;

  if (!filters.classArmId) return { error: "Class arm is required for form master register." };

  let academicYearId = filters.academicYearId;
  if (!academicYearId) {
    const cur = await db.academicYear.findFirst({ where: { schoolId: ctx.schoolId, isCurrent: true } });
    academicYearId = cur?.id;
  }
  if (!academicYearId) return { error: "No academic year found." };

  const weeks = Math.min(15, Math.max(1, filters.weeks ?? 13));
  const daysPerWeek = ([5, 6, 7] as const).includes((filters.daysPerWeek ?? 5) as 5 | 6 | 7)
    ? (filters.daysPerWeek as 5 | 6 | 7) : 5;

  const count = await db.enrollment.count({
    where: { academicYearId, status: "ACTIVE", classArmId: filters.classArmId, classArm: { class: { schoolId: ctx.schoolId } } },
  });
  if (count > ROW_CAP) return { error: `Result set too large (${count} rows). Apply tighter filters.` };

  const enrollments = await db.enrollment.findMany({
    where: { academicYearId, status: "ACTIVE", classArmId: filters.classArmId, classArm: { class: { schoolId: ctx.schoolId } } },
    select: {
      student: {
        select: { studentId: true, firstName: true, lastName: true, otherNames: true, gender: true },
      },
    },
  });

  const rows: FormRegisterRow[] = enrollments
    .map((e) => ({
      row: 0,
      studentId: e.student.studentId,
      fullName: [e.student.lastName, e.student.firstName, e.student.otherNames].filter(Boolean).join(", "),
      gender: e.student.gender,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((r, i) => ({ ...r, row: i + 1 }));

  return { data: { rows, total: rows.length, weeks, daysPerWeek, classArmId: filters.classArmId, academicYearId } };
}
```

- [ ] **Run, confirm pass**

### Step 3: XLSX renderer + test

Append to `src/modules/reports/xlsx/student-reports.ts`:

```typescript
import type { FormRegisterRow } from "@/modules/reports/actions/student-form-register.action";

export function renderFormRegisterXlsx(input: {
  schoolName: string;
  filterSummary: string;
  generatedAt: Date;
  generatedBy: string;
  rows: FormRegisterRow[];
  weeks: number;
  daysPerWeek: number;
}): Buffer {
  // Build dynamic columns: # / ID / Name / Sex + W1D1, W1D2, ..., W{weeks}D{daysPerWeek}
  const baseCols = [
    { key: "row", header: "#" },
    { key: "studentId", header: "Student ID" },
    { key: "fullName", header: "Name" },
    { key: "gender", header: "Sex" },
  ];
  const tickCols: { key: string; header: string }[] = [];
  for (let w = 1; w <= input.weeks; w++) {
    for (let d = 1; d <= input.daysPerWeek; d++) {
      const k = `w${w}d${d}`;
      tickCols.push({ key: k, header: `W${w}D${d}` });
    }
  }
  // Augment data with empty tick fields so generateExport emits the columns
  const data = input.rows.map((r) => {
    const out: Record<string, unknown> = { ...r };
    for (const c of tickCols) out[c.key] = "";
    return out;
  });
  return generateExport({
    filename: "form-register",
    sheetName: "Form Register",
    format: "xlsx",
    columns: [...baseCols, ...tickCols],
    data,
  });
}
```

Append to xlsx test file:

```typescript
import { renderFormRegisterXlsx } from "@/modules/reports/xlsx/student-reports";

describe("renderFormRegisterXlsx", () => {
  it("emits weeks × daysPerWeek empty columns", () => {
    const buffer = renderFormRegisterXlsx({
      schoolName: "Demo SHS", filterSummary: "Form 2A",
      generatedAt: new Date(), generatedBy: "Admin",
      rows: [{ row: 1, studentId: "SCH/01", fullName: "Mensah, Adwoa", gender: "FEMALE" }],
      weeks: 2, daysPerWeek: 5,
    });
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const headers = (XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[]);
    expect(headers).toContain("W1D1");
    expect(headers).toContain("W2D5");
    expect(headers.includes("W3D1")).toBe(false);
  });
});
```

- [ ] **Run xlsx tests**

### Step 4: PDF template + smoke test

Append to PDF test file:

```typescript
import { StudentFormRegisterPdf } from "@/lib/pdf/templates/student-form-register";

describe("StudentFormRegisterPdf", () => {
  it("renders landscape buffer with grid", async () => {
    const buffer = await renderPdfToBuffer(
      React.createElement(StudentFormRegisterPdf, {
        schoolName: "Demo SHS", schoolMotto: null,
        title: "Form Master's Register", filterSummary: "Form 2A · Term 1",
        generatedAt: new Date(), generatedBy: "Admin",
        rows: [{ row: 1, studentId: "SCH/01", fullName: "Mensah, Adwoa", gender: "F" }],
        weeks: 2, daysPerWeek: 5,
      }),
    );
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
```

- [ ] **Run, confirm fail**

`src/lib/pdf/templates/student-form-register.tsx`:

```tsx
import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

export interface FormRegisterPdfRow {
  row: number; studentId: string; fullName: string; gender: string;
}

export interface FormRegisterPdfProps {
  schoolName: string;
  schoolMotto?: string | null;
  title: string;
  filterSummary: string;
  generatedAt: Date;
  generatedBy: string;
  rows: FormRegisterPdfRow[];
  weeks: number;
  daysPerWeek: number;
}

const STUDENTS_PER_PAGE = 25;

const styles = StyleSheet.create({
  page: { padding: 20, fontSize: 7, fontFamily: "Helvetica" },
  header: { alignItems: "center", borderBottom: "1px solid #1a1a1a", paddingBottom: 6, marginBottom: 8 },
  schoolName: { fontSize: 13, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  title: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 4 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6, fontSize: 7, color: "#444" },
  table: {},
  rowHead: { flexDirection: "row", borderBottom: "1px solid #888", backgroundColor: "#f3f3f3" },
  row: { flexDirection: "row", borderBottom: "1px solid #ccc" },
  cellNum: { width: 18, textAlign: "right", paddingRight: 2, paddingVertical: 2 },
  cellId: { width: 60, paddingVertical: 2 },
  cellName: { width: 130, paddingVertical: 2 },
  cellSex: { width: 18, textAlign: "center", paddingVertical: 2 },
  tickCell: { borderLeft: "1px solid #ccc", paddingVertical: 2, textAlign: "center" },
});

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function StudentFormRegisterPdf(props: FormRegisterPdfProps) {
  const { schoolName, title, filterSummary, generatedAt, generatedBy, rows, weeks, daysPerWeek } = props;
  const totalTickCols = weeks * daysPerWeek;
  const tickWidth = Math.max(14, Math.floor((760 - 240) / totalTickCols)); // landscape ~760pt usable
  const pages = chunk(rows.length ? rows : [{ row: 0, studentId: "", fullName: "(no students)", gender: "" }], STUDENTS_PER_PAGE);

  return (
    <Document>
      {pages.map((pageRows, pIdx) => (
        <Page key={pIdx} size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.schoolName}>{schoolName}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={styles.meta}>
            <Text>{filterSummary}  ·  {weeks} weeks × {daysPerWeek} days</Text>
            <Text>Generated {generatedAt.toISOString().slice(0, 10)} by {generatedBy}  ·  Page {pIdx + 1} / {pages.length}</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.rowHead}>
              <Text style={styles.cellNum}>#</Text>
              <Text style={styles.cellId}>ID</Text>
              <Text style={styles.cellName}>Name</Text>
              <Text style={styles.cellSex}>S</Text>
              {Array.from({ length: weeks }).flatMap((_, w) =>
                Array.from({ length: daysPerWeek }).map((__, d) => (
                  <Text key={`h${w}-${d}`} style={[styles.tickCell, { width: tickWidth }]}>W{w + 1}D{d + 1}</Text>
                )),
              )}
            </View>
            {pageRows.map((r) => (
              <View key={r.studentId || `ph-${r.row}`} style={styles.row}>
                <Text style={styles.cellNum}>{r.row || ""}</Text>
                <Text style={styles.cellId}>{r.studentId}</Text>
                <Text style={styles.cellName}>{r.fullName}</Text>
                <Text style={styles.cellSex}>{r.gender ? r.gender.charAt(0) : ""}</Text>
                {Array.from({ length: totalTickCols }).map((_, i) => (
                  <Text key={`t${i}`} style={[styles.tickCell, { width: tickWidth }]}> </Text>
                ))}
              </View>
            ))}
          </View>
        </Page>
      ))}
    </Document>
  );
}
```

- [ ] **Run, confirm pass**

### Step 5: Page + client + download routes

`src/app/(dashboard)/reports/students/form-register/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getReportFiltersAction } from "@/modules/reports/actions/report.action";
import { getStudentFormRegisterAction } from "@/modules/reports/actions/student-form-register.action";
import { FormRegisterClient } from "./form-register-client";

export default async function FormRegisterPage({ searchParams }: { searchParams: Promise<{ academicYearId?: string; classArmId?: string; weeks?: string; daysPerWeek?: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const sp = await searchParams;
  const weeks = sp.weeks ? Number(sp.weeks) : undefined;
  const daysPerWeek = sp.daysPerWeek ? Number(sp.daysPerWeek) : undefined;

  const [filtersR, reportR] = await Promise.all([
    getReportFiltersAction(),
    sp.classArmId
      ? getStudentFormRegisterAction({ academicYearId: sp.academicYearId, classArmId: sp.classArmId, weeks, daysPerWeek })
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Form Master's Register" description="Configurable attendance register grid." />
      <FormRegisterClient
        academicYears={"data" in filtersR ? filtersR.data.academicYears : []}
        classArms={"data" in filtersR ? filtersR.data.classArms : []}
        report={"data" in reportR ? (reportR as { data: { rows: unknown[]; total: number; weeks: number; daysPerWeek: number } | null }).data : null}
        error={"error" in reportR ? (reportR as { error: string }).error : null}
        appliedFilters={{ academicYearId: sp.academicYearId, classArmId: sp.classArmId, weeks: sp.weeks, daysPerWeek: sp.daysPerWeek }}
      />
    </div>
  );
}
```

`src/app/(dashboard)/reports/students/form-register/form-register-client.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface Row { row: number; studentId: string; fullName: string; gender: string; }

interface Props {
  academicYears: { id: string; name: string; isCurrent: boolean }[];
  classArms: { id: string; name: string; class?: { name: string } }[];
  report: { rows: Row[]; total: number; weeks: number; daysPerWeek: number } | null;
  error: string | null;
  appliedFilters: { academicYearId?: string; classArmId?: string; weeks?: string; daysPerWeek?: string };
}

export function FormRegisterClient({ academicYears, classArms, report, error, appliedFilters }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [yearId, setYearId] = useState(appliedFilters.academicYearId ?? "");
  const [classArmId, setClassArmId] = useState(appliedFilters.classArmId ?? "");
  const [weeks, setWeeks] = useState(appliedFilters.weeks ?? "13");
  const [daysPerWeek, setDaysPerWeek] = useState(appliedFilters.daysPerWeek ?? "5");

  function apply() {
    const next = new URLSearchParams(params);
    yearId ? next.set("academicYearId", yearId) : next.delete("academicYearId");
    classArmId ? next.set("classArmId", classArmId) : next.delete("classArmId");
    next.set("weeks", weeks);
    next.set("daysPerWeek", daysPerWeek);
    router.push(`?${next.toString()}`);
  }

  function downloadUrl(format: "xlsx" | "pdf") {
    const u = new URLSearchParams();
    if (appliedFilters.academicYearId) u.set("academicYearId", appliedFilters.academicYearId);
    if (appliedFilters.classArmId) u.set("classArmId", appliedFilters.classArmId);
    u.set("weeks", appliedFilters.weeks ?? "13");
    u.set("daysPerWeek", appliedFilters.daysPerWeek ?? "5");
    return `/api/reports/students/form-register/${format}?${u.toString()}`;
  }

  const empty = !report || report.rows.length === 0;
  const previewRows = (report?.rows ?? []).slice(0, 50);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <label className="text-sm">
          <div className="mb-1 font-medium">Academic Year</div>
          <select value={yearId} onChange={(e) => setYearId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">(Current)</option>
            {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">Class Arm <span className="text-red-500">*</span></div>
          <select value={classArmId} onChange={(e) => setClassArmId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">— Select —</option>
            {classArms.map((c) => <option key={c.id} value={c.id}>{c.class?.name ? `${c.class.name} ${c.name}` : c.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">Weeks</div>
          <input type="number" min={1} max={15} value={weeks} onChange={(e) => setWeeks(e.target.value)} className="w-20 rounded-md border px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">Days / week</div>
          <select value={daysPerWeek} onChange={(e) => setDaysPerWeek(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="5">5 (Mon–Fri)</option>
            <option value="6">6 (Mon–Sat)</option>
            <option value="7">7</option>
          </select>
        </label>
        <button onClick={apply} disabled={!classArmId} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">Apply</button>
        <div className="ml-auto flex gap-2">
          <a href={downloadUrl("xlsx")} aria-disabled={empty} className={`rounded-md border px-3 py-2 text-sm ${empty ? "pointer-events-none opacity-40" : ""}`}>Download XLSX</a>
          <a href={downloadUrl("pdf")} aria-disabled={empty} className={`rounded-md border px-3 py-2 text-sm ${empty ? "pointer-events-none opacity-40" : ""}`}>Download PDF</a>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {report && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm"><strong>{report.total}</strong> students  ·  {report.weeks} weeks × {report.daysPerWeek} days</p>
          {empty ? <p className="text-sm text-muted-foreground">No students in this class arm.</p> : (
            <table className="w-full text-sm">
              <thead className="border-b text-left"><tr><th className="py-2">#</th><th>Student ID</th><th>Name</th><th>Sex</th></tr></thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.studentId} className="border-b"><td className="py-1.5">{r.row}</td><td>{r.studentId}</td><td>{r.fullName}</td><td>{r.gender}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
```

`src/app/api/reports/students/form-register/xlsx/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentFormRegisterAction } from "@/modules/reports/actions/student-form-register.action";
import { renderFormRegisterXlsx } from "@/modules/reports/xlsx/student-reports";
import { auditReportDownload } from "@/modules/reports/audit-helpers";
import { getExportContentType } from "@/lib/export";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perms = session.user.permissions ?? [];
  if (!perms.includes("*") && !perms.includes(PERMISSIONS.REPORTS_ENROLLMENT_READ)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const academicYearId = sp.get("academicYearId") || undefined;
  const classArmId = sp.get("classArmId") || undefined;
  const weeks = sp.get("weeks") ? Number(sp.get("weeks")) : undefined;
  const daysPerWeek = sp.get("daysPerWeek") ? Number(sp.get("daysPerWeek")) : undefined;

  const result = await getStudentFormRegisterAction({ academicYearId, classArmId, weeks, daysPerWeek });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const buffer = renderFormRegisterXlsx({
    schoolName: session.user.schoolName ?? "School",
    filterSummary: `Class arm ${classArmId ?? ""}`,
    generatedAt: new Date(),
    generatedBy: session.user.name ?? "Unknown",
    rows: result.data!.rows,
    weeks: result.data!.weeks,
    daysPerWeek: result.data!.daysPerWeek,
  });

  await auditReportDownload({
    userId: session.user.id, schoolId: session.user.schoolId!,
    reportSlug: "STUDENT_FORM_REGISTER", reportName: "Form Master's Register",
    format: "xlsx", filters: { academicYearId, classArmId, weeks, daysPerWeek },
    rowCount: result.data!.total,
  });

  const filename = `form-register-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": getExportContentType("xlsx"), "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
```

`src/app/api/reports/students/form-register/pdf/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentFormRegisterAction } from "@/modules/reports/actions/student-form-register.action";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { StudentFormRegisterPdf } from "@/lib/pdf/templates/student-form-register";
import { auditReportDownload } from "@/modules/reports/audit-helpers";
import React from "react";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perms = session.user.permissions ?? [];
  if (!perms.includes("*") && !perms.includes(PERMISSIONS.REPORTS_ENROLLMENT_READ)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const academicYearId = sp.get("academicYearId") || undefined;
  const classArmId = sp.get("classArmId") || undefined;
  const weeks = sp.get("weeks") ? Number(sp.get("weeks")) : undefined;
  const daysPerWeek = sp.get("daysPerWeek") ? Number(sp.get("daysPerWeek")) : undefined;

  const result = await getStudentFormRegisterAction({ academicYearId, classArmId, weeks, daysPerWeek });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const school = await db.school.findUnique({
    where: { id: session.user.schoolId! }, select: { name: true, motto: true },
  });

  const buffer = await renderPdfToBuffer(
    React.createElement(StudentFormRegisterPdf, {
      schoolName: school?.name ?? session.user.schoolName ?? "School",
      schoolMotto: school?.motto ?? null,
      title: "Form Master's Register",
      filterSummary: `Class arm ${classArmId ?? ""}`,
      generatedAt: new Date(),
      generatedBy: session.user.name ?? "Unknown",
      rows: result.data!.rows,
      weeks: result.data!.weeks,
      daysPerWeek: result.data!.daysPerWeek,
    }),
  );

  await auditReportDownload({
    userId: session.user.id, schoolId: session.user.schoolId!,
    reportSlug: "STUDENT_FORM_REGISTER", reportName: "Form Master's Register",
    format: "pdf", filters: { academicYearId, classArmId, weeks, daysPerWeek },
    rowCount: result.data!.total,
  });

  const filename = `form-register-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
```

- [ ] **Step 6: Run all reports tests** — `npm test -- tests/unit/reports/`

- [ ] **Step 7: Commit**

```bash
git add src/modules/reports/actions/student-form-register.action.ts src/lib/pdf/templates/student-form-register.tsx src/modules/reports/xlsx/ src/app/\(dashboard\)/reports/students/form-register/ src/app/api/reports/students/form-register/ tests/unit/reports/student-form-register.test.ts tests/unit/reports/student-reports-xlsx.test.ts tests/unit/reports/student-reports-pdf.test.ts
git commit -m "feat(reports): form master's register (PDF + XLSX) with configurable weeks/days"
```

---

## Task 8: Birthday list report

XLSX-only. `month` and `upcomingDays` are mutually exclusive; default to current month if neither set. Optional guardian-phone column.

**Files:**
- Create: `src/modules/reports/actions/student-birthday-list.action.ts`
- Create: `src/app/(dashboard)/reports/students/birthdays/page.tsx` + `birthdays-client.tsx`
- Create: `src/app/api/reports/students/birthdays/xlsx/route.ts`
- Create: `tests/unit/reports/student-birthday-list.test.ts`
- Modify: `src/modules/reports/xlsx/student-reports.ts` (`renderBirthdayListXlsx`)
- Modify: `tests/unit/reports/student-reports-xlsx.test.ts`

### Step 1: Action — failing tests

`tests/unit/reports/student-birthday-list.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import { getStudentBirthdayListAction } from "@/modules/reports/actions/student-birthday-list.action";

describe("getStudentBirthdayListAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    prismaMock.academicYear.findFirst.mockResolvedValue({ id: "ay1", isCurrent: true } as never);
  });

  it("rejects callers without REPORTS_ENROLLMENT_READ", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getStudentBirthdayListAction({ month: 5 });
    expect(result).toHaveProperty("error");
  });

  it("returns an error when result set exceeds 5000 rows", async () => {
    prismaMock.enrollment.count.mockResolvedValue(5001 as never);
    const result = await getStudentBirthdayListAction({ month: 5 });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/too large/i);
  });

  it("rejects when both month and upcomingDays are set", async () => {
    const result = await getStudentBirthdayListAction({ month: 5, upcomingDays: 30 });
    expect(result).toHaveProperty("error");
  });

  it("returns students whose birthday is in the chosen month", async () => {
    prismaMock.enrollment.count.mockResolvedValue(2 as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      { student: { id: "s1", studentId: "S1", firstName: "May", lastName: "Born", otherNames: null, dateOfBirth: new Date("2008-05-10"), guardians: [] }, classArm: { class: { name: "Form 1" }, name: "A" } },
      { student: { id: "s2", studentId: "S2", firstName: "April", lastName: "Born", otherNames: null, dateOfBirth: new Date("2008-04-30"), guardians: [] }, classArm: { class: { name: "Form 1" }, name: "A" } },
    ] as never);

    const result = await getStudentBirthdayListAction({ month: 5 });
    expect(result).toHaveProperty("data");
    const rows = (result as { data: { rows: Array<Record<string, unknown>> } }).data.rows;
    expect(rows.length).toBe(1);
    expect(rows[0].studentId).toBe("S1");
  });

  it("treats Feb 29 students as Feb 28 in non-leap years for upcomingDays window", async () => {
    // Setup: clock is March 1 of a non-leap year; upcomingDays = 365
    prismaMock.enrollment.count.mockResolvedValue(1 as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      { student: { id: "s1", studentId: "S1", firstName: "Leap", lastName: "Year", otherNames: null, dateOfBirth: new Date("2008-02-29"), guardians: [] }, classArm: { class: { name: "Form 1" }, name: "A" } },
    ] as never);

    const result = await getStudentBirthdayListAction({ upcomingDays: 365 });
    expect(result).toHaveProperty("data");
    const rows = (result as { data: { rows: Array<Record<string, unknown>> } }).data.rows;
    expect(rows.length).toBe(1);
    expect(rows[0].dateOfBirth).toBeDefined();
  });
});
```

- [ ] **Run, confirm fail**

### Step 2: Implement the action

`src/modules/reports/actions/student-birthday-list.action.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

const ROW_CAP = 5000;

export interface BirthdayRow {
  studentId: string;
  name: string;
  className: string;
  dateOfBirth: Date;
  ageTurning: number;
  daysUntil?: number;
  primaryGuardianPhone?: string | null;
}

function isLeapYear(y: number) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

export async function getStudentBirthdayListAction(filters: {
  academicYearId?: string;
  classArmId?: string;
  month?: number;
  upcomingDays?: number;
  includeGuardianPhone?: boolean;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORTS_ENROLLMENT_READ);
  if (denied) return denied;

  if (filters.month != null && filters.upcomingDays != null) {
    return { error: "Use either month or upcomingDays, not both." };
  }

  let academicYearId = filters.academicYearId;
  if (!academicYearId) {
    const cur = await db.academicYear.findFirst({ where: { schoolId: ctx.schoolId, isCurrent: true } });
    academicYearId = cur?.id;
  }
  if (!academicYearId) return { error: "No academic year found." };

  const today = new Date();
  const todayY = today.getFullYear();
  const todayMonth = today.getMonth() + 1; // 1-12
  const month = filters.month ?? (filters.upcomingDays ? null : todayMonth);

  const where: Record<string, unknown> = {
    academicYearId,
    status: "ACTIVE",
    classArm: { class: { schoolId: ctx.schoolId } },
  };
  if (filters.classArmId) where.classArmId = filters.classArmId;

  const count = await db.enrollment.count({ where });
  if (count > ROW_CAP) return { error: `Result set too large (${count} rows). Apply tighter filters.` };

  const enrollments = await db.enrollment.findMany({
    where,
    select: {
      student: {
        select: {
          id: true, studentId: true, firstName: true, lastName: true, otherNames: true, dateOfBirth: true,
          guardians: filters.includeGuardianPhone ? { select: { isPrimary: true, guardian: { select: { phone: true } } } } : false,
        },
      },
      classArm: { select: { name: true, class: { select: { name: true } } } },
    },
  });

  function adjustedDob(d: Date, year: number) {
    const m = d.getMonth();
    const day = d.getDate();
    if (m === 1 && day === 29 && !isLeapYear(year)) {
      return new Date(year, 1, 28);
    }
    return new Date(year, m, day);
  }

  const rows: BirthdayRow[] = [];
  for (const e of enrollments) {
    const s = e.student;
    const dob = s.dateOfBirth;
    const dobMonth = dob.getMonth() + 1;

    let include = false;
    let daysUntil: number | undefined;

    if (month != null) {
      include = dobMonth === month;
    } else if (filters.upcomingDays != null) {
      const thisYear = adjustedDob(dob, todayY);
      const target = thisYear >= startOfDay(today) ? thisYear : adjustedDob(dob, todayY + 1);
      const diff = Math.ceil((target.getTime() - startOfDay(today).getTime()) / 86400000);
      if (diff >= 0 && diff <= filters.upcomingDays) {
        include = true;
        daysUntil = diff;
      }
    }
    if (!include) continue;

    const primary = filters.includeGuardianPhone
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? ((s as any).guardians?.find((g: { isPrimary: boolean }) => g.isPrimary) ?? (s as any).guardians?.[0] ?? null)
      : null;

    rows.push({
      studentId: s.studentId,
      name: [s.firstName, s.otherNames, s.lastName].filter(Boolean).join(" "),
      className: `${e.classArm.class.name} ${e.classArm.name}`,
      dateOfBirth: dob,
      ageTurning: todayY - dob.getFullYear(),
      daysUntil,
      primaryGuardianPhone: primary?.guardian?.phone ?? null,
    });
  }

  rows.sort((a, b) => {
    if (filters.upcomingDays != null) return (a.daysUntil ?? 9999) - (b.daysUntil ?? 9999);
    // Day of year ascending
    const ad = (a.dateOfBirth.getMonth() * 31) + a.dateOfBirth.getDate();
    const bd = (b.dateOfBirth.getMonth() * 31) + b.dateOfBirth.getDate();
    return ad - bd;
  });

  return { data: { rows, total: rows.length, mode: filters.upcomingDays != null ? "upcomingDays" : "month", appliedMonth: month, appliedUpcomingDays: filters.upcomingDays } };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
```

- [ ] **Run, confirm pass**

### Step 3: XLSX renderer + test

Append to `src/modules/reports/xlsx/student-reports.ts`:

```typescript
import type { BirthdayRow } from "@/modules/reports/actions/student-birthday-list.action";

export function renderBirthdayListXlsx(input: {
  schoolName: string;
  filterSummary: string;
  generatedAt: Date;
  generatedBy: string;
  rows: BirthdayRow[];
  includeGuardianPhone: boolean;
  mode: "month" | "upcomingDays";
}): Buffer {
  const cols = [
    { key: "studentId", header: "Student ID" },
    { key: "name", header: "Name" },
    { key: "className", header: "Class" },
    { key: "dateOfBirth", header: "DOB", transform: (v: unknown) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "") },
    { key: "ageTurning", header: "Age Turning" },
  ];
  if (input.mode === "upcomingDays") cols.push({ key: "daysUntil", header: "Days Until" });
  if (input.includeGuardianPhone) cols.push({ key: "primaryGuardianPhone", header: "Guardian Phone" });
  return generateExport({
    filename: "birthday-list", sheetName: "Birthdays", format: "xlsx",
    columns: cols,
    data: input.rows as unknown as Record<string, unknown>[],
  });
}
```

Append to xlsx test file:

```typescript
import { renderBirthdayListXlsx } from "@/modules/reports/xlsx/student-reports";

describe("renderBirthdayListXlsx", () => {
  it("includes Days Until only in upcomingDays mode", () => {
    const buffer = renderBirthdayListXlsx({
      schoolName: "Demo", filterSummary: "Next 30 days",
      generatedAt: new Date(), generatedBy: "A",
      rows: [{
        studentId: "S1", name: "Adwoa", className: "Form 1 A",
        dateOfBirth: new Date("2008-05-10"), ageTurning: 18, daysUntil: 10,
      }],
      includeGuardianPhone: false, mode: "upcomingDays",
    });
    const wb = XLSX.read(buffer, { type: "buffer" });
    const headers = (XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })[0] as string[]);
    expect(headers).toContain("Days Until");
    expect(headers.includes("Guardian Phone")).toBe(false);
  });
});
```

- [ ] **Run xlsx tests**

### Step 4: Page + client + download route

`src/app/(dashboard)/reports/students/birthdays/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getReportFiltersAction } from "@/modules/reports/actions/report.action";
import { getStudentBirthdayListAction } from "@/modules/reports/actions/student-birthday-list.action";
import { BirthdaysClient } from "./birthdays-client";

export default async function BirthdaysPage({ searchParams }: { searchParams: Promise<{ academicYearId?: string; classArmId?: string; month?: string; upcomingDays?: string; includeGuardianPhone?: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const sp = await searchParams;
  const month = sp.month ? Number(sp.month) : undefined;
  const upcomingDays = sp.upcomingDays ? Number(sp.upcomingDays) : undefined;
  const includeGuardianPhone = sp.includeGuardianPhone === "1";

  const [filtersR, reportR] = await Promise.all([
    getReportFiltersAction(),
    getStudentBirthdayListAction({
      academicYearId: sp.academicYearId, classArmId: sp.classArmId,
      month, upcomingDays, includeGuardianPhone,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Birthday List" description="Birthdays in a chosen month or upcoming N days." />
      <BirthdaysClient
        academicYears={"data" in filtersR ? filtersR.data.academicYears : []}
        classArms={"data" in filtersR ? filtersR.data.classArms : []}
        report={"data" in reportR ? reportR.data : null}
        error={"error" in reportR ? reportR.error : null}
        appliedFilters={{ academicYearId: sp.academicYearId, classArmId: sp.classArmId, month: sp.month, upcomingDays: sp.upcomingDays, includeGuardianPhone: sp.includeGuardianPhone }}
      />
    </div>
  );
}
```

`src/app/(dashboard)/reports/students/birthdays/birthdays-client.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface Props {
  academicYears: { id: string; name: string; isCurrent: boolean }[];
  classArms: { id: string; name: string; class?: { name: string } }[];
  report: { rows: Array<{ studentId: string; name: string; className: string; dateOfBirth: string | Date; ageTurning: number; daysUntil?: number; primaryGuardianPhone?: string | null }>; total: number; mode: string } | null;
  error: string | null;
  appliedFilters: { academicYearId?: string; classArmId?: string; month?: string; upcomingDays?: string; includeGuardianPhone?: string };
}

export function BirthdaysClient({ academicYears, classArms, report, error, appliedFilters }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [yearId, setYearId] = useState(appliedFilters.academicYearId ?? "");
  const [classArmId, setClassArmId] = useState(appliedFilters.classArmId ?? "");
  const [mode, setMode] = useState(appliedFilters.upcomingDays ? "upcoming" : "month");
  const [month, setMonth] = useState(appliedFilters.month ?? String(new Date().getMonth() + 1));
  const [upcomingDays, setUpcomingDays] = useState(appliedFilters.upcomingDays ?? "30");
  const [includeGuardianPhone, setIncludeGuardianPhone] = useState(appliedFilters.includeGuardianPhone === "1");

  function apply() {
    const next = new URLSearchParams();
    if (yearId) next.set("academicYearId", yearId);
    if (classArmId) next.set("classArmId", classArmId);
    if (mode === "month") { next.set("month", month); next.delete("upcomingDays"); }
    else { next.set("upcomingDays", upcomingDays); next.delete("month"); }
    if (includeGuardianPhone) next.set("includeGuardianPhone", "1");
    router.push(`?${next.toString()}`);
  }

  function downloadUrl() {
    const u = new URLSearchParams();
    if (appliedFilters.academicYearId) u.set("academicYearId", appliedFilters.academicYearId);
    if (appliedFilters.classArmId) u.set("classArmId", appliedFilters.classArmId);
    if (appliedFilters.month) u.set("month", appliedFilters.month);
    if (appliedFilters.upcomingDays) u.set("upcomingDays", appliedFilters.upcomingDays);
    if (appliedFilters.includeGuardianPhone) u.set("includeGuardianPhone", appliedFilters.includeGuardianPhone);
    return `/api/reports/students/birthdays/xlsx?${u.toString()}`;
  }

  const empty = !report || report.rows.length === 0;
  const previewRows = (report?.rows ?? []).slice(0, 50);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <label className="text-sm">
          <div className="mb-1 font-medium">Year</div>
          <select value={yearId} onChange={(e) => setYearId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">(Current)</option>
            {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">Class Arm</div>
          <select value={classArmId} onChange={(e) => setClassArmId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">All</option>
            {classArms.map((c) => <option key={c.id} value={c.id}>{c.class?.name ? `${c.class.name} ${c.name}` : c.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">Window</div>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="month">By month</option>
            <option value="upcoming">Upcoming N days</option>
          </select>
        </label>
        {mode === "month" ? (
          <label className="text-sm">
            <div className="mb-1 font-medium">Month</div>
            <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} className="w-20 rounded-md border px-3 py-2 text-sm" />
          </label>
        ) : (
          <label className="text-sm">
            <div className="mb-1 font-medium">Upcoming days</div>
            <input type="number" min={1} max={365} value={upcomingDays} onChange={(e) => setUpcomingDays(e.target.value)} className="w-24 rounded-md border px-3 py-2 text-sm" />
          </label>
        )}
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={includeGuardianPhone} onChange={(e) => setIncludeGuardianPhone(e.target.checked)} />
          Include guardian phone
        </label>
        <button onClick={apply} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Apply</button>
        <a href={downloadUrl()} aria-disabled={empty} className={`ml-auto rounded-md border px-3 py-2 text-sm ${empty ? "pointer-events-none opacity-40" : ""}`}>Download XLSX</a>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {report && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm"><strong>{report.total}</strong> birthdays match.</p>
          {empty ? <p className="text-sm text-muted-foreground">No birthdays match these filters.</p> : (
            <table className="w-full text-sm">
              <thead className="border-b text-left"><tr><th className="py-2">Student ID</th><th>Name</th><th>Class</th><th>DOB</th><th>Turning</th>{report.mode === "upcomingDays" && <th>Days</th>}{includeGuardianPhone && <th>Phone</th>}</tr></thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.studentId} className="border-b">
                    <td className="py-1.5">{r.studentId}</td><td>{r.name}</td><td>{r.className}</td>
                    <td>{r.dateOfBirth instanceof Date ? r.dateOfBirth.toISOString().slice(0, 10) : String(r.dateOfBirth).slice(0, 10)}</td>
                    <td>{r.ageTurning}</td>
                    {report.mode === "upcomingDays" && <td>{r.daysUntil}</td>}
                    {includeGuardianPhone && <td>{r.primaryGuardianPhone ?? "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
```

`src/app/api/reports/students/birthdays/xlsx/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentBirthdayListAction } from "@/modules/reports/actions/student-birthday-list.action";
import { renderBirthdayListXlsx } from "@/modules/reports/xlsx/student-reports";
import { auditReportDownload } from "@/modules/reports/audit-helpers";
import { getExportContentType } from "@/lib/export";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perms = session.user.permissions ?? [];
  if (!perms.includes("*") && !perms.includes(PERMISSIONS.REPORTS_ENROLLMENT_READ)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const academicYearId = sp.get("academicYearId") || undefined;
  const classArmId = sp.get("classArmId") || undefined;
  const month = sp.get("month") ? Number(sp.get("month")) : undefined;
  const upcomingDays = sp.get("upcomingDays") ? Number(sp.get("upcomingDays")) : undefined;
  const includeGuardianPhone = sp.get("includeGuardianPhone") === "1";

  const result = await getStudentBirthdayListAction({ academicYearId, classArmId, month, upcomingDays, includeGuardianPhone });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const data = result.data!;
  const buffer = renderBirthdayListXlsx({
    schoolName: session.user.schoolName ?? "School",
    filterSummary: data.mode === "month" ? `Month ${data.appliedMonth}` : `Next ${data.appliedUpcomingDays} days`,
    generatedAt: new Date(),
    generatedBy: session.user.name ?? "Unknown",
    rows: data.rows,
    includeGuardianPhone,
    mode: data.mode as "month" | "upcomingDays",
  });

  await auditReportDownload({
    userId: session.user.id, schoolId: session.user.schoolId!,
    reportSlug: "STUDENT_BIRTHDAYS", reportName: "Birthday List",
    format: "xlsx", filters: { academicYearId, classArmId, month, upcomingDays, includeGuardianPhone },
    rowCount: data.total,
  });

  const filename = `birthdays-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": getExportContentType("xlsx"), "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
```

- [ ] **Step 5: Run all reports tests** — `npm test -- tests/unit/reports/`

- [ ] **Step 6: Commit**

```bash
git add src/modules/reports/actions/student-birthday-list.action.ts src/modules/reports/xlsx/ src/app/\(dashboard\)/reports/students/birthdays/ src/app/api/reports/students/birthdays/ tests/unit/reports/student-birthday-list.test.ts tests/unit/reports/student-reports-xlsx.test.ts
git commit -m "feat(reports): birthday list (XLSX) with month / upcoming-days modes"
```

---

## Task 9: Missing-documents report

XLSX-only. For each active student, evaluate required `DocumentType` rows (filtered by `appliesTo` against student's `boardingStatus`); flag missing or expired.

**Files:**
- Create: `src/modules/reports/actions/student-missing-docs.action.ts`
- Create: `src/app/(dashboard)/reports/students/missing-documents/page.tsx` + `missing-documents-client.tsx`
- Create: `src/app/api/reports/students/missing-documents/xlsx/route.ts`
- Create: `tests/unit/reports/student-missing-docs.test.ts`
- Modify: `src/modules/reports/xlsx/student-reports.ts` (`renderMissingDocsXlsx`)
- Modify: `tests/unit/reports/student-reports-xlsx.test.ts`

### Step 1: Action — failing tests

`tests/unit/reports/student-missing-docs.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import { getStudentMissingDocsAction } from "@/modules/reports/actions/student-missing-docs.action";

describe("getStudentMissingDocsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    prismaMock.academicYear.findFirst.mockResolvedValue({ id: "ay1", isCurrent: true } as never);
  });

  it("rejects callers without REPORTS_ENROLLMENT_READ", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getStudentMissingDocsAction({});
    expect(result).toHaveProperty("error");
  });

  it("returns an error when result set exceeds 5000 rows", async () => {
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-1", name: "Birth Cert", isRequired: true, appliesTo: "ALL", expiryMonths: null, status: "ACTIVE", schoolId: "s1" },
    ] as never);
    prismaMock.enrollment.count.mockResolvedValue(5001 as never);
    const result = await getStudentMissingDocsAction({});
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/too large/i);
  });

  it("returns empty result when no required document types are configured", async () => {
    prismaMock.documentType.findMany.mockResolvedValue([] as never);
    const result = await getStudentMissingDocsAction({});
    expect(result).toHaveProperty("data");
    const data = (result as { data: { rows: unknown[]; note?: string } }).data;
    expect(data.rows).toEqual([]);
    expect(data.note).toContain("no required document types");
  });

  it("flags missing required documents for active students; respects appliesTo BOARDING_ONLY", async () => {
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-day", name: "Birth Certificate", isRequired: true, appliesTo: "ALL", expiryMonths: null, status: "ACTIVE", schoolId: "s1" },
      { id: "dt-board", name: "Boarding Medical", isRequired: true, appliesTo: "BOARDING_ONLY", expiryMonths: null, status: "ACTIVE", schoolId: "s1" },
    ] as never);
    prismaMock.enrollment.count.mockResolvedValue(2 as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      {
        student: {
          id: "s1", studentId: "S1", firstName: "A", lastName: "B", otherNames: null,
          boardingStatus: "DAY",
          studentDocuments: [],
        },
        classArm: { class: { name: "Form 1" }, name: "A" },
      },
      {
        student: {
          id: "s2", studentId: "S2", firstName: "C", lastName: "D", otherNames: null,
          boardingStatus: "BOARDING",
          studentDocuments: [{ documentTypeId: "dt-day", verificationStatus: "VERIFIED", expiresAt: null }],
        },
        classArm: { class: { name: "Form 1" }, name: "B" },
      },
    ] as never);

    const result = await getStudentMissingDocsAction({});
    expect(result).toHaveProperty("data");
    const rows = (result as { data: { rows: Array<{ studentId: string; missingTypes: string[] }> } }).data.rows;
    const day = rows.find((r) => r.studentId === "S1");
    const board = rows.find((r) => r.studentId === "S2");
    // DAY student: missing only Birth Certificate (ALL); not Boarding Medical
    expect(day!.missingTypes).toEqual(["Birth Certificate"]);
    // BOARDING student: only missing Boarding Medical
    expect(board!.missingTypes).toEqual(["Boarding Medical"]);
  });
});
```

- [ ] **Run, confirm fail**

### Step 2: Implement the action

`src/modules/reports/actions/student-missing-docs.action.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

const ROW_CAP = 5000;

export interface MissingDocsRow {
  studentId: string;
  name: string;
  className: string;
  missingTypes: string[];
  expiredTypes: { name: string; expiredOn: Date | null }[];
}

export async function getStudentMissingDocsAction(filters: {
  academicYearId?: string;
  classArmId?: string;
  documentTypeId?: string;
  includeExpired?: boolean;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORTS_ENROLLMENT_READ);
  if (denied) return denied;

  const includeExpired = filters.includeExpired ?? true;

  let academicYearId = filters.academicYearId;
  if (!academicYearId) {
    const cur = await db.academicYear.findFirst({ where: { schoolId: ctx.schoolId, isCurrent: true } });
    academicYearId = cur?.id;
  }
  if (!academicYearId) return { error: "No academic year found." };

  const docTypeWhere: Record<string, unknown> = {
    schoolId: ctx.schoolId,
    status: "ACTIVE",
    isRequired: true,
  };
  if (filters.documentTypeId) docTypeWhere.id = filters.documentTypeId;

  const requiredTypes = await db.documentType.findMany({
    where: docTypeWhere,
    select: { id: true, name: true, appliesTo: true, expiryMonths: true },
  });

  if (requiredTypes.length === 0) {
    return { data: { rows: [], total: 0, note: "no required document types configured" } };
  }

  const enrolWhere: Record<string, unknown> = {
    academicYearId, status: "ACTIVE", classArm: { class: { schoolId: ctx.schoolId } },
  };
  if (filters.classArmId) enrolWhere.classArmId = filters.classArmId;

  const count = await db.enrollment.count({ where: enrolWhere });
  if (count > ROW_CAP) return { error: `Result set too large (${count} rows). Apply tighter filters.` };

  const enrollments = await db.enrollment.findMany({
    where: enrolWhere,
    select: {
      student: {
        select: {
          id: true, studentId: true, firstName: true, lastName: true, otherNames: true,
          boardingStatus: true,
          studentDocuments: {
            select: { documentTypeId: true, verificationStatus: true, expiresAt: true },
          },
        },
      },
      classArm: { select: { name: true, class: { select: { name: true } } } },
    },
  });

  const now = new Date();
  const rows: MissingDocsRow[] = [];

  for (const e of enrollments) {
    const s = e.student;
    const applicable = requiredTypes.filter((t) => {
      if (t.appliesTo === "ALL") return true;
      if (t.appliesTo === "BOARDING_ONLY") return s.boardingStatus === "BOARDING";
      if (t.appliesTo === "DAY_ONLY") return s.boardingStatus === "DAY";
      return false;
    });

    const missing: string[] = [];
    const expired: { name: string; expiredOn: Date | null }[] = [];

    for (const t of applicable) {
      const docs = s.studentDocuments.filter((d) => d.documentTypeId === t.id);
      const verified = docs.filter((d) => d.verificationStatus === "VERIFIED");
      if (verified.length === 0) {
        missing.push(t.name);
        continue;
      }
      if (includeExpired) {
        const allExpired = verified.every((d) => d.expiresAt && d.expiresAt < now);
        if (allExpired && verified[0]?.expiresAt) {
          expired.push({ name: t.name, expiredOn: verified[0].expiresAt });
        }
      }
    }

    if (missing.length === 0 && expired.length === 0) continue;

    rows.push({
      studentId: s.studentId,
      name: [s.firstName, s.otherNames, s.lastName].filter(Boolean).join(" "),
      className: `${e.classArm.class.name} ${e.classArm.name}`,
      missingTypes: missing,
      expiredTypes: expired,
    });
  }

  rows.sort((a, b) => (b.missingTypes.length + b.expiredTypes.length) - (a.missingTypes.length + a.expiredTypes.length));
  return { data: { rows, total: rows.length } };
}
```

- [ ] **Run, confirm pass**

### Step 3: XLSX renderer + test

Append to `src/modules/reports/xlsx/student-reports.ts`:

```typescript
import type { MissingDocsRow } from "@/modules/reports/actions/student-missing-docs.action";

export function renderMissingDocsXlsx(input: {
  schoolName: string;
  filterSummary: string;
  generatedAt: Date;
  generatedBy: string;
  rows: MissingDocsRow[];
}): Buffer {
  return generateExport({
    filename: "missing-documents", sheetName: "Missing", format: "xlsx",
    columns: [
      { key: "studentId", header: "Student ID" },
      { key: "name", header: "Name" },
      { key: "className", header: "Class" },
      { key: "missingTypes", header: "Missing", transform: (v) => Array.isArray(v) ? v.join(", ") : "" },
      { key: "expiredTypes", header: "Expired", transform: (v) => Array.isArray(v) ? (v as Array<{ name: string; expiredOn: Date | null }>).map((e) => `${e.name} (${e.expiredOn ? e.expiredOn.toISOString().slice(0, 10) : "?"})`).join(", ") : "" },
    ],
    data: input.rows as unknown as Record<string, unknown>[],
  });
}
```

Append to xlsx test file:

```typescript
import { renderMissingDocsXlsx } from "@/modules/reports/xlsx/student-reports";

describe("renderMissingDocsXlsx", () => {
  it("joins missing/expired arrays into comma strings", () => {
    const buffer = renderMissingDocsXlsx({
      schoolName: "Demo", filterSummary: "Form 1A",
      generatedAt: new Date(), generatedBy: "A",
      rows: [{
        studentId: "S1", name: "Adwoa", className: "Form 1 A",
        missingTypes: ["Birth Certificate", "Photo"],
        expiredTypes: [{ name: "Medical", expiredOn: new Date("2025-12-31") }],
      }],
    });
    const wb = XLSX.read(buffer, { type: "buffer" });
    const r = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]])[0];
    expect(r["Missing"]).toContain("Birth Certificate, Photo");
    expect(r["Expired"]).toContain("Medical");
    expect(r["Expired"]).toContain("2025-12-31");
  });
});
```

- [ ] **Run xlsx tests**

### Step 4: Page + client + download route

`src/app/(dashboard)/reports/students/missing-documents/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/lib/db";
import { getReportFiltersAction } from "@/modules/reports/actions/report.action";
import { getStudentMissingDocsAction } from "@/modules/reports/actions/student-missing-docs.action";
import { MissingDocumentsClient } from "./missing-documents-client";

export default async function MissingDocumentsPage({ searchParams }: { searchParams: Promise<{ academicYearId?: string; classArmId?: string; documentTypeId?: string; includeExpired?: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const sp = await searchParams;
  const includeExpired = sp.includeExpired !== "0";

  const [filtersR, docTypes, reportR] = await Promise.all([
    getReportFiltersAction(),
    db.documentType.findMany({
      where: { schoolId: session.user.schoolId!, isRequired: true, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getStudentMissingDocsAction({
      academicYearId: sp.academicYearId, classArmId: sp.classArmId,
      documentTypeId: sp.documentTypeId, includeExpired,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Missing Documents" description="Active students missing or expired on required documents." />
      <MissingDocumentsClient
        academicYears={"data" in filtersR ? filtersR.data.academicYears : []}
        classArms={"data" in filtersR ? filtersR.data.classArms : []}
        documentTypes={docTypes}
        report={"data" in reportR ? reportR.data : null}
        error={"error" in reportR ? reportR.error : null}
        appliedFilters={{ academicYearId: sp.academicYearId, classArmId: sp.classArmId, documentTypeId: sp.documentTypeId, includeExpired: sp.includeExpired }}
      />
    </div>
  );
}
```

`src/app/(dashboard)/reports/students/missing-documents/missing-documents-client.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface Row { studentId: string; name: string; className: string; missingTypes: string[]; expiredTypes: { name: string; expiredOn: Date | string | null }[]; }

interface Props {
  academicYears: { id: string; name: string; isCurrent: boolean }[];
  classArms: { id: string; name: string; class?: { name: string } }[];
  documentTypes: { id: string; name: string }[];
  report: { rows: Row[]; total: number; note?: string } | null;
  error: string | null;
  appliedFilters: { academicYearId?: string; classArmId?: string; documentTypeId?: string; includeExpired?: string };
}

export function MissingDocumentsClient({ academicYears, classArms, documentTypes, report, error, appliedFilters }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [yearId, setYearId] = useState(appliedFilters.academicYearId ?? "");
  const [classArmId, setClassArmId] = useState(appliedFilters.classArmId ?? "");
  const [documentTypeId, setDocumentTypeId] = useState(appliedFilters.documentTypeId ?? "");
  const [includeExpired, setIncludeExpired] = useState(appliedFilters.includeExpired !== "0");

  function apply() {
    const next = new URLSearchParams(params);
    yearId ? next.set("academicYearId", yearId) : next.delete("academicYearId");
    classArmId ? next.set("classArmId", classArmId) : next.delete("classArmId");
    documentTypeId ? next.set("documentTypeId", documentTypeId) : next.delete("documentTypeId");
    next.set("includeExpired", includeExpired ? "1" : "0");
    router.push(`?${next.toString()}`);
  }

  function downloadUrl() {
    const u = new URLSearchParams();
    if (appliedFilters.academicYearId) u.set("academicYearId", appliedFilters.academicYearId);
    if (appliedFilters.classArmId) u.set("classArmId", appliedFilters.classArmId);
    if (appliedFilters.documentTypeId) u.set("documentTypeId", appliedFilters.documentTypeId);
    if (appliedFilters.includeExpired) u.set("includeExpired", appliedFilters.includeExpired);
    return `/api/reports/students/missing-documents/xlsx?${u.toString()}`;
  }

  const empty = !report || report.rows.length === 0;
  const previewRows = (report?.rows ?? []).slice(0, 50);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <label className="text-sm">
          <div className="mb-1 font-medium">Year</div>
          <select value={yearId} onChange={(e) => setYearId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">(Current)</option>
            {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">Class Arm</div>
          <select value={classArmId} onChange={(e) => setClassArmId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">All</option>
            {classArms.map((c) => <option key={c.id} value={c.id}>{c.class?.name ? `${c.class.name} ${c.name}` : c.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">Document Type</div>
          <select value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">All required</option>
            {documentTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={includeExpired} onChange={(e) => setIncludeExpired(e.target.checked)} />
          Include expired
        </label>
        <button onClick={apply} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Apply</button>
        <a href={downloadUrl()} aria-disabled={empty} className={`ml-auto rounded-md border px-3 py-2 text-sm ${empty ? "pointer-events-none opacity-40" : ""}`}>Download XLSX</a>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {report?.note && <p className="text-sm text-muted-foreground">{report.note}</p>}
      {report && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm"><strong>{report.total}</strong> students with gaps.</p>
          {empty ? <p className="text-sm text-muted-foreground">No students with missing or expired documents.</p> : (
            <table className="w-full text-sm">
              <thead className="border-b text-left"><tr><th className="py-2">Student ID</th><th>Name</th><th>Class</th><th>Missing</th><th>Expired</th></tr></thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.studentId} className="border-b">
                    <td className="py-1.5">{r.studentId}</td>
                    <td>{r.name}</td>
                    <td>{r.className}</td>
                    <td>{r.missingTypes.join(", ")}</td>
                    <td>{r.expiredTypes.map((e) => `${e.name}${e.expiredOn ? ` (${typeof e.expiredOn === "string" ? e.expiredOn.slice(0,10) : e.expiredOn.toISOString().slice(0,10)})` : ""}`).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
```

`src/app/api/reports/students/missing-documents/xlsx/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentMissingDocsAction } from "@/modules/reports/actions/student-missing-docs.action";
import { renderMissingDocsXlsx } from "@/modules/reports/xlsx/student-reports";
import { auditReportDownload } from "@/modules/reports/audit-helpers";
import { getExportContentType } from "@/lib/export";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perms = session.user.permissions ?? [];
  if (!perms.includes("*") && !perms.includes(PERMISSIONS.REPORTS_ENROLLMENT_READ)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const academicYearId = sp.get("academicYearId") || undefined;
  const classArmId = sp.get("classArmId") || undefined;
  const documentTypeId = sp.get("documentTypeId") || undefined;
  const includeExpired = sp.get("includeExpired") !== "0";

  const result = await getStudentMissingDocsAction({ academicYearId, classArmId, documentTypeId, includeExpired });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const buffer = renderMissingDocsXlsx({
    schoolName: session.user.schoolName ?? "School",
    filterSummary: documentTypeId ? `Single document type` : "All required types",
    generatedAt: new Date(),
    generatedBy: session.user.name ?? "Unknown",
    rows: result.data!.rows,
  });

  await auditReportDownload({
    userId: session.user.id, schoolId: session.user.schoolId!,
    reportSlug: "STUDENT_MISSING_DOCS", reportName: "Missing Documents",
    format: "xlsx", filters: { academicYearId, classArmId, documentTypeId, includeExpired },
    rowCount: result.data!.total,
  });

  const filename = `missing-documents-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": getExportContentType("xlsx"), "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
```

- [ ] **Step 5: Run all reports tests** — `npm test -- tests/unit/reports/`

- [ ] **Step 6: Commit**

```bash
git add src/modules/reports/actions/student-missing-docs.action.ts src/modules/reports/xlsx/ src/app/\(dashboard\)/reports/students/missing-documents/ src/app/api/reports/students/missing-documents/ tests/unit/reports/student-missing-docs.test.ts tests/unit/reports/student-reports-xlsx.test.ts
git commit -m "feat(reports): missing-documents list (XLSX) with appliesTo + expiry handling"
```

---

## Task 10: Master-list "Reports" deep link

Add a "Reports" button to the existing students master page.

**Files:**
- Modify: `src/app/(dashboard)/students/students-client.tsx`

- [ ] **Step 1: Locate the toolbar in `students-client.tsx`**

Open the file and find the page-header / toolbar block. It typically has a "New Student" or import button near the top of the rendered JSX.

- [ ] **Step 2: Add a Reports link button next to the existing toolbar buttons**

Add this button (using the project's existing button styling — match a sibling button next to it):

```tsx
<Link
  href="/reports/students"
  className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
>
  Reports
</Link>
```

If the file doesn't already import `Link`, add `import Link from "next/link";` at the top.

- [ ] **Step 3: Smoke check**

```bash
npm run typecheck 2>&1 | tail -10
```

Expected: no new TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/students/students-client.tsx
git commit -m "feat(students): link 'Reports' button to /reports/students"
```

---

## Task 11: Live-DB integration test for the roster XLSX download

End-to-end coverage of one representative route (proves the action → renderer → route → audit chain). Mirrors the `describeIfDb` + `loginAs` pattern from `tests/integration/students/`.

**Files:**
- Create: `tests/integration/reports/student-report-downloads.test.ts`

- [ ] **Step 1: Reuse the shared test setup**

The existing helpers live at `tests/integration/students/setup.ts` (`loginAs`, queue / cache mocks). Import directly — no new setup file needed.

- [ ] **Step 2: Write the integration test**

`tests/integration/reports/student-report-downloads.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { loginAs } from "../students/setup";
import { GET as rosterXlsxGET } from "@/app/api/reports/students/roster/xlsx/route";
import { NextRequest } from "next/server";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Student report downloads (integration)", () => {
  const db = new PrismaClient();
  const tag = `report-dl-${Date.now()}`;

  let yearId = "";
  let programmeId = "";
  let classId = "";
  let armId = "";
  let stu1Id = "";
  let stu2Id = "";
  let enrol1Id = "";
  let enrol2Id = "";
  const SCHOOL_ID = "default-school";
  const USER_ID = "integration-test-user";

  beforeAll(async () => {
    // Ensure the seeded user exists; auth mock returns a fixed id, the DB needs to know it.
    const user = await db.user.findFirst({ where: { id: USER_ID } }).catch(() => null);
    if (!user) {
      await db.user.create({
        data: {
          id: USER_ID, email: `${tag}@example.com`, name: "Integration Test",
          passwordHash: "x", schoolId: SCHOOL_ID,
        },
      }).catch(() => {});
    }

    const year = await db.academicYear.create({
      data: { schoolId: SCHOOL_ID, name: `${tag}-year`, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), isCurrent: false },
    });
    yearId = year.id;

    const programme = await db.programme.create({
      data: { schoolId: SCHOOL_ID, name: `${tag}-prog`, code: `${tag}-P` },
    });
    programmeId = programme.id;

    const cls = await db.class.create({
      data: { schoolId: SCHOOL_ID, name: `${tag}-class`, programmeId, academicYearId: yearId, level: 1 },
    });
    classId = cls.id;

    const arm = await db.classArm.create({
      data: { classId, name: "A", status: "ACTIVE" },
    });
    armId = arm.id;

    const s1 = await db.student.create({
      data: { schoolId: SCHOOL_ID, studentId: `${tag}-S1`, firstName: "Adwoa", lastName: "Mensah", dateOfBirth: new Date("2010-05-10"), gender: "FEMALE", boardingStatus: "DAY", status: "ACTIVE" },
    });
    stu1Id = s1.id;
    const s2 = await db.student.create({
      data: { schoolId: SCHOOL_ID, studentId: `${tag}-S2`, firstName: "Kwame", lastName: "Boateng", dateOfBirth: new Date("2010-04-01"), gender: "MALE", boardingStatus: "BOARDING", status: "ACTIVE" },
    });
    stu2Id = s2.id;

    const e1 = await db.enrollment.create({
      data: { schoolId: SCHOOL_ID, studentId: stu1Id, classArmId: armId, academicYearId: yearId, status: "ACTIVE" },
    });
    enrol1Id = e1.id;
    const e2 = await db.enrollment.create({
      data: { schoolId: SCHOOL_ID, studentId: stu2Id, classArmId: armId, academicYearId: yearId, status: "ACTIVE" },
    });
    enrol2Id = e2.id;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { entity: "STUDENT_ROSTER", userId: USER_ID } }).catch(() => {});
    await db.enrollment.deleteMany({ where: { id: { in: [enrol1Id, enrol2Id].filter(Boolean) } } }).catch(() => {});
    await db.student.deleteMany({ where: { id: { in: [stu1Id, stu2Id].filter(Boolean) } } }).catch(() => {});
    await db.classArm.deleteMany({ where: { id: armId } }).catch(() => {});
    await db.class.deleteMany({ where: { id: classId } }).catch(() => {});
    await db.programme.deleteMany({ where: { id: programmeId } }).catch(() => {});
    await db.academicYear.deleteMany({ where: { id: yearId } }).catch(() => {});
    await db.$disconnect();
  });

  it("returns an XLSX with content-disposition and writes one EXPORT audit row", async () => {
    loginAs();

    const req = new NextRequest(
      `http://localhost/api/reports/students/roster/xlsx?academicYearId=${yearId}&classArmId=${armId}`,
    );
    const res = await rosterXlsxGET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment; filename=/);

    const buf = Buffer.from(await res.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]]);
    expect(rows.length).toBe(2);

    const audits = await db.auditLog.findMany({
      where: { entity: "STUDENT_ROSTER", userId: USER_ID, action: "EXPORT" },
      orderBy: { timestamp: "desc" },
      take: 5,
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
    const meta = audits[0].metadata as Record<string, unknown> | null;
    expect(meta?.format).toBe("xlsx");
    expect((meta?.filters as { academicYearId?: string }).academicYearId).toBe(yearId);
  });

  it("rejects callers without REPORTS_ENROLLMENT_READ", async () => {
    loginAs({ permissions: [], roles: ["nobody"] });
    const req = new NextRequest(
      `http://localhost/api/reports/students/roster/xlsx?academicYearId=${yearId}&classArmId=${armId}`,
    );
    const res = await rosterXlsxGET(req);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 3: Run the integration test**

```bash
npm test -- tests/integration/reports/student-report-downloads.test.ts
```

Expected: if `DATABASE_URL` is set, both tests pass; otherwise, the `describeIfDb` skips them cleanly.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/reports/student-report-downloads.test.ts
git commit -m "test(reports): live-DB integration test for roster XLSX download"
```

---

## Task 12: Final integration verification + PR

- [ ] **Step 1: Full test sweep**

```bash
npm test -- tests/unit/reports/ tests/integration/reports/
```

Expected: all green.

- [ ] **Step 2: Type check the full project**

```bash
npm run typecheck 2>&1 | tail -30
```

Expected: no new errors.

- [ ] **Step 3: Browser verification (preview workflow)**

Start the dev server (`npm run dev`) and walk all six reports manually:

1. Navigate to `/students` → click "Reports" → confirm hub renders 6 cards.
2. Open each report page via the hub:
   - Apply at least one filter combination per report.
   - Confirm the URL updates (bookmarkable).
   - Confirm preview reflects filters.
   - Click each download button. Open the resulting file:
     - **XLSX:** check headers, that filter applied, that data matches preview.
     - **PDF (roster, nominal roll, form-register):** check letterhead, totals (roster), surname uppercase (nominal roll), grid renders for `weeks=15, daysPerWeek=7` (form-register).
3. Re-render the form-register with `weeks=15, daysPerWeek=7`; confirm pagination still works for >25 students.
4. As a second-school user (separate auth session), confirm school A students do NOT appear in any report.
5. After several downloads, query `AuditLog` rows with `action='EXPORT'` and `module='reports'`; confirm one row per download with the expected metadata.

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin feat/student-reporting-suite
gh pr create --title "feat(reports): student reporting suite (Tier 3 #9)" --body "$(cat <<'EOF'
## Summary
- Adds 6 canonical student reports under /reports/students hub: roster, census, nominal roll, form master register, birthday list, missing documents
- PDF + XLSX for printable/sign-able reports (roster, nominal roll, form register); XLSX-only for working-data reports (census, birthday list, missing docs)
- Bookmarkable URL filters per report; first-50-row preview + total badge; audit log row per download

## Test plan
- [ ] All unit tests green: `npm test -- tests/unit/reports/`
- [ ] Integration test for roster XLSX download (action → renderer → route → audit) green
- [ ] Manual browser walkthrough of all 6 reports including PDF visual inspection
- [ ] Cross-school isolation verified (school A user can't see school B students)
- [ ] AuditLog rows present after each download with action=EXPORT, module=reports

Closes Tier 3 #9 from `docs/superpowers/specs/2026-04-30-student-reporting-suite-design.md`.
EOF
)"
```

---
