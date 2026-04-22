import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import * as r2 from "@/lib/storage/r2";
import * as generator from "@/lib/pdf/generator";
import {
  renderReportCardPdfAction,
  invalidateReportCardCacheAction,
} from "@/modules/academics/actions/report-card.action";

vi.mock("@/lib/pdf/generator", () => ({
  renderPdfToBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
}));

describe("renderReportCardPdfAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    vi.mocked(r2.uploadFile).mockClear();
    vi.mocked(r2.getSignedDownloadUrl).mockClear();
    vi.mocked(generator.renderPdfToBuffer).mockClear();
  });

  it("returns cached signed URL when cache row is fresh", async () => {
    prismaMock.reportCardPdfCache.findUnique.mockResolvedValue({
      id: "rc-1", fileKey: "report-cards/s-1-t-1/abc.pdf",
      renderedAt: new Date(Date.now() - 1000), invalidatedAt: null,
    } as never);
    vi.mocked(r2.getSignedDownloadUrl).mockResolvedValue("https://signed/cached.pdf");

    const result = await renderReportCardPdfAction({ studentId: "s-1", termId: "t-1" });
    expect(result).toMatchObject({ data: { url: "https://signed/cached.pdf", cached: true } });
    expect(vi.mocked(generator.renderPdfToBuffer)).not.toHaveBeenCalled();
  });

  it("re-renders when invalidatedAt > renderedAt", async () => {
    prismaMock.reportCardPdfCache.findUnique.mockResolvedValue({
      id: "rc-1", fileKey: "report-cards/s-1-t-1/old.pdf",
      renderedAt: new Date(Date.now() - 10000), invalidatedAt: new Date(),
    } as never);
    // generateReportCardDataAction lookups
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s-1", schoolId: "default-school", firstName: "A", lastName: "B",
      otherNames: null, studentId: "SCH/1", gender: "MALE",
      houseAssignment: null,
    } as never);
    prismaMock.school.findUnique.mockResolvedValue({
      id: "default-school", name: "Test SHS", motto: null, logoUrl: null,
      address: null, phone: null, email: null,
    } as never);
    prismaMock.terminalResult.findFirst.mockResolvedValue({
      studentId: "s-1", termId: "t-1", classArmId: "ca-1", academicYearId: "ay-1",
      totalScore: 500, averageScore: 75, classPosition: 3, overallGrade: "B2",
      teacherRemarks: null, headmasterRemarks: null,
      subjectResults: [],
    } as never);
    prismaMock.term.findUnique.mockResolvedValue({
      id: "t-1", name: "Term 1", termNumber: 1, academicYearId: "ay-1",
      academicYear: { name: "2025/2026" },
      startDate: new Date(), endDate: new Date(),
    } as never);
    prismaMock.enrollment.findFirst.mockResolvedValue({
      id: "e-1",
      classArm: {
        id: "ca-1", name: "A",
        class: { id: "c-1", name: "SHS 1 Sci", programmeId: "p-1" },
      },
    } as never);
    prismaMock.programme.findUnique.mockResolvedValue({ name: "Sci" } as never);
    prismaMock.terminalResult.count.mockResolvedValue(30 as never);
    prismaMock.attendanceRegister.findMany.mockResolvedValue([] as never);
    prismaMock.attendanceRecord.findMany.mockResolvedValue([] as never);

    vi.mocked(r2.uploadFile).mockResolvedValue({ key: "report-cards/s-1-t-1/new.pdf", url: "" } as never);
    vi.mocked(r2.getSignedDownloadUrl).mockResolvedValue("https://signed/new.pdf");
    prismaMock.reportCardPdfCache.upsert.mockResolvedValue({ id: "rc-1" } as never);

    const result = await renderReportCardPdfAction({ studentId: "s-1", termId: "t-1" });
    expect(result).toHaveProperty("data");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.cached).toBe(false);
    expect(vi.mocked(generator.renderPdfToBuffer)).toHaveBeenCalled();
  });
});

describe("invalidateReportCardCacheAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("sets invalidatedAt when cache row exists", async () => {
    prismaMock.reportCardPdfCache.updateMany.mockResolvedValue({ count: 1 } as never);

    const result = await invalidateReportCardCacheAction({ studentId: "s-1", termId: "t-1" });
    expect(result).toEqual({ data: { invalidated: 1 } });
    expect(prismaMock.reportCardPdfCache.updateMany).toHaveBeenCalledWith({
      where: { studentId: "s-1", termId: "t-1" },
      data: { invalidatedAt: expect.any(Date) },
    });
  });

  it("is idempotent when no cache row exists", async () => {
    prismaMock.reportCardPdfCache.updateMany.mockResolvedValue({ count: 0 } as never);

    const result = await invalidateReportCardCacheAction({ studentId: "s-1", termId: "t-1" });
    expect(result).toEqual({ data: { invalidated: 0 } });
  });
});
