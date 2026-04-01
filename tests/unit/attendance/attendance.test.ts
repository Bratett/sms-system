import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  openAttendanceRegisterAction,
  getAttendanceRegisterAction,
  recordAttendanceAction,
  closeAttendanceRegisterAction,
  getAttendanceHistoryAction,
  getAttendanceSummaryAction,
  getStudentAttendanceAction,
} from "@/modules/attendance/actions/attendance.action";

// ─── openAttendanceRegisterAction ──────────────────────────────────

describe("openAttendanceRegisterAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await openAttendanceRegisterAction({
      classArmId: "ca-1",
      date: "2026-03-15",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return existing register if one exists", async () => {
    const existingRegister = {
      id: "reg-1",
      classArmId: "ca-1",
      date: new Date("2026-03-15"),
      type: "DAILY",
      status: "OPEN",
      takenBy: "test-user-id",
      records: [
        {
          id: "rec-1",
          studentId: "s1",
          status: "PRESENT",
          remarks: null,
        },
      ],
    };

    prismaMock.attendanceRegister.findFirst.mockResolvedValue(existingRegister as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      {
        student: {
          id: "s1",
          studentId: "SCH/2026/0001",
          firstName: "Kwame",
          lastName: "Asante",
          photoUrl: null,
        },
      },
    ] as never);

    const result = await openAttendanceRegisterAction({
      classArmId: "ca-1",
      date: "2026-03-15",
    });

    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.isExisting).toBe(true);
    expect(data.register).toMatchObject({ id: "reg-1", status: "OPEN" });
    expect(data.records).toHaveLength(1);
    expect(data.students).toHaveLength(1);
  });

  it("should create new register if none exists", async () => {
    prismaMock.school.findFirst.mockResolvedValue({ id: "school-1" } as never);
    prismaMock.attendanceRegister.findFirst.mockResolvedValue(null as never);
    prismaMock.attendanceRegister.create.mockResolvedValue({
      id: "reg-new",
      classArmId: "ca-1",
      date: new Date("2026-03-15"),
      type: "DAILY",
      status: "OPEN",
      takenBy: "test-user-id",
    } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);

    const result = await openAttendanceRegisterAction({
      classArmId: "ca-1",
      date: "2026-03-15",
    });

    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.isExisting).toBe(false);
    expect(data.records).toEqual([]);
    expect(prismaMock.attendanceRegister.create).toHaveBeenCalled();
  });

  it("should default type to DAILY", async () => {
    prismaMock.school.findFirst.mockResolvedValue({ id: "school-1" } as never);
    prismaMock.attendanceRegister.findFirst.mockResolvedValue(null as never);
    prismaMock.attendanceRegister.create.mockResolvedValue({
      id: "reg-new",
      classArmId: "ca-1",
      date: new Date("2026-03-15"),
      type: "DAILY",
      status: "OPEN",
      takenBy: "test-user-id",
    } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);

    await openAttendanceRegisterAction({
      classArmId: "ca-1",
      date: "2026-03-15",
    });

    expect(prismaMock.attendanceRegister.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "DAILY" }),
      })
    );
  });

  it("should require periodId for PERIOD type", async () => {
    prismaMock.school.findFirst.mockResolvedValue({ id: "school-1" } as never);

    const result = await openAttendanceRegisterAction({
      classArmId: "ca-1",
      date: "2026-03-15",
      type: "PERIOD",
    });

    expect(result).toEqual({ error: "Period is required for period-based attendance." });
  });
});

// ─── getAttendanceRegisterAction ───────────────────────────────────

describe("getAttendanceRegisterAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAttendanceRegisterAction("reg-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if register not found", async () => {
    prismaMock.attendanceRegister.findUnique.mockResolvedValue(null as never);
    const result = await getAttendanceRegisterAction("nonexistent");
    expect(result).toEqual({ error: "Attendance register not found." });
  });

  it("should return register with records and students", async () => {
    prismaMock.attendanceRegister.findUnique.mockResolvedValue({
      id: "reg-1",
      classArmId: "ca-1",
      date: new Date("2026-03-15"),
      type: "DAILY",
      status: "OPEN",
      takenBy: "test-user-id",
      records: [
        { id: "rec-1", studentId: "s1", status: "PRESENT", remarks: null },
      ],
    } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      {
        student: {
          id: "s1",
          studentId: "SCH/2026/0001",
          firstName: "Kwame",
          lastName: "Asante",
          photoUrl: null,
        },
      },
    ] as never);

    const result = await getAttendanceRegisterAction("reg-1");
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.register).toMatchObject({ id: "reg-1" });
    expect(data.records).toHaveLength(1);
    expect(data.students).toHaveLength(1);
  });
});

// ─── recordAttendanceAction ────────────────────────────────────────

