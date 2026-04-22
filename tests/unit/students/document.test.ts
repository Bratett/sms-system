import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import * as r2 from "@/lib/storage/r2";
import { listDocumentTypesAction } from "@/modules/student/actions/document.action";
import { createDocumentTypeAction } from "@/modules/student/actions/document.action";

describe("listDocumentTypesAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await listDocumentTypesAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("returns types for the school ordered by sortOrder then name", async () => {
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-1", name: "Birth Certificate", status: "ACTIVE", sortOrder: 0 },
      { id: "dt-2", name: "JHS Report", status: "ACTIVE", sortOrder: 1 },
    ] as never);

    const result = await listDocumentTypesAction();
    expect(result).toEqual({ data: expect.arrayContaining([
      expect.objectContaining({ id: "dt-1" }),
      expect.objectContaining({ id: "dt-2" }),
    ]) });
    expect(prismaMock.documentType.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { schoolId: "default-school" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }));
  });

  it("filters by status when provided", async () => {
    prismaMock.documentType.findMany.mockResolvedValue([] as never);
    await listDocumentTypesAction({ status: "ACTIVE" });
    expect(prismaMock.documentType.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { schoolId: "default-school", status: "ACTIVE" },
    }));
  });
});

describe("createDocumentTypeAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("creates a type and audits", async () => {
    prismaMock.documentType.create.mockResolvedValue({ id: "dt-new", name: "NHIS Card" } as never);

    const result = await createDocumentTypeAction({
      name: "NHIS Card",
      isRequired: true,
      expiryMonths: 12,
      appliesTo: "ALL",
    });
    expect(result).toMatchObject({ data: { id: "dt-new" } });
    expect(prismaMock.documentType.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId: "default-school",
        name: "NHIS Card",
        isRequired: true,
        expiryMonths: 12,
        appliesTo: "ALL",
      }),
    });
  });

  it("surfaces unique-constraint violation as a clean error", async () => {
    const uniqueErr = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    prismaMock.documentType.create.mockRejectedValue(uniqueErr);

    const result = await createDocumentTypeAction({
      name: "Birth Certificate",
    });
    expect(result).toEqual({ error: "A document type with this name already exists" });
  });
});

import {
  updateDocumentTypeAction,
  deactivateDocumentTypeAction,
} from "@/modules/student/actions/document.action";

describe("updateDocumentTypeAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("updates partial fields and audits", async () => {
    prismaMock.documentType.findFirst.mockResolvedValue({ id: "dt-1", schoolId: "default-school", name: "Old" } as never);
    prismaMock.documentType.update.mockResolvedValue({ id: "dt-1", name: "Old", isRequired: true } as never);

    const result = await updateDocumentTypeAction({ id: "clh0000000000000000000001", isRequired: true });
    expect(result).toMatchObject({ data: { id: "dt-1", isRequired: true } });
    expect(prismaMock.documentType.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "clh0000000000000000000001" },
      data: { isRequired: true },
    }));
  });

  it("returns error when type not found for current school", async () => {
    prismaMock.documentType.findFirst.mockResolvedValue(null);
    const result = await updateDocumentTypeAction({ id: "clh0000000000000000000099", name: "Anything" });
    expect(result).toEqual({ error: "Document type not found" });
  });
});

describe("deactivateDocumentTypeAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("soft-deletes when there are no documents referencing the type", async () => {
    prismaMock.documentType.findFirst.mockResolvedValue({ id: "dt-1", schoolId: "default-school", status: "ACTIVE", name: "X" } as never);
    prismaMock.studentDocument.count.mockResolvedValue(0);
    prismaMock.documentType.update.mockResolvedValue({ id: "dt-1", status: "INACTIVE" } as never);

    const result = await deactivateDocumentTypeAction("dt-1");
    expect(result).toEqual({ data: { id: "dt-1", status: "INACTIVE" } });
  });

  it("soft-deletes even when documents exist (soft-delete always succeeds)", async () => {
    prismaMock.documentType.findFirst.mockResolvedValue({ id: "dt-1", schoolId: "default-school", status: "ACTIVE", name: "X" } as never);
    prismaMock.studentDocument.count.mockResolvedValue(5);
    prismaMock.documentType.update.mockResolvedValue({ id: "dt-1", status: "INACTIVE" } as never);

    const result = await deactivateDocumentTypeAction("dt-1");
    expect(result).toEqual({ data: { id: "dt-1", status: "INACTIVE" } });
  });
});

