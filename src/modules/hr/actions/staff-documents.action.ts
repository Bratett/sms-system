"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { deleteFile } from "@/lib/storage/r2";
import { z } from "zod";

// ─── Schema ─────────────────────────────────────────────────

const DOCUMENT_CATEGORIES = [
  "CONTRACT",
  "CERTIFICATE",
  "ID_SCAN",
  "QUALIFICATION",
  "LETTER",
  "OTHER",
] as const;

const uploadStaffDocumentSchema = z.object({
  staffId: z.string().min(1, "Staff ID is required"),
  title: z.string().min(1, "Title is required"),
  category: z.enum(DOCUMENT_CATEGORIES, { message: "Invalid document category" }),
  fileKey: z.string().min(1, "File key is required"),
  fileName: z.string().min(1, "File name is required"),
  fileSize: z.number().int().min(1),
  contentType: z.string().min(1),
});

type UploadStaffDocumentInput = z.infer<typeof uploadStaffDocumentSchema>;

// ─── Actions ────────────────────────────────────────────────

export async function getStaffDocumentsAction(staffId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const documents = await db.document.findMany({
    where: {
      entityType: "Staff",
      entityId: staffId,
    },
    orderBy: { createdAt: "desc" },
  });

  return { data: documents };
}

export async function uploadStaffDocumentAction(data: UploadStaffDocumentInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = uploadStaffDocumentSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const staff = await db.staff.findUnique({ where: { id: parsed.data.staffId } });
  if (!staff) return { error: "Staff member not found." };

  const document = await db.document.create({
    data: {
      schoolId: school.id,
      title: parsed.data.title,
      category: parsed.data.category,
      fileKey: parsed.data.fileKey,
      fileName: parsed.data.fileName,
      fileSize: parsed.data.fileSize,
      contentType: parsed.data.contentType,
      entityType: "Staff",
      entityId: parsed.data.staffId,
      uploadedBy: session.user.id!,
      accessLevel: "STAFF",
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Document",
    entityId: document.id,
    module: "hr",
    description: `Uploaded document "${parsed.data.title}" for staff "${staff.firstName} ${staff.lastName}"`,
    newData: document,
  });

  return { data: document };
}

export async function deleteStaffDocumentAction(documentId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const document = await db.document.findUnique({ where: { id: documentId } });
  if (!document) return { error: "Document not found." };

  if (document.entityType !== "Staff") {
    return { error: "Document does not belong to a staff member." };
  }

  // Delete file from R2 storage
  try {
    await deleteFile(document.fileKey);
  } catch {
    // Log but continue — file may already be deleted
  }

  await db.document.delete({ where: { id: documentId } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "Document",
    entityId: documentId,
    module: "hr",
    description: `Deleted staff document "${document.title}"`,
    previousData: document,
  });

  return { success: true };
}
