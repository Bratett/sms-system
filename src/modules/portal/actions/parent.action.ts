"use server";

import { db } from "@/lib/db";
import { requireAuth, requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { toNum } from "@/lib/decimal";
import { doesAnnouncementTargetGuardian } from "@/modules/communication/circular-targeting";

// ─── Helper: verify parent has access to a student ────────────────────

async function verifyParentAccess(userId: string, studentId: string) {
  const guardian = await db.guardian.findUnique({
    where: { userId },
  });

  if (!guardian) return false;

  const link = await db.studentGuardian.findFirst({
    where: {
      guardianId: guardian.id,
      studentId,
    },
  });

  return !!link;
}

// ─── Get Parent's Children ────────────────────────────────────────────

export async function getParentChildrenAction() {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  const guardian = await db.guardian.findUnique({
    where: { userId: ctx.session.user.id },
    include: {
      students: {
        include: {
          student: {
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
            },
          },
        },
      },
    },
  });

  if (!guardian) {
    return { error: "No guardian profile linked to your account." };
  }

  // For each child, get fee balance and attendance rate
  const children = await Promise.all(
    guardian.students.map(async (sg) => {
      const student = sg.student;
      const enrollment = student.enrollments[0] ?? null;

      // Fee balance: sum of all unpaid/partial bills
      const bills = await db.studentBill.findMany({
        where: {
          studentId: student.id,
          status: { in: ["UNPAID", "PARTIAL"] },
        },
        select: { balanceAmount: true },
      });
      const feeBalance = bills.reduce((sum, b) => sum + toNum(b.balanceAmount), 0);

      // Attendance rate: count present / total for current term
      const currentTerm = await db.term.findFirst({
        where: { isCurrent: true },
        select: { id: true },
      });

      let attendanceRate: number | null = null;
      if (currentTerm && enrollment) {
        const totalRecords = await db.attendanceRecord.count({
          where: {
            studentId: student.id,
            register: {
              classArmId: enrollment.classArmId,
            },
          },
        });

        if (totalRecords > 0) {
          const presentRecords = await db.attendanceRecord.count({
            where: {
              studentId: student.id,
              status: { in: ["PRESENT", "LATE"] },
              register: {
                classArmId: enrollment.classArmId,
              },
            },
          });
          attendanceRate = Math.round((presentRecords / totalRecords) * 100);
        }
      }

      return {
        id: student.id,
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        gender: student.gender,
        photoUrl: student.photoUrl,
        boardingStatus: student.boardingStatus,
        status: student.status,
        isPrimary: sg.isPrimary,
        currentClass: enrollment
          ? {
              classArmId: enrollment.classArmId,
              className: enrollment.classArm.class.name,
              armName: enrollment.classArm.name,
              yearGroup: enrollment.classArm.class.yearGroup,
            }
          : null,
        feeBalance,
        attendanceRate,
      };
    }),
  );

  return { data: children };
}

// ─── Get Child Results ────────────────────────────────────────────────

export async function getChildResultsAction(studentId: string, termId?: string) {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  const hasAccess = await verifyParentAccess(ctx.session.user.id, studentId);
  if (!hasAccess) {
    return { error: "You do not have access to this student's data." };
  }

  // Get available terms for dropdown
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
        student: null,
      },
    };
  }

  // Get the student info
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      otherNames: true,
    },
  });

  // Get terminal result
  const result = await db.terminalResult.findFirst({
    where: { studentId, termId: selectedTermId },
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
      student: student
        ? {
            id: student.id,
            studentId: student.studentId,
            fullName: `${student.firstName} ${student.lastName}${student.otherNames ? " " + student.otherNames : ""}`,
          }
        : null,
    },
  };
}

// ─── Get Child Fees ───────────────────────────────────────────────────

export async function getChildFeesAction(studentId: string) {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  const hasAccess = await verifyParentAccess(ctx.session.user.id, studentId);
  if (!hasAccess) {
    return { error: "You do not have access to this student's data." };
  }

  // Get all bills for the student
  const bills = await db.studentBill.findMany({
    where: { studentId },
    include: {
      feeStructure: {
        select: { name: true },
      },
      payments: {
        where: { status: "CONFIRMED" },
        include: {
          receipt: {
            select: { receiptNumber: true },
          },
        },
        orderBy: { receivedAt: "desc" },
      },
    },
    orderBy: { generatedAt: "desc" },
  });

  // Get term info for each bill
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
    generatedAt: bill.generatedAt,
    payments: bill.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      referenceNumber: p.referenceNumber,
      receivedAt: p.receivedAt,
      receiptNumber: p.receipt?.receiptNumber ?? null,
    })),
  }));

  // Summary
  const totalFees = bills.reduce((sum, b) => sum + toNum(b.totalAmount), 0);
  const totalPaid = bills.reduce((sum, b) => sum + toNum(b.paidAmount), 0);
  const totalBalance = bills.reduce((sum, b) => sum + toNum(b.balanceAmount), 0);

  return {
    data: {
      bills: formattedBills,
      summary: {
        totalFees,
        totalPaid,
        totalBalance,
      },
    },
  };
}

