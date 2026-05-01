import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import { getStudentMissingDocsAction } from "@/modules/reports/actions/student-missing-docs.action";

describe("getStudentMissingDocsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    prismaMock.academicYear.findFirst.mockResolvedValue({ id: "ay1", isCurrent: true } as never);
  });

  it("rejects callers without REPORTS_ENROLLMENT_READ", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getStudentMissingDocsAction({});
    expect(result).toHaveProperty("error");
  });

  it("returns an error when result set exceeds 5000 rows", async () => {
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-1", name: "Birth Cert", isRequired: true, appliesTo: "ALL", expiryMonths: null, status: "ACTIVE", schoolId: "s1" },
    ] as never);
    prismaMock.enrollment.count.mockResolvedValue(5001 as never);
    const result = await getStudentMissingDocsAction({});
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/too large/i);
  });

  it("returns empty result when no required document types are configured", async () => {
    prismaMock.documentType.findMany.mockResolvedValue([] as never);
    const result = await getStudentMissingDocsAction({});
    expect(result).toHaveProperty("data");
    const data = (result as { data: { rows: unknown[]; note?: string } }).data;
    expect(data.rows).toEqual([]);
    expect(data.note).toContain("no required document types");
  });

  it("flags missing required documents for active students; respects appliesTo BOARDING_ONLY", async () => {
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-day", name: "Birth Certificate", isRequired: true, appliesTo: "ALL", expiryMonths: null, status: "ACTIVE", schoolId: "s1" },
      { id: "dt-board", name: "Boarding Medical", isRequired: true, appliesTo: "BOARDING_ONLY", expiryMonths: null, status: "ACTIVE", schoolId: "s1" },
    ] as never);
    prismaMock.enrollment.count.mockResolvedValue(2 as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      {
        student: {
          id: "s1", studentId: "S1", firstName: "A", lastName: "B", otherNames: null,
          boardingStatus: "DAY",
          studentDocuments: [],
        },
        classArm: { class: { name: "Form 1" }, name: "A" },
      },
      {
        student: {
          id: "s2", studentId: "S2", firstName: "C", lastName: "D", otherNames: null,
          boardingStatus: "BOARDING",
          studentDocuments: [{ documentTypeId: "dt-day", verificationStatus: "VERIFIED", expiresAt: null }],
        },
        classArm: { class: { name: "Form 1" }, name: "B" },
      },
    ] as never);

    const result = await getStudentMissingDocsAction({});
    expect(result).toHaveProperty("data");
    const rows = (result as { data: { rows: Array<{ studentId: string; missingTypes: string[] }> } }).data.rows;
    const day = rows.find((r) => r.studentId === "S1");
    const board = rows.find((r) => r.studentId === "S2");
    // DAY student: missing only Birth Certificate (ALL); not Boarding Medical
    expect(day!.missingTypes).toEqual(["Birth Certificate"]);
    // BOARDING student: only missing Boarding Medical
    expect(board!.missingTypes).toEqual(["Boarding Medical"]);
  });
});
