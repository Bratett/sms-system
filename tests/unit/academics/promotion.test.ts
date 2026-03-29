import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { getPromotionCandidatesAction } from "@/modules/academics/actions/promotion.action";

describe("getPromotionCandidatesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getPromotionCandidatesAction("ca-1", "ay-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no terms found", async () => {
    prismaMock.term.findMany.mockResolvedValue([]);

    const result = await getPromotionCandidatesAction("ca-1", "ay-1");
    expect(result).toEqual({ error: "No terms found for this academic year." });
  });

  it("should return error if no enrollments found", async () => {
    prismaMock.term.findMany.mockResolvedValue([
      { id: "t-1", termNumber: 1 },
    ] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([]);

    const result = await getPromotionCandidatesAction("ca-1", "ay-1");
    expect(result).toEqual({ error: "No active students enrolled in this class arm." });
  });

  it("should use database promotion rules instead of hardcoded values", async () => {
    // Setup terms
    prismaMock.term.findMany.mockResolvedValue([
      { id: "t-1", termNumber: 1 },
    ] as never);

    // Setup enrollments with one student
    prismaMock.enrollment.findMany.mockResolvedValue([
      {
        studentId: "s-1",
        student: {
          id: "s-1",
          studentId: "SCH/2025/0001",
          firstName: "Kofi",
          lastName: "Mensah",
          status: "ACTIVE",
        },
      },
    ] as never);

    // Default grading scale
    prismaMock.gradingScale.findFirst.mockResolvedValue({
      id: "gs-1",
      gradeDefinitions: [
        { grade: "F9", minScore: 0, maxScore: 44 },
        { grade: "A1", minScore: 80, maxScore: 100 },
      ],
    } as never);

    // Terminal results - student average of 45 (passes with default 40, fails with custom 50)
    prismaMock.terminalResult.findMany.mockResolvedValue([
      {
        termId: "t-1",
        averageScore: 45,
        classPosition: 5,
        subjectResults: [
          { grade: "D7" }, // Pass
          { grade: "F9" }, // Fail
        ],
      },
    ] as never);

    // ClassArm lookup for promotion rule
    prismaMock.classArm.findUnique.mockResolvedValue({
      id: "ca-1",
      class: { yearGroup: 1 },
    } as never);

    // Custom promotion rule with higher pass mark
    prismaMock.promotionRule.findFirst.mockResolvedValue({
      passAverage: 50,
      maxFailingSubjects: 2,
    } as never);

    const result = await getPromotionCandidatesAction("ca-1", "ay-1");
    expect(result.error).toBeUndefined();
    expect(result.data).toHaveLength(1);

    const candidate = result.data![0];
    // With passAverage=50, student average=45 should be RETAINED
    expect(candidate.recommendation).toBe("RETAINED");
    expect(candidate.cumulativeAverage).toBe(45);
  });

  it("should use default rules (40/3) when no promotion rule exists", async () => {
    prismaMock.term.findMany.mockResolvedValue([{ id: "t-1", termNumber: 1 }] as never);

    prismaMock.enrollment.findMany.mockResolvedValue([
      {
        studentId: "s-1",
        student: {
          id: "s-1",
          studentId: "SCH/2025/0001",
          firstName: "Ama",
          lastName: "Owusu",
          status: "ACTIVE",
        },
      },
    ] as never);

    prismaMock.gradingScale.findFirst.mockResolvedValue({
      id: "gs-1",
      gradeDefinitions: [{ grade: "F9", minScore: 0, maxScore: 44 }],
    } as never);

    // Student passes with default criteria (avg=55, 1 fail)
    prismaMock.terminalResult.findMany.mockResolvedValue([
      {
        termId: "t-1",
        averageScore: 55,
        classPosition: 3,
        subjectResults: [
          { grade: "C6" },
          { grade: "F9" },
          { grade: "B3" },
        ],
      },
    ] as never);

    prismaMock.classArm.findUnique.mockResolvedValue({
      id: "ca-1",
      class: { yearGroup: 2 },
    } as never);

    // No custom rule — defaults apply
    prismaMock.promotionRule.findFirst.mockResolvedValue(null);

    const result = await getPromotionCandidatesAction("ca-1", "ay-1");
    expect(result.error).toBeUndefined();
    expect(result.data![0].recommendation).toBe("PROMOTED");
  });

  it("should recommend GRADUATED for SHS 3 students", async () => {
    prismaMock.term.findMany.mockResolvedValue([{ id: "t-1", termNumber: 1 }] as never);

    prismaMock.enrollment.findMany.mockResolvedValue([
      {
        studentId: "s-1",
        student: {
          id: "s-1",
          studentId: "SCH/2023/0001",
          firstName: "Kwame",
          lastName: "Asante",
          status: "ACTIVE",
        },
      },
    ] as never);

    prismaMock.gradingScale.findFirst.mockResolvedValue({
      id: "gs-1",
      gradeDefinitions: [{ grade: "F9", minScore: 0, maxScore: 44 }],
    } as never);

    prismaMock.terminalResult.findMany.mockResolvedValue([
      {
        termId: "t-1",
        averageScore: 60,
        classPosition: 1,
        subjectResults: [{ grade: "C5" }],
      },
    ] as never);

    // Year group 3 = graduating class
    prismaMock.classArm.findUnique.mockResolvedValue({
      id: "ca-1",
      class: { yearGroup: 3 },
    } as never);

    prismaMock.promotionRule.findFirst.mockResolvedValue(null);

    const result = await getPromotionCandidatesAction("ca-1", "ay-1");
    expect(result.data![0].recommendation).toBe("GRADUATED");
  });
});
