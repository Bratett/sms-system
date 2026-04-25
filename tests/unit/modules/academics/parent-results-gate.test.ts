import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { getChildResultsAction } from "@/modules/portal/actions/parent.action";

// NOTE: getChildResultsAction(studentId, termId) — positional args.
// verifyParentAccess calls db.guardian.findUnique then db.studentGuardian.findFirst.
// Return shape: { data: { terms, result, student, released, releaseId?, isAcknowledged? } }

const sampleTerms = [
  {
    id: "t-1",
    name: "Term 1",
    termNumber: 1,
    isCurrent: true,
    academicYear: { id: "ay-1", name: "2025/2026" },
    academicYearId: "ay-1",
    startDate: new Date(),
    endDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("getChildResultsAction (release gate)", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:results:read"] });

    // verifyParentAccess: guardian.findUnique + studentGuardian.findFirst
    prismaMock.guardian.findUnique.mockResolvedValue({
      id: "g-1",
      userId: "test-user-id",
      householdId: "hh-1",
    } as never);
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      guardianId: "g-1",
      studentId: "s-1",
    } as never);

    // term list always returns one term
    prismaMock.term.findMany.mockResolvedValue(sampleTerms as never);
    // no "current term" fallback needed — termId provided directly
  });

  it("returns released=false when no release row exists", async () => {
    // term lookup for academic year resolution
    prismaMock.term.findUnique.mockResolvedValue({ academicYearId: "ay-1" } as never);

    // enrollment lookup to get classArmId
    prismaMock.enrollment.findFirst.mockResolvedValue({
      classArmId: "arm-1",
      academicYearId: "ay-1",
      status: "ACTIVE",
    } as never);

    // student info
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s-1",
      studentId: "STU001",
      firstName: "Kofi",
      lastName: "Asante",
      otherNames: null,
    } as never);

    // no release row
    prismaMock.reportCardRelease.findUnique.mockResolvedValue(null as never);

    const res = await getChildResultsAction("s-1", "t-1");
    if (!("data" in res)) throw new Error("expected data, got: " + JSON.stringify(res));

    expect(res.data.released).toBe(false);
    // result should be null / empty when not released
    expect(res.data.result).toBeNull();
  });

  it("returns full results + released=true + isAcknowledged when release exists", async () => {
    // term lookup for academic year resolution
    prismaMock.term.findUnique.mockResolvedValue({ academicYearId: "ay-1" } as never);

    // enrollment lookup
    prismaMock.enrollment.findFirst.mockResolvedValue({
      classArmId: "arm-1",
      academicYearId: "ay-1",
      status: "ACTIVE",
    } as never);

    // student info
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s-1",
      studentId: "STU001",
      firstName: "Kofi",
      lastName: "Asante",
      otherNames: null,
    } as never);

    // release row exists
    prismaMock.reportCardRelease.findUnique.mockResolvedValue({
      id: "r-1",
      releasedAt: new Date(),
      schoolId: "default-school",
      termId: "t-1",
      classArmId: "arm-1",
    } as never);

    // acknowledgement exists (guardian already has householdId from findUnique mock above,
    // but the action looks up guardian again for householdId — ensure it returns the same)
    prismaMock.reportCardAcknowledgement.findUnique.mockResolvedValue({
      id: "ack-1",
    } as never);

    // terminal result with subject results
    prismaMock.terminalResult.findFirst.mockResolvedValue({
      id: "tr-1",
      studentId: "s-1",
      termId: "t-1",
      totalScore: 80,
      averageScore: 75,
      classPosition: 3,
      overallGrade: "B",
      teacherRemarks: "Good",
      headmasterRemarks: null,
      promotionStatus: "PROMOTED",
      subjectResults: [
        {
          id: "sr-1",
          classScore: 30,
          examScore: 50,
          totalScore: 80,
          grade: "A",
          interpretation: "Excellent",
          position: 1,
          subject: { id: "subj-1", name: "Math", code: "MTH" },
        },
      ],
    } as never);

    const res = await getChildResultsAction("s-1", "t-1");
    if (!("data" in res)) throw new Error("expected data, got: " + JSON.stringify(res));

    expect(res.data.released).toBe(true);
    expect(res.data.releaseId).toBe("r-1");
    expect(res.data.isAcknowledged).toBe(true);
    expect(res.data.result).not.toBeNull();
    expect(res.data.result?.subjectResults.length).toBeGreaterThan(0);
  });

  it("returns released=false when release.schoolId mismatches caller's school", async () => {
    // term lookup for academic year resolution
    prismaMock.term.findUnique.mockResolvedValue({ academicYearId: "ay-1" } as never);

    // enrollment lookup
    prismaMock.enrollment.findFirst.mockResolvedValue({ classArmId: "arm-1" } as never);

    // student info
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s-1",
      studentId: "STU001",
      firstName: "Kofi",
      lastName: "Asante",
      otherNames: null,
    } as never);

    // release exists but belongs to a different school
    prismaMock.reportCardRelease.findUnique.mockResolvedValue({
      id: "r-1",
      releasedAt: new Date(),
      schoolId: "OTHER-SCHOOL",
    } as never);

    const res = await getChildResultsAction("s-1", "t-1");
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.released).toBe(false);
  });

  it("returns released=true with isAcknowledged=false when no ack row exists", async () => {
    // term lookup for academic year resolution
    prismaMock.term.findUnique.mockResolvedValue({ academicYearId: "ay-1" } as never);

    // enrollment lookup
    prismaMock.enrollment.findFirst.mockResolvedValue({ classArmId: "arm-1" } as never);

    // student info
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s-1",
      studentId: "STU001",
      firstName: "Kofi",
      lastName: "Asante",
      otherNames: null,
    } as never);

    // release exists and matches the caller's school
    prismaMock.reportCardRelease.findUnique.mockResolvedValue({
      id: "r-1",
      releasedAt: new Date(),
      schoolId: "default-school",
    } as never);

    // no acknowledgement row
    prismaMock.reportCardAcknowledgement.findUnique.mockResolvedValue(null as never);

    // terminal result with no subject results
    prismaMock.terminalResult.findFirst.mockResolvedValue({
      id: "tr-1",
      studentId: "s-1",
      termId: "t-1",
      totalScore: 70,
      averageScore: 65,
      classPosition: 5,
      overallGrade: "C",
      teacherRemarks: null,
      headmasterRemarks: null,
      promotionStatus: "PROMOTED",
      subjectResults: [],
    } as never);

    const res = await getChildResultsAction("s-1", "t-1");
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.released).toBe(true);
    expect(res.data.isAcknowledged).toBe(false);
  });
});
