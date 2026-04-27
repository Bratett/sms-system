"use server";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission, type Permission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  updateMyAlumniProfileSchema,
  type UpdateMyAlumniProfileInput,
} from "../schemas/alumni-self.schema";
import type { Session } from "next-auth";

// ─── Private helper ──────────────────────────────────────────────────

/**
 * Verify the caller holds `permission` and is a GRADUATED student at this
 * school. Returns `{ student }` on success or `{ error }` on failure.
 *
 * Mirrors the `verifyParentAccess` convention in portal/actions/parent.action.ts.
 */
async function assertAlumnusAccess(
  ctx: { session: Session; schoolId: string },
  permission: Permission,
  select: Record<string, true>,
): Promise<{ student: Record<string, unknown> } | { error: string }> {
  const denied = assertPermission(ctx.session, permission);
  if (denied) return denied;

  const student = await db.student.findFirst({
    where: { userId: ctx.session.user.id, schoolId: ctx.schoolId, status: "GRADUATED" },
    select,
  });
  if (!student) {
    console.error("alumni: status check failed", {
      userId: ctx.session.user.id,
      permission,
    });
    return { error: "Alumni access not available." };
  }
  return { student: student as Record<string, unknown> };
}

// ─── Get my profile ─────────────────────────────────────────────────

/** @no-audit Read-only alumni self-view. */
export async function getMyAlumniProfileAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const access = await assertAlumnusAccess(ctx, PERMISSIONS.ALUMNI_PROFILE_UPDATE_OWN, {
    id: true,
    firstName: true,
    lastName: true,
    studentId: true,
    photoUrl: true,
    dateOfBirth: true,
  });
  if ("error" in access) return access;
  const student = access.student as {
    id: string;
    firstName: string;
    lastName: string;
    studentId: string;
    photoUrl: string | null;
    dateOfBirth: Date;
  };

  const profile = await db.alumniProfile.findUnique({
    where: { studentId: student.id },
  });
  if (!profile) return { error: "Alumni profile not found" };

  const gradRecord = await db.graduationRecord.findFirst({
    where: { studentId: student.id, status: "CONFIRMED" },
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

// ─── Update my profile ──────────────────────────────────────────────

export async function updateMyAlumniProfileAction(input: UpdateMyAlumniProfileInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const parsed = updateMyAlumniProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const access = await assertAlumnusAccess(ctx, PERMISSIONS.ALUMNI_PROFILE_UPDATE_OWN, {
    id: true,
  });
  if ("error" in access) return access;
  const student = access.student as { id: string };

  const previous = await db.alumniProfile.findUnique({
    where: { studentId: student.id },
  });
  if (!previous) return { error: "Alumni profile not found" };

  const data: Prisma.AlumniProfileUpdateInput = {};
  if (parsed.data.email !== undefined) data.email = parsed.data.email;
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone;
  if (parsed.data.address !== undefined) data.address = parsed.data.address;
  if (parsed.data.currentEmployer !== undefined) data.currentEmployer = parsed.data.currentEmployer;
  if (parsed.data.currentPosition !== undefined) data.currentPosition = parsed.data.currentPosition;
  if (parsed.data.industry !== undefined) data.industry = parsed.data.industry;
  if (parsed.data.highestEducation !== undefined) data.highestEducation = parsed.data.highestEducation;
  if (parsed.data.linkedinUrl !== undefined) {
    data.linkedinUrl = parsed.data.linkedinUrl === "" ? null : parsed.data.linkedinUrl;
  }
  if (parsed.data.bio !== undefined) data.bio = parsed.data.bio;
  if (parsed.data.isPublic !== undefined) data.isPublic = parsed.data.isPublic;

  const updated = await db.alumniProfile.update({
    where: { studentId: student.id },
    data,
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "AlumniProfile",
    entityId: updated.id,
    module: "alumni",
    description: `Alumnus updated own profile`,
    previousData: previous,
    newData: updated,
  });

  return { data: updated };
}

// ─── Directory ──────────────────────────────────────────────────────

/** @no-audit Read-only alumni directory. */
export async function getAlumniDirectoryAction(filters?: {
  search?: string;
  graduationYear?: number;
  industry?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const access = await assertAlumnusAccess(ctx, PERMISSIONS.ALUMNI_DIRECTORY_READ, {
    id: true,
  });
  if ("error" in access) return access;
  const ownStudent = access.student as { id: string };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {
    schoolId: ctx.schoolId,
    isPublic: true,
  };
  if (filters?.graduationYear) where.graduationYear = filters.graduationYear;
  if (filters?.industry) {
    where.industry = { contains: filters.industry, mode: "insensitive" };
  }

  if (filters?.search) {
    // Search path: resolve matching student IDs (excluding self) and constrain via { in }
    const matchingStudents = await db.student.findMany({
      where: {
        status: "GRADUATED",
        schoolId: ctx.schoolId,
        OR: [
          { firstName: { contains: filters.search, mode: "insensitive" } },
          { lastName: { contains: filters.search, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    where.studentId = {
      in: matchingStudents.map((s) => s.id).filter((id) => id !== ownStudent.id),
    };
  } else {
    // No search: exclude self via { not }
    where.studentId = { not: ownStudent.id };
  }

  const [profiles, total] = await Promise.all([
    db.alumniProfile.findMany({
      where,
      orderBy: { graduationYear: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        studentId: true,
        graduationYear: true,
        currentEmployer: true,
        currentPosition: true,
        industry: true,
        highestEducation: true,
        linkedinUrl: true,
        bio: true,
      },
    }),
    db.alumniProfile.count({ where }),
  ]);

  const studentIds = profiles.map((p) => p.studentId);
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true, photoUrl: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const data = profiles.map((p) => ({
    ...p,
    firstName: studentMap.get(p.studentId)?.firstName ?? "",
    lastName: studentMap.get(p.studentId)?.lastName ?? "",
    photoUrl: studentMap.get(p.studentId)?.photoUrl ?? null,
  }));

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// ─── Single public profile ──────────────────────────────────────────

/** @no-audit Read-only single public alumnus view. */
export async function getPublicAlumniProfileAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const access = await assertAlumnusAccess(ctx, PERMISSIONS.ALUMNI_DIRECTORY_READ, {
    id: true,
  });
  if ("error" in access) return access;

  const profile = await db.alumniProfile.findUnique({
    where: { studentId },
    select: {
      id: true,
      studentId: true,
      schoolId: true,
      graduationYear: true,
      isPublic: true,
      currentEmployer: true,
      currentPosition: true,
      industry: true,
      highestEducation: true,
      linkedinUrl: true,
      bio: true,
    },
  });
  if (!profile || profile.schoolId !== ctx.schoolId || !profile.isPublic) {
    return { error: "Profile not found" };
  }

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { firstName: true, lastName: true, photoUrl: true },
  });
  if (!student) return { error: "Profile not found" };

  return {
    data: {
      id: profile.id,
      studentId: profile.studentId,
      graduationYear: profile.graduationYear,
      currentEmployer: profile.currentEmployer,
      currentPosition: profile.currentPosition,
      industry: profile.industry,
      highestEducation: profile.highestEducation,
      linkedinUrl: profile.linkedinUrl,
      bio: profile.bio,
      firstName: student.firstName,
      lastName: student.lastName,
      photoUrl: student.photoUrl,
    },
  };
}
