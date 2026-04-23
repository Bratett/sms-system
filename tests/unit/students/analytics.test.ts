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
    expect(result).toEqual({ error: "Insufficient permissions" });
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

    prismaMock.student.count
      .mockResolvedValueOnce(120)  // totalActive
      .mockResolvedValueOnce(80)   // dayStudents
      .mockResolvedValueOnce(40)   // boardingStudents
      .mockResolvedValueOnce(5)    // graduatedThisYear
      .mockResolvedValueOnce(3);   // withdrawnThisYear
    prismaMock.enrollment.count.mockResolvedValue(50);
    prismaMock.studentRiskProfile.count.mockResolvedValue(12);

    prismaMock.academicYear.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.groupBy.mockResolvedValue([] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.groupBy.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.findMany.mockResolvedValue([] as never);
    prismaMock.student.findMany.mockResolvedValue([] as never);
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

  it("applies programme filter to student-level counts when programmeId given", async () => {
    const validCuid = "cjld2cyuq0000t3rmniod1foy";
    const progCuid  = "cjld2cyuq0001t3rmniod1foz";
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: validCuid, schoolId: "default-school", startDate: new Date("2025-09-01"),
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
    prismaMock.student.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({ _max: { computedAt: null } } as never);

    await getStudentAnalyticsAction({ academicYearId: validCuid, programmeId: progCuid });

    // totalActive query (first call) should include the enrollments -> classArm -> class -> programmeId filter
    const firstCall = prismaMock.student.count.mock.calls[0]![0];
    expect(firstCall.where).toMatchObject({
      schoolId: "default-school",
      status: "ACTIVE",
      enrollments: {
        some: {
          academicYearId: validCuid,
          classArm: { class: { programmeId: progCuid } },
        },
      },
    });
  });

  it("second call with same filters returns cached: true", async () => {
    // Must be a valid CUID (zod validates it)
    const validYearId = "cjld2cyuq0000t3rmniod1foy";
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: validYearId, schoolId: "default-school", startDate: new Date("2025-09-01"),
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
    prismaMock.student.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({ _max: { computedAt: null } } as never);

    const first = await getStudentAnalyticsAction({ academicYearId: validYearId });
    const second = await getStudentAnalyticsAction({ academicYearId: validYearId });

    if (!("data" in first) || !("data" in second)) throw new Error("expected data");
    expect(first.data.cached).toBe(false);
    expect(second.data.cached).toBe(true);
  });
});

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
    prismaMock.student.findMany.mockResolvedValue([] as never);
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

describe("loadDemographics", () => {
  beforeEach(() => {
    __resetCacheForTests();
    mockAuthenticatedUser();
  });

  it("aggregates gender/region/religion from active enrollments; rolls rare values into Other", async () => {
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
    prismaMock.student.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({ _max: { computedAt: null } } as never);
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
    prismaMock.student.findMany.mockResolvedValue([] as never);
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
    // Two-step: findMany returns risk profiles (no nested student)
    prismaMock.studentRiskProfile.findMany.mockResolvedValue([
      { studentId: "s-1", riskScore: 92, riskLevel: "CRITICAL" },
      { studentId: "s-2", riskScore: 88, riskLevel: "CRITICAL" },
    ] as never);
    // Two-step: student.findMany returns the matching students
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-1", studentId: "SCH/1", firstName: "A", lastName: "B" },
      { id: "s-2", studentId: "SCH/2", firstName: "C", lastName: "D" },
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
    prismaMock.student.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({ _max: { computedAt: null } } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);

    const result = await getStudentAnalyticsAction({});
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.atRisk.hasAnyProfiles).toBe(false);
    expect(result.data.atRisk.computedAt).toBeNull();
  });

  it("applies programme filter via studentId in-list when programmeId is given", async () => {
    const validAyId = "cjld2cyuq0000t3rmniod1foy";
    const progId    = "cjld2cyuq0001t3rmniod1foz";
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: validAyId, schoolId: "default-school", isCurrent: true,
      startDate: new Date("2025-09-01"), endDate: new Date("2026-08-31"), name: "2025/2026",
    } as never);
    prismaMock.academicYear.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.groupBy.mockResolvedValue([] as never);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.enrollment.count.mockResolvedValue(0);
    prismaMock.studentRiskProfile.count.mockResolvedValue(0);
    prismaMock.enrollment.findMany.mockImplementation(async (args: any) => {
      // Demographics query selects the nested student object; return empty so it
      // doesn't crash. The programme-filter query (for getStudentIdsInProgramme)
      // selects only studentId — return the two scoped students for that call.
      if (args?.select?.student) return [] as never;
      return [{ studentId: "s-1" }, { studentId: "s-2" }] as never;
    });
    prismaMock.student.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.groupBy.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({ _max: { computedAt: null } } as never);

    await getStudentAnalyticsAction({ academicYearId: validAyId, programmeId: progId });

    // The loadAtRisk risk-profile queries should include studentId: { in: [...] }
    const groupByArgs = prismaMock.studentRiskProfile.groupBy.mock.calls[0]![0];
    expect(groupByArgs.where).toMatchObject({ studentId: { in: ["s-1", "s-2"] } });
  });
});

describe("loadRetention", () => {
  beforeEach(() => {
    __resetCacheForTests();
    mockAuthenticatedUser();
  });

  it("computes per-cohort retention from consecutive academic year enrollments", async () => {
    const current = { id: "ay-2", schoolId: "default-school", isCurrent: true,
      startDate: new Date("2026-09-01"), endDate: new Date("2027-08-31"), name: "2026/2027" };
    prismaMock.academicYear.findFirst.mockResolvedValue(current as never);
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
    prismaMock.student.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({ _max: { computedAt: null } } as never);
    prismaMock.enrollment.findMany.mockImplementation(async (args: any) => {
      // Retention retained-check: where has studentId.in array
      if (args?.where?.studentId?.in) {
        return [
          { studentId: "s-1" }, { studentId: "s-2" }, { studentId: "s-3" },
          { studentId: "s-4" }, { studentId: "s-5" }, { studentId: "s-6" },
          { studentId: "s-7" }, { studentId: "s-8" },
        ];
      }
      // Retention base-year query: select includes classArm
      if (args?.select?.classArm) {
        return [
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
        ];
      }
      // Demographics query: select includes student
      return [];
    });

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
    prismaMock.student.findMany.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({ _max: { computedAt: null } } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);

    const result = await getStudentAnalyticsAction({});
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.retention.cohorts).toHaveLength(0);
  });
});
