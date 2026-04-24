import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { audit } from "@/lib/audit";
import {
  submitExcuseRequestAction,
  withdrawExcuseRequestAction,
  approveExcuseRequestAction,
  rejectExcuseRequestAction,
  getPendingExcuseRequestsAction,
} from "@/modules/parent-requests/actions/excuse.action";
import { notifyExcuseSubmitted, notifyExcuseReviewed } from "@/modules/parent-requests/notifications";

vi.mock("@/modules/parent-requests/notifications", () => ({
  notifyExcuseSubmitted: vi.fn().mockResolvedValue(undefined),
  notifyExcuseReviewed: vi.fn().mockResolvedValue(undefined),
}));

const within14Days = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
const older = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

const sampleStudent = {
  id: "s-1",
  schoolId: "default-school",
  status: "ACTIVE",
  boardingStatus: "BOARDING",
  firstName: "Kofi",
  lastName: "Asante",
  guardians: [{ guardian: { userId: "test-user-id" } }],
  enrollments: [{ classArmId: "arm-1" }],
  houseAssignment: { houseId: "house-1" },
};

describe("submitExcuseRequestAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["parent_requests:excuse:submit"] });
    vi.mocked(notifyExcuseSubmitted).mockClear();
  });

  it("rejects non-guardian parent", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      ...sampleStudent,
      guardians: [{ guardian: { userId: "other-user" } }],
    } as never);

    const res = await submitExcuseRequestAction({
      studentId: "s-1",
      fromDate: within14Days,
      toDate: within14Days,
      reason: "sick",
    });
    expect(res).toHaveProperty("error");
  });

  it("rejects dates older than 14 days", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    const res = await submitExcuseRequestAction({
      studentId: "s-1",
      fromDate: older,
      toDate: older,
      reason: "sick",
    });
    expect((res as { error: string }).error).toMatch(/14 days/);
  });

  it("rejects future dates", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    const res = await submitExcuseRequestAction({
      studentId: "s-1",
      fromDate: within14Days,
      toDate: future,
      reason: "sick",
    });
    expect(res).toHaveProperty("error");
  });

  it("rejects empty reason", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    const res = await submitExcuseRequestAction({
      studentId: "s-1",
      fromDate: within14Days,
      toDate: within14Days,
      reason: "   ",
    });
    expect(res).toHaveProperty("error");
  });

  it("creates request and triggers notify fan-out", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.classArm.findFirst.mockResolvedValue({
      id: "arm-1",
      classTeacherId: "staff-teacher",
    } as never);
    prismaMock.house.findFirst.mockResolvedValue({
      id: "house-1",
      housemasterId: "staff-hm",
    } as never);
    prismaMock.staff.findMany.mockResolvedValue([
      { id: "staff-teacher", userId: "user-teacher", firstName: "Ms", lastName: "Mensah" },
      { id: "staff-hm", userId: "user-hm", firstName: "Mr", lastName: "Asante" },
    ] as never);
    prismaMock.excuseRequest.create.mockResolvedValue({
      id: "req-1",
      schoolId: "default-school",
      studentId: "s-1",
    } as never);

    const res = await submitExcuseRequestAction({
      studentId: "s-1",
      fromDate: within14Days,
      toDate: within14Days,
      reason: "Fever",
    });
    if (!("data" in res)) throw new Error("expected data: " + JSON.stringify(res));
    expect(res.data.id).toBe("req-1");
    expect(vi.mocked(notifyExcuseSubmitted)).toHaveBeenCalled();
    const notifyCall = vi.mocked(notifyExcuseSubmitted).mock.calls[0][0];
    expect(notifyCall.reviewerUserIds).toEqual(
      expect.arrayContaining(["user-teacher", "user-hm"]),
    );
  });
});

describe("withdrawExcuseRequestAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["parent_requests:excuse:submit"] }));

  it("works on own PENDING rows", async () => {
    prismaMock.excuseRequest.findFirst.mockResolvedValue({
      id: "req-1",
      schoolId: "default-school",
      submittedByUserId: "test-user-id",
      status: "PENDING",
    } as never);
    prismaMock.excuseRequest.update.mockResolvedValue({} as never);

    const res = await withdrawExcuseRequestAction("req-1");
    expect(res).toEqual({ success: true });
    expect(prismaMock.excuseRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "WITHDRAWN" }),
      }),
    );
  });

  it("rejects other users' rows", async () => {
    prismaMock.excuseRequest.findFirst.mockResolvedValue({
      id: "req-1",
      schoolId: "default-school",
      submittedByUserId: "someone-else",
      status: "PENDING",
    } as never);

    const res = await withdrawExcuseRequestAction("req-1");
    expect(res).toHaveProperty("error");
  });

  it("rejects non-PENDING rows", async () => {
    prismaMock.excuseRequest.findFirst.mockResolvedValue({
      id: "req-1",
      schoolId: "default-school",
      submittedByUserId: "test-user-id",
      status: "APPROVED",
    } as never);

    const res = await withdrawExcuseRequestAction("req-1");
    expect(res).toHaveProperty("error");
  });
});

