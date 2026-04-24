import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { getQueue } from "@/lib/queue";

// ─── Announcement Actions ─────────────────────────────────────────
import {
  getAnnouncementsAction,
  createAnnouncementAction,
  publishAnnouncementAction,
  archiveAnnouncementAction,
  deleteAnnouncementAction,
} from "@/modules/communication/actions/announcement.action";

// ─── SMS Actions ──────────────────────────────────────────────────
import {
  sendSmsAction,
  sendBulkSmsAction,
  getSmsLogsAction,
} from "@/modules/communication/actions/sms.action";

// ═══════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS
// ═══════════════════════════════════════════════════════════════════

describe("getAnnouncementsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAnnouncementsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when no school configured", async () => {
    mockAuthenticatedUser({ schoolId: null });

    const result = await getAnnouncementsAction();
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should return paginated announcements", async () => {
    prismaMock.announcement.findMany.mockResolvedValue([
      {
        id: "ann-1",
        title: "Welcome Back",
        content: "School resumes next week",
        status: "PUBLISHED",
        createdBy: "user-1",
        schoolId: "default-school",
      },
    ] as never);
    prismaMock.announcement.count.mockResolvedValue(1 as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-1", firstName: "John", lastName: "Doe" },
    ] as never);

    const result = await getAnnouncementsAction();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].createdByName).toBe("John Doe");
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it("should filter by status and search", async () => {
    prismaMock.announcement.findMany.mockResolvedValue([] as never);
    prismaMock.announcement.count.mockResolvedValue(0 as never);

    await getAnnouncementsAction({ status: "DRAFT", search: "welcome", page: 2, pageSize: 10 });

    expect(prismaMock.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    );
  });
});

describe("createAnnouncementAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createAnnouncementAction({
      title: "Test",
      content: "Content",
      targetType: "ALL",
      priority: "NORMAL",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when no school configured", async () => {
    mockAuthenticatedUser({ schoolId: null });

    const result = await createAnnouncementAction({
      title: "Test",
      content: "Content",
      targetType: "ALL",
      priority: "NORMAL",
    });
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should create announcement with DRAFT status", async () => {
    const created = {
      id: "ann-1",
      schoolId: "default-school",
      title: "Welcome Back",
      content: "School resumes next week",
      targetType: "ALL",
      priority: "NORMAL",
      status: "DRAFT",
      createdBy: "test-user-id",
      expiresAt: null,
    };

    prismaMock.announcement.create.mockResolvedValue(created as never);

    const result = await createAnnouncementAction({
      title: "Welcome Back",
      content: "School resumes next week",
      targetType: "ALL",
      priority: "NORMAL",
    });

    expect(result.data).toEqual(created);
    expect(prismaMock.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DRAFT",
        }),
      }),
    );
  });
});

describe("publishAnnouncementAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await publishAnnouncementAction("ann-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when announcement not found", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue(null as never);

    const result = await publishAnnouncementAction("nonexistent");
    expect(result).toEqual({ error: "Announcement not found." });
  });

  it("should publish announcement with PUBLISHED status and publishedAt", async () => {
    const existing = {
      id: "ann-1",
      title: "Welcome Back",
      status: "DRAFT",
      targetType: "all",
      targetIds: null,
      priority: "normal",
      requiresAcknowledgement: false,
    };
    prismaMock.announcement.findFirst.mockResolvedValue(existing as never);

    const updated = {
      ...existing,
      status: "PUBLISHED",
      publishedAt: new Date(),
    };
    prismaMock.announcement.update.mockResolvedValue(updated as never);

    const result = await publishAnnouncementAction("ann-1");
    if (!("data" in result)) throw new Error("expected data: " + JSON.stringify(result));
    expect(result.data.status).toBe("PUBLISHED");
    expect(prismaMock.announcement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PUBLISHED",
        }),
      }),
    );
  });
});

describe("archiveAnnouncementAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await archiveAnnouncementAction("ann-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when announcement not found", async () => {
    prismaMock.announcement.findUnique.mockResolvedValue(null as never);

    const result = await archiveAnnouncementAction("nonexistent");
    expect(result).toEqual({ error: "Announcement not found." });
  });

  it("should archive announcement with ARCHIVED status", async () => {
    const existing = {
      id: "ann-1",
      title: "Welcome Back",
      status: "PUBLISHED",
    };
    prismaMock.announcement.findUnique.mockResolvedValue(existing as never);

    const updated = { ...existing, status: "ARCHIVED" };
    prismaMock.announcement.update.mockResolvedValue(updated as never);

    const result = await archiveAnnouncementAction("ann-1");
    expect(result.data!.status).toBe("ARCHIVED");
    expect(prismaMock.announcement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "ARCHIVED" },
      }),
    );
  });
});

