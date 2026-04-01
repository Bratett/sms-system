"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import {
  createInstallmentPlanSchema,
  applyInstallmentPlanSchema,
  type CreateInstallmentPlanInput,
  type ApplyInstallmentPlanInput,
} from "@/modules/finance/schemas/installment.schema";

export async function getInstallmentPlansAction(filters?: { feeStructureId?: string; isActive?: boolean }) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const where: Record<string, unknown> = { schoolId: school.id };
  if (filters?.feeStructureId) where.feeStructureId = filters.feeStructureId;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;

  const plans = await db.installmentPlan.findMany({
    where,
    include: {
      schedules: { orderBy: { installmentNumber: "asc" } },
      _count: { select: { studentInstallments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch fee structure names
  const fsIds = plans.map((p) => p.feeStructureId).filter(Boolean) as string[];
  const feeStructures =
    fsIds.length > 0
      ? await db.feeStructure.findMany({
          where: { id: { in: fsIds } },
          select: { id: true, name: true },
        })
      : [];
  const fsMap = new Map(feeStructures.map((fs) => [fs.id, fs.name]));

  const data = plans.map((plan) => ({
    ...plan,
    feeStructureName: plan.feeStructureId ? fsMap.get(plan.feeStructureId) ?? null : null,
    studentCount: plan._count.studentInstallments,
  }));

  return { data };
}

export async function createInstallmentPlanAction(data: CreateInstallmentPlanInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = createInstallmentPlanSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const plan = await db.$transaction(async (tx) => {
    const created = await tx.installmentPlan.create({
      data: {
        schoolId: school.id,
        name: parsed.data.name,
        feeStructureId: parsed.data.feeStructureId,
        numberOfInstallments: parsed.data.numberOfInstallments,
      },
    });

    await tx.installmentSchedule.createMany({
      data: parsed.data.schedules.map((s) => ({
        installmentPlanId: created.id,
        installmentNumber: s.installmentNumber,
        percentageOfTotal: s.percentageOfTotal,
        dueDaysFromStart: s.dueDaysFromStart,
        label: s.label,
      })),
    });

    return created;
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "InstallmentPlan",
    entityId: plan.id,
    module: "finance",
    description: `Created installment plan "${parsed.data.name}" with ${parsed.data.numberOfInstallments} installments`,
  });

  return { data: plan };
}

export async function updateInstallmentPlanAction(planId: string, data: { name?: string; isActive?: boolean }) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const plan = await db.installmentPlan.findUnique({ where: { id: planId } });
  if (!plan) return { error: "Installment plan not found" };

  const updated = await db.installmentPlan.update({
    where: { id: planId },
    data,
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "InstallmentPlan",
    entityId: planId,
    module: "finance",
    description: `Updated installment plan "${updated.name}"`,
  });

  return { data: updated };
}

export async function deleteInstallmentPlanAction(planId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const plan = await db.installmentPlan.findUnique({
    where: { id: planId },
    include: { _count: { select: { studentInstallments: true } } },
  });
  if (!plan) return { error: "Installment plan not found" };

  if (plan._count.studentInstallments > 0) {
    return { error: "Cannot delete a plan that has been applied to student bills" };
  }

  await db.installmentPlan.delete({ where: { id: planId } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "InstallmentPlan",
    entityId: planId,
    module: "finance",
    description: `Deleted installment plan "${plan.name}"`,
  });

  return { data: { success: true } };
}

export async function applyInstallmentPlanToBillAction(data: ApplyInstallmentPlanInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = applyInstallmentPlanSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const [bill, plan] = await Promise.all([
    db.studentBill.findUnique({ where: { id: parsed.data.studentBillId } }),
    db.installmentPlan.findUnique({
      where: { id: parsed.data.installmentPlanId },
      include: { schedules: { orderBy: { installmentNumber: "asc" } } },
    }),
  ]);

  if (!bill) return { error: "Student bill not found" };
  if (!plan) return { error: "Installment plan not found" };
  if (!plan.isActive) return { error: "Installment plan is not active" };
  if (bill.status === "PAID" || bill.status === "OVERPAID") {
    return { error: "Bill is already fully paid" };
  }

  // Check if installments already exist for this bill
  const existingInstallments = await db.studentInstallment.findFirst({
    where: { studentBillId: bill.id },
  });
  if (existingInstallments) {
    return { error: "Installments have already been created for this bill. Remove existing installments first." };
  }

  const termStartDate = new Date(parsed.data.termStartDate);
  const outstandingAmount = toNum(bill.balanceAmount);

  const installments = await db.$transaction(async (tx) => {
    const created = [];
    for (const schedule of plan.schedules) {
      const amount = Math.round((outstandingAmount * toNum(schedule.percentageOfTotal)) / 100 * 100) / 100;
      const dueDate = new Date(termStartDate);
      dueDate.setDate(dueDate.getDate() + schedule.dueDaysFromStart);

      const installment = await tx.studentInstallment.create({
        data: {
          studentBillId: bill.id,
          installmentPlanId: plan.id,
          installmentNumber: schedule.installmentNumber,
          amount,
          dueDate,
          status: "PENDING",
        },
      });
      created.push(installment);
    }
    return created;
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "StudentInstallment",
    entityId: bill.id,
    module: "finance",
    description: `Applied installment plan "${plan.name}" to bill (${plan.schedules.length} installments)`,
  });

  return { data: installments };
}

export async function getStudentInstallmentsAction(studentBillId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const installments = await db.studentInstallment.findMany({
    where: { studentBillId },
    include: {
      installmentPlan: {
        include: {
          schedules: { orderBy: { installmentNumber: "asc" } },
        },
      },
    },
    orderBy: { installmentNumber: "asc" },
  });

  const data = installments.map((inst) => {
    const schedule = inst.installmentPlan.schedules.find(
      (s) => s.installmentNumber === inst.installmentNumber
    );
    return {
      ...inst,
      label: schedule?.label ?? `Installment ${inst.installmentNumber}`,
    };
  });

  return { data };
}

export async function removeStudentInstallmentsAction(studentBillId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  // Check for any paid installments
  const paidInstallments = await db.studentInstallment.findFirst({
    where: { studentBillId, paidAmount: { gt: 0 } },
  });

  if (paidInstallments) {
    return { error: "Cannot remove installments that have partial or full payments" };
  }

  const deleted = await db.studentInstallment.deleteMany({ where: { studentBillId } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "StudentInstallment",
    entityId: studentBillId,
    module: "finance",
    description: `Removed ${deleted.count} installments from bill`,
  });

  return { data: { removed: deleted.count } };
}
