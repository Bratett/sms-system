"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

/**
 * CRUD for TeacherLicence rows. Every teaching-staff member at a Ghanaian
 * public school is supposed to hold a current NTC licence; this module
 * tracks that state and feeds the daily expiry worker that fires renewal
 * reminders.
 */

const CATEGORY_VALUES = ["BEGINNER", "PROFICIENT", "EXPERT", "LEAD"] as const;
const STATUS_VALUES = ["ACTIVE", "EXPIRED", "SUSPENDED", "REVOKED"] as const;

const createSchema = z.object({
  staffId: z.string().min(1),
  ntcNumber: z.string().min(3).max(50),
  category: z.enum(CATEGORY_VALUES),
  issuedAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  documentId: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const updateSchema = createSchema.partial().extend({
  status: z.enum(STATUS_VALUES).optional(),
});

export async function listTeacherLicencesAction(params?: {
  status?: string;
  staffId?: string;
  dueWithinDays?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TEACHER_LICENCE_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (params?.status) where.status = params.status;
  if (params?.staffId) where.staffId = params.staffId;
  if (params?.dueWithinDays && params.dueWithinDays > 0) {
    const cutoff = new Date(Date.now() + params.dueWithinDays * 24 * 60 * 60 * 1000);
    where.expiresAt = { lte: cutoff };
  }

  const rows = await db.teacherLicence.findMany({
    where,
    orderBy: { expiresAt: "asc" },
    take: 500,
  });

  // Hydrate staff names in a single round-trip.
  const staffIds = [...new Set(rows.map((r) => r.staffId))];
  const staff = staffIds.length
    ? await db.staff.findMany({
        where: { id: { in: staffIds } },
        select: { id: true, firstName: true, lastName: true, staffId: true },
      })
    : [];
  const staffMap = new Map(
    staff.map((s) => [s.id, { name: `${s.firstName} ${s.lastName}`, ref: s.staffId }]),
  );

  return {
    data: rows.map((r) => ({
      id: r.id,
      staffId: r.staffId,
      staffName: staffMap.get(r.staffId)?.name ?? "Unknown",
      staffRef: staffMap.get(r.staffId)?.ref ?? "",
      ntcNumber: r.ntcNumber,
      category: r.category,
      issuedAt: r.issuedAt,
      expiresAt: r.expiresAt,
      status: r.status,
      documentId: r.documentId,
      notes: r.notes,
      daysToExpiry: Math.ceil(
        (r.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    })),
  };
}

export async function createTeacherLicenceAction(
  input: z.input<typeof createSchema>,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TEACHER_LICENCE_MANAGE);
  if (denied) return denied;

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  if (parsed.data.expiresAt <= parsed.data.issuedAt) {
    return { error: "Expiry date must be after issue date." };
  }

  const staff = await db.staff.findUnique({
    where: { id: parsed.data.staffId },
    select: { id: true, schoolId: true },
  });
  if (!staff || staff.schoolId !== ctx.schoolId) {
    return { error: "Staff not found." };
  }

  try {
    const row = await db.teacherLicence.create({
      data: {
        schoolId: ctx.schoolId,
        staffId: parsed.data.staffId,
        ntcNumber: parsed.data.ntcNumber.trim().toUpperCase(),
        category: parsed.data.category,
        issuedAt: parsed.data.issuedAt,
        expiresAt: parsed.data.expiresAt,
        documentId: parsed.data.documentId ?? null,
        notes: parsed.data.notes ?? null,
      },
    });

    await audit({
      userId: ctx.session.user.id,
      schoolId: ctx.schoolId,
      action: "CREATE",
      entity: "TeacherLicence",
      entityId: row.id,
      module: "hr",
      description: `Issued NTC licence ${row.ntcNumber} to staff ${parsed.data.staffId}`,
      newData: row,
    });

    revalidatePath("/hr/licences");
    return { data: row };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique")) {
      return { error: "An NTC licence with that number already exists." };
    }
    throw err;
  }
}

export async function updateTeacherLicenceAction(
  id: string,
  input: z.input<typeof updateSchema>,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TEACHER_LICENCE_MANAGE);
  if (denied) return denied;

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.teacherLicence.findUnique({ where: { id } });
  if (!existing || existing.schoolId !== ctx.schoolId) {
    return { error: "Licence not found." };
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.ntcNumber !== undefined) {
    data.ntcNumber = parsed.data.ntcNumber?.trim().toUpperCase();
  }
  if (parsed.data.category !== undefined) data.category = parsed.data.category;
  if (parsed.data.issuedAt !== undefined) data.issuedAt = parsed.data.issuedAt;
  if (parsed.data.expiresAt !== undefined) data.expiresAt = parsed.data.expiresAt;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.documentId !== undefined) data.documentId = parsed.data.documentId;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

  const row = await db.teacherLicence.update({ where: { id }, data });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "TeacherLicence",
    entityId: id,
    module: "hr",
    description: `Updated NTC licence ${existing.ntcNumber}`,
    previousData: existing,
    newData: row,
  });

  revalidatePath("/hr/licences");
  return { data: row };
}

export async function deleteTeacherLicenceAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TEACHER_LICENCE_MANAGE);
  if (denied) return denied;

  const existing = await db.teacherLicence.findUnique({ where: { id } });
  if (!existing || existing.schoolId !== ctx.schoolId) {
    return { error: "Licence not found." };
  }

  await db.teacherLicence.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "DELETE",
    entity: "TeacherLicence",
    entityId: id,
    module: "hr",
    description: `Deleted NTC licence ${existing.ntcNumber}`,
    previousData: existing,
  });

  revalidatePath("/hr/licences");
  return { success: true };
}
