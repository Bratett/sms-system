# Student Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `/students/analytics` page with 6 KPI tiles + 5 charts (enrollment trend / demographics / retention / Free SHS / at-risk), filterable by academic year + programme, backed by live queries behind a 5-minute in-process TTL cache, with per-chart CSV export.

**Architecture:** Single server action `getStudentAnalyticsAction` runs 6 parallel Prisma aggregations (wrapped by a reusable `getCached` helper with school-scoped cache keys). URL params drive the filter state. Client renders Recharts components mirroring the existing `src/components/shared/executive-charts.tsx` idiom. Per-metric CSV export via `exportAnalyticsMetricAction` + existing `generateExport()` helper. Read-only feature — no audit entries.

**Tech Stack:** Next.js 15 App Router, Prisma on PostgreSQL, Recharts 3.8.1, vitest + vitest-mock-extended, shadcn-free tailwind UI idiom established by prior Tier 1 PRs.

**Spec reference:** `docs/superpowers/specs/2026-04-22-student-analytics-dashboard-design.md`

---

## File Structure

**New files**
- `src/lib/analytics-cache.ts` — reusable TTL cache
- `src/modules/student/schemas/analytics.schema.ts` — zod inputs
- `src/modules/student/actions/analytics.action.ts` — action + 6 private loaders + export action
- `src/app/(dashboard)/students/analytics/page.tsx` — server component
- `src/app/(dashboard)/students/analytics/analytics-client.tsx` — client container (filter bar + grid)
- `src/app/(dashboard)/students/analytics/kpi-tiles.tsx` — 6 KPI tiles
- `src/app/(dashboard)/students/analytics/enrollment-trend-chart.tsx`
- `src/app/(dashboard)/students/analytics/demographics-chart.tsx` — tabbed gender/region/religion
- `src/app/(dashboard)/students/analytics/retention-chart.tsx`
- `src/app/(dashboard)/students/analytics/free-shs-chart.tsx`
- `src/app/(dashboard)/students/analytics/at-risk-section.tsx` — bar + top-10 table
- `src/app/(dashboard)/students/analytics/export-button.tsx` — small helper wired to each chart
- `tests/unit/lib/analytics-cache.test.ts`
- `tests/unit/students/analytics.test.ts`
- `tests/integration/students/analytics.test.ts`

**Modified files**
- `prisma/schema/student.prisma` — 2 new indexes on `Student` (region+status, religion+status)
- `prisma/schema/academic.prisma` — 1 new index on `Enrollment` (academicYearId+isFreeShsPlacement)
- `src/lib/permissions.ts` — add `STUDENTS_ANALYTICS_READ` + role grants
- `src/app/(dashboard)/students/students-client.tsx` — add "Analytics" toolbar button

**Reused**
- `src/lib/export/index.ts` — `generateExport()` (client invocation via small wrapper)
- `prisma/schema/analytics.prisma` — `StudentRiskProfile` model (read-only)
- Existing Recharts idiom — mirror shape of `src/components/shared/executive-charts.tsx`

---

## Task 1: Schema indexes + permission

**Files:**
- Modify: `prisma/schema/student.prisma` — add two `@@index` lines on `Student`
- Modify: `prisma/schema/academic.prisma` — add one `@@index` on `Enrollment`
- Modify: `src/lib/permissions.ts` — add constant + role grants

### Step 1: Add Student indexes

In `prisma/schema/student.prisma`, inside `model Student`, append to the indexes block:

```prisma
  @@index([schoolId, region, status])
  @@index([schoolId, religion, status])
```

### Step 2: Add Enrollment index

In `prisma/schema/academic.prisma`, inside `model Enrollment`, append to the indexes block:

```prisma
  @@index([academicYearId, isFreeShsPlacement])
```

### Step 3: Validate + migrate

Run: `npx prisma validate`
Expected: schemas valid.

Run: `npx prisma migrate dev --name add_analytics_indexes`
Expected: migration file created; applied to dev DB; client regenerated.

### Step 4: Add permission constant

In `src/lib/permissions.ts`, find the existing `STUDENTS_*` block (around line 56-62 — ends with `STUDENTS_PROMOTE`). After the last `STUDENTS_DOCUMENTS_*` constant (or `STUDENTS_PROMOTE` — whichever is last), add:

```ts
  STUDENTS_ANALYTICS_READ: "students:analytics:read",
```

### Step 5: Grant to admin roles

Search for `PERMISSIONS.STUDENTS_PROMOTE`. You'll find three admin role arrays (`headmaster`, `assistant_headmaster_academic`, `assistant_headmaster_admin`). Add `PERMISSIONS.STUDENTS_ANALYTICS_READ` to each.

`super_admin` inherits via `ALL_PERMISSIONS` — no explicit grant.

### Step 6: Verify

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npx vitest run tests/unit/auth/permissions.test.ts`
Expected: all passing.

### Step 7: Commit

```bash
git add prisma/ src/lib/permissions.ts
git commit -m "feat(analytics): schema indexes + STUDENTS_ANALYTICS_READ permission"
```

---

## Task 2: Cache helper

**Files:**
- Create: `src/lib/analytics-cache.ts`
- Create: `tests/unit/lib/analytics-cache.test.ts`

### Step 1: Write failing tests

```ts
// tests/unit/lib/analytics-cache.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { getCached, invalidateCachePrefix, __resetCacheForTests } from "@/lib/analytics-cache";

describe("getCached", () => {
  beforeEach(() => __resetCacheForTests());

  it("runs loader on first call (cache miss)", async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      return "value-1";
    };

    const result = await getCached("key-a", loader);
    expect(result).toBe("value-1");
    expect(calls).toBe(1);
  });

  it("returns cached value on second call within TTL", async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      return `value-${calls}`;
    };

    const a = await getCached("key-a", loader, 60_000);
    const b = await getCached("key-a", loader, 60_000);
    expect(a).toBe("value-1");
    expect(b).toBe("value-1");
    expect(calls).toBe(1);
  });

  it("re-runs loader when TTL has elapsed", async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      return `value-${calls}`;
    };

    await getCached("key-a", loader, 10);
    await new Promise((r) => setTimeout(r, 15));
    const b = await getCached("key-a", loader, 10);
    expect(b).toBe("value-2");
    expect(calls).toBe(2);
  });

  it("does not cache loader errors", async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      if (calls === 1) throw new Error("boom");
      return "value-ok";
    };

    await expect(getCached("key-a", loader)).rejects.toThrow("boom");
    const b = await getCached("key-a", loader);
    expect(b).toBe("value-ok");
    expect(calls).toBe(2);
  });
});

describe("invalidateCachePrefix", () => {
  beforeEach(() => __resetCacheForTests());

  it("removes only entries matching the prefix", async () => {
    let aCalls = 0;
    let bCalls = 0;
    await getCached("analytics:school-1:year-1", async () => { aCalls++; return "A"; });
    await getCached("analytics:school-2:year-1", async () => { bCalls++; return "B"; });

    invalidateCachePrefix("analytics:school-1");

    await getCached("analytics:school-1:year-1", async () => { aCalls++; return "A"; });
    await getCached("analytics:school-2:year-1", async () => { bCalls++; return "B"; });

    expect(aCalls).toBe(2);
    expect(bCalls).toBe(1);
  });
});
```

### Step 2: Verify RED

Run: `npx vitest run tests/unit/lib/analytics-cache.test.ts`
Expected: fail (module not found).

### Step 3: Implement

```ts
// src/lib/analytics-cache.ts
type CacheEntry<T> = { value: T; expiresAt: number };

const cache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Returns the cached value for `key` if fresh, otherwise runs `loader`,
 * caches the result for `ttlMs` milliseconds, and returns it. Loader errors
 * are NOT cached — the next call retries.
 *
 * Intended for read-only aggregate queries with bounded staleness tolerance
 * (e.g., the Student Analytics dashboard). In-process cache; not shared
 * across Node instances.
 */
export async function getCached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > now) return entry.value;
  const value = await loader();
  cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/**
 * Removes all cache entries whose key starts with `prefix`. Used to
 * force-refresh a subset (e.g., all entries for a specific school).
 */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/** Test-only utility. Not exported from the public module index. */
export function __resetCacheForTests(): void {
  cache.clear();
}
```

### Step 4: Verify GREEN

Run: `npx vitest run tests/unit/lib/analytics-cache.test.ts`
Expected: 5 tests passing.

### Step 5: Commit

```bash
git add src/lib/analytics-cache.ts tests/unit/lib/analytics-cache.test.ts
git commit -m "feat(analytics): add getCached TTL helper"
```

---

## Task 3: Zod input schemas

**Files:**
- Create: `src/modules/student/schemas/analytics.schema.ts`

### Step 1: Create the file

```ts
// src/modules/student/schemas/analytics.schema.ts
import { z } from "zod";

export const getStudentAnalyticsSchema = z.object({
  academicYearId: z.string().cuid().optional(),
  programmeId: z.string().cuid().optional(),
});

