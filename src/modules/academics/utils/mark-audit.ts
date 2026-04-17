import { db } from "@/lib/db";

export async function logMarkChange(params: {
  schoolId: string;
  markId: string;
  studentId: string;
  subjectId: string;
  assessmentTypeId: string;
  termId: string;
  previousScore: number | null;
  newScore: number | null;
  previousStatus: string | null;
  newStatus: string | null;
  changedBy: string;
  changeReason?: string;
}) {
  await db.markAuditLog.create({
    data: {
      schoolId: params.schoolId,
      markId: params.markId,
      studentId: params.studentId,
      subjectId: params.subjectId,
      assessmentTypeId: params.assessmentTypeId,
      termId: params.termId,
      previousScore: params.previousScore,
      newScore: params.newScore,
      previousStatus: params.previousStatus as any,
      newStatus: params.newStatus as any,
      changedBy: params.changedBy,
      changeReason: params.changeReason,
    },
  });
}

export async function getMarkAuditTrailAction(markId: string) {
  const logs = await db.markAuditLog.findMany({
    where: { markId },
    orderBy: { changedAt: "desc" },
  });
  return logs;
}

export async function getMarkAuditBySubjectAction(
  subjectId: string,
  classArmId: string,
  termId: string,
) {
  // Get marks for this subject/class/term to get markIds
  const marks = await db.mark.findMany({
    where: { subjectId, classArmId, termId },
    select: { id: true },
  });
  const markIds = marks.map((m) => m.id);

  const logs = await db.markAuditLog.findMany({
    where: { markId: { in: markIds } },
    orderBy: { changedAt: "desc" },
  });

  return logs;
}
