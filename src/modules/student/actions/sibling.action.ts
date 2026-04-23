"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

/**
 * @no-audit Read-only sibling lookup — no side effects.
 */
export async function getSiblingsAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_READ);
  if (denied) return denied;

  const student = await db.student.findFirst({
    where: { id: studentId, schoolId: ctx.schoolId },
    select: { id: true, householdId: true },
  });
  if (!student) return { error: "Student not found" };

  if (student.householdId === null) {
    return { data: [] };
  }

  const siblings = await db.student.findMany({
    where: {
      householdId: student.householdId,
      schoolId: ctx.schoolId,
      id: { not: studentId },
      status: { not: "WITHDRAWN" },
    },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      status: true,
      enrollments: {
        where: { status: "ACTIVE" },
        take: 1,
        select: {
          classArm: {
            select: {
              name: true,
              class: {
                select: {
                  name: true,
                  programme: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { firstName: "asc" },
  });

  return {
    data: siblings.map((s) => {
      const enr = s.enrollments[0];
      const className = enr?.classArm.class.name ?? null;
      const armName = enr?.classArm.name ?? null;
      return {
        id: s.id,
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        status: s.status,
        classArmName: className && armName ? `${className} ${armName}` : className,
        programmeName: enr?.classArm.class.programme?.name ?? null,
      };
    }),
  };
}
