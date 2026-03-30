import { describe, it, expect, beforeEach } from "vitest";
import {
  prismaMock,
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "../setup";

import {
  getStaffAction,
  getStaffMemberAction,
  createStaffAction,
  updateStaffAction,
  terminateStaffAction,
  getStaffStatsAction,
  importStaffAction,
} from "@/modules/hr/actions/staff.action";

import {
  getLeaveTypesAction,
  createLeaveTypeAction,
  updateLeaveTypeAction,
  deleteLeaveTypeAction,
  initializeLeaveBalancesAction,
  getLeaveRequestsAction,
  requestLeaveAction,
  approveLeaveAction,
  rejectLeaveAction,
  cancelLeaveAction,
} from "@/modules/hr/actions/leave.action";

import {
  getAllowancesAction,
  createAllowanceAction,
  deleteAllowanceAction,
  getDeductionsAction,
  createDeductionAction,
  deleteDeductionAction,
  getPayrollPeriodsAction,
  createPayrollPeriodAction,
  generatePayrollAction,
  approvePayrollAction,
  getPayrollEntriesAction,
} from "@/modules/hr/actions/payroll.action";

import {
  createPerformanceNoteAction,
  getPerformanceNotesAction,
} from "@/modules/hr/actions/performance.action";

import {
  reportStaffDisciplinaryAction,
  getStaffDisciplinaryRecordsAction,
  resolveStaffDisciplinaryAction,
} from "@/modules/hr/actions/staff-discipline.action";

// ─── Staff CRUD ────────────────────────────────────────────────────

describe("getStaffAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getStaffAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null);
    const result = await getStaffAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return paginated staff list", async () => {
    prismaMock.staff.findMany.mockResolvedValue([
      {
        id: "staff-1",
        staffId: "STF/2025/0001",
        firstName: "Jane",
        lastName: "Smith",
        otherNames: null,
        gender: "FEMALE",
        phone: "0200000000",
        email: null,
        staffType: "TEACHING",
        status: "ACTIVE",
        createdAt: new Date(),
        employments: [{ departmentId: "dept-1", position: "Teacher" }],
      },
    ] as never);
    prismaMock.staff.count.mockResolvedValue(1 as never);
    prismaMock.department.findMany.mockResolvedValue([
      { id: "dept-1", name: "Science" },
    ] as never);

    const result = await getStaffAction();
    expect(result).toHaveProperty("staff");
    expect(result).toHaveProperty("total", 1);
  });
});

describe("getStaffMemberAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getStaffMemberAction("staff-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if staff not found", async () => {
    prismaMock.staff.findUnique.mockResolvedValue(null);
    const result = await getStaffMemberAction("nonexistent");
    expect(result).toEqual({ error: "Staff member not found." });
  });

  it("should return staff member with employments and leave balances", async () => {
    prismaMock.staff.findUnique.mockResolvedValue({
      id: "staff-1",
      staffId: "STF/2025/0001",
      firstName: "Jane",
      lastName: "Smith",
      otherNames: null,
      dateOfBirth: null,
      gender: "FEMALE",
      phone: "0200000000",
      email: null,
      address: null,
      region: null,
      ghanaCardNumber: null,
      ssnitNumber: null,
      tinNumber: null,
      staffType: "TEACHING",
      specialization: null,
      qualifications: null,
      dateOfFirstAppointment: null,
      dateOfPostingToSchool: null,
      photoUrl: null,
      status: "ACTIVE",
      userId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      employments: [
        {
          id: "emp-1",
          position: "Teacher",
          rank: null,
          departmentId: null,
          startDate: new Date(),
          endDate: null,
          appointmentType: "PERMANENT",
          salaryGrade: null,
          status: "ACTIVE",
        },
      ],
    } as never);
    prismaMock.leaveBalance.findMany.mockResolvedValue([] as never);

    const result = await getStaffMemberAction("staff-1");
    expect(result).toHaveProperty("data");
    expect((result as { data: { id: string } }).data.id).toBe("staff-1");
  });
});

