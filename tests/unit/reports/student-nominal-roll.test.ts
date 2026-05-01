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
