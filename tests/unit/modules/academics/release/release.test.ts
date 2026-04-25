import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../../setup";
import { audit } from "@/lib/audit";
import {
  releaseReportCardsAction,
  reReleaseReportCardsAction,
  getReleaseStatsAction,
  getReleaseDetailsAction,
  chaseReleaseAction,
  getReleaseQueueAction,
} from "@/modules/academics/release/actions/release.action";
import {
  notifyReportCardReleased,
  notifyReportCardReminder,
} from "@/modules/academics/release/release-notifications";

vi.mock("@/modules/academics/release/release-notifications", () => ({
  notifyReportCardReleased: vi.fn().mockResolvedValue(undefined),
  notifyReportCardReminder: vi.fn().mockResolvedValue(undefined),
}));

const sampleStudents = [
  {
    id: "s1",
    firstName: "Kofi",
    lastName: "Asante",
    guardians: [{ guardian: { householdId: "hh-1", userId: "user-1" } }],
  },
  {
    id: "s2",
    firstName: "Akua",
    lastName: "Mensah",
    guardians: [{ guardian: { householdId: "hh-2", userId: "user-2" } }],
  },
];

describe("releaseReportCardsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:results:publish"] });
    vi.mocked(notifyReportCardReleased).mockClear();
    vi.mocked(audit).mockClear();
  });

  it("rejects unauthenticated callers", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await releaseReportCardsAction({ termId: "t-1", classArmId: "arm-1" });
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("rejects double-release", async () => {
    prismaMock.classArm.findFirst.mockResolvedValue({ id: "arm-1", schoolId: "default-school" } as never);
    prismaMock.term.findFirst.mockResolvedValue({ id: "t-1", schoolId: "default-school", name: "Term 1" } as never);
    prismaMock.reportCardRelease.findUnique.mockResolvedValue({ id: "existing-r" } as never);

    const res = await releaseReportCardsAction({ termId: "t-1", classArmId: "arm-1" });
    expect((res as { error: string }).error).toMatch(/already released/i);
  });

  it("rejects when arm not in caller's school", async () => {
    prismaMock.classArm.findFirst.mockResolvedValue(null as never);
    const res = await releaseReportCardsAction({ termId: "t-1", classArmId: "arm-1" });
    expect((res as { error: string }).error).toMatch(/not found/i);
  });

  it("creates release row, fans out, audits", async () => {
    prismaMock.classArm.findFirst.mockResolvedValue({ id: "arm-1", schoolId: "default-school", name: "JSS2-A" } as never);
    prismaMock.term.findFirst.mockResolvedValue({ id: "t-1", schoolId: "default-school", name: "Term 1" } as never);
    prismaMock.reportCardRelease.findUnique.mockResolvedValue(null as never);
    prismaMock.reportCardRelease.create.mockResolvedValue({ id: "r-new" } as never);
    prismaMock.student.findMany.mockResolvedValue(sampleStudents as never);

    const res = await releaseReportCardsAction({ termId: "t-1", classArmId: "arm-1" });
    expect(res).toEqual({ data: { releaseId: "r-new" } });
    expect(prismaMock.reportCardRelease.create).toHaveBeenCalled();
    expect(vi.mocked(audit)).toHaveBeenCalled();
    expect(vi.mocked(notifyReportCardReleased)).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseId: "r-new",
        isReRelease: false,
        recipientUserIds: expect.arrayContaining(["user-1", "user-2"]),
      }),
    );
  });
});

describe("reReleaseReportCardsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:results:publish"] });
    vi.mocked(notifyReportCardReleased).mockClear();
    vi.mocked(audit).mockClear();
  });

  it("re-release without reset preserves acks; updates releasedAt", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      termId: "t-1",
      classArmId: "arm-1",
      term: { name: "Term 1" },
      classArm: { name: "JSS2-A" },
    } as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      typeof fn === "function" ? fn(prismaMock) : fn,
    );
    prismaMock.reportCardRelease.update.mockResolvedValue({} as never);
    prismaMock.reportCardAcknowledgement.deleteMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.student.findMany.mockResolvedValue(sampleStudents as never);

    const res = await reReleaseReportCardsAction({
      releaseId: "r-1",
      resetAcknowledgements: false,
    });
    expect(res).toEqual({ success: true });
    expect(prismaMock.reportCardAcknowledgement.deleteMany).not.toHaveBeenCalled();
    expect(vi.mocked(notifyReportCardReleased)).toHaveBeenCalledWith(
      expect.objectContaining({ isReRelease: true }),
    );
  });

  it("re-release with reset deletes ack rows in tx", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      termId: "t-1",
      classArmId: "arm-1",
      term: { name: "Term 1" },
      classArm: { name: "JSS2-A" },
    } as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      typeof fn === "function" ? fn(prismaMock) : fn,
    );
    prismaMock.reportCardRelease.update.mockResolvedValue({} as never);
    prismaMock.reportCardAcknowledgement.deleteMany.mockResolvedValue({ count: 5 } as never);
    prismaMock.student.findMany.mockResolvedValue(sampleStudents as never);

    const res = await reReleaseReportCardsAction({
      releaseId: "r-1",
      resetAcknowledgements: true,
    });
    expect(res).toEqual({ success: true });
    expect(prismaMock.reportCardAcknowledgement.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { releaseId: "r-1" } }),
    );
  });
});

