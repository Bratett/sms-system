"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Upload Document Metadata ──────────────────────────────────────

export async function createDocumentAction(data: {
  title: string;
  description?: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  category: string;
  tags?: string[];
  entityType?: string;
  entityId?: string;
  accessLevel?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DOCUMENTS_CREATE);
  if (denied) return denied;

  const document = await db.document.create({
    data: {
      schoolId: ctx.schoolId,
      title: data.title,
      description: data.description || null,
      fileKey: data.fileKey,
      fileName: data.fileName,
      fileSize: data.fileSize,
      contentType: data.contentType,
      category: data.category,
      tags: data.tags || [],
      entityType: data.entityType || null,
      entityId: data.entityId || null,
      uploadedBy: ctx.session.user.id,
      accessLevel: data.accessLevel || "STAFF",
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "Document",
    entityId: document.id,
    module: "documents",
    description: `Uploaded document: ${data.title}`,
    newData: document,
  });

  return { data: document };
}

// ─── Get Documents (paginated) ─────────────────────────────────────

export async function getDocumentsAction(filters?: {
  category?: string;
  entityType?: string;
  entityId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DOCUMENTS_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {
    schoolId: ctx.schoolId,
    isArchived: false,
  };

  if (filters?.category) where.category = filters.category;
  if (filters?.entityType) where.entityType = filters.entityType;
  if (filters?.entityId) where.entityId = filters.entityId;

  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { fileName: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [documents, total] = await Promise.all([
    db.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.document.count({ where }),
  ]);

  return {
    data: documents,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// ─── Delete Document ───────────────────────────────────────────────

export async function deleteDocumentAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DOCUMENTS_DELETE);
  if (denied) return denied;

  const document = await db.document.findUnique({ where: { id } });
  if (!document) return { error: "Document not found" };

  await db.document.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "Document",
    entityId: id,
    module: "documents",
    description: `Deleted document: ${document.title}`,
    previousData: document,
  });

  return { data: { success: true } };
}

// ─── Archive Document ──────────────────────────────────────────────

export async function archiveDocumentAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DOCUMENTS_CREATE);
  if (denied) return denied;

  const document = await db.document.update({
    where: { id },
    data: { isArchived: true },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "Document",
    entityId: id,
    module: "documents",
    description: `Archived document: ${document.title}`,
  });

  return { data: document };
}
