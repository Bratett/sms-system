import { describe, it, expect, beforeEach } from "vitest";
import {
  prismaMock,
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "../setup";

import {
  getParentChildrenAction,
  getChildResultsAction,
  getChildFeesAction,
  getChildAttendanceAction,
  getParentAnnouncementsAction,
} from "@/modules/portal/actions/parent.action";

import {
  getStudentPortalDataAction,
  getMyResultsAction,
  getMyAttendanceAction,
  getMyFeesAction,
  getMyTimetableAction,
  getMyAnnouncementsAction,
  getMyExeatsAction,
  requestStudentExeatAction,
} from "@/modules/portal/actions/student-portal.action";

// ─── Parent Portal ─────────────────────────────────────────────────

describe("getParentChildrenAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getParentChildrenAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no guardian profile linked", async () => {
    prismaMock.guardian.findUnique.mockResolvedValue(null);
    const result = await getParentChildrenAction();
    expect(result).toEqual({ error: "No guardian profile linked to your account." });
  });

  it("should return children with fee balance and attendance", async () => {
    prismaMock.guardian.findUnique.mockResolvedValue({
      id: "guard-1",
      userId: "test-user-id",
      students: [
        {
          isPrimary: true,
          student: {
            id: "stu-1",
            studentId: "STU/2025/0001",
            firstName: "John",
            lastName: "Doe",
            gender: "MALE",
            photoUrl: null,
            boardingStatus: "DAY",
            status: "ACTIVE",
            enrollments: [
              {
                classArmId: "ca-1",
                classArm: {
                  name: "A",
                  class: { id: "cls-1", name: "SHS 1", yearGroup: 1 },
                },
              },
            ],
          },
        },
      ],
    } as never);

    prismaMock.studentBill.findMany.mockResolvedValue([
      { balanceAmount: 500 },
    ] as never);

    prismaMock.term.findFirst.mockResolvedValue({ id: "term-1" } as never);
    prismaMock.attendanceRecord.count
      .mockResolvedValueOnce(20 as never)
      .mockResolvedValueOnce(18 as never);

    const result = await getParentChildrenAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: { feeBalance: number; attendanceRate: number | null }[] }).data;
    expect(data).toHaveLength(1);
    expect(data[0].feeBalance).toBe(500);
    expect(data[0].attendanceRate).toBe(90);
  });
});

describe("getChildResultsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getChildResultsAction("stu-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if parent has no access to student", async () => {
    prismaMock.guardian.findUnique.mockResolvedValue(null);
    const result = await getChildResultsAction("stu-1");
    expect(result).toEqual({ error: "You do not have access to this student's data." });
  });

  it("should return results for authorized parent", async () => {
    prismaMock.guardian.findUnique.mockResolvedValue({ id: "guard-1" } as never);
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      guardianId: "guard-1",
      studentId: "stu-1",
    } as never);

    prismaMock.term.findMany.mockResolvedValue([
      {
        id: "term-1",
        name: "Term 1",
        termNumber: 1,
        academicYear: { id: "ay-1", name: "2024/2025" },
      },
    ] as never);

    prismaMock.term.findFirst.mockResolvedValue({ id: "term-1" } as never);

    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      studentId: "STU/2025/0001",
      firstName: "John",
      lastName: "Doe",
      otherNames: null,
    } as never);

    prismaMock.terminalResult.findFirst.mockResolvedValue(null);

    const result = await getChildResultsAction("stu-1");
    expect(result).toHaveProperty("data");
    const data = (result as { data: { terms: unknown[]; result: unknown; student: unknown } }).data;
    expect(data.terms).toHaveLength(1);
    expect(data.result).toBeNull();
  });
});