import {
  listStudentDocumentsAction,
  getMissingRequiredDocumentsAction,
} from "@/modules/student/actions/document.action";

describe("listStudentDocumentsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns documents with computed expiry flags", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5);
    const soon = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10);
    const far = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
    prismaMock.studentDocument.findMany.mockResolvedValue([
      { id: "sd-1", expiresAt: past, verificationStatus: "VERIFIED", documentType: { id: "dt-a", name: "A" } },
      { id: "sd-2", expiresAt: soon, verificationStatus: "VERIFIED", documentType: { id: "dt-b", name: "B" } },
      { id: "sd-3", expiresAt: far, verificationStatus: "VERIFIED", documentType: { id: "dt-c", name: "C" } },
      { id: "sd-4", expiresAt: null, verificationStatus: "PENDING", documentType: { id: "dt-d", name: "D" } },
    ] as never);

    const result = await listStudentDocumentsAction("student-1");
    expect("data" in result).toBe(true);
    if (!("data" in result)) throw new Error(result.error);
    expect(result.data).toHaveLength(4);
    expect(result.data.find((d: any) => d.id === "sd-1")).toMatchObject({ isExpired: true, isExpiringSoon: false });
    expect(result.data.find((d: any) => d.id === "sd-2")).toMatchObject({ isExpired: false, isExpiringSoon: true });
    expect(result.data.find((d: any) => d.id === "sd-3")).toMatchObject({ isExpired: false, isExpiringSoon: false });
    expect(result.data.find((d: any) => d.id === "sd-4")).toMatchObject({ isExpired: false, isExpiringSoon: false });
  });
});

describe("getMissingRequiredDocumentsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("DAY student is not flagged for BOARDING_ONLY required types", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "student-1", boardingStatus: "DAY" } as never);
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-2", name: "Birth Certificate", isRequired: true, appliesTo: "ALL", status: "ACTIVE", expiryMonths: null },
    ] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([
      { documentTypeId: "dt-2", verificationStatus: "VERIFIED", expiresAt: null },
    ] as never);

    const result = await getMissingRequiredDocumentsAction("student-1");
    if (!("data" in result)) throw new Error(result.error);
    expect(result.data.missing).toHaveLength(0);
  });

  it("BOARDING student is flagged for missing BOARDING_ONLY types", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "student-1", boardingStatus: "BOARDING" } as never);
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-1", name: "Medical Clearance", isRequired: true, appliesTo: "BOARDING_ONLY", status: "ACTIVE", expiryMonths: 12 },
      { id: "dt-2", name: "Birth Certificate", isRequired: true, appliesTo: "ALL", status: "ACTIVE", expiryMonths: null },
    ] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([
      { documentTypeId: "dt-2", verificationStatus: "VERIFIED", expiresAt: null },
    ] as never);

    const result = await getMissingRequiredDocumentsAction("student-1");
    if (!("data" in result)) throw new Error(result.error);
    expect(result.data.missing).toHaveLength(1);
    expect(result.data.missing[0]).toMatchObject({ id: "dt-1" });
  });

  it("expired VERIFIED documents count as missing", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5);
    prismaMock.student.findFirst.mockResolvedValue({ id: "student-1", boardingStatus: "DAY" } as never);
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-2", name: "Birth Certificate", isRequired: true, appliesTo: "ALL", status: "ACTIVE", expiryMonths: 12 },
    ] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([
      { documentTypeId: "dt-2", verificationStatus: "VERIFIED", expiresAt: past },
    ] as never);

    const result = await getMissingRequiredDocumentsAction("student-1");
    if (!("data" in result)) throw new Error(result.error);
    expect(result.data.missing).toHaveLength(1);
  });

  it("PENDING and REJECTED documents do not satisfy the requirement", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "student-1", boardingStatus: "DAY" } as never);
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-2", name: "Birth Certificate", isRequired: true, appliesTo: "ALL", status: "ACTIVE", expiryMonths: null },
    ] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([
      { documentTypeId: "dt-2", verificationStatus: "PENDING", expiresAt: null },
      { documentTypeId: "dt-2", verificationStatus: "REJECTED", expiresAt: null },
    ] as never);

    const result = await getMissingRequiredDocumentsAction("student-1");
    if (!("data" in result)) throw new Error(result.error);
    expect(result.data.missing).toHaveLength(1);
  });
});

