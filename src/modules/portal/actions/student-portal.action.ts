"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-context";
import { toNum } from "@/lib/decimal";

// ─── Helper: get student record by userId ─────────────────────────────

async function getStudentByUserId(userId: string) {
  return db.student.findUnique({
    where: { userId },
  });
}

// ─── Get Student Portal Data ──────────────────────────────────────────

export async function getStudentPortalDataAction() {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  const student = await db.student.findUnique({
    where: { userId: ctx.session.user.id },
    include: {
      enrollments: {
        where: { status: "ACTIVE" },
        orderBy: { academicYearId: "desc" },
        take: 1,
        include: {
          classArm: {
            include: {
              class: {
                select: { id: true, name: true, yearGroup: true },
              },
            },
          },
        },
      },
      houseAssignment: true,
    },
  });

  if (!student) {
    return { error: "No student profile linked to your account." };
  }

  const enrollment = student.enrollments[0] ?? null;

  // Fee balance
  const bills = await db.studentBill.findMany({
    where: {
      studentId: student.id,
      status: { in: ["UNPAID", "PARTIAL"] },
    },
    select: { balanceAmount: true },
  });
  const feeBalance = bills.reduce((sum, b) => sum + toNum(b.balanceAmount), 0);

  // Recent results: get latest term result
  const currentTerm = await db.term.findFirst({
    where: { isCurrent: true },
    include: {
      academicYear: { select: { name: true } },
    },
  });

  let recentResult: {
    termName: string;
    academicYearName: string;
    averageScore: number | null;
    classPosition: number | null;
    overallGrade: string | null;
  } | null = null;

  if (currentTerm) {
    const termResult = await db.terminalResult.findFirst({
      where: {
        studentId: student.id,
        termId: currentTerm.id,
      },
      select: {
        averageScore: true,
        classPosition: true,
        overallGrade: true,
      },
    });

    if (termResult) {
      recentResult = {
        termName: currentTerm.name,
        academicYearName: currentTerm.academicYear.name,
        averageScore: termResult.averageScore,
        classPosition: termResult.classPosition,
        overallGrade: termResult.overallGrade,
      };
    }
  }

  // Attendance rate
  let attendanceRate: number | null = null;
  if (enrollment) {
    const totalRecords = await db.attendanceRecord.count({
      where: {
        studentId: student.id,
        register: { classArmId: enrollment.classArmId },
      },
    });

    if (totalRecords > 0) {
      const presentRecords = await db.attendanceRecord.count({
        where: {
          studentId: student.id,
          status: { in: ["PRESENT", "LATE"] },
          register: { classArmId: enrollment.classArmId },
        },
      });
      attendanceRate = Math.round((presentRecords / totalRecords) * 100);
    }
  }

  return {
    data: {
      id: student.id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      otherNames: student.otherNames,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
      photoUrl: student.photoUrl,
      boardingStatus: student.boardingStatus,
      status: student.status,
      currentClass: enrollment
        ? {
            classArmId: enrollment.classArmId,
            className: enrollment.classArm.class.name,
            armName: enrollment.classArm.name,
            yearGroup: enrollment.classArm.class.yearGroup,
          }
        : null,
      feeBalance,
      recentResult,
      attendanceRate,
    },
  };
}

// ─── Get My Results ───────────────────────────────────────────────────

