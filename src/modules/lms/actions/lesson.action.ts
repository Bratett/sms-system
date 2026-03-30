"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function createLessonAction(data: {
  courseId: string;
  title: string;
  content?: string;
  contentType?: string;
  resourceUrl?: string;
  duration?: number;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

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
    userId: session.user.id!,
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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const lesson = await db.lesson.findUnique({ where: { id } });
  if (!lesson) return { error: "Lesson not found" };

  await db.lesson.delete({ where: { id } });
  return { success: true };
}

export async function reorderLessonsAction(courseId: string, lessonIds: string[]) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const updates = lessonIds.map((id, index) =>
    db.lesson.update({ where: { id }, data: { orderIndex: index + 1 } }),
  );

  await db.$transaction(updates);
  return { success: true };
}

export async function markLessonCompleteAction(lessonId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const progress = await db.lessonProgress.upsert({
    where: {
      lessonId_studentId: { lessonId, studentId: session.user.id! },
    },
    create: {
      lessonId,
      studentId: session.user.id!,
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
        studentId: session.user.id!,
        status: "COMPLETED",
        lesson: { courseId: lesson.courseId },
      },
    });

    const progressPct = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

    await db.courseEnrollment.updateMany({
      where: { courseId: lesson.courseId, studentId: session.user.id! },
      data: {
        progress: Math.round(progressPct),
        ...(progressPct >= 100 ? { completedAt: new Date() } : {}),
      },
    });
  }

  return { data: progress };
}