describe("createStaffAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createStaffAction({
      firstName: "Jane",
      lastName: "Smith",
      gender: "FEMALE",
      phone: "0200000000",
      staffType: "TEACHING",
      position: "Teacher",
      appointmentType: "PERMANENT",
      startDate: "2025-01-01",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject invalid input", async () => {
    const result = await createStaffAction({
      firstName: "",
      lastName: "",
      gender: "FEMALE",
      phone: "",
      staffType: "TEACHING",
      position: "",
      appointmentType: "PERMANENT",
      startDate: "",
    });
    expect(result).toHaveProperty("error", "Invalid input");
    expect(result).toHaveProperty("details");
  });

  it("should create staff with auto-generated ID", async () => {
    prismaMock.staff.count.mockResolvedValue(5 as never);
    prismaMock.staff.create.mockResolvedValue({
      id: "staff-1",
      staffId: "STF/2025/0006",
      firstName: "Jane",
      lastName: "Smith",
    } as never);

    const result = await createStaffAction({
      firstName: "Jane",
      lastName: "Smith",
      gender: "FEMALE",
      phone: "0200000000",
      staffType: "TEACHING",
      position: "Teacher",
      appointmentType: "PERMANENT",
      startDate: "2025-01-01",
    });

    expect(result).toHaveProperty("data");
    expect((result as { data: { id: string } }).data.id).toBe("staff-1");
  });
});

describe("updateStaffAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateStaffAction("staff-1", { firstName: "Updated" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if staff not found", async () => {
    prismaMock.staff.findUnique.mockResolvedValue(null);
    const result = await updateStaffAction("nonexistent", { firstName: "Updated" });
    expect(result).toEqual({ error: "Staff member not found." });
  });

  it("should update staff successfully", async () => {
    prismaMock.staff.findUnique.mockResolvedValue({
      id: "staff-1",
      firstName: "Jane",
      lastName: "Smith",
    } as never);
    prismaMock.staff.update.mockResolvedValue({
      id: "staff-1",
      firstName: "Updated",
      lastName: "Smith",
    } as never);

    const result = await updateStaffAction("staff-1", { firstName: "Updated" });
    expect(result).toHaveProperty("data");
    expect((result as { data: { firstName: string } }).data.firstName).toBe("Updated");
  });
});

describe("terminateStaffAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await terminateStaffAction("staff-1", {
      reason: "Retirement",
      endDate: "2025-06-30",
      type: "RETIRED",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if staff not found", async () => {
    prismaMock.staff.findUnique.mockResolvedValue(null);
    const result = await terminateStaffAction("nonexistent", {
      reason: "Retirement",
      endDate: "2025-06-30",
      type: "RETIRED",
    });
    expect(result).toEqual({ error: "Staff member not found." });
  });

  it("should terminate staff and deactivate user account", async () => {
    prismaMock.staff.findUnique.mockResolvedValue({
      id: "staff-1",
      firstName: "Jane",
      lastName: "Smith",
      userId: "user-1",
      employments: [{ id: "emp-1", status: "ACTIVE" }],
    } as never);
    prismaMock.employment.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.staff.update.mockResolvedValue({ id: "staff-1", status: "RETIRED" } as never);
    prismaMock.user.update.mockResolvedValue({ id: "user-1", status: "INACTIVE" } as never);

    const result = await terminateStaffAction("staff-1", {
      reason: "Retirement",
      endDate: "2025-06-30",
      type: "RETIRED",
    });
    expect(result).toEqual({ success: true });
  });
});

describe("getStaffStatsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getStaffStatsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return staff statistics", async () => {
    prismaMock.staff.count.mockResolvedValue(50 as never);
    prismaMock.leaveRequest.count.mockResolvedValue(3 as never);
    prismaMock.department.findMany.mockResolvedValue([] as never);

    const result = await getStaffStatsAction();
    expect(result).toHaveProperty("data");
  });
});

