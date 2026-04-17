"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Create or Update Alumni Profile ───────────────────────────────

export async function upsertAlumniProfileAction(data: {
  studentId: string;
  graduationYear: number;
  email?: string;
  phone?: string;
  address?: string;
  currentEmployer?: string;
  currentPosition?: string;
  industry?: string;
  highestEducation?: string;
  linkedinUrl?: string;
  bio?: string;
  isPublic?: boolean;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_CREATE);
  if (denied) return denied;

  // Verify student exists and is graduated
  const student = await db.student.findUnique({ where: { id: data.studentId } });
  if (!student) return { error: "Student not found" };
  if (student.status !== "GRADUATED") {
    return { error: "Only graduated students can have alumni profiles" };
  }

  const profile = await db.alumniProfile.upsert({
    where: { studentId: data.studentId },
    create: {
      studentId: data.studentId,
      schoolId: ctx.schoolId,
      graduationYear: data.graduationYear,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      currentEmployer: data.currentEmployer || null,
      currentPosition: data.currentPosition || null,
      industry: data.industry || null,
      highestEducation: data.highestEducation || null,
      linkedinUrl: data.linkedinUrl || null,
      bio: data.bio || null,
      isPublic: data.isPublic ?? false,
    },
    update: {
      graduationYear: data.graduationYear,
      email: data.email,
      phone: data.phone,
      address: data.address,
      currentEmployer: data.currentEmployer,
      currentPosition: data.currentPosition,
      industry: data.industry,
      highestEducation: data.highestEducation,
      linkedinUrl: data.linkedinUrl,
      bio: data.bio,
      isPublic: data.isPublic,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: profile.createdAt.getTime() === profile.updatedAt.getTime() ? "CREATE" : "UPDATE",
    entity: "AlumniProfile",
    entityId: profile.id,
    module: "graduation",
    description: `Alumni profile for student ${data.studentId}`,
    newData: profile,
  });

  return { data: profile };
}

// ─── Get Alumni Profiles (paginated, searchable) ───────────────────

export async function getAlumniProfilesAction(filters?: {
  search?: string;
  graduationYear?: number;
  industry?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };

  if (filters?.graduationYear) where.graduationYear = filters.graduationYear;
  if (filters?.industry) where.industry = { contains: filters.industry, mode: "insensitive" };

  if (filters?.search) {
    // Search across alumni profile and linked student name
    const matchingStudents = await db.student.findMany({
      where: {
        status: "GRADUATED",
        OR: [
          { firstName: { contains: filters.search, mode: "insensitive" } },
          { lastName: { contains: filters.search, mode: "insensitive" } },
          { studentId: { contains: filters.search, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    where.studentId = { in: matchingStudents.map((s) => s.id) };
  }

  const [profiles, total] = await Promise.all([
    db.alumniProfile.findMany({
      where,
      orderBy: { graduationYear: "desc" },
      skip,
      take: pageSize,
    }),
    db.alumniProfile.count({ where }),
  ]);

  // Enrich with student names
  const studentIds = profiles.map((p) => p.studentId);
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true, studentId: true, gender: true, photoUrl: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const data = profiles.map((p) => {
    const student = studentMap.get(p.studentId);
    return {
      ...p,
      studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown",
      studentCode: student?.studentId ?? "",
      gender: student?.gender ?? null,
      photoUrl: student?.photoUrl ?? null,
    };
  });

  return {
    data,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// ─── Get Single Alumni Profile ─────────────────────────────────────

export async function getAlumniProfileAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_READ);
  if (denied) return denied;

  const profile = await db.alumniProfile.findUnique({
    where: { studentId },
  });

  if (!profile) return { error: "Alumni profile not found" };

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      studentId: true,
      gender: true,
      dateOfBirth: true,
      photoUrl: true,
      enrollmentDate: true,
    },
  });

  // Get graduation record
  const gradRecord = await db.graduationRecord.findFirst({
    where: { studentId, status: "CONFIRMED" },
    include: { batch: { select: { name: true, ceremonyDate: true } } },
  });

  return {
    data: {
      ...profile,
      student,
      graduation: gradRecord
        ? {
            certificateNumber: gradRecord.certificateNumber,
            honours: gradRecord.honours,
            batchName: gradRecord.batch.name,
            ceremonyDate: gradRecord.batch.ceremonyDate,
          }
        : null,
    },
  };
}

// ─── Get Graduation Years (for filter dropdown) ────────────────────

export async function getAlumniGraduationYearsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_READ);
  if (denied) return denied;

  const years = await db.alumniProfile.findMany({
    where: { schoolId: ctx.schoolId },
    select: { graduationYear: true },
    distinct: ["graduationYear"],
    orderBy: { graduationYear: "desc" },
  });

  return { data: years.map((y) => y.graduationYear) };
}
