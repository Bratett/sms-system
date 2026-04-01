"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";

export async function getArrearsAction(filters?: {
  termId?: string;
  classArmId?: string;
  minBalance?: number;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const skip = (page - 1) * pageSize;

  // Build where clause for student bills with outstanding balances
  const whereClause: Record<string, unknown> = {
    balanceAmount: { gt: filters?.minBalance ?? 0 },
  };

  if (filters?.termId) {
    whereClause.termId = filters.termId;
  }

  // Get bills with outstanding balances
  const [bills, totalCount] = await Promise.all([
    db.studentBill.findMany({
      where: whereClause,
      include: {
        feeStructure: {
          select: {
            name: true,
            termId: true,
          },
        },
      },
      orderBy: { balanceAmount: "desc" },
      skip,
      take: pageSize,
    }),
    db.studentBill.count({ where: whereClause }),
  ]);

  // Get student details for the bills
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
        include: {
          classArm: {
            include: {
              class: { select: { name: true } },
            },
          },
        },
        take: 1,
      },
    },
  });

  const studentMap = new Map(students.map((s) => [s.id, s]));

  // If classArmId filter is set, filter by enrollment
  let filteredBills = bills;
  if (filters?.classArmId) {
    filteredBills = bills.filter((bill) => {
      const student = studentMap.get(bill.studentId);
      return student?.enrollments.some((e) => e.classArmId === filters.classArmId);
    });
  }

  // Aggregate by student
  const studentArrearsMap = new Map<
    string,
    {
      studentId: string;
      studentDbId: string;
      studentName: string;
      className: string;
      totalBilled: number;
      totalPaid: number;
      balanceAmount: number;
      terms: string[];
    }
  >();

  for (const bill of filteredBills) {
    const student = studentMap.get(bill.studentId);
    if (!student) continue;

    const className =
      student.enrollments[0]?.classArm?.class?.name
        ? `${student.enrollments[0].classArm.class.name} ${student.enrollments[0].classArm.name}`
        : "N/A";

    const existing = studentArrearsMap.get(bill.studentId);
    if (existing) {
      existing.totalBilled += toNum(bill.totalAmount);
      existing.totalPaid += toNum(bill.paidAmount);
      existing.balanceAmount += toNum(bill.balanceAmount);
      if (bill.feeStructure?.termId && !existing.terms.includes(bill.feeStructure.termId)) {
        existing.terms.push(bill.feeStructure.termId);
      }
    } else {
      studentArrearsMap.set(bill.studentId, {
        studentDbId: student.id,
        studentId: student.studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        className,
        totalBilled: toNum(bill.totalAmount),
        totalPaid: toNum(bill.paidAmount),
        balanceAmount: toNum(bill.balanceAmount),
        terms: bill.feeStructure?.termId ? [bill.feeStructure.termId] : [],
      });
    }
  }

  const data = Array.from(studentArrearsMap.values()).sort(
    (a, b) => b.balanceAmount - a.balanceAmount
  );

  return {
    data,
    pagination: {
      page,
      pageSize,
      total: totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
}

export async function getArrearsReportAction(termId?: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const whereClause: Record<string, unknown> = {
    balanceAmount: { gt: 0 },
  };

  if (termId) {
    whereClause.termId = termId;
  }

  const bills = await db.studentBill.findMany({
    where: whereClause,
    include: {
      feeStructure: {
        select: {
          name: true,
          programmeId: true,
        },
      },
    },
  });

  // Get student details including enrollments
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
        include: {
          classArm: {
            include: {
              class: {
                select: { id: true, name: true, programmeId: true },
              },
            },
          },
        },
        take: 1,
      },
    },
  });

  const studentMap = new Map(students.map((s) => [s.id, s]));

  // Calculate summary
  const totalOutstanding = bills.reduce((sum, b) => sum + toNum(b.balanceAmount), 0);
  const totalStudents = studentIds.length;

  // Group by class
  const byClass = new Map<string, { className: string; count: number; outstanding: number }>();
  // Group by programme
  const byProgramme = new Map<string, { programmeName: string; count: number; outstanding: number }>();

  for (const bill of bills) {
    const student = studentMap.get(bill.studentId);
    const enrollment = student?.enrollments[0];
    const className = enrollment?.classArm?.class?.name ?? "Unassigned";
    const programmeId = enrollment?.classArm?.class?.programmeId ?? "unassigned";

    // By class
    const classEntry = byClass.get(className) ?? { className, count: 0, outstanding: 0 };
    classEntry.count++;
    classEntry.outstanding += toNum(bill.balanceAmount);
    byClass.set(className, classEntry);

    // By programme
    const progEntry = byProgramme.get(programmeId) ?? {
      programmeName: programmeId === "unassigned" ? "Unassigned" : programmeId,
      count: 0,
      outstanding: 0,
    };
    progEntry.count++;
    progEntry.outstanding += toNum(bill.balanceAmount);
    byProgramme.set(programmeId, progEntry);
  }

  // Top 10 debtors
  const studentBalances = new Map<string, { studentId: string; name: string; className: string; outstanding: number }>();
  for (const bill of bills) {
    const student = studentMap.get(bill.studentId);
    if (!student) continue;

    const className =
      student.enrollments[0]?.classArm?.class?.name
        ? `${student.enrollments[0].classArm.class.name} ${student.enrollments[0].classArm.name}`
        : "N/A";

    const existing = studentBalances.get(bill.studentId);
    if (existing) {
      existing.outstanding += toNum(bill.balanceAmount);
    } else {
      studentBalances.set(bill.studentId, {
        studentId: student.studentId,
        name: `${student.firstName} ${student.lastName}`,
        className,
        outstanding: toNum(bill.balanceAmount),
      });
    }
  }

  const topDebtors = Array.from(studentBalances.values())
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 10);

  return {
    data: {
      totalOutstanding,
      totalStudents,
      averageArrears: totalStudents > 0 ? totalOutstanding / totalStudents : 0,
      byClass: Array.from(byClass.values()).sort((a, b) => b.outstanding - a.outstanding),
      byProgramme: Array.from(byProgramme.values()).sort((a, b) => b.outstanding - a.outstanding),
      topDebtors,
    },
  };
}

