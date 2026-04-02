"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { lookupGrade } from "@/modules/academics/utils/grading";

// ─── Compute Terminal Results ──────────────────────────────────────────

export async function computeTerminalResultsAction(
  classArmId: string,
  termId: string,
  academicYearId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_COMPUTE);
  if (denied) return denied;

  const errors: string[] = [];

  // 1. Get the default grading scale
  const gradingScale = await db.gradingScale.findFirst({
    where: { schoolId: ctx.schoolId, isDefault: true },
    include: {
      gradeDefinitions: {
        orderBy: { minScore: "desc" },
      },
    },
  });

  if (!gradingScale || gradingScale.gradeDefinitions.length === 0) {
    return {
      error:
        "No default grading scale found. Please configure a grading scale in School Settings first.",
    };
  }

  const gradeDefinitions = gradingScale.gradeDefinitions.map((gd) => ({
    grade: gd.grade,
    minScore: gd.minScore,
    maxScore: gd.maxScore,
    interpretation: gd.interpretation,
    gradePoint: gd.gradePoint,
  }));

  // 2. Get assessment types and their weights/categories
  const assessmentTypes = await db.assessmentType.findMany({
    where: {
      schoolId: ctx.schoolId,
      OR: [{ termId }, { termId: null }],
    },
  });

  if (assessmentTypes.length === 0) {
    return {
      error: "No assessment types configured. Please set up assessment types first.",
    };
  }

  // Separate CA (non-exam) and exam assessment types
  const examAssessmentTypes = assessmentTypes.filter(
    (at) => at.category === "END_OF_TERM",
  );
  const caAssessmentTypes = assessmentTypes.filter(
    (at) => at.category !== "END_OF_TERM",
  );

  // Calculate total CA weight and exam weight
  const totalCaWeight = caAssessmentTypes.reduce((sum, at) => sum + at.weight, 0);
  const totalExamWeight = examAssessmentTypes.reduce(
    (sum, at) => sum + at.weight,
    0,
  );

  // 3. Get all APPROVED marks for this class arm + term
  const marks = await db.mark.findMany({
    where: {
      classArmId,
      termId,
      academicYearId,
      status: "APPROVED",
    },
    include: {
      assessmentType: true,
      subject: true,
    },
  });

  if (marks.length === 0) {
    return {
      error:
        "No approved marks found for this class. Please ensure marks have been entered and approved.",
    };
  }

  // 4. Get all enrolled students in this class arm
  const enrollments = await db.enrollment.findMany({
    where: {
      classArmId,
      academicYearId,
      status: "ACTIVE",
    },
    include: {
      student: {
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (enrollments.length === 0) {
    return { error: "No active students enrolled in this class arm." };
  }

  // Group marks by student, then by subject
  const marksByStudent = new Map<
    string,
    Map<string, typeof marks>
  >();
  for (const mark of marks) {
    if (!marksByStudent.has(mark.studentId)) {
      marksByStudent.set(mark.studentId, new Map());
    }
    const studentMarks = marksByStudent.get(mark.studentId)!;
    if (!studentMarks.has(mark.subjectId)) {
      studentMarks.set(mark.subjectId, []);
    }
    studentMarks.get(mark.subjectId)!.push(mark);
  }

  // Track subject scores for per-subject position calculation
  // subjectId -> array of { studentId, total }
  const subjectScoresMap = new Map<
    string,
    Array<{ studentId: string; total: number }>
  >();

  let computed = 0;

  // 5. For each enrolled student, compute results
  for (const enrollment of enrollments) {
    const studentId = enrollment.studentId;
    const studentSubjectMarks = marksByStudent.get(studentId);

    if (!studentSubjectMarks || studentSubjectMarks.size === 0) {
      errors.push(
        `No marks found for ${enrollment.student.firstName} ${enrollment.student.lastName} (${enrollment.student.studentId})`,
      );
      continue;
    }

    // Delete existing terminal result for this student/term combo (recompute)
    await db.terminalResult.deleteMany({
      where: {
        studentId,
        termId,
        academicYearId,
      },
    });

    // Create the terminal result record first
    const terminalResult = await db.terminalResult.create({
      data: {
        schoolId: ctx.schoolId,
        studentId,
        classArmId,
        termId,
        academicYearId,
      },
    });

    let totalAcrossSubjects = 0;
    let subjectCount = 0;

    // For each subject the student has marks in
    for (const [subjectId, subjectMarks] of studentSubjectMarks) {
      // Build CA breakdown and calculate weighted class score
      const caBreakdown: Array<{
        name: string;
        score: number;
        maxScore: number;
        weight: number;
        weightedScore: number;
      }> = [];
      let classScore = 0;
      for (const mark of subjectMarks) {
        if (mark.assessmentType.category !== "END_OF_TERM") {
          const weighted =
            (mark.score / mark.maxScore) * mark.assessmentType.weight;
          classScore += weighted;
          caBreakdown.push({
            name: mark.assessmentType.name,
            score: mark.score,
            maxScore: mark.maxScore,
            weight: mark.assessmentType.weight,
            weightedScore: Math.round(weighted * 100) / 100,
          });
        }
      }

      // Get exam score
      let examScore = 0;
      for (const mark of subjectMarks) {
        if (mark.assessmentType.category === "END_OF_TERM") {
          examScore +=
            (mark.score / mark.maxScore) * mark.assessmentType.weight;
        }
      }

      const totalScore = Math.round((classScore + examScore) * 100) / 100;
      const gradeResult = lookupGrade(totalScore, gradeDefinitions);

      // Create subject result with CA breakdown
      await db.subjectResult.create({
        data: {
          terminalResultId: terminalResult.id,
          subjectId,
          schoolId: ctx.schoolId,
          classScore: Math.round(classScore * 100) / 100,
          examScore: Math.round(examScore * 100) / 100,
          totalScore,
          grade: gradeResult?.grade ?? null,
          interpretation: gradeResult?.interpretation ?? null,
          caBreakdown: caBreakdown.length > 0 ? caBreakdown : undefined,
        },
      });

      totalAcrossSubjects += totalScore;
      subjectCount++;

      // Track for subject position calculation
      if (!subjectScoresMap.has(subjectId)) {
        subjectScoresMap.set(subjectId, []);
      }
      subjectScoresMap.get(subjectId)!.push({ studentId, total: totalScore });
    }

    // Update terminal result with totals
    const averageScore =
      subjectCount > 0
        ? Math.round((totalAcrossSubjects / subjectCount) * 100) / 100
        : 0;
    const overallGrade = lookupGrade(averageScore, gradeDefinitions);

    await db.terminalResult.update({
      where: { id: terminalResult.id },
      data: {
        totalScore: Math.round(totalAcrossSubjects * 100) / 100,
        averageScore,
        overallGrade: overallGrade?.grade ?? null,
      },
    });

    computed++;
  }

  // 6. Calculate class positions (rank by averageScore descending)
  const terminalResults = await db.terminalResult.findMany({
    where: { classArmId, termId, academicYearId },
    orderBy: { averageScore: "desc" },
  });

  for (let i = 0; i < terminalResults.length; i++) {
    // Handle ties: students with same average get same position
    let position = i + 1;
    if (
      i > 0 &&
      terminalResults[i].averageScore === terminalResults[i - 1].averageScore
    ) {
      // Find the position of the previous student with the same score
      const prevResult = await db.terminalResult.findUnique({
        where: { id: terminalResults[i - 1].id },
        select: { classPosition: true },
      });
      position = prevResult?.classPosition ?? position;
    }

    await db.terminalResult.update({
      where: { id: terminalResults[i].id },
      data: { classPosition: position },
    });
  }

  // 7. Calculate per-subject positions
  for (const [subjectId, scores] of subjectScoresMap) {
    // Sort by total descending
    scores.sort((a, b) => b.total - a.total);

    for (let i = 0; i < scores.length; i++) {
      let position = i + 1;
      if (i > 0 && scores[i].total === scores[i - 1].total) {
        // Same score, same position - look up what position we assigned before
        position = i; // Find the first occurrence
        for (let j = i - 1; j >= 0; j--) {
          if (scores[j].total === scores[i].total) {
            position = j + 1;
          } else {
            break;
          }
        }
      }

      // Find the terminal result for this student
      const terminalResult = await db.terminalResult.findFirst({
        where: { studentId: scores[i].studentId, termId, academicYearId },
      });

      if (terminalResult) {
        await db.subjectResult.updateMany({
          where: {
            terminalResultId: terminalResult.id,
            subjectId,
          },
          data: { position },
        });
      }
    }
  }

  // 8. Audit log
  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "TerminalResult",
    entityId: classArmId,
    module: "academics",
    description: `Computed terminal results for ${computed} student(s) in class arm`,
    metadata: { classArmId, termId, academicYearId, computed, errors },
  });

  return { data: { computed, errors } };
}

// ─── Get Terminal Results ──────────────────────────────────────────────

export async function getTerminalResultsAction(
  classArmId: string,
  termId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_READ);
  if (denied) return denied;

  const results = await db.terminalResult.findMany({
    where: { classArmId, termId },
    orderBy: { classPosition: "asc" },
    include: {
      subjectResults: {
        include: {
          subject: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { subject: { name: "asc" } },
      },
    },
  });

  // Get student info
  const studentIds = results.map((r) => r.studentId);
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      otherNames: true,
    },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const data = results.map((r) => {
    const student = studentMap.get(r.studentId);
    return {
      id: r.id,
      studentId: r.studentId,
      studentIdNumber: student?.studentId ?? "",
      studentName: student
        ? `${student.lastName} ${student.firstName}${student.otherNames ? " " + student.otherNames : ""}`
        : "Unknown",
      classArmId: r.classArmId,
      termId: r.termId,
      academicYearId: r.academicYearId,
      totalScore: r.totalScore,
      averageScore: r.averageScore,
      classPosition: r.classPosition,
      overallGrade: r.overallGrade,
      teacherRemarks: r.teacherRemarks,
      headmasterRemarks: r.headmasterRemarks,
      promotionStatus: r.promotionStatus,
      computedAt: r.computedAt,
      subjectResults: r.subjectResults.map((sr) => ({
        id: sr.id,
        subjectId: sr.subjectId,
        subjectName: sr.subject.name,
        subjectCode: sr.subject.code,
        classScore: sr.classScore,
        examScore: sr.examScore,
        totalScore: sr.totalScore,
        grade: sr.grade,
        interpretation: sr.interpretation,
        position: sr.position,
      })),
    };
  });

  return { data };
}

