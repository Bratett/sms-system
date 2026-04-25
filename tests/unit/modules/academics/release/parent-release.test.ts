import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../../setup";
import { audit } from "@/lib/audit";
import {
  acknowledgeReportCardAction,
  getMyReportCardReleaseAction,
  getMyReportCardPdfUrlAction,
} from "@/modules/academics/release/actions/parent-release.action";
import { _renderReportCardPdfInternal } from "@/modules/academics/actions/report-card.action";

vi.mock("@/modules/academics/actions/report-card.action", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "@/modules/academics/actions/report-card.action",
  );
  return {
    ...actual,
    _renderReportCardPdfInternal: vi.fn().mockResolvedValue({
      data: { url: "https://signed.example/x.pdf", cached: true },
    }),
  };
});

describe("acknowledgeReportCardAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:report-cards:download-own"] });
    vi.mocked(audit).mockClear();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await acknowledgeReportCardAction({ releaseId: "r-1", studentId: "s-1" });
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("rejects non-guardian (generic error)", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      classArmId: "arm-1",
    } as never);
    prismaMock.studentGuardian.findFirst.mockResolvedValue(null as never);

    const res = await acknowledgeReportCardAction({ releaseId: "r-1", studentId: "s-1" });
    expect(res).toEqual({ error: "Report card not found" });
  });

  it("rejects when student is not in the released arm (generic error)", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      classArmId: "arm-1",
    } as never);
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      studentId: "s-1",
      guardian: { userId: "test-user-id", householdId: "hh-1" },
    } as never);
    prismaMock.student.findFirst.mockResolvedValue(null as never);

    const res = await acknowledgeReportCardAction({ releaseId: "r-1", studentId: "s-1" });
    expect(res).toEqual({ error: "Report card not found" });
  });

  it("creates ack row + audit on happy path", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      classArmId: "arm-1",
    } as never);
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      studentId: "s-1",
      guardian: { userId: "test-user-id", householdId: "hh-1" },
    } as never);
    prismaMock.student.findFirst.mockResolvedValue({ id: "s-1" } as never);
    prismaMock.reportCardAcknowledgement.create.mockResolvedValue({ id: "ack-1" } as never);

    const res = await acknowledgeReportCardAction({ releaseId: "r-1", studentId: "s-1" });
    expect(res).toEqual({ success: true });
    expect(prismaMock.reportCardAcknowledgement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          releaseId: "r-1",
          studentId: "s-1",
          householdId: "hh-1",
          acknowledgedByUserId: "test-user-id",
        }),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });

  it("double-tap is idempotent (P2002 caught)", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      classArmId: "arm-1",
    } as never);
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      studentId: "s-1",
      guardian: { userId: "test-user-id", householdId: "hh-1" },
    } as never);
    prismaMock.student.findFirst.mockResolvedValue({ id: "s-1" } as never);

    const err = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    prismaMock.reportCardAcknowledgement.create.mockRejectedValue(err as never);

    const res = await acknowledgeReportCardAction({ releaseId: "r-1", studentId: "s-1" });
    expect(res).toEqual({ success: true });
    expect(vi.mocked(audit)).not.toHaveBeenCalled();
  });
});

describe("getMyReportCardReleaseAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:results:read"] });
  });

  it("returns released=false when no release row exists", async () => {
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      studentId: "s-1",
      guardian: { userId: "test-user-id", householdId: "hh-1" },
    } as never);
    prismaMock.enrollment.findFirst.mockResolvedValue({
      classArmId: "arm-1",
    } as never);
    prismaMock.reportCardRelease.findUnique.mockResolvedValue(null as never);

    const res = await getMyReportCardReleaseAction({ studentId: "s-1", termId: "t-1" });
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data).toEqual({ released: false });
  });

  it("returns released=true with isAcknowledgedByMyHousehold flag", async () => {
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      studentId: "s-1",
      guardian: { userId: "test-user-id", householdId: "hh-1" },
    } as never);
    prismaMock.enrollment.findFirst.mockResolvedValue({
      classArmId: "arm-1",
    } as never);
    prismaMock.reportCardRelease.findUnique.mockResolvedValue({
      id: "r-1",
      releasedAt: new Date(),
      schoolId: "default-school",
    } as never);
    prismaMock.reportCardAcknowledgement.findUnique.mockResolvedValue({ id: "ack-1" } as never);

    const res = await getMyReportCardReleaseAction({ studentId: "s-1", termId: "t-1" });
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.released).toBe(true);
    expect(res.data.releaseId).toBe("r-1");
    expect(res.data.isAcknowledgedByMyHousehold).toBe(true);
  });
});

describe("getMyReportCardPdfUrlAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:report-cards:download-own"] });
    vi.mocked(_renderReportCardPdfInternal).mockClear();
  });

  it("rejects non-guardian", async () => {
    prismaMock.studentGuardian.findFirst.mockResolvedValue(null as never);
    const res = await getMyReportCardPdfUrlAction({ studentId: "s-1", termId: "t-1" });
    expect(res).toEqual({ error: "Report card not found" });
  });

  it("rejects when no release row exists", async () => {
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      studentId: "s-1",
      guardian: { userId: "test-user-id", householdId: "hh-1" },
    } as never);
    prismaMock.enrollment.findFirst.mockResolvedValue({
      classArmId: "arm-1",
    } as never);
    prismaMock.reportCardRelease.findUnique.mockResolvedValue(null as never);

    const res = await getMyReportCardPdfUrlAction({ studentId: "s-1", termId: "t-1" });
    expect((res as { error: string }).error).toMatch(/not yet released/i);
  });

  it("returns URL on happy path via internal helper", async () => {
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      studentId: "s-1",
      guardian: { userId: "test-user-id", householdId: "hh-1" },
    } as never);
    prismaMock.enrollment.findFirst.mockResolvedValue({
      classArmId: "arm-1",
    } as never);
    prismaMock.reportCardRelease.findUnique.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
    } as never);

    const res = await getMyReportCardPdfUrlAction({ studentId: "s-1", termId: "t-1" });
    if (!("data" in res)) throw new Error("expected data: " + JSON.stringify(res));
    expect(res.data.url).toBe("https://signed.example/x.pdf");
    expect(vi.mocked(_renderReportCardPdfInternal)).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: "s-1", termId: "t-1", schoolId: "default-school" }),
    );
  });
});
