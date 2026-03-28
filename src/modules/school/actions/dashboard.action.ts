"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function getDashboardStatsAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  // ── Shared lookups (needed by multiple queries) ────────────
  const school = await db.school.findFirst();

  const currentYear = await db.academicYear.findFirst({
    where: { isCurrent: true },
    include: {
      terms: { orderBy: { termNumber: "asc" } },
    },
  });

  const currentTerm = currentYear?.terms.find((t) => t.isCurrent) || null;

  // ── Parallel queries for all modules ───────────────────────
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    // Student stats
    totalStudents,
    activeStudents,
    maleStudents,
    femaleStudents,
    boardingStudents,
    dayStudents,
    newThisTerm,

    // Staff stats
    totalStaff,
    teachingStaff,
    nonTeachingStaff,

    // Academic stats
    totalSubjects,
    totalClasses,

    // Finance stats (current term)
    financeAgg,

    // Attendance stats (today)
    todayRegisters,
    todayAttendanceRecords,

    // Admissions
    pendingAdmissions,

    // HR - Leave
    pendingLeaveRequests,

    // Recent Activity
    recentAuditLogs,
  ] = await Promise.all([
    // ── Students ─────────────────────────────────────────────
    db.student.count(),
    db.student.count({ where: { status: "ACTIVE" } }),
    db.student.count({ where: { status: "ACTIVE", gender: "MALE" } }),
    db.student.count({ where: { status: "ACTIVE", gender: "FEMALE" } }),
    db.student.count({ where: { status: "ACTIVE", boardingStatus: "BOARDING" } }),
    db.student.count({ where: { status: "ACTIVE", boardingStatus: "DAY" } }),
    currentTerm
      ? db.enrollment.count({
          where: {
            academicYearId: currentYear!.id,
            status: "ACTIVE",
          },
        })
      : Promise.resolve(0),

    // ── Staff ────────────────────────────────────────────────
    db.staff.count({ where: { status: "ACTIVE" } }),
    db.staff.count({ where: { status: "ACTIVE", staffType: "TEACHING" } }),
    db.staff.count({ where: { status: "ACTIVE", staffType: "NON_TEACHING" } }),

    // ── Academic ─────────────────────────────────────────────
    db.subject.count({ where: { status: "ACTIVE" } }),
    currentYear
      ? db.class.count({ where: { academicYearId: currentYear.id, status: "ACTIVE" } })
      : Promise.resolve(0),

    // ── Finance (current term) ───────────────────────────────
    currentTerm
      ? db.studentBill.aggregate({
          where: { termId: currentTerm.id },
          _sum: { totalAmount: true, paidAmount: true, balanceAmount: true },
        })
      : Promise.resolve({ _sum: { totalAmount: null, paidAmount: null, balanceAmount: null } }),

    // ── Attendance (today) ───────────────────────────────────
    db.attendanceRegister.count({
      where: { date: { gte: todayStart, lte: todayEnd } },
    }),
    db.attendanceRecord.findMany({
      where: {
        register: { date: { gte: todayStart, lte: todayEnd } },
      },
      select: { status: true },
    }),

    // ── Admissions ───────────────────────────────────────────
    db.admissionApplication.count({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED"] } },
    }),

    // ── HR - Leave ───────────────────────────────────────────
    db.leaveRequest.count({ where: { status: "PENDING" } }),

    // ── Audit Log ────────────────────────────────────────────
    db.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 10,
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  // ── Compute derived stats ──────────────────────────────────
  const totalBilled = financeAgg._sum.totalAmount ?? 0;
  const totalCollected = financeAgg._sum.paidAmount ?? 0;
  const totalOutstanding = financeAgg._sum.balanceAmount ?? 0;
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  // Attendance rate for today
  const totalAttendanceRecords = todayAttendanceRecords.length;
  const presentRecords = todayAttendanceRecords.filter(
    (r) => r.status === "PRESENT" || r.status === "LATE",
  ).length;
  const todayAttendanceRate =
    totalAttendanceRecords > 0 ? Math.round((presentRecords / totalAttendanceRecords) * 100) : null;

  return {
    school,
    currentYear: currentYear ? { id: currentYear.id, name: currentYear.name } : null,
    currentTerm: currentTerm
      ? {
          id: currentTerm.id,
          name: currentTerm.name,
          startDate: currentTerm.startDate,
          endDate: currentTerm.endDate,
        }
      : null,
    stats: {
      students: {
        total: totalStudents,
        active: activeStudents,
        male: maleStudents,
        female: femaleStudents,
        boarding: boardingStudents,
        day: dayStudents,
        enrolledThisTerm: newThisTerm,
      },
      staff: {
        total: totalStaff,
        teaching: teachingStaff,
        nonTeaching: nonTeachingStaff,
      },
      academic: {
        currentYearName: currentYear?.name ?? null,
        currentTermName: currentTerm?.name ?? null,
        totalSubjects,
        totalClasses,
      },
      finance: {
        totalBilled,
        totalCollected,
        collectionRate,
        outstanding: totalOutstanding,
      },
      attendance: {
        todayRate: todayAttendanceRate,
        registersToday: todayRegisters,
      },
      admissions: {
        pending: pendingAdmissions,
      },
      hr: {
        pendingLeave: pendingLeaveRequests,
      },
    },
    recentActivity: recentAuditLogs.map((log) => ({
      id: log.id,
      description: log.description,
      user: `${log.user.firstName} ${log.user.lastName}`,
      timestamp: log.timestamp,
      module: log.module,
      action: log.action,
    })),
  };
}