export const exportAnalyticsMetricSchema = z.object({
  metric: z.enum([
    "kpis",
    "enrollmentTrend",
    "demographics.gender",
    "demographics.region",
    "demographics.religion",
    "retention",
    "freeShs",
    "atRisk",
  ]),
  academicYearId: z.string().cuid().optional(),
  programmeId: z.string().cuid().optional(),
});

export type GetStudentAnalyticsInput = z.infer<typeof getStudentAnalyticsSchema>;
export type ExportAnalyticsMetricInput = z.infer<typeof exportAnalyticsMetricSchema>;
```

### Step 2: Commit

```bash
git add src/modules/student/schemas/analytics.schema.ts
git commit -m "feat(analytics): zod schemas for action inputs"
```

---

## Task 4: `loadKpis` + `getStudentAnalyticsAction` scaffold

Build the primary action with just the KPI tile data first. Subsequent tasks layer on additional loaders.

**Files:**
- Create: `src/modules/student/actions/analytics.action.ts`
- Create: `tests/unit/students/analytics.test.ts`

### Step 1: Write failing tests

```ts
// tests/unit/students/analytics.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { getStudentAnalyticsAction } from "@/modules/student/actions/analytics.action";
import { __resetCacheForTests } from "@/lib/analytics-cache";

describe("getStudentAnalyticsAction", () => {
  beforeEach(() => {
    __resetCacheForTests();
    mockAuthenticatedUser();
  });

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getStudentAnalyticsAction({});
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("rejects users without STUDENTS_ANALYTICS_READ", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getStudentAnalyticsAction({});
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("returns error when no current academic year is set and none provided", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue(null);
    const result = await getStudentAnalyticsAction({});
    expect(result).toEqual({ error: "No current academic year set" });
  });

  it("returns KPI tile counts for the current academic year", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: "ay-1", schoolId: "default-school", startDate: new Date("2025-09-01"),
      endDate: new Date("2026-08-31"), isCurrent: true,
    } as never);

    // Stub kpi loader sub-queries
    prismaMock.student.count
      .mockResolvedValueOnce(120)  // totalActive
      .mockResolvedValueOnce(80)   // dayStudents
      .mockResolvedValueOnce(40)   // boardingStudents
      .mockResolvedValueOnce(5)    // graduatedThisYear
      .mockResolvedValueOnce(3);   // withdrawnThisYear
    prismaMock.enrollment.count.mockResolvedValue(50); // freeShsCount
    prismaMock.studentRiskProfile.count.mockResolvedValue(12); // atRiskCount (HIGH+CRITICAL)

    // Stub other loaders to return empty/neutral data so the action completes
    prismaMock.academicYear.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.groupBy.mockResolvedValue([] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.groupBy.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({ _max: { computedAt: null } } as never);

    const result = await getStudentAnalyticsAction({});
    expect(result).toHaveProperty("data");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.kpis).toEqual({
      totalActive: 120,
      dayStudents: 80,
      boardingStudents: 40,
      freeShsCount: 50,
      atRiskCount: 12,
      graduatedThisYear: 5,
      withdrawnThisYear: 3,
    });
    expect(result.data.cached).toBe(false);
  });

  it("second call with same filters returns cached: true", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: "ay-1", schoolId: "default-school", startDate: new Date("2025-09-01"),
      endDate: new Date("2026-08-31"), isCurrent: true,
    } as never);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.enrollment.count.mockResolvedValue(0);
    prismaMock.studentRiskProfile.count.mockResolvedValue(0);
    prismaMock.academicYear.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.groupBy.mockResolvedValue([] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.groupBy.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({ _max: { computedAt: null } } as never);

    const first = await getStudentAnalyticsAction({ academicYearId: "ay-1" });
    const second = await getStudentAnalyticsAction({ academicYearId: "ay-1" });

    if (!("data" in first) || !("data" in second)) throw new Error("expected data");
    expect(first.data.cached).toBe(false);
    expect(second.data.cached).toBe(true);
  });
});
```

### Step 2: Verify RED

Run: `npx vitest run tests/unit/students/analytics.test.ts`
Expected: fail (module not found).

### Step 3: Implement

```ts
// src/modules/student/actions/analytics.action.ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { getCached } from "@/lib/analytics-cache";
import { getStudentAnalyticsSchema } from "../schemas/analytics.schema";

export type StudentAnalyticsPayload = {
  computedAt: Date;
  cached: boolean;
  kpis: {
    totalActive: number;
    dayStudents: number;
    boardingStudents: number;
    freeShsCount: number;
    atRiskCount: number;
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
    byRegion: Array<{ region: string; count: number; percentage: number }>;
    byReligion: Array<{ religion: string; count: number; percentage: number }>;
    total: number;
  };
  retention: {
    cohorts: Array<{
      yearGroup: number;
      academicYearName: string;
      startingCount: number;
      retainedCount: number;
      retentionPct: number;
    }>;
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
      studentCode: string;
      firstName: string;
      lastName: string;
      riskScore: number;
      riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
    }>;
    hasAnyProfiles: boolean;
    computedAt: Date | null;
  };
};

async function loadKpis(
  schoolId: string,
  academicYearId: string,
  academicYearStart: Date,
  academicYearEnd: Date,
  programmeFilter: Record<string, unknown>,
): Promise<StudentAnalyticsPayload["kpis"]> {
  const [
    totalActive,
    dayStudents,
    boardingStudents,
    graduatedThisYear,
    withdrawnThisYear,
    freeShsCount,
    atRiskCount,
  ] = await Promise.all([
    db.student.count({ where: { schoolId, status: "ACTIVE" } }),
    db.student.count({ where: { schoolId, status: "ACTIVE", boardingStatus: "DAY" } }),
    db.student.count({ where: { schoolId, status: "ACTIVE", boardingStatus: "BOARDING" } }),
    db.student.count({
      where: { schoolId, status: "GRADUATED", updatedAt: { gte: academicYearStart, lte: academicYearEnd } },
    }),
    db.student.count({
      where: { schoolId, status: "WITHDRAWN", updatedAt: { gte: academicYearStart, lte: academicYearEnd } },
    }),
    db.enrollment.count({
      where: {
        schoolId,
        academicYearId,
        isFreeShsPlacement: true,
        status: "ACTIVE",
        ...programmeFilter,
      },
    }),
    db.studentRiskProfile.count({
      where: { schoolId, academicYearId, riskLevel: { in: ["HIGH", "CRITICAL"] } },
    }),
  ]);

  return {
    totalActive,
    dayStudents,
    boardingStudents,
    freeShsCount,
    atRiskCount,
    graduatedThisYear,
    withdrawnThisYear,
  };
}

/**
 * @no-audit Read-only analytics aggregation. No side effects.
 */