describe("getChildFeesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getChildFeesAction("stu-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if parent has no access", async () => {
    prismaMock.guardian.findUnique.mockResolvedValue(null);
    const result = await getChildFeesAction("stu-1");
    expect(result).toEqual({ error: "You do not have access to this student's data." });
  });

  it("should return bills and summary for authorized parent", async () => {
    prismaMock.guardian.findUnique.mockResolvedValue({ id: "guard-1" } as never);
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      guardianId: "guard-1",
      studentId: "stu-1",
    } as never);

    prismaMock.studentBill.findMany.mockResolvedValue([
      {
        id: "bill-1",
        termId: "term-1",
        totalAmount: 1500,
        paidAmount: 1000,
        balanceAmount: 500,
        status: "PARTIAL",
        dueDate: new Date(),
        generatedAt: new Date(),
        feeStructure: { name: "SHS 1 Fees" },
        payments: [],
      },
    ] as never);

    prismaMock.term.findMany.mockResolvedValue([
      {
        id: "term-1",
        name: "Term 1",
        academicYear: { name: "2024/2025" },
      },
    ] as never);

    const result = await getChildFeesAction("stu-1");
    expect(result).toHaveProperty("data");
    const data = (result as { data: { summary: { totalBalance: number } } }).data;
    expect(data.summary.totalBalance).toBe(500);
  });
});

describe("getChildAttendanceAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getChildAttendanceAction("stu-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if parent has no access", async () => {
    prismaMock.guardian.findUnique.mockResolvedValue(null);
    const result = await getChildAttendanceAction("stu-1");
    expect(result).toEqual({ error: "You do not have access to this student's data." });
  });

  it("should return empty if no enrollment", async () => {
    prismaMock.guardian.findUnique.mockResolvedValue({ id: "guard-1" } as never);
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      guardianId: "guard-1",
      studentId: "stu-1",
    } as never);
    prismaMock.enrollment.findFirst.mockResolvedValue(null);

    const result = await getChildAttendanceAction("stu-1");
    expect(result).toHaveProperty("data");
    const data = (result as { data: { summary: unknown } }).data;
    expect(data.summary).toBeNull();
  });
});

describe("getParentAnnouncementsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getParentAnnouncementsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null);
    const result = await getParentAnnouncementsAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return active announcements and filter expired", async () => {
    const past = new Date("2020-01-01");
    const future = new Date("2030-01-01");

    prismaMock.announcement.findMany.mockResolvedValue([
      {
        id: "ann-1",
        title: "Active",
        content: "Content",
        priority: "NORMAL",
        publishedAt: new Date(),
        expiresAt: future,
      },
      {
        id: "ann-2",
        title: "Expired",
        content: "Content",
        priority: "NORMAL",
        publishedAt: new Date(),
        expiresAt: past,
      },
    ] as never);

    const result = await getParentAnnouncementsAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: unknown[] }).data;
    expect(data).toHaveLength(1);
  });
});

// ─── Student Portal ────────────────────────────────────────────────

describe("getStudentPortalDataAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getStudentPortalDataAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no student profile linked", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);
    const result = await getStudentPortalDataAction();
    expect(result).toEqual({ error: "No student profile linked to your account." });
  });

  it("should return student portal data", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      studentId: "STU/2025/0001",
      firstName: "John",
      lastName: "Doe",
      otherNames: null,
      gender: "MALE",
      dateOfBirth: null,
      photoUrl: null,
      boardingStatus: "DAY",
      status: "ACTIVE",
      schoolId: "default-school",
      enrollments: [
        {
          classArmId: "ca-1",
          classArm: {
            name: "A",
            class: { id: "cls-1", name: "SHS 1", yearGroup: 1 },
          },
        },
      ],
      houseAssignment: null,
    } as never);

    prismaMock.studentBill.findMany.mockResolvedValue([
      { balanceAmount: 300 },
    ] as never);

    prismaMock.term.findFirst.mockResolvedValue({
      id: "term-1",
      name: "Term 1",
      isCurrent: true,
      academicYear: { name: "2024/2025" },
    } as never);

    prismaMock.terminalResult.findFirst.mockResolvedValue(null);

    prismaMock.attendanceRecord.count
      .mockResolvedValueOnce(10 as never)
      .mockResolvedValueOnce(9 as never);

    const result = await getStudentPortalDataAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: { feeBalance: number } }).data;
    expect(data.feeBalance).toBe(300);
  });
});

