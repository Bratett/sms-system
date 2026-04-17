import { db } from "@/lib/db";
import type {
  EmployerContext,
  StatutoryReturn,
  StatutoryReturnPeriod,
} from "../types";

/**
 * GES staffing return.
 *
 * Lists all staff on the roster at the end of the period. For teaching staff
 * we include category + NTC licence status so GES can see which posts are
 * held by licenced teachers.
 */

export interface StaffingReturnRow {
  staffRef: string;
  fullName: string;
  staffType: string;
  departmentName: string | null;
  appointmentType: string | null;
  ntcNumber: string | null;
  ntcCategory: string | null;
  ntcExpiresAt: Date | null;
  ntcStatus: string | null;
  status: string;
}

export async function generateStaffingReturn(
  schoolId: string,
  employer: EmployerContext,
  period: StatutoryReturnPeriod,
): Promise<StatutoryReturn<StaffingReturnRow>> {
  const staff = await db.staff.findMany({
    where: {
      schoolId,
      OR: [{ deletedAt: null }, { deletedAt: { gt: period.to } }],
    },
    include: {
      teacherLicences: {
        orderBy: { expiresAt: "desc" },
        take: 1,
      },
    },
  });

  const rows: StaffingReturnRow[] = staff.map((s) => {
    const latest = s.teacherLicences[0];
    return {
      staffRef: s.staffId,
      fullName: `${s.firstName} ${s.lastName}`,
      staffType: String(s.staffType),
      departmentName: null, // staff → employment → department requires a separate lookup; omit in v1
      appointmentType: null,
      ntcNumber: latest?.ntcNumber ?? null,
      ntcCategory: latest?.category ?? null,
      ntcExpiresAt: latest?.expiresAt ?? null,
      ntcStatus: latest?.status ? String(latest.status) : null,
      status: String(s.status),
    };
  });

  const teaching = rows.filter((r) => r.staffType === "TEACHING");
  const nonTeaching = rows.filter((r) => r.staffType !== "TEACHING");
  const licenced = teaching.filter((r) => r.ntcStatus === "ACTIVE").length;

  return {
    kind: "GH_GES_STAFFING",
    period,
    employer,
    rows,
    totals: {
      total: rows.length,
      teaching: teaching.length,
      nonTeaching: nonTeaching.length,
      teachingLicenced: licenced,
      teachingUnlicenced: teaching.length - licenced,
    },
    generatedAt: new Date(),
  };
}
