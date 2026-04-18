"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { audit } from "@/lib/audit";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { toNum } from "@/lib/decimal";
import {
  generateBillsSchema,
  type GenerateBillsInput,
} from "@/modules/finance/schemas/billing.schema";
import { postJournalTransaction, findAccountByCode, LedgerError } from "@/modules/accounting/lib/ledger";
import { ACCOUNTS, feeRevenueAccountCode } from "@/modules/accounting/lib/account-codes";

export async function generateBillsAction(data: GenerateBillsInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.BILLING_CREATE);
  if (denied) return denied;

  const parsed = generateBillsSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const feeStructure = await db.feeStructure.findUnique({
    where: { id: parsed.data.feeStructureId },
    include: { feeItems: true },
  });

  if (!feeStructure) {
    return { error: "Fee structure not found" };
  }

  if (feeStructure.status !== "ACTIVE") {
    return { error: "Fee structure must be ACTIVE to generate bills" };
  }

  // Build student filter based on fee structure criteria
  const studentWhere: Record<string, unknown> = {
    schoolId: feeStructure.schoolId,
    status: "ACTIVE",
  };

  if (feeStructure.boardingStatus) {
    studentWhere.boardingStatus = feeStructure.boardingStatus;
  }

  // If classArmId is provided, only get students enrolled in that class arm
  let studentIds: string[] | null = null;
  if (parsed.data.classArmId) {
    const enrollments = await db.enrollment.findMany({
      where: {
        classArmId: parsed.data.classArmId,
        academicYearId: feeStructure.academicYearId,
        status: "ACTIVE",
      },
      select: { studentId: true },
    });
    studentIds = enrollments.map((e) => e.studentId);
  } else if (feeStructure.programmeId) {
    // Filter by programme via class -> classArm -> enrollment
    const classArms = await db.classArm.findMany({
      where: {
        class: {
          programmeId: feeStructure.programmeId,
          academicYearId: feeStructure.academicYearId,
        },
      },
      select: { id: true },
    });
    const classArmIds = classArms.map((ca) => ca.id);
    const enrollments = await db.enrollment.findMany({
      where: {
        classArmId: { in: classArmIds },
        academicYearId: feeStructure.academicYearId,
        status: "ACTIVE",
      },
      select: { studentId: true },
    });
    studentIds = enrollments.map((e) => e.studentId);
  }

  if (studentIds !== null) {
    studentWhere.id = { in: studentIds };
  }

  const students = await db.student.findMany({
    where: studentWhere,
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });

  // Map of studentId → isFreeShsPlacement (for the matching academic year).
  // Free-SHS students have tuition fee items waived; boarding/PTA/feeding still apply.
  const activeEnrollments = await db.enrollment.findMany({
    where: {
      schoolId: ctx.schoolId,
      studentId: { in: students.map((s) => s.id) },
      academicYearId: feeStructure.academicYearId,
      status: "ACTIVE",
    },
    select: { studentId: true, isFreeShsPlacement: true },
  });
  const freeShsByStudentId = new Map(
    activeEnrollments.map((e) => [e.studentId, e.isFreeShsPlacement]),
  );

  let generated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const student of students) {
    try {
      const isFreeShs = freeShsByStudentId.get(student.id) === true;

      // Filter non-optional items, dropping TUITION for Free-SHS enrollments.
      const studentFeeItems = feeStructure.feeItems.filter(
        (item) =>
          !item.isOptional && !(isFreeShs && item.type === "TUITION"),
      );
      const nonOptionalTotal = studentFeeItems.reduce(
        (sum, item) => sum + toNum(item.amount),
        0,
      );
      // Check if bill already exists for this student + fee structure
      const existingBill = await db.studentBill.findUnique({
        where: {
          studentId_feeStructureId: {
            studentId: student.id,
            feeStructureId: feeStructure.id,
          },
        },
      });

      if (existingBill) {
        skipped++;
        continue;
      }

      // Check for active scholarships for this student
      const studentScholarships = await db.studentScholarship.findMany({
        where: {
          studentId: student.id,
          termId: feeStructure.termId,
          scholarship: { status: "ACTIVE" },
        },
        include: { scholarship: true },
      });

      let scholarshipDiscount = 0;
      for (const ss of studentScholarships) {
        if (ss.scholarship.type === "PERCENTAGE") {
          scholarshipDiscount += nonOptionalTotal * (toNum(ss.scholarship.value) / 100);
        } else {
          scholarshipDiscount += toNum(ss.scholarship.value);
        }
      }

      const adjustedTotal = Math.max(0, nonOptionalTotal - scholarshipDiscount);

      await db.$transaction(async (tx) => {
        const bill = await tx.studentBill.create({
          data: {
            schoolId: ctx.schoolId,
            studentId: student.id,
            feeStructureId: feeStructure.id,
            termId: feeStructure.termId,
            academicYearId: feeStructure.academicYearId,
            totalAmount: adjustedTotal,
            paidAmount: 0,
            balanceAmount: adjustedTotal,
            status: adjustedTotal === 0 ? "WAIVED" : "UNPAID",
          },
        });

        // Create bill items for each fee item. `studentFeeItems` already excludes
        // optional items and (for Free-SHS placement enrollments) tuition items.
        const nonOptionalItems = studentFeeItems;
        const billItemsData = nonOptionalItems.map((item) => ({
          schoolId: ctx.schoolId,
          studentBillId: bill.id,
          feeItemId: item.id,
          amount: item.amount,
          waivedAmount: 0,
          paidAmount: 0,
        }));

        if (billItemsData.length > 0) {
          await tx.studentBillItem.createMany({ data: billItemsData });
        }

        // Accrual-basis journal (IPSAS): Dr Student Fees Receivable / Cr Fee Revenue per item.
        // Skipped when adjusted total is zero (fully waived/scholarship bill).
        if (adjustedTotal > 0) {
          const arAccount = await findAccountByCode(tx, ctx.schoolId, ACCOUNTS.FEES_RECEIVABLE);
          if (arAccount) {
            // Pro-rate scholarship discount across items so revenue totals match adjustedTotal
            const grossTotal = nonOptionalItems.reduce((s, i) => s + toNum(i.amount), 0);
            const ratio = grossTotal > 0 ? adjustedTotal / grossTotal : 0;
            const revenueLines: Array<{ accountId: string; side: "CREDIT"; amount: number; narration: string }> = [];
            let allocated = 0;
            for (let i = 0; i < nonOptionalItems.length; i++) {
              const item = nonOptionalItems[i];
              const revCode = feeRevenueAccountCode(item.name);
              const revAccount = await findAccountByCode(tx, ctx.schoolId, revCode);
              if (!revAccount) continue;
              const isLast = i === nonOptionalItems.length - 1;
              const amount = isLast ? Math.round((adjustedTotal - allocated) * 100) / 100 : Math.round(toNum(item.amount) * ratio * 100) / 100;
              if (amount <= 0) continue;
              allocated += amount;
              revenueLines.push({
                accountId: revAccount.id,
                side: "CREDIT",
                amount,
                narration: `${item.name} — ${student.firstName} ${student.lastName}`,
              });
            }
            if (revenueLines.length > 0) {
              const posted = await postJournalTransaction(tx, {
                schoolId: ctx.schoolId,
                date: new Date(),
                description: `Fees billed to ${student.firstName} ${student.lastName} (${student.studentId}) — ${feeStructure.name}`,
                referenceType: "Billing",
                referenceId: bill.id,
                createdBy: ctx.session.user.id,
                isAutoGenerated: true,
                lines: [
                  {
                    accountId: arAccount.id,
                    side: "DEBIT",
                    amount: adjustedTotal,
                    narration: `Bill ${bill.id.slice(-8)}`,
                  },
                  ...revenueLines,
                ],
              });
              await tx.studentBill.update({
                where: { id: bill.id },
                data: { accrualJournalId: posted.journalTransactionId },
              });
            }
          }
        }
      });

      generated++;
    } catch (err) {
      errors.push(`Failed to generate bill for ${student.firstName} ${student.lastName} (${student.studentId}): ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "StudentBill",
    entityId: feeStructure.id,
    module: "finance",
    description: `Generated ${generated} bills for fee structure "${feeStructure.name}" (${skipped} skipped)`,
    metadata: { generated, skipped, errors: errors.length },
  });

  return { data: { generated, skipped, errors } };
}

export async function getBillsAction(filters?: {
  studentId?: string;
  termId?: string;
  status?: string;
  classArmId?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.BILLING_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (filters?.studentId) where.studentId = filters.studentId;
  if (filters?.termId) where.termId = filters.termId;
  if (filters?.status) where.status = filters.status;

  // If classArmId filter, get student IDs enrolled in that class arm
  if (filters?.classArmId) {
    const enrollments = await db.enrollment.findMany({
      where: { classArmId: filters.classArmId, status: "ACTIVE" },
      select: { studentId: true },
    });
    where.studentId = { in: enrollments.map((e) => e.studentId) };
  }

  const [bills, total] = await Promise.all([
    db.studentBill.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { generatedAt: "desc" },
    }),
    db.studentBill.count({ where }),
  ]);

  // Fetch student info for bills
  const studentIds = [...new Set(bills.map((b) => b.studentId))];
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  // Get current enrollments for class info
  const enrollments = await db.enrollment.findMany({
    where: { studentId: { in: studentIds }, status: "ACTIVE" },
    include: {
      classArm: {
        include: {
          class: { select: { name: true } },
        },
      },
    },
  });
  const enrollmentMap = new Map(enrollments.map((e) => [e.studentId, e]));

  const data = bills.map((bill) => {
    const student = studentMap.get(bill.studentId);
    const enrollment = enrollmentMap.get(bill.studentId);
    return {
      ...bill,
      studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown",
      studentIdNumber: student?.studentId ?? "Unknown",
      className: enrollment
        ? `${enrollment.classArm.class.name} ${enrollment.classArm.name}`
        : "N/A",
    };
  });

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getStudentBillAction(billId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.BILLING_READ);
  if (denied) return denied;

  const bill = await db.studentBill.findUnique({
    where: { id: billId },
    include: {
      billItems: {
        include: {
          feeItem: true,
        },
      },
      payments: {
        include: {
          receipt: true,
        },
        orderBy: { receivedAt: "desc" },
      },
      feeStructure: {
        select: { id: true, name: true },
      },
    },
  });

  if (!bill) {
    return { error: "Bill not found" };
  }

  // Fetch student info
  const student = await db.student.findUnique({
    where: { id: bill.studentId },
    select: { id: true, studentId: true, firstName: true, lastName: true, boardingStatus: true },
  });

  // Get current enrollment for class info
  const enrollment = await db.enrollment.findFirst({
    where: { studentId: bill.studentId, status: "ACTIVE" },
    include: {
      classArm: {
        include: {
          class: { select: { name: true } },
        },
      },
    },
  });

  return {
    data: {
      ...bill,
      studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown",
      studentIdNumber: student?.studentId ?? "Unknown",
      boardingStatus: student?.boardingStatus ?? "DAY",
      className: enrollment
        ? `${enrollment.classArm.class.name} ${enrollment.classArm.name}`
        : "N/A",
    },
  };
}

export async function getStudentBillsAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.BILLING_READ);
  if (denied) return denied;

  const bills = await db.studentBill.findMany({
    where: { studentId },
    include: {
      feeStructure: {
        select: { id: true, name: true },
      },
      _count: {
        select: { payments: true },
      },
    },
    orderBy: { generatedAt: "desc" },
  });

  // Fetch term names
  const termIds = [...new Set(bills.map((b) => b.termId))];
  const terms = await db.term.findMany({
    where: { id: { in: termIds } },
    select: { id: true, name: true },
  });
  const termMap = new Map(terms.map((t) => [t.id, t.name]));

  const data = bills.map((bill) => ({
    ...bill,
    termName: termMap.get(bill.termId) ?? "Unknown",
    paymentCount: bill._count.payments,
  }));

  return { data };
}