describe("importStaffAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await importStaffAction([]);
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should report errors for rows with missing required fields", async () => {
    prismaMock.staff.count.mockResolvedValue(0 as never);

    const result = await importStaffAction([
      {
        firstName: "",
        lastName: "Smith",
        gender: "FEMALE",
        phone: "0200000000",
        staffType: "TEACHING",
        position: "Teacher",
      },
    ]);

    expect(result).toHaveProperty("errors");
    expect((result as { errors: { row: number }[] }).errors).toHaveLength(1);
    expect((result as { imported: number }).imported).toBe(0);
  });

  it("should import valid staff rows", async () => {
    prismaMock.staff.count.mockResolvedValue(0 as never);
    prismaMock.staff.create.mockResolvedValue({ id: "staff-1" } as never);

    const result = await importStaffAction([
      {
        firstName: "Jane",
        lastName: "Smith",
        gender: "FEMALE",
        phone: "0200000000",
        staffType: "TEACHING",
        position: "Teacher",
      },
    ]);

    expect((result as { imported: number }).imported).toBe(1);
  });

  it("should reject invalid gender values", async () => {
    prismaMock.staff.count.mockResolvedValue(0 as never);

    const result = await importStaffAction([
      {
        firstName: "Jane",
        lastName: "Smith",
        gender: "INVALID",
        phone: "0200000000",
        staffType: "TEACHING",
        position: "Teacher",
      },
    ]);

    expect((result as { errors: { row: number }[] }).errors).toHaveLength(1);
  });
});

// ─── Leave Types ───────────────────────────────────────────────────

describe("getLeaveTypesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getLeaveTypesAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return leave types", async () => {
    prismaMock.leaveType.findMany.mockResolvedValue([
      { id: "lt-1", name: "Annual", defaultDays: 20, requiresApproval: true, applicableGender: null, status: "ACTIVE" },
    ] as never);

    const result = await getLeaveTypesAction();
    expect(result).toHaveProperty("data");
    expect((result as { data: unknown[] }).data).toHaveLength(1);
  });
});

describe("createLeaveTypeAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createLeaveTypeAction({ name: "Annual", defaultDays: 20 });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject duplicate leave type name", async () => {
    prismaMock.leaveType.findUnique.mockResolvedValue({ id: "lt-1", name: "Annual" } as never);

    const result = await createLeaveTypeAction({ name: "Annual", defaultDays: 20 });
    expect(result).toEqual({ error: 'A leave type named "Annual" already exists.' });
  });

  it("should create leave type successfully", async () => {
    prismaMock.leaveType.findUnique.mockResolvedValue(null);
    prismaMock.leaveType.create.mockResolvedValue({
      id: "lt-1",
      name: "Annual",
      defaultDays: 20,
    } as never);

    const result = await createLeaveTypeAction({ name: "Annual", defaultDays: 20 });
    expect(result).toHaveProperty("data");
  });
});

describe("updateLeaveTypeAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateLeaveTypeAction("lt-1", { name: "Updated" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if leave type not found", async () => {
    prismaMock.leaveType.findUnique.mockResolvedValue(null);
    const result = await updateLeaveTypeAction("nonexistent", { name: "Updated" });
    expect(result).toEqual({ error: "Leave type not found." });
  });

  it("should update leave type successfully", async () => {
    prismaMock.leaveType.findUnique.mockResolvedValue({
      id: "lt-1",
      name: "Annual",
      defaultDays: 20,
      requiresApproval: true,
      applicableGender: null,
    } as never);
    prismaMock.leaveType.update.mockResolvedValue({
      id: "lt-1",
      name: "Updated",
      defaultDays: 25,
    } as never);

    const result = await updateLeaveTypeAction("lt-1", { name: "Updated", defaultDays: 25 });
    expect(result).toHaveProperty("data");
  });
});

describe("deleteLeaveTypeAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteLeaveTypeAction("lt-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if leave type not found", async () => {
    prismaMock.leaveType.findUnique.mockResolvedValue(null);
    const result = await deleteLeaveTypeAction("nonexistent");
    expect(result).toEqual({ error: "Leave type not found." });
  });

  it("should reject deletion if leave type has requests", async () => {
    prismaMock.leaveType.findUnique.mockResolvedValue({
      id: "lt-1",
      name: "Annual",
      _count: { leaveRequests: 3 },
    } as never);

    const result = await deleteLeaveTypeAction("lt-1");
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Cannot delete");
  });

  it("should delete leave type with no requests", async () => {
    prismaMock.leaveType.findUnique.mockResolvedValue({
      id: "lt-1",
      name: "Annual",
      _count: { leaveRequests: 0 },
    } as never);
    prismaMock.leaveType.delete.mockResolvedValue({ id: "lt-1" } as never);

    const result = await deleteLeaveTypeAction("lt-1");
    expect(result).toEqual({ success: true });
  });
});

