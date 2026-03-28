"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// ─── Enrollment Report ──────────────────────────────────────────────

export async function getEnrollmentReportAction(filters?: {
  academicYearId?: string;
  classArmId?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  // Determine academic year
  let academicYearId = filters?.academicYearId;
  if (!academicYearId) {
    const current = await db.academicYear.findFirst({
      where: { schoolId: school.id, isCurrent: true },
    });
    academicYearId = current?.id;
  }

  if (!academicYearId) {
    return { error: "No academic year found." };
  }

  const enrollmentWhere: Record<string, unknown> = {
    academicYearId,
    status: "ACTIVE",
  };
  if (filters?.classArmId) {
    enrollmentWhere.classArmId = filters.classArmId;
  }

  // Total enrollment
  const totalEnrolled = await db.enrollment.count({ where: enrollmentWhere });

  // By gender
  const enrollments = await db.enrollment.findMany({
    where: enrollmentWhere,
    include: {
      student: { select: { gender: true, boardingStatus: true } },
      classArm: {
        include: { class: { select: { name: true, programmeId: true } } },
      },
    },
  });

  const byGender = { MALE: 0, FEMALE: 0 };
  const byBoardingStatus = { DAY: 0, BOARDING: 0 };
  const byProgramme = new Map<string, number>();
  const byClass = new Map<string, number>();

  for (const e of enrollments) {
    // Gender
    const g = e.student.gender as string;
    if (g in byGender) {
      byGender[g as keyof typeof byGender]++;
    }

    // Boarding
    const b = e.student.boardingStatus as string;
    if (b in byBoardingStatus) {
      byBoardingStatus[b as keyof typeof byBoardingStatus]++;
    }

    // Programme
    const progId = e.classArm.class.programmeId;
    byProgramme.set(progId, (byProgramme.get(progId) || 0) + 1);

    // Class
    const className = e.classArm.class.name;
    byClass.set(className, (byClass.get(className) || 0) + 1);
  }

  // Resolve programme names
  const programmeIds = [...byProgramme.keys()];
  let programmeMap = new Map<string, string>();
  if (programmeIds.length > 0) {
    const programmes = await db.programme.findMany({
      where: { id: { in: programmeIds } },
      select: { id: true, name: true },
    });
    programmeMap = new Map(programmes.map((p) => [p.id, p.name]));
  }

  const byProgrammeNamed = [...byProgramme.entries()].map(([id, count]) => ({
    programme: programmeMap.get(id) ?? "Unknown",
    count,
  }));

  const byClassArr = [...byClass.entries()]
    .map(([name, count]) => ({ className: name, count }))
    .sort((a, b) => a.className.localeCompare(b.className));

  return {
    data: {
      total: totalEnrolled,
      byGender,
      byBoardingStatus,
      byProgramme: byProgrammeNamed,
      byClass: byClassArr,
    },
  };
}

// ─── Academic Performance Report ────────────────────────────────────

export async function getAcademicPerformanceReportAction(termId: string, classArmId?: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const resultWhere: Record<string, unknown> = { termId };
  if (classArmId) {
    resultWhere.classArmId = classArmId;
  }

  const results = await db.terminalResult.findMany({
    where: resultWhere,
    include: {
      subjectResults: {
        include: { subject: { select: { name: true } } },
      },
    },
  });

  if (results.length === 0) {
    return {
      data: {
        totalStudents: 0,
        classAverage: 0,
        passRate: 0,
        failRate: 0,
        subjectPerformance: [],
        classPerformance: [],
      },
    };
  }

  // Overall stats
  const totalStudents = results.length;
  const averages = results.filter((r) => r.averageScore !== null).map((r) => r.averageScore!);
  const classAverage =
    averages.length > 0 ? averages.reduce((a, b) => a + b, 0) / averages.length : 0;

  // Pass = average >= 50
  const passCount = averages.filter((a) => a >= 50).length;
  const passRate = averages.length > 0 ? (passCount / averages.length) * 100 : 0;
  const failRate = 100 - passRate;

  // Subject performance
  const subjectScores = new Map<string, { name: string; scores: number[] }>();
  for (const r of results) {
    for (const sr of r.subjectResults) {
      if (sr.totalScore === null) continue;
      const key = sr.subjectId;
      if (!subjectScores.has(key)) {
        subjectScores.set(key, { name: sr.subject.name, scores: [] });
      }
      subjectScores.get(key)!.scores.push(sr.totalScore);
    }
  }

  const subjectPerformance = [...subjectScores.values()]
    .map((s) => {
      const avg = s.scores.reduce((a, b) => a + b, 0) / s.scores.length;
      const passes = s.scores.filter((sc) => sc >= 50).length;
      return {
        subject: s.name,
        average: Math.round(avg * 100) / 100,
        passRate: Math.round((passes / s.scores.length) * 100 * 100) / 100,
        studentCount: s.scores.length,
      };
    })
    .sort((a, b) => b.average - a.average);

  // Class performance (group by classArmId)
  const classScores = new Map<string, number[]>();
  for (const r of results) {
    if (r.averageScore === null) continue;
    if (!classScores.has(r.classArmId)) {
      classScores.set(r.classArmId, []);
    }
    classScores.get(r.classArmId)!.push(r.averageScore);
  }

  const classArmIds = [...classScores.keys()];
  let classArmMap = new Map<string, string>();
  if (classArmIds.length > 0) {
    const arms = await db.classArm.findMany({
      where: { id: { in: classArmIds } },
      include: { class: { select: { name: true } } },
    });
    classArmMap = new Map(arms.map((a) => [a.id, `${a.class.name} ${a.name}`]));
  }

  const classPerformance = [...classScores.entries()]
    .map(([armId, scores]) => ({
      className: classArmMap.get(armId) ?? "Unknown",
      average: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
      studentCount: scores.length,
    }))
    .sort((a, b) => b.average - a.average);

  return {
    data: {
      totalStudents,
      classAverage: Math.round(classAverage * 100) / 100,
      passRate: Math.round(passRate * 100) / 100,
      failRate: Math.round(failRate * 100) / 100,
      subjectPerformance,
      classPerformance,
    },
  };
}

// ─── Attendance Report ──────────────────────────────────────────────

export async function getAttendanceReportAction(termId: string, classArmId?: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  // Get term date range
  const term = await db.term.findUnique({ where: { id: termId } });
  if (!term) {
    return { error: "Term not found." };
  }

  const registerWhere: Record<string, unknown> = {
    date: { gte: term.startDate, lte: term.endDate },
    status: "CLOSED",
  };
  if (classArmId) {
    registerWhere.classArmId = classArmId;
  }

  const registers = await db.attendanceRegister.findMany({
    where: registerWhere,
    include: {
      records: { select: { status: true, studentId: true } },
    },
  });

  let totalRecords = 0;
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;

  const byClass = new Map<string, { total: number; present: number }>();
  const studentGenderData = new Map<string, string>();

  for (const reg of registers) {
    if (!byClass.has(reg.classArmId)) {
      byClass.set(reg.classArmId, { total: 0, present: 0 });
    }
    const classData = byClass.get(reg.classArmId)!;

    for (const rec of reg.records) {
      totalRecords++;
      classData.total++;

      if (rec.status === "PRESENT" || rec.status === "LATE") {
        presentCount++;
        classData.present++;
      }
      if (rec.status === "ABSENT") {
        absentCount++;
      }
      if (rec.status === "LATE") {
        lateCount++;
      }
    }
  }

  const overallRate =
    totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100 * 100) / 100 : 0;

  // Resolve class names
  const classArmIds = [...byClass.keys()];
  let classArmMap = new Map<string, string>();
  if (classArmIds.length > 0) {
    const arms = await db.classArm.findMany({
      where: { id: { in: classArmIds } },
      include: { class: { select: { name: true } } },
    });
    classArmMap = new Map(arms.map((a) => [a.id, `${a.class.name} ${a.name}`]));
  }

  const byClassArr = [...byClass.entries()]
    .map(([armId, data]) => ({
      className: classArmMap.get(armId) ?? "Unknown",
      attendanceRate:
        data.total > 0 ? Math.round((data.present / data.total) * 100 * 100) / 100 : 0,
      totalRecords: data.total,
    }))
    .sort((a, b) => a.className.localeCompare(b.className));

  return {
    data: {
      overallRate,
      totalRecords,
      presentCount,
      absentCount,
      lateCount,
      byClass: byClassArr,
    },
  };
}

