import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../../setup";
import { notifyNewMessage } from "@/modules/messaging/notifications";
import { sendMessage } from "@/lib/messaging/hub";

vi.mock("@/lib/messaging/hub", () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
}));

describe("notifyNewMessage", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("uses default channels when no NotificationPreference exists for the recipient", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyNewMessage({
      messageId: "m-1",
      threadId: "t-1",
      recipientUserIds: ["user-parent"],
      authorRole: "teacher",
      studentName: "Kofi Asante",
      authorName: "Ms. Mensah",
      bodyPreview: "Please review the attached homework.",
    });

    const calls = vi.mocked(sendMessage).mock.calls;
    const channelsCalled = calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("email");
  });

  it("respects user preference overrides", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([
      { userId: "user-parent", eventKey: "message_received_parent", channels: ["IN_APP"] },
    ] as never);

    await notifyNewMessage({
      messageId: "m-1",
      threadId: "t-1",
      recipientUserIds: ["user-parent"],
      authorRole: "teacher",
      studentName: "Kofi",
      authorName: "Ms. Mensah",
      bodyPreview: "hi",
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).not.toContain("email");
  });

  it("skips recipients with opted-out prefs (empty channels)", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([
      { userId: "user-parent", eventKey: "message_received_parent", channels: [] },
    ] as never);

    await notifyNewMessage({
      messageId: "m-1",
      threadId: "t-1",
      recipientUserIds: ["user-parent"],
      authorRole: "teacher",
      studentName: "Kofi",
      authorName: "Ms. Mensah",
      bodyPreview: "hi",
    });

    expect(vi.mocked(sendMessage)).not.toHaveBeenCalled();
  });

  it("swallows per-recipient errors and continues the loop", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);
    vi.mocked(sendMessage).mockRejectedValueOnce(new Error("whatsapp blew up"));

    await expect(
      notifyNewMessage({
        messageId: "m-1",
        threadId: "t-1",
        recipientUserIds: ["user-parent"],
        authorRole: "teacher",
        studentName: "K",
        authorName: "M",
        bodyPreview: "hi",
      }),
    ).resolves.toBeUndefined();
    // Default parent channels are [in_app, email]; after the first rejection
    // we should still have been called a second time for the other channel,
    // proving the inner loop continued rather than aborting on first error.
    expect(vi.mocked(sendMessage).mock.calls.length).toBeGreaterThan(1);
  });
});