describe("recordAttendanceAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await recordAttendanceAction("reg-1", [
      { studentId: "s1", status: "PRESENT" },
    ]);
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if register not found", async () => {
    prismaMock.attendanceRegister.findUnique.mockResolvedValue(null as never);
    const result = await recordAttendanceAction("nonexistent", [
      { studentId: "s1", status: "PRESENT" },
    ]);
    expect(result).toEqual({ error: "Attendance register not found." });
  });

  it("should reject recording on a CLOSED register", async () => {
    prismaMock.attendanceRegister.findUnique.mockResolvedValue({
      id: "reg-1",
      status: "CLOSED",
    } as never);

    const result = await recordAttendanceAction("reg-1", [
      { studentId: "s1", status: "PRESENT" },
    ]);
    expect(result).toEqual({
      error: "This attendance register is closed and cannot be edited.",
    });
  });

  it("should batch upsert records in a transaction", async () => {
    prismaMock.attendanceRegister.findUnique.mockResolvedValue({
      id: "reg-1",
      status: "OPEN",
      schoolId: "school-1",
      date: new Date("2026-03-15"),
    } as never);
    prismaMock.attendanceRecord.upsert.mockResolvedValue({} as never);
    prismaMock.$transaction.mockResolvedValue([] as never);
    prismaMock.student.findMany.mockResolvedValue([] as never);

    const records = [
      { studentId: "s1", status: "PRESENT" as const },
      { studentId: "s2", status: "ABSENT" as const },
      { studentId: "s3", status: "LATE" as const, remarks: "Traffic" },
    ];

    const result = await recordAttendanceAction("reg-1", records);
    expect(result).toEqual({ success: true });
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

// ─── closeAttendanceRegisterAction ─────────────────────────────────

describe("closeAttendanceRegisterAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await closeAttendanceRegisterAction("reg-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if register not found", async () => {
    prismaMock.attendanceRegister.findUnique.mockResolvedValue(null as never);
    const result = await closeAttendanceRegisterAction("nonexistent");
    expect(result).toEqual({ error: "Attendance register not found." });
  });

  it("should reject closing an already closed register", async () => {
    prismaMock.attendanceRegister.findUnique.mockResolvedValue({
      id: "reg-1",
      status: "CLOSED",
    } as never);

    const result = await closeAttendanceRegisterAction("reg-1");
    expect(result).toEqual({ error: "Register is already closed." });
  });

  it("should close an open register successfully", async () => {
    prismaMock.attendanceRegister.findUnique.mockResolvedValue({
      id: "reg-1",
      status: "OPEN",
    } as never);
    prismaMock.attendanceRegister.update.mockResolvedValue({
      id: "reg-1",
      status: "CLOSED",
    } as never);

    const result = await closeAttendanceRegisterAction("reg-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.attendanceRegister.update).toHaveBeenCalledWith({
      where: { id: "reg-1" },
      data: { status: "CLOSED" },
    });
  });
});

// ─── getAttendanceHistoryAction ────────────────────────────────────

describe("getAttendanceHistoryAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    prismaMock.school.findFirst.mockResolvedValue({ id: "school-1" } as never);
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAttendanceHistoryAction({});
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return paginated history with class arm enrichment", async () => {
    prismaMock.attendanceRegister.findMany.mockResolvedValue([
      {
        id: "reg-1",
        classArmId: "ca-1",
        date: new Date("2026-03-15"),
        type: "DAILY",
        status: "CLOSED",
        records: [
          { status: "PRESENT" },
          { status: "PRESENT" },
          { status: "ABSENT" },
          { status: "LATE" },
        ],
      },
    ] as never);
    prismaMock.attendanceRegister.count.mockResolvedValue(1 as never);
    prismaMock.classArm.findMany.mockResolvedValue([
      { id: "ca-1", name: "A", class: { name: "SHS 1" } },
    ] as never);

    const result = await getAttendanceHistoryAction({});
    expect(result).toHaveProperty("data");
    const data = (result as { data: Array<Record<string, unknown>> }).data;
    expect(data[0]).toMatchObject({
      id: "reg-1",
      classArmName: "SHS 1 A",
      recordCount: 4,
      presentCount: 2,
      absentCount: 1,
      lateCount: 1,
    });
    expect(result).toHaveProperty("pagination");
  });

  it("should apply classArmId filter", async () => {
    prismaMock.attendanceRegister.findMany.mockResolvedValue([] as never);
    prismaMock.attendanceRegister.count.mockResolvedValue(0 as never);
    prismaMock.classArm.findMany.mockResolvedValue([] as never);

    await getAttendanceHistoryAction({ classArmId: "ca-1" });
    expect(prismaMock.attendanceRegister.findMany).toHaveBeenCalled();
  });

  it("should use default pagination", async () => {
    prismaMock.attendanceRegister.findMany.mockResolvedValue([] as never);
    prismaMock.attendanceRegister.count.mockResolvedValue(0 as never);
    prismaMock.classArm.findMany.mockResolvedValue([] as never);

    const result = await getAttendanceHistoryAction({});
    const pagination = (result as { pagination: Record<string, unknown> }).pagination;
    expect(pagination).toMatchObject({ page: 1, pageSize: 20 });
  });
});

// ─── getAttendanceSummaryAction ────────────────────────────────────

