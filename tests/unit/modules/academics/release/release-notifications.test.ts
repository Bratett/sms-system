import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../../../setup";
import {
  notifyReportCardReleased,
  notifyReportCardReminder,
} from "@/modules/academics/release/release-notifications";
import { sendMessage } from "@/lib/messaging/hub";

vi.mock("@/lib/messaging/hub", () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
}));

describe("notifyReportCardReleased", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("uses in_app + email + sms defaults", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyReportCardReleased({
      releaseId: "r-1",
      termName: "Term 1",
      classArmName: "JSS2-A",
      recipientUserIds: ["user-1"],
      studentNamesByUserId: new Map([["user-1", ["Kofi Asante"]]]),
      isReRelease: false,
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("email");
    expect(channelsCalled).toContain("sms");
  });

  it("interpolates multiple student names in the body", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyReportCardReleased({
      releaseId: "r-1",
      termName: "Term 1",
      classArmName: "JSS2-A",
      recipientUserIds: ["user-1"],
      studentNamesByUserId: new Map([["user-1", ["Kofi Asante", "Akua Asante"]]]),
      isReRelease: false,
    });

    const firstCall = vi.mocked(sendMessage).mock.calls[0];
    expect(firstCall?.[1].body).toContain("Kofi Asante");
    expect(firstCall?.[1].body).toContain("Akua Asante");
  });

  it("re-release adds an 'Updated:' prefix to the body", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyReportCardReleased({
      releaseId: "r-1",
      termName: "Term 1",
      classArmName: "JSS2-A",
      recipientUserIds: ["user-1"],
      studentNamesByUserId: new Map([["user-1", ["Kofi Asante"]]]),
      isReRelease: true,
    });

    const firstCall = vi.mocked(sendMessage).mock.calls[0];
    expect(firstCall?.[1].body).toMatch(/^Updated:/i);
  });

  it("respects preference overrides", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([
      { userId: "user-1", eventKey: "report_card_released", channels: ["IN_APP"] },
    ] as never);

    await notifyReportCardReleased({
      releaseId: "r-1",
      termName: "Term 1",
      classArmName: "JSS2-A",
      recipientUserIds: ["user-1"],
      studentNamesByUserId: new Map([["user-1", ["Kofi"]]]),
      isReRelease: false,
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toEqual(["in_app"]);
  });

  it("swallows per-recipient errors", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);
    vi.mocked(sendMessage).mockRejectedValueOnce(new Error("hub down"));

    await expect(
      notifyReportCardReleased({
        releaseId: "r-1",
        termName: "Term 1",
        classArmName: "JSS2-A",
        recipientUserIds: ["user-1", "user-2"],
        studentNamesByUserId: new Map([
          ["user-1", ["A"]],
          ["user-2", ["B"]],
        ]),
        isReRelease: false,
      }),
    ).resolves.toBeUndefined();
    // All 6 calls completed (1 fail + 5 succeed), proving user-2 was reached
    expect(vi.mocked(sendMessage).mock.calls.length).toBe(6);
    const recipientsNotified = vi.mocked(sendMessage).mock.calls.map((c) => c[1].to);
    expect(recipientsNotified).toContain("user-2");
  });
});

describe("notifyReportCardReminder", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("uses in_app + email + sms defaults", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyReportCardReminder({
      releaseId: "r-1",
      termName: "Term 1",
      classArmName: "JSS2-A",
      recipientUserIds: ["user-1"],
      studentNamesByUserId: new Map([["user-1", ["Kofi Asante"]]]),
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("email");
    expect(channelsCalled).toContain("sms");
  });
});
