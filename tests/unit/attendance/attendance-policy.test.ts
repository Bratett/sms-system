import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";

vi.mock("@/lib/notifications/dispatcher", () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/events", () => ({
  NOTIFICATION_EVENTS: {
    CHRONIC_ABSENCE_WARNING: "chronic_absence_warning",
    CHRONIC_ABSENCE_CRITICAL: "chronic_absence_critical",
  },
}));

import {
  createAttendancePolicyAction,
  getAttendancePoliciesAction,
  updateAttendancePolicyAction,
  deleteAttendancePolicyAction,
  getAttendanceAlertsAction,
  acknowledgeAlertAction,
  resolveAlertAction,
} from "@/modules/attendance/actions/attendance-policy.action";

// ─── createAttendancePolicyAction ─────────────────────────────────────

describe("createAttendancePolicyAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createAttendancePolicyAction({
      name: "Test Policy",
      scope: "SCHOOL",
      metric: "ABSENCE_COUNT",
      threshold: 5,
      period: "TERM",
      severity: "WARNING",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should create a policy successfully", async () => {
    prismaMock.attendancePolicy.create.mockResolvedValue({
      id: "policy-1",
      name: "Chronic Absence",
      schoolId: "default-school",
    } as never);

    const result = await createAttendancePolicyAction({
      name: "Chronic Absence",
      scope: "SCHOOL",
      metric: "ABSENCE_COUNT",
      threshold: 10,
      period: "TERM",
      severity: "WARNING",
    });

    expect(result.data?.id).toBe("policy-1");
    expect(prismaMock.attendancePolicy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: "default-school",
          name: "Chronic Absence",
          metric: "ABSENCE_COUNT",
          threshold: 10,
        }),
      }),
    );
  });
});

// ─── getAttendancePoliciesAction ──────────────────────────────────────

describe("getAttendancePoliciesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should return policies with alert counts", async () => {
    prismaMock.attendancePolicy.findMany.mockResolvedValue([
      {
        id: "policy-1",
        name: "Late Policy",
        scope: "SCHOOL",
        scopeId: null,
        metric: "LATE_COUNT",
        threshold: 5,
        period: "MONTHLY",
        severity: "INFO",
        actions: null,
        isActive: true,
        createdAt: new Date(),
        _count: { alerts: 3 },
      },
    ] as never);

    const result = await getAttendancePoliciesAction();
    expect(result.data).toHaveLength(1);
    expect(result.data![0]).toMatchObject({
      name: "Late Policy",
      metric: "LATE_COUNT",
      alertCount: 3,
    });
  });
});

// ─── updateAttendancePolicyAction ─────────────────────────────────────

describe("updateAttendancePolicyAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject when policy not found", async () => {
    prismaMock.attendancePolicy.findUnique.mockResolvedValue(null);
    const result = await updateAttendancePolicyAction("nonexistent", { isActive: false });
    expect(result).toEqual({ error: "Policy not found." });
  });

  it("should update policy fields", async () => {
    prismaMock.attendancePolicy.findUnique.mockResolvedValue({
      id: "policy-1",
      name: "Test",
    } as never);
    prismaMock.attendancePolicy.update.mockResolvedValue({} as never);

    const result = await updateAttendancePolicyAction("policy-1", {
      isActive: false,
      threshold: 15,
    });
    expect(result).toEqual({ success: true });
    expect(prismaMock.attendancePolicy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "policy-1" },
        data: expect.objectContaining({ isActive: false, threshold: 15 }),
      }),
    );
  });
});

// ─── deleteAttendancePolicyAction ─────────────────────────────────────

describe("deleteAttendancePolicyAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject when policy not found", async () => {
    prismaMock.attendancePolicy.findUnique.mockResolvedValue(null);
    const result = await deleteAttendancePolicyAction("nonexistent");
    expect(result).toEqual({ error: "Policy not found." });
  });

  it("should delete a policy", async () => {
    prismaMock.attendancePolicy.findUnique.mockResolvedValue({
      id: "policy-1",
      name: "Test",
    } as never);
    prismaMock.attendancePolicy.delete.mockResolvedValue({} as never);

    const result = await deleteAttendancePolicyAction("policy-1");
    expect(result).toEqual({ success: true });
  });
});

// ─── getAttendanceAlertsAction ────────────────────────────────────────

describe("getAttendanceAlertsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should return paginated alerts with student names", async () => {
    prismaMock.attendanceAlert.findMany.mockResolvedValue([
      {
        id: "alert-1",
        studentId: "s1",
        policyId: "p1",
        metric: "ABSENCE_COUNT",
        currentValue: 12,
        threshold: 10,
        severity: "WARNING",
        status: "OPEN",
        notes: null,
        createdAt: new Date(),
        policy: { name: "Chronic Absence", metric: "ABSENCE_COUNT", period: "TERM" },
      },
    ] as never);
    prismaMock.attendanceAlert.count.mockResolvedValue(1 as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s1", firstName: "Kwame", lastName: "Asante", studentId: "SCH/2026/0001" },
    ] as never);

    const result = await getAttendanceAlertsAction({ status: "OPEN" });
    expect(result.data).toHaveLength(1);
    expect(result.data![0]).toMatchObject({
      studentName: "Kwame Asante",
      severity: "WARNING",
      status: "OPEN",
    });
  });
});

// ─── acknowledgeAlertAction ───────────────────────────────────────────

describe("acknowledgeAlertAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should acknowledge an alert", async () => {
    prismaMock.attendanceAlert.update.mockResolvedValue({} as never);
    const result = await acknowledgeAlertAction("alert-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.attendanceAlert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "alert-1" },
        data: { status: "ACKNOWLEDGED" },
      }),
    );
  });
});

// ─── resolveAlertAction ───────────────────────────────────────────────

describe("resolveAlertAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should resolve an alert with notes", async () => {
    prismaMock.attendanceAlert.update.mockResolvedValue({} as never);
    const result = await resolveAlertAction("alert-1", "Contacted parents");
    expect(result).toEqual({ success: true });
    expect(prismaMock.attendanceAlert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "RESOLVED",
          notes: "Contacted parents",
          resolvedBy: "test-user-id",
        }),
      }),
    );
  });
});