describe("getMyResultsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getMyResultsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no student profile linked", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);
    const result = await getMyResultsAction();
    expect(result).toEqual({ error: "No student profile linked to your account." });
  });

  it("should return terms and result for current term", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      userId: "test-user-id",
    } as never);

    prismaMock.term.findMany.mockResolvedValue([
      {
        id: "term-1",
        name: "Term 1",
        termNumber: 1,
        academicYear: { id: "ay-1", name: "2024/2025" },
      },
    ] as never);

    prismaMock.term.findFirst.mockResolvedValue({ id: "term-1" } as never);

    prismaMock.terminalResult.findFirst.mockResolvedValue({
      id: "tr-1",
      totalScore: 450,
      averageScore: 75,
      classPosition: 3,
      overallGrade: "B+",
      teacherRemarks: "Good",
      headmasterRemarks: null,
      promotionStatus: "PROMOTED",
      subjectResults: [
        {
          id: "sr-1",
          subject: { id: "sub-1", name: "Mathematics", code: "MATH" },
          classScore: 30,
          examScore: 55,
          totalScore: 85,
          grade: "A",
          interpretation: "Excellent",
          position: 1,
        },
      ],
    } as never);

    const result = await getMyResultsAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: { result: { averageScore: number } } }).data;
    expect(data.result).not.toBeNull();
    expect(data.result.averageScore).toBe(75);
  });
});

describe("getMyAttendanceAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getMyAttendanceAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no student profile linked", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);
    const result = await getMyAttendanceAction();
    expect(result).toEqual({ error: "No student profile linked to your account." });
  });

  it("should return empty if no enrollment", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      userId: "test-user-id",
    } as never);
    prismaMock.enrollment.findFirst.mockResolvedValue(null);

    const result = await getMyAttendanceAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: { summary: unknown } }).data;
    expect(data.summary).toBeNull();
  });
});

describe("getMyFeesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getMyFeesAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no student profile linked", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);
    const result = await getMyFeesAction();
    expect(result).toEqual({ error: "No student profile linked to your account." });
  });

  it("should return bills and total balance", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      userId: "test-user-id",
    } as never);

    prismaMock.studentBill.findMany.mockResolvedValue([
      {
        id: "bill-1",
        termId: "term-1",
        totalAmount: 1500,
        paidAmount: 1000,
        balanceAmount: 500,
        status: "PARTIAL",
        dueDate: new Date(),
        generatedAt: new Date(),
        feeStructure: { name: "SHS 1 Fees" },
        payments: [],
      },
    ] as never);

    prismaMock.term.findMany.mockResolvedValue([
      {
        id: "term-1",
        name: "Term 1",
        academicYear: { name: "2024/2025" },
      },
    ] as never);

    const result = await getMyFeesAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: { totalBalance: number } }).data;
    expect(data.totalBalance).toBe(500);
  });
});

describe("getMyTimetableAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getMyTimetableAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no student profile linked", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);
    const result = await getMyTimetableAction();
    expect(result).toEqual({ error: "No student profile linked to your account." });
  });

  it("should return empty if no enrollment", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      userId: "test-user-id",
      schoolId: "default-school",
    } as never);
    prismaMock.enrollment.findFirst.mockResolvedValue(null);

    const result = await getMyTimetableAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: { timetable: unknown[] } }).data;
    expect(data.timetable).toEqual([]);
  });

  it("should return timetable slots when enrollment exists", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      userId: "test-user-id",
      schoolId: "default-school",
    } as never);
    prismaMock.enrollment.findFirst.mockResolvedValue({
      classArmId: "ca-1",
      academicYearId: "ay-1",
    } as never);
    prismaMock.term.findFirst.mockResolvedValue({ id: "term-1" } as never);
    prismaMock.timetableSlot.findMany.mockResolvedValue([
      {
        id: "slot-1",
        dayOfWeek: 1,
        subject: { name: "Mathematics", code: "MATH" },
        teacher: { firstName: "Jane", lastName: "Smith" },
        period: { name: "Period 1", startTime: "08:00", endTime: "09:00", order: 1, type: "LESSON" },
        room: { name: "Room 101" },
      },
    ] as never);
    prismaMock.period.findMany.mockResolvedValue([
      { id: "p-1", name: "Period 1", startTime: "08:00", endTime: "09:00", order: 1, type: "LESSON" },
    ] as never);

    const result = await getMyTimetableAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: { timetable: unknown[] } }).data;
    expect(data.timetable).toHaveLength(1);
  });
});

