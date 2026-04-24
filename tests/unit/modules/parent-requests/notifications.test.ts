import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../../setup";
import {
  notifyExcuseSubmitted,
  notifyExcuseReviewed,
  notifyMedicalDisclosureSubmitted,
  notifyMedicalDisclosureReviewed,
} from "@/modules/parent-requests/notifications";
import { sendMessage } from "@/lib/messaging/hub";

vi.mock("@/lib/messaging/hub", () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
}));

describe("notifyExcuseSubmitted", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("uses IN_APP default for reviewers", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyExcuseSubmitted({
      requestId: "req-1",
      reviewerUserIds: ["teacher-1", "housemaster-1"],
      studentName: "Kofi Asante",
      fromDate: new Date("2026-04-20"),
      toDate: new Date("2026-04-22"),
      submitterName: "Mrs. Asante",
    });

    const calls = vi.mocked(sendMessage).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const channelsCalled = calls.map((c) => c[0]);
    expect(channelsCalled.every((c) => c === "in_app")).toBe(true);
  });
});

describe("notifyExcuseReviewed", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("uses IN_APP + EMAIL defaults and includes outcome in body", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyExcuseReviewed({
      requestId: "req-1",
      submitterUserId: "parent-1",
      outcome: "APPROVED",
      reviewerName: "Ms. Mensah",
      reviewNote: "Thanks for the note",
      studentName: "Kofi",
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("email");
  });
});

describe("notifyMedicalDisclosureSubmitted", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("routine disclosure uses IN_APP only", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyMedicalDisclosureSubmitted({
      disclosureId: "d-1",
      nurseUserIds: ["nurse-1"],
      studentName: "Kofi",
      category: "ALLERGY",
      title: "Peanut allergy",
      isUrgent: false,
      submitterName: "Mrs. Asante",
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).not.toContain("sms");
  });

  it("urgent disclosure adds SMS alongside IN_APP", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyMedicalDisclosureSubmitted({
      disclosureId: "d-1",
      nurseUserIds: ["nurse-1"],
      studentName: "Kofi",
      category: "ALLERGY",
      title: "Severe peanut allergy",
      isUrgent: true,
      submitterName: "Mrs. Asante",
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("sms");
  });

  it("swallows per-recipient errors", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);
    vi.mocked(sendMessage).mockRejectedValueOnce(new Error("hub down"));

    await expect(
      notifyMedicalDisclosureSubmitted({
        disclosureId: "d-1",
        nurseUserIds: ["nurse-1", "nurse-2"],
        studentName: "K",
        category: "CONDITION",
        title: "x",
        isUrgent: false,
        submitterName: "P",
      }),
    ).resolves.toBeUndefined();
    expect(vi.mocked(sendMessage).mock.calls.length).toBeGreaterThan(1);
  });
});

describe("notifyMedicalDisclosureReviewed", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("uses IN_APP + EMAIL defaults", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyMedicalDisclosureReviewed({
      disclosureId: "d-1",
      submitterUserId: "parent-1",
      outcome: "REJECTED",
      reviewerName: "Nurse Adom",
      reviewNote: "Please consult your doctor first",
      studentName: "Kofi",
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("email");
  });
});