export async function getStudentAnalyticsAction(input: {
  academicYearId?: string;
  programmeId?: string;
}): Promise<{ data: StudentAnalyticsPayload } | { error: string }> {
  const parsed = getStudentAnalyticsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_ANALYTICS_READ);
  if (denied) return denied;

  // Resolve academic year.
  const year = parsed.data.academicYearId
    ? await db.academicYear.findFirst({ where: { id: parsed.data.academicYearId, schoolId: ctx.schoolId } })
    : await db.academicYear.findFirst({ where: { schoolId: ctx.schoolId, isCurrent: true } });
  if (!year) return { error: "No current academic year set" };

  const cacheKey = `analytics:${ctx.schoolId}:${year.id}:${parsed.data.programmeId ?? "all"}`;
  const programmeFilter: Record<string, unknown> = parsed.data.programmeId
    ? { classArm: { class: { programmeId: parsed.data.programmeId } } }
    : {};

  // Track cache-hit state via a sentinel set by the loader.
  let wasCacheMiss = false;
  const payload = await getCached<StudentAnalyticsPayload>(cacheKey, async () => {
    wasCacheMiss = true;
    const kpis = await loadKpis(
      ctx.schoolId,
      year.id,
      year.startDate,
      year.endDate,
      programmeFilter,
    );
    // Subsequent tasks fill in the remaining sections.
    return {
      computedAt: new Date(),
      cached: false,
      kpis,
      enrollmentTrend: [],
      demographics: { byGender: [], byRegion: [], byReligion: [], total: 0 },
      retention: { cohorts: [] },
      freeShs: { freeShsCount: 0, payingCount: 0, freeShsPct: 0 },
      atRisk: { byLevel: [], topStudents: [], hasAnyProfiles: false, computedAt: null },
    };
  });

  return { data: { ...payload, cached: !wasCacheMiss } };
}
```

### Step 4: Verify GREEN

Run: `npx vitest run tests/unit/students/analytics.test.ts`
Expected: 5 passing.

### Step 5: Verify tsc

Run: `npx tsc --noEmit`
Expected: clean.

### Step 6: Commit

```bash
git add src/modules/student/actions/analytics.action.ts tests/unit/students/analytics.test.ts
git commit -m "feat(analytics): action scaffold + loadKpis"
```

---

## Task 5: `loadEnrollmentTrend`

**Files:**
- Modify: `src/modules/student/actions/analytics.action.ts`
- Modify: `tests/unit/students/analytics.test.ts`

### Step 1: Append failing test

Append to the test file:

```ts
describe("loadEnrollmentTrend", () => {
  beforeEach(() => {
    __resetCacheForTests();
    mockAuthenticatedUser();
  });

  it("returns last 5 academic years with status counts and zero-pad missing statuses", async () => {
    const current = { id: "ay-1", schoolId: "default-school", isCurrent: true,
      startDate: new Date("2025-09-01"), endDate: new Date("2026-08-31"), name: "2025/2026" };
    prismaMock.academicYear.findFirst.mockResolvedValue(current as never);
    prismaMock.academicYear.findMany.mockResolvedValue([
      { id: "ay-1", name: "2025/2026", startDate: new Date("2025-09-01") },
      { id: "ay-0", name: "2024/2025", startDate: new Date("2024-09-01") },
    ] as never);
    prismaMock.enrollment.groupBy.mockImplementation(async (args: any) => {
      if (args.where.academicYearId === "ay-1") {
        return [
          { academicYearId: "ay-1", status: "ACTIVE", _count: { _all: 100 } },
          { academicYearId: "ay-1", status: "PROMOTED", _count: { _all: 10 } },
        ] as never;
      }
      return [
        { academicYearId: "ay-0", status: "ACTIVE", _count: { _all: 95 } },
      ] as never;
    });
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.enrollment.count.mockResolvedValue(0);
    prismaMock.studentRiskProfile.count.mockResolvedValue(0);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.groupBy.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({ _max: { computedAt: null } } as never);

    const result = await getStudentAnalyticsAction({});
    if (!("data" in result)) throw new Error("expected data");
    const trend = result.data.enrollmentTrend;
    expect(trend).toHaveLength(2);
    // Chronological order (oldest first)
    expect(trend[0]!.academicYearName).toBe("2024/2025");
    expect(trend[1]!.academicYearName).toBe("2025/2026");
    expect(trend[1]).toMatchObject({ active: 100, promoted: 10, withdrawn: 0, total: 110 });
    expect(trend[0]).toMatchObject({ active: 95, promoted: 0, total: 95 });
  });
});
```

### Step 2: Verify RED

Run: `npx vitest run tests/unit/students/analytics.test.ts`
Expected: 1 new failing test (trend array empty).

### Step 3: Implement the loader

Add before `getStudentAnalyticsAction`:

```ts
async function loadEnrollmentTrend(
  schoolId: string,
  programmeFilter: Record<string, unknown>,
): Promise<StudentAnalyticsPayload["enrollmentTrend"]> {
  // Last 5 academic years, oldest first for chart display.
  const years = await db.academicYear.findMany({
    where: { schoolId },
    orderBy: { startDate: "desc" },
    take: 5,
    select: { id: true, name: true, startDate: true },
  });
  if (years.length === 0) return [];
  years.reverse(); // chronological

  const grouped = await Promise.all(
    years.map((y) =>
      db.enrollment.groupBy({
        by: ["status"],
        where: { schoolId, academicYearId: y.id, ...programmeFilter },
        _count: { _all: true },
      }),
    ),
  );

  return years.map((year, idx) => {
    const rows = grouped[idx] ?? [];
    const by = (status: string) =>
      rows.find((r) => r.status === status)?._count._all ?? 0;
    const active = by("ACTIVE");
    const promoted = by("PROMOTED");
    const withdrawn = by("WITHDRAWN");
    const graduated = by("COMPLETED");
    const transferred = by("TRANSFERRED");
    return {
      academicYearId: year.id,
      academicYearName: year.name,
      active,
      promoted,
      withdrawn,
      graduated,
      transferred,
      total: active + promoted + withdrawn + graduated + transferred,
    };
  });
}
```

Wire it into the loader:

Replace the `enrollmentTrend: []` line inside the loader callback with:

```ts
enrollmentTrend: await loadEnrollmentTrend(ctx.schoolId, programmeFilter),
```

To preserve the parallel-fetch pattern, restructure the loader body:

```ts
const [kpis, enrollmentTrend] = await Promise.all([
  loadKpis(ctx.schoolId, year.id, year.startDate, year.endDate, programmeFilter),
  loadEnrollmentTrend(ctx.schoolId, programmeFilter),
]);
return {
  computedAt: new Date(),
  cached: false,
  kpis,
  enrollmentTrend,
  demographics: { byGender: [], byRegion: [], byReligion: [], total: 0 },
  retention: { cohorts: [] },
  freeShs: { freeShsCount: 0, payingCount: 0, freeShsPct: 0 },
  atRisk: { byLevel: [], topStudents: [], hasAnyProfiles: false, computedAt: null },
};
```

### Step 4: Verify GREEN

Run: `npx vitest run tests/unit/students/analytics.test.ts`
Expected: 6 tests passing.

### Step 5: Commit

```bash
git add .
git commit -m "feat(analytics): loadEnrollmentTrend (last 5 years per-status groupBy)"
```

---

## Task 6: `loadDemographics`

**Files:**
- Modify: `src/modules/student/actions/analytics.action.ts`
- Modify: `tests/unit/students/analytics.test.ts`

### Step 1: Append failing test

```ts
describe("loadDemographics", () => {
  beforeEach(() => {
    __resetCacheForTests();
    mockAuthenticatedUser();
  });

  it("aggregates gender/region/religion from active enrollments; rolls rare values into Other", async () => {
    const current = { id: "ay-1", schoolId: "default-school", isCurrent: true,
      startDate: new Date("2025-09-01"), endDate: new Date("2026-08-31"), name: "2025/2026" };
    prismaMock.academicYear.findFirst.mockResolvedValue(current as never);
    // minimal stubs for other loaders
    prismaMock.academicYear.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.groupBy.mockResolvedValue([] as never);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.enrollment.count.mockResolvedValue(0);
    prismaMock.studentRiskProfile.count.mockResolvedValue(0);
    prismaMock.studentRiskProfile.groupBy.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({ _max: { computedAt: null } } as never);
    // 4 students
    prismaMock.enrollment.findMany.mockResolvedValue([
      { student: { gender: "MALE",   region: "Greater Accra", religion: "Christianity" } },
      { student: { gender: "MALE",   region: "Greater Accra", religion: "Islam" } },
      { student: { gender: "FEMALE", region: "Ashanti",       religion: "Christianity" } },
      { student: { gender: "FEMALE", region: null,            religion: null } },
    ] as never);

    const result = await getStudentAnalyticsAction({});
    if (!("data" in result)) throw new Error("expected data");
    const d = result.data.demographics;
    expect(d.total).toBe(4);
    expect(d.byGender).toEqual(expect.arrayContaining([
      expect.objectContaining({ gender: "MALE", count: 2, percentage: 50 }),
      expect.objectContaining({ gender: "FEMALE", count: 2, percentage: 50 }),
    ]));
    expect(d.byRegion.find((r) => r.region === "Greater Accra")?.count).toBe(2);
    expect(d.byRegion.find((r) => r.region === "Unspecified")?.count).toBe(1);
    expect(d.byReligion.find((r) => r.religion === "Christianity")?.count).toBe(2);
  });
});
```

### Step 2: Verify RED

Run: `npx vitest run tests/unit/students/analytics.test.ts`
Expected: 1 new failing test.

### Step 3: Implement

Add:

```ts
function rollupWithOther<K extends string>(
  counts: Map<string, number>,
  total: number,
  topN: number,
  keyName: K,
): Array<Record<K, string> & { count: number; percentage: number }> {
  const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const head = entries.slice(0, topN);
  const tail = entries.slice(topN);
  const tailCount = tail.reduce((sum, [, c]) => sum + c, 0);
  const out = head.map(([key, count]) => ({
    [keyName]: key,
    count,
    percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
  })) as Array<Record<K, string> & { count: number; percentage: number }>;
  if (tailCount > 0) {
    out.push({
      [keyName]: "Other",
      count: tailCount,
      percentage: total > 0 ? Math.round((tailCount / total) * 1000) / 10 : 0,
    } as Record<K, string> & { count: number; percentage: number });
  }
  return out;
}

