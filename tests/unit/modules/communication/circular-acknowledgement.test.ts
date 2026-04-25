import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { audit } from "@/lib/audit";
import {
  acknowledgeCircularAction,
  getAnnouncementAcknowledgementStatsAction,
  getAnnouncementAcknowledgementDetailsAction,
  chaseAnnouncementAcknowledgementAction,
} from "@/modules/communication/actions/circular-acknowledgement.action";
import { notifyCircularReminder } from "@/modules/communication/circular-notifications";

vi.mock("@/modules/communication/circular-notifications", () => ({
  notifyCircularReminder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/communication/circular-targeting", () => ({
  resolveTargetedHouseholdIds: vi.fn().mockResolvedValue(["hh-1", "hh-2", "hh-3"]),
  doesAnnouncementTargetGuardian: vi.fn().mockReturnValue(true),
}));

describe("acknowledgeCircularAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["communication:circulars:acknowledge"] });
    vi.mocked(audit).mockClear();
  });

  it("rejects when announcement is not ack-required", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      status: "PUBLISHED",
      requiresAcknowledgement: false,
      targetType: "all",
      targetIds: null,
    } as never);

    const res = await acknowledgeCircularAction({ announcementId: "a-1" });
    expect((res as { error: string }).error).toMatch(/doesn't require acknowledgement/i);
  });

  it("rejects when announcement is ARCHIVED", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      status: "ARCHIVED",
      requiresAcknowledgement: true,
    } as never);

    const res = await acknowledgeCircularAction({ announcementId: "a-1" });
    expect((res as { error: string }).error).toMatch(/no longer active/i);
  });

  it("rejects when caller's household is not in targeted set", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      status: "PUBLISHED",
      requiresAcknowledgement: true,
      targetType: "class",
      targetIds: ["class-a"],
    } as never);
    prismaMock.guardian.findUnique.mockResolvedValue({
      userId: "test-user-id",
      householdId: "hh-OTHER",
    } as never);

    const res = await acknowledgeCircularAction({ announcementId: "a-1" });
    expect(res).toEqual({ error: "Circular not found" });
  });

  it("creates ack row + audit on happy path", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      status: "PUBLISHED",
      requiresAcknowledgement: true,
      targetType: "all",
      targetIds: null,
    } as never);
    prismaMock.guardian.findUnique.mockResolvedValue({
      userId: "test-user-id",
      householdId: "hh-1",
    } as never);
    prismaMock.circularAcknowledgement.create.mockResolvedValue({
      id: "ack-1",
    } as never);

    const res = await acknowledgeCircularAction({ announcementId: "a-1" });
    expect(res).toEqual({ success: true });
    expect(prismaMock.circularAcknowledgement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          announcementId: "a-1",
          householdId: "hh-1",
          acknowledgedByUserId: "test-user-id",
        }),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });

  it("double-tap is idempotent (unique constraint caught)", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      status: "PUBLISHED",
      requiresAcknowledgement: true,
      targetType: "all",
      targetIds: null,
    } as never);
    prismaMock.guardian.findUnique.mockResolvedValue({
      userId: "test-user-id",
      householdId: "hh-1",
    } as never);

    const err = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    prismaMock.circularAcknowledgement.create.mockRejectedValue(err as never);

    const res = await acknowledgeCircularAction({ announcementId: "a-1" });
    expect(res).toEqual({ success: true });
  });

  it("rejects non-parent caller", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await acknowledgeCircularAction({ announcementId: "a-1" });
    expect(res).toEqual({ error: "Insufficient permissions" });
  });
});

describe("getAnnouncementAcknowledgementStatsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["communication:circulars:acknowledgement-track"] });
  });

  it("rejects non-admin", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await getAnnouncementAcknowledgementStatsAction("a-1");
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("returns targeted/acknowledged/pending counts + cooldown flag", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      targetType: "all",
      targetIds: null,
      lastReminderSentAt: null,
      requiresAcknowledgement: true,
    } as never);
    prismaMock.circularAcknowledgement.count.mockResolvedValue(1 as never);

    const res = await getAnnouncementAcknowledgementStatsAction("a-1");
    if (!("data" in res)) throw new Error("expected data: " + JSON.stringify(res));
    expect(res.data.targeted).toBe(3);
    expect(res.data.acknowledged).toBe(1);
    expect(res.data.pending).toBe(2);
    expect(res.data.canSendReminder).toBe(true);
  });

  it("canSendReminder=false when within 24h cooldown", async () => {
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000);
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      targetType: "all",
      targetIds: null,
      lastReminderSentAt: recent,
      requiresAcknowledgement: true,
    } as never);
    prismaMock.circularAcknowledgement.count.mockResolvedValue(0 as never);

    const res = await getAnnouncementAcknowledgementStatsAction("a-1");
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.canSendReminder).toBe(false);
  });
});

describe("getAnnouncementAcknowledgementDetailsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["communication:circulars:acknowledgement-track"] });
  });

  it("returns pending-first household rows", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      targetType: "all",
      targetIds: null,
    } as never);
    prismaMock.household.findMany.mockResolvedValue([
      { id: "hh-1", name: "Asante Family" },
      { id: "hh-2", name: "Mensah Family" },
      { id: "hh-3", name: "Owusu Family" },
    ] as never);
    prismaMock.circularAcknowledgement.findMany.mockResolvedValue([
      {
        householdId: "hh-1",
        acknowledgedAt: new Date("2026-04-20"),
        acknowledgedBy: { firstName: "Kofi", lastName: "Asante" },
      },
    ] as never);

    const res = await getAnnouncementAcknowledgementDetailsAction("a-1");
    if (!("data" in res)) throw new Error("expected data: " + JSON.stringify(res));
    expect(res.data.length).toBe(3);
    expect(res.data[0].acknowledged).toBe(false);
    expect(res.data[1].acknowledged).toBe(false);
    expect(res.data[2].acknowledged).toBe(true);
    expect(res.data[2].householdId).toBe("hh-1");
  });
});

describe("chaseAnnouncementAcknowledgementAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["communication:circulars:acknowledgement-track"] });
    vi.mocked(audit).mockClear();
    vi.mocked(notifyCircularReminder).mockClear();
  });

  it("rejects inside 24h cooldown", async () => {
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000);
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      title: "x",
      lastReminderSentAt: recent,
      targetType: "all",
      targetIds: null,
      requiresAcknowledgement: true,
    } as never);

    const res = await chaseAnnouncementAcknowledgementAction("a-1");
    expect((res as { error: string }).error).toMatch(/cooldown/i);
  });

  it("rejects when zero households pending", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      title: "x",
      lastReminderSentAt: null,
      targetType: "all",
      targetIds: null,
      requiresAcknowledgement: true,
    } as never);
    prismaMock.circularAcknowledgement.findMany.mockResolvedValue([
      { householdId: "hh-1" },
      { householdId: "hh-2" },
      { householdId: "hh-3" },
    ] as never);

    const res = await chaseAnnouncementAcknowledgementAction("a-1");
    expect((res as { error: string }).error).toMatch(/everyone/i);
  });

  it("updates lastReminderSentAt + audits + fires notify on happy path", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      title: "Exam fees",
      lastReminderSentAt: null,
      targetType: "all",
      targetIds: null,
      requiresAcknowledgement: true,
    } as never);
    prismaMock.circularAcknowledgement.findMany.mockResolvedValue([
      { householdId: "hh-1" },
    ] as never);
    prismaMock.guardian.findMany.mockResolvedValue([
      { userId: "user-2" },
      { userId: "user-3" },
    ] as never);
    prismaMock.announcement.update.mockResolvedValue({} as never);

    const res = await chaseAnnouncementAcknowledgementAction("a-1");
    expect(res).toEqual({ success: true, notifiedCount: 2 });
    expect(prismaMock.announcement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastReminderSentAt: expect.any(Date),
        }),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
    expect(vi.mocked(notifyCircularReminder)).toHaveBeenCalledWith(
      expect.objectContaining({
        announcementId: "a-1",
        recipientUserIds: expect.arrayContaining(["user-2", "user-3"]),
      }),
    );
  });
});
