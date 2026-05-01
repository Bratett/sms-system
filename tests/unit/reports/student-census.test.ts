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

  it("does not collapse classes that share a display name across programmes", async () => {
    prismaMock.enrollment.findMany.mockResolvedValue([
      { student: { gender: "MALE", boardingStatus: "DAY", region: null, religion: null }, classArm: { class: { id: "c-sci", name: "Form 1", programmeId: "p-sci" } } },
      { student: { gender: "FEMALE", boardingStatus: "DAY", region: null, religion: null }, classArm: { class: { id: "c-arts", name: "Form 1", programmeId: "p-arts" } } },
    ] as never);
    prismaMock.programme.findMany.mockResolvedValue([] as never);

    const result = await getStudentCensusAction({ groupBy: "class" });
    expect(result).toHaveProperty("data");
    const rows = (result as { data: { rows: Array<Record<string, unknown>> } }).data.rows;
    // Two classes with the same display name but different ids should bucket separately
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.groupLabel === "Form 1")).toBe(true);
    const keys = rows.map((r) => r.groupKey).sort();
    expect(keys).toEqual(["c-arts", "c-sci"]);
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
