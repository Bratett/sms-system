import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import * as r2 from "@/lib/storage/r2";
import * as generator from "@/lib/pdf/generator";
import {
  renderTranscriptPdfAction,
  verifyTranscriptAction,
  issueTranscriptAction,
} from "@/modules/academics/actions/transcript.action";

vi.mock("@/lib/pdf/generator", () => ({
  renderPdfToBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
}));

describe("renderTranscriptPdfAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    vi.mocked(r2.getSignedDownloadUrl).mockClear();
    vi.mocked(r2.uploadFile).mockClear();
    vi.mocked(generator.renderPdfToBuffer).mockClear();
  });

  it("returns cached URL when status is ISSUED and pdfKey set", async () => {
    prismaMock.transcript.findFirst.mockResolvedValue({
      id: "tr-1", schoolId: "default-school", status: "ISSUED",
      pdfKey: "transcripts/tr-1.pdf",
    } as never);
    vi.mocked(r2.getSignedDownloadUrl).mockResolvedValue("https://signed/tr.pdf");

    const result = await renderTranscriptPdfAction("tr-1");
    expect(result).toMatchObject({ data: { url: "https://signed/tr.pdf", cached: true } });
    expect(vi.mocked(generator.renderPdfToBuffer)).not.toHaveBeenCalled();
  });

  it("renders preview inline when status is GENERATED (no pdfKey write)", async () => {
    prismaMock.transcript.findFirst.mockResolvedValue({
      id: "tr-1", schoolId: "default-school", status: "GENERATED",
      transcriptNumber: "TRN/2026/0001", coveringFrom: "2024/2025", coveringTo: "2025/2026",
      cumulativeGPA: 3.4, pdfKey: null, issuedAt: null,
      studentId: "s-1",
    } as never);
    prismaMock.transcript.findUnique.mockResolvedValue({
      id: "tr-1", schoolId: "default-school", status: "GENERATED",
      transcriptNumber: "TRN/2026/0001", coveringFrom: "2024/2025", coveringTo: "2025/2026",
      cumulativeGPA: 3.4, pdfKey: null, issuedAt: null,
      studentId: "s-1",
    } as never);
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s-1", studentId: "SCH/1", firstName: "A", lastName: "B",
      dateOfBirth: new Date("2010-01-01"), gender: "MALE",
      enrollments: [{ classArm: { class: { programme: { name: "Science" } } } }],
    } as never);
    prismaMock.school.findUnique.mockResolvedValue({
      name: "Test SHS", motto: null, logoUrl: null, address: null, phone: null, email: null,
    } as never);
    prismaMock.terminalResult.findMany.mockResolvedValue([] as never);
    vi.mocked(r2.uploadFile).mockResolvedValue({ key: "transcript-previews/tr-1/preview.pdf", url: "" } as never);
    vi.mocked(r2.getSignedDownloadUrl).mockResolvedValue("https://signed/preview.pdf");

    const result = await renderTranscriptPdfAction("tr-1");
    expect(result).toHaveProperty("data");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.cached).toBe(false);
    // pdfKey is NOT written to the transcript for previews:
    expect(prismaMock.transcript.update).not.toHaveBeenCalled();
  });
});

describe("verifyTranscriptAction (re-gated)", () => {
  it("GENERATED -> VERIFIED when caller has TRANSCRIPTS_VERIFY", async () => {
    mockAuthenticatedUser({ permissions: ["academics:transcripts:verify"] });
    prismaMock.transcript.findUnique.mockResolvedValue({
      id: "tr-1", schoolId: "default-school", status: "GENERATED", transcriptNumber: "TRN/1",
    } as never);
    prismaMock.transcript.update.mockResolvedValue({ id: "tr-1", status: "VERIFIED" } as never);

    const result = await verifyTranscriptAction("tr-1");
    expect(result).toMatchObject({ data: { status: "VERIFIED" } });
  });

  it("refuses when status is not GENERATED", async () => {
    mockAuthenticatedUser({ permissions: ["academics:transcripts:verify"] });
    prismaMock.transcript.findUnique.mockResolvedValue({
      id: "tr-1", schoolId: "default-school", status: "VERIFIED", transcriptNumber: "TRN/1",
    } as never);

    const result = await verifyTranscriptAction("tr-1");
    expect(result).toEqual({ error: "Transcript is not in GENERATED status" });
  });
});

describe("issueTranscriptAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:transcripts:issue"] });
    vi.mocked(r2.uploadFile).mockClear();
    vi.mocked(generator.renderPdfToBuffer).mockClear();
  });

  it("VERIFIED -> ISSUED, renders PDF, caches pdfKey", async () => {
    prismaMock.transcript.findUnique.mockResolvedValue({
      id: "tr-1", schoolId: "default-school", status: "VERIFIED",
      transcriptNumber: "TRN/2026/0001", coveringFrom: "2024/2025", coveringTo: "2025/2026",
      cumulativeGPA: 3.4, pdfKey: null, studentId: "s-1",
    } as never);
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s-1", studentId: "SCH/1", firstName: "A", lastName: "B",
      dateOfBirth: new Date("2010-01-01"), gender: "MALE",
      enrollments: [{ classArm: { class: { programme: { name: "Science" } } } }],
    } as never);
    prismaMock.school.findUnique.mockResolvedValue({
      name: "Test SHS", motto: null, logoUrl: null, address: null, phone: null, email: null,
    } as never);
    prismaMock.terminalResult.findMany.mockResolvedValue([] as never);
    vi.mocked(r2.uploadFile).mockResolvedValue({ key: "transcripts/tr-1.pdf", url: "" } as never);
    prismaMock.transcript.update.mockResolvedValue({
      id: "tr-1", status: "ISSUED", pdfKey: "transcripts/tr-1.pdf",
    } as never);

    const result = await issueTranscriptAction("tr-1");
    expect(result).toMatchObject({ data: { status: "ISSUED" } });
    expect(vi.mocked(generator.renderPdfToBuffer)).toHaveBeenCalled();
    expect(prismaMock.transcript.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "ISSUED",
        pdfKey: "transcripts/tr-1.pdf",
        issuedBy: "test-user-id",
        issuedAt: expect.any(Date),
      }),
    }));
  });

  it("refuses when status is not VERIFIED", async () => {
    prismaMock.transcript.findUnique.mockResolvedValue({
      id: "tr-1", schoolId: "default-school", status: "GENERATED", transcriptNumber: "TRN/1",
    } as never);

    const result = await issueTranscriptAction("tr-1");
    expect(result).toEqual({ error: "Transcript is not in VERIFIED status" });
  });
});