async function loadDemographics(
  schoolId: string,
  academicYearId: string,
  programmeFilter: Record<string, unknown>,
): Promise<StudentAnalyticsPayload["demographics"]> {
  const enrollments = await db.enrollment.findMany({
    where: {
      schoolId,
      academicYearId,
      status: "ACTIVE",
      ...programmeFilter,
    },
    select: {
      student: {
        select: { gender: true, region: true, religion: true },
      },
    },
  });

  const total = enrollments.length;
  const genderCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  const religionCounts = new Map<string, number>();

  for (const { student } of enrollments) {
    genderCounts.set(student.gender, (genderCounts.get(student.gender) ?? 0) + 1);
    const region = student.region ?? "Unspecified";
    regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
    const religion = student.religion ?? "Unspecified";
    religionCounts.set(religion, (religionCounts.get(religion) ?? 0) + 1);
  }

  const byGender = Array.from(genderCounts.entries()).map(([gender, count]) => ({
    gender: gender as "MALE" | "FEMALE",
    count,
    percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
  }));
  const byRegion = rollupWithOther(regionCounts, total, 10, "region");
  const byReligion = rollupWithOther(religionCounts, total, 8, "religion");

  return { byGender, byRegion, byReligion, total };
}
```

Wire into the Promise.all:

```ts
const [kpis, enrollmentTrend, demographics] = await Promise.all([
  loadKpis(ctx.schoolId, year.id, year.startDate, year.endDate, programmeFilter),
  loadEnrollmentTrend(ctx.schoolId, programmeFilter),
  loadDemographics(ctx.schoolId, year.id, programmeFilter),
]);
```

Update the returned object accordingly (`demographics` comes from the variable instead of the empty default).

### Step 4: Verify GREEN

Run: `npx vitest run tests/unit/students/analytics.test.ts`
Expected: 7 passing.

### Step 5: Commit

```bash
git add .
git commit -m "feat(analytics): loadDemographics with top-N + Other rollup"
```

---

## Task 7: `loadRetention`

**Files:**
- Modify: `src/modules/student/actions/analytics.action.ts`
- Modify: `tests/unit/students/analytics.test.ts`

### Step 1: Append failing test

```ts
describe("loadRetention", () => {
  beforeEach(() => {
    __resetCacheForTests();
    mockAuthenticatedUser();
  });

  it("computes per-cohort retention from consecutive academic year enrollments", async () => {
    const current = { id: "ay-2", schoolId: "default-school", isCurrent: true,
      startDate: new Date("2026-09-01"), endDate: new Date("2027-08-31"), name: "2026/2027" };
    prismaMock.academicYear.findFirst.mockResolvedValue(current as never);
    // years sorted desc by startDate (prisma returns newest first)
    prismaMock.academicYear.findMany.mockResolvedValue([
      { id: "ay-2", name: "2026/2027", startDate: new Date("2026-09-01") },
      { id: "ay-1", name: "2025/2026", startDate: new Date("2025-09-01") },
    ] as never);
    prismaMock.enrollment.groupBy.mockResolvedValue([] as never);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.enrollment.count.mockResolvedValue(0);
    prismaMock.studentRiskProfile.count.mockResolvedValue(0);
    prismaMock.studentRiskProfile.groupBy.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({ _max: { computedAt: null } } as never);
    // first findMany = demographics path (empty); then retention-specific calls
    prismaMock.enrollment.findMany
      .mockResolvedValueOnce([] as never) // demographics
      // Retention uses 2 findMany per cohort: base + next-year.
      // 10 SHS1 in ay-1, 8 of them active in ay-2
      .mockResolvedValueOnce([
        { studentId: "s-1", classArm: { class: { yearGroup: 1 } } },
        { studentId: "s-2", classArm: { class: { yearGroup: 1 } } },
        { studentId: "s-3", classArm: { class: { yearGroup: 1 } } },
        { studentId: "s-4", classArm: { class: { yearGroup: 1 } } },
        { studentId: "s-5", classArm: { class: { yearGroup: 1 } } },
        { studentId: "s-6", classArm: { class: { yearGroup: 1 } } },
        { studentId: "s-7", classArm: { class: { yearGroup: 1 } } },
        { studentId: "s-8", classArm: { class: { yearGroup: 1 } } },
        { studentId: "s-9", classArm: { class: { yearGroup: 1 } } },
        { studentId: "s-10", classArm: { class: { yearGroup: 1 } } },
      ] as never)
      .mockResolvedValueOnce([
        { studentId: "s-1" }, { studentId: "s-2" }, { studentId: "s-3" },
        { studentId: "s-4" }, { studentId: "s-5" }, { studentId: "s-6" },
        { studentId: "s-7" }, { studentId: "s-8" },
      ] as never);

    const result = await getStudentAnalyticsAction({});
    if (!("data" in result)) throw new Error("expected data");
    const cohorts = result.data.retention.cohorts;
    expect(cohorts).toHaveLength(1);
    expect(cohorts[0]).toMatchObject({
      yearGroup: 1,
      academicYearName: "2025/2026",
      startingCount: 10,
      retainedCount: 8,
      retentionPct: 80,
    });
  });

  it("returns empty cohorts when only one academic year exists (no next year to compare)", async () => {
    const current = { id: "ay-1", schoolId: "default-school", isCurrent: true,
      startDate: new Date("2025-09-01"), endDate: new Date("2026-08-31"), name: "2025/2026" };
    prismaMock.academicYear.findFirst.mockResolvedValue(current as never);
    prismaMock.academicYear.findMany.mockResolvedValue([
      { id: "ay-1", name: "2025/2026", startDate: new Date("2025-09-01") },
    ] as never);
    prismaMock.enrollment.groupBy.mockResolvedValue([] as never);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.enrollment.count.mockResolvedValue(0);
    prismaMock.studentRiskProfile.count.mockResolvedValue(0);
    prismaMock.studentRiskProfile.groupBy.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({ _max: { computedAt: null } } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);

    const result = await getStudentAnalyticsAction({});
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.retention.cohorts).toHaveLength(0);
  });
});
```

### Step 2: Verify RED

Run: `npx vitest run tests/unit/students/analytics.test.ts`
Expected: 2 new failing tests.

### Step 3: Implement

Add:

```ts
async function loadRetention(
  schoolId: string,
  programmeFilter: Record<string, unknown>,
): Promise<StudentAnalyticsPayload["retention"]> {
  // Load last 4 academic years (need pairs — so up to 3 cohort transitions).
  const years = await db.academicYear.findMany({
    where: { schoolId },
    orderBy: { startDate: "desc" },
    take: 4,
    select: { id: true, name: true, startDate: true },
  });
  if (years.length < 2) return { cohorts: [] };
  years.reverse(); // chronological

  const cohorts: StudentAnalyticsPayload["retention"]["cohorts"] = [];

  for (let i = 0; i < years.length - 1; i++) {
    const baseYear = years[i]!;
    const nextYear = years[i + 1]!;
    // Base-year ACTIVE enrollments by yearGroup.
    const baseEnrollments = await db.enrollment.findMany({
      where: {
        schoolId,
        academicYearId: baseYear.id,
        status: "ACTIVE",
        ...programmeFilter,
      },
      select: {
        studentId: true,
        classArm: { select: { class: { select: { yearGroup: true } } } },
      },
    });
    if (baseEnrollments.length === 0) continue;

    const byYearGroup = new Map<number, string[]>();
    for (const e of baseEnrollments) {
      const yg = e.classArm.class.yearGroup;
      if (!byYearGroup.has(yg)) byYearGroup.set(yg, []);
      byYearGroup.get(yg)!.push(e.studentId);
    }

    for (const [yearGroup, studentIds] of byYearGroup) {
      const retained = await db.enrollment.findMany({
        where: {
          schoolId,
          academicYearId: nextYear.id,
          status: "ACTIVE",
          studentId: { in: studentIds },
        },
        select: { studentId: true },
      });
      const startingCount = studentIds.length;
      const retainedCount = retained.length;
      cohorts.push({
        yearGroup,
        academicYearName: baseYear.name,
        startingCount,
        retainedCount,
        retentionPct: startingCount > 0
          ? Math.round((retainedCount / startingCount) * 1000) / 10
          : 0,
      });
    }
  }

  // Sort chronologically, then by yearGroup for deterministic order.
  cohorts.sort((a, b) =>
    a.academicYearName.localeCompare(b.academicYearName) || a.yearGroup - b.yearGroup,
  );

  return { cohorts };
}
```

Wire into Promise.all. Because of the sequential-per-cohort structure, `loadRetention` does its own internal awaits; keep it in the outer Promise.all so the overall action still parallelizes with other loaders.

```ts
const [kpis, enrollmentTrend, demographics, retention] = await Promise.all([
  loadKpis(ctx.schoolId, year.id, year.startDate, year.endDate, programmeFilter),
  loadEnrollmentTrend(ctx.schoolId, programmeFilter),
  loadDemographics(ctx.schoolId, year.id, programmeFilter),
  loadRetention(ctx.schoolId, programmeFilter),
]);
```

### Step 4: Verify GREEN

Run: `npx vitest run tests/unit/students/analytics.test.ts`
Expected: 9 passing.

### Step 5: Commit

```bash
git add .
git commit -m "feat(analytics): loadRetention per cohort across adjacent academic years"
```

---

## Task 8: `loadFreeShs` + `loadAtRisk`

**Files:**
- Modify: `src/modules/student/actions/analytics.action.ts`
- Modify: `tests/unit/students/analytics.test.ts`

### Step 1: Append failing tests

```ts
describe("loadFreeShs", () => {
  beforeEach(() => { __resetCacheForTests(); mockAuthenticatedUser(); });

  it("splits enrollments into Free SHS vs paying with percentage", async () => {
    const current = { id: "ay-1", schoolId: "default-school", isCurrent: true,
      startDate: new Date("2025-09-01"), endDate: new Date("2026-08-31"), name: "2025/2026" };
    prismaMock.academicYear.findFirst.mockResolvedValue(current as never);
    prismaMock.academicYear.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.groupBy.mockImplementation(async (args: any) => {
      if (args.by?.includes("isFreeShsPlacement")) {
        return [
          { isFreeShsPlacement: true,  _count: { _all: 30 } },
          { isFreeShsPlacement: false, _count: { _all: 70 } },
        ] as never;
      }
      return [] as never;
    });
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.enrollment.count.mockResolvedValue(0);
    prismaMock.studentRiskProfile.count.mockResolvedValue(0);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.groupBy.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({ _max: { computedAt: null } } as never);

    const result = await getStudentAnalyticsAction({});
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.freeShs).toEqual({ freeShsCount: 30, payingCount: 70, freeShsPct: 30 });
  });
});

