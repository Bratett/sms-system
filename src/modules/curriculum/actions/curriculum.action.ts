"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Curriculum Frameworks ──────────────────────────────────────────

export async function getFrameworksAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const frameworks = await db.curriculumFramework.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { standards: true, schoolCurricula: true } },
    },
  });

  return { data: frameworks };
}

export async function getFrameworkAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const framework = await db.curriculumFramework.findUnique({
    where: { id },
    include: {
      standards: {
        orderBy: [{ subject: "asc" }, { gradeLevel: "asc" }, { code: "asc" }],
        take: 100,
      },
      _count: { select: { standards: true } },
    },
  });

  if (!framework) return { error: "Curriculum framework not found" };
  return { data: framework };
}

export async function createFrameworkAction(data: {
  code: string;
  name: string;
  description?: string;
  country?: string;
  organization?: string;
  gradeLevels?: string[];
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  if (!data.code?.trim() || !data.name?.trim()) {
    return { error: "Code and name are required" };
  }

  const existing = await db.curriculumFramework.findUnique({
    where: { code: data.code.trim().toUpperCase() },
  });
  if (existing) return { error: `Framework with code "${data.code}" already exists` };

  const framework = await db.curriculumFramework.create({
    data: {
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      description: data.description?.trim() || null,
      country: data.country?.trim() || null,
      organization: data.organization?.trim() || null,
      gradeLevels: data.gradeLevels ?? [],
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "CurriculumFramework",
    entityId: framework.id,
    module: "curriculum",
    description: `Created curriculum framework "${framework.name}" (${framework.code})`,
    newData: framework,
  });

  return { data: framework };
}

// ─── Curriculum Standards ───────────────────────────────────────────

export async function getStandardsAction(filters: {
  frameworkId: string;
  subject?: string;
  gradeLevel?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;

  const where: Record<string, unknown> = { frameworkId: filters.frameworkId };
  if (filters.subject) where.subject = filters.subject;
  if (filters.gradeLevel) where.gradeLevel = filters.gradeLevel;
  if (filters.search) {
    where.OR = [
      { code: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [standards, total] = await Promise.all([
    db.curriculumStandard.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ subject: "asc" }, { gradeLevel: "asc" }, { code: "asc" }],
    }),
    db.curriculumStandard.count({ where }),
  ]);

  return { data: standards, total, page, pageSize };
}

export async function createStandardAction(data: {
  frameworkId: string;
  code: string;
  subject: string;
  gradeLevel: string;
  strand?: string;
  subStrand?: string;
  description: string;
  learningOutcome?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const framework = await db.curriculumFramework.findUnique({
    where: { id: data.frameworkId },
  });
  if (!framework) return { error: "Curriculum framework not found" };

  const standard = await db.curriculumStandard.create({
    data: {
      frameworkId: data.frameworkId,
      code: data.code.trim(),
      subject: data.subject.trim(),
      gradeLevel: data.gradeLevel.trim(),
      strand: data.strand?.trim() || null,
      subStrand: data.subStrand?.trim() || null,
      description: data.description.trim(),
      learningOutcome: data.learningOutcome?.trim() || null,
    },
  });

  return { data: standard };
}

export async function bulkImportStandardsAction(data: {
  frameworkId: string;
  standards: Array<{
    code: string;
    subject: string;
    gradeLevel: string;
    strand?: string;
    subStrand?: string;
    description: string;
    learningOutcome?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const framework = await db.curriculumFramework.findUnique({
    where: { id: data.frameworkId },
  });
  if (!framework) return { error: "Curriculum framework not found" };

  if (data.standards.length === 0) return { error: "No standards provided" };

  const records = data.standards.map((s) => ({
    frameworkId: data.frameworkId,
    code: s.code.trim(),
    subject: s.subject.trim(),
    gradeLevel: s.gradeLevel.trim(),
    strand: s.strand?.trim() || null,
    subStrand: s.subStrand?.trim() || null,
    description: s.description.trim(),
    learningOutcome: s.learningOutcome?.trim() || null,
  }));

  const result = await db.curriculumStandard.createMany({
    data: records,
    skipDuplicates: true,
  });

  await audit({
    userId: session.user.id!,
    action: "IMPORT",
    entity: "CurriculumStandard",
    module: "curriculum",
    description: `Imported ${result.count} standards for ${framework.name}`,
    metadata: { frameworkId: data.frameworkId, imported: result.count, attempted: data.standards.length },
  });

  return { data: { imported: result.count } };
}

// ─── School Curriculum Assignment ───────────────────────────────────

export async function getSchoolCurriculaAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const curricula = await db.schoolCurriculum.findMany({
    where: { schoolId: school.id },
    include: {
      framework: {
        select: { id: true, code: true, name: true, country: true, organization: true },
      },
    },
    orderBy: { activatedAt: "desc" },
  });

  return { data: curricula };
}

export async function assignCurriculumAction(data: {
  frameworkId: string;
  isPrimary?: boolean;
  customConfig?: Record<string, unknown>;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const framework = await db.curriculumFramework.findUnique({
    where: { id: data.frameworkId },
  });
  if (!framework) return { error: "Curriculum framework not found" };

  // If setting as primary, unset existing primary
  if (data.isPrimary) {
    await db.schoolCurriculum.updateMany({
      where: { schoolId: school.id, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const curriculum = await db.schoolCurriculum.upsert({
    where: {
      schoolId_frameworkId: {
        schoolId: school.id,
        frameworkId: data.frameworkId,
      },
    },
    create: {
      schoolId: school.id,
      frameworkId: data.frameworkId,
      isPrimary: data.isPrimary ?? false,
      customConfig: (data.customConfig ?? undefined) as import("@prisma/client").Prisma.InputJsonValue | undefined,
    },
    update: {
      isPrimary: data.isPrimary ?? false,
      customConfig: (data.customConfig ?? undefined) as import("@prisma/client").Prisma.InputJsonValue | undefined,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "SchoolCurriculum",
    entityId: curriculum.id,
    module: "curriculum",
    description: `Assigned curriculum "${framework.name}" to school${data.isPrimary ? " (primary)" : ""}`,
  });

  return { data: curriculum };
}

export async function removeCurriculumAction(frameworkId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  await db.schoolCurriculum.deleteMany({
    where: { schoolId: school.id, frameworkId },
  });

  return { success: true };
}

// ─── Grading Templates ──────────────────────────────────────────────

export async function getGradingTemplatesAction(frameworkId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const templates = await db.gradingTemplate.findMany({
    where: { frameworkId },
    orderBy: { name: "asc" },
  });

  return { data: templates };
}

export async function createGradingTemplateAction(data: {
  frameworkId: string;
  name: string;
  assessmentWeights: Record<string, number>;
  gradeScale: Array<{ grade: string; min: number; max: number; gpa?: number }>;
  passThreshold?: number;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const framework = await db.curriculumFramework.findUnique({
    where: { id: data.frameworkId },
  });
  if (!framework) return { error: "Framework not found" };

  // Validate weights sum to 100
  const totalWeight = Object.values(data.assessmentWeights).reduce((a, b) => a + b, 0);
  if (totalWeight !== 100) {
    return { error: `Assessment weights must sum to 100 (got ${totalWeight})` };
  }

  const template = await db.gradingTemplate.create({
    data: {
      frameworkId: data.frameworkId,
      name: data.name.trim(),
      assessmentWeights: data.assessmentWeights,
      gradeScale: data.gradeScale,
      passThreshold: data.passThreshold ?? 50,
    },
  });

  return { data: template };
}

// ─── Report Templates ───────────────────────────────────────────────

export async function getReportTemplatesAction(frameworkId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const templates = await db.reportTemplate.findMany({
    where: { frameworkId },
    orderBy: { name: "asc" },
  });

  return { data: templates };
}

export async function createReportTemplateAction(data: {
  frameworkId: string;
  name: string;
  type?: string;
  layout: Record<string, unknown>;
  sections: Array<{ name: string; enabled: boolean; order: number }>;
  headerConfig?: Record<string, unknown>;
  isDefault?: boolean;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const template = await db.reportTemplate.create({
    data: {
      frameworkId: data.frameworkId,
      name: data.name.trim(),
      type: (data.type as "TERMINAL" | "ANNUAL" | "TRANSCRIPT" | "PROGRESS") || "TERMINAL",
      layout: data.layout as import("@prisma/client").Prisma.InputJsonValue,
      sections: data.sections as unknown as import("@prisma/client").Prisma.InputJsonValue,
      headerConfig: (data.headerConfig ?? undefined) as import("@prisma/client").Prisma.InputJsonValue | undefined,
      isDefault: data.isDefault ?? false,
    },
  });

  return { data: template };
}
