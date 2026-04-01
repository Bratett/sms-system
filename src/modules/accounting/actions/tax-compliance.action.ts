"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  createTaxRecordSchema,
  type CreateTaxRecordInput,
} from "@/modules/accounting/schemas/financial-reports.schema";

export async function getTaxRecordsAction(filters?: { taxType?: string; status?: string; year?: string }) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const where: Record<string, unknown> = { schoolId: school.id };
  if (filters?.taxType) where.taxType = filters.taxType;
  if (filters?.status) where.status = filters.status;
  if (filters?.year) where.period = { startsWith: filters.year };

  const records = await db.taxRecord.findMany({
    where,
    orderBy: { dueDate: "desc" },
  });

  const userIds = records.map((r) => r.filedBy).filter(Boolean) as string[];
  const users = userIds.length > 0
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = records.map((r) => ({
    ...r,
    filedByName: r.filedBy ? userMap.get(r.filedBy) ?? null : null,
    isOverdue: r.status === "PENDING" && new Date(r.dueDate) < new Date(),
    outstanding: r.amount - r.paidAmount,
  }));

  return { data };
}

export async function createTaxRecordAction(data: CreateTaxRecordInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = createTaxRecordSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const record = await db.taxRecord.create({
    data: { schoolId: school.id, ...parsed.data },
  });

  await audit({ userId: session.user.id!, action: "CREATE", entity: "TaxRecord", entityId: record.id, module: "accounting", description: `Created ${parsed.data.taxType} tax record for ${parsed.data.period}` });

  return { data: record };
}

export async function fileTaxReturnAction(recordId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const record = await db.taxRecord.findUnique({ where: { id: recordId } });
  if (!record) return { error: "Tax record not found" };
  if (record.status !== "PENDING") return { error: "Only pending records can be filed" };

  await db.taxRecord.update({
    where: { id: recordId },
    data: { status: "FILED", filedBy: session.user.id!, filedAt: new Date() },
  });

  await audit({ userId: session.user.id!, action: "UPDATE", entity: "TaxRecord", entityId: recordId, module: "accounting", description: `Filed ${record.taxType} tax return for ${record.period}` });

  return { data: { success: true } };
}

export async function recordTaxPaymentAction(recordId: string, amount: number, referenceNumber?: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const record = await db.taxRecord.findUnique({ where: { id: recordId } });
  if (!record) return { error: "Tax record not found" };

  const newPaidAmount = record.paidAmount + amount;

  await db.taxRecord.update({
    where: { id: recordId },
    data: {
      paidAmount: newPaidAmount,
      paidDate: new Date(),
      referenceNumber: referenceNumber ?? record.referenceNumber,
      status: newPaidAmount >= record.amount ? "PAID" : "FILED",
    },
  });

  await audit({ userId: session.user.id!, action: "UPDATE", entity: "TaxRecord", entityId: recordId, module: "accounting", description: `Recorded tax payment of GHS ${amount} for ${record.taxType} (${record.period})` });

  return { data: { success: true } };
}

export async function getTaxSummaryAction(year?: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const where: Record<string, unknown> = { schoolId: school.id };
  if (year) where.period = { startsWith: year };

  const records = await db.taxRecord.findMany({ where });

  const totalDue = records.reduce((sum, r) => sum + r.amount, 0);
  const totalPaid = records.reduce((sum, r) => sum + r.paidAmount, 0);
  const overdueCount = records.filter((r) => r.status === "PENDING" && new Date(r.dueDate) < new Date()).length;

  const byType = new Map<string, { type: string; due: number; paid: number; count: number }>();
  for (const r of records) {
    const entry = byType.get(r.taxType) ?? { type: r.taxType, due: 0, paid: 0, count: 0 };
    entry.due += r.amount;
    entry.paid += r.paidAmount;
    entry.count++;
    byType.set(r.taxType, entry);
  }

  return {
    data: {
      totalDue,
      totalPaid,
      totalOutstanding: totalDue - totalPaid,
      overdueCount,
      complianceRate: records.length > 0 ? (records.filter((r) => r.status === "PAID").length / records.length) * 100 : 0,
      byType: Array.from(byType.values()),
    },
  };
}
