import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  getEnrollmentReportAction,
  getAcademicPerformanceReportAction,
  getAttendanceReportAction,
  getComprehensiveReportAction,
  getReportFiltersAction,
} from "@/modules/reports/actions/report.action";
import { getAdmissionsReportAction } from "@/modules/reports/actions/admissions-report.action";
import { getAuditReportAction } from "@/modules/reports/actions/audit-report.action";
import { getBoardingReportAction } from "@/modules/reports/actions/boarding-report.action";
import { getDisciplineReportAction } from "@/modules/reports/actions/discipline-report.action";
import { getFinanceReportAction } from "@/modules/reports/actions/finance-report.action";
import { getHrReportAction } from "@/modules/reports/actions/hr-report.action";
import { getInventoryReportAction } from "@/modules/reports/actions/inventory-report.action";
import { getStudentRegisterReportAction } from "@/modules/reports/actions/student-report.action";

// ─── getEnrollmentReportAction ────────────────────────────────────

describe("getEnrollmentReportAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getEnrollmentReportAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getEnrollmentReportAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return error if no academic year found", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue(null as never);
    const result = await getEnrollmentReportAction();
    expect(result).toEqual({ error: "No academic year found." });
  });

  it("should return enrollment report with breakdowns", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: "ay-1",
      name: "2025/2026",
      isCurrent: true,
    } as never);
    prismaMock.enrollment.count.mockResolvedValue(2 as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      {
        student: { gender: "MALE", boardingStatus: "DAY" },
        classArm: { class: { name: "SHS 1", programmeId: "prog-1" } },
      },
      {
        student: { gender: "FEMALE", boardingStatus: "BOARDING" },
        classArm: { class: { name: "SHS 1", programmeId: "prog-1" } },
      },
    ] as never);
    prismaMock.programme.findMany.mockResolvedValue([
      { id: "prog-1", name: "General Science" },
    ] as never);

    const result = await getEnrollmentReportAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.total).toBe(2);
    expect(data.byGender).toEqual({ MALE: 1, FEMALE: 1 });
    expect(data.byBoardingStatus).toEqual({ DAY: 1, BOARDING: 1 });
  });
});

// ─── getAcademicPerformanceReportAction ───────────────────────────

describe("getAcademicPerformanceReportAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAcademicPerformanceReportAction("term-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getAcademicPerformanceReportAction("term-1");
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return empty report when no results exist", async () => {
    prismaMock.terminalResult.findMany.mockResolvedValue([] as never);

    const result = await getAcademicPerformanceReportAction("term-1");
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.totalStudents).toBe(0);
    expect(data.classAverage).toBe(0);
    expect(data.passRate).toBe(0);
  });

  it("should compute performance metrics correctly", async () => {
    prismaMock.terminalResult.findMany.mockResolvedValue([
      {
        classArmId: "ca-1",
        averageScore: 70,
        subjectResults: [
          { subjectId: "sub-1", totalScore: 70, subject: { name: "Math" } },
        ],
      },
      {
        classArmId: "ca-1",
        averageScore: 40,
        subjectResults: [
          { subjectId: "sub-1", totalScore: 40, subject: { name: "Math" } },
        ],
      },
    ] as never);
    prismaMock.classArm.findMany.mockResolvedValue([
      { id: "ca-1", name: "A", class: { name: "SHS 1" } },
    ] as never);

    const result = await getAcademicPerformanceReportAction("term-1");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.totalStudents).toBe(2);
    expect(data.passRate).toBeGreaterThan(0);
    expect(data.failRate).toBeGreaterThan(0);
  });
});

// ─── getAttendanceReportAction ────────────────────────────────────

describe("getAttendanceReportAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAttendanceReportAction("term-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getAttendanceReportAction("term-1");
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return error if term not found", async () => {
    prismaMock.term.findUnique.mockResolvedValue(null as never);
    const result = await getAttendanceReportAction("nonexistent");
    expect(result).toEqual({ error: "Term not found." });
  });

  it("should return attendance stats", async () => {
    prismaMock.term.findUnique.mockResolvedValue({
      id: "term-1",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2025-12-15"),
    } as never);
    prismaMock.attendanceRegister.findMany.mockResolvedValue([
      {
        classArmId: "ca-1",
        records: [
          { status: "PRESENT", studentId: "s1" },
          { status: "ABSENT", studentId: "s2" },
          { status: "LATE", studentId: "s3" },
        ],
      },
    ] as never);
    prismaMock.classArm.findMany.mockResolvedValue([
      { id: "ca-1", name: "A", class: { name: "SHS 1" } },
    ] as never);

    const result = await getAttendanceReportAction("term-1");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.totalRecords).toBe(3);
    expect(data.presentCount).toBe(2); // PRESENT + LATE count as present
    expect(data.absentCount).toBe(1);
    expect(data.lateCount).toBe(1);
  });
});