describe("loadAtRisk", () => {
  beforeEach(() => { __resetCacheForTests(); mockAuthenticatedUser(); });

  it("aggregates risk levels + returns top 10 and hasAnyProfiles flag", async () => {
    const current = { id: "ay-1", schoolId: "default-school", isCurrent: true,
      startDate: new Date("2025-09-01"), endDate: new Date("2026-08-31"), name: "2025/2026" };
    prismaMock.academicYear.findFirst.mockResolvedValue(current as never);
    prismaMock.academicYear.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.groupBy.mockResolvedValue([] as never);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.enrollment.count.mockResolvedValue(0);
    prismaMock.studentRiskProfile.count.mockResolvedValue(0);
    prismaMock.studentRiskProfile.groupBy.mockResolvedValue([
      { riskLevel: "LOW",      _count: { _all: 50 } },
      { riskLevel: "CRITICAL", _count: { _all: 3 } },
    ] as never);
    prismaMock.studentRiskProfile.findMany.mockResolvedValue([
      { student: { id: "s-1", studentId: "SCH/1", firstName: "A", lastName: "B" },
        riskScore: 92, riskLevel: "CRITICAL" },
      { student: { id: "s-2", studentId: "SCH/2", firstName: "C", lastName: "D" },
        riskScore: 88, riskLevel: "CRITICAL" },
    ] as never);
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({
      _max: { computedAt: new Date("2026-04-20") },
    } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);

    const result = await getStudentAnalyticsAction({});
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.atRisk.byLevel).toHaveLength(2);
    expect(result.data.atRisk.topStudents).toHaveLength(2);
    expect(result.data.atRisk.topStudents[0]?.riskScore).toBe(92);
    expect(result.data.atRisk.hasAnyProfiles).toBe(true);
    expect(result.data.atRisk.computedAt).toEqual(new Date("2026-04-20"));
  });

  it("hasAnyProfiles: false when table empty for selected year", async () => {
    const current = { id: "ay-1", schoolId: "default-school", isCurrent: true,
      startDate: new Date("2025-09-01"), endDate: new Date("2026-08-31"), name: "2025/2026" };
    prismaMock.academicYear.findFirst.mockResolvedValue(current as never);
    prismaMock.academicYear.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.groupBy.mockResolvedValue([] as never);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.enrollment.count.mockResolvedValue(0);
    prismaMock.studentRiskProfile.count.mockResolvedValue(0);
    prismaMock.studentRiskProfile.groupBy.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({ _max: { computedAt: null } } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);

    const result = await getStudentAnalyticsAction({});
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.atRisk.hasAnyProfiles).toBe(false);
    expect(result.data.atRisk.computedAt).toBeNull();
  });
});
```

### Step 2: Verify RED

Run: `npx vitest run tests/unit/students/analytics.test.ts`
Expected: 3 new failing tests.

### Step 3: Implement

Add:

```ts
async function loadFreeShs(
  schoolId: string,
  academicYearId: string,
  programmeFilter: Record<string, unknown>,
): Promise<StudentAnalyticsPayload["freeShs"]> {
  const rows = await db.enrollment.groupBy({
    by: ["isFreeShsPlacement"],
    where: {
      schoolId,
      academicYearId,
      status: "ACTIVE",
      ...programmeFilter,
    },
    _count: { _all: true },
  });
  const freeShsCount = rows.find((r) => r.isFreeShsPlacement)?._count._all ?? 0;
  const payingCount = rows.find((r) => !r.isFreeShsPlacement)?._count._all ?? 0;
  const total = freeShsCount + payingCount;
  return {
    freeShsCount,
    payingCount,
    freeShsPct: total > 0 ? Math.round((freeShsCount / total) * 1000) / 10 : 0,
  };
}

async function loadAtRisk(
  schoolId: string,
  academicYearId: string,
): Promise<StudentAnalyticsPayload["atRisk"]> {
  const [byLevelRaw, topRaw, agg] = await Promise.all([
    db.studentRiskProfile.groupBy({
      by: ["riskLevel"],
      where: { schoolId, academicYearId },
      _count: { _all: true },
    }),
    db.studentRiskProfile.findMany({
      where: { schoolId, academicYearId },
      orderBy: { riskScore: "desc" },
      take: 10,
      include: {
        student: { select: { id: true, studentId: true, firstName: true, lastName: true } },
      },
    }),
    db.studentRiskProfile.aggregate({
      where: { schoolId, academicYearId },
      _max: { computedAt: true },
    }),
  ]);

  const byLevel = byLevelRaw.map((r) => ({
    riskLevel: r.riskLevel as "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
    count: r._count._all,
  }));
  const topStudents = topRaw.map((r) => ({
    studentId: r.student.id,
    studentCode: r.student.studentId,
    firstName: r.student.firstName,
    lastName: r.student.lastName,
    riskScore: r.riskScore,
    riskLevel: r.riskLevel as "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  }));
  const totalProfiles = byLevel.reduce((s, x) => s + x.count, 0);
  return {
    byLevel,
    topStudents,
    hasAnyProfiles: totalProfiles > 0,
    computedAt: agg._max.computedAt ?? null,
  };
}
```

Wire into Promise.all:

```ts
const [kpis, enrollmentTrend, demographics, retention, freeShs, atRisk] = await Promise.all([
  loadKpis(ctx.schoolId, year.id, year.startDate, year.endDate, programmeFilter),
  loadEnrollmentTrend(ctx.schoolId, programmeFilter),
  loadDemographics(ctx.schoolId, year.id, programmeFilter),
  loadRetention(ctx.schoolId, programmeFilter),
  loadFreeShs(ctx.schoolId, year.id, programmeFilter),
  loadAtRisk(ctx.schoolId, year.id),
]);
```

Update the returned payload to use the new values.

### Step 4: Verify GREEN

Run: `npx vitest run tests/unit/students/analytics.test.ts`
Expected: 12 passing.

### Step 5: Commit

```bash
git add .
git commit -m "feat(analytics): loadFreeShs + loadAtRisk"
```

---

## Task 9: `exportAnalyticsMetricAction`

**Files:**
- Modify: `src/modules/student/actions/analytics.action.ts`
- Modify: `tests/unit/students/analytics.test.ts`

### Step 1: Append failing test

```ts
import { exportAnalyticsMetricAction } from "@/modules/student/actions/analytics.action";

describe("exportAnalyticsMetricAction", () => {
  beforeEach(() => {
    __resetCacheForTests();
    mockAuthenticatedUser();
    // stub enough for the underlying getStudentAnalyticsAction call
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: "ay-1", schoolId: "default-school", isCurrent: true,
      startDate: new Date("2025-09-01"), endDate: new Date("2026-08-31"), name: "2025/2026",
    } as never);
    prismaMock.academicYear.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.groupBy.mockResolvedValue([] as never);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.enrollment.count.mockResolvedValue(0);
    prismaMock.studentRiskProfile.count.mockResolvedValue(0);
    prismaMock.studentRiskProfile.groupBy.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({ _max: { computedAt: null } } as never);
  });

  it("returns demographics.gender rows when requested", async () => {
    prismaMock.enrollment.findMany.mockResolvedValue([
      { student: { gender: "MALE", region: "A", religion: "X" } },
      { student: { gender: "FEMALE", region: "A", religion: "X" } },
    ] as never);

    const result = await exportAnalyticsMetricAction({ metric: "demographics.gender" });
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ gender: "MALE" }),
      expect.objectContaining({ gender: "FEMALE" }),
    ]));
  });

  it("rejects unknown metric names", async () => {
    const result = await exportAnalyticsMetricAction({
      metric: "not-a-metric" as never,
    });
    expect(result).toHaveProperty("error");
  });
});
```

### Step 2: Verify RED

Run: `npx vitest run tests/unit/students/analytics.test.ts`
Expected: 2 new failing tests.

### Step 3: Implement

Append:

```ts
import { exportAnalyticsMetricSchema } from "../schemas/analytics.schema";

/**
 * @no-audit Read-only export derived from cached analytics payload.
 */
