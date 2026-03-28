"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function getGradingScalesAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const scales = await db.gradingScale.findMany({
    where: { schoolId: school.id },
    orderBy: { name: "asc" },
    include: {
      gradeDefinitions: {
        orderBy: { minScore: "desc" },
      },
    },
  });

  const data = scales.map((scale) => ({
    id: scale.id,
    name: scale.name,
    isDefault: scale.isDefault,
    gradeCount: scale.gradeDefinitions.length,
    gradeDefinitions: scale.gradeDefinitions.map((gd) => ({
      id: gd.id,
      grade: gd.grade,
      minScore: gd.minScore,
      maxScore: gd.maxScore,
      interpretation: gd.interpretation,
      gradePoint: gd.gradePoint,
    })),
    createdAt: scale.createdAt,
    updatedAt: scale.updatedAt,
  }));

  return { data };
}

export async function getGradingScaleAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const scale = await db.gradingScale.findUnique({
    where: { id },
    include: {
      gradeDefinitions: {
        orderBy: { minScore: "desc" },
      },
    },
  });

  if (!scale) {
    return { error: "Grading scale not found." };
  }

  const data = {
    id: scale.id,
    name: scale.name,
    isDefault: scale.isDefault,
    gradeDefinitions: scale.gradeDefinitions.map((gd) => ({
      id: gd.id,
      grade: gd.grade,
      minScore: gd.minScore,
      maxScore: gd.maxScore,
      interpretation: gd.interpretation,
      gradePoint: gd.gradePoint,
    })),
    createdAt: scale.createdAt,
    updatedAt: scale.updatedAt,
  };

  return { data };
}

export async function createGradingScaleAction(data: {
  name: string;
  isDefault?: boolean;
  grades: Array<{
    grade: string;
    minScore: number;
    maxScore: number;
    interpretation: string;
    gradePoint: number;
  }>;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  if (!data.grades || data.grades.length === 0) {
    return { error: "At least one grade definition is required." };
  }

  // If setting as default, unset other defaults
  if (data.isDefault) {
    await db.gradingScale.updateMany({
      where: { schoolId: school.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  const scale = await db.gradingScale.create({
    data: {
      schoolId: school.id,
      name: data.name,
      isDefault: data.isDefault ?? false,
      gradeDefinitions: {
        create: data.grades.map((g) => ({
          grade: g.grade,
          minScore: g.minScore,
          maxScore: g.maxScore,
          interpretation: g.interpretation,
          gradePoint: g.gradePoint,
        })),
      },
    },
    include: {
      gradeDefinitions: true,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "GradingScale",
    entityId: scale.id,
    module: "school",
    description: `Created grading scale "${scale.name}" with ${data.grades.length} grade(s)`,
    newData: scale,
  });

  return { data: scale };
}

export async function updateGradingScaleAction(
  id: string,
  data: {
    name?: string;
    isDefault?: boolean;
    grades?: Array<{
      grade: string;
      minScore: number;
      maxScore: number;
      interpretation: string;
      gradePoint: number;
    }>;
  },
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const existing = await db.gradingScale.findUnique({
    where: { id },
    include: { gradeDefinitions: true },
  });

  if (!existing) {
    return { error: "Grading scale not found." };
  }

  const previousData = { ...existing };

  // If setting as default, unset other defaults
  if (data.isDefault) {
    await db.gradingScale.updateMany({
      where: { schoolId: school.id, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  // Delete old grade definitions and recreate if grades are provided
  if (data.grades && data.grades.length > 0) {
    await db.gradeDefinition.deleteMany({
      where: { gradingScaleId: id },
    });
  }

  const updated = await db.gradingScale.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      isDefault: data.isDefault ?? existing.isDefault,
      ...(data.grades && data.grades.length > 0
        ? {
            gradeDefinitions: {
              create: data.grades.map((g) => ({
                grade: g.grade,
                minScore: g.minScore,
                maxScore: g.maxScore,
                interpretation: g.interpretation,
                gradePoint: g.gradePoint,
              })),
            },
          }
        : {}),
    },
    include: {
      gradeDefinitions: true,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "GradingScale",
    entityId: id,
    module: "school",
    description: `Updated grading scale "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteGradingScaleAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const scale = await db.gradingScale.findUnique({
    where: { id },
    include: { gradeDefinitions: true },
  });

  if (!scale) {
    return { error: "Grading scale not found." };
  }

  if (scale.isDefault) {
    return { error: "Cannot delete the default grading scale. Set another scale as default first." };
  }

  await db.gradingScale.delete({
    where: { id },
  });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "GradingScale",
    entityId: id,
    module: "school",
    description: `Deleted grading scale "${scale.name}"`,
    previousData: scale,
  });

  return { success: true };
}

export async function setDefaultGradingScaleAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const scale = await db.gradingScale.findUnique({
    where: { id },
  });

  if (!scale) {
    return { error: "Grading scale not found." };
  }

  if (scale.isDefault) {
    return { error: "This scale is already the default." };
  }

  // Unset all current defaults
  await db.gradingScale.updateMany({
    where: { schoolId: school.id, isDefault: true },
    data: { isDefault: false },
  });

  // Set new default
  const updated = await db.gradingScale.update({
    where: { id },
    data: { isDefault: true },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "GradingScale",
    entityId: id,
    module: "school",
    description: `Set grading scale "${updated.name}" as default`,
    newData: updated,
  });

  return { data: updated };
}
