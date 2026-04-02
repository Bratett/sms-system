import { describe, it, expect, beforeEach } from "vitest";
import {
  prismaMock,
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "../setup";

import {
  createDocumentAction,
  getDocumentsAction,
  deleteDocumentAction,
  archiveDocumentAction,
} from "@/modules/documents/actions/document.action";

// ─── Create Document ───────────────────────────────────────────────

describe("createDocumentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createDocumentAction({
      title: "Test Document",
      fileKey: "uploads/test.pdf",
      fileName: "test.pdf",
      fileSize: 1024,
      contentType: "application/pdf",
      category: "POLICY",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no school configured", async () => {
    mockAuthenticatedUser({ schoolId: null });
    const result = await createDocumentAction({
      title: "Test Document",
      fileKey: "uploads/test.pdf",
      fileName: "test.pdf",
      fileSize: 1024,
      contentType: "application/pdf",
      category: "POLICY",
    });
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should create document successfully", async () => {
    prismaMock.document.create.mockResolvedValue({
      id: "doc-1",
      schoolId: "default-school",
      title: "Test Document",
      fileKey: "uploads/test.pdf",
      fileName: "test.pdf",
      fileSize: 1024,
      contentType: "application/pdf",
      category: "POLICY",
      tags: [],
      description: null,
      entityType: null,
      entityId: null,
      uploadedBy: "test-user-id",
      accessLevel: "STAFF",
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await createDocumentAction({
      title: "Test Document",
      fileKey: "uploads/test.pdf",
      fileName: "test.pdf",
      fileSize: 1024,
      contentType: "application/pdf",
      category: "POLICY",
    });

    expect(result).toHaveProperty("data");
    expect((result as { data: { id: string } }).data.id).toBe("doc-1");
  });

  it("should create document with optional fields", async () => {
    prismaMock.document.create.mockResolvedValue({
      id: "doc-1",
      title: "Test Document",
      tags: ["important", "policy"],
      entityType: "student",
      entityId: "stu-1",
      accessLevel: "PUBLIC",
    } as never);

    const result = await createDocumentAction({
      title: "Test Document",
      fileKey: "uploads/test.pdf",
      fileName: "test.pdf",
      fileSize: 1024,
      contentType: "application/pdf",
      category: "POLICY",
      tags: ["important", "policy"],
      entityType: "student",
      entityId: "stu-1",
      accessLevel: "PUBLIC",
    });

    expect(result).toHaveProperty("data");
  });
});

// ─── Get Documents ─────────────────────────────────────────────────

describe("getDocumentsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getDocumentsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no school configured", async () => {
    mockAuthenticatedUser({ schoolId: null });
    const result = await getDocumentsAction();
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should return paginated documents", async () => {
    prismaMock.document.findMany.mockResolvedValue([
      {
        id: "doc-1",
        title: "Policy",
        fileName: "policy.pdf",
        category: "POLICY",
        createdAt: new Date(),
      },
    ] as never);
    prismaMock.document.count.mockResolvedValue(1 as never);

    const result = await getDocumentsAction();
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
    expect((result as { data: unknown[] }).data).toHaveLength(1);
  });

  it("should apply filters for category and search", async () => {
    prismaMock.document.findMany.mockResolvedValue([] as never);
    prismaMock.document.count.mockResolvedValue(0 as never);

    const result = await getDocumentsAction({
      category: "POLICY",
      search: "handbook",
      page: 2,
      pageSize: 10,
    });

    expect(result).toHaveProperty("pagination");
    expect((result as { pagination: { page: number } }).pagination.page).toBe(2);
  });
});

// ─── Delete Document ───────────────────────────────────────────────

describe("deleteDocumentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteDocumentAction("doc-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if document not found", async () => {
    prismaMock.document.findUnique.mockResolvedValue(null);
    const result = await deleteDocumentAction("nonexistent");
    expect(result).toEqual({ error: "Document not found" });
  });

  it("should delete document successfully", async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: "doc-1",
      title: "Test Document",
    } as never);
    prismaMock.document.delete.mockResolvedValue({ id: "doc-1" } as never);

    const result = await deleteDocumentAction("doc-1");
    expect(result).toHaveProperty("data");
    expect((result as { data: { success: boolean } }).data.success).toBe(true);
  });
});

// ─── Archive Document ──────────────────────────────────────────────

describe("archiveDocumentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await archiveDocumentAction("doc-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should archive document successfully", async () => {
    prismaMock.document.update.mockResolvedValue({
      id: "doc-1",
      title: "Test Document",
      isArchived: true,
    } as never);

    const result = await archiveDocumentAction("doc-1");
    expect(result).toHaveProperty("data");
    expect((result as { data: { isArchived: boolean } }).data.isArchived).toBe(true);
  });
});
