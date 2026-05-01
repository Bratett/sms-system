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