// ─── Leave Request Workflow ────────────────────────────────────────

describe("requestLeaveAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await requestLeaveAction({
      staffId: "staff-1",
      leaveTypeId: "lt-1",
      startDate: "2025-03-10",
      endDate: "2025-03-14",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if staff not found", async () => {
    prismaMock.staff.findUnique.mockResolvedValue(null);
    const result = await requestLeaveAction({
      staffId: "nonexistent",
      leaveTypeId: "lt-1",
      startDate: "2025-03-10",
      endDate: "2025-03-14",
    });
    expect(result).toEqual({ error: "Staff member not found." });
  });

  it("should return error if leave type not found", async () => {
    prismaMock.staff.findUnique.mockResolvedValue({ id: "staff-1" } as never);
    prismaMock.leaveType.findUnique.mockResolvedValue(null);
    const result = await requestLeaveAction({
      staffId: "staff-1",
      leaveTypeId: "nonexistent",
      startDate: "2025-03-10",
      endDate: "2025-03-14",
    });
    expect(result).toEqual({ error: "Leave type not found." });
  });

  it("should return error if end date before start date", async () => {
    prismaMock.staff.findUnique.mockResolvedValue({ id: "staff-1" } as never);
    prismaMock.leaveType.findUnique.mockResolvedValue({ id: "lt-1" } as never);

    const result = await requestLeaveAction({
      staffId: "staff-1",
      leaveTypeId: "lt-1",
      startDate: "2025-03-14",
      endDate: "2025-03-10",
    });
    expect(result).toEqual({ error: "End date must be after start date." });
  });

  it("should return error if insufficient leave balance", async () => {
    prismaMock.staff.findUnique.mockResolvedValue({ id: "staff-1" } as never);
    prismaMock.leaveType.findUnique.mockResolvedValue({ id: "lt-1" } as never);
    prismaMock.leaveBalance.findFirst.mockResolvedValue({
      id: "lb-1",
      remainingDays: 1,
    } as never);

    const result = await requestLeaveAction({
      staffId: "staff-1",
      leaveTypeId: "lt-1",
      startDate: "2025-03-10",
      endDate: "2025-03-14",
    });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Insufficient leave balance");
  });

  it("should create leave request successfully", async () => {
    prismaMock.staff.findUnique.mockResolvedValue({
      id: "staff-1",
      firstName: "Jane",
      lastName: "Smith",
    } as never);
    prismaMock.leaveType.findUnique.mockResolvedValue({
      id: "lt-1",
      name: "Annual",
    } as never);
    prismaMock.leaveBalance.findFirst.mockResolvedValue({
      id: "lb-1",
      remainingDays: 20,
    } as never);
    prismaMock.leaveRequest.create.mockResolvedValue({
      id: "lr-1",
      staffId: "staff-1",
      leaveTypeId: "lt-1",
      status: "PENDING",
      daysRequested: 5,
    } as never);

    const result = await requestLeaveAction({
      staffId: "staff-1",
      leaveTypeId: "lt-1",
      startDate: "2025-03-10",
      endDate: "2025-03-14",
    });
    expect(result).toHaveProperty("data");
  });
});

describe("approveLeaveAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await approveLeaveAction("lr-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if leave request not found", async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValue(null);
    const result = await approveLeaveAction("nonexistent");
    expect(result).toEqual({ error: "Leave request not found." });
  });

  it("should reject if not pending", async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValue({
      id: "lr-1",
      status: "APPROVED",
      staff: { firstName: "Jane", lastName: "Smith" },
      leaveType: { name: "Annual" },
    } as never);

    const result = await approveLeaveAction("lr-1");
    expect(result).toEqual({ error: "Only pending requests can be approved." });
  });

  it("should approve leave and deduct balance", async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValue({
      id: "lr-1",
      staffId: "staff-1",
      leaveTypeId: "lt-1",
      status: "PENDING",
      daysRequested: 5,
      staff: { firstName: "Jane", lastName: "Smith" },
      leaveType: { name: "Annual" },
    } as never);
    prismaMock.leaveRequest.update.mockResolvedValue({
      id: "lr-1",
      status: "APPROVED",
    } as never);
    prismaMock.leaveBalance.findFirst.mockResolvedValue({
      id: "lb-1",
      usedDays: 5,
      remainingDays: 15,
    } as never);
    prismaMock.leaveBalance.update.mockResolvedValue({ id: "lb-1" } as never);

    const result = await approveLeaveAction("lr-1");
    expect(result).toHaveProperty("data");
    expect((result as { data: { status: string } }).data.status).toBe("APPROVED");
  });
});