// ─── Get Single Student Terminal Result ────────────────────────────────

export async function getStudentTerminalResultAction(
  studentId: string,
  termId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_READ);
  if (denied) return denied;

  const result = await db.terminalResult.findFirst({
    where: { studentId, termId },
    include: {
      subjectResults: {
        include: {
          subject: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { subject: { name: "asc" } },
      },
    },
  });

  if (!result) {
    return { error: "No terminal result found for this student and term." };
  }

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      otherNames: true,
    },
  });

  const data = {
    id: result.id,
    studentId: result.studentId,
    studentIdNumber: student?.studentId ?? "",
    studentName: student
      ? `${student.lastName} ${student.firstName}${student.otherNames ? " " + student.otherNames : ""}`
      : "Unknown",
    classArmId: result.classArmId,
    termId: result.termId,
    academicYearId: result.academicYearId,
    totalScore: result.totalScore,
    averageScore: result.averageScore,
    classPosition: result.classPosition,
    overallGrade: result.overallGrade,
    teacherRemarks: result.teacherRemarks,
    headmasterRemarks: result.headmasterRemarks,
    promotionStatus: result.promotionStatus,
    computedAt: result.computedAt,
    subjectResults: result.subjectResults.map((sr) => ({
      id: sr.id,
      subjectId: sr.subjectId,
      subjectName: sr.subject.name,
      subjectCode: sr.subject.code,
      classScore: sr.classScore,
      examScore: sr.examScore,
      totalScore: sr.totalScore,
      grade: sr.grade,
      interpretation: sr.interpretation,
      position: sr.position,
    })),
  };

  return { data };
}

