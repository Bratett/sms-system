"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import {
  createTaxRecordSchema,
  type CreateTaxRecordInput,
} from "@/modules/accounting/schemas/financial-reports.schema";

export async function getTaxRecordsAction(filters?: { taxType?: string; status?: string; year?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
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
    outstanding: toNum(r.amount) - toNum(r.paidAmount),
  }));

  return { data };
}

export async function createTaxRecordAction(data: CreateTaxRecordInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const parsed = createTaxRecordSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  const record = await db.taxRecord.create({
    data: { schoolId: ctx.schoolId, ...parsed.data },
  });

  await audit({ userId: ctx.session.user.id, action: "CREATE", entity: "TaxRecord", entityId: record.id, module: "accounting", description: `Created ${parsed.data.taxType} tax record for ${parsed.data.period}` });

  return { data: record };
}

export async function fileTaxReturnAction(recordId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TAX_COMPLIANCE_FILE);
  if (denied) return denied;

  const record = await db.taxRecord.findUnique({ where: { id: recordId } });
  if (!record) return { error: "Tax record not found" };
  if (record.status !== "PENDING") return { error: "Only pending records can be filed" };

  await db.taxRecord.update({
    where: { id: recordId },
    data: { status: "FILED", filedBy: ctx.session.user.id, filedAt: new Date() },
  });

  await audit({ userId: ctx.session.user.id, action: "UPDATE", entity: "TaxRecord", entityId: recordId, module: "accounting", description: `Filed ${record.taxType} tax return for ${record.period}` });

  return { data: { success: true } };
}

export async function recordTaxPaymentAction(recordId: string, amount: number, referenceNumber?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const record = await db.taxRecord.findUnique({ where: { id: recordId } });
  if (!record) return { error: "Tax record not found" };

  const newPaidAmount = toNum(record.paidAmount) + amount;

  await db.taxRecord.update({
    where: { id: recordId },
    data: {
      paidAmount: newPaidAmount,
      paidDate: new Date(),
      referenceNumber: referenceNumber ?? record.referenceNumber,
      status: newPaidAmount >= toNum(record.amount) ? "PAID" : "FILED",
    },
  });

  await audit({ userId: ctx.session.user.id, action: "UPDATE", entity: "TaxRecord", entityId: recordId, module: "accounting", description: `Recorded tax payment of GHS ${amount} for ${record.taxType} (${record.period})` });

  return { data: { success: true } };
}

export async function getTaxSummaryAction(year?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TAX_COMPLIANCE_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (year) where.period = { startsWith: year };

  const records = await db.taxRecord.findMany({ where });

  const totalDue = records.reduce((sum, r) => sum + toNum(r.amount), 0);
  const totalPaid = records.reduce((sum, r) => sum + toNum(r.paidAmount), 0);
  const overdueCount = records.filter((r) => r.status === "PENDING" && new Date(r.dueDate) < new Date()).length;

  const byType = new Map<string, { type: string; due: number; paid: number; count: number }>();
  for (const r of records) {
    const entry = byType.get(r.taxType) ?? { type: r.taxType, due: 0, paid: 0, count: 0 };
    entry.due += toNum(r.amount);
    entry.paid += toNum(r.paidAmount);
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
