import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  getStudentAnalyticsAction,
  exportAnalyticsMetricAction,
} from "@/modules/student/actions/analytics.action";
import { invalidateCachePrefix } from "@/lib/analytics-cache";
import { resolveSeededAdminId, loginAs } from "./setup";

/**
 * Full-lifecycle integration test for the Student Analytics dashboard.
 *
 * Seeds a dedicated programme + class + arm + 5 students with varied
 * demographics (gender, region, religion, boarding status), 2 Free SHS
 * enrollments + 3 paying, and one StudentRiskProfile at HIGH risk level.
 *
 * Validates:
 *   - getStudentAnalyticsAction: first call is a cache miss, second is a hit
 *   - KPIs, freeShs, demographics, atRisk counts match seeded data
 *   - exportAnalyticsMetricAction returns rows summing to the seeded total
 *
 * Skips cleanly when DATABASE_URL is not configured.
 */

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Student analytics (integration)", () => {
  const db = new PrismaClient();
  const testTag = `analytics-test-${Date.now()}`;
  let academicYearId: string;
  let programmeId: string;
  let classArmId: string;
  let classId: string;
  const studentIds: string[] = [];
  const riskProfileIds: string[] = [];
  let termIdForRisk: string | null = null;

  beforeAll(async () => {
    const adminId = await resolveSeededAdminId();
    loginAs({ id: adminId });

    // ── 1. Resolve current academic year (must exist via seed) ──────────
    const year = await db.academicYear.findFirst({
      where: { schoolId: "default-school", isCurrent: true },
    });
    if (!year) throw new Error("Seed DB missing current academic year. Run: npm run db:seed");
    academicYearId = year.id;

    // ── 2. Programme ────────────────────────────────────────────────────
    const programme = await db.programme.create({
      data: {
        schoolId: "default-school",
        name: `${testTag}-Sci`,
        duration: 3,
      },
    });
    programmeId = programme.id;

    // ── 3. Class + ClassArm ─────────────────────────────────────────────
    const klass = await db.class.create({
      data: {
        schoolId: "default-school",
        programmeId,
        academicYearId,
        yearGroup: 1,
        name: `${testTag}-SHS1 Sci`,
      },
    });
    classId = klass.id;

    const arm = await db.classArm.create({
      data: {
        classId: klass.id,
        schoolId: "default-school",
        name: "A",
        capacity: 50,
      },
    });
    classArmId = arm.id;

    // ── 4. Students + Enrollments ───────────────────────────────────────
    // 5 students with varied demographics:
    //   gender alternates MALE/FEMALE
    //   region: 1 × Greater Accra, 4 × Ashanti
    //   religion: 3 × Christianity, 2 × Islam
    //   boarding: alternates DAY/BOARDING
    //   isFreeShsPlacement: first 2 = true, rest = false
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
          status: "ACTIVE",
        },
      });
      studentIds.push(s.id);

      await db.enrollment.create({
        data: {
          studentId: s.id,
          classArmId,
          schoolId: "default-school",
          academicYearId,
          status: "ACTIVE",
          isFreeShsPlacement: i < 2,
        },
      });
    }

    // ── 5. Risk profile (optional: requires a Term row) ─────────────────
    // Re-use an existing term for the academic year; if none exists the
    // risk-profile seed step is skipped and atRisk assertions are relaxed.
    const term = await db.term.findFirst({ where: { academicYearId } });
    if (term) {
      termIdForRisk = term.id;
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
    // Clean up in reverse dependency order.
    if (riskProfileIds.length > 0) {
      await db.studentRiskProfile
        .deleteMany({ where: { id: { in: riskProfileIds } } })
        .catch(() => {});
    }
    await db.enrollment
      .deleteMany({ where: { studentId: { in: studentIds } } })
      .catch(() => {});
    await db.student.deleteMany({ where: { id: { in: studentIds } } }).catch(() => {});
    await db.classArm.delete({ where: { id: classArmId } }).catch(() => {});
    await db.class.deleteMany({ where: { id: classId } }).catch(() => {});
    await db.programme.delete({ where: { id: programmeId } }).catch(() => {});

    // Evict any cache entries created during the test run.
    invalidateCachePrefix("analytics:default-school");

    await db.$disconnect();
  });

  it("returns populated payload on first call (cache miss) and cached:true on second call", async () => {
    // Ensure no stale cache from previous runs.
    invalidateCachePrefix("analytics:default-school");

    const first = await getStudentAnalyticsAction({ academicYearId, programmeId });
    if (!("data" in first)) throw new Error(first.error);

    expect(first.data.cached).toBe(false);

    // KPIs — 5 ACTIVE students enrolled in this programme.
    expect(first.data.kpis.totalActive).toBeGreaterThanOrEqual(5);

    // Free SHS: 2 free, 3 paying.
    expect(first.data.freeShs.freeShsCount).toBe(2);
    expect(first.data.freeShs.payingCount).toBe(3);

    // Demographics total equals enrollment count for the programme.
    expect(first.data.demographics.total).toBe(5);

    // atRisk depends on whether a Term row existed to seed the risk profile.
    if (termIdForRisk !== null) {
      expect(first.data.atRisk.hasAnyProfiles).toBe(true);
      const highBucket = first.data.atRisk.byLevel.find((b) => b.riskLevel === "HIGH");
      expect(highBucket?.count).toBeGreaterThanOrEqual(1);
    } else {
      // No Term → no risk profiles seeded; assert graceful empty result.
      expect(first.data.atRisk.hasAnyProfiles).toBe(false);
    }

    // Second call should hit the in-process cache.
    const second = await getStudentAnalyticsAction({ academicYearId, programmeId });
    if (!("data" in second)) throw new Error(second.error);
    expect(second.data.cached).toBe(true);

    // Cached payload values must be identical.
    expect(second.data.freeShs.freeShsCount).toBe(first.data.freeShs.freeShsCount);
    expect(second.data.demographics.total).toBe(first.data.demographics.total);
  });

  it("exportAnalyticsMetricAction(demographics.gender) returns rows summing to total enrollment", async () => {
    const result = await exportAnalyticsMetricAction({
      metric: "demographics.gender",
      academicYearId,
      programmeId,
    });
    if (!("data" in result)) throw new Error(result.error);

    const total = result.data.reduce((sum, row) => sum + ((row.count as number) ?? 0), 0);
    expect(total).toBe(5);
  });

  it("exportAnalyticsMetricAction(freeShs) returns a single summary row", async () => {
    const result = await exportAnalyticsMetricAction({
      metric: "freeShs",
      academicYearId,
      programmeId,
    });
    if (!("data" in result)) throw new Error(result.error);

    // freeShs metric returns a single KPI object wrapped in an array.
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ freeShsCount: 2, payingCount: 3 });
  });
});