export async function exportAnalyticsMetricAction(input: {
  metric:
    | "kpis"
    | "enrollmentTrend"
    | "demographics.gender"
    | "demographics.region"
    | "demographics.religion"
    | "retention"
    | "freeShs"
    | "atRisk";
  academicYearId?: string;
  programmeId?: string;
}): Promise<{ data: Array<Record<string, unknown>> } | { error: string }> {
  const parsed = exportAnalyticsMetricSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid metric" };

  const loaded = await getStudentAnalyticsAction({
    academicYearId: parsed.data.academicYearId,
    programmeId: parsed.data.programmeId,
  });
  if ("error" in loaded) return loaded;
  const p = loaded.data;

  switch (parsed.data.metric) {
    case "kpis":
      return { data: [p.kpis as unknown as Record<string, unknown>] };
    case "enrollmentTrend":
      return { data: p.enrollmentTrend };
    case "demographics.gender":
      return { data: p.demographics.byGender };
    case "demographics.region":
      return { data: p.demographics.byRegion };
    case "demographics.religion":
      return { data: p.demographics.byReligion };
    case "retention":
      return { data: p.retention.cohorts };
    case "freeShs":
      return { data: [p.freeShs as unknown as Record<string, unknown>] };
    case "atRisk":
      return { data: p.atRisk.topStudents };
  }
}
```

### Step 4: Verify GREEN

Run: `npx vitest run tests/unit/students/analytics.test.ts`
Expected: 14 passing.

### Step 5: Commit

```bash
git add .
git commit -m "feat(analytics): exportAnalyticsMetricAction (reuses cache)"
```

---

## Task 10: Integration test

**Files:**
- Create: `tests/integration/students/analytics.test.ts`

### Step 1: Write the test

Follow the pattern from `tests/integration/students/document-vault.test.ts` + `pdf-products.test.ts`. Seed a school + current academic year + programme + class arm + ~5 students with varied demographics + at least one StudentRiskProfile row + at least one Free SHS enrollment + at least one paying enrollment.

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  getStudentAnalyticsAction,
  exportAnalyticsMetricAction,
} from "@/modules/student/actions/analytics.action";
import { invalidateCachePrefix } from "@/lib/analytics-cache";
import { resolveSeededAdminId, loginAs } from "./setup";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Student analytics (integration)", () => {
  const db = new PrismaClient();
  const testTag = `analytics-test-${Date.now()}`;
  let academicYearId: string;
  let programmeId: string;
  let classArmId: string;
  const studentIds: string[] = [];
  const riskProfileIds: string[] = [];

  beforeAll(async () => {
    const adminId = await resolveSeededAdminId();
    loginAs({ id: adminId });

    // Seed: academic year, programme, class, arm
    // (Mirror existing integration test setup. Use `default-school` schoolId.)
    const year = await db.academicYear.findFirst({
      where: { schoolId: "default-school", isCurrent: true },
    });
    if (!year) throw new Error("Seed DB missing current year");
    academicYearId = year.id;

    const programme = await db.programme.create({
      data: {
        schoolId: "default-school",
        name: `${testTag}-Sci`,
        duration: 3,
      },
    });
    programmeId = programme.id;

    const klass = await db.class.create({
      data: {
        schoolId: "default-school",
        programmeId,
        academicYearId,
        yearGroup: 1,
        name: `${testTag}-SHS1 Sci`,
      },
    });
    const arm = await db.classArm.create({
      data: {
        classId: klass.id,
        schoolId: "default-school",
        name: "A",
        capacity: 50,
      },
    });
    classArmId = arm.id;

    // Seed 5 students
    for (let i = 0; i < 5; i++) {
      const s = await db.student.create({
        data: {
          schoolId: "default-school",
          studentId: `${testTag}/${i + 1}`,
          firstName: `A${i}`,
          lastName: "Test",
          dateOfBirth: new Date("2010-01-01"),
          gender: i % 2 === 0 ? "MALE" : "FEMALE",
          region: i === 0 ? "Greater Accra" : "Ashanti",
          religion: i < 3 ? "Christianity" : "Islam",
          boardingStatus: i % 2 === 0 ? "DAY" : "BOARDING",
        },
      });
      studentIds.push(s.id);
      await db.enrollment.create({
        data: {
          studentId: s.id,
          classArmId,
          schoolId: "default-school",
          academicYearId,
          isFreeShsPlacement: i < 2, // first 2 on Free SHS
        },
      });
    }

    // Seed one risk profile (HIGH)
    const term = await db.term.findFirst({ where: { academicYearId } });
    if (term) {
      const rp = await db.studentRiskProfile.create({
        data: {
          studentId: studentIds[0]!,
          schoolId: "default-school",
          academicYearId,
          termId: term.id,
          riskScore: 85,
          riskLevel: "HIGH",
          factors: {},
          recommendations: {},
        },
      });
      riskProfileIds.push(rp.id);
    }
  });

  afterAll(async () => {
    if (riskProfileIds.length > 0) {
      await db.studentRiskProfile.deleteMany({ where: { id: { in: riskProfileIds } } });
    }
    await db.enrollment.deleteMany({ where: { studentId: { in: studentIds } } });
    await db.student.deleteMany({ where: { id: { in: studentIds } } });
    await db.classArm.delete({ where: { id: classArmId } });
    await db.class.deleteMany({ where: { programmeId } });
    await db.programme.delete({ where: { id: programmeId } });
    invalidateCachePrefix("analytics:default-school");
    await db.$disconnect();
  });

  it("returns populated payload on first call, cached: true on second", async () => {
    const first = await getStudentAnalyticsAction({ academicYearId, programmeId });
    if (!("data" in first)) throw new Error(first.error);
    expect(first.data.cached).toBe(false);
    expect(first.data.kpis.totalActive).toBeGreaterThanOrEqual(5);
    expect(first.data.freeShs.freeShsCount).toBe(2);
    expect(first.data.freeShs.payingCount).toBe(3);
    expect(first.data.demographics.total).toBe(5);
    expect(first.data.atRisk.hasAnyProfiles).toBe(true);
    expect(first.data.atRisk.byLevel.find((b) => b.riskLevel === "HIGH")?.count).toBe(1);

    const second = await getStudentAnalyticsAction({ academicYearId, programmeId });
    if (!("data" in second)) throw new Error(second.error);
    expect(second.data.cached).toBe(true);
  });

  it("exportAnalyticsMetricAction returns shape matching the cached payload", async () => {
    const result = await exportAnalyticsMetricAction({
      metric: "demographics.gender",
      academicYearId,
      programmeId,
    });
    if (!("data" in result)) throw new Error(result.error);
    const total = result.data.reduce((s, r) => s + ((r.count as number) ?? 0), 0);
    expect(total).toBe(5);
  });
});
```

### Step 2: Run

Run: `npm run test:students`
Expected: all integration tests in the students suite pass (including new analytics test).

### Step 3: Commit

```bash
git add tests/integration/students/analytics.test.ts
git commit -m "test(analytics): integration lifecycle against live DB"
```

---

## Task 11: Server page + dropdown loaders

**Files:**
- Create: `src/app/(dashboard)/students/analytics/page.tsx`

### Step 1: Write server page

```tsx
// src/app/(dashboard)/students/analytics/page.tsx
import { getStudentAnalyticsAction } from "@/modules/student/actions/analytics.action";
import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { AnalyticsClient } from "./analytics-client";

export default async function StudentAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ academicYearId?: string; programmeId?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireSchoolContext();
  if ("error" in ctx) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {ctx.error}
        </div>
      </div>
    );
  }

  const [academicYears, programmes, result] = await Promise.all([
    db.academicYear.findMany({
      where: { schoolId: ctx.schoolId },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, isCurrent: true },
    }),
    db.programme.findMany({
      where: { schoolId: ctx.schoolId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getStudentAnalyticsAction({
      academicYearId: params.academicYearId,
      programmeId: params.programmeId,
    }),
  ]);

  const payload = "data" in result ? result.data : null;
  const error = "error" in result ? result.error : null;

  return (
    <AnalyticsClient
      academicYears={academicYears}
      programmes={programmes}
      selectedAcademicYearId={params.academicYearId}
      selectedProgrammeId={params.programmeId}
      payload={payload}
      error={error}
    />
  );
}
```

### Step 2: Verify tsc

Run: `npx tsc --noEmit`
Expected: fails because AnalyticsClient doesn't exist yet. OK — next task creates it.

### Step 3: Commit (deferred)

Commit together with Task 12 — server + client must land together.

---

## Task 12: Client shell + KPI tiles + export button helper

**Files:**
- Create: `src/app/(dashboard)/students/analytics/analytics-client.tsx`
- Create: `src/app/(dashboard)/students/analytics/kpi-tiles.tsx`
- Create: `src/app/(dashboard)/students/analytics/export-button.tsx`

### Step 1: Implement KPI tiles

