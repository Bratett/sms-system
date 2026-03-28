"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

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
      existing.totalBilled += bill.totalAmount;
      existing.totalPaid += bill.paidAmount;
      existing.balanceAmount += bill.balanceAmount;
      if (bill.feeStructure?.termId && !existing.terms.includes(bill.feeStructure.termId)) {
        existing.terms.push(bill.feeStructure.termId);
      }
    } else {
      studentArrearsMap.set(bill.studentId, {
        studentDbId: student.id,
        studentId: student.studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        className,
        totalBilled: bill.totalAmount,
        totalPaid: bill.paidAmount,
        balanceAmount: bill.balanceAmount,
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
  const totalOutstanding = bills.reduce((sum, b) => sum + b.balanceAmount, 0);
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
    classEntry.outstanding += bill.balanceAmount;
    byClass.set(className, classEntry);

    // By programme
    const progEntry = byProgramme.get(programmeId) ?? {
      programmeName: programmeId === "unassigned" ? "Unassigned" : programmeId,
      count: 0,
      outstanding: 0,
    };
    progEntry.count++;
    progEntry.outstanding += bill.balanceAmount;
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
      existing.outstanding += bill.balanceAmount;
    } else {
      studentBalances.set(bill.studentId, {
        studentId: student.studentId,
        name: `${student.firstName} ${student.lastName}`,
        className,
        outstanding: bill.balanceAmount,
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

export async function carryForwardArrearsAction(_fromTermId: string, _toTermId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  return {
    error: "Arrears carry-forward is not available in this version. This feature will be implemented in Phase 2.",
  };
}