export async function getMyResultsAction(termId?: string) {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  const student = await getStudentByUserId(ctx.session.user.id);
  if (!student) {
    return { error: "No student profile linked to your account." };
  }

  // Get available terms
  const terms = await db.term.findMany({
    include: {
      academicYear: { select: { id: true, name: true } },
    },
    orderBy: [{ academicYear: { startDate: "desc" } }, { termNumber: "desc" }],
  });

  // If no termId provided, use current term
  let selectedTermId = termId;
  if (!selectedTermId) {
    const currentTerm = await db.term.findFirst({
      where: { isCurrent: true },
      select: { id: true },
    });
    selectedTermId = currentTerm?.id;
  }

  if (!selectedTermId) {
    return {
      data: {
        terms: terms.map((t) => ({
          id: t.id,
          name: t.name,
          termNumber: t.termNumber,
          academicYearName: t.academicYear.name,
        })),
        result: null,
      },
    };
  }

  const result = await db.terminalResult.findFirst({
    where: { studentId: student.id, termId: selectedTermId },
    include: {
      subjectResults: {
        include: {
          subject: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { subject: { name: "asc" } },
      },
    },
  });

  const formattedResult = result
    ? {
        id: result.id,
        totalScore: result.totalScore,
        averageScore: result.averageScore,
        classPosition: result.classPosition,
        overallGrade: result.overallGrade,
        teacherRemarks: result.teacherRemarks,
        headmasterRemarks: result.headmasterRemarks,
        promotionStatus: result.promotionStatus,
        subjectResults: result.subjectResults.map((sr) => ({
          id: sr.id,
          subjectName: sr.subject.name,
          subjectCode: sr.subject.code,
          classScore: sr.classScore,
          examScore: sr.examScore,
          totalScore: sr.totalScore,
          grade: sr.grade,
          interpretation: sr.interpretation,
          position: sr.position,
        })),
      }
    : null;

  return {
    data: {
      terms: terms.map((t) => ({
        id: t.id,
        name: t.name,
        termNumber: t.termNumber,
        academicYearName: t.academicYear.name,
      })),
      result: formattedResult,
    },
  };
}

// ─── Get My Attendance ────────────────────────────────────────────────

export async function getMyAttendanceAction(termId?: string) {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  const student = await getStudentByUserId(ctx.session.user.id);
  if (!student) {
    return { error: "No student profile linked to your account." };
  }

  const enrollment = await db.enrollment.findFirst({
    where: {
      studentId: student.id,
      status: "ACTIVE",
    },
    orderBy: { academicYearId: "desc" },
    select: { classArmId: true },
  });

  if (!enrollment) {
    return { data: { summary: null, terms: [] } };
  }

  const terms = await db.term.findMany({
    include: {
      academicYear: { select: { id: true, name: true } },
    },
    orderBy: [{ academicYear: { startDate: "desc" } }, { termNumber: "desc" }],
  });

  let selectedTermId = termId;
  if (!selectedTermId) {
    const currentTerm = await db.term.findFirst({
      where: { isCurrent: true },
      select: { id: true },
    });
    selectedTermId = currentTerm?.id;
  }

  if (!selectedTermId) {
    return {
      data: {
        summary: null,
        terms: terms.map((t) => ({
          id: t.id,
          name: t.name,
          termNumber: t.termNumber,
          academicYearName: t.academicYear.name,
        })),
      },
    };
  }

  const selectedTerm = await db.term.findUnique({
    where: { id: selectedTermId },
    select: { startDate: true, endDate: true },
  });

  if (!selectedTerm) {
    return { data: { summary: null, terms: [] } };
  }

  const where = {
    studentId: student.id,
    register: {
      classArmId: enrollment.classArmId,
      date: {
        gte: selectedTerm.startDate,
        lte: selectedTerm.endDate,
      },
    },
  };

  const [total, present, absent, late, excused, sick] = await Promise.all([
    db.attendanceRecord.count({ where }),
    db.attendanceRecord.count({ where: { ...where, status: "PRESENT" } }),
    db.attendanceRecord.count({ where: { ...where, status: "ABSENT" } }),
    db.attendanceRecord.count({ where: { ...where, status: "LATE" } }),
    db.attendanceRecord.count({ where: { ...where, status: "EXCUSED" } }),
    db.attendanceRecord.count({ where: { ...where, status: "SICK" } }),
  ]);

  const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : null;

  return {
    data: {
      summary: {
        total,
        present,
        absent,
        late,
        excused,
        sick,
        attendanceRate,
      },
      terms: terms.map((t) => ({
        id: t.id,
        name: t.name,
        termNumber: t.termNumber,
        academicYearName: t.academicYear.name,
      })),
    },
  };
}

// ─── Get My Fees ──────────────────────────────────────────────────────

export async function getMyFeesAction() {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  const student = await getStudentByUserId(ctx.session.user.id);
  if (!student) {
    return { error: "No student profile linked to your account." };
  }

  const bills = await db.studentBill.findMany({
    where: { studentId: student.id },
    include: {
      feeStructure: {
        select: { name: true },
      },
      payments: {
        where: { status: "CONFIRMED" },
        orderBy: { receivedAt: "desc" },
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          receivedAt: true,
        },
      },
    },
    orderBy: { generatedAt: "desc" },
  });

  const termIds = [...new Set(bills.map((b) => b.termId))];
  const terms = await db.term.findMany({
    where: { id: { in: termIds } },
    include: {
      academicYear: { select: { name: true } },
    },
  });
  const termMap = new Map(
    terms.map((t) => [t.id, { name: t.name, academicYearName: t.academicYear.name }]),
  );

  const formattedBills = bills.map((bill) => ({
    id: bill.id,
    termName: termMap.get(bill.termId)?.name ?? "Unknown",
    academicYearName: termMap.get(bill.termId)?.academicYearName ?? "",
    feeStructureName: bill.feeStructure.name,
    totalAmount: bill.totalAmount,
    paidAmount: bill.paidAmount,
    balanceAmount: bill.balanceAmount,
    status: bill.status,
    dueDate: bill.dueDate,
    payments: bill.payments,
  }));

  const totalBalance = bills.reduce((sum, b) => sum + toNum(b.balanceAmount), 0);

  return {
    data: {
      bills: formattedBills,
      totalBalance,
    },
  };
}

