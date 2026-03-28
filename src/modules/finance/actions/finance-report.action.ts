"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function getCollectionSummaryAction(termId?: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const billWhere: Record<string, unknown> = {};
  const paymentWhere: Record<string, unknown> = {
    status: "CONFIRMED",
  };

  if (termId) {
    billWhere.termId = termId;
    paymentWhere.studentBill = { termId };
  }

  // Total billed and collected
  const billAgg = await db.studentBill.aggregate({
    where: billWhere,
    _sum: {
      totalAmount: true,
      paidAmount: true,
      balanceAmount: true,
    },
  });

  const totalBilled = billAgg._sum.totalAmount ?? 0;
  const totalCollected = billAgg._sum.paidAmount ?? 0;
  const totalOutstanding = billAgg._sum.balanceAmount ?? 0;
  const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

  // Collection by payment method
  const payments = await db.payment.findMany({
    where: paymentWhere,
    select: {
      paymentMethod: true,
      amount: true,
    },
  });

  const methodBreakdown = new Map<string, { method: string; count: number; total: number }>();
  for (const p of payments) {
    const existing = methodBreakdown.get(p.paymentMethod) ?? {
      method: p.paymentMethod,
      count: 0,
      total: 0,
    };
    existing.count++;
    existing.total += p.amount;
    methodBreakdown.set(p.paymentMethod, existing);
  }

  // Daily collection trend (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentPayments = await db.payment.findMany({
    where: {
      ...paymentWhere,
      receivedAt: { gte: thirtyDaysAgo },
    },
    select: {
      amount: true,
      receivedAt: true,
    },
    orderBy: { receivedAt: "asc" },
  });

  const dailyTrend = new Map<string, number>();
  for (const p of recentPayments) {
    const day = p.receivedAt.toISOString().split("T")[0];
    dailyTrend.set(day, (dailyTrend.get(day) ?? 0) + p.amount);
  }

  return {
    data: {
      totalBilled,
      totalCollected,
      totalOutstanding,
      collectionRate,
      byMethod: Array.from(methodBreakdown.values()).sort((a, b) => b.total - a.total),
      dailyTrend: Array.from(dailyTrend.entries()).map(([date, amount]) => ({
        date,
        amount,
      })),
    },
  };
}

export async function getRevenueByClassAction(termId?: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const billWhere: Record<string, unknown> = {};
  if (termId) {
    billWhere.termId = termId;
  }

  const bills = await db.studentBill.findMany({
    where: billWhere,
    select: {
      studentId: true,
      totalAmount: true,
      paidAmount: true,
      balanceAmount: true,
    },
  });

  // Get student enrollments
  const studentIds = [...new Set(bills.map((b) => b.studentId))];
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: {
      id: true,
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

  const studentClassMap = new Map<string, string>();
  for (const s of students) {
    const className = s.enrollments[0]?.classArm?.class?.name ?? "Unassigned";
    studentClassMap.set(s.id, className);
  }

  // Aggregate by class
  const classMap = new Map<
    string,
    {
      className: string;
      students: Set<string>;
      billed: number;
      collected: number;
      outstanding: number;
    }
  >();

  for (const bill of bills) {
    const className = studentClassMap.get(bill.studentId) ?? "Unassigned";
    const existing = classMap.get(className) ?? {
      className,
      students: new Set<string>(),
      billed: 0,
      collected: 0,
      outstanding: 0,
    };
    existing.students.add(bill.studentId);
    existing.billed += bill.totalAmount;
    existing.collected += bill.paidAmount;
    existing.outstanding += bill.balanceAmount;
    classMap.set(className, existing);
  }

  const data = Array.from(classMap.values())
    .map((c) => ({
      className: c.className,
      students: c.students.size,
      billed: c.billed,
      collected: c.collected,
      outstanding: c.outstanding,
      collectionRate: c.billed > 0 ? (c.collected / c.billed) * 100 : 0,
    }))
    .sort((a, b) => a.className.localeCompare(b.className));

  return { data };
}

export async function getRevenueByFeeItemAction(termId?: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const billItemWhere: Record<string, unknown> = {};
  if (termId) {
    billItemWhere.studentBill = { termId };
  }

  const billItems = await db.studentBillItem.findMany({
    where: billItemWhere,
    include: {
      feeItem: {
        select: { name: true },
      },
    },
  });

  // Aggregate by fee item
  const feeItemMap = new Map<
    string,
    { name: string; totalBilled: number; totalCollected: number }
  >();

  for (const item of billItems) {
    const name = item.feeItem.name;
    const existing = feeItemMap.get(name) ?? { name, totalBilled: 0, totalCollected: 0 };
    existing.totalBilled += item.amount;
    existing.totalCollected += item.paidAmount;
    feeItemMap.set(name, existing);
  }

  const data = Array.from(feeItemMap.values())
    .map((f) => ({
      ...f,
      collectionRate: f.totalBilled > 0 ? (f.totalCollected / f.totalBilled) * 100 : 0,
    }))
    .sort((a, b) => b.totalBilled - a.totalBilled);

  return { data };
}

export async function getDailyCollectionTrendAction(termId?: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const paymentWhere: Record<string, unknown> = {
    status: "CONFIRMED",
  };

  if (termId) {
    paymentWhere.studentBill = { termId };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const payments = await db.payment.findMany({
    where: {
      ...paymentWhere,
      receivedAt: { gte: thirtyDaysAgo },
    },
    select: {
      amount: true,
      receivedAt: true,
    },
    orderBy: { receivedAt: "asc" },
  });

  const dailyTrend = new Map<string, { date: string; amount: number; count: number }>();
  for (const p of payments) {
    const day = p.receivedAt.toISOString().split("T")[0];
    const existing = dailyTrend.get(day) ?? { date: day, amount: 0, count: 0 };
    existing.amount += p.amount;
    existing.count++;
    dailyTrend.set(day, existing);
  }

  return { data: Array.from(dailyTrend.values()) };
}

export async function getDebtorListAction(termId?: string, limit?: number) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const billWhere: Record<string, unknown> = {
    balanceAmount: { gt: 0 },
  };

  if (termId) {
    billWhere.termId = termId;
  }

  const bills = await db.studentBill.findMany({
    where: billWhere,
    select: {
      studentId: true,
      totalAmount: true,
      paidAmount: true,
      balanceAmount: true,
    },
  });

  // Get student details
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

  // Aggregate by student
  const debtorMap = new Map<
    string,
    { studentId: string; name: string; className: string; outstanding: number }
  >();

  for (const bill of bills) {
    const student = studentMap.get(bill.studentId);
    if (!student) continue;

    const className =
      student.enrollments[0]?.classArm?.class?.name
        ? `${student.enrollments[0].classArm.class.name} ${student.enrollments[0].classArm.name}`
        : "N/A";

    const existing = debtorMap.get(bill.studentId);
    if (existing) {
      existing.outstanding += bill.balanceAmount;
    } else {
      debtorMap.set(bill.studentId, {
        studentId: student.studentId,
        name: `${student.firstName} ${student.lastName}`,
        className,
        outstanding: bill.balanceAmount,
      });
    }
  }

  const data = Array.from(debtorMap.values())
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, limit ?? 50);

  return { data };
}

