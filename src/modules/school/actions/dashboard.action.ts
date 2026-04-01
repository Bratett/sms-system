"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { toNum } from "@/lib/decimal";

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
  const totalBilled = toNum(financeAgg._sum.totalAmount);
  const totalCollected = toNum(financeAgg._sum.paidAmount);
  const totalOutstanding = toNum(financeAgg._sum.balanceAmount);
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

// ─── Role-Specific Dashboard Data ──────────────────────────────────

export async function getRoleDashboardAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const roles = (session.user as { roles?: string[] }).roles || [];
  const primaryRole = roles[0] || "teacher";

  const school = await db.school.findFirst();
  const currentTerm = await db.term.findFirst({ where: { isCurrent: true } });
  const currentYear = await db.academicYear.findFirst({ where: { isCurrent: true } });

  switch (primaryRole) {
    case "finance_officer":
      return getFinanceDashboard(currentTerm?.id, currentYear?.id);
    case "teacher":
    case "class_teacher":
    case "subject_teacher":
      return getTeacherDashboard(session.user.id!, currentTerm?.id);
    case "housemaster":
      return getHousemasterDashboard(session.user.id!);
    case "hr_officer":
      return getHrDashboard();
    case "store_keeper":
      return getInventoryDashboard(school?.id);
    case "admissions_officer":
      return getAdmissionsDashboard(currentYear?.id);
    default:
      // super_admin, headmaster, etc. use the full dashboard
      return { data: { role: primaryRole, useFullDashboard: true } };
  }
}

async function getFinanceDashboard(termId?: string, academicYearId?: string) {
  const [billStats, todayPayments, pendingReversals] = await Promise.all([
    termId
      ? db.studentBill.aggregate({
          where: { termId },
          _sum: { totalAmount: true, paidAmount: true, balanceAmount: true },
          _count: true,
        })
      : Promise.resolve({
          _sum: { totalAmount: null, paidAmount: null, balanceAmount: null },
          _count: 0,
        }),
    db.payment.count({
      where: {
        receivedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        status: "CONFIRMED",
      },
    }),
    db.paymentReversal.count({ where: { status: "PENDING" } }),
  ]);

  const totalBilled = toNum(billStats._sum.totalAmount);
  const totalCollected = toNum(billStats._sum.paidAmount);

  return {
    data: {
      role: "finance_officer",
      totalBilled,
      totalCollected,
      outstanding: toNum(billStats._sum.balanceAmount),
      collectionRate: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0,
      billCount: billStats._count,
      todayPayments,
      pendingReversals,
    },
  };
}

async function getTeacherDashboard(userId: string, termId?: string) {
  const staff = await db.staff.findUnique({ where: { userId } });

  const [assignmentCount, pendingMarks, todayRegisters] = await Promise.all([
    termId && staff
      ? db.teacherSubjectAssignment.count({ where: { staffId: staff.id, termId } })
      : Promise.resolve(0),
    db.mark.count({ where: { enteredBy: userId, status: "DRAFT" } }),
    db.attendanceRegister.count({
      where: {
        takenBy: userId,
        date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  return {
    data: {
      role: "teacher",
      subjectAssignments: assignmentCount,
      pendingMarks,
      todayRegisters,
    },
  };
}

async function getHousemasterDashboard(userId: string) {
  const [activeExeats, overdueExeats, totalBoarders] = await Promise.all([
    db.exeat.count({
      where: { status: { in: ["HOUSEMASTER_APPROVED", "HEADMASTER_APPROVED", "DEPARTED"] } },
    }),
    db.exeat.count({ where: { status: "OVERDUE" } }),
    db.student.count({ where: { status: "ACTIVE", boardingStatus: "BOARDING" } }),
  ]);

  return {
    data: {
      role: "housemaster",
      totalBoarders,
      activeExeats,
      overdueExeats,
    },
  };
}

async function getHrDashboard() {
  const [totalStaff, pendingLeave, activeLeave] = await Promise.all([
    db.staff.count({ where: { status: "ACTIVE" } }),
    db.leaveRequest.count({ where: { status: "PENDING" } }),
    db.leaveRequest.count({ where: { status: "APPROVED", endDate: { gte: new Date() } } }),
  ]);

  return {
    data: {
      role: "hr_officer",
      totalStaff,
      pendingLeave,
      activeLeave,
    },
  };
}

async function getInventoryDashboard(_schoolId?: string) {
  const [totalItems, lowStockCount, pendingOrders] = await Promise.all([
    db.storeItem.count(),
    db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count FROM "StoreItem"
      WHERE "quantity" <= "reorderLevel"
    `
      .then((r) => Number(r[0]?.count ?? 0))
      .catch(() => 0),
    db.purchaseRequest.count({ where: { status: "PENDING" } }),
  ]);

  return {
    data: {
      role: "store_keeper",
      totalItems,
      lowStockCount,
      pendingOrders,
    },
  };
}

async function getAdmissionsDashboard(academicYearId?: string) {
  const where = academicYearId ? { academicYearId } : {};

  const [total, pending, accepted, enrolled] = await Promise.all([
    db.admissionApplication.count({ where }),
    db.admissionApplication.count({
      where: { ...where, status: { in: ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED"] } },
    }),
    db.admissionApplication.count({ where: { ...where, status: "ACCEPTED" } }),
    db.admissionApplication.count({ where: { ...where, status: "ENROLLED" } }),
  ]);

  return {
    data: {
      role: "admissions_officer",
      totalApplications: total,
      pending,
      accepted,
      enrolled,
      conversionRate: total > 0 ? Math.round((enrolled / total) * 100) : 0,
    },
  };
}