import { recordUploadedStudentDocumentAction } from "@/modules/student/actions/document.action";

describe("recordUploadedStudentDocumentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    vi.mocked(r2.deleteFile).mockClear();
  });

  it("creates a document row with computed expiresAt from documentType.expiryMonths", async () => {
    prismaMock.documentType.findFirst.mockResolvedValue({
      id: "dt-1", schoolId: "default-school", expiryMonths: 12,
    } as never);
    prismaMock.studentDocument.create.mockResolvedValue({ id: "sd-new" } as never);

    const result = await recordUploadedStudentDocumentAction({
      studentId: "clh0000000000000000000001",
      documentTypeId: "clh0000000000000000000002",
      title: "Birth Certificate",
      fileKey: "student-documents/clh0000000000000000000001/1234-file.pdf",
      fileName: "file.pdf",
      fileSize: 1024,
      contentType: "application/pdf",
    });
    expect(result).toMatchObject({ data: { id: "sd-new" } });
    const createArgs = vi.mocked(prismaMock.studentDocument.create).mock.calls[0][0];
    expect(createArgs.data.expiresAt).toBeInstanceOf(Date);
  });

  it("creates with null expiresAt when documentType.expiryMonths is null", async () => {
    prismaMock.documentType.findFirst.mockResolvedValue({
      id: "dt-1", schoolId: "default-school", expiryMonths: null,
    } as never);
    prismaMock.studentDocument.create.mockResolvedValue({ id: "sd-new" } as never);

    await recordUploadedStudentDocumentAction({
      studentId: "clh0000000000000000000001",
      documentTypeId: "clh0000000000000000000002",
      title: "Birth Certificate",
      fileKey: "key",
      fileName: "f.pdf",
      fileSize: 1,
      contentType: "application/pdf",
    });
    const createArgs = vi.mocked(prismaMock.studentDocument.create).mock.calls[0][0];
    expect(createArgs.data.expiresAt).toBeNull();
  });

  it("deletes R2 file and returns error when DB insert fails", async () => {
    prismaMock.documentType.findFirst.mockResolvedValue({
      id: "dt-1", schoolId: "default-school", expiryMonths: null,
    } as never);
    prismaMock.studentDocument.create.mockRejectedValue(new Error("DB exploded"));

    const result = await recordUploadedStudentDocumentAction({
      studentId: "clh0000000000000000000001",
      documentTypeId: "clh0000000000000000000002",
      title: "X",
      fileKey: "orphan-key",
      fileName: "f.pdf",
      fileSize: 1,
      contentType: "application/pdf",
    });
    expect(result).toMatchObject({ error: expect.stringContaining("failed") });
    expect(vi.mocked(r2.deleteFile)).toHaveBeenCalledWith("orphan-key");
  });
});

import {
  updateStudentDocumentAction,
  deleteStudentDocumentAction,
} from "@/modules/student/actions/document.action";

describe("updateStudentDocumentAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("updates title and notes", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", schoolId: "default-school", title: "Old title",
    } as never);
    prismaMock.studentDocument.update.mockResolvedValue({ id: "sd-1", title: "New title" } as never);

    const result = await updateStudentDocumentAction({
      id: "clh0000000000000000000001",
      title: "New title",
    });
    expect(result).toMatchObject({ data: { id: "sd-1", title: "New title" } });
  });

  it("returns error when document not found in current school", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue(null);
    const result = await updateStudentDocumentAction({ id: "clh0000000000000000000099", title: "X" });
    expect(result).toEqual({ error: "Document not found" });
  });
});