describe("rejectLeaveAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await rejectLeaveAction("lr-1", "Not enough coverage");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if not found", async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValue(null);
    const result = await rejectLeaveAction("nonexistent", "Not enough coverage");
    expect(result).toEqual({ error: "Leave request not found." });
  });

  it("should reject non-pending requests", async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValue({
      id: "lr-1",
      status: "APPROVED",
      staff: {},
      leaveType: {},
    } as never);

    const result = await rejectLeaveAction("lr-1", "Reason");
    expect(result).toEqual({ error: "Only pending requests can be rejected." });
  });

  it("should reject leave request successfully", async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValue({
      id: "lr-1",
      status: "PENDING",
      staff: { firstName: "Jane", lastName: "Smith" },
      leaveType: { name: "Annual" },
    } as never);
    prismaMock.leaveRequest.update.mockResolvedValue({
      id: "lr-1",
      status: "REJECTED",
    } as never);

    const result = await rejectLeaveAction("lr-1", "Not enough coverage");
    expect(result).toHaveProperty("data");
    expect((result as { data: { status: string } }).data.status).toBe("REJECTED");
  });
});

describe("cancelLeaveAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await cancelLeaveAction("lr-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if not found", async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValue(null);
    const result = await cancelLeaveAction("nonexistent");
    expect(result).toEqual({ error: "Leave request not found." });
  });

  it("should reject if already rejected or cancelled", async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValue({
      id: "lr-1",
      status: "REJECTED",
      staff: {},
      leaveType: {},
    } as never);

    const result = await cancelLeaveAction("lr-1");
    expect(result).toEqual({ error: "Only pending or approved requests can be cancelled." });
  });

  it("should cancel pending request without restoring balance", async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValue({
      id: "lr-1",
      status: "PENDING",
      staffId: "staff-1",
      leaveTypeId: "lt-1",
      daysRequested: 5,
      staff: { firstName: "Jane", lastName: "Smith" },
      leaveType: { name: "Annual" },
    } as never);
    prismaMock.leaveRequest.update.mockResolvedValue({
      id: "lr-1",
      status: "CANCELLED",
    } as never);

    const result = await cancelLeaveAction("lr-1");
    expect(result).toHaveProperty("data");
    expect((result as { data: { status: string } }).data.status).toBe("CANCELLED");
    // Should not call leaveBalance.findFirst for pending cancellation
  });

  it("should cancel approved request and restore balance", async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValue({
      id: "lr-1",
      status: "APPROVED",
      staffId: "staff-1",
      leaveTypeId: "lt-1",
      daysRequested: 5,
      staff: { firstName: "Jane", lastName: "Smith" },
      leaveType: { name: "Annual" },
    } as never);
    prismaMock.leaveRequest.update.mockResolvedValue({
      id: "lr-1",
      status: "CANCELLED",
    } as never);
    prismaMock.leaveBalance.findFirst.mockResolvedValue({
      id: "lb-1",
      usedDays: 10,
      remainingDays: 10,
    } as never);
    prismaMock.leaveBalance.update.mockResolvedValue({ id: "lb-1" } as never);

    const result = await cancelLeaveAction("lr-1");
    expect(result).toHaveProperty("data");
    expect(prismaMock.leaveBalance.update).toHaveBeenCalled();
  });
});