// ─── Get Child Attendance ─────────────────────────────────────────────

export async function getChildAttendanceAction(studentId: string, termId?: string) {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  const hasAccess = await verifyParentAccess(ctx.session.user.id, studentId);
  if (!hasAccess) {
    return { error: "You do not have access to this student's data." };
  }

  // Get current enrollment
  const enrollment = await db.enrollment.findFirst({
    where: {
      studentId,
      status: "ACTIVE",
    },
    orderBy: { academicYearId: "desc" },
    select: { classArmId: true, academicYearId: true },
  });

  if (!enrollment) {
    return { data: { summary: null, terms: [] } };
  }

  // Get available terms
  const terms = await db.term.findMany({
    include: {
      academicYear: { select: { id: true, name: true } },
    },
    orderBy: [{ academicYear: { startDate: "desc" } }, { termNumber: "desc" }],
  });

  // Determine which term to use
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

  // Get term date range for filtering
  const selectedTerm = await db.term.findUnique({
    where: { id: selectedTermId },
    select: { startDate: true, endDate: true },
  });

  if (!selectedTerm) {
    return { data: { summary: null, terms: [] } };
  }

  // Count attendance records
  const where = {
    studentId,
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

// ─── Get Announcements for Parent ─────────────────────────────────────

/** @no-audit Read-only parent view. */
export async function getParentAnnouncementsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ANNOUNCEMENTS_READ);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const guardian = await db.guardian.findUnique({
    where: { userId },
    select: {
      userId: true,
      householdId: true,
      students: {
        select: {
          student: {
            select: {
              id: true,
              status: true,
              enrollments: {
                where: { status: "ACTIVE" },
                take: 1,
                select: {
                  classArmId: true,
                  classArm: {
                    select: {
                      id: true,
                      classId: true,
                      class: { select: { programmeId: true } },
                    },
                  },
                },
              },
              houseAssignment: { select: { houseId: true } },
            },
          },
        },
      },
    },
  });

  if (!guardian) return { data: [] };

  const contexts = guardian.students
    .map((sg) => sg.student)
    .filter((s) => s.status === "ACTIVE" || s.status === "SUSPENDED")
    .map((s) => ({
      id: s.id,
      classArmId: s.enrollments[0]?.classArmId ?? null,
      classId: s.enrollments[0]?.classArm?.classId ?? null,
      programmeId: s.enrollments[0]?.classArm?.class?.programmeId ?? null,
      houseId: s.houseAssignment?.houseId ?? null,
    }));
  const studentIds = contexts.map((c) => c.id);

  const now = new Date();
  const candidates = await db.announcement.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: "PUBLISHED",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { publishedAt: "desc" },
  });

  const visible = candidates.filter((a) =>
    doesAnnouncementTargetGuardian(
      { targetType: a.targetType, targetIds: a.targetIds },
      studentIds,
      contexts,
    ),
  );

  return { data: visible };
}

/** @no-audit Read-only parent view. */
export async function getParentCircularsAction(input: {
  tab: "pending" | "history";
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ANNOUNCEMENTS_READ);
  if (denied) return denied;

  const base = await getParentAnnouncementsAction();
  if ("error" in base) return base;

  const userId = ctx.session.user.id!;
  const guardian = await db.guardian.findUnique({
    where: { userId },
    select: { householdId: true },
  });

  const ackIds = new Set<string>();
  if (guardian?.householdId) {
    const acks = await db.circularAcknowledgement.findMany({
      where: {
        householdId: guardian.householdId,
        announcementId: { in: base.data.map((a) => a.id) },
      },
      select: { announcementId: true },
    });
    for (const a of acks) ackIds.add(a.announcementId);
  }

  const hydrated = base.data.map((a) => ({
    ...a,
    isAcknowledged: ackIds.has(a.id),
  }));

  const pending = hydrated.filter(
    (a) => a.requiresAcknowledgement && !a.isAcknowledged,
  );
  const history = hydrated.filter(
    (a) => !a.requiresAcknowledgement || a.isAcknowledged,
  );

  return { data: input.tab === "pending" ? pending : history };
}
