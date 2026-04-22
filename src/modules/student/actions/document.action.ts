"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  createDocumentTypeSchema,
  updateDocumentTypeSchema,
} from "../schemas/document.schema";

export async function listDocumentTypesAction(opts?: { status?: "ACTIVE" | "INACTIVE" }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DOCUMENT_TYPES_MANAGE);
  if (denied) return denied;

  const types = await db.documentType.findMany({
    where: {
      schoolId: ctx.schoolId,
      ...(opts?.status && { status: opts.status }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return { data: types };
}

export async function createDocumentTypeAction(input: {
  name: string;
  description?: string;
  isRequired?: boolean;
  expiryMonths?: number | null;
  appliesTo?: "ALL" | "BOARDING_ONLY" | "DAY_ONLY";
  sortOrder?: number;
}) {
  const parsed = createDocumentTypeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DOCUMENT_TYPES_MANAGE);
  if (denied) return denied;

  try {
    const type = await db.documentType.create({
      data: {
        schoolId: ctx.schoolId,
        name: parsed.data.name,
        description: parsed.data.description,
        isRequired: parsed.data.isRequired,
        expiryMonths: parsed.data.expiryMonths ?? null,
        appliesTo: parsed.data.appliesTo,
        sortOrder: parsed.data.sortOrder,
      },
    });

    await audit({
      userId: ctx.session.user.id!,
      action: "CREATE",
      entity: "DocumentType",
      entityId: type.id,
      module: "students",
      description: `Created document type: ${type.name}`,
    });

    return { data: type };
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002") {
      return { error: "A document type with this name already exists" };
    }
    throw err;
  }
}

export async function updateDocumentTypeAction(input: {
  id: string;
  name?: string;
  description?: string | null;
  isRequired?: boolean;
  expiryMonths?: number | null;
  appliesTo?: "ALL" | "BOARDING_ONLY" | "DAY_ONLY";
  sortOrder?: number;
}) {
  const parsed = updateDocumentTypeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DOCUMENT_TYPES_MANAGE);
  if (denied) return denied;

  const existing = await db.documentType.findFirst({
    where: { id: parsed.data.id, schoolId: ctx.schoolId },
  });
  if (!existing) return { error: "Document type not found" };

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.isRequired !== undefined) data.isRequired = parsed.data.isRequired;
  if (parsed.data.expiryMonths !== undefined) data.expiryMonths = parsed.data.expiryMonths;
  if (parsed.data.appliesTo !== undefined) data.appliesTo = parsed.data.appliesTo;
  if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;

  const updated = await db.documentType.update({ where: { id: parsed.data.id }, data });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "DocumentType",
    entityId: parsed.data.id,
    module: "students",
    description: `Updated document type: ${updated.name}`,
    previousData: existing as unknown as Record<string, unknown>,
    newData: data,
  });

  return { data: updated };
}

// Hard delete is intentionally not exposed — always soft-delete to preserve FK
// integrity on historical StudentDocument rows.
export async function deactivateDocumentTypeAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DOCUMENT_TYPES_MANAGE);
  if (denied) return denied;

  const existing = await db.documentType.findFirst({
    where: { id, schoolId: ctx.schoolId },
  });
  if (!existing) return { error: "Document type not found" };

  // Called for reporting only — still soft-delete even if count > 0.
  await db.studentDocument.count({ where: { documentTypeId: id } });

  const updated = await db.documentType.update({
    where: { id },
    data: { status: "INACTIVE" },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "DocumentType",
    entityId: id,
    module: "students",
    description: `Deactivated document type: ${existing.name}`,
    previousData: { status: existing.status },
    newData: { status: "INACTIVE" },
  });

  return { data: updated };
}

const EXPIRING_SOON_DAYS = 30;

export async function listStudentDocumentsAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_DOCUMENTS_READ);
  if (denied) return denied;

  const documents = await db.studentDocument.findMany({
    where: { studentId, schoolId: ctx.schoolId },
    include: {
      documentType: { select: { id: true, name: true, isRequired: true, appliesTo: true } },
    },
    orderBy: [{ uploadedAt: "desc" }],
  });

  const now = Date.now();
  const soonMs = EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;

  const withFlags = documents.map((d) => {
    const expTime = d.expiresAt?.getTime();
    const isExpired = expTime !== undefined && expTime <= now;
    const isExpiringSoon = !isExpired && expTime !== undefined && expTime - now <= soonMs;
    return { ...d, isExpired, isExpiringSoon };
  });

  return { data: withFlags };
}

export async function getMissingRequiredDocumentsAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_DOCUMENTS_READ);
  if (denied) return denied;

  const student = await db.student.findFirst({
    where: { id: studentId, schoolId: ctx.schoolId },
    select: { id: true, boardingStatus: true },
  });
  if (!student) return { error: "Student not found" };

  const requiredTypes = await db.documentType.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: "ACTIVE",
      isRequired: true,
      OR: [
        { appliesTo: "ALL" },
        { appliesTo: student.boardingStatus === "BOARDING" ? "BOARDING_ONLY" : "DAY_ONLY" },
      ],
    },
  });

  const documents = await db.studentDocument.findMany({
    where: { studentId, schoolId: ctx.schoolId },
    select: { documentTypeId: true, verificationStatus: true, expiresAt: true },
  });

  const now = Date.now();
  const satisfiedTypeIds = new Set<string>();
  for (const doc of documents) {
    if (doc.verificationStatus !== "VERIFIED") continue;
    const expTime = doc.expiresAt?.getTime();
    if (expTime !== undefined && expTime <= now) continue;
    satisfiedTypeIds.add(doc.documentTypeId);
  }

  const missing = requiredTypes.filter((t) => !satisfiedTypeIds.has(t.id));

  return { data: { required: requiredTypes, missing } };
}
