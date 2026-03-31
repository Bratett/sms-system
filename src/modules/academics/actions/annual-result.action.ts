"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { lookupGrade } from "@/modules/academics/utils/grading";

// ─── Compute Annual Results ──────────────────────────────────────────

export async function computeAnnualResultsAction(
  classArmId: string,
  academicYearId: string,
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  // Get grading scale
  const gradingScale = await db.gradingScale.findFirst({
    where: { schoolId: school.id, isDefault: true },
    include: {
      gradeDefinitions: { orderBy: { minScore: "desc" } },
    },
  });

  if (!gradingScale || gradingScale.gradeDefinitions.length === 0) {
    return { error: "No default grading scale found." };
  }

  const gradeDefinitions = gradingScale.gradeDefinitions.map((gd) => ({
    grade: gd.grade,
    minScore: gd.minScore,
    maxScore: gd.maxScore,
    interpretation: gd.interpretation,
    gradePoint: gd.gradePoint,
  }));

  // Get all terms for this academic year, ordered by termNumber
  const terms = await db.term.findMany({
    where: { academicYearId },
    orderBy: { termNumber: "asc" },
  });

  if (terms.length === 0) {
    return { error: "No terms found for this academic year." };
  }

  // Get all terminal results for this class arm across all terms
  const terminalResults = await db.terminalResult.findMany({
    where: {
      classArmId,
      academicYearId,
      termId: { in: terms.map((t) => t.id) },
    },
    include: {
      subjectResults: {
        include: {
          subject: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  if (terminalResults.length === 0) {
    return { error: "No terminal results found. Compute terminal results for each term first." };
  }

  // Group terminal results by student
  const resultsByStudent = new Map<string, typeof terminalResults>();
  for (const tr of terminalResults) {
    if (!resultsByStudent.has(tr.studentId)) {
      resultsByStudent.set(tr.studentId, []);
    }
    resultsByStudent.get(tr.studentId)!.push(tr);
  }

  // Delete existing annual results for this class arm + year
  await db.annualResult.deleteMany({
    where: { classArmId, academicYearId },
  });

  const errors: string[] = [];
  let computed = 0;

  // Build term ID to term number mapping
  const termNumberMap = new Map(terms.map((t) => [t.id, t.termNumber]));

  for (const [studentId, studentTermResults] of resultsByStudent) {
    // Create annual result
    const annualResult = await db.annualResult.create({
      data: { studentId, classArmId, academicYearId },
    });

    // Collect all subjects across all terms
    const subjectScores = new Map<string, { term1: number | null; term2: number | null; term3: number | null }>();

    for (const tr of studentTermResults) {
      const termNum = termNumberMap.get(tr.termId) ?? 0;
      for (const sr of tr.subjectResults) {
        if (!subjectScores.has(sr.subjectId)) {
          subjectScores.set(sr.subjectId, { term1: null, term2: null, term3: null });
        }
        const entry = subjectScores.get(sr.subjectId)!;
        if (termNum === 1) entry.term1 = sr.totalScore;
        else if (termNum === 2) entry.term2 = sr.totalScore;
        else if (termNum === 3) entry.term3 = sr.totalScore;
      }
    }

    let totalAcrossSubjects = 0;
    let subjectCount = 0;

    for (const [subjectId, scores] of subjectScores) {
      const available = [scores.term1, scores.term2, scores.term3].filter(
        (s): s is number => s !== null,
      );
      const avg = available.length > 0
        ? Math.round((available.reduce((a, b) => a + b, 0) / available.length) * 100) / 100
        : 0;

      const gradeResult = lookupGrade(avg, gradeDefinitions);

      await db.subjectAnnualResult.create({
        data: {
          annualResultId: annualResult.id,
          subjectId,
          term1Score: scores.term1,
          term2Score: scores.term2,
          term3Score: scores.term3,
          averageScore: avg,
          grade: gradeResult?.grade ?? null,
          interpretation: gradeResult?.interpretation ?? null,
        },
      });

      totalAcrossSubjects += avg;
      subjectCount++;
    }

    const averageScore = subjectCount > 0
      ? Math.round((totalAcrossSubjects / subjectCount) * 100) / 100
      : 0;
    const overallGrade = lookupGrade(averageScore, gradeDefinitions);

    await db.annualResult.update({
      where: { id: annualResult.id },
      data: {
        totalScore: Math.round(totalAcrossSubjects * 100) / 100,
        averageScore,
        overallGrade: overallGrade?.grade ?? null,
        subjectCount,
      },
    });

    computed++;
  }

  // Calculate class positions
  const annualResults = await db.annualResult.findMany({
    where: { classArmId, academicYearId },
    orderBy: { averageScore: "desc" },
  });

  for (let i = 0; i < annualResults.length; i++) {
    let position = i + 1;
    if (i > 0 && annualResults[i].averageScore === annualResults[i - 1].averageScore) {
      const prevResult = await db.annualResult.findUnique({
        where: { id: annualResults[i - 1].id },
        select: { classPosition: true },
      });
      position = prevResult?.classPosition ?? position;
    }
    await db.annualResult.update({
      where: { id: annualResults[i].id },
      data: { classPosition: position },
    });
  }

  // Calculate per-subject positions
  const allAnnualResults = await db.annualResult.findMany({
    where: { classArmId, academicYearId },
    include: { subjectAnnualResults: true },
  });

  const subjectScoresMap = new Map<string, Array<{ annualResultId: string; avg: number }>>();
  for (const ar of allAnnualResults) {
    for (const sar of ar.subjectAnnualResults) {
      if (!subjectScoresMap.has(sar.subjectId)) {
        subjectScoresMap.set(sar.subjectId, []);
      }
      subjectScoresMap.get(sar.subjectId)!.push({
        annualResultId: ar.id,
        avg: sar.averageScore ?? 0,
      });
    }
  }

  for (const [subjectId, scores] of subjectScoresMap) {
    scores.sort((a, b) => b.avg - a.avg);
    for (let i = 0; i < scores.length; i++) {
      let position = i + 1;
      if (i > 0 && scores[i].avg === scores[i - 1].avg) {
        for (let j = i - 1; j >= 0; j--) {
          if (scores[j].avg === scores[i].avg) position = j + 1;
          else break;
        }
      }
      await db.subjectAnnualResult.updateMany({
        where: { annualResultId: scores[i].annualResultId, subjectId },
        data: { position },
      });
    }
  }

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "AnnualResult",
    entityId: classArmId,
    module: "academics",
    description: `Computed annual results for ${computed} student(s)`,
    metadata: { classArmId, academicYearId, computed, errors },
  });

  return { data: { computed, errors } };
}

// ─── Get Annual Results ──────────────────────────────────────────────

export async function getAnnualResultsAction(
  classArmId: string,
  academicYearId: string,
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const results = await db.annualResult.findMany({
    where: { classArmId, academicYearId },
    orderBy: { classPosition: "asc" },
    include: {
      subjectAnnualResults: {
        include: {
          subject: { select: { id: true, name: true, code: true } },
        },
        orderBy: { subject: { name: "asc" } },
      },
    },
  });

  const studentIds = results.map((r) => r.studentId);
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, studentId: true, firstName: true, lastName: true, otherNames: true },
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
      academicYearId: r.academicYearId,
      totalScore: r.totalScore,
      averageScore: r.averageScore,
      classPosition: r.classPosition,
      overallGrade: r.overallGrade,
      subjectCount: r.subjectCount,
      promotionStatus: r.promotionStatus,
      computedAt: r.computedAt,
      subjectResults: r.subjectAnnualResults.map((sar) => ({
        id: sar.id,
        subjectId: sar.subjectId,
        subjectName: sar.subject.name,
        subjectCode: sar.subject.code,
        term1Score: sar.term1Score,
        term2Score: sar.term2Score,
        term3Score: sar.term3Score,
        averageScore: sar.averageScore,
        grade: sar.grade,
        interpretation: sar.interpretation,
        position: sar.position,
      })),
    };
  });

  return { data };
}

