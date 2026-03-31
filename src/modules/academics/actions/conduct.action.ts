"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Upsert Student Conduct ─────────────────────────────────────────

export async function upsertStudentConductAction(data: {
  studentId: string;
  classArmId: string;
  termId: string;
  academicYearId: string;
  punctuality?: string;
  attendance?: string;
  attentiveness?: string;
  neatness?: string;
  politeness?: string;
  honesty?: string;
  selfControl?: string;
  relationship?: string;
  initiative?: string;
  sports?: string;
  handwriting?: string;
  verbalFluency?: string;
  remarks?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const existing = await db.studentConduct.findFirst({
    where: { studentId: data.studentId, termId: data.termId, academicYearId: data.academicYearId },
  });

  const conductData = {
    studentId: data.studentId,
    classArmId: data.classArmId,
    termId: data.termId,
    academicYearId: data.academicYearId,
    punctuality: (data.punctuality ?? "GOOD") as any,
    attendance: (data.attendance ?? "GOOD") as any,
    attentiveness: (data.attentiveness ?? "GOOD") as any,
    neatness: (data.neatness ?? "GOOD") as any,
    politeness: (data.politeness ?? "GOOD") as any,
    honesty: (data.honesty ?? "GOOD") as any,
    selfControl: (data.selfControl ?? "GOOD") as any,
    relationship: (data.relationship ?? "GOOD") as any,
    initiative: (data.initiative ?? "GOOD") as any,
    sports: data.sports ? (data.sports as any) : undefined,
    handwriting: data.handwriting ? (data.handwriting as any) : undefined,
    verbalFluency: data.verbalFluency ? (data.verbalFluency as any) : undefined,
    remarks: data.remarks ?? undefined,
    ratedBy: session.user.id!,
  };

  const result = existing
    ? await db.studentConduct.update({ where: { id: existing.id }, data: conductData })
    : await db.studentConduct.create({ data: conductData });

  await audit({
    userId: session.user.id!,
    action: existing ? "UPDATE" : "CREATE",
    entity: "StudentConduct",
    entityId: result.id,
    module: "academics",
    description: `${existing ? "Updated" : "Created"} conduct record for student`,
    metadata: { studentId: data.studentId, termId: data.termId },
  });

  return { data: result };
}

// ─── Batch Upsert Conduct for Class ─────────────────────────────────

export async function batchUpsertConductAction(
  records: Array<{
    studentId: string;
    punctuality?: string;
    attendance?: string;
    attentiveness?: string;
    neatness?: string;
    politeness?: string;
    honesty?: string;
    selfControl?: string;
    relationship?: string;
    initiative?: string;
    sports?: string;
    handwriting?: string;
    verbalFluency?: string;
    remarks?: string;
  }>,
  classArmId: string,
  termId: string,
  academicYearId: string,
) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  let saved = 0;
  const errors: string[] = [];

  for (const record of records) {
    const result = await upsertStudentConductAction({
      ...record,
      classArmId,
      termId,
      academicYearId,
    });
    if (result.error) errors.push(`${record.studentId}: ${result.error}`);
    else saved++;
  }

  return { data: { saved, errors } };
}

// ─── Get Class Conduct Records ───────────────────────────────────────

export async function getClassConductAction(classArmId: string, termId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const enrollments = await db.enrollment.findMany({
    where: { classArmId, status: "ACTIVE" },
    include: {
      student: { select: { id: true, studentId: true, firstName: true, lastName: true } },
    },
    orderBy: { student: { lastName: "asc" } },
  });

  const studentIds = enrollments.map((e) => e.studentId);
  const conductRecords = await db.studentConduct.findMany({
    where: { studentId: { in: studentIds }, termId },
  });
  const conductMap = new Map(conductRecords.map((c) => [c.studentId, c]));

  const data = enrollments.map((e) => {
    const conduct = conductMap.get(e.studentId);
    return {
      studentId: e.student.id,
      studentIdNumber: e.student.studentId,
      studentName: `${e.student.lastName} ${e.student.firstName}`,
      conduct: conduct
        ? {
            id: conduct.id,
            punctuality: conduct.punctuality,
            attendance: conduct.attendance,
            attentiveness: conduct.attentiveness,
            neatness: conduct.neatness,
            politeness: conduct.politeness,
            honesty: conduct.honesty,
            selfControl: conduct.selfControl,
            relationship: conduct.relationship,
            initiative: conduct.initiative,
            sports: conduct.sports,
            handwriting: conduct.handwriting,
            verbalFluency: conduct.verbalFluency,
            remarks: conduct.remarks,
          }
        : null,
    };
  });

  return { data };
}

// ─── Get Student Conduct ─────────────────────────────────────────────

export async function getStudentConductAction(studentId: string, termId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const conduct = await db.studentConduct.findFirst({ where: { studentId, termId } });
  if (!conduct) return { data: null };

  return {
    data: {
      id: conduct.id,
      punctuality: conduct.punctuality,
      attendance: conduct.attendance,
      attentiveness: conduct.attentiveness,
      neatness: conduct.neatness,
      politeness: conduct.politeness,
      honesty: conduct.honesty,
      selfControl: conduct.selfControl,
      relationship: conduct.relationship,
      initiative: conduct.initiative,
      sports: conduct.sports,
      handwriting: conduct.handwriting,
      verbalFluency: conduct.verbalFluency,
      remarks: conduct.remarks,
    },
  };
}
