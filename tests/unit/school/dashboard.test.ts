import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  getDashboardStatsAction,
  getRoleDashboardAction,
} from "@/modules/school/actions/dashboard.action";

// ─── getDashboardStatsAction ──────────────────────────────────────

describe("getDashboardStatsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getDashboardStatsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return full dashboard stats", async () => {
    const currentTerm = {
      id: "term-1",
      name: "Term 1",
      termNumber: 1,
      isCurrent: true,
      startDate: new Date("2025-09-01"),
      endDate: new Date("2025-12-15"),
    };

    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: "ay-1",
      name: "2025/2026",
      isCurrent: true,
      terms: [currentTerm],
    } as never);

    // Student counts (7 calls)
    prismaMock.student.count
      .mockResolvedValueOnce(100 as never) // total
      .mockResolvedValueOnce(80 as never)  // active
      .mockResolvedValueOnce(45 as never)  // male
      .mockResolvedValueOnce(35 as never)  // female
      .mockResolvedValueOnce(30 as never)  // boarding
      .mockResolvedValueOnce(50 as never); // day

    // Enrollment count for new this term
    prismaMock.enrollment.count.mockResolvedValue(80 as never);

    // Staff counts
    prismaMock.staff.count
      .mockResolvedValueOnce(25 as never)  // total
      .mockResolvedValueOnce(18 as never)  // teaching
      .mockResolvedValueOnce(7 as never);  // non-teaching

    // Academic
    prismaMock.subject.count.mockResolvedValue(12 as never);
    prismaMock.class.count.mockResolvedValue(6 as never);

    // Finance
    prismaMock.studentBill.aggregate.mockResolvedValue({
      _sum: { totalAmount: 100000, paidAmount: 75000, balanceAmount: 25000 },
    } as never);

    // Attendance
    prismaMock.attendanceRegister.count.mockResolvedValue(5 as never);
    prismaMock.attendanceRecord.findMany.mockResolvedValue([
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "LATE" },
      { status: "ABSENT" },
    ] as never);

    // Admissions
    prismaMock.admissionApplication.count.mockResolvedValue(10 as never);

    // HR
    prismaMock.leaveRequest.count.mockResolvedValue(3 as never);

    // Audit logs
    prismaMock.auditLog.findMany.mockResolvedValue([
      {
        id: "log-1",
        description: "Created student",
        timestamp: new Date(),
        module: "students",
        action: "CREATE",
        user: { firstName: "Test", lastName: "Admin" },
      },
    ] as never);

    const result = await getDashboardStatsAction();
    expect(result).toHaveProperty("stats");

    const stats = (result as { stats: Record<string, Record<string, unknown>> }).stats;
    expect(stats.students.total).toBe(100);
    expect(stats.students.active).toBe(80);
    expect(stats.staff.total).toBe(25);
    expect(stats.academic.totalSubjects).toBe(12);
    expect(stats.finance.totalBilled).toBe(100000);
    expect(stats.attendance.registersToday).toBe(5);
    expect(stats.admissions.pending).toBe(10);
    expect(stats.hr.pendingLeave).toBe(3);

    expect(result).toHaveProperty("recentActivity");
    expect(result).toHaveProperty("currentYear");
    expect(result).toHaveProperty("currentTerm");
  });

  it("should handle no current academic year", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue(null as never);

    // Student counts still called
    prismaMock.student.count.mockResolvedValue(0 as never);
    prismaMock.staff.count.mockResolvedValue(0 as never);
    prismaMock.subject.count.mockResolvedValue(0 as never);
    prismaMock.attendanceRegister.count.mockResolvedValue(0 as never);
    prismaMock.attendanceRecord.findMany.mockResolvedValue([] as never);
    prismaMock.admissionApplication.count.mockResolvedValue(0 as never);
    prismaMock.leaveRequest.count.mockResolvedValue(0 as never);
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);

    const result = await getDashboardStatsAction();
    expect(result).toHaveProperty("stats");
    expect((result as { currentYear: null }).currentYear).toBeNull();
  });
});

// ─── getRoleDashboardAction ───────────────────────────────────────