// ─── getComprehensiveReportAction ─────────────────────────────────

describe("getComprehensiveReportAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getComprehensiveReportAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getComprehensiveReportAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return comprehensive data", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: "ay-1",
      name: "2025/2026",
      isCurrent: true,
    } as never);
    prismaMock.term.findFirst.mockResolvedValue({
      id: "term-1",
      isCurrent: true,
    } as never);
    prismaMock.student.count
      .mockResolvedValueOnce(100 as never) // total active
      .mockResolvedValueOnce(55 as never)  // male
      .mockResolvedValueOnce(45 as never)  // female
      .mockResolvedValueOnce(30 as never); // boarding
    prismaMock.staff.count.mockResolvedValue(20 as never);
    prismaMock.terminalResult.findMany.mockResolvedValue([] as never);
    prismaMock.studentBill.aggregate.mockResolvedValue({
      _sum: { totalAmount: 50000 },
    } as never);
    prismaMock.payment.aggregate.mockResolvedValue({
      _sum: { amount: 30000 },
    } as never);
    prismaMock.disciplinaryIncident.count
      .mockResolvedValueOnce(10 as never)
      .mockResolvedValueOnce(3 as never);

    const result = await getComprehensiveReportAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data).toHaveProperty("enrollment");
    expect(data).toHaveProperty("staff");
    expect(data).toHaveProperty("discipline");
  });
});

// ─── getReportFiltersAction ───────────────────────────────────────

describe("getReportFiltersAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getReportFiltersAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getReportFiltersAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return filter options", async () => {
    prismaMock.academicYear.findMany.mockResolvedValue([
      { id: "ay-1", name: "2025/2026", isCurrent: true },
    ] as never);
    prismaMock.term.findMany.mockResolvedValue([
      { id: "t-1", name: "Term 1", isCurrent: true },
    ] as never);
    prismaMock.classArm.findMany.mockResolvedValue([
      { id: "ca-1", name: "A", class: { name: "SHS 1" } },
    ] as never);

    const result = await getReportFiltersAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data).toHaveProperty("academicYears");
    expect(data).toHaveProperty("terms");
    expect(data).toHaveProperty("classArms");
  });
});

// ─── getAdmissionsReportAction ────────────────────────────────────

describe("getAdmissionsReportAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAdmissionsReportAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getAdmissionsReportAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return error if no academic year found", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue(null as never);
    const result = await getAdmissionsReportAction();
    expect(result).toEqual({ error: "No academic year found." });
  });

  it("should return admissions report data", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: "ay-1",
      isCurrent: true,
    } as never);
    prismaMock.admissionApplication.count
      .mockResolvedValueOnce(50 as never)  // total
      .mockResolvedValueOnce(50 as never); // totalForConversion
    prismaMock.admissionApplication.groupBy
      .mockResolvedValueOnce([
        { status: "SUBMITTED", _count: { _all: 20 } },
        { status: "ENROLLED", _count: { _all: 10 } },
      ] as never)
      .mockResolvedValueOnce([
        { gender: "MALE", _count: { _all: 25 } },
        { gender: "FEMALE", _count: { _all: 25 } },
      ] as never);
    prismaMock.admissionApplication.findMany.mockResolvedValue([] as never);
    prismaMock.programme.findMany.mockResolvedValue([] as never);

    const result = await getAdmissionsReportAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.totalApplications).toBe(50);
    expect(data).toHaveProperty("byStatus");
    expect(data).toHaveProperty("byGender");
  });
});

// ─── getAuditReportAction ─────────────────────────────────────────

