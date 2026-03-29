"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Transfer Student ──────────────────────────────────────────────

export async function transferStudentAction(data: {
  studentId: string;
  transferDate: string;
  destinationSchool: string;
  reason?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const student = await db.student.findUnique({ where: { id: data.studentId } });
  if (!student) return { error: "Student not found" };
  if (student.status !== "ACTIVE") return { error: "Only active students can be transferred" };

  const updated = await db.$transaction(async (tx) => {
    // Update student status
    const updatedStudent = await tx.student.update({
      where: { id: data.studentId },
      data: { status: "TRANSFERRED" },
    });

    // End current enrollment
    await tx.enrollment.updateMany({
      where: { studentId: data.studentId, status: "ACTIVE" },
      data: { status: "TRANSFERRED" },
    });

    // Vacate bed allocation if boarding
    await tx.bedAllocation.updateMany({
      where: { studentId: data.studentId, vacatedAt: null },
      data: { vacatedAt: new Date(data.transferDate) },
    });

    return updatedStudent;
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Student",
    entityId: data.studentId,
    module: "students",
    description: `Transferred student ${student.studentId} to ${data.destinationSchool}`,
    previousData: { status: student.status },
    newData: { status: "TRANSFERRED" },
    metadata: {
      destinationSchool: data.destinationSchool,
      reason: data.reason,
      transferDate: data.transferDate,
    },
  });

  return { data: updated };
}

// ─── Withdraw Student ──────────────────────────────────────────────

export async function withdrawStudentAction(data: {
  studentId: string;
  withdrawalDate: string;
  reason: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const student = await db.student.findUnique({ where: { id: data.studentId } });
  if (!student) return { error: "Student not found" };
  if (student.status !== "ACTIVE" && student.status !== "SUSPENDED") {
    return { error: "Student cannot be withdrawn from current status" };
  }

  const updated = await db.$transaction(async (tx) => {
    const updatedStudent = await tx.student.update({
      where: { id: data.studentId },
      data: { status: "WITHDRAWN" },
    });

    await tx.enrollment.updateMany({
      where: { studentId: data.studentId, status: "ACTIVE" },
      data: { status: "WITHDRAWN" },
    });

    await tx.bedAllocation.updateMany({
      where: { studentId: data.studentId, vacatedAt: null },
      data: { vacatedAt: new Date(data.withdrawalDate) },
    });

    return updatedStudent;
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Student",
    entityId: data.studentId,
    module: "students",
    description: `Withdrew student ${student.studentId}: ${data.reason}`,
    previousData: { status: student.status },
    newData: { status: "WITHDRAWN" },
    metadata: { reason: data.reason, withdrawalDate: data.withdrawalDate },
  });

  return { data: updated };
}

// ─── Suspend Student ───────────────────────────────────────────────

export async function suspendStudentAction(data: {
  studentId: string;
  reason: string;
  startDate: string;
  endDate?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const student = await db.student.findUnique({ where: { id: data.studentId } });
  if (!student) return { error: "Student not found" };
  if (student.status !== "ACTIVE") return { error: "Only active students can be suspended" };

  const updated = await db.student.update({
    where: { id: data.studentId },
    data: { status: "SUSPENDED" },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Student",
    entityId: data.studentId,
    module: "students",
    description: `Suspended student ${student.studentId}: ${data.reason}`,
    previousData: { status: student.status },
    newData: { status: "SUSPENDED" },
    metadata: {
      reason: data.reason,
      startDate: data.startDate,
      endDate: data.endDate,
    },
  });

  return { data: updated };
}

// ─── Reinstate Student ─────────────────────────────────────────────

export async function reinstateStudentAction(data: {
  studentId: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const student = await db.student.findUnique({ where: { id: data.studentId } });
  if (!student) return { error: "Student not found" };
  if (student.status !== "SUSPENDED") return { error: "Only suspended students can be reinstated" };

  const updated = await db.student.update({
    where: { id: data.studentId },
    data: { status: "ACTIVE" },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Student",
    entityId: data.studentId,
    module: "students",
    description: `Reinstated student ${student.studentId}`,
    previousData: { status: "SUSPENDED" },
    newData: { status: "ACTIVE" },
  });

  return { data: updated };
}
