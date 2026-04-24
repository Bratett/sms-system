import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../../setup";
import { audit } from "@/lib/audit";
import {
  getMessageThreadsAction,
  getMessageThreadAction,
  createMessageThreadAction,
  markThreadReadAction,
  archiveThreadAction,
  getEligibleCounterpartsAction,
} from "@/modules/messaging/actions/thread.action";

const sampleStudent = {
  id: "s-1",
  schoolId: "default-school",
  firstName: "Kofi",
  lastName: "Asante",
  status: "ACTIVE",
  boardingStatus: "BOARDING",
  classArmId: "arm-1",
  houseAssignment: { houseId: "house-1" },
  guardians: [{ guardian: { userId: "user-parent-A" } }],
};

const sampleTeacher = {
  id: "user-teacher",
  name: "Ms. Mensah",
};

describe("getMessageThreadsAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["messaging:portal:use"] }));

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getMessageThreadsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("rejects users without MESSAGING_PORTAL_USE or MESSAGING_ADMIN_READ", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getMessageThreadsAction();
    expect(result).toEqual({ error: "Insufficient permissions" });
  });

  it("returns empty list when user has no threads", async () => {
    prismaMock.messageThread.findMany.mockResolvedValue([] as never);
    const result = await getMessageThreadsAction();
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data).toEqual([]);
  });
});

describe("getMessageThreadAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["messaging:portal:use"] }));

  it("returns { error: 'Thread not found' } when missing", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue(null as never);
    const result = await getMessageThreadAction("nope");
    expect(result).toEqual({ error: "Thread not found" });
  });

  it("bumps lastReadAt for a participant", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue({
      id: "t-1",
      schoolId: "default-school",
      studentId: "s-1",
      teacherUserId: "user-teacher",
      status: "ACTIVE",
      lockedAt: null,
      messages: [],
      student: { id: "s-1", guardians: [{ guardian: { userId: "test-user-id" } }] },
    } as never);
    prismaMock.messageThreadRead.upsert.mockResolvedValue({} as never);

    await getMessageThreadAction("t-1");
    expect(prismaMock.messageThreadRead.upsert).toHaveBeenCalled();
  });
});

describe("createMessageThreadAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["messaging:portal:use"] }));

  it("rejects when user is not a household guardian of the student", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      ...sampleStudent,
      guardians: [{ guardian: { userId: "user-other" } }],
    } as never);
    prismaMock.user.findUnique.mockResolvedValue(sampleTeacher as never);

    const result = await createMessageThreadAction({
      studentId: "s-1",
      teacherUserId: "user-teacher",
      initialBody: "Hello",
    });
    expect(result).toHaveProperty("error");
  });

  it("creates a new thread when no existing (student, teacher) thread is found", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      ...sampleStudent,
      guardians: [{ guardian: { userId: "test-user-id" } }],
    } as never);
    prismaMock.user.findUnique.mockResolvedValue(sampleTeacher as never);
    prismaMock.messageThread.findFirst.mockResolvedValue(null as never);
    prismaMock.messageThread.findUnique.mockResolvedValue(null as never);
    prismaMock.messageThread.create.mockResolvedValue({
      id: "new-thread",
      schoolId: "default-school",
      studentId: "s-1",
      teacherUserId: "user-teacher",
      status: "ACTIVE",
    } as never);
    prismaMock.message.create.mockResolvedValue({
      id: "msg-1",
      createdAt: new Date(),
    } as never);

    const result = await createMessageThreadAction({
      studentId: "s-1",
      teacherUserId: "user-teacher",
      initialBody: "First message",
    });
    if (!("data" in result)) throw new Error("expected data: " + JSON.stringify(result));
    expect(result.data.id).toBe("new-thread");
    expect(prismaMock.messageThread.create).toHaveBeenCalled();
    expect(prismaMock.message.create).toHaveBeenCalled();
  });

  it("returns existing thread when one already exists for (student, teacher)", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      ...sampleStudent,
      guardians: [{ guardian: { userId: "test-user-id" } }],
    } as never);
    prismaMock.user.findUnique.mockResolvedValue(sampleTeacher as never);
    prismaMock.userRole.findMany.mockResolvedValue([
      { userId: "user-teacher", role: { name: "class_teacher" } },
    ] as never);
    prismaMock.class.findMany.mockResolvedValue([] as never);
    prismaMock.messageThread.findFirst.mockResolvedValue({
      id: "existing",
      schoolId: "default-school",
      status: "ACTIVE",
    } as never);
    prismaMock.message.create.mockResolvedValue({ createdAt: new Date() } as never);
    prismaMock.messageThread.update.mockResolvedValue({
      id: "existing",
      schoolId: "default-school",
      status: "ACTIVE",
    } as never);

    const result = await createMessageThreadAction({
      studentId: "s-1",
      teacherUserId: "user-teacher",
      initialBody: "Hi",
    });
    if (!("data" in result)) throw new Error("expected data: " + JSON.stringify(result));
    expect(result.data.id).toBe("existing");
  });
});

describe("markThreadReadAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["messaging:portal:use"] }));

  it("upserts MessageThreadRead for the caller", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue({
      id: "t-1",
      schoolId: "default-school",
      teacherUserId: "user-teacher",
      student: { guardians: [{ guardian: { userId: "test-user-id" } }] },
    } as never);
    prismaMock.messageThreadRead.upsert.mockResolvedValue({} as never);

    await markThreadReadAction("t-1");
    expect(prismaMock.messageThreadRead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { threadId_userId: { threadId: "t-1", userId: "test-user-id" } },
      }),
    );
  });
});

describe("getEligibleCounterpartsAction (housemaster)", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["messaging:portal:use"] }));

  it("returns the housemaster for a BOARDING student whose house has housemasterId set", async () => {
    prismaMock.guardian.findUnique.mockResolvedValue({
      id: "g-1",
      userId: "test-user-id",
      students: [
        {
          student: {
            id: "s-1",
            firstName: "Kofi",
            lastName: "Asante",
            status: "ACTIVE",
            boardingStatus: "BOARDING",
            schoolId: "default-school",
            enrollments: [],
            houseAssignment: {
              house: { id: "h-1", housemasterId: "staff-hm" },
            },
          },
        },
      ],
    } as never);
    prismaMock.staff.findMany.mockResolvedValue([
      {
        id: "staff-hm",
        userId: "user-hm",
        firstName: "Mr",
        lastName: "Housemaster",
        schoolId: "default-school",
      },
    ] as never);

    const result = await getEligibleCounterpartsAction();
    if (!("data" in result)) throw new Error("expected data: " + JSON.stringify(result));
    const hmOption = result.data.find((o) => o.role === "housemaster");
    expect(hmOption).toBeTruthy();
    expect(hmOption?.teacherUserId).toBe("user-hm");
    expect(hmOption?.studentId).toBe("s-1");
  });
});

describe("archiveThreadAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["messaging:admin:review"] }));

  it("rejects users without MESSAGING_ADMIN_REVIEW", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await archiveThreadAction("t-1");
    expect(result).toEqual({ error: "Insufficient permissions" });
  });

  it("archives + audits", async () => {
    vi.mocked(audit).mockClear();
    prismaMock.messageThread.findFirst.mockResolvedValue({
      id: "t-1",
      schoolId: "default-school",
      status: "ACTIVE",
    } as never);
    prismaMock.messageThread.update.mockResolvedValue({} as never);

    const result = await archiveThreadAction("t-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.messageThread.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ARCHIVED" }) }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });
});
