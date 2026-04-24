import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { audit } from "@/lib/audit";
import {
  postMessageAction,
  reportMessageAction,
} from "@/modules/messaging/actions/message.action";
import { notifyNewMessage } from "@/modules/messaging/notifications";

vi.mock("@/modules/messaging/notifications", () => ({
  notifyNewMessage: vi.fn().mockResolvedValue(undefined),
}));

const activeThread = {
  id: "t-1",
  schoolId: "default-school",
  studentId: "s-1",
  teacherUserId: "user-teacher",
  status: "ACTIVE" as const,
  lockedAt: null as Date | null,
  student: {
    id: "s-1",
    firstName: "Kofi",
    lastName: "Asante",
    guardians: [{ guardian: { userId: "test-user-id" } }],
  },
  teacher: { id: "user-teacher", name: "Ms. Mensah" },
};

describe("postMessageAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["messaging:portal:use"] });
    vi.mocked(notifyNewMessage).mockClear();
  });

  it("rejects when thread is archived", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue({
      ...activeThread,
      status: "ARCHIVED",
    } as never);

    const result = await postMessageAction({ threadId: "t-1", body: "hi" });
    expect(result).toEqual({ error: "Thread is archived." });
  });

  it("rejects when thread is locked", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue({
      ...activeThread,
      lockedAt: new Date(),
    } as never);

    const result = await postMessageAction({ threadId: "t-1", body: "hi" });
    expect(result).toEqual({ error: "Thread is locked." });
  });

  it("rejects when caller is not a participant", async () => {
    mockAuthenticatedUser({ permissions: ["messaging:portal:use"] });
    prismaMock.messageThread.findFirst.mockResolvedValue({
      ...activeThread,
      student: { ...activeThread.student, guardians: [{ guardian: { userId: "other" } }] },
    } as never);

    const result = await postMessageAction({ threadId: "t-1", body: "hi" });
    expect(result).toEqual({ error: "You are not a participant of this thread." });
  });

  it("rejects when rate-limited", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue(activeThread as never);
    prismaMock.message.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        createdAt: new Date(Date.now() - i * 60_000),
      })) as never,
    );

    const result = await postMessageAction({ threadId: "t-1", body: "spam" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Too many messages");
  });

  it("creates a message and triggers notification fan-out", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue(activeThread as never);
    prismaMock.message.findMany.mockResolvedValue([] as never);
    prismaMock.message.create.mockResolvedValue({
      id: "m-new",
      threadId: "t-1",
      authorUserId: "test-user-id",
      body: "hello",
      createdAt: new Date(),
    } as never);
    prismaMock.messageThread.update.mockResolvedValue({} as never);

    const result = await postMessageAction({ threadId: "t-1", body: "hello" });
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.id).toBe("m-new");
    expect(vi.mocked(notifyNewMessage)).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "m-new",
        threadId: "t-1",
        authorRole: "parent",
      }),
    );
  });

  it("rejects attachment with unsupported MIME type", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue(activeThread as never);
    prismaMock.message.findMany.mockResolvedValue([] as never);

    const result = await postMessageAction({
      threadId: "t-1",
      body: "see attached",
      attachmentKey: "messages/default-school/t-1/abc-evil.exe",
      attachmentName: "evil.exe",
      attachmentSize: 1024,
      attachmentMime: "application/x-msdownload",
    });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("not allowed");
  });

  it("rejects attachment exceeding 5 MB", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue(activeThread as never);
    prismaMock.message.findMany.mockResolvedValue([] as never);

    const result = await postMessageAction({
      threadId: "t-1",
      body: "see attached",
      attachmentKey: "messages/default-school/t-1/abc-big.pdf",
      attachmentName: "big.pdf",
      attachmentSize: 6 * 1024 * 1024,
      attachmentMime: "application/pdf",
    });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("5 MB");
  });

  it("swallows notifyNewMessage errors (message still posts)", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue(activeThread as never);
    prismaMock.message.findMany.mockResolvedValue([] as never);
    prismaMock.message.create.mockResolvedValue({
      id: "m-new",
      threadId: "t-1",
      createdAt: new Date(),
    } as never);
    prismaMock.messageThread.update.mockResolvedValue({} as never);
    vi.mocked(notifyNewMessage).mockRejectedValueOnce(new Error("hub down"));

    const result = await postMessageAction({ threadId: "t-1", body: "hi" });
    if (!("data" in result)) throw new Error("expected data even if notify failed");
    expect(result.data.id).toBe("m-new");
  });
});

describe("reportMessageAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["messaging:reports:create"] });
    vi.mocked(audit).mockClear();
  });

  it("creates a MessageReport + writes audit", async () => {
    prismaMock.message.findFirst.mockResolvedValue({
      id: "m-1",
      thread: { schoolId: "default-school" },
    } as never);
    prismaMock.messageReport.create.mockResolvedValue({
      id: "rep-1",
    } as never);

    const result = await reportMessageAction({ messageId: "m-1", reason: "abusive language" });
    expect(result).toEqual({ success: true, reportId: "rep-1" });
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entity: "MessageReport",
        entityId: "rep-1",
      }),
    );
  });
});
