import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import { resolveStudentPhotoUrl } from "@/modules/student/actions/photo";
import { PLACEHOLDER_PHOTO_SENTINEL } from "@/lib/pdf/constants";
import { getSignedDownloadUrl } from "@/lib/storage/r2";

describe("resolveStudentPhotoUrl", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("prefers Student.photoUrl when set", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s-1", schoolId: "default-school", photoUrl: "https://r2.example/s-1.jpg",
    } as never);

    const url = await resolveStudentPhotoUrl("s-1");
    expect(url).toBe("https://r2.example/s-1.jpg");
    expect(prismaMock.studentDocument.findFirst).not.toHaveBeenCalled();
  });

  it("falls back to VERIFIED Passport Photo from vault when photoUrl is null", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s-1", schoolId: "default-school", photoUrl: null,
    } as never);
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", fileKey: "student-documents/s-1/photo.jpg",
    } as never);
    vi.mocked(getSignedDownloadUrl).mockResolvedValueOnce(
      "https://signed.example/student-documents/s-1/photo.jpg?sig=abc",
    );

    const url = await resolveStudentPhotoUrl("s-1");
    expect(url).toContain("student-documents/s-1/photo.jpg");
  });

  it("returns placeholder sentinel when no photo available", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s-1", schoolId: "default-school", photoUrl: null,
    } as never);
    prismaMock.studentDocument.findFirst.mockResolvedValue(null);

    const url = await resolveStudentPhotoUrl("s-1");
    expect(url).toBe(PLACEHOLDER_PHOTO_SENTINEL);
  });
});
