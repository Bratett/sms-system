"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Get Graduation Batches ─────────────────────────────────────────

export async function getGraduationBatchesAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const batches = await db.graduationBatch.findMany({
    where: { schoolId: school.id },
    include: {
      _count: { select: { records: true } },
      records: {
        include: {
          batch: false,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get academic year names
  const yearIds = [...new Set(batches.map((b) => b.academicYearId))];
  let yearMap = new Map<string, string>();
  if (yearIds.length > 0) {
    const years = await db.academicYear.findMany({
      where: { id: { in: yearIds } },
      select: { id: true, name: true },
    });
    yearMap = new Map(years.map((y) => [y.id, y.name]));
  }

  // Get student names for records
  const allStudentIds = batches.flatMap((b) => b.records.map((r) => r.studentId));
  let studentMap = new Map<string, { firstName: string; lastName: string; studentId: string }>();
  if (allStudentIds.length > 0) {
    const students = await db.student.findMany({
      where: { id: { in: allStudentIds } },
      select: { id: true, firstName: true, lastName: true, studentId: true },
    });
    studentMap = new Map(students.map((s) => [s.id, s]));
  }

  const data = batches.map((b) => ({
    id: b.id,
    name: b.name,
    academicYearId: b.academicYearId,
    academicYearName: yearMap.get(b.academicYearId) ?? "Unknown",
    ceremonyDate: b.ceremonyDate,
    status: b.status,
    recordCount: b._count.records,
    confirmedCount: b.records.filter((r) => r.status === "CONFIRMED").length,
    records: b.records.map((r) => {
      const student = studentMap.get(r.studentId);
      return {
        id: r.id,
        studentId: r.studentId,
        studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown",
        studentCode: student?.studentId ?? "",
        certificateNumber: r.certificateNumber,
        honours: r.honours,
        status: r.status,
      };
    }),
    createdAt: b.createdAt,
  }));

  return { data };
}

// ─── Create Graduation Batch ────────────────────────────────────────

export async function createGraduationBatchAction(data: {
  academicYearId: string;
  name: string;
  ceremonyDate?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const batch = await db.graduationBatch.create({
    data: {
      schoolId: school.id,
      academicYearId: data.academicYearId,
      name: data.name,
      ceremonyDate: data.ceremonyDate ? new Date(data.ceremonyDate) : null,
      status: "PENDING",
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "GraduationBatch",
    entityId: batch.id,
    module: "graduation",
    description: `Created graduation batch "${batch.name}"`,
    newData: batch,
  });

  return { data: batch };
}

// ─── Add Graduates to Batch ─────────────────────────────────────────

export async function addGraduatesToBatchAction(batchId: string, studentIds: string[]) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const batch = await db.graduationBatch.findUnique({ where: { id: batchId } });
  if (!batch) {
    return { error: "Batch not found." };
  }

  if (batch.status === "COMPLETED") {
    return { error: "Cannot add to a completed batch." };
  }

  // Verify students are SHS 3 or GRADUATED
  const students = await db.student.findMany({
    where: {
      id: { in: studentIds },
      schoolId: batch.schoolId,
    },
    select: { id: true, firstName: true, lastName: true, status: true },
  });

  if (students.length === 0) {
    return { error: "No valid students found." };
  }

  // Filter to eligible students (ACTIVE or GRADUATED status)
  const eligible = students.filter(
    (s) => s.status === "ACTIVE" || s.status === "GRADUATED" || s.status === "COMPLETED",
  );

  if (eligible.length === 0) {
    return { error: "No eligible students found. Students must be active or graduated." };
  }

  // Check for existing records
  const existing = await db.graduationRecord.findMany({
    where: {
      graduationBatchId: batchId,
      studentId: { in: eligible.map((s) => s.id) },
    },
    select: { studentId: true },
  });
  const existingIds = new Set(existing.map((e) => e.studentId));
  const newStudents = eligible.filter((s) => !existingIds.has(s.id));

  if (newStudents.length === 0) {
    return { error: "All selected students are already in this batch." };
  }

  const records = newStudents.map((s) => ({
    graduationBatchId: batchId,
    studentId: s.id,
    status: "PENDING",
  }));

  await db.graduationRecord.createMany({ data: records });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "GraduationRecord",
    module: "graduation",
    description: `Added ${newStudents.length} graduates to batch "${batch.name}"`,
    metadata: { batchId, addedCount: newStudents.length },
  });

  return { data: { added: newStudents.length } };
}

// ─── Confirm Graduate ───────────────────────────────────────────────

export async function confirmGraduateAction(
  recordId: string,
  data: { certificateNumber?: string; honours?: string },
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const record = await db.graduationRecord.findUnique({
    where: { id: recordId },
    include: { batch: true },
  });

  if (!record) {
    return { error: "Record not found." };
  }

  const updated = await db.graduationRecord.update({
    where: { id: recordId },
    data: {
      status: "CONFIRMED",
      certificateNumber: data.certificateNumber || record.certificateNumber,
      honours: data.honours || record.honours,
    },
  });

  // Update student status to GRADUATED
  await db.student.update({
    where: { id: record.studentId },
    data: { status: "GRADUATED" },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "GraduationRecord",
    entityId: recordId,
    module: "graduation",
    description: `Confirmed graduate record`,
    previousData: record,
    newData: updated,
  });

  return { data: updated };
}

// ─── Complete Batch ─────────────────────────────────────────────────

export async function completeBatchAction(batchId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const batch = await db.graduationBatch.findUnique({
    where: { id: batchId },
    include: { _count: { select: { records: true } } },
  });

  if (!batch) {
    return { error: "Batch not found." };
  }

  const updated = await db.graduationBatch.update({
    where: { id: batchId },
    data: { status: "COMPLETED" },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "GraduationBatch",
    entityId: batchId,
    module: "graduation",
    description: `Completed graduation batch "${batch.name}" with ${batch._count.records} graduates`,
    previousData: batch,
    newData: updated,
  });

  return { data: updated };
}

// ─── Get Alumni ─────────────────────────────────────────────────────

export async function getAlumniAction(search?: string, page?: number, pageSize?: number) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const p = page ?? 1;
  const ps = pageSize ?? 20;
  const skip = (p - 1) * ps;

  const where: Record<string, unknown> = {
    schoolId: school.id,
    status: "GRADUATED",
  };

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { studentId: { contains: search, mode: "insensitive" } },
    ];
  }

  const [students, total] = await Promise.all([
    db.student.findMany({
      where,
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        gender: true,
        enrollmentDate: true,
      },
      orderBy: { lastName: "asc" },
      skip,
      take: ps,
    }),
    db.student.count({ where }),
  ]);

  // Get graduation records for these students
  const studentIds = students.map((s) => s.id);
  let gradRecordMap = new Map<
    string,
    { certificateNumber: string | null; honours: string | null; batchName: string }
  >();
  if (studentIds.length > 0) {
    const records = await db.graduationRecord.findMany({
      where: {
        studentId: { in: studentIds },
        status: "CONFIRMED",
      },
      include: { batch: { select: { name: true } } },
    });
    gradRecordMap = new Map(
      records.map((r) => [
        r.studentId,
        {
          certificateNumber: r.certificateNumber,
          honours: r.honours,
          batchName: r.batch.name,
        },
      ]),
    );
  }

  const data = students.map((s) => {
    const gradInfo = gradRecordMap.get(s.id);
    return {
      ...s,
      certificateNumber: gradInfo?.certificateNumber ?? null,
      honours: gradInfo?.honours ?? null,
      batchName: gradInfo?.batchName ?? null,
    };
  });

  return {
    data,
    pagination: {
      page: p,
      pageSize: ps,
      total,
      totalPages: Math.ceil(total / ps),
    },
  };
}

