"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { audit } from "@/lib/audit";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { requestTransferSchema } from "../schemas";

// ─── Transfers ─────────────────────────────────────────────────────

export async function getTransfersAction(filters?: {
  status?: string;
  studentId?: string;
  hostelId?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.BED_TRANSFERS_READ);
  if (permErr) return permErr;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.studentId) where.studentId = filters.studentId;

  const [transfers, total] = await Promise.all([
    db.bedTransfer.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.bedTransfer.count({ where }),
  ]);

  if (transfers.length === 0) {
    return { data: [], total, page, pageSize };
  }

  // Collect all unique IDs for batch resolution
  const bedIds = new Set<string>();
  const studentIds = new Set<string>();
  const userIds = new Set<string>();

  for (const t of transfers) {
    bedIds.add(t.fromBedId);
    bedIds.add(t.toBedId);
    studentIds.add(t.studentId);
    userIds.add(t.requestedBy);
    if (t.approvedBy) userIds.add(t.approvedBy);
  }

  // Batch fetch beds with dormitory -> hostel
  const beds = await db.bed.findMany({
    where: { id: { in: Array.from(bedIds) } },
    include: {
      dormitory: {
        include: { hostel: true },
      },
    },
  });
  const bedMap = new Map(beds.map((b) => [b.id, b]));

  // Batch fetch students
  const students = await db.student.findMany({
    where: { id: { in: Array.from(studentIds) } },
    select: { id: true, firstName: true, lastName: true, studentId: true },
  });
  const studentMap = new Map(
    students.map((s) => [
      s.id,
      { name: `${s.firstName} ${s.lastName}`, studentNumber: s.studentId },
    ]),
  );

  // Batch fetch users (requestedBy / approvedBy)
  const users = await db.user.findMany({
    where: { id: { in: Array.from(userIds) } },
    select: { id: true, firstName: true, lastName: true },
  });
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  // Filter by hostelId if provided (from either bed)
  let filtered = transfers;
  if (filters?.hostelId) {
    filtered = transfers.filter((t) => {
      const fromBed = bedMap.get(t.fromBedId);
      const toBed = bedMap.get(t.toBedId);
      return (
        fromBed?.dormitory.hostel.id === filters.hostelId ||
        toBed?.dormitory.hostel.id === filters.hostelId
      );
    });
  }

  const data = filtered.map((t) => {
    const fromBed = bedMap.get(t.fromBedId);
    const toBed = bedMap.get(t.toBedId);
    const student = studentMap.get(t.studentId);

    return {
      id: t.id,
      transferNumber: t.transferNumber,
      studentId: t.studentId,
      studentName: student?.name ?? "Unknown",
      studentNumber: student?.studentNumber ?? "",
      fromBedId: t.fromBedId,
      fromBedNumber: fromBed?.bedNumber ?? "",
      fromDormitoryName: fromBed?.dormitory.name ?? "",
      fromHostelName: fromBed?.dormitory.hostel.name ?? "",
      toBedId: t.toBedId,
      toBedNumber: toBed?.bedNumber ?? "",
      toDormitoryName: toBed?.dormitory.name ?? "",
      toHostelName: toBed?.dormitory.hostel.name ?? "",
      reason: t.reason,
      reasonDetails: t.reasonDetails,
      status: t.status,
      requestedBy: userMap.get(t.requestedBy) ?? "Unknown",
      requestedAt: t.requestedAt,
      approvedBy: t.approvedBy ? (userMap.get(t.approvedBy) ?? "Unknown") : null,
      approvedAt: t.approvedAt,
      effectiveDate: t.effectiveDate,
      completedAt: t.completedAt,
      rejectionReason: t.rejectionReason,
    };
  });

  return { data, total, page, pageSize };
}

export async function requestTransferAction(
  data: {
    studentId: string;
    fromBedId: string;
    toBedId: string;
    reason: string;
    reasonDetails?: string;
    effectiveDate?: string;
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.BED_TRANSFERS_CREATE);
  if (permErr) return permErr;

  const parsed = requestTransferSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e: { message: string }) => e.message).join(", ") };
  }

  // Validate fromBed exists
  const fromBed = await db.bed.findUnique({
    where: { id: parsed.data.fromBedId },
    include: { dormitory: { include: { hostel: true } } },
  });
  if (!fromBed) {
    return { error: "Source bed not found." };
  }

  // Validate toBed exists and is available
  const toBed = await db.bed.findUnique({
    where: { id: parsed.data.toBedId },
    include: { dormitory: { include: { hostel: true } } },
  });
  if (!toBed) {
    return { error: "Destination bed not found." };
  }
  if (toBed.status !== "AVAILABLE") {
    return { error: "Destination bed is not available." };
  }

  // Auto-generate transfer number: BTR/YYYY/NNNN
  const year = new Date().getFullYear();
  const prefix = `BTR/${year}/`;
  const lastTransfer = await db.bedTransfer.findFirst({
    where: { transferNumber: { startsWith: prefix } },
    orderBy: { transferNumber: "desc" },
    select: { transferNumber: true },
  });

  let nextSeq = 1;
  if (lastTransfer) {
    const lastSeq = parseInt(lastTransfer.transferNumber.split("/")[2], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }
  const transferNumber = `${prefix}${String(nextSeq).padStart(4, "0")}`;

  const transfer = await db.bedTransfer.create({
    data: {
      schoolId: ctx.schoolId,
      transferNumber,
      studentId: parsed.data.studentId,
      fromBedId: parsed.data.fromBedId,
      toBedId: parsed.data.toBedId,
      reason: parsed.data.reason as never,
      reasonDetails: parsed.data.reasonDetails ?? null,
      effectiveDate: parsed.data.effectiveDate
        ? new Date(parsed.data.effectiveDate)
        : null,
      requestedBy: ctx.session.user.id,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "BedTransfer",
    entityId: transfer.id,
    module: "boarding",
    description: `Requested bed transfer ${transferNumber} from ${fromBed.dormitory.hostel.name}/${fromBed.dormitory.name}/${fromBed.bedNumber} to ${toBed.dormitory.hostel.name}/${toBed.dormitory.name}/${toBed.bedNumber}`,
    newData: transfer,
  });

  return { data: transfer };
}

export async function approveTransferAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.BED_TRANSFERS_APPROVE);
  if (permErr) return permErr;

  const transfer = await db.bedTransfer.findUnique({ where: { id } });
  if (!transfer) {
    return { error: "Transfer not found." };
  }
  if (transfer.status !== "PENDING") {
    return { error: `Cannot approve a transfer with status ${transfer.status}.` };
  }

  const updated = await db.bedTransfer.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedBy: ctx.session.user.id,
      approvedAt: new Date(),
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "BedTransfer",
    entityId: id,
    module: "boarding",
    description: `Approved bed transfer ${transfer.transferNumber}`,
    previousData: transfer,
    newData: updated,
  });

  return { data: updated };
}

