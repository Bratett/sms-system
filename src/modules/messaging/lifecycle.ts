import { db } from "@/lib/db";

/**
 * Archives all active message threads for a student. Safe to call multiple times.
 * Intended to be called from student-lifecycle actions (transfer, withdraw, graduate)
 * AFTER the status update has been persisted.
 *
 * Not permission-checked — the calling action is already gated.
 */
export async function archiveThreadsForStudent(studentId: string): Promise<void> {
  await db.messageThread.updateMany({
    where: { studentId, status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });
}

/**
 * Updates all active threads for students in a class arm when the class
 * teacher rotates. Posts a system-note message to each affected thread.
 *
 * Not permission-checked — caller (promotion action) already gated.
 */
export async function rotateTeacherOnThreadsForArm(params: {
  classArmId: string;
  newTeacherUserId: string;
  reason?: string;
}): Promise<void> {
  const students = await db.student.findMany({
    where: {
      enrollments: { some: { classArmId: params.classArmId, status: "ACTIVE" } },
    },
    select: { id: true },
  });
  if (students.length === 0) return;

  const studentIds = students.map((s) => s.id);

  const threads = await db.messageThread.findMany({
    where: {
      studentId: { in: studentIds },
      status: "ACTIVE",
      teacherUserId: { not: params.newTeacherUserId },
    },
    select: { id: true, teacherUserId: true },
  });
  if (threads.length === 0) return;

  await db.$transaction(async (tx) => {
    for (const t of threads) {
      await tx.messageThread.update({
        where: { id: t.id },
        data: { teacherUserId: params.newTeacherUserId },
      });
      await tx.message.create({
        data: {
          threadId: t.id,
          authorUserId: params.newTeacherUserId,
          body: params.reason
            ? `Thread transferred to new class teacher: ${params.reason}`
            : "Thread transferred to new class teacher.",
          systemNote: true,
        },
      });
    }
  });
}