```tsx
// src/app/(dashboard)/students/analytics/kpi-tiles.tsx
"use client";

import Link from "next/link";
import type { StudentAnalyticsPayload } from "@/modules/student/actions/analytics.action";

function Tile({ label, value, href, hint }: {
  label: string;
  value: string | number;
  href?: string;
  hint?: string;
}) {
  const card = (
    <div className="rounded-xl border border-border bg-card p-4 hover:bg-muted/30 transition">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {hint ? <div className="text-xs text-muted-foreground mt-1">{hint}</div> : null}
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

export function KpiTiles({ kpis }: { kpis: StudentAnalyticsPayload["kpis"] }) {
  const atRiskDisplay = kpis.atRiskCount > 0 ? kpis.atRiskCount : "—";
  const transitions = kpis.graduatedThisYear + kpis.withdrawnThisYear;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Tile label="Total Active" value={kpis.totalActive} href="/students?status=ACTIVE" />
      <Tile label="Day" value={kpis.dayStudents} href="/students?status=ACTIVE&boardingStatus=DAY" />
      <Tile label="Boarding" value={kpis.boardingStudents} href="/students?status=ACTIVE&boardingStatus=BOARDING" />
      <Tile label="Free SHS" value={kpis.freeShsCount} />
      <Tile
        label="At-Risk"
        value={atRiskDisplay}
        hint={kpis.atRiskCount > 0 ? "HIGH + CRITICAL" : "No profiles computed"}
        href="/analytics"
      />
      <Tile
        label="Graduated / Withdrawn (yr)"
        value={transitions}
        hint={`${kpis.graduatedThisYear} grad · ${kpis.withdrawnThisYear} withdrawn`}
      />
    </div>
  );
}
```

### Step 2: Implement export button

```tsx
// src/app/(dashboard)/students/analytics/export-button.tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { exportAnalyticsMetricAction } from "@/modules/student/actions/analytics.action";
import Papa from "papaparse";

type MetricName = Parameters<typeof exportAnalyticsMetricAction>[0]["metric"];

export function ExportCsvButton({
  metric,
  academicYearId,
  programmeId,
  label = "Export CSV",
}: {
  metric: MetricName;
  academicYearId?: string;
  programmeId?: string;
  label?: string;
}) {
  const [pending, start] = useTransition();

  const handleClick = () =>
    start(async () => {
      const res = await exportAnalyticsMetricAction({ metric, academicYearId, programmeId });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      if (res.data.length === 0) {
        toast.info("No data to export");
        return;
      }
      const csv = Papa.unparse(res.data);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${metric.replace(/\./g, "-")}-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });

  return (
    <button
      className="text-xs text-muted-foreground hover:text-foreground underline disabled:opacity-50"
      onClick={handleClick}
      disabled={pending}
    >
      {label}
    </button>
  );
}
```

### Step 3: Implement the client shell

```tsx
// src/app/(dashboard)/students/analytics/analytics-client.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { StudentAnalyticsPayload } from "@/modules/student/actions/analytics.action";
import { KpiTiles } from "./kpi-tiles";

// Charts — introduced in Task 13. For now, stub:
function ChartsPlaceholder() {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      Charts land in Task 13.
    </div>
  );
}

type Props = {
  academicYears: Array<{ id: string; name: string; isCurrent: boolean }>;
  programmes: Array<{ id: string; name: string }>;
  selectedAcademicYearId?: string;
  selectedProgrammeId?: string;
  payload: StudentAnalyticsPayload | null;
  error: string | null;
};

export function AnalyticsClient(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  const activeYearId =
    props.selectedAcademicYearId ??
    props.academicYears.find((y) => y.isCurrent)?.id ??
    props.academicYears[0]?.id ??
    "";

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams?.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    start(() => router.replace(`/students/analytics?${params.toString()}`));
  };

  const handleRefresh = () => {
    start(() => router.refresh());
  };

  if (props.error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {props.error}
        </div>
      </div>
    );
  }

  if (!props.payload) {
    return null;
  }

  const p = props.payload;
  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Student Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date(p.computedAt).toLocaleString()} ·{" "}
            {p.cached ? "cached" : "fresh"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={activeYearId}
            onChange={(e) => updateFilter("academicYearId", e.target.value)}
            disabled={pending}
          >
            {props.academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}{y.isCurrent ? " (current)" : ""}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={props.selectedProgrammeId ?? ""}
            onChange={(e) => updateFilter("programmeId", e.target.value || undefined)}
            disabled={pending}
          >
            <option value="">All programmes</option>
            {props.programmes.map((pr) => (
              <option key={pr.id} value={pr.id}>{pr.name}</option>
            ))}
          </select>
          <button
            className="h-10 rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50"
            onClick={handleRefresh}
            disabled={pending}
          >
            Refresh
          </button>
        </div>
      </div>

      <KpiTiles kpis={p.kpis} />
      <ChartsPlaceholder />
    </div>
  );
}
```

### Step 4: Verify tsc

Run: `npx tsc --noEmit`
Expected: clean.

### Step 5: Commit

```bash
git add src/app/\(dashboard\)/students/analytics/
git commit -m "feat(analytics): server page + client shell + KPI tiles"
```

---

## Task 13: 5 chart components

**Files:**
- Create: `src/app/(dashboard)/students/analytics/enrollment-trend-chart.tsx`
- Create: `src/app/(dashboard)/students/analytics/demographics-chart.tsx`
- Create: `src/app/(dashboard)/students/analytics/retention-chart.tsx`
- Create: `src/app/(dashboard)/students/analytics/free-shs-chart.tsx`
- Create: `src/app/(dashboard)/students/analytics/at-risk-section.tsx`
- Modify: `src/app/(dashboard)/students/analytics/analytics-client.tsx` — wire the charts in, drop the placeholder

### Step 1: Enrollment trend

```tsx
// src/app/(dashboard)/students/analytics/enrollment-trend-chart.tsx
"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { StudentAnalyticsPayload } from "@/modules/student/actions/analytics.action";
import { ExportCsvButton } from "./export-button";

export function EnrollmentTrendChart({
  data,
  academicYearId,
  programmeId,
}: {
  data: StudentAnalyticsPayload["enrollmentTrend"];
  academicYearId?: string;
  programmeId?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Enrollment Trend</h3>
          <p className="text-xs text-muted-foreground">Last 5 academic years, by outcome</p>
        </div>
        <ExportCsvButton
          metric="enrollmentTrend"
          academicYearId={academicYearId}
          programmeId={programmeId}
        />
      </div>
      {data.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No enrollment data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="academicYearName" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="active" stroke="#10b981" />
            <Line type="monotone" dataKey="promoted" stroke="#3b82f6" />
            <Line type="monotone" dataKey="graduated" stroke="#8b5cf6" />
            <Line type="monotone" dataKey="withdrawn" stroke="#ef4444" />
            <Line type="monotone" dataKey="transferred" stroke="#f59e0b" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

### Step 2: Demographics (tabbed)

```tsx
// src/app/(dashboard)/students/analytics/demographics-chart.tsx
"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { StudentAnalyticsPayload } from "@/modules/student/actions/analytics.action";
import { ExportCsvButton } from "./export-button";

type Tab = "gender" | "region" | "religion";

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#64748b",
  "#ec4899", "#14b8a6", "#eab308", "#0ea5e9", "#475569"];

