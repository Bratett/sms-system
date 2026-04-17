"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

export async function createLessonAction(data: {
  courseId: string;
  title: string;
  content?: string;
  contentType?: string;
  resourceUrl?: string;
  duration?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LMS_LESSON_CREATE);
  if (denied) return denied;

  const course = await db.course.findUnique({ where: { id: data.courseId } });
  if (!course) return { error: "Course not found" };
  if (!data.title?.trim()) return { error: "Lesson title is required" };

  // Get next order index
  const lastLesson = await db.lesson.findFirst({
    where: { courseId: data.courseId },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });

  const lesson = await db.lesson.create({
    data: {
      schoolId: ctx.schoolId,
      courseId: data.courseId,
      title: data.title.trim(),
      content: data.content || null,
      contentType: (data.contentType as "TEXT" | "VIDEO" | "PDF" | "LINK" | "MIXED") || "TEXT",
      resourceUrl: data.resourceUrl || null,
      duration: data.duration || null,
      orderIndex: (lastLesson?.orderIndex ?? 0) + 1,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "Lesson",
    entityId: lesson.id,
    module: "lms",
    description: `Created lesson "${lesson.title}" in course`,
  });

  return { data: lesson };
}

export async function updateLessonAction(id: string, data: {
  title?: string;
  content?: string;
  contentType?: string;
  resourceUrl?: string;
  duration?: number;
  isPublished?: boolean;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LMS_LESSON_CREATE);
  if (denied) return denied;

  const lesson = await db.lesson.findUnique({ where: { id } });
  if (!lesson) return { error: "Lesson not found" };

  const updated = await db.lesson.update({
    where: { id },
    data: {
      title: data.title?.trim() ?? lesson.title,
      content: data.content !== undefined ? (data.content || null) : lesson.content,
      contentType: data.contentType ? (data.contentType as "TEXT" | "VIDEO" | "PDF" | "LINK" | "MIXED") : lesson.contentType,
      resourceUrl: data.resourceUrl !== undefined ? (data.resourceUrl || null) : lesson.resourceUrl,
      duration: data.duration !== undefined ? data.duration : lesson.duration,
      isPublished: data.isPublished !== undefined ? data.isPublished : lesson.isPublished,
    },
  });

  return { data: updated };
}

export async function deleteLessonAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LMS_LESSON_CREATE);
  if (denied) return denied;

  const lesson = await db.lesson.findUnique({ where: { id } });
  if (!lesson) return { error: "Lesson not found" };

  await db.lesson.delete({ where: { id } });
  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "DELETE",
    entity: "Lesson",
    entityId: id,
    module: "lms",
    description: `Deleted lesson ${lesson.title}`,
    previousData: lesson,
  });
  return { success: true };
}

export async function reorderLessonsAction(courseId: string, lessonIds: string[]) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LMS_LESSON_CREATE);
  if (denied) return denied;

  const updates = lessonIds.map((id, index) =>
    db.lesson.update({ where: { id }, data: { orderIndex: index + 1 } }),
  );

  await db.$transaction(updates);
  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "Course",
    entityId: courseId,
    module: "lms",
    description: `Reordered ${lessonIds.length} lessons`,
    newData: { lessonIds },
  });
  return { success: true };
}

/** @no-audit Student self-progress marker; high-volume, low audit value. */
export async function markLessonCompleteAction(lessonId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LMS_LESSON_READ);
  if (denied) return denied;

  const progress = await db.lessonProgress.upsert({
    where: {
      lessonId_studentId: { lessonId, studentId: ctx.session.user.id },
    },
    create: {
      schoolId: ctx.schoolId,
      lessonId,
      studentId: ctx.session.user.id,
      status: "COMPLETED",
      startedAt: new Date(),
      completedAt: new Date(),
    },
    update: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  // Update course enrollment progress
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { courseId: true },
  });

  if (lesson) {
    const totalLessons = await db.lesson.count({ where: { courseId: lesson.courseId } });
    const completedLessons = await db.lessonProgress.count({
      where: {
        studentId: ctx.session.user.id,
        status: "COMPLETED",
        lesson: { courseId: lesson.courseId },
      },
    });

    const progressPct = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

    await db.courseEnrollment.updateMany({
      where: { courseId: lesson.courseId, studentId: ctx.session.user.id },
      data: {
        progress: Math.round(progressPct),
        ...(progressPct >= 100 ? { completedAt: new Date() } : {}),
      },
    });
  }

  return { data: progress };
}
