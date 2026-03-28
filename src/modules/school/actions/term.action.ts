"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  createTermSchema,
  updateTermSchema,
  type CreateTermInput,
  type UpdateTermInput,
} from "@/modules/school/schemas/term.schema";

export async function getTermsAction(academicYearId?: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const terms = await db.term.findMany({
    where: academicYearId ? { academicYearId } : undefined,
    include: {
      academicYear: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ academicYear: { startDate: "desc" } }, { termNumber: "asc" }],
  });

  return { data: terms };
}

export async function createTermAction(data: CreateTermInput) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const parsed = createTermSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  // Check academic year exists
  const academicYear = await db.academicYear.findUnique({
    where: { id: parsed.data.academicYearId },
  });
  if (!academicYear) {
    return { error: "Academic year not found" };
  }

  // Check for duplicate term number in same academic year
  const duplicate = await db.term.findFirst({
    where: {
      academicYearId: parsed.data.academicYearId,
      termNumber: parsed.data.termNumber,
    },
  });
  if (duplicate) {
    return {
      error: `Term ${parsed.data.termNumber} already exists for ${academicYear.name}`,
    };
  }

  const term = await db.term.create({
    data: {
      academicYearId: parsed.data.academicYearId,
      name: parsed.data.name,
      termNumber: parsed.data.termNumber,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Term",
    entityId: term.id,
    module: "school",
    description: `Created term "${term.name}" for academic year "${academicYear.name}"`,
    newData: term,
  });

  return { data: term };
}

export async function updateTermAction(id: string, data: UpdateTermInput) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const parsed = updateTermSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.term.findUnique({
    where: { id },
    include: { academicYear: { select: { name: true } } },
  });
  if (!existing) {
    return { error: "Term not found" };
  }

  // Check for duplicate term number if termNumber is being updated
  if (parsed.data.termNumber !== undefined && parsed.data.termNumber !== existing.termNumber) {
    const duplicate = await db.term.findFirst({
      where: {
        academicYearId: existing.academicYearId,
        termNumber: parsed.data.termNumber,
        id: { not: id },
      },
    });
    if (duplicate) {
      return {
        error: `Term ${parsed.data.termNumber} already exists for ${existing.academicYear.name}`,
      };
    }
  }

  const previousData = { ...existing };

  const updated = await db.term.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.termNumber !== undefined && { termNumber: parsed.data.termNumber }),
      ...(parsed.data.startDate !== undefined && { startDate: new Date(parsed.data.startDate) }),
      ...(parsed.data.endDate !== undefined && { endDate: new Date(parsed.data.endDate) }),
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Term",
    entityId: id,
    module: "school",
    description: `Updated term "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteTermAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const existing = await db.term.findUnique({
    where: { id },
    include: { academicYear: { select: { name: true } } },
  });
  if (!existing) {
    return { error: "Term not found" };
  }

  await db.term.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "Term",
    entityId: id,
    module: "school",
    description: `Deleted term "${existing.name}" from academic year "${existing.academicYear.name}"`,
    previousData: existing,
  });

  return { success: true };
}

export async function setCurrentTermAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const existing = await db.term.findUnique({
    where: { id },
    include: { academicYear: { select: { id: true, name: true } } },
  });
  if (!existing) {
    return { error: "Term not found" };
  }

  // Unset all terms as current, set selected one, and ensure parent academic year is also current
  await db.$transaction([
    db.term.updateMany({
      data: { isCurrent: false },
    }),
    db.term.update({
      where: { id },
      data: { isCurrent: true, status: "ACTIVE" },
    }),
    db.academicYear.updateMany({
      data: { isCurrent: false },
    }),
    db.academicYear.update({
      where: { id: existing.academicYearId },
      data: { isCurrent: true, status: "ACTIVE" },
    }),
  ]);

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Term",
    entityId: id,
    module: "school",
    description: `Set term "${existing.name}" as current term (academic year "${existing.academicYear.name}" also set as current)`,
  });

  return { success: true };
}
