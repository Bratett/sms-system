"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  requestFeeWaiverSchema,
  type RequestFeeWaiverInput,
} from "@/modules/finance/schemas/fee-waiver.schema";

export async function getWaiversAction(filters?: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: school.id };
  if (filters?.status) where.status = filters.status;

  const [waivers, total] = await Promise.all([
    db.feeWaiver.findMany({
      where,
      include: {
        studentBill: {
          select: {
            id: true,
            studentId: true,
            totalAmount: true,
            balanceAmount: true,
          },
        },
      },
      orderBy: { requestedAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.feeWaiver.count({ where }),
  ]);

  // Fetch student and user info
  const studentIds = [...new Set(waivers.map((w) => w.studentBill.studentId))];
  const userIds = [
    ...new Set([
      ...waivers.map((w) => w.requestedBy),
      ...waivers.map((w) => w.approvedBy).filter(Boolean) as string[],
    ]),
  ];

  const [students, users] = await Promise.all([
    db.student.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        enrollments: {
          where: { status: "ACTIVE" },
          include: { classArm: { include: { class: { select: { name: true } } } } },
          take: 1,
        },
      },
    }),
    db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const studentMap = new Map(students.map((s) => [s.id, s]));
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = waivers.map((waiver) => {
    const student = studentMap.get(waiver.studentBill.studentId);
    const enrollment = student?.enrollments[0];
    return {
      ...waiver,
      studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown",
      studentIdNumber: student?.studentId ?? "Unknown",
      className: enrollment
        ? `${enrollment.classArm.class.name} ${enrollment.classArm.name}`
        : "N/A",
      requestedByName: userMap.get(waiver.requestedBy) ?? "Unknown",
      approvedByName: waiver.approvedBy ? userMap.get(waiver.approvedBy) ?? null : null,
    };
  });

  return {
    data,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function requestFeeWaiverAction(data: RequestFeeWaiverInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = requestFeeWaiverSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const bill = await db.studentBill.findUnique({
    where: { id: parsed.data.studentBillId },
    include: { billItems: true },
  });
  if (!bill) return { error: "Student bill not found" };
  if (bill.status === "PAID" || bill.status === "OVERPAID" || bill.status === "WAIVED") {
    return { error: "Cannot create a waiver for a bill that is already paid or waived" };
  }

  // Calculate the actual waiver amount
  let calculatedAmount = 0;
  const baseAmount = parsed.data.studentBillItemId
    ? bill.billItems.find((i) => i.id === parsed.data.studentBillItemId)?.amount ?? 0
    : bill.totalAmount;

  switch (parsed.data.waiverType) {
    case "PERCENTAGE":
    case "STAFF_CHILD_DISCOUNT":
    case "SIBLING_DISCOUNT":
      calculatedAmount = baseAmount * (parsed.data.value / 100);
      break;
    case "FIXED_AMOUNT":
      calculatedAmount = Math.min(parsed.data.value, baseAmount);
      break;
    case "FULL_WAIVER":
      calculatedAmount = bill.balanceAmount;
      break;
  }

  calculatedAmount = Math.round(calculatedAmount * 100) / 100;

  const waiver = await db.feeWaiver.create({
    data: {
      schoolId: school.id,
      studentBillId: bill.id,
      studentBillItemId: parsed.data.studentBillItemId,
      requestedBy: session.user.id!,
      reason: parsed.data.reason,
      waiverType: parsed.data.waiverType,
      value: parsed.data.value,
      calculatedAmount,
      notes: parsed.data.notes,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "FeeWaiver",
    entityId: waiver.id,
    module: "finance",
    description: `Requested fee waiver of GHS ${calculatedAmount.toFixed(2)} (${parsed.data.waiverType})`,
  });

  return { data: waiver };
}

export async function approveFeeWaiverAction(waiverId: string, notes?: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const waiver = await db.feeWaiver.findUnique({
    where: { id: waiverId },
    include: { studentBill: true },
  });
  if (!waiver) return { error: "Fee waiver not found" };
  if (waiver.status !== "PENDING") return { error: "Only pending waivers can be approved" };

  await db.$transaction(async (tx) => {
    // Update waiver status
    await tx.feeWaiver.update({
      where: { id: waiverId },
      data: {
        status: "APPROVED",
        approvedBy: session.user.id!,
        reviewedAt: new Date(),
        notes: notes ?? waiver.notes,
      },
    });

    // Apply waiver to bill
    const newTotal = Math.max(0, waiver.studentBill.totalAmount - waiver.calculatedAmount);
    const newBalance = Math.max(0, waiver.studentBill.balanceAmount - waiver.calculatedAmount);

    let newStatus = waiver.studentBill.status;
    if (newBalance === 0 && newTotal === 0) {
      newStatus = "WAIVED";
    } else if (newBalance === 0) {
      newStatus = "PAID";
    }

    await tx.studentBill.update({
      where: { id: waiver.studentBillId },
      data: {
        totalAmount: newTotal,
        balanceAmount: newBalance,
        status: newStatus,
      },
    });

    // If targeting a specific bill item, update its waived amount
    if (waiver.studentBillItemId) {
      await tx.studentBillItem.update({
        where: { id: waiver.studentBillItemId },
        data: {
          waivedAmount: { increment: waiver.calculatedAmount },
        },
      });
    }
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "FeeWaiver",
    entityId: waiverId,
    module: "finance",
    description: `Approved fee waiver of GHS ${waiver.calculatedAmount.toFixed(2)}`,
  });

  return { data: { success: true } };
}

export async function rejectFeeWaiverAction(waiverId: string, notes?: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const waiver = await db.feeWaiver.findUnique({ where: { id: waiverId } });
  if (!waiver) return { error: "Fee waiver not found" };
  if (waiver.status !== "PENDING") return { error: "Only pending waivers can be rejected" };

  await db.feeWaiver.update({
    where: { id: waiverId },
    data: {
      status: "REJECTED",
      approvedBy: session.user.id!,
      reviewedAt: new Date(),
      notes: notes ?? waiver.notes,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "FeeWaiver",
    entityId: waiverId,
    module: "finance",
    description: `Rejected fee waiver request`,
  });

  return { data: { success: true } };
}