describe("getAuditReportAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAuditReportAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getAuditReportAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return paginated audit entries with summaries", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([
      {
        id: "log-1",
        action: "CREATE",
        entity: "Student",
        entityId: "s1",
        module: "students",
        description: "Created student",
        timestamp: new Date(),
        user: { firstName: "Test", lastName: "Admin", username: "admin" },
      },
    ] as never);
    prismaMock.auditLog.count.mockResolvedValue(1 as never);
    prismaMock.auditLog.groupBy
      .mockResolvedValueOnce([
        { action: "CREATE", _count: { _all: 5 } },
      ] as never)
      .mockResolvedValueOnce([
        { module: "students", _count: { _all: 5 } },
      ] as never);

    const result = await getAuditReportAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data).toHaveProperty("entries");
    expect(data).toHaveProperty("pagination");
    expect(data).toHaveProperty("byAction");
    expect(data).toHaveProperty("byModule");
  });
});

// ─── getBoardingReportAction ──────────────────────────────────────

describe("getBoardingReportAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getBoardingReportAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getBoardingReportAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return boarding report data", async () => {
    prismaMock.hostel.count.mockResolvedValue(2 as never);
    prismaMock.bed.groupBy.mockResolvedValue([
      { status: "OCCUPIED", _count: { _all: 50 } },
      { status: "AVAILABLE", _count: { _all: 30 } },
    ] as never);
    prismaMock.hostel.findMany.mockResolvedValue([
      {
        id: "h1",
        name: "Boys Hostel",
        gender: "MALE",
        dormitories: [
          {
            beds: [{ status: "OCCUPIED" }, { status: "AVAILABLE" }],
          },
        ],
      },
    ] as never);
    prismaMock.exeat.count
      .mockResolvedValueOnce(5 as never)   // active
      .mockResolvedValueOnce(1 as never);  // overdue
    prismaMock.exeat.findMany.mockResolvedValue([] as never);

    const result = await getBoardingReportAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.totalHostels).toBe(2);
    expect(data).toHaveProperty("occupancyByHostel");
    expect(data.activeExeatCount).toBe(5);
    expect(data.overdueExeatCount).toBe(1);
  });
});

// ─── getDisciplineReportAction ────────────────────────────────────

describe("getDisciplineReportAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getDisciplineReportAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getDisciplineReportAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return discipline report data", async () => {
    prismaMock.disciplinaryIncident.groupBy
      .mockResolvedValueOnce([
        { severity: "MINOR", _count: { _all: 5 } },
        { severity: "MAJOR", _count: { _all: 2 } },
      ] as never)
      .mockResolvedValueOnce([
        { status: "REPORTED", _count: { _all: 3 } },
        { status: "RESOLVED", _count: { _all: 4 } },
      ] as never)
      .mockResolvedValueOnce([
        { type: "FIGHTING", _count: { _all: 3 } },
      ] as never);
    prismaMock.disciplinaryIncident.findMany.mockResolvedValue([] as never);

    const result = await getDisciplineReportAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.totalIncidents).toBe(7);
    expect(data).toHaveProperty("bySeverity");
    expect(data).toHaveProperty("byStatus");
    expect(data).toHaveProperty("topIncidentTypes");
  });
});

// ─── getFinanceReportAction ───────────────────────────────────────

describe("getFinanceReportAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getFinanceReportAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getFinanceReportAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return error if no academic year found", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue(null as never);
    const result = await getFinanceReportAction();
    expect(result).toEqual({ error: "No academic year found." });
  });

  it("should return finance report data", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: "ay-1",
      isCurrent: true,
    } as never);
    prismaMock.studentBill.aggregate.mockResolvedValue({
      _sum: { totalAmount: 100000, paidAmount: 75000, balanceAmount: 25000 },
    } as never);
    prismaMock.payment.groupBy.mockResolvedValue([
      { paymentMethod: "CASH", _sum: { amount: 50000 }, _count: { _all: 20 } },
    ] as never);
    prismaMock.studentBillItem.findMany.mockResolvedValue([
      { feeItem: { name: "Tuition" }, amount: 100000 },
    ] as never);
    prismaMock.studentBill.findMany.mockResolvedValue([] as never);
    prismaMock.payment.findMany.mockResolvedValue([] as never);

    const result = await getFinanceReportAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.totalBilled).toBe(100000);
    expect(data.totalPaid).toBe(75000);
    expect(data.totalOutstanding).toBe(25000);
    expect(data).toHaveProperty("byPaymentMethod");
    expect(data).toHaveProperty("revenueByCategory");
  });
});