// ─── Get My Announcements ───────────────────────────────────────────

export async function getMyAnnouncementsAction() {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  const student = await getStudentByUserId(ctx.session.user.id);
  if (!student) {
    return { error: "No student profile linked to your account." };
  }

  const announcements = await db.announcement.findMany({
    where: {
      schoolId: student.schoolId,
      status: "PUBLISHED",
      OR: [{ targetType: "all" }, { targetType: "specific" }],
    },
    orderBy: { publishedAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      content: true,
      priority: true,
      publishedAt: true,
      expiresAt: true,
    },
  });

  // Filter out expired
  const now = new Date();
  const active = announcements.filter((a) => !a.expiresAt || new Date(a.expiresAt) > now);

  return { data: active };
}

// ─── Get My Exeats ───────────────────────────────────────────────────

export async function getMyExeatsAction() {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  const student = await getStudentByUserId(ctx.session.user.id);
  if (!student) {
    return { error: "No student profile linked to your account." };
  }

  const exeats = await db.exeat.findMany({
    where: { studentId: student.id },
    include: {
      approvals: {
        orderBy: { actionAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = exeats.map((e) => ({
    id: e.id,
    exeatNumber: e.exeatNumber,
    type: e.type,
    reason: e.reason,
    departureDate: e.departureDate,
    departureTime: e.departureTime,
    expectedReturnDate: e.expectedReturnDate,
    actualReturnDate: e.actualReturnDate,
    actualReturnTime: e.actualReturnTime,
    guardianName: e.guardianName,
    guardianPhone: e.guardianPhone,
    status: e.status,
    requestedAt: e.requestedAt,
    approvalCount: e.approvals.length,
  }));

  return { data };
}

// ─── Request Exeat (Student Portal) ──────────────────────────────────

export async function requestStudentExeatAction(input: {
  reason: string;
  type: "NORMAL" | "EMERGENCY" | "MEDICAL" | "WEEKEND" | "VACATION";
  departureDate: string;
  departureTime?: string;
  expectedReturnDate: string;
  guardianName?: string;
  guardianPhone?: string;
}) {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  const student = await getStudentByUserId(ctx.session.user.id);
  if (!student) {
    return { error: "No student profile linked to your account." };
  }

  if (student.boardingStatus !== "BOARDING") {
    return { error: "Exeat requests are only available for boarding students." };
  }

  // Get current term
  const currentTerm = await db.term.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  });

  if (!currentTerm) {
    return { error: "No active term found." };
  }

  // Generate exeat number
  const year = new Date().getFullYear();
  const count = await db.exeat.count({
    where: {
      exeatNumber: { startsWith: `EXT/${year}/` },
    },
  });
  const exeatNumber = `EXT/${year}/${String(count + 1).padStart(4, "0")}`;

  // Get primary guardian info if not provided
  let guardianName = input.guardianName;
  let guardianPhone = input.guardianPhone;

  if (!guardianName || !guardianPhone) {
    const primaryGuardian = await db.studentGuardian.findFirst({
      where: { studentId: student.id, isPrimary: true },
      include: { guardian: true },
    });

    if (primaryGuardian) {
      guardianName =
        guardianName ||
        `${primaryGuardian.guardian.firstName} ${primaryGuardian.guardian.lastName}`;
      guardianPhone = guardianPhone || primaryGuardian.guardian.phone;
    }
  }

  const exeat = await db.exeat.create({
    data: {
      schoolId: student.schoolId,
      exeatNumber,
      studentId: student.id,
      termId: currentTerm.id,
      reason: input.reason,
      type: input.type,
      departureDate: new Date(input.departureDate),
      departureTime: input.departureTime || null,
      expectedReturnDate: new Date(input.expectedReturnDate),
      guardianName: guardianName || null,
      guardianPhone: guardianPhone || null,
      requestedBy: ctx.session.user.id,
    },
  });

  return { data: { id: exeat.id, exeatNumber: exeat.exeatNumber } };
}
