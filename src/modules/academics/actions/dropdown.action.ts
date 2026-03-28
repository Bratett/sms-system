"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function getAcademicDropdownsAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const [subjects, classArmsRaw, assessmentTypes, termsRaw, academicYears] =
    await Promise.all([
      db.subject.findMany({
        where: { schoolId: school.id, status: "ACTIVE" },
        select: { id: true, name: true, code: true, type: true },
        orderBy: { name: "asc" },
      }),
      db.classArm.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          class: {
            select: {
              id: true,
              name: true,
              programmeId: true,
            },
          },
        },
        orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
      }),
      db.assessmentType.findMany({
        where: { schoolId: school.id },
        select: {
          id: true,
          name: true,
          code: true,
          category: true,
          weight: true,
          maxScore: true,
          termId: true,
        },
        orderBy: { name: "asc" },
      }),
      db.term.findMany({
        include: {
          academicYear: { select: { id: true, name: true } },
        },
        orderBy: [
          { academicYear: { startDate: "desc" } },
          { termNumber: "asc" },
        ],
      }),
      db.academicYear.findMany({
        select: { id: true, name: true, isCurrent: true },
        orderBy: { startDate: "desc" },
      }),
    ]);

  // Fetch programme names for class arms
  const programmeIds = [
    ...new Set(classArmsRaw.map((ca) => ca.class.programmeId)),
  ];
  const programmes = await db.programme.findMany({
    where: { id: { in: programmeIds } },
    select: { id: true, name: true },
  });
  const programmeMap = new Map(programmes.map((p) => [p.id, p.name]));

  const classArms = classArmsRaw.map((ca) => ({
    id: ca.id,
    name: ca.name,
    className: ca.class.name,
    programmeName: programmeMap.get(ca.class.programmeId) ?? "Unknown",
  }));

  const terms = termsRaw.map((t) => ({
    id: t.id,
    name: t.name,
    termNumber: t.termNumber,
    academicYearId: t.academicYear.id,
    academicYearName: t.academicYear.name,
    isCurrent: t.isCurrent,
  }));

  return {
    data: {
      subjects,
      classArms,
      assessmentTypes,
      terms,
      academicYears,
    },
  };
}
