import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  setStudentPhotoAction,
  removeStudentPhotoAction,
} from "@/modules/student/actions/photo-upload";

// Mock r2 storage helpers
vi.mock("@/lib/storage/r2", () => ({
  getObject: vi.fn().mockResolvedValue(Buffer.from("fake-image-bytes")),
  uploadFile: vi.fn().mockResolvedValue({ key: "students/s1/photo.jpg", url: "https://r2.example/students/s1/photo.jpg" }),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  getSignedDownloadUrl: vi.fn().mockResolvedValue("https://signed.example/students/s1/photo.jpg"),
}));

// Mock sharp — return an object with chainable methods that all return the same proxy
vi.mock("sharp", () => {
  const sharpProxy = {
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("resized-bytes")),
  };
  return { default: vi.fn(() => sharpProxy) };
});

describe("setStudentPhotoAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("rejects unauthenticated callers", async () => {
    mockUnauthenticated();
    const result = await setStudentPhotoAction({ studentId: "s1", fileKey: "tmp/abc.jpg" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("rejects callers without STUDENTS_UPDATE", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await setStudentPhotoAction({ studentId: "s1", fileKey: "tmp/abc.jpg" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error.toLowerCase()).toContain("permission");
  });

  it("returns 'Student not found' on cross-school access", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null as never);
    const result = await setStudentPhotoAction({ studentId: "from-other-school", fileKey: "tmp/abc.jpg" });
    expect(result).toEqual({ error: "Student not found" });
  });

  it("resizes via sharp, uploads to stable key, updates Student.photoUrl, and cleans up temp", async () => {
    const r2 = await import("@/lib/storage/r2");
    const sharpModule = await import("sharp");
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" } as never);
    prismaMock.student.update.mockResolvedValue({ id: "s1" } as never);

    const result = await setStudentPhotoAction({ studentId: "s1", fileKey: "tmp/student-photo/s1/abc.jpg" });

    expect(result).toHaveProperty("data");
    // sharp called with the source buffer
    expect(sharpModule.default).toHaveBeenCalled();
    // Uploaded to stable key
    expect(r2.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({ key: "students/s1/photo.jpg", contentType: "image/jpeg" }),
    );
    // photoUrl updated to the stable key
    expect(prismaMock.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1" },
        data: { photoUrl: "students/s1/photo.jpg" },
      }),
    );
    // Temp upload deleted
    expect(r2.deleteFile).toHaveBeenCalledWith("tmp/student-photo/s1/abc.jpg");
  });

  it("returns error and cleans up temp when source download fails", async () => {
    // Exercises the try/catch around the sharp pipeline by failing the upstream
    // step (getObject) — keeps the test simple and stable across vitest mock
    // implementations of sharp.
    const r2 = await import("@/lib/storage/r2");
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" } as never);
    vi.mocked(r2.getObject).mockRejectedValueOnce(new Error("not found"));

    const result = await setStudentPhotoAction({ studentId: "s1", fileKey: "tmp/missing.jpg" });

    expect(result).toEqual({ error: "Could not process image" });
    expect(r2.deleteFile).toHaveBeenCalledWith("tmp/missing.jpg");
    // Did NOT update the student
    expect(prismaMock.student.update).not.toHaveBeenCalled();
  });
});

describe("removeStudentPhotoAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("rejects unauthenticated callers", async () => {
    mockUnauthenticated();
    const result = await removeStudentPhotoAction({ studentId: "s1" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("rejects callers without STUDENTS_UPDATE", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await removeStudentPhotoAction({ studentId: "s1" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error.toLowerCase()).toContain("permission");
  });

  it("returns 'Student not found' on cross-school access", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null as never);
    const result = await removeStudentPhotoAction({ studentId: "from-other-school" });
    expect(result).toEqual({ error: "Student not found" });
  });

  it("is a no-op when photoUrl is null", async () => {
    const r2 = await import("@/lib/storage/r2");
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1", photoUrl: null } as never);

    const result = await removeStudentPhotoAction({ studentId: "s1" });

    expect(result).toEqual({ data: { ok: true } });
    expect(r2.deleteFile).not.toHaveBeenCalled();
    expect(prismaMock.student.update).not.toHaveBeenCalled();
  });

  it("deletes R2 object and nulls photoUrl when stored value is a key", async () => {
    const r2 = await import("@/lib/storage/r2");
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1", photoUrl: "students/s1/photo.jpg" } as never);
    prismaMock.student.update.mockResolvedValue({ id: "s1" } as never);

    const result = await removeStudentPhotoAction({ studentId: "s1" });

    expect(result).toEqual({ data: { ok: true } });
    expect(r2.deleteFile).toHaveBeenCalledWith("students/s1/photo.jpg");
    expect(prismaMock.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1" },
        data: { photoUrl: null },
      }),
    );
  });

  it("nulls photoUrl but does NOT call R2 delete when stored value is a legacy URL", async () => {
    const r2 = await import("@/lib/storage/r2");
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1", photoUrl: "https://legacy.example/photo.jpg" } as never);
    prismaMock.student.update.mockResolvedValue({ id: "s1" } as never);

    const result = await removeStudentPhotoAction({ studentId: "s1" });

    expect(result).toEqual({ data: { ok: true } });
    expect(r2.deleteFile).not.toHaveBeenCalled();
    expect(prismaMock.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { photoUrl: null },
      }),
    );
  });
});
