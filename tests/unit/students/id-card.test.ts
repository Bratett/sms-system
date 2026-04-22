import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import * as r2 from "@/lib/storage/r2";
import * as generator from "@/lib/pdf/generator";
import { renderStudentIdCardAction } from "@/modules/student/actions/id-card.action";

vi.mock("@/lib/pdf/generator", () => ({
  renderPdfToBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
}));

vi.mock("@/lib/pdf/qr", () => ({
  generateQrDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,FAKE"),
}));

describe("renderStudentIdCardAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    vi.mocked(r2.uploadFile).mockClear();
    vi.mocked(r2.deleteFile).mockClear();
    vi.mocked(r2.getSignedDownloadUrl).mockClear();
    vi.mocked(generator.renderPdfToBuffer).mockClear();
  });

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await renderStudentIdCardAction("s-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("returns cached signed URL when cache is fresh", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s-1", schoolId: "default-school", photoUrl: "https://p.jpg",
      studentId: "SCH/1", firstName: "A", lastName: "B", otherNames: null, gender: "MALE",
      bloodGroup: null, dateOfBirth: new Date("2010-01-01"), boardingStatus: "DAY",
      idCardPdfKey: "student-id-cards/s-1/abc.pdf",
      idCardCachedAt: new Date(Date.now() - 1000),
      idCardCacheInvalidatedAt: null,
      houseAssignment: null,
      enrollments: [{
        academicYear: { name: "2025/2026", isCurrent: true },
        classArm: { name: "A", class: { name: "SHS 1 Science", programme: { name: "Science" } } },
      }],
    } as never);
    vi.mocked(r2.getSignedDownloadUrl).mockResolvedValue("https://signed.example/cached.pdf");

    const result = await renderStudentIdCardAction("s-1");
    expect(result).toMatchObject({ data: { url: "https://signed.example/cached.pdf", cached: true } });
    expect(vi.mocked(generator.renderPdfToBuffer)).not.toHaveBeenCalled();
  });

  it("renders fresh and uploads when no cache exists", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s-1", schoolId: "default-school", photoUrl: "https://p.jpg",
      studentId: "SCH/1", firstName: "A", lastName: "B", otherNames: null, gender: "MALE",
      bloodGroup: null, dateOfBirth: new Date("2010-01-01"), boardingStatus: "DAY",
      idCardPdfKey: null, idCardCachedAt: null, idCardCacheInvalidatedAt: null,
      houseAssignment: null,
      enrollments: [{
        academicYear: { name: "2025/2026", isCurrent: true },
        classArm: { name: "A", class: { name: "SHS 1 Science", programme: { name: "Science" } } },
      }],
    } as never);
    prismaMock.school.findUnique.mockResolvedValue({
      name: "Test SHS", logoUrl: null, motto: null, address: null, phone: null, email: null,
    } as never);
    vi.mocked(r2.uploadFile).mockResolvedValue({ key: "student-id-cards/s-1/new.pdf", url: "" } as never);
    vi.mocked(r2.getSignedDownloadUrl).mockResolvedValue("https://signed.example/new.pdf");
    prismaMock.student.update.mockResolvedValue({} as never);

    const result = await renderStudentIdCardAction("s-1");
    expect(result).toMatchObject({ data: { cached: false } });
    expect(vi.mocked(generator.renderPdfToBuffer)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(r2.uploadFile)).toHaveBeenCalled();
    expect(prismaMock.student.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "s-1" },
      data: expect.objectContaining({
        idCardPdfKey: "student-id-cards/s-1/new.pdf",
        idCardCachedAt: expect.any(Date),
        idCardCacheInvalidatedAt: null,
      }),
    }));
  });

  it("re-renders when cache is invalidated", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s-1", schoolId: "default-school", photoUrl: "https://p.jpg",
      studentId: "SCH/1", firstName: "A", lastName: "B", otherNames: null, gender: "MALE",
      bloodGroup: null, dateOfBirth: new Date("2010-01-01"), boardingStatus: "DAY",
      idCardPdfKey: "student-id-cards/s-1/old.pdf",
      idCardCachedAt: new Date(Date.now() - 100000),
      idCardCacheInvalidatedAt: new Date(),
      houseAssignment: null,
      enrollments: [{
        academicYear: { name: "2025/2026", isCurrent: true },
        classArm: { name: "A", class: { name: "SHS 1 Science", programme: { name: "Science" } } },
      }],
    } as never);
    prismaMock.school.findUnique.mockResolvedValue({
      name: "Test SHS", logoUrl: null, motto: null, address: null, phone: null, email: null,
    } as never);
    vi.mocked(r2.uploadFile).mockResolvedValue({ key: "student-id-cards/s-1/new.pdf", url: "" } as never);
    vi.mocked(r2.getSignedDownloadUrl).mockResolvedValue("https://signed.example/new.pdf");
    prismaMock.student.update.mockResolvedValue({} as never);

    const result = await renderStudentIdCardAction("s-1");
    expect(result).toMatchObject({ data: { cached: false } });
    expect(vi.mocked(generator.renderPdfToBuffer)).toHaveBeenCalled();
  });

  it("returns error when student has no active enrollment", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s-1", schoolId: "default-school", photoUrl: null,
      studentId: "SCH/1", firstName: "A", lastName: "B", otherNames: null, gender: "MALE",
      bloodGroup: null, dateOfBirth: new Date("2010-01-01"), boardingStatus: "DAY",
      idCardPdfKey: null, idCardCachedAt: null, idCardCacheInvalidatedAt: null,
      houseAssignment: null,
      enrollments: [],
    } as never);

    const result = await renderStudentIdCardAction("s-1");
    expect(result).toEqual({ error: "Student has no active enrollment" });
  });
});