describe("approveExcuseRequestAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["parent_requests:excuse:review"] });
    vi.mocked(notifyExcuseReviewed).mockClear();
    vi.mocked(audit).mockClear();
  });

  it("rejects non-eligible reviewer", async () => {
    prismaMock.excuseRequest.findFirst.mockResolvedValue({
      id: "req-1",
      schoolId: "default-school",
      studentId: "s-1",
      status: "PENDING",
      fromDate: within14Days,
      toDate: within14Days,
      student: {
        id: "s-1",
        firstName: "K",
        lastName: "A",
        status: "ACTIVE",
        boardingStatus: "BOARDING",
        schoolId: "default-school",
        enrollments: [{ classArmId: "arm-OTHER" }],
        houseAssignment: { houseId: "house-OTHER" },
      },
    } as never);
    prismaMock.staff.findFirst.mockResolvedValue({
      id: "staff-x",
      userId: "test-user-id",
    } as never);
    // Not teacher of arm-OTHER, not housemaster of house-OTHER
    prismaMock.classArm.findFirst.mockResolvedValue(null as never);
    prismaMock.house.findFirst.mockResolvedValue(null as never);

    const res = await approveExcuseRequestAction({ requestId: "req-1" });
    expect(res).toHaveProperty("error");
  });

  it("rejects if already reviewed", async () => {
    prismaMock.excuseRequest.findFirst.mockResolvedValue({
      id: "req-1",
      schoolId: "default-school",
      status: "APPROVED",
    } as never);

    const res = await approveExcuseRequestAction({ requestId: "req-1" });
    expect(res).toEqual({ error: "Already reviewed" });
  });

  it("flips attendance + audits + notifies on approve", async () => {
    prismaMock.excuseRequest.findFirst.mockResolvedValue({
      id: "req-1",
      schoolId: "default-school",
      studentId: "s-1",
      submittedByUserId: "parent-1",
      status: "PENDING",
      fromDate: within14Days,
      toDate: within14Days,
      student: {
        id: "s-1",
        firstName: "Kofi",
        lastName: "Asante",
        status: "ACTIVE",
        boardingStatus: "BOARDING",
        schoolId: "default-school",
        enrollments: [{ classArmId: "arm-1" }],
        houseAssignment: { houseId: "house-1" },
      },
    } as never);
    prismaMock.staff.findFirst.mockResolvedValue({
      id: "staff-teacher",
      userId: "test-user-id",
      firstName: "Ms",
      lastName: "Mensah",
    } as never);
    prismaMock.classArm.findFirst.mockResolvedValue({
      id: "arm-1",
      classTeacherId: "staff-teacher",
    } as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
    prismaMock.excuseRequest.update.mockResolvedValue({} as never);
    prismaMock.attendanceRecord.updateMany.mockResolvedValue({ count: 2 } as never);

    const res = await approveExcuseRequestAction({ requestId: "req-1" });
    expect(res).toEqual({ success: true });
    expect(prismaMock.attendanceRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "EXCUSED" }),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
    expect(vi.mocked(notifyExcuseReviewed)).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "APPROVED" }),
    );
  });
});

describe("rejectExcuseRequestAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["parent_requests:excuse:review"] });
    vi.mocked(notifyExcuseReviewed).mockClear();
    vi.mocked(audit).mockClear();
  });

  it("requires non-empty review note", async () => {
    const res = await rejectExcuseRequestAction({ requestId: "req-1", reviewNote: "   " });
    expect((res as { error: string }).error).toMatch(/note/i);
  });

  it("sets REJECTED + audits + notifies", async () => {
    prismaMock.excuseRequest.findFirst.mockResolvedValue({
      id: "req-1",
      schoolId: "default-school",
      studentId: "s-1",
      submittedByUserId: "parent-1",
      status: "PENDING",
      fromDate: within14Days,
      toDate: within14Days,
      student: {
        id: "s-1",
        firstName: "K",
        lastName: "A",
        status: "ACTIVE",
        boardingStatus: "BOARDING",
        schoolId: "default-school",
        enrollments: [{ classArmId: "arm-1" }],
        houseAssignment: { houseId: "house-1" },
      },
    } as never);
    prismaMock.staff.findFirst.mockResolvedValue({
      id: "staff-teacher",
      userId: "test-user-id",
      firstName: "Ms",
      lastName: "M",
    } as never);
    prismaMock.classArm.findFirst.mockResolvedValue({
      id: "arm-1",
      classTeacherId: "staff-teacher",
    } as never);
    prismaMock.excuseRequest.update.mockResolvedValue({} as never);

    const res = await rejectExcuseRequestAction({
      requestId: "req-1",
      reviewNote: "Need a doctor's note",
    });
    expect(res).toEqual({ success: true });
    expect(prismaMock.excuseRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REJECTED" }),
      }),
    );
    expect(vi.mocked(notifyExcuseReviewed)).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "REJECTED" }),
    );
  });
});

describe("getPendingExcuseRequestsAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["parent_requests:excuse:review"] }));

  it("returns empty list when reviewer has no assigned students", async () => {
    prismaMock.staff.findFirst.mockResolvedValue({
      id: "staff-x",
      userId: "test-user-id",
    } as never);
    prismaMock.classArm.findMany.mockResolvedValue([] as never);
    prismaMock.house.findMany.mockResolvedValue([] as never);
    prismaMock.excuseRequest.findMany.mockResolvedValue([] as never);

    const res = await getPendingExcuseRequestsAction();
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data).toEqual([]);
  });
});
