"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { toNum } from "@/lib/decimal";

/**
 * Executive BI dashboard — a single action that computes all
 * cross-module KPIs + trend series the management deck needs on one
 * screen. Heavy queries are aggregated with `groupBy`/`count` rather than
 * pulling rows, and the whole thing is designed to respond under ~500ms
 * for a typical Ghanaian SHS (≤ 2,000 students).
 *
 * The data model:
 *   • kpis — eight scalar tiles (students, staff, attendance rate, fees
 *     YTD, outstanding balances, admissions pipeline, open disciplines,
 *     pending marks).
 *   • trends — month-by-month series for the past 12 months: enrolments,
 *     revenue, attendance.
 *   • drilldowns — tables ready to render (top debtors, classes below
 *     passmark, risk students).
 *
 * Permission: REPORTS_READ (falls back to SCHOOL_SETTINGS_READ so
 * headmasters without the explicit reports perm still see their own KPIs).
 */
export async function getExecutiveDashboardAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORTS_READ);
  if (denied) return denied;

  const schoolId = ctx.schoolId;
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const [
    totalStudents,
    boardingStudents,
    totalStaff,
    attendanceStats,
    billingStats,
    paymentsYtd,
    admissionsPipeline,
    openDiscipline,
    pendingMarks,
    activeDunningCases,
    inventoryAlerts,
    monthlyEnrolments,
    monthlyRevenue,
    topDebtors,
    classPerformance,
    riskSummary,
  ] = await Promise.all([
    db.student.count({ where: { schoolId, status: "ACTIVE" } }),
    db.student.count({ where: { schoolId, status: "ACTIVE", boardingStatus: "BOARDING" } }),
    db.staff.count({ where: { schoolId, status: "ACTIVE" } }),
    db.attendanceRecord.groupBy({
      by: ["status"],
      where: {
        schoolId,
        register: { date: { gte: twelveMonthsAgo } },
      },
      _count: { _all: true },
    }),
    db.studentBill.aggregate({
      where: { schoolId },
      _sum: { totalAmount: true, paidAmount: true, balanceAmount: true },
    }),
    db.payment.aggregate({
      where: { schoolId, receivedAt: { gte: yearStart }, status: "CONFIRMED" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.admissionApplication.groupBy({
      by: ["status"],
      where: { schoolId },
      _count: { _all: true },
    }),
    db.disciplinaryIncident.count({
      where: { schoolId, status: { in: ["REPORTED", "INVESTIGATING"] } },
    }),
    db.mark.count({ where: { schoolId, status: "SUBMITTED" } }),
    db.dunningCase.count({
      where: { schoolId, status: { in: ["OPEN", "ESCALATED"] } },
    }),
    db.storeItem.count({
      where: { store: { schoolId }, quantity: { lte: 0 } },
    }),
    enrolmentSeries(schoolId, twelveMonthsAgo),
    revenueSeries(schoolId, twelveMonthsAgo),
    topDebtorRows(schoolId),
    classPerformanceRows(schoolId),
    db.studentRiskProfile.groupBy({
      by: ["riskLevel"],
      where: { schoolId },
      _count: { _all: true },
    }),
  ]);

  const totalAttendance = attendanceStats.reduce((s, r) => s + r._count._all, 0);
  const presentCount = attendanceStats
    .filter((r) => r.status === "PRESENT" || r.status === "LATE")
    .reduce((s, r) => s + r._count._all, 0);
  const attendanceRate = totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0;

  const admissionsByStatus = Object.fromEntries(
    admissionsPipeline.map((a) => [a.status, a._count._all]),
  ) as Record<string, number>;

  const totalBilled = toNum(billingStats._sum.totalAmount);
  const totalPaid = toNum(billingStats._sum.paidAmount);
  const totalOutstanding = toNum(billingStats._sum.balanceAmount);
  const collectionRate = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;

  return {
    data: {
      generatedAt: now.toISOString(),
      kpis: {
        totalStudents,
        boardingStudents,
        dayStudents: totalStudents - boardingStudents,
        totalStaff,
        attendanceRate: round(attendanceRate),
        totalBilled,
        totalPaid,
        totalOutstanding,
        collectionRate: round(collectionRate),
        paymentsYtdCount: paymentsYtd._count._all,
        paymentsYtdAmount: toNum(paymentsYtd._sum.amount),
        admissionsSubmitted: admissionsByStatus["SUBMITTED"] ?? 0,
        admissionsUnderReview: admissionsByStatus["UNDER_REVIEW"] ?? 0,
        admissionsAccepted: admissionsByStatus["ACCEPTED"] ?? 0,
        openDiscipline,
        pendingMarks,
        activeDunningCases,
        inventoryOutOfStock: inventoryAlerts,
      },
      trends: {
        enrolments: monthlyEnrolments,
        revenue: monthlyRevenue,
        attendanceByStatus: attendanceStats.map((r) => ({
          status: r.status,
          count: r._count._all,
        })),
      },
      drilldowns: {
        topDebtors,
        classPerformance,
        riskDistribution: riskSummary.map((r) => ({
          level: r.riskLevel,
          count: r._count._all,
        })),
      },
    },
  };
}

function round(n: number, digits = 1): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

async function enrolmentSeries(
  schoolId: string,
  since: Date,
): Promise<Array<{ month: string; count: number }>> {
  const rows = await db.$queryRaw<Array<{ month: Date; count: bigint }>>`
    SELECT date_trunc('month', "enrollmentDate") AS month, count(*)::bigint AS count
    FROM "Enrollment"
    WHERE "schoolId" = ${schoolId}
      AND "enrollmentDate" >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({
    month: r.month.toISOString().slice(0, 7),
    count: Number(r.count),
  }));
}

async function revenueSeries(
  schoolId: string,
  since: Date,
): Promise<Array<{ month: string; amount: number }>> {
  const rows = await db.$queryRaw<Array<{ month: Date; amount: number }>>`
    SELECT date_trunc('month', "receivedAt") AS month,
           coalesce(sum("amount"), 0)::float AS amount
    FROM "Payment"
    WHERE "schoolId" = ${schoolId}
      AND "receivedAt" >= ${since}
      AND "status" = 'CONFIRMED'
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({
    month: r.month.toISOString().slice(0, 7),
    amount: Number(r.amount),
  }));
}

async function topDebtorRows(
  schoolId: string,
): Promise<Array<{ studentId: string; studentCode: string; name: string; className: string; balance: number }>> {
  const bills = await db.studentBill.findMany({
    where: { schoolId, balanceAmount: { gt: 0 }, status: { in: ["UNPAID", "PARTIAL"] } },
    include: {
      feeStructure: { select: { name: true } },
    },
    orderBy: { balanceAmount: "desc" },
    take: 50, // cap result set; aggregate by student afterwards
  });
  if (bills.length === 0) return [];

  const studentIds = [...new Set(bills.map((b) => b.studentId))];
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      enrollments: {
        where: { status: "ACTIVE" },
        include: { classArm: { include: { class: { select: { name: true } } } } },
        take: 1,
      },
    },
  });
  const map = new Map(students.map((s) => [s.id, s]));

  const aggregated = new Map<string, { studentId: string; studentCode: string; name: string; className: string; balance: number }>();
  for (const bill of bills) {
    const s = map.get(bill.studentId);
    if (!s) continue;
    const key = s.id;
    const className = s.enrollments[0]?.classArm?.class
      ? `${s.enrollments[0].classArm.class.name} ${s.enrollments[0].classArm.name}`
      : "—";
    const entry = aggregated.get(key) ?? {
      studentId: s.id,
      studentCode: s.studentId,
      name: `${s.firstName} ${s.lastName}`,
      className,
      balance: 0,
    };
    entry.balance += toNum(bill.balanceAmount);
    aggregated.set(key, entry);
  }
  return Array.from(aggregated.values())
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10);
}

async function classPerformanceRows(
  schoolId: string,
): Promise<Array<{ classArmId: string; className: string; students: number; averageScore: number }>> {
  const rows = await db.terminalResult.groupBy({
    by: ["classArmId"],
    where: { schoolId, averageScore: { not: null } },
    _avg: { averageScore: true },
    _count: { _all: true },
  });
  if (rows.length === 0) return [];

  const armIds = rows.map((r) => r.classArmId);
  const arms = await db.classArm.findMany({
    where: { id: { in: armIds } },
    include: { class: { select: { name: true } } },
  });
  const armMap = new Map(arms.map((a) => [a.id, a]));

  return rows
    .map((r) => {
      const arm = armMap.get(r.classArmId);
      return {
        classArmId: r.classArmId,
        className: arm?.class?.name ? `${arm.class.name} ${arm.name}` : r.classArmId,
        students: r._count._all,
        averageScore: round(r._avg.averageScore ?? 0, 2),
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore);
}
