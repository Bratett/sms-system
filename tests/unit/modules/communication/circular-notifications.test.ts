import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../../setup";
import {
  notifyCircularPublished,
  notifyCircularReminder,
} from "@/modules/communication/circular-notifications";
import { sendMessage } from "@/lib/messaging/hub";

vi.mock("@/lib/messaging/hub", () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
}));

describe("notifyCircularPublished", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("routine (requiresAcknowledgement=false) uses in_app only", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyCircularPublished({
      announcementId: "a-1",
      title: "Library closed Friday",
      priority: "normal",
      recipientUserIds: ["user-1"],
      requiresAcknowledgement: false,
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).not.toContain("email");
    expect(channelsCalled).not.toContain("sms");
  });

  it("acknowledgement-required adds email alongside in_app", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyCircularPublished({
      announcementId: "a-1",
      title: "Exam fees due",
      priority: "high",
      recipientUserIds: ["user-1"],
      requiresAcknowledgement: true,
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("email");
    expect(channelsCalled).not.toContain("sms");
  });
});

describe("notifyCircularReminder", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("uses in_app + email + sms defaults", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyCircularReminder({
      announcementId: "a-1",
      title: "Exam fees due",
      recipientUserIds: ["user-1"],
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("email");
    expect(channelsCalled).toContain("sms");
  });

  it("respects preference overrides", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([
      { userId: "user-1", eventKey: "circular_reminder_sent", channels: ["IN_APP"] },
    ] as never);

    await notifyCircularReminder({
      announcementId: "a-1",
      title: "x",
      recipientUserIds: ["user-1"],
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toEqual(["in_app"]);
  });

  it("swallows per-recipient errors", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);
    vi.mocked(sendMessage).mockRejectedValueOnce(new Error("hub down"));

    await expect(
      notifyCircularReminder({
        announcementId: "a-1",
        title: "x",
        recipientUserIds: ["user-1", "user-2"],
      }),
    ).resolves.toBeUndefined();
    expect(vi.mocked(sendMessage).mock.calls.length).toBeGreaterThan(1);
  });
});
