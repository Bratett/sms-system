import { describe, it, expect } from "vitest";
import { solveTimetable, type SolverConstraints } from "@/modules/timetable/lib/constraint-solver";

const defaultConstraints: SolverConstraints = {
  maxConsecutivePeriodsPerTeacher: 3,
  subjectFrequencyPerWeek: {},
  teacherAvailability: [],
  teacherPreferences: [],
};

describe("solveTimetable", () => {
  it("should place a single assignment across the week", () => {
    const result = solveTimetable({
      classArmIds: ["ca1"],
      assignments: [
        { staffId: "t1", subjectId: "s1", classArmId: "ca1", subjectName: "Math" },
      ],
      periods: [
        { id: "p1", name: "Period 1", order: 1 },
        { id: "p2", name: "Period 2", order: 2 },
      ],
      rooms: [{ id: "r1", name: "Room 1", features: [] }],
      days: [1, 2, 3, 4, 5],
      constraints: defaultConstraints,
      schoolId: "school-1",
      academicYearId: "ay1",
      termId: "t1",
    });

    expect(result.slots.length).toBeGreaterThan(0);
    expect(result.conflicts).toHaveLength(0);

    // All slots should be for the same class, teacher, subject
    for (const slot of result.slots) {
      expect(slot.classArmId).toBe("ca1");
      expect(slot.teacherId).toBe("t1");
      expect(slot.subjectId).toBe("s1");
    }
  });

  it("should respect subject frequency constraints", () => {
    const result = solveTimetable({
      classArmIds: ["ca1"],
      assignments: [
        { staffId: "t1", subjectId: "s1", classArmId: "ca1", subjectName: "Math" },
        { staffId: "t2", subjectId: "s2", classArmId: "ca1", subjectName: "English" },
      ],
      periods: [
        { id: "p1", name: "Period 1", order: 1 },
        { id: "p2", name: "Period 2", order: 2 },
      ],
      rooms: [{ id: "r1", name: "Room 1", features: [] }],
      days: [1, 2, 3, 4, 5],
      constraints: {
        ...defaultConstraints,
        subjectFrequencyPerWeek: {
          s1: 3, // Math 3x/week
          s2: 2, // English 2x/week
        },
      },
      schoolId: "school-1",
      academicYearId: "ay1",
      termId: "t1",
    });

    const mathSlots = result.slots.filter((s) => s.subjectId === "s1");
    const engSlots = result.slots.filter((s) => s.subjectId === "s2");

    expect(mathSlots).toHaveLength(3);
    expect(engSlots).toHaveLength(2);
  });

  it("should avoid teacher double-booking across classes", () => {
    const result = solveTimetable({
      classArmIds: ["ca1", "ca2"],
      assignments: [
        { staffId: "t1", subjectId: "s1", classArmId: "ca1", subjectName: "Math" },
        { staffId: "t1", subjectId: "s1", classArmId: "ca2", subjectName: "Math" },
      ],
      periods: [
        { id: "p1", name: "Period 1", order: 1 },
      ],
      rooms: [],
      days: [1, 2],
      constraints: {
        ...defaultConstraints,
        subjectFrequencyPerWeek: { s1: 1 },
      },
      schoolId: "school-1",
      academicYearId: "ay1",
      termId: "t1",
    });

    // Teacher t1 should never be in two places at once
    const slotKeys = result.slots.map((s) => `${s.dayOfWeek}-${s.periodId}-${s.teacherId}`);
    const uniqueKeys = new Set(slotKeys);
    expect(slotKeys.length).toBe(uniqueKeys.size);
  });

  it("should respect teacher availability constraints", () => {
    const result = solveTimetable({
      classArmIds: ["ca1"],
      assignments: [
        { staffId: "t1", subjectId: "s1", classArmId: "ca1", subjectName: "Math" },
      ],
      periods: [
        { id: "p1", name: "Period 1", order: 1 },
        { id: "p2", name: "Period 2", order: 2 },
      ],
      rooms: [],
      days: [1, 2, 3],
      constraints: {
        ...defaultConstraints,
        subjectFrequencyPerWeek: { s1: 3 },
        teacherAvailability: [
          // Teacher unavailable on Monday period 1
          { teacherId: "t1", dayOfWeek: 1, periodId: "p1", isAvailable: false },
        ],
      },
      schoolId: "school-1",
      academicYearId: "ay1",
      termId: "t1",
    });

    // Should not place t1 on Monday period 1
    const mondayP1 = result.slots.find(
      (s) => s.dayOfWeek === 1 && s.periodId === "p1" && s.teacherId === "t1",
    );
    expect(mondayP1).toBeUndefined();
  });

  it("should handle empty assignments gracefully", () => {
    const result = solveTimetable({
      classArmIds: ["ca1"],
      assignments: [],
      periods: [{ id: "p1", name: "Period 1", order: 1 }],
      rooms: [],
      days: [1, 2, 3, 4, 5],
      constraints: defaultConstraints,
      schoolId: "school-1",
      academicYearId: "ay1",
      termId: "t1",
    });

    expect(result.slots).toHaveLength(0);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it("should assign rooms when available", () => {
    const result = solveTimetable({
      classArmIds: ["ca1"],
      assignments: [
        { staffId: "t1", subjectId: "s1", classArmId: "ca1", subjectName: "Math" },
      ],
      periods: [{ id: "p1", name: "Period 1", order: 1 }],
      rooms: [
        { id: "r1", name: "Room 1", features: [] },
        { id: "r2", name: "Room 2", features: [] },
      ],
      days: [1],
      constraints: {
        ...defaultConstraints,
        subjectFrequencyPerWeek: { s1: 1 },
      },
      schoolId: "school-1",
      academicYearId: "ay1",
      termId: "t1",
    });

    expect(result.slots).toHaveLength(1);
    expect(result.slots[0].roomId).toBe("r1");
  });

  it("should not schedule same subject more than twice per day for same class", () => {
    const result = solveTimetable({
      classArmIds: ["ca1"],
      assignments: [
        { staffId: "t1", subjectId: "s1", classArmId: "ca1", subjectName: "Math" },
      ],
      periods: [
        { id: "p1", name: "Period 1", order: 1 },
        { id: "p2", name: "Period 2", order: 2 },
        { id: "p3", name: "Period 3", order: 3 },
        { id: "p4", name: "Period 4", order: 4 },
      ],
      rooms: [],
      days: [1],
      constraints: {
        ...defaultConstraints,
        subjectFrequencyPerWeek: { s1: 4 },
      },
      schoolId: "school-1",
      academicYearId: "ay1",
      termId: "t1",
    });

    // Should place at most 2 on Monday
    const mondaySlots = result.slots.filter((s) => s.dayOfWeek === 1 && s.subjectId === "s1");
    expect(mondaySlots.length).toBeLessThanOrEqual(2);
  });
});