describe("deleteAnnouncementAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteAnnouncementAction("ann-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when announcement not found", async () => {
    prismaMock.announcement.findUnique.mockResolvedValue(null as never);

    const result = await deleteAnnouncementAction("nonexistent");
    expect(result).toEqual({ error: "Announcement not found." });
  });

  it("should reject deletion of non-DRAFT announcements", async () => {
    prismaMock.announcement.findUnique.mockResolvedValue({
      id: "ann-1",
      title: "Published One",
      status: "PUBLISHED",
    } as never);

    const result = await deleteAnnouncementAction("ann-1");
    expect(result).toEqual({ error: "Only draft announcements can be deleted." });
  });

  it("should delete a draft announcement successfully", async () => {
    prismaMock.announcement.findUnique.mockResolvedValue({
      id: "ann-1",
      title: "Draft One",
      status: "DRAFT",
    } as never);

    prismaMock.announcement.delete.mockResolvedValue({} as never);

    const result = await deleteAnnouncementAction("ann-1");
    expect(result).toEqual({ success: true });
  });
});

// ═══════════════════════════════════════════════════════════════════
// SMS
// ═══════════════════════════════════════════════════════════════════

describe("sendSmsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await sendSmsAction({
      recipientPhone: "+233201234567",
      message: "Hello",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when no school configured", async () => {
    mockAuthenticatedUser({ schoolId: null });

    const result = await sendSmsAction({
      recipientPhone: "+233201234567",
      message: "Hello",
    });
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should create smsLog record and add job to queue", async () => {
    const smsLog = {
      id: "sms-1",
      schoolId: "default-school",
      recipientPhone: "+233201234567",
      recipientName: "John Doe",
      message: "Hello",
      status: "QUEUED",
    };

    prismaMock.smsLog.create.mockResolvedValue(smsLog as never);

    const mockQueue = getQueue("sms-delivery");

    const result = await sendSmsAction({
      recipientPhone: "+233201234567",
      recipientName: "John Doe",
      message: "Hello",
    });

    expect(result.data).toEqual(smsLog);
    expect(prismaMock.smsLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "QUEUED",
          recipientPhone: "+233201234567",
        }),
      }),
    );
    expect(mockQueue.add).toHaveBeenCalledWith("sms-send", {
      smsLogId: "sms-1",
      phone: "+233201234567",
      message: "Hello",
    });
  });
});

describe("sendBulkSmsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await sendBulkSmsAction({
      recipients: [{ phone: "+233201234567" }],
      message: "Hello",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when no school configured", async () => {
    mockAuthenticatedUser({ schoolId: null });

    const result = await sendBulkSmsAction({
      recipients: [{ phone: "+233201234567" }],
      message: "Hello",
    });
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should reject empty recipients", async () => {
    const result = await sendBulkSmsAction({
      recipients: [],
      message: "Hello",
    });
    expect(result).toEqual({ error: "No recipients provided." });
  });

  it("should create bulk sms logs and dispatch to queue", async () => {
    prismaMock.smsLog.createMany.mockResolvedValue({ count: 2 } as never);
    prismaMock.smsLog.findMany.mockResolvedValue([
      {
        id: "sms-1",
        recipientPhone: "+233201234567",
        message: "Hello everyone",
      },
      {
        id: "sms-2",
        recipientPhone: "+233209876543",
        message: "Hello everyone",
      },
    ] as never);

    const mockQueue = getQueue("sms-delivery");

    const result = await sendBulkSmsAction({
      recipients: [
        { phone: "+233201234567", name: "John" },
        { phone: "+233209876543", name: "Jane" },
      ],
      message: "Hello everyone",
    });

    expect(result.data).toEqual({ count: 2 });
    expect(mockQueue.add).toHaveBeenCalledTimes(2);
  });
});

describe("getSmsLogsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getSmsLogsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when no school configured", async () => {
    mockAuthenticatedUser({ schoolId: null });

    const result = await getSmsLogsAction();
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should return paginated sms logs", async () => {
    prismaMock.smsLog.findMany.mockResolvedValue([
      {
        id: "sms-1",
        recipientPhone: "+233201234567",
        message: "Hello",
        status: "SENT",
      },
    ] as never);
    prismaMock.smsLog.count.mockResolvedValue(1 as never);

    const result = await getSmsLogsAction();
    expect(result.data).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it("should filter by status and search", async () => {
    prismaMock.smsLog.findMany.mockResolvedValue([] as never);
    prismaMock.smsLog.count.mockResolvedValue(0 as never);

    await getSmsLogsAction({ status: "SENT", search: "233", page: 2, pageSize: 10 });

    expect(prismaMock.smsLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    );
  });
});
