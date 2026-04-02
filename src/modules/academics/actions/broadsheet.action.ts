"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

// ─── Generate Broadsheet ──────────────────────────────────────────────

export async function generateBroadsheetAction(
  classArmId: string,
  termId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_READ);
  if (denied) return denied;

  // Get all terminal results with subject results for this class arm and term
  const terminalResults = await db.terminalResult.findMany({
    where: { classArmId, termId },
    orderBy: { classPosition: "asc" },
    include: {
      subjectResults: {
        include: {
          subject: {
            select: { id: true, name: true, code: true },
          },
        },
      },
    },
  });

  if (terminalResults.length === 0) {
    return {
      error:
        "No computed results found for this class. Compute results first.",
    };
  }

  // Get student info
  const studentIds = terminalResults.map((r) => r.studentId);
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
    },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  // Collect all unique subjects in order
  const subjectMap = new Map<string, { id: string; name: string; code: string | null }>();
  for (const tr of terminalResults) {
    for (const sr of tr.subjectResults) {
      if (!subjectMap.has(sr.subjectId)) {
        subjectMap.set(sr.subjectId, {
          id: sr.subject.id,
          name: sr.subject.name,
          code: sr.subject.code,
        });
      }
    }
  }
  const subjects = Array.from(subjectMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  // Build student rows
  const studentsData = terminalResults.map((tr) => {
    const student = studentMap.get(tr.studentId);
    const scores: Record<string, { total: number | null; grade: string | null }> = {};

    for (const sr of tr.subjectResults) {
      scores[sr.subjectId] = {
        total: sr.totalScore,
        grade: sr.grade,
      };
    }

    return {
      studentDbId: tr.studentId,
      studentId: student?.studentId ?? "",
      name: student
        ? `${student.lastName} ${student.firstName}`
        : "Unknown",
      position: tr.classPosition,
      average: tr.averageScore,
      grade: tr.overallGrade,
      totalScore: tr.totalScore,
      scores,
    };
  });

  // Calculate subject averages
  const subjectAverages: Record<string, number> = {};
  for (const subject of subjects) {
    let total = 0;
    let count = 0;
    for (const tr of terminalResults) {
      const sr = tr.subjectResults.find(
        (s) => s.subjectId === subject.id,
      );
      if (sr?.totalScore != null) {
        total += sr.totalScore;
        count++;
      }
    }
    subjectAverages[subject.id] =
      count > 0 ? Math.round((total / count) * 100) / 100 : 0;
  }

  return {
    data: {
      subjects: subjects.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
      })),
      students: studentsData,
      subjectAverages,
      classSize: terminalResults.length,
    },
  };
}
