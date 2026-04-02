"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import {
  createDonorFundSchema,
  updateDonorFundSchema,
  allocateDonorFundSchema,
  type CreateDonorFundInput,
  type UpdateDonorFundInput,
  type AllocateDonorFundInput,
} from "@/modules/finance/schemas/donor-fund.schema";

export async function getDonorFundsAction(filters?: { isActive?: boolean }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DONOR_FUNDS_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;

  const funds = await db.donorFund.findMany({
    where,
    include: {
      _count: { select: { allocations: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = funds.map((fund) => ({
    ...fund,
    allocationCount: fund._count.allocations,
    availableBalance: toNum(fund.totalReceived) - toNum(fund.totalDisbursed),
    pledgeUtilization: toNum(fund.totalPledged) > 0 ? (toNum(fund.totalReceived) / toNum(fund.totalPledged)) * 100 : 0,
  }));

  return { data };
}

export async function getDonorFundAction(fundId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DONOR_FUNDS_READ);
  if (denied) return denied;

  const fund = await db.donorFund.findUnique({
    where: { id: fundId },
    include: {
      allocations: {
        orderBy: { allocatedAt: "desc" },
      },
    },
  });

  if (!fund) return { error: "Donor fund not found" };

  // Resolve student and user names for allocations
  const studentIds = [...new Set(fund.allocations.map((a) => a.studentId))];
  const userIds = [...new Set(fund.allocations.map((a) => a.allocatedBy))];

  const [students, users] = await Promise.all([
    db.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, studentId: true, firstName: true, lastName: true },
    }),
    db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const studentMap = new Map(students.map((s) => [s.id, s]));
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  return {
    data: {
      ...fund,
      allocations: fund.allocations.map((a) => {
        const student = studentMap.get(a.studentId);
        return {
          ...a,
          studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown",
          studentIdNumber: student?.studentId ?? "Unknown",
          allocatedByName: userMap.get(a.allocatedBy) ?? "Unknown",
        };
      }),
    },
  };
}

export async function createDonorFundAction(data: CreateDonorFundInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DONOR_FUNDS_CREATE);
  if (denied) return denied;

  const parsed = createDonorFundSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const fund = await db.donorFund.create({
    data: {
      schoolId: ctx.schoolId,
      donorName: parsed.data.donorName,
      donorType: parsed.data.donorType,
      contactEmail: parsed.data.contactEmail || null,
      contactPhone: parsed.data.contactPhone,
      totalPledged: parsed.data.totalPledged,
      purpose: parsed.data.purpose,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "DonorFund",
    entityId: fund.id,
    module: "finance",
    description: `Created donor fund from "${parsed.data.donorName}" (pledged: GHS ${parsed.data.totalPledged})`,
  });

  return { data: fund };
}

export async function updateDonorFundAction(fundId: string, data: UpdateDonorFundInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DONOR_FUNDS_UPDATE);
  if (denied) return denied;

  const parsed = updateDonorFundSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const fund = await db.donorFund.findUnique({ where: { id: fundId } });
  if (!fund) return { error: "Donor fund not found" };

  const updated = await db.donorFund.update({
    where: { id: fundId },
    data: parsed.data,
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "DonorFund",
    entityId: fundId,
    module: "finance",
    description: `Updated donor fund "${updated.donorName}"`,
  });

  return { data: updated };
}

export async function allocateDonorFundAction(data: AllocateDonorFundInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DONOR_FUNDS_ALLOCATE);
  if (denied) return denied;

  const parsed = allocateDonorFundSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const fund = await db.donorFund.findUnique({ where: { id: parsed.data.donorFundId } });
  if (!fund) return { error: "Donor fund not found" };
  if (!fund.isActive) return { error: "Donor fund is inactive" };

  const availableBalance = toNum(fund.totalReceived) - toNum(fund.totalDisbursed);
  if (parsed.data.amount > availableBalance) {
    return { error: `Insufficient fund balance. Available: GHS ${availableBalance.toFixed(2)}` };
  }

  // Verify student exists
  const student = await db.student.findUnique({
    where: { id: parsed.data.studentId },
    select: { id: true, firstName: true, lastName: true, studentId: true },
  });
  if (!student) return { error: "Student not found" };

  await db.$transaction(async (tx) => {
    await tx.donorFundAllocation.create({
      data: {
        schoolId: ctx.schoolId,
        donorFundId: fund.id,
        studentId: parsed.data.studentId,
        termId: parsed.data.termId,
        amount: parsed.data.amount,
        description: parsed.data.description,
        allocatedBy: ctx.session.user.id,
      },
    });

    await tx.donorFund.update({
      where: { id: fund.id },
      data: {
        totalDisbursed: { increment: parsed.data.amount },
      },
    });
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "DonorFundAllocation",
    entityId: fund.id,
    module: "finance",
    description: `Allocated GHS ${parsed.data.amount} from "${fund.donorName}" to ${student.firstName} ${student.lastName} (${student.studentId})`,
  });

  return { data: { success: true } };
}

export async function deleteDonorFundAction(fundId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DONOR_FUNDS_UPDATE);
  if (denied) return denied;

  const fund = await db.donorFund.findUnique({
    where: { id: fundId },
    include: { _count: { select: { allocations: true } } },
  });
  if (!fund) return { error: "Donor fund not found" };

  if (fund._count.allocations > 0) {
    return { error: "Cannot delete a fund that has allocations. Deactivate it instead." };
  }

  await db.donorFund.delete({ where: { id: fundId } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "DonorFund",
    entityId: fundId,
    module: "finance",
    description: `Deleted donor fund "${fund.donorName}"`,
  });

  return { data: { success: true } };
}