// ─── Update Terminal Result Remarks ────────────────────────────────────

export async function updateTerminalResultRemarksAction(
  id: string,
  data: { teacherRemarks?: string; headmasterRemarks?: string },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_COMPUTE);
  if (denied) return denied;

  const existing = await db.terminalResult.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Terminal result not found." };
  }

  const previousData = {
    teacherRemarks: existing.teacherRemarks,
    headmasterRemarks: existing.headmasterRemarks,
  };

  const updated = await db.terminalResult.update({
    where: { id },
    data: {
      teacherRemarks:
        data.teacherRemarks !== undefined
          ? data.teacherRemarks
          : existing.teacherRemarks,
      headmasterRemarks:
        data.headmasterRemarks !== undefined
          ? data.headmasterRemarks
          : existing.headmasterRemarks,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "TerminalResult",
    entityId: id,
    module: "academics",
    description: `Updated remarks for terminal result`,
    previousData,
    newData: {
      teacherRemarks: updated.teacherRemarks,
      headmasterRemarks: updated.headmasterRemarks,
    },
  });

  return { data: updated };
}

// ─── Publish Results ──────────────────────────────────────────────────

export async function publishResultsAction(
  classArmId: string,
  termId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_PUBLISH);
  if (denied) return denied;

  const results = await db.terminalResult.findMany({
    where: { classArmId, termId },
  });

  if (results.length === 0) {
    return { error: "No results found to publish. Compute results first." };
  }

  // In the future, this would set a "published" flag and make results visible to parents/students.
  // For now, we log the action as an audit trail.

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "TerminalResult",
    entityId: classArmId,
    module: "academics",
    description: `Published terminal results for ${results.length} student(s)`,
    metadata: { classArmId, termId, count: results.length },
  });

  return { data: { published: results.length } };
}

