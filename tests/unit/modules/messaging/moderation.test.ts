import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { audit } from "@/lib/audit";
import {
  getMessageReportsAction,
  resolveReportAction,
  lockThreadAction,
  unlockThreadAction,
} from "@/modules/messaging/actions/message-moderation.action";

describe("getMessageReportsAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["messaging:admin:review"] }));

  it("rejects users without MESSAGING_ADMIN_REVIEW", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getMessageReportsAction();
    expect(result).toEqual({ error: "Insufficient permissions" });
  });

  it("returns reports scoped to the school", async () => {
    prismaMock.messageReport.findMany.mockResolvedValue([] as never);
    const result = await getMessageReportsAction({ status: "PENDING" });
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data).toEqual([]);
    expect(prismaMock.messageReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PENDING",
          message: { thread: { schoolId: "default-school" } },
        }),
      }),
    );
  });
});

describe("resolveReportAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["messaging:admin:review"] });
    vi.mocked(audit).mockClear();
  });

  it("transitions PENDING → DISMISSED and audits", async () => {
    prismaMock.messageReport.findFirst.mockResolvedValue({
      id: "rep-1",
      status: "PENDING",
      message: { thread: { schoolId: "default-school" } },
    } as never);
    prismaMock.messageReport.update.mockResolvedValue({} as never);

    const result = await resolveReportAction({ reportId: "rep-1", action: "DISMISS" });
    expect(result).toEqual({ success: true });
    expect(prismaMock.messageReport.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "DISMISSED" }) }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });

  it("rejects when report already resolved", async () => {
    prismaMock.messageReport.findFirst.mockResolvedValue({
      id: "rep-1",
      status: "DISMISSED",
      message: { thread: { schoolId: "default-school" } },
    } as never);

    const result = await resolveReportAction({ reportId: "rep-1", action: "ACTION" });
    expect(result).toEqual({ error: "Report has already been resolved." });
  });
});

describe("lockThreadAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["messaging:admin:review"] });
    vi.mocked(audit).mockClear();
  });

  it("locks + audits", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue({
      id: "t-1",
      schoolId: "default-school",
      lockedAt: null,
    } as never);
    prismaMock.messageThread.update.mockResolvedValue({} as never);

    const result = await lockThreadAction({ threadId: "t-1", reason: "Escalation" });
    expect(result).toEqual({ success: true });
    expect(prismaMock.messageThread.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockedAt: expect.any(Date),
          lockReason: "Escalation",
        }),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });
});

describe("unlockThreadAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["messaging:admin:review"] });
    vi.mocked(audit).mockClear();
  });

  it("unlocks + audits", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue({
      id: "t-1",
      schoolId: "default-school",
      lockedAt: new Date(),
    } as never);
    prismaMock.messageThread.update.mockResolvedValue({} as never);

    const result = await unlockThreadAction("t-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.messageThread.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockedAt: null,
          lockedBy: null,
          lockReason: null,
        }),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });
});
