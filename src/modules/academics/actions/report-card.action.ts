"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// ─── Generate Report Card Data for a Single Student ───────────────────

export async function generateReportCardDataAction(
  studentId: string,
  termId: string,
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  // Get student info
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      houseAssignment: true,
    },
  });

  if (!student) {
    return { error: "Student not found." };
  }

  // Get terminal result with subject results
  const terminalResult = await db.terminalResult.findFirst({
    where: { studentId, termId },
    include: {
      subjectResults: {
        include: {
          subject: {
            select: { id: true, name: true, code: true, type: true },
          },
        },
        orderBy: { subject: { name: "asc" } },
      },
    },
  });

  if (!terminalResult) {
    return {
      error:
        "No computed results found for this student and term. Compute results first.",
    };
  }

  // Get term and academic year info
  const term = await db.term.findUnique({
    where: { id: termId },
    include: {
      academicYear: true,
    },
  });

  if (!term) {
    return { error: "Term not found." };
  }

  // Get enrollment info (class arm -> class -> programme)
  const enrollment = await db.enrollment.findFirst({
    where: {
      studentId,
      academicYearId: term.academicYearId,
      status: "ACTIVE",
    },
    include: {
      classArm: {
        include: {
          class: true,
        },
      },
    },
  });

  // Get programme name
  let programmeName = "";
  if (enrollment?.classArm?.class?.programmeId) {
    const programme = await db.programme.findUnique({
      where: { id: enrollment.classArm.class.programmeId },
      select: { name: true },
    });
    programmeName = programme?.name ?? "";
  }

  // Get house name
  let houseName = "";
  if (student.houseAssignment?.houseId) {
    const house = await db.house.findFirst({
      where: { id: student.houseAssignment.houseId },
      select: { name: true },
    });
    houseName = house?.name ?? "";
  }

  // Get class size (how many students in this class arm have results)
  const classSize = await db.terminalResult.count({
    where: {
      classArmId: terminalResult.classArmId,
      termId,
      academicYearId: term.academicYearId,
    },
  });

  const data = {
    school: {
      name: school.name,
      motto: school.motto ?? "",
      address: school.address ?? "",
      logoUrl: school.logoUrl ?? "",
      phone: school.phone ?? "",
      email: school.email ?? "",
    },
    student: {
      id: student.id,
      studentId: student.studentId,
      name: `${student.lastName} ${student.firstName}${student.otherNames ? " " + student.otherNames : ""}`,
      firstName: student.firstName,
      lastName: student.lastName,
      gender: student.gender,
      class: enrollment
        ? `${enrollment.classArm.class.name} ${enrollment.classArm.name}`
        : "",
      programme: programmeName,
      house: houseName,
    },
    term: {
      id: term.id,
      name: term.name,
      termNumber: term.termNumber,
      academicYear: term.academicYear.name,
      startDate: term.startDate,
      endDate: term.endDate,
    },
    subjectResults: terminalResult.subjectResults.map((sr) => ({
      subjectId: sr.subjectId,
      subjectName: sr.subject.name,
      subjectCode: sr.subject.code,
      subjectType: sr.subject.type,
      classScore: sr.classScore,
      examScore: sr.examScore,
      totalScore: sr.totalScore,
      grade: sr.grade,
      interpretation: sr.interpretation,
      position: sr.position,
      caBreakdown: sr.caBreakdown,
    })),
    overall: {
      totalScore: terminalResult.totalScore,
      averageScore: terminalResult.averageScore,
      position: terminalResult.classPosition,
      classSize,
      overallGrade: terminalResult.overallGrade,
    },
    remarks: {
      teacherRemarks: terminalResult.teacherRemarks ?? "",
      headmasterRemarks: terminalResult.headmasterRemarks ?? "",
    },
    attendance: await (async () => {
      const registers = await db.attendanceRegister.findMany({
        where: {
          classArmId: terminalResult.classArmId,
          date: { gte: term.startDate, lte: term.endDate },
          type: "DAILY",
          status: "CLOSED",
        },
        select: { id: true },
      });
      const registerIds = registers.map((r) => r.id);
      if (registerIds.length === 0) {
        return { totalSchoolDays: 0, present: 0, absent: 0, late: 0, excused: 0, sick: 0 };
      }
      const records = await db.attendanceRecord.findMany({
        where: {
          registerId: { in: registerIds },
          studentId,
        },
        select: { status: true },
      });
      const counts = { present: 0, absent: 0, late: 0, excused: 0, sick: 0 };
      for (const r of records) {
        if (r.status === "PRESENT") counts.present++;
        else if (r.status === "ABSENT") counts.absent++;
        else if (r.status === "LATE") counts.late++;
        else if (r.status === "EXCUSED") counts.excused++;
        else if (r.status === "SICK") counts.sick++;
      }
      return { totalSchoolDays: registerIds.length, ...counts };
    })(),
  };

  return { data };
}

// ─── Generate Report Cards for Entire Class ───────────────────────────

export async function generateClassReportCardsAction(
  classArmId: string,
  termId: string,
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  // Get all terminal results for this class arm and term
  const terminalResults = await db.terminalResult.findMany({
    where: { classArmId, termId },
    orderBy: { classPosition: "asc" },
    select: { studentId: true },
  });

  if (terminalResults.length === 0) {
    return {
      error:
        "No computed results found for this class. Compute results first.",
    };
  }

  const reportCards = [];
  const errors: string[] = [];

  for (const result of terminalResults) {
    const cardResult = await generateReportCardDataAction(
      result.studentId,
      termId,
    );
    if (cardResult.error) {
      errors.push(cardResult.error);
    } else if (cardResult.data) {
      reportCards.push(cardResult.data);
    }
  }

  return { data: reportCards, errors };
}