// ─── Search SHS 3 Students ─────────────────────────────────────────

export async function searchGraduationEligibleStudentsAction(search: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  if (!search || search.length < 2) {
    return { data: [] };
  }

  // Get SHS 3 students (yearGroup 3)
  const currentYear = await db.academicYear.findFirst({
    where: { schoolId: school.id, isCurrent: true },
  });

  if (!currentYear) {
    return { data: [] };
  }

  const enrollments = await db.enrollment.findMany({
    where: {
      academicYearId: currentYear.id,
      status: "ACTIVE",
      classArm: {
        class: { yearGroup: 3 },
      },
      student: {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { studentId: { contains: search, mode: "insensitive" } },
        ],
      },
    },
    include: {
      student: {
        select: { id: true, studentId: true, firstName: true, lastName: true },
      },
    },
    take: 20,
  });

  const data = enrollments.map((e) => ({
    id: e.student.id,
    studentId: e.student.studentId,
    firstName: e.student.firstName,
    lastName: e.student.lastName,
  }));

  return { data };
}

// ─── Get Academic Years (for dropdown) ──────────────────────────────

export async function getAcademicYearsForGraduationAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const years = await db.academicYear.findMany({
    where: { schoolId: school.id },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, isCurrent: true },
  });

  return { data: years };
}