describe("getAttendanceSummaryAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAttendanceSummaryAction("ca-1", "term-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if term not found", async () => {
    prismaMock.term.findUnique.mockResolvedValue(null as never);
    const result = await getAttendanceSummaryAction("ca-1", "nonexistent");
    expect(result).toEqual({ error: "Term not found." });
  });

  it("should calculate per-student attendance summary", async () => {
    prismaMock.term.findUnique.mockResolvedValue({
      id: "term-1",
      startDate: new Date("2026-01-06"),
      endDate: new Date("2026-04-10"),
    } as never);

    prismaMock.attendanceRegister.findMany.mockResolvedValue([
      {
        id: "reg-1",
        records: [
          { studentId: "s1", status: "PRESENT" },
          { studentId: "s2", status: "ABSENT" },
        ],
      },
      {
        id: "reg-2",
        records: [
          { studentId: "s1", status: "LATE" },
          { studentId: "s2", status: "PRESENT" },
        ],
      },
      {
        id: "reg-3",
        records: [
          { studentId: "s1", status: "ABSENT" },
          { studentId: "s2", status: "EXCUSED" },
        ],
      },
    ] as never);

    prismaMock.enrollment.findMany.mockResolvedValue([
      {
        student: { id: "s1", studentId: "SCH/2026/0001", firstName: "Kwame", lastName: "Asante" },
      },
      {
        student: { id: "s2", studentId: "SCH/2026/0002", firstName: "Ama", lastName: "Mensah" },
      },
    ] as never);

    const result = await getAttendanceSummaryAction("ca-1", "term-1");
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("totalDays", 3);

    const data = (result as { data: Array<Record<string, unknown>> }).data;

    // s1: 1 present, 1 late, 1 absent => rate = round(((1+1)/3)*100) = 67
    const s1 = data.find((d) => d.studentId === "s1");
    expect(s1).toMatchObject({
      present: 1,
      late: 1,
      absent: 1,
      excused: 0,
      attendanceRate: 67,
      totalDays: 3,
    });

    // s2: 1 present, 1 absent, 1 excused => rate = round(((1+0)/3)*100) = 33
    const s2 = data.find((d) => d.studentId === "s2");
    expect(s2).toMatchObject({
      present: 1,
      absent: 1,
      excused: 1,
      attendanceRate: 33,
      totalDays: 3,
    });
  });

  it("should return 0 attendance rate when no registers exist", async () => {
    prismaMock.term.findUnique.mockResolvedValue({
      id: "term-1",
      startDate: new Date("2026-01-06"),
      endDate: new Date("2026-04-10"),
    } as never);
    prismaMock.attendanceRegister.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      {
        student: { id: "s1", studentId: "SCH/2026/0001", firstName: "Kwame", lastName: "Asante" },
      },
    ] as never);

    const result = await getAttendanceSummaryAction("ca-1", "term-1");
    const data = (result as { data: Array<Record<string, unknown>> }).data;
    expect(data[0]).toMatchObject({ attendanceRate: 0, totalDays: 0 });
  });
});

// ─── getStudentAttendanceAction ────────────────────────────────────

describe("getStudentAttendanceAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getStudentAttendanceAction("s1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return student attendance records", async () => {
    prismaMock.attendanceRecord.findMany.mockResolvedValue([
      {
        id: "rec-1",
        status: "PRESENT",
        remarks: null,
        register: {
          id: "reg-1",
          classArmId: "ca-1",
          date: new Date("2026-03-15"),
          type: "DAILY",
        },
      },
      {
        id: "rec-2",
        status: "ABSENT",
        remarks: "Sick",
        register: {
          id: "reg-2",
          classArmId: "ca-1",
          date: new Date("2026-03-16"),
          type: "DAILY",
        },
      },
    ] as never);

    const result = await getStudentAttendanceAction("s1");
    expect(result).toHaveProperty("data");
    const data = (result as { data: Array<Record<string, unknown>> }).data;
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({ id: "rec-1", status: "PRESENT" });
    expect(data[1]).toMatchObject({ id: "rec-2", status: "ABSENT", remarks: "Sick" });
  });

  it("should filter by term date range when termId provided", async () => {
    prismaMock.term.findUnique.mockResolvedValue({
      id: "term-1",
      startDate: new Date("2026-01-06"),
      endDate: new Date("2026-04-10"),
    } as never);
    prismaMock.attendanceRegister.findMany.mockResolvedValue([
      { id: "reg-1" },
      { id: "reg-2" },
    ] as never);
    prismaMock.attendanceRecord.findMany.mockResolvedValue([] as never);

    const result = await getStudentAttendanceAction("s1", "term-1");
    expect(result).toHaveProperty("data");
    expect(prismaMock.term.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "term-1" } })
    );
  });

  it("should return all records when no termId provided", async () => {
    prismaMock.attendanceRecord.findMany.mockResolvedValue([] as never);

    const result = await getStudentAttendanceAction("s1");
    expect(result).toEqual({ data: [] });
    expect(prismaMock.term.findUnique).not.toHaveBeenCalled();
  });
});