// ─── Get Result Summary ───────────────────────────────────────────────

export async function getResultSummaryAction(
  classArmId: string,
  termId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_READ);
  if (denied) return denied;

  const results = await db.terminalResult.findMany({
    where: { classArmId, termId },
    include: {
      subjectResults: {
        include: {
          subject: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (results.length === 0) {
    return { data: null };
  }

  const averages = results
    .map((r) => r.averageScore ?? 0)
    .filter((a) => a > 0);

  const classAverage =
    averages.length > 0
      ? Math.round(
          (averages.reduce((sum, a) => sum + a, 0) / averages.length) * 100,
        ) / 100
      : 0;
  const highest = averages.length > 0 ? Math.max(...averages) : 0;
  const lowest = averages.length > 0 ? Math.min(...averages) : 0;

  // Subject averages
  const subjectTotals = new Map<
    string,
    { name: string; total: number; count: number }
  >();
  for (const result of results) {
    for (const sr of result.subjectResults) {
      const existing = subjectTotals.get(sr.subjectId);
      if (existing) {
        existing.total += sr.totalScore ?? 0;
        existing.count++;
      } else {
        subjectTotals.set(sr.subjectId, {
          name: sr.subject.name,
          total: sr.totalScore ?? 0,
          count: 1,
        });
      }
    }
  }

  const subjectAverages = Array.from(subjectTotals.entries()).map(
    ([subjectId, data]) => ({
      subjectId,
      subjectName: data.name,
      average:
        data.count > 0
          ? Math.round((data.total / data.count) * 100) / 100
          : 0,
      studentCount: data.count,
    }),
  );

  subjectAverages.sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  return {
    data: {
      studentCount: results.length,
      classAverage,
      highest,
      lowest,
      subjectAverages,
    },
  };
}
