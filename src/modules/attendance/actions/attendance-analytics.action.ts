"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

// ─── Attendance Rate by Period ───────────────────────────────────────

export async function getAttendanceByPeriodAction(termId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const term = await db.term.findUnique({
    where: { id: termId },
    select: { startDate: true, endDate: true },
  });
  if (!term) return { error: "Term not found." };

  // Get all period-based registers with records
  const registers = await db.attendanceRegister.findMany({
    where: {
      schoolId: ctx.schoolId,
      type: "PERIOD",
      periodId: { not: null },
      date: { gte: term.startDate, lte: term.endDate },
    },
    include: {
      records: { select: { status: true } },
      period: { select: { id: true, name: true, order: true } },
    },
  });

  // Group by period
  const periodStats = new Map<string, { name: string; order: number; present: number; total: number }>();

  for (const reg of registers) {
    if (!reg.period) continue;
    const key = reg.period.id;
    const existing = periodStats.get(key) ?? { name: reg.period.name, order: reg.period.order, present: 0, total: 0 };

    for (const rec of reg.records) {
      existing.total++;
      if (rec.status === "PRESENT" || rec.status === "LATE") {
        existing.present++;
      }
    }
    periodStats.set(key, existing);
  }

  const data = Array.from(periodStats.entries())
    .map(([periodId, stats]) => ({
      periodId,
      periodName: stats.name,
      order: stats.order,
      attendanceRate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
      totalRecords: stats.total,
    }))
    .sort((a, b) => a.order - b.order);

  return { data };
}

// ─── Attendance Rate by Day of Week ──────────────────────────────────

export async function getAttendanceByDayAction(termId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const term = await db.term.findUnique({
    where: { id: termId },
    select: { startDate: true, endDate: true },
  });
  if (!term) return { error: "Term not found." };

  const registers = await db.attendanceRegister.findMany({
    where: {
      schoolId: ctx.schoolId,
      date: { gte: term.startDate, lte: term.endDate },
    },
    include: {
      records: { select: { status: true } },
    },
  });

  const dayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayStats = new Map<number, { present: number; total: number }>();

  for (const reg of registers) {
    const dayOfWeek = reg.date.getDay() === 0 ? 7 : reg.date.getDay();
    const existing = dayStats.get(dayOfWeek) ?? { present: 0, total: 0 };

    for (const rec of reg.records) {
      existing.total++;
      if (rec.status === "PRESENT" || rec.status === "LATE") {
        existing.present++;
      }
    }
    dayStats.set(dayOfWeek, existing);
  }

  const data = Array.from(dayStats.entries())
    .map(([day, stats]) => ({
      dayOfWeek: day,
      dayName: dayNames[day] ?? `Day ${day}`,
      attendanceRate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
      totalRecords: stats.total,
    }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  return { data };
}

// ─── Chronic Absenteeism Overview ────────────────────────────────────

export async function getChronicAbsenteeismAction(termId: string, threshold?: number) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const term = await db.term.findUnique({
    where: { id: termId },
    select: { startDate: true, endDate: true },
  });
  if (!term) return { error: "Term not found." };

  const absenceThreshold = threshold ?? 10; // default: 10% absence rate

  // Get all registers for the term
  const registers = await db.attendanceRegister.findMany({
    where: {
      schoolId: ctx.schoolId,
      date: { gte: term.startDate, lte: term.endDate },
    },
    include: { records: { select: { studentId: true, status: true } } },
  });

  // Build per-student stats
  const studentStats = new Map<string, { absent: number; total: number; classArmId: string }>();

  for (const reg of registers) {
    for (const rec of reg.records) {
      const existing = studentStats.get(rec.studentId) ?? { absent: 0, total: 0, classArmId: reg.classArmId };
      existing.total++;
      if (rec.status === "ABSENT") existing.absent++;
      studentStats.set(rec.studentId, existing);
    }
  }

  // Find students exceeding threshold
  const chronicallyAbsent: Array<{
    studentId: string;
    absenceRate: number;
    absent: number;
    total: number;
  }> = [];

  for (const [studentId, stats] of studentStats) {
    const absenceRate = stats.total > 0 ? (stats.absent / stats.total) * 100 : 0;
    if (absenceRate >= absenceThreshold) {
      chronicallyAbsent.push({
        studentId,
        absenceRate: Math.round(absenceRate),
        absent: stats.absent,
        total: stats.total,
      });
    }
  }

  // Get student names
  const studentIds = chronicallyAbsent.map((s) => s.studentId);
  const students = studentIds.length > 0
    ? await db.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, studentId: true, firstName: true, lastName: true },
      })
    : [];
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const data = chronicallyAbsent
    .map((s) => ({
      ...s,
      studentNumber: studentMap.get(s.studentId)?.studentId ?? "",
      studentName: studentMap.get(s.studentId)
        ? `${studentMap.get(s.studentId)!.firstName} ${studentMap.get(s.studentId)!.lastName}`
        : "Unknown",
    }))
    .sort((a, b) => b.absenceRate - a.absenceRate);

  return {
    data: {
      students: data,
      totalStudents: studentStats.size,
      chronicallyAbsentCount: data.length,
      threshold: absenceThreshold,
    },
  };
}

// ─── Attendance Trend (Weekly) ───────────────────────────────────────

export async function getAttendanceTrendAction(termId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const term = await db.term.findUnique({
    where: { id: termId },
    select: { startDate: true, endDate: true },
  });
  if (!term) return { error: "Term not found." };

  const registers = await db.attendanceRegister.findMany({
    where: {
      schoolId: ctx.schoolId,
      date: { gte: term.startDate, lte: term.endDate },
    },
    include: { records: { select: { status: true } } },
    orderBy: { date: "asc" },
  });

  // Group by week
  const weekStats = new Map<string, { present: number; total: number; weekStart: Date }>();

  for (const reg of registers) {
    const weekStart = new Date(reg.date);
    const dayOffset = weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1; // Mon=0
    weekStart.setDate(weekStart.getDate() - dayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const key = weekStart.toISOString().split("T")[0];

    const existing = weekStats.get(key) ?? { present: 0, total: 0, weekStart };

    for (const rec of reg.records) {
      existing.total++;
      if (rec.status === "PRESENT" || rec.status === "LATE") {
        existing.present++;
      }
    }
    weekStats.set(key, existing);
  }

  const data = Array.from(weekStats.entries())
    .map(([week, stats]) => ({
      week,
      weekStart: stats.weekStart,
      attendanceRate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
      totalRecords: stats.total,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  return { data };
}
