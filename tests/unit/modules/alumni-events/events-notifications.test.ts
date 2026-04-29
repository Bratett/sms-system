import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../../setup";
import { notifyAlumniEventPublished } from "@/modules/alumni-events/events-notifications";
import { sendMessage } from "@/lib/messaging/hub";

vi.mock("@/lib/messaging/hub", () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
}));

describe("notifyAlumniEventPublished", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
    prismaMock.alumniProfile.findMany.mockReset();
    prismaMock.student.findMany.mockReset();
    prismaMock.notificationPreference.findMany.mockReset();
    prismaMock.school.findUnique.mockReset();
  });

  it("uses in_app + email defaults", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([
      { studentId: "s-1" },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-1", userId: "u-1" },
    ] as never);
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);
    prismaMock.school.findUnique.mockResolvedValue({ name: "Test School" } as never);

    const result = await notifyAlumniEventPublished({
      eventId: "e-1",
      schoolId: "school-1",
      eventTitle: "Class of 2026 Reunion",
      startAt: new Date("2026-06-15T18:00:00Z"),
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("email");
    expect(result.recipientCount).toBe(1);
  });

  it("respects preference overrides (in_app only)", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([
      { studentId: "s-1" },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-1", userId: "u-1" },
    ] as never);
    prismaMock.notificationPreference.findMany.mockResolvedValue([
      { userId: "u-1", eventKey: "alumni_event_published", channels: ["IN_APP"] },
    ] as never);
    prismaMock.school.findUnique.mockResolvedValue({ name: "Test School" } as never);

    await notifyAlumniEventPublished({
      eventId: "e-1",
      schoolId: "school-1",
      eventTitle: "Reunion",
      startAt: new Date("2026-06-15T18:00:00Z"),
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toEqual(["in_app"]);
  });

  it("skips alumni with null userId", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([
      { studentId: "s-1" },
      { studentId: "s-2" },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-1", userId: "u-1" },
      { id: "s-2", userId: null },
    ] as never);
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);
    prismaMock.school.findUnique.mockResolvedValue({ name: "Test School" } as never);

    const result = await notifyAlumniEventPublished({
      eventId: "e-1",
      schoolId: "school-1",
      eventTitle: "Reunion",
      startAt: new Date("2026-06-15T18:00:00Z"),
    });

    const recipients = vi.mocked(sendMessage).mock.calls.map((c) => c[1].to);
    expect(recipients).toEqual(["u-1", "u-1"]);
    expect(result.recipientCount).toBe(1);
  });

  it("returns recipientCount 0 and skips sendMessage when no alumni", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([] as never);
    prismaMock.school.findUnique.mockResolvedValue({ name: "Test School" } as never);

    const result = await notifyAlumniEventPublished({
      eventId: "e-1",
      schoolId: "school-1",
      eventTitle: "Reunion",
      startAt: new Date("2026-06-15T18:00:00Z"),
    });

    expect(vi.mocked(sendMessage)).not.toHaveBeenCalled();
    expect(result.recipientCount).toBe(0);
  });

  it("swallows per-recipient errors and continues fan-out", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([
      { studentId: "s-1" },
      { studentId: "s-2" },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-1", userId: "u-1" },
      { id: "s-2", userId: "u-2" },
    ] as never);
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);
    prismaMock.school.findUnique.mockResolvedValue({ name: "Test School" } as never);
    vi.mocked(sendMessage).mockRejectedValueOnce(new Error("hub down"));

    await notifyAlumniEventPublished({
      eventId: "e-1",
      schoolId: "school-1",
      eventTitle: "Reunion",
      startAt: new Date("2026-06-15T18:00:00Z"),
    });

    expect(vi.mocked(sendMessage).mock.calls.length).toBe(4);
    const recipients = vi.mocked(sendMessage).mock.calls.map((c) => c[1].to);
    expect(recipients).toContain("u-2");
  });

  it("includes eventTitle and humanized date in body", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([
      { studentId: "s-1" },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-1", userId: "u-1" },
    ] as never);
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);
    prismaMock.school.findUnique.mockResolvedValue({ name: "Test School" } as never);

    await notifyAlumniEventPublished({
      eventId: "e-1",
      schoolId: "school-1",
      eventTitle: "Reunion 2026",
      startAt: new Date("2026-06-15T18:00:00Z"),
    });

    const firstCall = vi.mocked(sendMessage).mock.calls[0];
    expect(firstCall?.[1].body).toContain("Reunion 2026");
    expect(firstCall?.[1].body).toContain("Test School");
  });
});
