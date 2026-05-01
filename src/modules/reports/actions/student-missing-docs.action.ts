"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

const ROW_CAP = 5000;

export interface MissingDocsRow {
  studentId: string;
  name: string;
  className: string;
  missingTypes: string[];
  expiredTypes: { name: string; expiredOn: Date | null }[];
}

export async function getStudentMissingDocsAction(filters: {
  academicYearId?: string;
  classArmId?: string;
  documentTypeId?: string;
  includeExpired?: boolean;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORTS_ENROLLMENT_READ);
  if (denied) return denied;

  const includeExpired = filters.includeExpired ?? true;

  let academicYearId = filters.academicYearId;
  if (!academicYearId) {
    const cur = await db.academicYear.findFirst({ where: { schoolId: ctx.schoolId, isCurrent: true } });
    academicYearId = cur?.id;
  }
  if (!academicYearId) return { error: "No academic year found." };

  const docTypeWhere: Record<string, unknown> = {
    schoolId: ctx.schoolId,
    status: "ACTIVE",
    isRequired: true,
  };
  if (filters.documentTypeId) docTypeWhere.id = filters.documentTypeId;

  const requiredTypes = await db.documentType.findMany({
    where: docTypeWhere,
    select: { id: true, name: true, appliesTo: true, expiryMonths: true },
  });

  if (requiredTypes.length === 0) {
    return { data: { rows: [], total: 0, note: "no required document types configured" } };
  }

  const enrolWhere: Record<string, unknown> = {
    academicYearId, status: "ACTIVE", classArm: { class: { schoolId: ctx.schoolId } },
  };
  if (filters.classArmId) enrolWhere.classArmId = filters.classArmId;

  const count = await db.enrollment.count({ where: enrolWhere });
  if (count > ROW_CAP) return { error: `Result set too large (${count} rows). Apply tighter filters.` };

  const enrollments = await db.enrollment.findMany({
    where: enrolWhere,
    select: {
      student: {
        select: {
          id: true, studentId: true, firstName: true, lastName: true, otherNames: true,
          boardingStatus: true,
          studentDocuments: {
            select: { documentTypeId: true, verificationStatus: true, expiresAt: true },
          },
        },
      },
      classArm: { select: { name: true, class: { select: { name: true } } } },
    },
  });

  const now = new Date();
  const rows: MissingDocsRow[] = [];

  for (const e of enrollments) {
    const s = e.student;
    const applicable = requiredTypes.filter((t) => {
      if (t.appliesTo === "ALL") return true;
      if (t.appliesTo === "BOARDING_ONLY") return s.boardingStatus === "BOARDING";
      if (t.appliesTo === "DAY_ONLY") return s.boardingStatus === "DAY";
      return false;
    });

    const missing: string[] = [];
    const expired: { name: string; expiredOn: Date | null }[] = [];

    for (const t of applicable) {
      const docs = s.studentDocuments.filter((d) => d.documentTypeId === t.id);
      const verified = docs.filter((d) => d.verificationStatus === "VERIFIED");
      if (verified.length === 0) {
        missing.push(t.name);
        continue;
      }
      if (includeExpired) {
        const allExpired = verified.every((d) => d.expiresAt && d.expiresAt < now);
        if (allExpired && verified[0]?.expiresAt) {
          expired.push({ name: t.name, expiredOn: verified[0].expiresAt });
        }
      }
    }

    if (missing.length === 0 && expired.length === 0) continue;

    rows.push({
      studentId: s.studentId,
      name: [s.firstName, s.otherNames, s.lastName].filter(Boolean).join(" "),
      className: `${e.classArm.class.name} ${e.classArm.name}`,
      missingTypes: missing,
      expiredTypes: expired,
    });
  }

  rows.sort((a, b) => (b.missingTypes.length + b.expiredTypes.length) - (a.missingTypes.length + a.expiredTypes.length));
  return { data: { rows, total: rows.length } };
}
