"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

export async function getScholarshipsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FINANCIAL_AID_READ);
  if (denied) return denied;

  const scholarships = await db.scholarship.findMany({
    where: { schoolId: ctx.schoolId },
    include: {
      studentScholarships: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = scholarships.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    value: s.value,
    criteria: s.criteria,
    academicYearId: s.academicYearId,
    status: s.status,
    studentsCount: s.studentScholarships.length,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));

  return { data };
}

export async function createScholarshipAction(data: {
  name: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  criteria?: string;
  academicYearId?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FINANCIAL_AID_CREATE);
  if (denied) return denied;

  if (!data.name || data.name.trim() === "") {
    return { error: "Scholarship name is required" };
  }

  if (data.value <= 0) {
    return { error: "Value must be greater than 0" };
  }

  if (data.type === "PERCENTAGE" && data.value > 100) {
    return { error: "Percentage value cannot exceed 100" };
  }

  const scholarship = await db.scholarship.create({
    data: {
      schoolId: ctx.schoolId,
      name: data.name.trim(),
      type: data.type,
      value: data.value,
      criteria: data.criteria?.trim() || null,
      academicYearId: data.academicYearId || null,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "Scholarship",
    entityId: scholarship.id,
    module: "finance",
    description: `Created scholarship "${scholarship.name}" (${scholarship.type}: ${scholarship.value})`,
    newData: scholarship,
  });

  return { data: scholarship };
}

export async function updateScholarshipAction(
  id: string,
  data: {
    name?: string;
    type?: "PERCENTAGE" | "FIXED_AMOUNT";
    value?: number;
    criteria?: string;
    academicYearId?: string;
    status?: "ACTIVE" | "INACTIVE";
  }
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FINANCIAL_AID_REVIEW);
  if (denied) return denied;

  const existing = await db.scholarship.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Scholarship not found" };
  }

  if (data.name !== undefined && data.name.trim() === "") {
    return { error: "Scholarship name is required" };
  }

  if (data.value !== undefined && data.value <= 0) {
    return { error: "Value must be greater than 0" };
  }

  const newType = data.type ?? existing.type;
  const newValue = data.value ?? toNum(existing.value);
  if (newType === "PERCENTAGE" && newValue > 100) {
    return { error: "Percentage value cannot exceed 100" };
  }

  const previousData = { ...existing };

  const updated = await db.scholarship.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.value !== undefined && { value: data.value }),
      ...(data.criteria !== undefined && { criteria: data.criteria.trim() || null }),
      ...(data.academicYearId !== undefined && { academicYearId: data.academicYearId || null }),
      ...(data.status !== undefined && { status: data.status }),
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "Scholarship",
    entityId: id,
    module: "finance",
    description: `Updated scholarship "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteScholarshipAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FINANCIAL_AID_REVIEW);
  if (denied) return denied;

  const existing = await db.scholarship.findUnique({
    where: { id },
    include: { studentScholarships: { select: { id: true } } },
  });

  if (!existing) {
    return { error: "Scholarship not found" };
  }

  if (existing.studentScholarships.length > 0) {
    return {
      error: `Cannot delete scholarship "${existing.name}" because it is assigned to ${existing.studentScholarships.length} student(s). Remove all student assignments first.`,
    };
  }

  await db.scholarship.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "Scholarship",
    entityId: id,
    module: "finance",
    description: `Deleted scholarship "${existing.name}"`,
    previousData: existing,
  });

  return { success: true };
}

export async function applyScholarshipAction(
  studentId: string,
  scholarshipId: string,
  termId: string
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FINANCIAL_AID_CREATE);
  if (denied) return denied;

  const scholarship = await db.scholarship.findUnique({
    where: { id: scholarshipId },
  });
  if (!scholarship) {
    return { error: "Scholarship not found" };
  }

  // Check if already applied for this term
  const existing = await db.studentScholarship.findUnique({
    where: {
      studentId_scholarshipId_termId: {
        studentId,
        scholarshipId,
        termId,
      },
    },
  });
  if (existing) {
    return { error: "This scholarship is already applied to this student for this term" };
  }

  // Get student bill for this term to calculate applied amount
  const studentBill = await db.studentBill.findFirst({
    where: { studentId, termId },
  });

  let appliedAmount: number;
  if (scholarship.type === "PERCENTAGE") {
    const billTotal = toNum(studentBill?.totalAmount);
    appliedAmount = (toNum(scholarship.value) / 100) * billTotal;
  } else {
    appliedAmount = toNum(scholarship.value);
  }

  const studentScholarship = await db.studentScholarship.create({
    data: {
      schoolId: ctx.schoolId,
      studentId,
      scholarshipId,
      termId,
      appliedAmount,
    },
  });

  // Get student info for audit
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { firstName: true, lastName: true, studentId: true },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "StudentScholarship",
    entityId: studentScholarship.id,
    module: "finance",
    description: `Applied scholarship "${scholarship.name}" to student ${student?.studentId ?? studentId} (amount: ${appliedAmount})`,
    newData: studentScholarship,
  });

  return { data: studentScholarship };
}

export async function removeStudentScholarshipAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FINANCIAL_AID_CREATE);
  if (denied) return denied;

  const existing = await db.studentScholarship.findUnique({
    where: { id },
    include: {
      scholarship: { select: { name: true } },
    },
  });

  if (!existing) {
    return { error: "Student scholarship not found" };
  }

  await db.studentScholarship.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "StudentScholarship",
    entityId: id,
    module: "finance",
    description: `Removed scholarship "${existing.scholarship.name}" from student ${existing.studentId}`,
    previousData: existing,
  });

  return { success: true };
}

export async function getStudentScholarshipsAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FINANCIAL_AID_READ);
  if (denied) return denied;

  const studentScholarships = await db.studentScholarship.findMany({
    where: { studentId },
    include: {
      scholarship: {
        select: {
          id: true,
          name: true,
          type: true,
          value: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return { data: studentScholarships };
}
