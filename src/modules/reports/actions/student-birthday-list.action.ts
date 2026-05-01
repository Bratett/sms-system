"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

const ROW_CAP = 5000;

export interface BirthdayRow {
  studentId: string;
  name: string;
  className: string;
  dateOfBirth: Date;
  ageTurning: number;
  daysUntil?: number;
  primaryGuardianPhone?: string | null;
}

function isLeapYear(y: number) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

export async function getStudentBirthdayListAction(filters: {
  academicYearId?: string;
  classArmId?: string;
  month?: number;
  upcomingDays?: number;
  includeGuardianPhone?: boolean;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORTS_ENROLLMENT_READ);
  if (denied) return denied;

  if (filters.month != null && filters.upcomingDays != null) {
    return { error: "Use either month or upcomingDays, not both." };
  }

  let academicYearId = filters.academicYearId;
  if (!academicYearId) {
    const cur = await db.academicYear.findFirst({ where: { schoolId: ctx.schoolId, isCurrent: true } });
    academicYearId = cur?.id;
  }
  if (!academicYearId) return { error: "No academic year found." };

  const today = new Date();
  const todayY = today.getFullYear();
  const todayMonth = today.getMonth() + 1; // 1-12
  const month = filters.month ?? (filters.upcomingDays ? null : todayMonth);

  const where: Record<string, unknown> = {
    academicYearId,
    status: "ACTIVE",
    classArm: { class: { schoolId: ctx.schoolId } },
  };
  if (filters.classArmId) where.classArmId = filters.classArmId;

  const count = await db.enrollment.count({ where });
  if (count > ROW_CAP) return { error: `Result set too large (${count} rows). Apply tighter filters.` };

  const enrollments = await db.enrollment.findMany({
    where,
    select: {
      student: {
        select: {
          id: true, studentId: true, firstName: true, lastName: true, otherNames: true, dateOfBirth: true,
          guardians: filters.includeGuardianPhone ? { select: { isPrimary: true, guardian: { select: { phone: true } } } } : false,
        },
      },
      classArm: { select: { name: true, class: { select: { name: true } } } },
    },
  });

  function adjustedDob(d: Date, year: number) {
    const m = d.getMonth();
    const day = d.getDate();
    if (m === 1 && day === 29 && !isLeapYear(year)) {
      return new Date(year, 1, 28);
    }
    return new Date(year, m, day);
  }

  const rows: BirthdayRow[] = [];
  for (const e of enrollments) {
    const s = e.student;
    const dob = s.dateOfBirth;
    const dobMonth = dob.getMonth() + 1;

    let include = false;
    let daysUntil: number | undefined;

    if (month != null) {
      include = dobMonth === month;
    } else if (filters.upcomingDays != null) {
      const thisYear = adjustedDob(dob, todayY);
      const target = thisYear >= startOfDay(today) ? thisYear : adjustedDob(dob, todayY + 1);
      const diff = Math.ceil((target.getTime() - startOfDay(today).getTime()) / 86400000);
      if (diff >= 0 && diff <= filters.upcomingDays) {
        include = true;
        daysUntil = diff;
      }
    }
    if (!include) continue;

    const primary = filters.includeGuardianPhone
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? ((s as any).guardians?.find((g: { isPrimary: boolean }) => g.isPrimary) ?? (s as any).guardians?.[0] ?? null)
      : null;

    rows.push({
      studentId: s.studentId,
      name: [s.firstName, s.otherNames, s.lastName].filter(Boolean).join(" "),
      className: `${e.classArm.class.name} ${e.classArm.name}`,
      dateOfBirth: dob,
      ageTurning: todayY - dob.getFullYear(),
      daysUntil,
      primaryGuardianPhone: primary?.guardian?.phone ?? null,
    });
  }

  rows.sort((a, b) => {
    if (filters.upcomingDays != null) return (a.daysUntil ?? 9999) - (b.daysUntil ?? 9999);
    // Day of year ascending
    const ad = (a.dateOfBirth.getMonth() * 31) + a.dateOfBirth.getDate();
    const bd = (b.dateOfBirth.getMonth() * 31) + b.dateOfBirth.getDate();
    return ad - bd;
  });

  return { data: { rows, total: rows.length, mode: filters.upcomingDays != null ? "upcomingDays" : "month", appliedMonth: month, appliedUpcomingDays: filters.upcomingDays } };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