describe("getReleaseStatsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:report-cards:release-track"] });
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await getReleaseStatsAction("r-1");
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("returns targeted/acknowledged/pending + canSendReminder when no recent reminder", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      termId: "t-1",
      classArmId: "arm-1",
      lastReminderSentAt: null,
      releasedAt: new Date(),
      releasedByUserId: "u-admin",
    } as never);
    prismaMock.student.findMany.mockResolvedValue(sampleStudents as never);
    prismaMock.reportCardAcknowledgement.count.mockResolvedValue(1 as never);

    const res = await getReleaseStatsAction("r-1");
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.targetedStudents).toBe(2);
    expect(res.data.acknowledgedStudents).toBe(1);
    expect(res.data.pendingStudents).toBe(1);
    expect(res.data.canSendReminder).toBe(true);
  });

  it("canSendReminder=false when within 24h cooldown", async () => {
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000);
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      termId: "t-1",
      classArmId: "arm-1",
      lastReminderSentAt: recent,
      releasedAt: new Date(),
    } as never);
    prismaMock.student.findMany.mockResolvedValue(sampleStudents as never);
    prismaMock.reportCardAcknowledgement.count.mockResolvedValue(0 as never);

    const res = await getReleaseStatsAction("r-1");
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.canSendReminder).toBe(false);
  });
});

describe("chaseReleaseAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:report-cards:release-track"] });
    vi.mocked(notifyReportCardReminder).mockClear();
    vi.mocked(audit).mockClear();
  });

  it("rejects within 24h cooldown", async () => {
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000);
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      termId: "t-1",
      classArmId: "arm-1",
      lastReminderSentAt: recent,
      term: { name: "Term 1" },
      classArm: { name: "JSS2-A" },
    } as never);

    const res = await chaseReleaseAction("r-1");
    expect((res as { error: string }).error).toMatch(/cooldown/i);
  });

  it("rejects when zero pending", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      termId: "t-1",
      classArmId: "arm-1",
      lastReminderSentAt: null,
      term: { name: "Term 1" },
      classArm: { name: "JSS2-A" },
    } as never);
    prismaMock.student.findMany.mockResolvedValue(sampleStudents as never);
    prismaMock.reportCardAcknowledgement.findMany.mockResolvedValue([
      { studentId: "s1", householdId: "hh-1" },
      { studentId: "s2", householdId: "hh-2" },
    ] as never);

    const res = await chaseReleaseAction("r-1");
    expect((res as { error: string }).error).toMatch(/everyone|all.*acknowledged/i);
  });

  it("happy path: updates lastReminderSentAt, audits, fires notify", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      termId: "t-1",
      classArmId: "arm-1",
      lastReminderSentAt: null,
      term: { name: "Term 1" },
      classArm: { name: "JSS2-A" },
    } as never);
    prismaMock.student.findMany.mockResolvedValue(sampleStudents as never);
    prismaMock.reportCardAcknowledgement.findMany.mockResolvedValue([
      { studentId: "s1", householdId: "hh-1" },
    ] as never);
    prismaMock.reportCardRelease.update.mockResolvedValue({} as never);

    const res = await chaseReleaseAction("r-1");
    expect(res).toMatchObject({ success: true });
    expect(prismaMock.reportCardRelease.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastReminderSentAt: expect.any(Date) }),
      }),
    );
    expect(vi.mocked(notifyReportCardReminder)).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseId: "r-1",
        recipientUserIds: expect.arrayContaining(["user-2"]),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });
});
