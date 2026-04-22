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
    prismaMock.studentRiskProfile.aggregate.mockResolvedValue({ _max: { computedAt: null } } as never);

    const first = await getStudentAnalyticsAction({ academicYearId: validYearId });
    const second = await getStudentAnalyticsAction({ academicYearId: validYearId });

    if (!("data" in first) || !("data" in second)) throw new Error("expected data");
    expect(first.data.cached).toBe(false);
    expect(second.data.cached).toBe(true);
  });
});
