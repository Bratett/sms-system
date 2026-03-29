"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function getFinanceReportAction(filters?: {
  termId?: string;
  academicYearId?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  // Determine academic year
  let academicYearId = filters?.academicYearId;
  if (!academicYearId) {
    const current = await db.academicYear.findFirst({
      where: { schoolId: school.id, isCurrent: true },
    });
    academicYearId = current?.id;
  }

  if (!academicYearId) {
    return { error: "No academic year found." };
  }

  const billWhere: Record<string, unknown> = { academicYearId };
  if (filters?.termId) {
    billWhere.termId = filters.termId;
  }

  // Total billed, paid, outstanding
  const billingAgg = await db.studentBill.aggregate({
    _sum: { totalAmount: true, paidAmount: true, balanceAmount: true },
    where: billWhere,
  });

  const totalBilled = billingAgg._sum.totalAmount ?? 0;
  const totalPaid = billingAgg._sum.paidAmount ?? 0;
  const totalOutstanding = billingAgg._sum.balanceAmount ?? 0;
  const collectionRate =
    totalBilled > 0
      ? Math.round((totalPaid / totalBilled) * 100 * 100) / 100
      : 0;

  // Payment where clause
  const paymentWhere: Record<string, unknown> = {
    status: "CONFIRMED",
    studentBill: { academicYearId },
  };
  if (filters?.termId) {
    (paymentWhere.studentBill as Record<string, unknown>).termId =
      filters.termId;
  }

  // Breakdown by payment method
  const byMethodRaw = await db.payment.groupBy({
    by: ["paymentMethod"],
    where: paymentWhere,
    _sum: { amount: true },
    _count: { _all: true },
  });

  const paymentMethods = ["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CHEQUE", "OTHER"];
  const byPaymentMethod = paymentMethods.map((method) => {
    const found = byMethodRaw.find((r) => r.paymentMethod === method);
    return {
      method,
      totalAmount: found?._sum.amount ?? 0,
      count: found?._count._all ?? 0,
    };
  });

  // Revenue by fee category
  // Get bill items with their fee item names grouped
  const billItems = await db.studentBillItem.findMany({
    where: {
      studentBill: billWhere,
    },
    include: {
      feeItem: { select: { name: true } },
    },
  });

  const categoryRevenue = new Map<string, number>();
  for (const item of billItems) {
    const name = item.feeItem.name;
    categoryRevenue.set(name, (categoryRevenue.get(name) || 0) + item.amount);
  }

  const revenueByCategory = [...categoryRevenue.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Top 10 debtors (highest outstanding balance)
  const topDebtors = await db.studentBill.findMany({
    where: {
      ...billWhere,
      balanceAmount: { gt: 0 },
    },
    orderBy: { balanceAmount: "desc" },
    take: 10,
    select: {
      studentId: true,
      totalAmount: true,
      paidAmount: true,
      balanceAmount: true,
    },
  });

  // Resolve student names for debtors
  const debtorStudentIds = topDebtors.map((d) => d.studentId);
  let studentMap = new Map<string, { name: string; studentId: string }>();
  if (debtorStudentIds.length > 0) {
    const students = await db.student.findMany({
      where: { id: { in: debtorStudentIds } },
      select: { id: true, firstName: true, lastName: true, studentId: true },
    });
    studentMap = new Map(
      students.map((s) => [
        s.id,
        { name: `${s.firstName} ${s.lastName}`, studentId: s.studentId },
      ])
    );
  }

  const topDebtorsList = topDebtors.map((d) => {
    const student = studentMap.get(d.studentId);
    return {
      studentName: student?.name ?? "Unknown",
      studentId: student?.studentId ?? "",
      totalBilled: d.totalAmount,
      totalPaid: d.paidAmount,
      outstanding: d.balanceAmount,
    };
  });

  // Daily collection trend (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentPayments = await db.payment.findMany({
    where: {
      status: "CONFIRMED",
      receivedAt: { gte: thirtyDaysAgo },
      studentBill: { academicYearId },
    },
    select: {
      amount: true,
      receivedAt: true,
    },
    orderBy: { receivedAt: "asc" },
  });

  const dailyMap = new Map<string, number>();
  for (const p of recentPayments) {
    const dateKey = p.receivedAt.toISOString().split("T")[0];
    dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + p.amount);
  }

  const dailyCollectionTrend = [...dailyMap.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    data: {
      totalBilled,
      totalPaid,
      totalOutstanding,
      collectionRate,
      byPaymentMethod,
      revenueByCategory,
      topDebtors: topDebtorsList,
      dailyCollectionTrend,
    },
  };
}
