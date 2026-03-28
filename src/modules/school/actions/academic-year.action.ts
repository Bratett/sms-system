"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  createAcademicYearSchema,
  updateAcademicYearSchema,
  type CreateAcademicYearInput,
  type UpdateAcademicYearInput,
} from "@/modules/school/schemas/academic-year.schema";

export async function getAcademicYearsAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const academicYears = await db.academicYear.findMany({
    include: {
      terms: {
        orderBy: { termNumber: "asc" },
      },
    },
    orderBy: { startDate: "desc" },
  });

  const data = academicYears.map((ay) => ({
    ...ay,
    termCount: ay.terms.length,
  }));

  return { data };
}

export async function createAcademicYearAction(data: CreateAcademicYearInput) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const parsed = createAcademicYearSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "School not found. Please configure school settings first." };
  }

  const academicYear = await db.academicYear.create({
    data: {
      schoolId: school.id,
      name: parsed.data.name,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "AcademicYear",
    entityId: academicYear.id,
    module: "school",
    description: `Created academic year "${academicYear.name}"`,
    newData: academicYear,
  });

  return { data: academicYear };
}

export async function updateAcademicYearAction(id: string, data: UpdateAcademicYearInput) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const parsed = updateAcademicYearSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.academicYear.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Academic year not found" };
  }

  const previousData = { ...existing };

  const updated = await db.academicYear.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.startDate !== undefined && { startDate: new Date(parsed.data.startDate) }),
      ...(parsed.data.endDate !== undefined && { endDate: new Date(parsed.data.endDate) }),
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "AcademicYear",
    entityId: id,
    module: "school",
    description: `Updated academic year "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteAcademicYearAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const existing = await db.academicYear.findUnique({
    where: { id },
    include: { terms: true },
  });

  if (!existing) {
    return { error: "Academic year not found" };
  }

  if (existing.terms.length > 0) {
    return { error: "Cannot delete academic year that has terms. Remove all terms first." };
  }

  await db.academicYear.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "AcademicYear",
    entityId: id,
    module: "school",
    description: `Deleted academic year "${existing.name}"`,
    previousData: existing,
  });

  return { success: true };
}

export async function setCurrentAcademicYearAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const existing = await db.academicYear.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Academic year not found" };
  }

  // Unset all academic years as current, then set the selected one
  await db.$transaction([
    db.academicYear.updateMany({
      data: { isCurrent: false },
    }),
    db.academicYear.update({
      where: { id },
      data: { isCurrent: true, status: "ACTIVE" },
    }),
  ]);

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "AcademicYear",
    entityId: id,
    module: "school",
    description: `Set academic year "${existing.name}" as current`,
  });

  return { success: true };
}
