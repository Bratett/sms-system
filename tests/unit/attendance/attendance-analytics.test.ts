import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  getAttendanceByDayAction,
  getChronicAbsenteeismAction,
  getAttendanceTrendAction,
} from "@/modules/attendance/actions/attendance-analytics.action";

// ─── getAttendanceByDayAction ─────────────────────────────────────────

describe("getAttendanceByDayAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAttendanceByDayAction("term-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject when term not found", async () => {
    prismaMock.term.findUnique.mockResolvedValue(null);
    const result = await getAttendanceByDayAction("nonexistent");
    expect(result).toEqual({ error: "Term not found." });
  });

  it("should calculate attendance rate per day of week", async () => {
    prismaMock.term.findUnique.mockResolvedValue({
      id: "term-1",
      startDate: new Date("2026-01-06"), // Monday
      endDate: new Date("2026-03-27"),
    } as never);

    // Use known days: 2026-01-05 is Monday (getDay()=1), 2026-01-09 is Friday (getDay()=5)
    const mondayDate = new Date("2026-01-05T12:00:00Z");
    const fridayDate = new Date("2026-01-09T12:00:00Z");

    prismaMock.attendanceRegister.findMany.mockResolvedValue([
      {
        date: mondayDate,
        classArmId: "ca1",
        records: [
          { status: "PRESENT" },
          { status: "PRESENT" },
          { status: "ABSENT" },
        ],
      },
      {
        date: fridayDate,
        classArmId: "ca1",
        records: [
          { status: "PRESENT" },
          { status: "LATE" },
          { status: "ABSENT" },
        ],
      },
    ] as never);

    const result = await getAttendanceByDayAction("term-1");
    expect(result.data).toBeDefined();
    expect(result.data!.length).toBe(2);

    // Monday: 2 present out of 3 = 67%
    const monday = result.data!.find((d) => d.dayOfWeek === 1);
    expect(monday?.attendanceRate).toBe(67);

    // Friday: 2 (present+late) out of 3 = 67%
    const friday = result.data!.find((d) => d.dayOfWeek === 5);
    expect(friday?.attendanceRate).toBe(67);
  });
});

// ─── getChronicAbsenteeismAction ──────────────────────────────────────

describe("getChronicAbsenteeismAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should identify chronically absent students", async () => {
    prismaMock.term.findUnique.mockResolvedValue({
      id: "term-1",
      startDate: new Date("2026-01-06"),
      endDate: new Date("2026-03-27"),
    } as never);

    prismaMock.attendanceRegister.findMany.mockResolvedValue([
      {
        classArmId: "ca1",
        records: [
          { studentId: "s1", status: "ABSENT" },
          { studentId: "s2", status: "PRESENT" },
        ],
      },
      {
        classArmId: "ca1",
        records: [
          { studentId: "s1", status: "ABSENT" },
          { studentId: "s2", status: "PRESENT" },
        ],
      },
    ] as never);

    prismaMock.student.findMany.mockResolvedValue([
      { id: "s1", firstName: "Absent", lastName: "Student", studentId: "SCH/0001" },
    ] as never);

    const result = await getChronicAbsenteeismAction("term-1", 50);
    expect(result.data).toBeDefined();
    expect(result.data!.chronicallyAbsentCount).toBe(1);
    expect(result.data!.students[0].studentName).toBe("Absent Student");
    expect(result.data!.students[0].absenceRate).toBe(100);
  });

  it("should return empty when no students exceed threshold", async () => {
    prismaMock.term.findUnique.mockResolvedValue({
      id: "term-1",
      startDate: new Date("2026-01-06"),
      endDate: new Date("2026-03-27"),
    } as never);

    prismaMock.attendanceRegister.findMany.mockResolvedValue([
      {
        classArmId: "ca1",
        records: [
          { studentId: "s1", status: "PRESENT" },
          { studentId: "s2", status: "PRESENT" },
        ],
      },
    ] as never);

    const result = await getChronicAbsenteeismAction("term-1");
    expect(result.data!.chronicallyAbsentCount).toBe(0);
    expect(result.data!.students).toHaveLength(0);
  });
});

// ─── getAttendanceTrendAction ─────────────────────────────────────────

describe("getAttendanceTrendAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should return weekly trend data", async () => {
    prismaMock.term.findUnique.mockResolvedValue({
      id: "term-1",
      startDate: new Date("2026-01-06"),
      endDate: new Date("2026-01-20"),
    } as never);

    prismaMock.attendanceRegister.findMany.mockResolvedValue([
      {
        date: new Date("2026-01-06"), // Week 1
        classArmId: "ca1",
        records: [
          { status: "PRESENT" },
          { status: "PRESENT" },
        ],
      },
      {
        date: new Date("2026-01-13"), // Week 2
        classArmId: "ca1",
        records: [
          { status: "PRESENT" },
          { status: "ABSENT" },
        ],
      },
    ] as never);

    const result = await getAttendanceTrendAction("term-1");
    expect(result.data).toBeDefined();
    expect(result.data!.length).toBe(2);
    expect(result.data![0].attendanceRate).toBe(100); // Week 1: 2/2
    expect(result.data![1].attendanceRate).toBe(50); // Week 2: 1/2
  });
});