describe("getMyAnnouncementsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getMyAnnouncementsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no student profile linked", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);
    const result = await getMyAnnouncementsAction();
    expect(result).toEqual({ error: "No student profile linked to your account." });
  });

  it("should return active announcements and filter expired", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      userId: "test-user-id",
      schoolId: "default-school",
    } as never);

    const future = new Date("2030-01-01");
    const past = new Date("2020-01-01");

    prismaMock.announcement.findMany.mockResolvedValue([
      {
        id: "ann-1",
        title: "Active",
        content: "Content",
        priority: "NORMAL",
        publishedAt: new Date(),
        expiresAt: future,
      },
      {
        id: "ann-2",
        title: "Expired",
        content: "Content",
        priority: "NORMAL",
        publishedAt: new Date(),
        expiresAt: past,
      },
    ] as never);

    const result = await getMyAnnouncementsAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: unknown[] }).data;
    expect(data).toHaveLength(1);
  });
});

describe("getMyExeatsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getMyExeatsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no student profile linked", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);
    const result = await getMyExeatsAction();
    expect(result).toEqual({ error: "No student profile linked to your account." });
  });

  it("should return exeats with approval counts", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      userId: "test-user-id",
    } as never);

    prismaMock.exeat.findMany.mockResolvedValue([
      {
        id: "ext-1",
        exeatNumber: "EXT/2025/0001",
        type: "NORMAL",
        reason: "Family event",
        departureDate: new Date(),
        departureTime: "10:00",
        expectedReturnDate: new Date(),
        actualReturnDate: null,
        actualReturnTime: null,
        guardianName: "Parent",
        guardianPhone: "0200000000",
        status: "PENDING",
        requestedAt: new Date(),
        approvals: [{ actionAt: new Date() }],
      },
    ] as never);

    const result = await getMyExeatsAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: { approvalCount: number }[] }).data;
    expect(data).toHaveLength(1);
    expect(data[0].approvalCount).toBe(1);
  });
});

describe("requestStudentExeatAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await requestStudentExeatAction({
      reason: "Family event",
      type: "NORMAL",
      departureDate: "2025-04-01",
      expectedReturnDate: "2025-04-02",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no student profile linked", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);
    const result = await requestStudentExeatAction({
      reason: "Family event",
      type: "NORMAL",
      departureDate: "2025-04-01",
      expectedReturnDate: "2025-04-02",
    });
    expect(result).toEqual({ error: "No student profile linked to your account." });
  });

  it("should reject if student is not boarding", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      userId: "test-user-id",
      boardingStatus: "DAY",
    } as never);

    const result = await requestStudentExeatAction({
      reason: "Family event",
      type: "NORMAL",
      departureDate: "2025-04-01",
      expectedReturnDate: "2025-04-02",
    });
    expect(result).toEqual({ error: "Exeat requests are only available for boarding students." });
  });

  it("should reject if no active term found", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      userId: "test-user-id",
      boardingStatus: "BOARDING",
    } as never);
    prismaMock.term.findFirst.mockResolvedValue(null);

    const result = await requestStudentExeatAction({
      reason: "Family event",
      type: "NORMAL",
      departureDate: "2025-04-01",
      expectedReturnDate: "2025-04-02",
    });
    expect(result).toEqual({ error: "No active term found." });
  });

  it("should create exeat request successfully", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      userId: "test-user-id",
      boardingStatus: "BOARDING",
    } as never);
    prismaMock.term.findFirst.mockResolvedValue({ id: "term-1" } as never);
    prismaMock.exeat.count.mockResolvedValue(5 as never);
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      guardian: {
        firstName: "Parent",
        lastName: "Doe",
        phone: "0200000000",
      },
    } as never);
    prismaMock.exeat.create.mockResolvedValue({
      id: "ext-1",
      exeatNumber: "EXT/2025/0006",
    } as never);

    const result = await requestStudentExeatAction({
      reason: "Family event",
      type: "NORMAL",
      departureDate: "2025-04-01",
      expectedReturnDate: "2025-04-02",
    });

    expect(result).toHaveProperty("data");
    const data = (result as { data: { exeatNumber: string } }).data;
    expect(data.exeatNumber).toBe("EXT/2025/0006");
  });
});