// ─── Get Single Student Annual Result ────────────────────────────────

export async function getStudentAnnualResultAction(
  studentId: string,
  academicYearId: string,
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const result = await db.annualResult.findFirst({
    where: { studentId, academicYearId },
    include: {
      subjectAnnualResults: {
        include: {
          subject: { select: { id: true, name: true, code: true } },
        },
        orderBy: { subject: { name: "asc" } },
      },
    },
  });

  if (!result) {
    return { error: "No annual result found for this student and academic year." };
  }

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, studentId: true, firstName: true, lastName: true, otherNames: true },
  });

  const classSize = await db.annualResult.count({
    where: { classArmId: result.classArmId, academicYearId },
  });

  return {
    data: {
      id: result.id,
      studentId: result.studentId,
      studentIdNumber: student?.studentId ?? "",
      studentName: student
        ? `${student.lastName} ${student.firstName}${student.otherNames ? " " + student.otherNames : ""}`
        : "Unknown",
      classArmId: result.classArmId,
      academicYearId: result.academicYearId,
      totalScore: result.totalScore,
      averageScore: result.averageScore,
      classPosition: result.classPosition,
      overallGrade: result.overallGrade,
      subjectCount: result.subjectCount,
      classSize,
      promotionStatus: result.promotionStatus,
      computedAt: result.computedAt,
      subjectResults: result.subjectAnnualResults.map((sar) => ({
        id: sar.id,
        subjectId: sar.subjectId,
        subjectName: sar.subject.name,
        subjectCode: sar.subject.code,
        term1Score: sar.term1Score,
        term2Score: sar.term2Score,
        term3Score: sar.term3Score,
        averageScore: sar.averageScore,
        grade: sar.grade,
        interpretation: sar.interpretation,
        position: sar.position,
      })),
    },
  };
}
