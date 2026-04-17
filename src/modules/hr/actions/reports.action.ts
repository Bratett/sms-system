"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, denyPermission } from "@/lib/permissions";
import { toNum } from "@/lib/decimal";

// ─── Staff Turnover Report ──────────────────────────────────

export async function getStaffTurnoverReportAction(dateFrom: string, dateTo: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.STAFF_READ)) return { error: "Insufficient permissions" };

  const from = new Date(dateFrom);
  const to = new Date(dateTo);

  const [newHires, terminations, retirements, transfers] = await Promise.all([
    db.staff.count({
      where: { schoolId: ctx.schoolId, createdAt: { gte: from, lte: to }, deletedAt: null },
    }),
    db.staff.count({
      where: { schoolId: ctx.schoolId, status: "TERMINATED", updatedAt: { gte: from, lte: to }, deletedAt: null },
    }),
    db.staff.count({
      where: { schoolId: ctx.schoolId, status: "RETIRED", updatedAt: { gte: from, lte: to }, deletedAt: null },
    }),
    db.staff.count({
      where: { schoolId: ctx.schoolId, status: "TRANSFERRED", updatedAt: { gte: from, lte: to }, deletedAt: null },
    }),
  ]);

  const totalActive = await db.staff.count({
    where: { schoolId: ctx.schoolId, status: "ACTIVE", deletedAt: null },
  });

  const totalExits = terminations + retirements + transfers;
  const turnoverRate = totalActive > 0 ? ((totalExits / totalActive) * 100).toFixed(1) : "0.0";

  return {
    data: {
      period: { from: dateFrom, to: dateTo },
      newHires,
      terminations,
      retirements,
      transfers,
      totalExits,
      totalActive,
      turnoverRate: `${turnoverRate}%`,
    },
  };
}

// ─── Leave Utilization Report ───────────────────────────────

export async function getLeaveUtilizationReportAction(academicYearId?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.LEAVE_READ)) return { error: "Insufficient permissions" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (academicYearId) where.academicYearId = academicYearId;

  // Get leave balances grouped by leave type
  const balances = await db.leaveBalance.findMany({
    where,
    include: {
      leaveType: { select: { name: true } },
    },
  });

  const typeMap = new Map<string, { total: number; used: number; remaining: number; staffCount: number }>();

  for (const b of balances) {
    const name = b.leaveType.name;
    const existing = typeMap.get(name) || { total: 0, used: 0, remaining: 0, staffCount: 0 };
    existing.total += b.totalDays;
    existing.used += b.usedDays;
    existing.remaining += b.remainingDays;
    existing.staffCount++;
    typeMap.set(name, existing);
  }

  const utilization = Array.from(typeMap.entries()).map(([name, data]) => ({
    leaveType: name,
    totalAllocated: data.total,
    totalUsed: data.used,
    totalRemaining: data.remaining,
    staffCount: data.staffCount,
    utilizationRate: data.total > 0 ? `${((data.used / data.total) * 100).toFixed(1)}%` : "0.0%",
  }));

  return { data: utilization };
}

// ─── Payroll Summary Report ─────────────────────────────────

export async function getPayrollSummaryReportAction(year: number) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.PAYROLL_READ)) return { error: "Insufficient permissions" };

  const periods = await db.payrollPeriod.findMany({
    where: { schoolId: ctx.schoolId, year },
    include: {
      entries: {
        select: { basicSalary: true, totalAllowances: true, totalDeductions: true, netPay: true },
      },
    },
    orderBy: { month: "asc" },
  });

  const monthly = periods.map((p) => ({
    month: p.month,
    status: p.status,
    staffCount: p.entries.length,
    totalBasic: p.entries.reduce((s, e) => s + toNum(e.basicSalary), 0),
    totalAllowances: p.entries.reduce((s, e) => s + toNum(e.totalAllowances), 0),
    totalDeductions: p.entries.reduce((s, e) => s + toNum(e.totalDeductions), 0),
    totalNet: p.entries.reduce((s, e) => s + toNum(e.netPay), 0),
  }));

  const grandTotal = {
    totalBasic: monthly.reduce((s, m) => s + m.totalBasic, 0),
    totalAllowances: monthly.reduce((s, m) => s + m.totalAllowances, 0),
    totalDeductions: monthly.reduce((s, m) => s + m.totalDeductions, 0),
    totalNet: monthly.reduce((s, m) => s + m.totalNet, 0),
  };

  return { data: { year, monthly, grandTotal } };
}

// ─── Staff Demographics Report ──────────────────────────────

export async function getStaffDemographicsReportAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.STAFF_READ)) return { error: "Insufficient permissions" };

  const activeStaff = await db.staff.findMany({
    where: { schoolId: ctx.schoolId, status: "ACTIVE", deletedAt: null },
    select: { gender: true, staffType: true, dateOfBirth: true, qualifications: true },
  });

  // Gender distribution
  const genderCount: Record<string, number> = {};
  for (const s of activeStaff) {
    genderCount[s.gender] = (genderCount[s.gender] || 0) + 1;
  }

  // Staff type distribution
  const typeCount: Record<string, number> = {};
  for (const s of activeStaff) {
    typeCount[s.staffType] = (typeCount[s.staffType] || 0) + 1;
  }

  // Age distribution
  const now = new Date();
  const ageBands: Record<string, number> = {
    "Under 25": 0,
    "25-34": 0,
    "35-44": 0,
    "45-54": 0,
    "55+": 0,
    Unknown: 0,
  };

  for (const s of activeStaff) {
    if (!s.dateOfBirth) {
      ageBands["Unknown"]++;
      continue;
    }
    const age = now.getFullYear() - s.dateOfBirth.getFullYear();
    if (age < 25) ageBands["Under 25"]++;
    else if (age < 35) ageBands["25-34"]++;
    else if (age < 45) ageBands["35-44"]++;
    else if (age < 55) ageBands["45-54"]++;
    else ageBands["55+"]++;
  }

  return {
    data: {
      totalActive: activeStaff.length,
      gender: genderCount,
      staffType: typeCount,
      ageDistribution: ageBands,
    },
  };
}

// ─── Attendance Trend Report ────────────────────────────────

export async function getAttendanceTrendReportAction(month: number, year: number) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.STAFF_ATTENDANCE_READ)) return { error: "Insufficient permissions" };

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const records = await db.staffAttendance.findMany({
    where: {
      schoolId: ctx.schoolId,
      date: { gte: startDate, lte: endDate },
    },
    select: { date: true, status: true },
    orderBy: { date: "asc" },
  });

  // Group by date
  const dailyMap = new Map<string, Record<string, number>>();
  for (const r of records) {
    const key = r.date.toISOString().split("T")[0];
    const day = dailyMap.get(key) || {};
    day[r.status] = (day[r.status] || 0) + 1;
    dailyMap.set(key, day);
  }

  const daily = Array.from(dailyMap.entries())
    .map(([date, counts]) => ({
      date,
      present: counts.PRESENT || 0,
      absent: counts.ABSENT || 0,
      late: counts.LATE || 0,
      excused: counts.EXCUSED || 0,
      onLeave: counts.ON_LEAVE || 0,
      total: Object.values(counts).reduce((s, c) => s + c, 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { data: { month, year, daily } };
}
