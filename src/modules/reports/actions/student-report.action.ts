"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function getStudentRegisterReportAction(filters?: {
  classArmId?: string;
  academicYearId?: string;
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

  // Student list with details
  const enrollments = await db.enrollment.findMany({
    where: enrollmentWhere,
    include: {
      student: {
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          otherNames: true,
          gender: true,
          boardingStatus: true,
          status: true,
        },
      },
      classArm: {
        include: { class: { select: { name: true } } },
      },
    },
    orderBy: { student: { lastName: "asc" } },
  });

  const students = enrollments.map((e) => ({
    id: e.student.id,
    studentId: e.student.studentId,
    name: [e.student.firstName, e.student.otherNames, e.student.lastName]
      .filter(Boolean)
      .join(" "),
    className: `${e.classArm.class.name} ${e.classArm.name}`,
    gender: e.student.gender,
    boardingStatus: e.student.boardingStatus,
    status: e.student.status,
  }));

  // Gender distribution
  const genderDistribution = { MALE: 0, FEMALE: 0 };
  for (const s of students) {
    const g = s.gender as string;
    if (g in genderDistribution) {
      genderDistribution[g as keyof typeof genderDistribution]++;
    }
  }

  // Day vs boarding breakdown
  const boardingBreakdown = { DAY: 0, BOARDING: 0 };
  for (const s of students) {
    const b = s.boardingStatus as string;
    if (b in boardingBreakdown) {
      boardingBreakdown[b as keyof typeof boardingBreakdown]++;
    }
  }

  // Status breakdown
  const statusCounts = new Map<string, number>();
  for (const s of students) {
    const st = s.status as string;
    statusCounts.set(st, (statusCounts.get(st) || 0) + 1);
  }
  const statusBreakdown = [...statusCounts.entries()].map(
    ([status, count]) => ({
      status,
      count,
    })
  );

  return {
    data: {
      totalStudents: students.length,
      students,
      genderDistribution,
      boardingBreakdown,
      statusBreakdown,
    },
  };
}
