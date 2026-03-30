"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function getCoursesAction(filters: {
  search?: string;
  status?: string;
  teacherId?: string;
  classArmId?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  const where: Record<string, unknown> = { schoolId: school.id };
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters.status) where.status = filters.status;
  if (filters.teacherId) where.teacherId = filters.teacherId;
  if (filters.classArmId) where.classArmId = filters.classArmId;

  const [courses, total] = await Promise.all([
    db.course.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { lessons: true, assignments: true, enrollments: true } },
      },
    }),
    db.course.count({ where }),
  ]);

  return { data: courses, total, page, pageSize };
}

export async function getCourseAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const course = await db.course.findUnique({
    where: { id },
    include: {
      lessons: { orderBy: { orderIndex: "asc" } },
      assignments: { orderBy: { createdAt: "desc" } },
      _count: { select: { enrollments: true } },
    },
  });

  if (!course) return { error: "Course not found" };
  return { data: course };
}

export async function createCourseAction(data: {
  title: string;
  description?: string;
  subjectId?: string;
  classArmId?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  if (!data.title?.trim()) return { error: "Course title is required" };

  const course = await db.course.create({
    data: {
      schoolId: school.id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      subjectId: data.subjectId || null,
      classArmId: data.classArmId || null,
      teacherId: session.user.id!,
      status: "DRAFT",
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Course",
    entityId: course.id,
    module: "lms",
    description: `Created course "${course.title}"`,
    newData: course,
  });

  return { data: course };
}

export async function updateCourseAction(id: string, data: {
  title?: string;
  description?: string;
  subjectId?: string;
  classArmId?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const existing = await db.course.findUnique({ where: { id } });
  if (!existing) return { error: "Course not found" };

  const updated = await db.course.update({
    where: { id },
    data: {
      title: data.title?.trim() ?? existing.title,
      description: data.description !== undefined ? (data.description?.trim() || null) : existing.description,
      subjectId: data.subjectId !== undefined ? (data.subjectId || null) : existing.subjectId,
      classArmId: data.classArmId !== undefined ? (data.classArmId || null) : existing.classArmId,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Course",
    entityId: id,
    module: "lms",
    description: `Updated course "${updated.title}"`,
    previousData: existing,
    newData: updated,
  });

  return { data: updated };
}

export async function publishCourseAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const course = await db.course.findUnique({
    where: { id },
    include: { _count: { select: { lessons: true } } },
  });

  if (!course) return { error: "Course not found" };
  if (course._count.lessons === 0) return { error: "Course must have at least one lesson before publishing" };

  const updated = await db.course.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Course",
    entityId: id,
    module: "lms",
    description: `Published course "${course.title}"`,
  });

  return { data: updated };
}

export async function archiveCourseAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const course = await db.course.findUnique({ where: { id } });
  if (!course) return { error: "Course not found" };

  const updated = await db.course.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });

  return { data: updated };
}

export async function deleteCourseAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const course = await db.course.findUnique({ where: { id } });
  if (!course) return { error: "Course not found" };

  if (course.status === "PUBLISHED") {
    return { error: "Published courses cannot be deleted. Archive it first." };
  }

  await db.course.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "Course",
    entityId: id,
    module: "lms",
    description: `Deleted course "${course.title}"`,
    previousData: course,
  });

  return { success: true };
}
