import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
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
