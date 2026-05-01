# Student Reporting Suite

**Date:** 2026-04-30
**Tier 3 #9** of the Students-module feature-depth review.

**Depends on:** existing `src/modules/reports/` infrastructure, `src/lib/export/index.ts` (XLSX), `src/lib/pdf/templates/` (react-pdf), `src/lib/audit.ts`, `StudentDocument` + `DocumentType` schema (Tier 1 #2 already merged).

## 1. Summary

Adds a canonical set of six student-centric reports under a new hub at `/reports/students`, with a discovery card on the existing `/students` master list. Each report has its own focused page with filters, a paginated preview, and download controls. Outputs differentiate by use: rosters, nominal rolls, and form master registers print to PDF *and* XLSX; census, birthday list, and missing-documents export XLSX only.

This converts a partially-built student register (`student-report.action.ts` already returns roster data) into the canonical reporting surface schools rely on for inspections, returns to the Ministry of Education, pastoral care, and registrar follow-ups.

## 2. Goals & non-goals

**Goals**
- Six reports addressable by URL with bookmarkable filter state (`?academicYearId=…&classArmId=…`).
- One server action per report, returning normalized data; same action drives both preview and download paths.
- PDF + XLSX for print-and-sign reports (roster, nominal roll, form master register); XLSX-only for working-data reports (census, birthday list, missing-documents).
- Strict tenant isolation; permission gate on every action.
- Audit log entry on every download (not on page view).
- Hard cap of 5,000 result rows on per-student reports — over-cap returns an error suggesting tighter filters.

**Non-goals**
- Saved presets / user-named filter combinations (URL bookmarks suffice).
- Scheduled email delivery.
- CSV format (XLSX is a strict superset for users who want a spreadsheet).
- Per-column visibility toggles in the UI.
- Inline edit-in-preview.
- Historical-snapshot reports (data is always live).
- Internationalization of report titles / column headers.

## 3. User decisions (recorded from brainstorming)

| Q | Decision |
|---|---|
| Q1 — Scope | All six reports: roster, census, nominal roll, form master register, birthday list, missing-documents |
| Q2 — Placement | C — primary at `/reports/students/*`, plus a "Reports" button on `/students` master |
| Q3 — Formats | C — differentiated: PDF+XLSX for roster / nominal roll / form master register; XLSX-only for census / birthday list / missing-documents |
| Q4 — Filter UX | C — hub index page with 6 cards, dedicated per-report page on click |
| Q5 — Filter persistence | B — URL-encoded query params; no `ReportPreset` table |
| Configurable knobs | Form master register: `weeks` (1–15) + `daysPerWeek` (5/6/7); birthday list: `includeGuardianPhone` toggle |

## 4. Architecture

### 4.1 New / extended module: `src/modules/reports/`

Per-report server action files (mirrors existing `student-report.action.ts` pattern):

- `actions/student-report.action.ts` — **existing**, extends to accept output-format flag and produce roster XLSX/PDF
- `actions/student-census.action.ts` — new
- `actions/student-nominal-roll.action.ts` — new
- `actions/student-form-register.action.ts` — new
- `actions/student-birthday-list.action.ts` — new
- `actions/student-missing-docs.action.ts` — new

Output renderers:

- `xlsx/student-reports.ts` — six exported functions `renderRosterXlsx`, `renderCensusXlsx`, `renderNominalRollXlsx`, `renderFormRegisterXlsx`, `renderBirthdayListXlsx`, `renderMissingDocsXlsx`. Each takes the corresponding action's normalized data and returns a `Buffer`. Uses `src/lib/export/index.ts` `generateExport()`.
- `src/lib/pdf/templates/roster.tsx` — react-pdf, A4 portrait, school letterhead, totals + signature block
- `src/lib/pdf/templates/nominal-roll.tsx` — react-pdf, A4 portrait, surnames uppercased
- `src/lib/pdf/templates/form-master-register.tsx` — react-pdf, A4 landscape, `weeks × daysPerWeek` empty grid, ~25 students per page

### 4.2 New routes

Discovery + preview pages:

- `src/app/(dashboard)/reports/students/page.tsx` + `students-reports-client.tsx` — index with 6 cards
- `src/app/(dashboard)/reports/students/roster/page.tsx` + client
- `src/app/(dashboard)/reports/students/census/page.tsx` + client
- `src/app/(dashboard)/reports/students/nominal-roll/page.tsx` + client
- `src/app/(dashboard)/reports/students/form-register/page.tsx` + client
- `src/app/(dashboard)/reports/students/birthdays/page.tsx` + client
- `src/app/(dashboard)/reports/students/missing-documents/page.tsx` + client

Per-page server component reads `searchParams`, calls the action, renders preview table (first 50 rows + total count) plus download buttons. Filter form is a client component using `useRouter().push()` to update URL params.

Download routes (binary streaming — server actions can't stream cleanly):

- `src/app/api/reports/students/roster/xlsx/route.ts`
- `src/app/api/reports/students/roster/pdf/route.ts`
- `src/app/api/reports/students/census/xlsx/route.ts`
- `src/app/api/reports/students/nominal-roll/xlsx/route.ts`
- `src/app/api/reports/students/nominal-roll/pdf/route.ts`
- `src/app/api/reports/students/form-register/xlsx/route.ts`
- `src/app/api/reports/students/form-register/pdf/route.ts`
- `src/app/api/reports/students/birthdays/xlsx/route.ts`
- `src/app/api/reports/students/missing-documents/xlsx/route.ts`

Each handler: parse query params → re-check permission → call shared action → invoke renderer → return `Response` with `Content-Type` and `Content-Disposition: attachment; filename=<school-slug>-<report>-<filter-summary>-<YYYYMMDD>.<ext>`. Writes one `AuditLog` entry via `audit()` from `src/lib/audit.ts`: `action: AuditAction.EXPORT`, `entity: "<REPORT_SLUG>"` (e.g. `STUDENT_ROSTER`), `module: "reports"`, `metadata: { format, filters, rowCount }`.

### 4.3 Master-list deep link

`src/app/(dashboard)/students/students-client.tsx` — add a "Reports" button to the page-header toolbar, links to `/reports/students`. No filter state passes through (the hub page does not pre-filter).

## 5. Per-report data shapes

All actions assert `requireSchoolContext` and the appropriate report-view permission (matching the pattern used by sibling reports under `/reports/`). All filter active students by default (`student.status = ACTIVE`, `enrollment.status = ACTIVE`).

### 5.1 Class roster (extends existing)
- **Filters**: `academicYearId` (default: current), `classArmId` (optional → all arms in year)
- **Returns**: list of `{ id, studentId, name, className, gender, boardingStatus, status }` plus aggregates `{ totalStudents, genderDistribution, boardingBreakdown, statusBreakdown }`
- **Sort**: lastName ascending
- **Formats**: PDF + XLSX
- **Note**: existing `getStudentRegisterReportAction` is reused; format-flag branching is added inline; new react-pdf template

### 5.2 Student census
- **Filters**: `academicYearId` (default: current), `groupBy` ∈ `class | programme | region | gender | boarding | religion`
- **Returns**: aggregate rows `{ groupKey, groupLabel, total, male, female, day, boarding }`
- **Format**: XLSX only
- **Implementation**: single `groupBy` Prisma query; no per-student fetch; row cap does not apply

### 5.3 Nominal roll
- **Filters**: `academicYearId` (required), `classArmId` (required — single arm)
- **Returns**: `{ row, studentId, surname, otherNames, gender, dateOfBirth, primaryGuardianPhone }`
- **Sort**: alphabetical by surname (Ghanaian convention)
- **Formats**: PDF + XLSX
- **Surname rendering**: uppercased in PDF; raw case in XLSX (so users can re-sort/filter)

### 5.4 Form master's register
- **Filters**: `academicYearId` (required), `classArmId` (required), `weeks` (1–15, default 13), `daysPerWeek` (5/6/7, default 5)
- **Returns**: same student list as nominal roll, with empty grid metadata `{ weeks, daysPerWeek }`
- **Formats**: PDF (A4 landscape) + XLSX
- **PDF layout**: left columns `#, ID, Name, Sex`; right side `weeks × daysPerWeek` empty cells for tick marks; column headers repeat on each page; ~25 students per page

### 5.5 Birthday list
- **Filters**: `academicYearId` (default: current), `classArmId` (optional), `month` (1–12, optional), `upcomingDays` (1–365, optional), `includeGuardianPhone` (bool, default false)
- **Validation**: `month` and `upcomingDays` are mutually exclusive; if neither is set, default to current month
- **Returns**: `{ studentId, name, className, dateOfBirth, ageTurning, daysUntil? }` — `daysUntil` only populated when `upcomingDays` was set
- **Sort**: by `daysUntil` ascending when `upcomingDays` is set; otherwise by day-of-year ascending (Jan 1 → Dec 31)
- **Format**: XLSX only
- **Leap-year handling**: students born Feb 29 are matched against Feb 28 in non-leap years
- **Optional column**: `primaryGuardianPhone` appears only when `includeGuardianPhone=true`

### 5.6 Missing-documents list
- **Filters**: `academicYearId` (default: current), `classArmId` (optional), `documentTypeId` (optional → all required types), `includeExpired` (bool, default true)
- **Returns**: `{ studentId, name, className, missingTypes[], expiredTypes[] }`
- **Logic**: for each active student, cross-check against `DocumentType where isRequired=true AND status=ACTIVE AND (appliesTo=ALL OR appliesTo matches student.boardingStatus)`. A required doc is "missing" if no `StudentDocument` exists for that type, OR `verificationStatus != VERIFIED`. A doc is "expired" only when `includeExpired=true` AND `expiresAt < now`.
- **Format**: XLSX only
- **Empty source**: when school has zero `DocumentType where isRequired=true`, returns empty result with metadata note "no required document types configured"

### 5.7 Cross-cutting
- **Permission gate**: each action calls `assertPermission` with the same permission used by the sibling student-register report (verified during implementation against `src/lib/permissions.ts`)
- **School scoping**: every Prisma query includes `schoolId: ctx.schoolId`
- **Row cap**: per-student reports (5.1, 5.3, 5.4, 5.5, 5.6) check `count` before fetching detail rows; if `> 5000`, return `{ error: "Result set too large (N rows). Apply tighter filters." }`. Census (5.2) is exempt.
- **Empty preview**: page renders "No students match these filters" when result count = 0; download buttons disabled
- **Active academic year missing**: returns `{ error: "No academic year found." }` (matches existing pattern in `getStudentRegisterReportAction`)

## 6. UI patterns

- **Hub page** mirrors `/reports/page.tsx` layout: `PageHeader` + grid of cards, one per report, each with title + 1-line description + icon. Click navigates to detail page.
- **Per-report page**: `PageHeader` → filter form (top, client component) → preview table showing the **first 50 rows + a total-count badge** (not a paginated navigator — preview is for sanity-checking filters before download; users get the full result via the download buttons) → download buttons (XLSX always, PDF where applicable, both disabled when result count = 0).
- **Filter form**: client component reading current `searchParams`, submitting via `router.push(\`?\${new URLSearchParams(...)}\`)`. Reset button clears all params.
- **Master-list button**: a "Reports" button is added to `students-client.tsx` toolbar, deep-links to `/reports/students`.

## 7. Testing strategy

For each of 6 actions, tests under `src/modules/reports/__tests__/<report>.test.ts`:

- **Permission test**: caller without report-view permission gets `error`
- **School scoping**: caller from school A cannot see school B students (uses existing test fixtures)
- **Filter test**: each filter axis actually narrows results
- **Edge cases per report**:
  - Roster / nominal roll / register: empty result when no students enrolled
  - Census: empty source returns zeroes per group
  - Birthday list: Feb 29 falls back to Feb 28 in non-leap years; `month` and `upcomingDays` mutual exclusivity rejected with clear error
  - Missing-docs: `appliesTo = BOARDING_ONLY` types only flagged for boarding students; `appliesTo = DAY_ONLY` only for day; VERIFIED-but-expired flagged when `includeExpired=true`
  - Row cap: a synthesized 5001-student fixture returns the cap error

XLSX renderers: one happy-path snapshot test per renderer, comparing parsed cell values (not byte content). PDF renderers: one smoke test per template that asserts the returned `Buffer` is non-empty and parses as PDF (visual review is manual per the verification plan in §10).

Route handlers: **one** representative integration test (against a live DB, mirroring the `describeIfDb` pattern in `tests/integration/students/`) for the roster XLSX route, asserting:
- correct `Content-Type` header
- correct `Content-Disposition: attachment` filename
- the response Buffer parses as XLSX with the expected rows
- one `AuditLog` row exists with `action='EXPORT'`, `entity='STUDENT_ROSTER'`, `module='reports'`, and `metadata.format='xlsx'`

Other routes are covered by unit tests on their actions + renderers + the shared `auditReportDownload` helper. Adding 9 integration tests is over-spec for this feature; the wiring is identical across routes once one is proven end-to-end.

## 8. Audit & permissions

- **Permission**: every action and download route handler asserts `PERMISSIONS.REPORTS_ENROLLMENT_READ` (the same key the existing admissions report uses). No new permission key is introduced.
- **Audit on download only**: every download writes one `AuditLog` row via `audit()` from `src/lib/audit.ts`; page views are not audited (too noisy)
- **Audit shape**: `action: AuditAction.EXPORT`, `entity: <REPORT_SLUG>` (e.g. `STUDENT_ROSTER`, `STUDENT_CENSUS`, …), `module: "reports"`, `description: "Downloaded <report name> as <format>"`, `metadata: { format, filters, rowCount }`, `entityId: null`

## 9. Edge cases captured

- Student with no enrollment in selected year → excluded from per-student reports (they are not actively enrolled in that year)
- Student with multiple guardians → "primary phone" picks `StudentGuardian.isPrimary = true`, falls back to first by `createdAt`
- Form master register past 50 students → second printed page with column headers repeated
- Missing-docs when school has zero required document types → empty result with explanatory note
- Active academic year not configured → `{ error: "No academic year found." }`
- 5001+ rows on per-student reports → `{ error: "Result set too large…" }`; UI shows the message above the (empty) preview and disables download buttons

## 10. Verification plan (post-implementation)

1. Run `npm run dev`. From `/students` master page, click "Reports" — confirm navigation to `/reports/students` and that all 6 cards render.
2. Walk each report end-to-end in the browser preview: load page, set filters via the form (URL updates), confirm preview reflects filters, hit download buttons.
3. Open every downloaded XLSX in a spreadsheet tool — confirm header row contains school + filter summary + generated-at + generated-by; confirm data matches preview.
4. Open every downloaded PDF — confirm letterhead, totals, signature block (roster), surname uppercase (nominal roll), `weeks × daysPerWeek` grid (form master register), correct page breaks.
5. Use the form master register configuration: render with `weeks=15, daysPerWeek=7`; confirm grid renders correctly and pages still break cleanly.
6. Synthesize an account in a second school; confirm it cannot see school A's students in any report.
7. Run all new tests: `npm test src/modules/reports/__tests__/`.
8. Confirm an `AuditLog` entry is written for each download by checking the audit table after a sample download.

## 11. Out of scope (deferred)

- Saved presets / `ReportPreset` table
- Scheduled email delivery
- CSV format
- Per-column visibility toggles
- Inline edit-in-preview
- Historical-snapshot reports
- I18n of report titles / column headers
- Tier 3 items #10 (Audit Trail UI), #11 (Photo Upload + Gallery), #12 (Guardian Self-Service Account Linking) — each handled in its own brainstorm → spec → plan cycle after this one ships