describe("deleteStudentDocumentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    vi.mocked(r2.deleteFile).mockClear();
  });

  it("deletes DB row and R2 object", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", schoolId: "default-school", fileKey: "student-documents/s/file.pdf",
      fileName: "file.pdf", title: "X",
    } as never);
    prismaMock.studentDocument.delete.mockResolvedValue({ id: "sd-1" } as never);

    const result = await deleteStudentDocumentAction("sd-1");
    expect(result).toEqual({ data: { deleted: true } });
    expect(vi.mocked(r2.deleteFile)).toHaveBeenCalledWith("student-documents/s/file.pdf");
  });

  it("still deletes DB row when R2 delete fails", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", schoolId: "default-school", fileKey: "k", fileName: "f", title: "X",
    } as never);
    vi.mocked(r2.deleteFile).mockRejectedValueOnce(new Error("R2 down"));
    prismaMock.studentDocument.delete.mockResolvedValue({ id: "sd-1" } as never);

    const result = await deleteStudentDocumentAction("sd-1");
    expect(result).toEqual({ data: { deleted: true } });
    expect(prismaMock.studentDocument.delete).toHaveBeenCalled();
  });
});

import {
  verifyStudentDocumentAction,
  rejectStudentDocumentAction,
  reopenStudentDocumentAction,
} from "@/modules/student/actions/document.action";

describe("verifyStudentDocumentAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("PENDING → VERIFIED with verifier + timestamp", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", schoolId: "default-school", verificationStatus: "PENDING", title: "X",
    } as never);
    prismaMock.studentDocument.update.mockResolvedValue({ id: "sd-1", verificationStatus: "VERIFIED" } as never);

    const result = await verifyStudentDocumentAction("sd-1");
    expect(result).toMatchObject({ data: { verificationStatus: "VERIFIED" } });
    expect(prismaMock.studentDocument.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "sd-1" },
      data: expect.objectContaining({
        verificationStatus: "VERIFIED",
        verifiedBy: "test-user-id",
        verifiedAt: expect.any(Date),
      }),
    }));
  });

  it("refuses when not PENDING", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", schoolId: "default-school", verificationStatus: "VERIFIED", title: "X",
    } as never);
    const result = await verifyStudentDocumentAction("sd-1");
    expect(result).toEqual({ error: "Document is no longer PENDING" });
  });
});

describe("rejectStudentDocumentAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("PENDING → REJECTED with reason", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", schoolId: "default-school", verificationStatus: "PENDING", title: "X",
    } as never);
    prismaMock.studentDocument.update.mockResolvedValue({ id: "sd-1", verificationStatus: "REJECTED" } as never);

    const result = await rejectStudentDocumentAction({
      id: "clh0000000000000000000001",
      reason: "Illegible scan, please re-upload",
    });
    expect(result).toMatchObject({ data: { verificationStatus: "REJECTED" } });
    expect(prismaMock.studentDocument.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        verificationStatus: "REJECTED",
        rejectionReason: "Illegible scan, please re-upload",
      }),
    }));
  });

  it("enforces reason min length", async () => {
    const result = await rejectStudentDocumentAction({ id: "clh0000000000000000000001", reason: "no" });
    expect(result).toEqual({ error: expect.stringMatching(/5|character/i) });
  });
});

describe("reopenStudentDocumentAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("VERIFIED → PENDING", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", schoolId: "default-school", verificationStatus: "VERIFIED", title: "X",
    } as never);
    prismaMock.studentDocument.update.mockResolvedValue({ id: "sd-1", verificationStatus: "PENDING" } as never);

    const result = await reopenStudentDocumentAction("sd-1");
    expect(result).toMatchObject({ data: { verificationStatus: "PENDING" } });
  });

  it("refuses when already PENDING", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", schoolId: "default-school", verificationStatus: "PENDING", title: "X",
    } as never);
    const result = await reopenStudentDocumentAction("sd-1");
    expect(result).toEqual({ error: "Document is already PENDING" });
  });
});

import { portAdmissionDocumentsToStudentAction } from "@/modules/student/actions/document.action";

describe("portAdmissionDocumentsToStudentAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("maps admission docs to matching-named types and preserves verification status", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "clh0000000000000000000001" } as never);
    prismaMock.admissionDocument.findMany.mockResolvedValue([
      { id: "ad-1", documentType: "Birth Certificate", fileKey: "k1", fileName: "bc.pdf",
        verificationStatus: "VERIFIED", verifiedBy: "u-1", verifiedAt: new Date("2025-01-01"),
        rejectionReason: null },
      { id: "ad-2", documentType: "Unknown Type", fileKey: "k2", fileName: "u.pdf",
        verificationStatus: "PENDING", verifiedBy: null, verifiedAt: null, rejectionReason: null },
    ] as never);
    prismaMock.documentType.upsert.mockResolvedValue({ id: "dt-other", name: "Other" } as never);
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-birth", name: "Birth Certificate", status: "ACTIVE" },
      { id: "dt-other", name: "Other", status: "ACTIVE" },
    ] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([] as never);
    prismaMock.studentDocument.createMany.mockResolvedValue({ count: 2 } as never);

    const result = await portAdmissionDocumentsToStudentAction({
      applicationId: "app-1",
      studentId: "clh0000000000000000000001",
    });
    expect(result).toEqual({ data: { ported: 2, skipped: 0 } });
  });

  it("is idempotent: skips existing (studentId, fileKey) pairs", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "clh0000000000000000000001" } as never);
    prismaMock.admissionDocument.findMany.mockResolvedValue([
      { id: "ad-1", documentType: "Birth Certificate", fileKey: "k1", fileName: "bc.pdf",
        verificationStatus: "VERIFIED", verifiedBy: "u-1", verifiedAt: new Date(),
        rejectionReason: null },
    ] as never);
    prismaMock.documentType.upsert.mockResolvedValue({ id: "dt-other", name: "Other" } as never);
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-birth", name: "Birth Certificate", status: "ACTIVE" },
      { id: "dt-other", name: "Other", status: "ACTIVE" },
    ] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([{ fileKey: "k1" }] as never);
    prismaMock.studentDocument.createMany.mockResolvedValue({ count: 0 } as never);

    const result = await portAdmissionDocumentsToStudentAction({
      applicationId: "app-1",
      studentId: "clh0000000000000000000001",
    });
    expect(result).toEqual({ data: { ported: 0, skipped: 1 } });
  });

  it("rejects callers without STUDENTS_DOCUMENTS_CREATE permission", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await portAdmissionDocumentsToStudentAction({
      applicationId: "app-1",
      studentId: "clh0000000000000000000001",
    });
    expect(result).toEqual({ error: "Insufficient permissions" });
  });

  it("rejects when the target student does not belong to the current school", async () => {
    mockAuthenticatedUser();
    prismaMock.student.findFirst.mockResolvedValue(null);

    const result = await portAdmissionDocumentsToStudentAction({
      applicationId: "app-1",
      studentId: "clh0000000000000000000099",
    });
    expect(result).toEqual({ error: "Student not found" });
  });
});

import {
  listStudentsWithMissingDocsAction,
  listStudentsWithExpiringDocsAction,
} from "@/modules/student/actions/document.action";

describe("listStudentsWithMissingDocsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns students whose valid-verified doc set misses a required type", async () => {
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-1", name: "Birth Cert", isRequired: true, appliesTo: "ALL", status: "ACTIVE" },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-1", firstName: "A", lastName: "B", studentId: "S/1", boardingStatus: "DAY", studentDocuments: [] },
      { id: "s-2", firstName: "C", lastName: "D", studentId: "S/2", boardingStatus: "DAY", studentDocuments: [
        { documentTypeId: "dt-1", verificationStatus: "VERIFIED", expiresAt: null },
      ] },
    ] as never);

    const result = await listStudentsWithMissingDocsAction();
    if (!("data" in result)) throw new Error(result.error);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ id: "s-1" });
  });

  it("uses a generous default take to avoid silent capping", async () => {
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-1", name: "Birth Cert", isRequired: true, appliesTo: "ALL", status: "ACTIVE" },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([] as never);

    await listStudentsWithMissingDocsAction();
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 2000,
    }));
  });
});

describe("listStudentsWithExpiringDocsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns students with docs expiring inside the window", async () => {
    const soon = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-1", firstName: "A", lastName: "B", studentId: "S/1",
        studentDocuments: [{ id: "sd-1", expiresAt: soon, documentType: { name: "NHIS" } }] },
    ] as never);

    const result = await listStudentsWithExpiringDocsAction();
    if (!("data" in result)) throw new Error(result.error);
    expect(result.data).toHaveLength(1);
  });
});
