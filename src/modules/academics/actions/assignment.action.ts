"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Teacher-Subject-Class Assignments ───────────────────────────────

export async function getTeacherAssignmentsAction(
  academicYearId?: string,
  termId?: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUBJECTS_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = {};
  if (academicYearId) where.academicYearId = academicYearId;
  if (termId) where.termId = termId;

  const assignments = await db.teacherSubjectAssignment.findMany({
    where,
    include: {
      subject: {
        select: { id: true, name: true, code: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch teacher (User) info and class arm info
  const staffIds = [...new Set(assignments.map((a) => a.staffId))];
  const classArmIds = [...new Set(assignments.map((a) => a.classArmId))];

  const [users, classArms] = await Promise.all([
    db.user.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.classArm.findMany({
      where: { id: { in: classArmIds } },
      select: {
        id: true,
        name: true,
        class: { select: { id: true, name: true } },
      },
    }),
  ]);

  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  const classArmMap = new Map(
    classArms.map((ca) => [ca.id, { armName: ca.name, className: ca.class.name }]),
  );

  const data = assignments.map((a) => {
    const classArmInfo = classArmMap.get(a.classArmId);
    return {
      id: a.id,
      staffId: a.staffId,
      teacherName: userMap.get(a.staffId) ?? "Unknown",
      subjectId: a.subjectId,
      subjectName: a.subject.name,
      subjectCode: a.subject.code,
      classArmId: a.classArmId,
      classArmName: classArmInfo
        ? `${classArmInfo.className} ${classArmInfo.armName}`
        : "Unknown",
      academicYearId: a.academicYearId,
      termId: a.termId,
      createdAt: a.createdAt,
    };
  });

  return { data };
}

export async function createTeacherAssignmentAction(data: {
  staffId: string;
  subjectId: string;
  classArmId: string;
  academicYearId: string;
  termId?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUBJECTS_CREATE);
  if (denied) return denied;

  // Check for duplicate assignment
  const existing = await db.teacherSubjectAssignment.findUnique({
    where: {
      staffId_subjectId_classArmId_academicYearId: {
        staffId: data.staffId,
        subjectId: data.subjectId,
        classArmId: data.classArmId,
        academicYearId: data.academicYearId,
      },
    },
  });

  if (existing) {
    return { error: "This teacher is already assigned to this subject and class." };
  }

  const assignment = await db.teacherSubjectAssignment.create({
    data: {
      schoolId: ctx.schoolId,
      staffId: data.staffId,
      subjectId: data.subjectId,
      classArmId: data.classArmId,
      academicYearId: data.academicYearId,
      termId: data.termId || null,
    },
  });

  // Get teacher name and subject name for audit
  const [teacher, subject] = await Promise.all([
    db.user.findUnique({
      where: { id: data.staffId },
      select: { firstName: true, lastName: true },
    }),
    db.subject.findUnique({
      where: { id: data.subjectId },
      select: { name: true },
    }),
  ]);
  const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : "Unknown";

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "TeacherSubjectAssignment",
    entityId: assignment.id,
    module: "academics",
    description: `Assigned ${teacherName} to teach "${subject?.name ?? "Unknown"}"`,
    newData: assignment,
  });

  return { data: assignment };
}

export async function deleteTeacherAssignmentAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUBJECTS_CREATE);
  if (denied) return denied;

  const existing = await db.teacherSubjectAssignment.findUnique({
    where: { id },
    include: {
      subject: { select: { name: true } },
    },
  });

  if (!existing) {
    return { error: "Assignment not found." };
  }

  await db.teacherSubjectAssignment.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id!,
    action: "DELETE",
    entity: "TeacherSubjectAssignment",
    entityId: id,
    module: "academics",
    description: `Removed teacher assignment for "${existing.subject.name}"`,
    previousData: existing,
  });

  return { success: true };
}

export async function getTeachersAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUBJECTS_READ);
  if (denied) return denied;

  // Find users who have a "teacher" or "subject_teacher" role
  const teacherRoles = await db.role.findMany({
    where: {
      name: { in: ["teacher", "subject_teacher"] },
    },
    select: { id: true },
  });

  const roleIds = teacherRoles.map((r) => r.id);

  if (roleIds.length === 0) {
    // Fallback: return all active users if no teacher roles exist
    const allUsers = await db.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    return {
      data: allUsers.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
      })),
    };
  }

  const userRoles = await db.userRole.findMany({
    where: { roleId: { in: roleIds } },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, status: true },
      },
    },
  });

  // Deduplicate users
  const uniqueUsers = new Map<string, { id: string; name: string }>();
  for (const ur of userRoles) {
    if (ur.user.status === "ACTIVE" && !uniqueUsers.has(ur.user.id)) {
      uniqueUsers.set(ur.user.id, {
        id: ur.user.id,
        name: `${ur.user.firstName} ${ur.user.lastName}`,
      });
    }
  }

  const data = Array.from(uniqueUsers.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return { data };
}

export async function getTeacherWorkloadAction(staffId: string, academicYearId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUBJECTS_READ);
  if (denied) return denied;

  const assignments = await db.teacherSubjectAssignment.findMany({
    where: { staffId, academicYearId },
    include: {
      subject: {
        select: { id: true, name: true, code: true },
      },
    },
  });

  const classArmIds = assignments.map((a) => a.classArmId);
  const classArms = await db.classArm.findMany({
    where: { id: { in: classArmIds } },
    select: {
      id: true,
      name: true,
      class: { select: { name: true } },
    },
  });

  const classArmMap = new Map(
    classArms.map((ca) => [ca.id, `${ca.class.name} ${ca.name}`]),
  );

  const data = assignments.map((a) => ({
    id: a.id,
    subjectName: a.subject.name,
    subjectCode: a.subject.code,
    classArmName: classArmMap.get(a.classArmId) ?? "Unknown",
    termId: a.termId,
  }));

  return { data, count: data.length };
}