export async function getFinanceDashboardAction(termId?: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  // If no termId provided, use current term
  let activeTerm = termId;
  if (!activeTerm) {
    const currentTerm = await db.term.findFirst({
      where: { isCurrent: true },
      select: { id: true },
    });
    activeTerm = currentTerm?.id;
  }

  const billWhere: Record<string, unknown> = {};
  const paymentWhere: Record<string, unknown> = {
    status: "CONFIRMED",
  };

  if (activeTerm) {
    billWhere.termId = activeTerm;
    paymentWhere.studentBill = { termId: activeTerm };
  }

  // Aggregates
  const billAgg = await db.studentBill.aggregate({
    where: billWhere,
    _sum: {
      totalAmount: true,
      paidAmount: true,
      balanceAmount: true,
    },
    _count: true,
  });

  const totalBilled = billAgg._sum.totalAmount ?? 0;
  const totalCollected = billAgg._sum.paidAmount ?? 0;
  const totalOutstanding = billAgg._sum.balanceAmount ?? 0;
  const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

  // Payment method breakdown
  const payments = await db.payment.findMany({
    where: paymentWhere,
    select: {
      paymentMethod: true,
      amount: true,
    },
  });

  const methodBreakdown = new Map<string, { method: string; count: number; total: number }>();
  for (const p of payments) {
    const existing = methodBreakdown.get(p.paymentMethod) ?? {
      method: p.paymentMethod,
      count: 0,
      total: 0,
    };
    existing.count++;
    existing.total += p.amount;
    methodBreakdown.set(p.paymentMethod, existing);
  }

  // Recent payments (last 10)
  const recentPayments = await db.payment.findMany({
    where: paymentWhere,
    include: {
      studentBill: {
        select: {
          studentId: true,
        },
      },
    },
    orderBy: { receivedAt: "desc" },
    take: 10,
  });

  // Get student info for recent payments
  const rpStudentIds = [...new Set(recentPayments.map((p) => p.studentBill.studentId))];
  const rpStudents = await db.student.findMany({
    where: { id: { in: rpStudentIds } },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
    },
  });
  const rpStudentMap = new Map(rpStudents.map((s) => [s.id, s]));

  const recentPaymentsData = recentPayments.map((p) => {
    const student = rpStudentMap.get(p.studentBill.studentId);
    return {
      id: p.id,
      amount: p.amount,
      method: p.paymentMethod,
      date: p.receivedAt,
      studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown",
      studentId: student?.studentId ?? "N/A",
    };
  });

  return {
    data: {
      totalBilled,
      totalCollected,
      totalOutstanding,
      collectionRate,
      totalBills: billAgg._count,
      byMethod: Array.from(methodBreakdown.values()).sort((a, b) => b.total - a.total),
      recentPayments: recentPaymentsData,
    },
  };
}
