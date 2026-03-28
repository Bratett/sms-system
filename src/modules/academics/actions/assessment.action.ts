"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Assessment Types ────────────────────────────────────────────────

export async function getAssessmentTypesAction(termId?: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const where: Record<string, unknown> = { schoolId: school.id };
  if (termId) {
    where.termId = termId;
  }

  const assessmentTypes = await db.assessmentType.findMany({
    where,
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: { marks: true },
      },
    },
  });

  const data = assessmentTypes.map((at) => ({
    id: at.id,
    name: at.name,
    code: at.code,
    category: at.category,
    weight: at.weight,
    maxScore: at.maxScore,
    termId: at.termId,
    markCount: at._count.marks,
    createdAt: at.createdAt,
    updatedAt: at.updatedAt,
  }));

  return { data };
}

export async function createAssessmentTypeAction(data: {
  name: string;
  code?: string;
  weight: number;
  maxScore: number;
  termId?: string;
  category: "CLASSWORK" | "HOMEWORK" | "PROJECT" | "MIDTERM" | "END_OF_TERM";
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  // Validate weight
  if (data.weight < 0 || data.weight > 100) {
    return { error: "Weight must be between 0 and 100." };
  }

  if (data.maxScore <= 0) {
    return { error: "Max score must be greater than 0." };
  }

  // Check total weight doesn't exceed 100% for the term
  if (data.termId) {
    const existingTypes = await db.assessmentType.findMany({
      where: { schoolId: school.id, termId: data.termId },
      select: { weight: true },
    });

    const currentTotalWeight = existingTypes.reduce(
      (sum, t) => sum + t.weight,
      0,
    );

    if (currentTotalWeight + data.weight > 100) {
      return {
        error: `Total weight would be ${currentTotalWeight + data.weight}%. Cannot exceed 100% for a term. Current total: ${currentTotalWeight}%.`,
      };
    }
  }

  // Check for duplicate name within same school and term
  const existing = await db.assessmentType.findUnique({
    where: {
      schoolId_name_termId: {
        schoolId: school.id,
        name: data.name,
        termId: data.termId ?? "",
      },
    },
  });

  if (existing) {
    return {
      error: `An assessment type named "${data.name}" already exists${data.termId ? " for this term" : ""}.`,
    };
  }

  const assessmentType = await db.assessmentType.create({
    data: {
      schoolId: school.id,
      name: data.name,
      code: data.code || null,
      weight: data.weight,
      maxScore: data.maxScore,
      termId: data.termId || null,
      category: data.category,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "AssessmentType",
    entityId: assessmentType.id,
    module: "academics",
    description: `Created assessment type "${assessmentType.name}" (${assessmentType.category}, weight: ${assessmentType.weight}%)`,
    newData: assessmentType,
  });

  return { data: assessmentType };
}

export async function updateAssessmentTypeAction(
  id: string,
  data: {
    name?: string;
    code?: string;
    weight?: number;
    maxScore?: number;
    termId?: string;
    category?:
      | "CLASSWORK"
      | "HOMEWORK"
      | "PROJECT"
      | "MIDTERM"
      | "END_OF_TERM";
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

  const existing = await db.assessmentType.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Assessment type not found." };
  }

  // Validate weight if being updated
  const newWeight = data.weight ?? existing.weight;
  if (newWeight < 0 || newWeight > 100) {
    return { error: "Weight must be between 0 and 100." };
  }

  // Validate max score if being updated
  const newMaxScore = data.maxScore ?? existing.maxScore;
  if (newMaxScore <= 0) {
    return { error: "Max score must be greater than 0." };
  }

  // Check total weight doesn't exceed 100% for the term
  const termId = data.termId !== undefined ? data.termId : existing.termId;
  if (termId) {
    const existingTypes = await db.assessmentType.findMany({
      where: {
        schoolId: school.id,
        termId,
        id: { not: id },
      },
      select: { weight: true },
    });

    const otherTotalWeight = existingTypes.reduce(
      (sum, t) => sum + t.weight,
      0,
    );

    if (otherTotalWeight + newWeight > 100) {
      return {
        error: `Total weight would be ${otherTotalWeight + newWeight}%. Cannot exceed 100% for a term. Other types total: ${otherTotalWeight}%.`,
      };
    }
  }

  // Check for duplicate name if name is being changed
  if (data.name && data.name !== existing.name) {
    const duplicate = await db.assessmentType.findFirst({
      where: {
        schoolId: school.id,
        name: data.name,
        termId: termId ?? null,
        id: { not: id },
      },
    });
    if (duplicate) {
      return {
        error: `An assessment type named "${data.name}" already exists for this term.`,
      };
    }
  }

  const previousData = { ...existing };

  const updated = await db.assessmentType.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      code: data.code !== undefined ? data.code || null : existing.code,
      weight: newWeight,
      maxScore: newMaxScore,
      termId: termId || null,
      category: data.category ?? existing.category,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "AssessmentType",
    entityId: id,
    module: "academics",
    description: `Updated assessment type "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteAssessmentTypeAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const existing = await db.assessmentType.findUnique({
    where: { id },
    include: {
      _count: { select: { marks: true } },
    },
  });

  if (!existing) {
    return { error: "Assessment type not found." };
  }

  if (existing._count.marks > 0) {
    return {
      error: `Cannot delete assessment type "${existing.name}" because it has ${existing._count.marks} mark(s) recorded. Remove all marks first.`,
    };
  }

  await db.assessmentType.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "AssessmentType",
    entityId: id,
    module: "academics",
    description: `Deleted assessment type "${existing.name}"`,
    previousData: existing,
  });

  return { success: true };
}