describe("initializeLeaveBalancesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await initializeLeaveBalancesAction("staff-1", "ay-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if staff not found", async () => {
    prismaMock.staff.findUnique.mockResolvedValue(null);
    const result = await initializeLeaveBalancesAction("nonexistent", "ay-1");
    expect(result).toEqual({ error: "Staff member not found." });
  });

  it("should initialize leave balances for applicable leave types", async () => {
    prismaMock.staff.findUnique.mockResolvedValue({
      id: "staff-1",
      firstName: "Jane",
      lastName: "Smith",
      gender: "FEMALE",
    } as never);
    prismaMock.leaveType.findMany.mockResolvedValue([
      { id: "lt-1", name: "Annual", defaultDays: 20 },
    ] as never);
    prismaMock.leaveBalance.findUnique.mockResolvedValue(null);
    prismaMock.leaveBalance.create.mockResolvedValue({ id: "lb-1" } as never);

    const result = await initializeLeaveBalancesAction("staff-1", "ay-1");
    expect(result).toHaveProperty("data");
    expect((result as { data: { created: number } }).data.created).toBe(1);
  });
});

// ─── Payroll ───────────────────────────────────────────────────────

describe("getAllowancesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAllowancesAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return allowances", async () => {
    prismaMock.allowance.findMany.mockResolvedValue([
      { id: "a-1", name: "Transport", type: "FIXED", amount: 200, status: "ACTIVE" },
    ] as never);

    const result = await getAllowancesAction();
    expect(result).toHaveProperty("data");
    expect((result as { data: unknown[] }).data).toHaveLength(1);
  });
});

describe("createAllowanceAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createAllowanceAction({ name: "Transport", type: "FIXED", amount: 200 });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject duplicate allowance name", async () => {
    prismaMock.allowance.findUnique.mockResolvedValue({ id: "a-1" } as never);
    const result = await createAllowanceAction({ name: "Transport", type: "FIXED", amount: 200 });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("already exists");
  });

  it("should create allowance successfully", async () => {
    prismaMock.allowance.findUnique.mockResolvedValue(null);
    prismaMock.allowance.create.mockResolvedValue({
      id: "a-1",
      name: "Transport",
      type: "FIXED",
      amount: 200,
    } as never);

    const result = await createAllowanceAction({ name: "Transport", type: "FIXED", amount: 200 });
    expect(result).toHaveProperty("data");
  });
});

describe("deleteAllowanceAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteAllowanceAction("a-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if not found", async () => {
    prismaMock.allowance.findUnique.mockResolvedValue(null);
    const result = await deleteAllowanceAction("nonexistent");
    expect(result).toEqual({ error: "Allowance not found." });
  });

  it("should delete allowance successfully", async () => {
    prismaMock.allowance.findUnique.mockResolvedValue({ id: "a-1", name: "Transport" } as never);
    prismaMock.allowance.delete.mockResolvedValue({ id: "a-1" } as never);

    const result = await deleteAllowanceAction("a-1");
    expect(result).toEqual({ success: true });
  });
});

describe("createDeductionAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createDeductionAction({ name: "SSNIT", type: "PERCENTAGE", amount: 5.5 });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject duplicate deduction name", async () => {
    prismaMock.deduction.findUnique.mockResolvedValue({ id: "d-1" } as never);
    const result = await createDeductionAction({ name: "SSNIT", type: "PERCENTAGE", amount: 5.5 });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("already exists");
  });

  it("should create deduction successfully", async () => {
    prismaMock.deduction.findUnique.mockResolvedValue(null);
    prismaMock.deduction.create.mockResolvedValue({
      id: "d-1",
      name: "SSNIT",
      type: "PERCENTAGE",
      amount: 5.5,
    } as never);

    const result = await createDeductionAction({ name: "SSNIT", type: "PERCENTAGE", amount: 5.5 });
    expect(result).toHaveProperty("data");
  });
});

describe("deleteDeductionAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteDeductionAction("d-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if not found", async () => {
    prismaMock.deduction.findUnique.mockResolvedValue(null);
    const result = await deleteDeductionAction("nonexistent");
    expect(result).toEqual({ error: "Deduction not found." });
  });

  it("should delete deduction successfully", async () => {
    prismaMock.deduction.findUnique.mockResolvedValue({ id: "d-1", name: "SSNIT" } as never);
    prismaMock.deduction.delete.mockResolvedValue({ id: "d-1" } as never);

    const result = await deleteDeductionAction("d-1");
    expect(result).toEqual({ success: true });
  });
});

