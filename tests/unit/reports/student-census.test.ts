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
