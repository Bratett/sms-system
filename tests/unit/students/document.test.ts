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