export async function executeTransferAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.BED_TRANSFERS_APPROVE);
  if (permErr) return permErr;

  const transfer = await db.bedTransfer.findUnique({ where: { id } });
  if (!transfer) {
    return { error: "Transfer not found." };
  }
  if (transfer.status !== "APPROVED") {
    return { error: `Cannot execute a transfer with status ${transfer.status}.` };
  }

  // Find the active allocation for the student on the fromBed
  const currentAllocation = await db.bedAllocation.findFirst({
    where: {
      studentId: transfer.studentId,
      bedId: transfer.fromBedId,
      status: "ACTIVE",
    },
  });

  if (!currentAllocation) {
    return { error: "No active bed allocation found for the student on the source bed." };
  }

  const result = await db.$transaction(async (tx) => {
    // 1. Vacate old bed allocation
    await tx.bedAllocation.update({
      where: { id: currentAllocation.id },
      data: {
        status: "VACATED",
        vacatedAt: new Date(),
      },
    });

    // 2. Set old bed to AVAILABLE
    await tx.bed.update({
      where: { id: transfer.fromBedId },
      data: { status: "AVAILABLE" },
    });

    // 3. Create new allocation for the toBed
    const newAllocation = await tx.bedAllocation.create({
      data: {
        schoolId: ctx.schoolId,
        bedId: transfer.toBedId,
        studentId: transfer.studentId,
        termId: currentAllocation.termId,
        academicYearId: currentAllocation.academicYearId,
        allocatedBy: ctx.session.user.id,
      },
    });

    // 4. Set toBed to OCCUPIED
    await tx.bed.update({
      where: { id: transfer.toBedId },
      data: { status: "OCCUPIED" },
    });

    // 5. Update transfer status to COMPLETED
    const updatedTransfer = await tx.bedTransfer.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    return { transfer: updatedTransfer, allocation: newAllocation };
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "BedTransfer",
    entityId: id,
    module: "boarding",
    description: `Executed bed transfer ${transfer.transferNumber} — student moved from bed ${transfer.fromBedId} to ${transfer.toBedId}`,
    previousData: transfer,
    newData: result.transfer,
  });

  return { data: result.transfer };
}

export async function rejectTransferAction(id: string, reason: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.BED_TRANSFERS_APPROVE);
  if (permErr) return permErr;

  const transfer = await db.bedTransfer.findUnique({ where: { id } });
  if (!transfer) {
    return { error: "Transfer not found." };
  }
  if (transfer.status !== "PENDING") {
    return { error: `Cannot reject a transfer with status ${transfer.status}.` };
  }

  const updated = await db.bedTransfer.update({
    where: { id },
    data: {
      status: "REJECTED",
      rejectionReason: reason,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "BedTransfer",
    entityId: id,
    module: "boarding",
    description: `Rejected bed transfer ${transfer.transferNumber}: ${reason}`,
    previousData: transfer,
    newData: updated,
  });

  return { data: updated };
}

export async function getStudentTransferHistoryAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.BED_TRANSFERS_READ);
  if (permErr) return permErr;

  const transfers = await db.bedTransfer.findMany({
    where: { studentId },
    orderBy: { requestedAt: "desc" },
  });

  if (transfers.length === 0) {
    return { data: [] };
  }

  // Collect bed IDs for batch resolution
  const bedIds = new Set<string>();
  for (const t of transfers) {
    bedIds.add(t.fromBedId);
    bedIds.add(t.toBedId);
  }

  const beds = await db.bed.findMany({
    where: { id: { in: Array.from(bedIds) } },
    include: {
      dormitory: {
        include: { hostel: true },
      },
    },
  });
  const bedMap = new Map(beds.map((b) => [b.id, b]));

  const data = transfers.map((t) => {
    const fromBed = bedMap.get(t.fromBedId);
    const toBed = bedMap.get(t.toBedId);

    return {
      id: t.id,
      transferNumber: t.transferNumber,
      fromBedNumber: fromBed?.bedNumber ?? "",
      fromDormitoryName: fromBed?.dormitory.name ?? "",
      fromHostelName: fromBed?.dormitory.hostel.name ?? "",
      toBedNumber: toBed?.bedNumber ?? "",
      toDormitoryName: toBed?.dormitory.name ?? "",
      toHostelName: toBed?.dormitory.hostel.name ?? "",
      reason: t.reason,
      reasonDetails: t.reasonDetails,
      status: t.status,
      requestedAt: t.requestedAt,
      approvedAt: t.approvedAt,
      completedAt: t.completedAt,
      rejectionReason: t.rejectionReason,
    };
  });

  return { data };
}
