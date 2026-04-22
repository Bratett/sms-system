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