// ─── getHrReportAction ────────────────────────────────────────────

describe("getHrReportAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getHrReportAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getHrReportAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return HR report data", async () => {
    prismaMock.staff.count.mockResolvedValue(30 as never);
    prismaMock.staff.groupBy
      .mockResolvedValueOnce([
        { staffType: "TEACHING", _count: { _all: 20 } },
        { staffType: "NON_TEACHING", _count: { _all: 10 } },
      ] as never)
      .mockResolvedValueOnce([
        { status: "ACTIVE", _count: { _all: 28 } },
        { status: "ON_LEAVE", _count: { _all: 2 } },
      ] as never);
    prismaMock.department.findMany.mockResolvedValue([
      { id: "dept-1", name: "Science" },
    ] as never);
    prismaMock.employment.groupBy
      .mockResolvedValueOnce([
        { departmentId: "dept-1", _count: { _all: 10 } },
      ] as never)
      .mockResolvedValueOnce([
        { appointmentType: "PERMANENT", _count: { _all: 25 } },
      ] as never);
    prismaMock.leaveRequest.count.mockResolvedValue(5 as never);
    prismaMock.leaveRequest.groupBy.mockResolvedValue([
      { status: "APPROVED", _count: { _all: 3 } },
      { status: "PENDING", _count: { _all: 2 } },
    ] as never);

    const result = await getHrReportAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.totalStaff).toBe(30);
    expect(data).toHaveProperty("byType");
    expect(data).toHaveProperty("byStatus");
    expect(data).toHaveProperty("leaveSummary");
    expect(data).toHaveProperty("byAppointmentType");
  });
});

// ─── getInventoryReportAction ─────────────────────────────────────

describe("getInventoryReportAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getInventoryReportAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getInventoryReportAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return inventory report data", async () => {
    prismaMock.storeItem.findMany
      .mockResolvedValueOnce([
        {
          id: "item-1",
          name: "Chalk",
          code: "CHK",
          unit: "box",
          quantity: 5,
          reorderLevel: 10,
          unitPrice: 20,
        },
        {
          id: "item-2",
          name: "Marker",
          code: "MKR",
          unit: "piece",
          quantity: 50,
          reorderLevel: 10,
          unitPrice: 5,
        },
      ] as never)
      .mockResolvedValueOnce([] as never); // for topIssuedItems lookup
    prismaMock.stockMovement.groupBy
      .mockResolvedValueOnce([
        { type: "IN", _sum: { quantity: 100 }, _count: { _all: 5 } },
        { type: "OUT", _sum: { quantity: 50 }, _count: { _all: 10 } },
      ] as never)
      .mockResolvedValueOnce([] as never); // topIssuedRaw
    prismaMock.store.findMany.mockResolvedValue([] as never);
    prismaMock.purchaseRequest.count.mockResolvedValue(3 as never);

    const result = await getInventoryReportAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.totalItems).toBe(2);
    expect(data).toHaveProperty("lowStockItems");
    expect(data).toHaveProperty("stockMovementsSummary");
    expect(data.pendingPurchaseRequests).toBe(3);
  });
});

// ─── getStudentRegisterReportAction ───────────────────────────────

describe("getStudentRegisterReportAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getStudentRegisterReportAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getStudentRegisterReportAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return error if no academic year found", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue(null as never);
    const result = await getStudentRegisterReportAction();
    expect(result).toEqual({ error: "No academic year found." });
  });

  it("should return student register report data", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: "ay-1",
      isCurrent: true,
    } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      {
        student: {
          id: "s1",
          studentId: "SCH/2026/0001",
          firstName: "Kwame",
          lastName: "Asante",
          otherNames: null,
          gender: "MALE",
          boardingStatus: "DAY",
          status: "ACTIVE",
        },
        classArm: { name: "A", class: { name: "SHS 1" } },
      },
    ] as never);

    const result = await getStudentRegisterReportAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.totalStudents).toBe(1);
    expect(data).toHaveProperty("genderDistribution");
    expect(data).toHaveProperty("boardingBreakdown");
    expect(data).toHaveProperty("statusBreakdown");
  });
});
