# Student Analytics Dashboard — Design Spec

**Date:** 2026-04-22
**Module:** Students (Tier 1, Item #4 from the Students module depth review)
**Status:** Approved design, pending implementation plan

---

## 1. Context & Goal

The Students module today offers no strategic view of the school as a whole. `getStudentsAction` returns individual students; `StudentRiskProfile` holds computed risk data that no UI reads (outside the standalone AI analytics page); and demographic / retention / Free SHS compliance metrics that Ghana SHS admins routinely need for board reports and GES returns have to be hand-compiled from raw lists.

This design adds a dedicated **Student Analytics Dashboard** at `/students/analytics` — a single page combining KPI tiles and five charts that give headmasters and registrars an at-a-glance picture of their school's cohort, plus per-chart CSV export for downstream reporting. The dashboard reads from existing data (Student, Enrollment, StudentRiskProfile) with a thin in-memory cache for performance, and introduces no write paths — it's a strategic view, not a lifecycle surface.

---

## 2. Scope (decided during brainstorming)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| Q1 | Primary user | C — Both headmaster + registrar | KPI tiles for strategic overview, drill-through for operational rosters |
| Q2 | Metric set | A — All five (trend / demographics / retention / Free SHS / at-risk) | Marginal cost per chart is low; partial dashboards trigger immediate v2 asks |
| Q3 | Data freshness | C — Live queries with 5-minute in-memory cache | Simple, bounded staleness, no new schema/cron infrastructure |
| Q4 | Filters | B — Academic year + programme (URL params) | Minimum viable cross-section; 3+ filters drift into mini-reporting-tool territory |
| Q5 | Permissions + at-risk interaction | A — Read-only at-risk + admin roles only | Compute lives on the existing AI page; v1 dashboard is strictly consumption |
| Q6 | Export | B — Per-chart CSV via existing `generateExport()` | Low-cost; admins paste into their own sheets rather than consume pre-formatted reports |

Out of scope for v1:
- Write paths (no risk profile compute button — link to existing AI page)
- Retention drill-through to individual student list
- Cohort comparison (year-over-year side-by-side views)
- Full-report Excel export with multi-sheet structure
- Scheduled snapshots (`StudentAnalyticsSnapshot` table)
- Class-teacher-scoped variant of the dashboard
- Loader-level resilience (`Promise.allSettled`); v1 is all-or-nothing per page render
- Custom date ranges (only academic year granularity)

---

## 3. Architecture

**Module layout**
- `src/modules/student/actions/analytics.action.ts` — primary action + private loader functions + export action
- `src/modules/student/schemas/analytics.schema.ts` — zod input schemas
- `src/lib/analytics-cache.ts` — reusable TTL cache helper
- `src/app/(dashboard)/students/analytics/` — new route

**Data flow**:
1. Server page reads URL params `academicYearId` (default: current year) and `programmeId` (default: all)
2. Calls `getStudentAnalyticsAction({ academicYearId, programmeId? })`
3. Action checks cache (key `analytics:${schoolId}:${academicYearId}:${programmeId ?? "all"}`, TTL 5 min). Hit → return cached payload with `cached: true`
4. On miss, run 6 parallel queries via `Promise.all`, aggregate, cache, return with `cached: false`
5. Client renders KPI tiles + 5 charts + per-chart CSV export buttons

**Cache model** — `src/lib/analytics-cache.ts`:

```ts
export async function getCached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs?: number,
): Promise<T>;

export function invalidateCachePrefix(prefix: string): void;
```

In-process `Map<string, { value, expiresAt }>`. Not Redis-backed. Single-node-per-instance cache is acceptable for a dashboard with bounded 5-min staleness. Refresh button on the UI calls `invalidateCachePrefix(schoolId)`.

**Permissions**: new `STUDENTS_ANALYTICS_READ = "students:analytics:read"`. Granted to `super_admin` (automatic), `headmaster`, `assistant_headmaster_academic`, `assistant_headmaster_admin`.

**Indexes to add** (migration `add_analytics_indexes`):
- `Student @@index([schoolId, region, status])`
- `Student @@index([schoolId, religion, status])`
- `Enrollment @@index([academicYearId, isFreeShsPlacement])`

**Entry point**: Add an "Analytics" button to `/students` primary toolbar, next to the existing Promotion button. Routes to `/students/analytics`.

**Audit**: read-only action; no `audit()` calls. Add `// @no-audit` JSDoc above both exported actions so the `audit-coverage` guardrail passes.

---

## 4. Data Model (response shape)

Single action returns a typed payload:

```ts
type StudentAnalyticsPayload = {
  computedAt: Date;
  cached: boolean;

  kpis: {
    totalActive: number;
    dayStudents: number;
    boardingStudents: number;
    freeShsCount: number;
    atRiskCount: number;           // HIGH + CRITICAL only
    graduatedThisYear: number;
    withdrawnThisYear: number;
  };

  enrollmentTrend: Array<{
    academicYearId: string;
    academicYearName: string;
    active: number;
    promoted: number;
    withdrawn: number;
    graduated: number;
    transferred: number;
    total: number;
  }>;

  demographics: {
    byGender: Array<{ gender: "MALE" | "FEMALE"; count: number; percentage: number }>;
    byRegion: Array<{ region: string; count: number; percentage: number }>;        // top 10 + "Other"
    byReligion: Array<{ religion: string; count: number; percentage: number }>;    // top 8 + "Other"
    total: number;
  };

  retention: {
    cohorts: Array<{
      yearGroup: number;             // 1, 2, 3 for SHS
      academicYearName: string;
      startingCount: number;
      retainedCount: number;
      retentionPct: number;
    }>;
    // Empty when selected year has no next year
  };

  freeShs: {
    freeShsCount: number;
    payingCount: number;
    freeShsPct: number;
  };

  atRisk: {
    byLevel: Array<{ riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL"; count: number }>;
    topStudents: Array<{
      studentId: string;
      studentCode: string;           // "SCH/YYYY/NNNN"
      firstName: string;
      lastName: string;
      riskScore: number;
      riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
    }>;
    hasAnyProfiles: boolean;
    computedAt: Date | null;
  };
};
```

Design choices:
- Arrays pre-sorted server-side (chronological for trend, desc-count for demographics/at-risk)
- Percentages pre-computed server-side so CSV exports match on-screen values exactly
- `byRegion` truncated to top 10 + "Other"; `byReligion` to top 8 + "Other"
- `atRisk.hasAnyProfiles` is an explicit boolean for clean empty-state rendering
- Null `region`/`religion` rolls into an "Unspecified" bucket rather than dropping

---

## 5. Server Actions

All in `src/modules/student/actions/analytics.action.ts`. All require `STUDENTS_ANALYTICS_READ` + `requireSchoolContext`. All queries scoped by `schoolId`.

### `getStudentAnalyticsAction(input)`

```ts
export async function getStudentAnalyticsAction(input: {
  academicYearId?: string;
  programmeId?: string;
}): Promise<{ data: StudentAnalyticsPayload } | { error: string }>
```

1. Auth + permission gate
2. Resolve `academicYearId`: if absent, `findFirst({ schoolId, isCurrent: true })`; error if none
3. Cache key: `analytics:${schoolId}:${academicYearId}:${programmeId ?? "all"}`
4. `getCached(key, loader, 5 * 60 * 1000)` where loader runs 6 parallel sub-loaders
5. Return payload with `computedAt: new Date()` and `cached` boolean derived from cache-hit status

### Six private loaders

- `loadKpis(schoolId, academicYearId, programmeId?)`
- `loadEnrollmentTrend(schoolId, programmeId?)` — last 5 AcademicYears, grouped by status
- `loadDemographics(schoolId, academicYearId, programmeId?)` — gender / region / religion aggregation with top-N + Other rollup
- `loadRetention(schoolId, programmeId?)` — per-yearGroup cohort retention across last 3 transitions
- `loadFreeShs(schoolId, academicYearId, programmeId?)` — `enrollment.groupBy([isFreeShsPlacement])`
- `loadAtRisk(schoolId, academicYearId)` — distribution + top 10 highest-risk

Each loader is testable in isolation via the prismaMock pattern.

### `exportAnalyticsMetricAction(input)`

```ts
export async function exportAnalyticsMetricAction(input: {
  metric: "kpis" | "enrollmentTrend" | "demographics.gender" | "demographics.region"
        | "demographics.religion" | "retention" | "freeShs" | "atRisk";
  academicYearId?: string;
  programmeId?: string;
}): Promise<{ data: Array<Record<string, unknown>> } | { error: string }>
```

- Calls `getStudentAnalyticsAction` internally (shares the same cache)
- Switches on `metric`, returns the appropriate slice flattened to records
- Client calls `generateExport({ format: "csv", columns, rows })` from `src/lib/export` to produce the download file

---

## 6. UI

### Page layout — `/students/analytics`

Server component `page.tsx` resolves URL params and fetches; client component `analytics-client.tsx` holds filter state and renders.

**Header strip**:
- Title "Student Analytics" + subtitle "Last updated: {computedAt}, {cached ? 'cached' : 'fresh'}"
- Filter bar: Academic Year dropdown + Programme dropdown + Refresh button

**KPI tile row** (6 cards, responsive grid):
- Total Active | Day | Boarding | Free SHS | At-Risk (HIGH+CRITICAL) | Graduated-or-Withdrawn this year
- Each tile clickable → navigates to `/students` with matching query filter
- At-Risk tile also has a small "View in AI Analytics" link to the existing `/analytics` page

**Chart grid** (responsive, 2+2+1):
- Row 1: Enrollment Trend (line chart, 5 years × status) + Demographics (tabbed: Gender / Region / Religion — pie or stacked bar per tab)
- Row 2: Retention per Cohort (line chart, year-over-year retention %) + Free SHS vs Paying (pie chart)
- Row 3: At-Risk Distribution (horizontal bar by risk level) + Top 10 At-Risk students table (links to `/students/[id]`)

**Per-chart CSV export** — small "Export CSV" button on each chart card. Calls `exportAnalyticsMetricAction` then `generateExport` client-side.

**Empty / error states**:
- No current academic year → full-page error card, link to `/admin/academic-year`
- Zero enrollments for selected filter → per-chart "No data" state, page stays rendered
- `StudentRiskProfile` table empty → At-Risk section shows "No risk profiles computed yet. Compute on the [AI Analytics page](/analytics)"
- Retention has no next-year to compare → chart renders with disclaimer "Retention data unavailable until next academic year completes"

**Filter UX**:
- Academic Year dropdown from `db.academicYear.findMany({where: {schoolId}})` sorted desc by startDate
- Programme dropdown from `db.programme.findMany({where: {schoolId, status: ACTIVE}})`
- Filter changes write to URL via `router.replace()`; cache key differs → fresh compute
- React `useTransition` wraps nav; loading bar at top during transition (doesn't blank current view)

### Component file layout

- `src/app/(dashboard)/students/analytics/page.tsx`
- `src/app/(dashboard)/students/analytics/analytics-client.tsx`
- `src/app/(dashboard)/students/analytics/kpi-tiles.tsx`
- `src/app/(dashboard)/students/analytics/enrollment-trend-chart.tsx`
- `src/app/(dashboard)/students/analytics/demographics-chart.tsx`
- `src/app/(dashboard)/students/analytics/retention-chart.tsx`
- `src/app/(dashboard)/students/analytics/free-shs-chart.tsx`
- `src/app/(dashboard)/students/analytics/at-risk-section.tsx`

Each chart ~50-80 lines. Reuses existing Recharts idioms from `src/components/shared/dashboard-charts.tsx` and `executive-charts.tsx`.

---

## 7. Error Handling & Edge Cases

**No current academic year** → `{ error: "No current academic year set" }`, UI shows error card with fix link. No silent fallback.

**Empty selected year / programme filter** → metrics return zeros; charts render empty states individually; page stays up.

**Retention without next year** (selected year is current) → cohorts array empty; chart shows disclaimer.

**Empty `StudentRiskProfile`** → `hasAnyProfiles: false`; At-Risk KPI shows "—" (not "0") to distinguish "no data" from "zero at risk"; section shows empty-state link to `/analytics`.

**Loader error** → `Promise.all` fail-fast; whole action returns error; cache NOT written (next request retries). Server logs the loader name and schoolId.

**Partial failure** → not supported in v1 (all-or-nothing). Deferred to v2 via `Promise.allSettled` if needed.

**Stale cache after mutations** → 5-min staleness is the accepted Q3 tradeoff. Document in JSDoc. Urgent admins use the Refresh button.

**CSV export of empty data** → produces a header-only CSV; client surfaces a toast "No data to export" but still downloads.

**Large region/religion cardinality** → top-N + "Other" rollup handles it.

**Cross-school leakage** → every query scoped by `schoolId`; cache key includes `schoolId`. Covered.

**Concurrent filter changes** → React `useTransition` wraps navigation; Recharts handles prop changes gracefully.

**Deleted programme in URL** → metrics filtered to nothing → zero payload. Non-fatal. Programme dropdown only lists ACTIVE programmes.

**Permission denied mid-session** → standard 403 card on page render.

---

## 8. Testing Strategy

**Unit tests**

- `tests/unit/lib/analytics-cache.test.ts` — 3-4 tests: hit / miss / loader error / prefix invalidation
- `tests/unit/students/analytics.test.ts` — ~15-20 tests covering:
  - `getStudentAnalyticsAction`: auth, permission, current-year resolution, filter passthrough, cache hit/miss, cross-filter cache isolation
  - `loadKpis`: counts across ACTIVE/DAY/BOARDING, Free SHS scope, at-risk HIGH+CRITICAL filter, graduated/withdrawn date scoping
  - `loadEnrollmentTrend`: 5-year chronological order, programme filter, zero-padding for years with no enrollments
  - `loadDemographics`: aggregation correctness, Region "Other" rollup at >10, Religion "Other" rollup at >8, percentage sum within tolerance, null → "Unspecified"
  - `loadRetention`: cohort retention math, empty when no next year, programme scoping
  - `loadFreeShs`: two-row groupBy aggregation, zero case (no NaN)
  - `loadAtRisk`: distribution sum, top 10 ordering, `hasAnyProfiles` boolean, max `computedAt`
  - `exportAnalyticsMetricAction`: shape per metric, cache-share, unknown metric error, permission denial

**Integration** (`tests/integration/students/analytics.test.ts`, covered by existing `vitest.students.config.ts`)

One end-to-end flow:
1. Seed school + current year + 1 programme + 2 class arms + ~10 students with varied demographics + Free SHS mix + at least one StudentRiskProfile
2. `getStudentAnalyticsAction({})` → assert `cached: false` + all six payload sections populated correctly
3. Call again → assert `cached: true`, identical payload
4. Mutate a student → cache still hits for 5 min (expected)
5. `invalidateCachePrefix(schoolId)` → next call returns fresh data
6. `exportAnalyticsMetricAction({ metric: "demographics.gender" })` → assert shape matches the gender array

**UI verification** (manual per `verification-before-completion`)
- `npm run dev`; log in as admin → `/students/analytics` renders with seeded data
- Toggle filters; URL updates; charts re-render
- Refresh button updates the "Last updated" timestamp
- CSV exports: click each of the 5 export buttons → verify file contents match on-screen values
- KPI tile click navigates to `/students` with filter applied
- At-risk empty state: drop the single risk row → reload → empty-state message appears
- Non-admin role → 403 card

**Guardrail**: both exported actions are read-only; no `audit()`. Add `// @no-audit` JSDoc comments so `tests/unit/guardrails/audit-coverage.test.ts` passes.

---

## 9. Critical Files

**New**
- `prisma/schema/student.prisma` — add three indexes (region, religion, isFreeShsPlacement)
- `src/lib/analytics-cache.ts`
- `src/modules/student/actions/analytics.action.ts`
- `src/modules/student/schemas/analytics.schema.ts`
- `src/app/(dashboard)/students/analytics/page.tsx` + 7 chart / tile / section components
- `tests/unit/lib/analytics-cache.test.ts`
- `tests/unit/students/analytics.test.ts`
- `tests/integration/students/analytics.test.ts`

**Extended**
- `src/lib/permissions.ts` — add `STUDENTS_ANALYTICS_READ` + role grants
- `src/app/(dashboard)/students/students-client.tsx` — add "Analytics" toolbar button
- `prisma/schema/academic.prisma` — enrollment index on `(academicYearId, isFreeShsPlacement)`

**Reused (no changes)**
- `src/lib/export/index.ts` — `generateExport()` for CSV
- `src/components/shared/dashboard-charts.tsx` / `executive-charts.tsx` — Recharts patterns to mirror
- `prisma/schema/analytics.prisma` — `StudentRiskProfile` model (read-only)
- `src/modules/ai/actions/analytics.action.ts` — existing `getRiskProfilesAction` as reference (but we don't call it; we read `StudentRiskProfile` directly)

---

## 10. Out of Scope for v1

- Write paths (no risk compute button)
- Retention drill-through to individual student rosters
- Side-by-side cohort comparison
- Multi-sheet Excel "full report" export
- Scheduled snapshot refresh via BullMQ cron
- Class-teacher-scoped dashboard variant
- `Promise.allSettled` partial loader resilience
- Date-range filters finer than academic year
- Real-time updates / SSE streaming

---

## 11. Verification Plan

When implementation lands:
1. `npx prisma migrate dev --name add_analytics_indexes` — schema indexes only
2. `npm test -- analytics analytics-cache` — unit suite green
3. `npm run test:students` — integration green
4. `npm run dev` → login as admin → walk:
   - `/students/analytics` loads with correct header/tiles/charts
   - Academic Year dropdown populated, defaults to current year
   - Programme dropdown populated
   - Toggle filters → URL updates + re-render
   - Refresh button → "Last updated" advances, `cached: false` shown
   - Each CSV export downloads file with expected columns
   - Click a KPI tile → navigates to `/students` with filter applied
5. Empty `StudentRiskProfile` → at-risk empty-state link visible
6. Log in as non-admin role → 403 card visible
7. Confirm audit log has NO entries from page loads (read-only)