describe("createPayrollPeriodAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createPayrollPeriodAction({ month: 3, year: 2025 });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject duplicate payroll period", async () => {
    prismaMock.payrollPeriod.findUnique.mockResolvedValue({ id: "pp-1" } as never);
    const result = await createPayrollPeriodAction({ month: 3, year: 2025 });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("already exists");
  });

  it("should create payroll period successfully", async () => {
    prismaMock.payrollPeriod.findUnique.mockResolvedValue(null);
    prismaMock.payrollPeriod.create.mockResolvedValue({
      id: "pp-1",
      month: 3,
      year: 2025,
      status: "DRAFT",
    } as never);

    const result = await createPayrollPeriodAction({ month: 3, year: 2025 });
    expect(result).toHaveProperty("data");
  });
});

describe("generatePayrollAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await generatePayrollAction("pp-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if period not found", async () => {
    prismaMock.payrollPeriod.findUnique.mockResolvedValue(null);
    const result = await generatePayrollAction("nonexistent");
    expect(result).toEqual({ error: "Payroll period not found." });
  });

  it("should reject non-DRAFT periods", async () => {
    prismaMock.payrollPeriod.findUnique.mockResolvedValue({
      id: "pp-1",
      status: "APPROVED",
      entries: [],
    } as never);

    const result = await generatePayrollAction("pp-1");
    expect(result).toEqual({ error: "Only DRAFT payroll periods can have payroll generated." });
  });

  it("should generate payroll entries for active staff", async () => {
    prismaMock.payrollPeriod.findUnique.mockResolvedValue({
      id: "pp-1",
      status: "DRAFT",
      month: 3,
      year: 2025,
      entries: [],
    } as never);
    prismaMock.staff.findMany.mockResolvedValue([
      {
        id: "staff-1",
        staffId: "STF/2025/0001",
        employments: [{ salaryGrade: "Grade 3", status: "ACTIVE" }],
      },
    ] as never);
    prismaMock.allowance.findMany.mockResolvedValue([
      { id: "a-1", name: "Transport", type: "FIXED", amount: 200 },
    ] as never);
    prismaMock.deduction.findMany.mockResolvedValue([
      { id: "d-1", name: "SSNIT", type: "PERCENTAGE", amount: 5.5 },
    ] as never);
    prismaMock.payrollEntry.create.mockResolvedValue({ id: "pe-1" } as never);

    const result = await generatePayrollAction("pp-1");
    expect(result).toHaveProperty("generated");
    expect((result as { generated: number }).generated).toBe(1);
  });
});

describe("approvePayrollAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await approvePayrollAction("pp-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if period not found", async () => {
    prismaMock.payrollPeriod.findUnique.mockResolvedValue(null);
    const result = await approvePayrollAction("nonexistent");
    expect(result).toEqual({ error: "Payroll period not found." });
  });

  it("should reject non-DRAFT periods", async () => {
    prismaMock.payrollPeriod.findUnique.mockResolvedValue({
      id: "pp-1",
      status: "APPROVED",
      _count: { entries: 5 },
    } as never);

    const result = await approvePayrollAction("pp-1");
    expect(result).toEqual({ error: "Only DRAFT payroll periods can be approved." });
  });

  it("should reject periods with no entries", async () => {
    prismaMock.payrollPeriod.findUnique.mockResolvedValue({
      id: "pp-1",
      status: "DRAFT",
      _count: { entries: 0 },
    } as never);

    const result = await approvePayrollAction("pp-1");
    expect(result).toEqual({
      error: "Cannot approve a payroll period with no entries. Generate payroll first.",
    });
  });

  it("should approve payroll period successfully", async () => {
    prismaMock.payrollPeriod.findUnique.mockResolvedValue({
      id: "pp-1",
      status: "DRAFT",
      month: 3,
      year: 2025,
      _count: { entries: 5 },
    } as never);
    prismaMock.payrollPeriod.update.mockResolvedValue({
      id: "pp-1",
      status: "APPROVED",
    } as never);

    const result = await approvePayrollAction("pp-1");
    expect(result).toHaveProperty("data");
    expect((result as { data: { status: string } }).data.status).toBe("APPROVED");
  });
});