export async function carryForwardArrearsAction(fromTermId: string, toTermId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  // Validate terms exist
  const [fromTerm, toTerm] = await Promise.all([
    db.term.findUnique({ where: { id: fromTermId }, include: { academicYear: true } }),
    db.term.findUnique({ where: { id: toTermId }, include: { academicYear: true } }),
  ]);

  if (!fromTerm) return { error: "Source term not found" };
  if (!toTerm) return { error: "Destination term not found" };

  // Get all bills with outstanding balances from the source term
  const overdueBills = await db.studentBill.findMany({
    where: {
      termId: fromTermId,
      balanceAmount: { gt: 0 },
      status: { in: ["UNPAID", "PARTIAL"] },
    },
    include: {
      feeStructure: { select: { schoolId: true } },
    },
  });

  if (overdueBills.length === 0) {
    return { data: { carried: 0, message: "No outstanding arrears found for the source term" } };
  }

  const schoolId = overdueBills[0].feeStructure.schoolId;

  // Find or create an arrears fee structure in the destination term
  let arrearsFeeStructure = await db.feeStructure.findFirst({
    where: {
      schoolId,
      termId: toTermId,
      academicYearId: toTerm.academicYearId,
      name: { contains: "Arrears" },
      status: "ACTIVE",
    },
  });

  if (!arrearsFeeStructure) {
    arrearsFeeStructure = await db.feeStructure.create({
      data: {
        schoolId,
        name: `Carried Forward Arrears - ${toTerm.name}`,
        academicYearId: toTerm.academicYearId,
        termId: toTermId,
        status: "ACTIVE",
      },
    });

    // Create a single "Arrears" fee item
    await db.feeItem.create({
      data: {
        feeStructureId: arrearsFeeStructure.id,
        name: "Carried Forward Arrears",
        code: "ARR",
        amount: 0, // placeholder - actual amounts are per-student
        isOptional: false,
      },
    });
  }

  const arrearsItem = await db.feeItem.findFirst({
    where: { feeStructureId: arrearsFeeStructure.id, code: "ARR" },
  });

  let carried = 0;
  const errors: string[] = [];

  for (const bill of overdueBills) {
    try {
      // Check if arrears bill already exists for this student in dest term
      const existingBill = await db.studentBill.findUnique({
        where: {
          studentId_feeStructureId: {
            studentId: bill.studentId,
            feeStructureId: arrearsFeeStructure.id,
          },
        },
      });

      if (existingBill) continue;

      await db.$transaction(async (tx) => {
        const newBill = await tx.studentBill.create({
          data: {
            studentId: bill.studentId,
            feeStructureId: arrearsFeeStructure!.id,
            termId: toTermId,
            academicYearId: toTerm.academicYearId,
            totalAmount: bill.balanceAmount,
            paidAmount: 0,
            balanceAmount: bill.balanceAmount,
            status: "UNPAID",
          },
        });

        if (arrearsItem) {
          await tx.studentBillItem.create({
            data: {
              studentBillId: newBill.id,
              feeItemId: arrearsItem.id,
              amount: bill.balanceAmount,
            },
          });
        }
      });

      carried++;
    } catch (err) {
      errors.push(
        `Failed for student ${bill.studentId}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "StudentBill",
    entityId: arrearsFeeStructure.id,
    module: "finance",
    description: `Carried forward ${carried} arrears from ${fromTerm.name} to ${toTerm.name}`,
    metadata: { carried, errors: errors.length },
  });

  return { data: { carried, errors } };
}