describe("getRoleDashboardAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getRoleDashboardAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return full dashboard flag for super_admin", async () => {
    mockAuthenticatedUser({ roles: ["super_admin"] });
    prismaMock.term.findFirst.mockResolvedValue(null as never);
    prismaMock.academicYear.findFirst.mockResolvedValue(null as never);

    const result = await getRoleDashboardAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.role).toBe("super_admin");
    expect(data.useFullDashboard).toBe(true);
  });

  it("should return finance dashboard for finance_officer", async () => {
    mockAuthenticatedUser({ roles: ["finance_officer"] });
    prismaMock.term.findFirst.mockResolvedValue({
      id: "term-1",
      isCurrent: true,
    } as never);
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: "ay-1",
      isCurrent: true,
    } as never);
    prismaMock.studentBill.aggregate.mockResolvedValue({
      _sum: { totalAmount: 50000, paidAmount: 30000, balanceAmount: 20000 },
      _count: 100,
    } as never);
    prismaMock.payment.count.mockResolvedValue(5 as never);
    prismaMock.paymentReversal.count.mockResolvedValue(1 as never);

    const result = await getRoleDashboardAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.role).toBe("finance_officer");
    expect(data).toHaveProperty("totalBilled");
    expect(data).toHaveProperty("todayPayments");
  });

  it("should return teacher dashboard for teacher role", async () => {
    mockAuthenticatedUser({ roles: ["teacher"] });
    prismaMock.term.findFirst.mockResolvedValue({
      id: "term-1",
      isCurrent: true,
    } as never);
    prismaMock.academicYear.findFirst.mockResolvedValue(null as never);
    prismaMock.staff.findUnique.mockResolvedValue({
      id: "staff-1",
      userId: "test-user-id",
    } as never);
    prismaMock.teacherSubjectAssignment.count.mockResolvedValue(3 as never);
    prismaMock.mark.count.mockResolvedValue(5 as never);
    prismaMock.attendanceRegister.count.mockResolvedValue(2 as never);

    const result = await getRoleDashboardAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.role).toBe("teacher");
    expect(data).toHaveProperty("subjectAssignments");
    expect(data).toHaveProperty("pendingMarks");
  });

  it("should return HR dashboard for hr_officer role", async () => {
    mockAuthenticatedUser({ roles: ["hr_officer"] });
    prismaMock.term.findFirst.mockResolvedValue(null as never);
    prismaMock.academicYear.findFirst.mockResolvedValue(null as never);
    prismaMock.staff.count.mockResolvedValue(30 as never);
    prismaMock.leaveRequest.count
      .mockResolvedValueOnce(5 as never)  // pending
      .mockResolvedValueOnce(2 as never); // active

    const result = await getRoleDashboardAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.role).toBe("hr_officer");
    expect(data).toHaveProperty("totalStaff");
    expect(data).toHaveProperty("pendingLeave");
  });

  it("should return housemaster dashboard", async () => {
    mockAuthenticatedUser({ roles: ["housemaster"] });
    prismaMock.term.findFirst.mockResolvedValue(null as never);
    prismaMock.academicYear.findFirst.mockResolvedValue(null as never);
    prismaMock.exeat.count
      .mockResolvedValueOnce(3 as never)  // active
      .mockResolvedValueOnce(1 as never); // overdue
    prismaMock.student.count.mockResolvedValue(50 as never);

    const result = await getRoleDashboardAction();
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.role).toBe("housemaster");
    expect(data).toHaveProperty("totalBoarders");
    expect(data).toHaveProperty("activeExeats");
  });

  it("should return admissions dashboard for admissions_officer", async () => {
    mockAuthenticatedUser({ roles: ["admissions_officer"] });
    prismaMock.term.findFirst.mockResolvedValue(null as never);
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: "ay-1",
      isCurrent: true,
    } as never);
    prismaMock.admissionApplication.count
      .mockResolvedValueOnce(100 as never) // total
      .mockResolvedValueOnce(30 as never)  // pending
      .mockResolvedValueOnce(20 as never)  // accepted
      .mockResolvedValueOnce(15 as never); // enrolled

    const result = await getRoleDashboardAction();
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.role).toBe("admissions_officer");
    expect(data).toHaveProperty("totalApplications");
    expect(data).toHaveProperty("conversionRate");
  });

  it("should return store_keeper dashboard", async () => {
    mockAuthenticatedUser({ roles: ["store_keeper"] });
    prismaMock.term.findFirst.mockResolvedValue(null as never);
    prismaMock.academicYear.findFirst.mockResolvedValue(null as never);
    prismaMock.storeItem.count.mockResolvedValue(50 as never);
    prismaMock.$queryRaw.mockResolvedValue([{ count: BigInt(5) }] as never);
    prismaMock.purchaseRequest.count.mockResolvedValue(3 as never);

    const result = await getRoleDashboardAction();
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.role).toBe("store_keeper");
    expect(data).toHaveProperty("totalItems");
    expect(data).toHaveProperty("pendingOrders");
  });
});