describe("getPayrollEntriesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getPayrollEntriesAction("pp-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return payroll entries with staff names", async () => {
    prismaMock.payrollEntry.findMany.mockResolvedValue([
      {
        id: "pe-1",
        staffId: "staff-1",
        basicSalary: 2800,
        totalAllowances: 200,
        totalDeductions: 154,
        netPay: 2846,
        details: null,
        createdAt: new Date(),
      },
    ] as never);
    prismaMock.staff.findMany.mockResolvedValue([
      { id: "staff-1", staffId: "STF/2025/0001", firstName: "Jane", lastName: "Smith" },
    ] as never);

    const result = await getPayrollEntriesAction("pp-1");
    expect(result).toHaveProperty("data");
    expect((result as { data: unknown[] }).data).toHaveLength(1);
  });
});

// ─── Performance Notes ─────────────────────────────────────────────

describe("createPerformanceNoteAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createPerformanceNoteAction({
      staffId: "staff-1",
      period: "Term 1 2025",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject invalid rating", async () => {
    const result = await createPerformanceNoteAction({
      staffId: "staff-1",
      period: "Term 1 2025",
      rating: 6,
    });
    expect(result).toEqual({ error: "Rating must be between 1 and 5" });
  });

  it("should create performance note successfully", async () => {
    prismaMock.performanceNote.create.mockResolvedValue({
      id: "pn-1",
      staffId: "staff-1",
      period: "Term 1 2025",
      rating: 4,
    } as never);

    const result = await createPerformanceNoteAction({
      staffId: "staff-1",
      period: "Term 1 2025",
      rating: 4,
      strengths: "Excellent",
    });

    expect(result).toHaveProperty("data");
  });
});

describe("getPerformanceNotesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getPerformanceNotesAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return paginated performance notes", async () => {
    prismaMock.performanceNote.findMany.mockResolvedValue([] as never);
    prismaMock.performanceNote.count.mockResolvedValue(0 as never);

    const result = await getPerformanceNotesAction();
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
  });
});

// ─── Staff Discipline ──────────────────────────────────────────────

describe("reportStaffDisciplinaryAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await reportStaffDisciplinaryAction({
      staffId: "staff-1",
      date: "2025-01-15",
      type: "MISCONDUCT",
      description: "Late to class",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should create staff disciplinary record", async () => {
    prismaMock.staffDisciplinary.create.mockResolvedValue({
      id: "sd-1",
      staffId: "staff-1",
      type: "MISCONDUCT",
      severity: "MINOR",
    } as never);

    const result = await reportStaffDisciplinaryAction({
      staffId: "staff-1",
      date: "2025-01-15",
      type: "MISCONDUCT",
      description: "Late to class",
    });

    expect(result).toHaveProperty("data");
  });
});

describe("getStaffDisciplinaryRecordsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getStaffDisciplinaryRecordsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return paginated disciplinary records", async () => {
    prismaMock.staffDisciplinary.findMany.mockResolvedValue([] as never);
    prismaMock.staffDisciplinary.count.mockResolvedValue(0 as never);

    const result = await getStaffDisciplinaryRecordsAction();
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
  });
});

describe("resolveStaffDisciplinaryAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await resolveStaffDisciplinaryAction("sd-1", {
      status: "RESOLVED",
      sanction: "Warning",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if record not found", async () => {
    prismaMock.staffDisciplinary.findUnique.mockResolvedValue(null);
    const result = await resolveStaffDisciplinaryAction("nonexistent", {
      status: "RESOLVED",
    });
    expect(result).toEqual({ error: "Record not found" });
  });

  it("should resolve staff disciplinary record", async () => {
    prismaMock.staffDisciplinary.findUnique.mockResolvedValue({
      id: "sd-1",
      status: "REPORTED",
    } as never);
    prismaMock.staffDisciplinary.update.mockResolvedValue({
      id: "sd-1",
      status: "RESOLVED",
      sanction: "Warning",
    } as never);

    const result = await resolveStaffDisciplinaryAction("sd-1", {
      status: "RESOLVED",
      sanction: "Warning",
    });

    expect(result).toHaveProperty("data");
    expect((result as { data: { status: string } }).data.status).toBe("RESOLVED");
  });
});