export function DemographicsChart({
  demographics,
  academicYearId,
  programmeId,
}: {
  demographics: StudentAnalyticsPayload["demographics"];
  academicYearId?: string;
  programmeId?: string;
}) {
  const [tab, setTab] = useState<Tab>("gender");

  const data =
    tab === "gender"   ? demographics.byGender.map((r) => ({ label: r.gender, count: r.count })) :
    tab === "region"   ? demographics.byRegion.map((r) => ({ label: r.region, count: r.count })) :
                         demographics.byReligion.map((r) => ({ label: r.religion, count: r.count }));
  const metric = tab === "gender" ? "demographics.gender"
               : tab === "region" ? "demographics.region"
                                  : "demographics.religion";

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Demographics</h3>
          <p className="text-xs text-muted-foreground">Total: {demographics.total}</p>
        </div>
        <ExportCsvButton metric={metric} academicYearId={academicYearId} programmeId={programmeId} />
      </div>
      <div className="flex gap-1 text-xs">
        {(["gender", "region", "religion"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`rounded-md px-3 py-1 capitalize ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {data.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-25} height={60} textAnchor="end" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count">
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

### Step 3: Retention

```tsx
// src/app/(dashboard)/students/analytics/retention-chart.tsx
"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { StudentAnalyticsPayload } from "@/modules/student/actions/analytics.action";
import { ExportCsvButton } from "./export-button";

export function RetentionChart({
  retention,
  academicYearId,
  programmeId,
}: {
  retention: StudentAnalyticsPayload["retention"];
  academicYearId?: string;
  programmeId?: string;
}) {
  // Pivot: one line per yearGroup, x-axis = academicYearName
  const yearGroups = Array.from(new Set(retention.cohorts.map((c) => c.yearGroup))).sort();
  const data = Array.from(new Set(retention.cohorts.map((c) => c.academicYearName))).map((yr) => {
    const row: Record<string, string | number | null> = { yr };
    for (const yg of yearGroups) {
      const hit = retention.cohorts.find((c) => c.academicYearName === yr && c.yearGroup === yg);
      row[`yg${yg}`] = hit?.retentionPct ?? null;
    }
    return row;
  });
  const colors = ["#3b82f6", "#10b981", "#f59e0b"];

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Retention by Cohort</h3>
          <p className="text-xs text-muted-foreground">Year-over-year ACTIVE carry-over %</p>
        </div>
        <ExportCsvButton metric="retention" academicYearId={academicYearId} programmeId={programmeId} />
      </div>
      {retention.cohorts.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Retention data unavailable until next academic year completes
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="yr" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip />
            <Legend />
            {yearGroups.map((yg, i) => (
              <Line key={yg} type="monotone" dataKey={`yg${yg}`} name={`SHS ${yg}`}
                stroke={colors[i % colors.length]} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

### Step 4: Free SHS pie

```tsx
// src/app/(dashboard)/students/analytics/free-shs-chart.tsx
"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { StudentAnalyticsPayload } from "@/modules/student/actions/analytics.action";
import { ExportCsvButton } from "./export-button";

export function FreeShsChart({
  freeShs,
  academicYearId,
  programmeId,
}: {
  freeShs: StudentAnalyticsPayload["freeShs"];
  academicYearId?: string;
  programmeId?: string;
}) {
  const data = [
    { name: "Free SHS", value: freeShs.freeShsCount, fill: "#10b981" },
    { name: "Paying",   value: freeShs.payingCount,  fill: "#3b82f6" },
  ];
  const total = freeShs.freeShsCount + freeShs.payingCount;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Free SHS vs Paying</h3>
          <p className="text-xs text-muted-foreground">
            {freeShs.freeShsPct}% on Free SHS
          </p>
        </div>
        <ExportCsvButton metric="freeShs" academicYearId={academicYearId} programmeId={programmeId} />
      </div>
      {total === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

### Step 5: At-risk section

```tsx
// src/app/(dashboard)/students/analytics/at-risk-section.tsx
"use client";

import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { StudentAnalyticsPayload } from "@/modules/student/actions/analytics.action";
import { ExportCsvButton } from "./export-button";

const LEVEL_COLORS: Record<string, string> = {
  LOW: "#10b981",
  MODERATE: "#f59e0b",
  HIGH: "#ef4444",
  CRITICAL: "#7f1d1d",
};

export function AtRiskSection({
  atRisk,
  academicYearId,
  programmeId,
}: {
  atRisk: StudentAnalyticsPayload["atRisk"];
  academicYearId?: string;
  programmeId?: string;
}) {
  if (!atRisk.hasAnyProfiles) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 space-y-2">
        <h3 className="font-medium">At-Risk Distribution</h3>
        <p className="text-sm text-muted-foreground">
          No risk profiles computed yet. Compute them on the{" "}
          <Link href="/analytics" className="underline">AI Analytics page</Link>.
        </p>
      </div>
    );
  }

  const chartData = atRisk.byLevel.map((b) => ({ ...b, fill: LEVEL_COLORS[b.riskLevel] }));

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">At-Risk Students</h3>
          <p className="text-xs text-muted-foreground">
            Last computed: {atRisk.computedAt ? new Date(atRisk.computedAt).toLocaleString() : "—"}
          </p>
        </div>
        <ExportCsvButton metric="atRisk" academicYearId={academicYearId} programmeId={programmeId}
          label="Export top-10 CSV" />
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="riskLevel" tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count">
            {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {atRisk.topStudents.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="py-2">Student</th>
              <th className="py-2">ID</th>
              <th className="py-2">Level</th>
              <th className="py-2">Score</th>
            </tr>
          </thead>
          <tbody>
            {atRisk.topStudents.map((s) => (
              <tr key={s.studentId} className="border-t border-border">
                <td className="py-2">
                  <Link href={`/students/${s.studentId}`} className="hover:underline">
                    {s.lastName}, {s.firstName}
                  </Link>
                </td>
                <td className="py-2">{s.studentCode}</td>
                <td className="py-2">
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: `${LEVEL_COLORS[s.riskLevel]}20`, color: LEVEL_COLORS[s.riskLevel] }}>
                    {s.riskLevel}
                  </span>
                </td>
                <td className="py-2">{s.riskScore.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
```

### Step 6: Wire into client shell

Edit `analytics-client.tsx` — replace the `<ChartsPlaceholder />` with the real grid. At the top of the file, add imports:

```tsx
import { EnrollmentTrendChart } from "./enrollment-trend-chart";
import { DemographicsChart } from "./demographics-chart";
import { RetentionChart } from "./retention-chart";
import { FreeShsChart } from "./free-shs-chart";
import { AtRiskSection } from "./at-risk-section";
```

Replace the `<ChartsPlaceholder />` with:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <EnrollmentTrendChart
    data={p.enrollmentTrend}
    academicYearId={props.selectedAcademicYearId}
    programmeId={props.selectedProgrammeId}
  />
  <DemographicsChart
    demographics={p.demographics}
    academicYearId={props.selectedAcademicYearId}
    programmeId={props.selectedProgrammeId}
  />
  <RetentionChart
    retention={p.retention}
    academicYearId={props.selectedAcademicYearId}
    programmeId={props.selectedProgrammeId}
  />
  <FreeShsChart
    freeShs={p.freeShs}
    academicYearId={props.selectedAcademicYearId}
    programmeId={props.selectedProgrammeId}
  />
</div>
<AtRiskSection
  atRisk={p.atRisk}
  academicYearId={props.selectedAcademicYearId}
  programmeId={props.selectedProgrammeId}
/>
```

Remove the `ChartsPlaceholder` stub.

### Step 7: Verify

Run: `npx tsc --noEmit`
Expected: clean.

### Step 8: Commit

```bash
git add src/app/\(dashboard\)/students/analytics/
git commit -m "feat(analytics): 5 chart components + wiring"
```

---

## Task 14: Entry point from students list

**Files:**
- Modify: `src/app/(dashboard)/students/students-client.tsx`

### Step 1: Add toolbar button

Open `src/app/(dashboard)/students/students-client.tsx`. The toolbar contains "Add Student" + "Promotion" buttons (from earlier features). Add a new "Analytics" button right after "Promotion":

```tsx
<Link
  href="/students/analytics"
  className="rounded-lg border border-border bg-background px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-muted"
>
  Analytics
</Link>
```

Follow the exact class string used by the "Promotion" button (check the line immediately before to match).

### Step 2: Verify

Run: `npx tsc --noEmit`
Expected: clean.

### Step 3: Commit

```bash
git add src/app/\(dashboard\)/students/students-client.tsx
git commit -m "feat(analytics): add Analytics entry point on students list"
```

---

## Task 15: End-to-end verification

**Files:** verification only — no edits.

### Step 1: Full unit suite

Run: `npx vitest run`
Expected: all passing; confirm new files show expected counts:
- `tests/unit/lib/analytics-cache.test.ts` — 5 passing
- `tests/unit/students/analytics.test.ts` — 14 passing

### Step 2: Integration

Run: `npm run test:students`
Expected: passing (includes the new `analytics.test.ts`).

### Step 3: Audit guardrail

Run: `npx vitest run tests/unit/guardrails/audit-coverage.test.ts`
Expected: 2/2 passing. (Both analytics actions have `@no-audit` JSDoc — confirm they're not flagged.)

### Step 4: TypeScript check

Run: `npx tsc --noEmit`
Expected: clean.

### Step 5: Build

Run: `npm run build`
Expected: success. Confirm `/students/analytics` route compiles.

### Step 6: Lint

Run: `npm run lint`
Expected: no errors in new feature files.

### Step 7: Manual UI walk (when DB + dev server available)

1. Log in as admin → `/students` → click "Analytics" → lands on `/students/analytics`
2. Page renders with KPI tiles + 5 charts populated against seed data
3. Change Academic Year dropdown → URL updates, charts re-render
4. Change Programme dropdown → filtered counts visible
5. Click "Refresh" → timestamp advances; subtitle changes from "cached" to "fresh"
6. Click each "Export CSV" button → file downloads with correct columns
7. Click a KPI tile (e.g., "Boarding") → navigates to `/students?status=ACTIVE&boardingStatus=BOARDING`
8. Delete all `StudentRiskProfile` rows → reload → at-risk section shows empty-state link
9. Log in as a non-admin role → page returns 403-style error

No commit needed — evidence is passing tests + screenshots.

---

## Self-Review Checklist (plan author)

- [x] **Spec coverage**: each spec section mapped:
  - §3 architecture → Tasks 1 (indexes+perms), 2 (cache), 3 (zod), 4-8 (loaders), 11-12 (UI shell), 13 (charts)
  - §4 data shape → Task 4 defines `StudentAnalyticsPayload`; Tasks 5-8 populate each section
  - §5 server actions → Tasks 4 (main) and 9 (export)
  - §6 UI → Tasks 11, 12, 13, 14
  - §7 error handling → addressed inline in Task 4 (no current year), Tasks 13 (empty states per chart)
  - §8 testing → Task 2 (cache tests), Tasks 4-9 (action tests), Task 10 (integration), Task 15 (verification)
- [x] **No placeholders**: every code step has actual code; every command has expected output
- [x] **Type consistency**: `StudentAnalyticsPayload` shape used uniformly across loaders, export action, UI components. Metric names match between zod schema + switch statement + export button prop
- [x] **File paths**: all absolute
- [x] **TDD shape**: every action task has write-test → verify-fail → implement → verify-pass → commit. UI tasks skip tests per established convention (exercised by integration + manual QA)