// ─── Comprehensive Report ───────────────────────────────────────────

export async function getComprehensiveReportAction(termId?: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  // Get current academic year and term
  const currentYear = await db.academicYear.findFirst({
    where: { schoolId: school.id, isCurrent: true },
  });

  let currentTermId = termId;
  if (!currentTermId && currentYear) {
    const currentTerm = await db.term.findFirst({
      where: { academicYearId: currentYear.id, isCurrent: true },
    });
    currentTermId = currentTerm?.id;
  }

  // Enrollment summary
  const totalStudents = await db.student.count({
    where: { schoolId: school.id, status: "ACTIVE" },
  });

  const maleCount = await db.student.count({
    where: { schoolId: school.id, status: "ACTIVE", gender: "MALE" },
  });

  const femaleCount = await db.student.count({
    where: { schoolId: school.id, status: "ACTIVE", gender: "FEMALE" },
  });

  const boardingCount = await db.student.count({
    where: { schoolId: school.id, status: "ACTIVE", boardingStatus: "BOARDING" },
  });

  const dayCount = totalStudents - boardingCount;

  // Staff count
  const totalStaff = await db.staff.count({
    where: { schoolId: school.id, status: "ACTIVE" },
  });

  // Academic summary (if term available)
  let academicSummary = null;
  if (currentTermId) {
    const results = await db.terminalResult.findMany({
      where: { termId: currentTermId },
      select: { averageScore: true },
    });
    const averages = results.filter((r) => r.averageScore !== null).map((r) => r.averageScore!);

    if (averages.length > 0) {
      const classAvg = averages.reduce((a, b) => a + b, 0) / averages.length;
      const passes = averages.filter((a) => a >= 50).length;
      academicSummary = {
        averageScore: Math.round(classAvg * 100) / 100,
        passRate: Math.round((passes / averages.length) * 100 * 100) / 100,
        studentsWithResults: averages.length,
      };
    }
  }

  // Finance summary
  let financeSummary = null;
  try {
    const totalBilled = await db.studentBill.aggregate({
      _sum: { totalAmount: true },
      where: currentYear ? { academicYearId: currentYear.id } : {},
    });

    const totalPaid = await db.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: "CONFIRMED",
        ...(currentYear ? { studentBill: { academicYearId: currentYear.id } } : {}),
      },
    });

    financeSummary = {
      totalBilled: totalBilled._sum.totalAmount ?? 0,
      totalCollected: totalPaid._sum.amount ?? 0,
      collectionRate:
        totalBilled._sum.totalAmount && totalBilled._sum.totalAmount > 0
          ? Math.round(((totalPaid._sum.amount ?? 0) / totalBilled._sum.totalAmount) * 100 * 100) /
            100
          : 0,
    };
  } catch {
    // Finance models may not have data
    financeSummary = null;
  }

  // Discipline summary
  const totalIncidents = await db.disciplinaryIncident.count({
    where: { schoolId: school.id },
  });
  const openIncidents = await db.disciplinaryIncident.count({
    where: {
      schoolId: school.id,
      status: { in: ["REPORTED", "INVESTIGATING"] },
    },
  });

  return {
    data: {
      enrollment: {
        total: totalStudents,
        male: maleCount,
        female: femaleCount,
        boarding: boardingCount,
        day: dayCount,
      },
      staff: { total: totalStaff },
      academics: academicSummary,
      finance: financeSummary,
      discipline: {
        totalIncidents,
        openIncidents,
      },
    },
  };
}

// ─── Get dropdown data for filters ──────────────────────────────────

export async function getReportFiltersAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const academicYears = await db.academicYear.findMany({
    where: { schoolId: school.id },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, isCurrent: true },
  });

  const currentYear = academicYears.find((y) => y.isCurrent);

  let terms: { id: string; name: string; isCurrent: boolean }[] = [];
  if (currentYear) {
    terms = await db.term.findMany({
      where: { academicYearId: currentYear.id },
      orderBy: { termNumber: "asc" },
      select: { id: true, name: true, isCurrent: true },
    });
  }

  const classArms = await db.classArm.findMany({
    where: {
      status: "ACTIVE",
      class: {
        schoolId: school.id,
        ...(currentYear ? { academicYearId: currentYear.id } : {}),
      },
    },
    include: { class: { select: { name: true } } },
    orderBy: { class: { name: "asc" } },
  });

  const classArmOptions = classArms.map((a) => ({
    id: a.id,
    name: `${a.class.name} ${a.name}`,
  }));

  return {
    data: {
      academicYears,
      terms,
      classArms: classArmOptions,
    },
  };
}
