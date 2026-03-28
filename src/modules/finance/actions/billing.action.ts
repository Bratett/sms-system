"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  generateBillsSchema,
  type GenerateBillsInput,
} from "@/modules/finance/schemas/billing.schema";

export async function generateBillsAction(data: GenerateBillsInput) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const parsed = generateBillsSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const feeStructure = await db.feeStructure.findUnique({
    where: { id: parsed.data.feeStructureId },
    include: { feeItems: true },
  });

  if (!feeStructure) {
    return { error: "Fee structure not found" };
  }

  if (feeStructure.status !== "ACTIVE") {
    return { error: "Fee structure must be ACTIVE to generate bills" };
  }

  // Build student filter based on fee structure criteria
  const studentWhere: Record<string, unknown> = {
    schoolId: feeStructure.schoolId,
    status: "ACTIVE",
  };

  if (feeStructure.boardingStatus) {
    studentWhere.boardingStatus = feeStructure.boardingStatus;
  }

  // If classArmId is provided, only get students enrolled in that class arm
  let studentIds: string[] | null = null;
  if (parsed.data.classArmId) {
    const enrollments = await db.enrollment.findMany({
      where: {
        classArmId: parsed.data.classArmId,
        academicYearId: feeStructure.academicYearId,
        status: "ACTIVE",
      },
      select: { studentId: true },
    });
    studentIds = enrollments.map((e) => e.studentId);
  } else if (feeStructure.programmeId) {
    // Filter by programme via class -> classArm -> enrollment
    const classArms = await db.classArm.findMany({
      where: {
        class: {
          programmeId: feeStructure.programmeId,
          academicYearId: feeStructure.academicYearId,
        },
      },
      select: { id: true },
    });
    const classArmIds = classArms.map((ca) => ca.id);
    const enrollments = await db.enrollment.findMany({
      where: {
        classArmId: { in: classArmIds },
        academicYearId: feeStructure.academicYearId,
        status: "ACTIVE",
      },
      select: { studentId: true },
    });
    studentIds = enrollments.map((e) => e.studentId);
  }

  if (studentIds !== null) {
    studentWhere.id = { in: studentIds };
  }

  const students = await db.student.findMany({
    where: studentWhere,
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });

  // Calculate total for non-optional items
  const nonOptionalTotal = feeStructure.feeItems
    .filter((item) => !item.isOptional)
    .reduce((sum, item) => sum + item.amount, 0);

  let generated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const student of students) {
    try {
      // Check if bill already exists for this student + fee structure
      const existingBill = await db.studentBill.findUnique({
        where: {
          studentId_feeStructureId: {
            studentId: student.id,
            feeStructureId: feeStructure.id,
          },
        },
      });

      if (existingBill) {
        skipped++;
        continue;
      }

      // Check for active scholarships for this student
      const studentScholarships = await db.studentScholarship.findMany({
        where: {
          studentId: student.id,
          termId: feeStructure.termId,
          scholarship: { status: "ACTIVE" },
        },
        include: { scholarship: true },
      });

      let scholarshipDiscount = 0;
      for (const ss of studentScholarships) {
        if (ss.scholarship.type === "PERCENTAGE") {
          scholarshipDiscount += nonOptionalTotal * (ss.scholarship.value / 100);
        } else {
          scholarshipDiscount += ss.scholarship.value;
        }
      }

      const adjustedTotal = Math.max(0, nonOptionalTotal - scholarshipDiscount);

      await db.$transaction(async (tx) => {
        const bill = await tx.studentBill.create({
          data: {
            studentId: student.id,
            feeStructureId: feeStructure.id,
            termId: feeStructure.termId,
            academicYearId: feeStructure.academicYearId,
            totalAmount: adjustedTotal,
            paidAmount: 0,
            balanceAmount: adjustedTotal,
            status: adjustedTotal === 0 ? "WAIVED" : "UNPAID",
          },
        });

        // Create bill items for each fee item (non-optional only by default)
        const billItemsData = feeStructure.feeItems
          .filter((item) => !item.isOptional)
          .map((item) => ({
            studentBillId: bill.id,
            feeItemId: item.id,
            amount: item.amount,
            waivedAmount: 0,
            paidAmount: 0,
          }));

        if (billItemsData.length > 0) {
          await tx.studentBillItem.createMany({ data: billItemsData });
        }
      });

      generated++;
    } catch (err) {
      errors.push(`Failed to generate bill for ${student.firstName} ${student.lastName} (${student.studentId}): ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "StudentBill",
    entityId: feeStructure.id,
    module: "finance",
    description: `Generated ${generated} bills for fee structure "${feeStructure.name}" (${skipped} skipped)`,
    metadata: { generated, skipped, errors: errors.length },
  });

  return { data: { generated, skipped, errors } };
}

export async function getBillsAction(filters?: {
  studentId?: string;
  termId?: string;
  status?: string;
  classArmId?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (filters?.studentId) where.studentId = filters.studentId;
  if (filters?.termId) where.termId = filters.termId;
  if (filters?.status) where.status = filters.status;

  // If classArmId filter, get student IDs enrolled in that class arm
  if (filters?.classArmId) {
    const enrollments = await db.enrollment.findMany({
      where: { classArmId: filters.classArmId, status: "ACTIVE" },
      select: { studentId: true },
    });
    where.studentId = { in: enrollments.map((e) => e.studentId) };
  }

  const [bills, total] = await Promise.all([
    db.studentBill.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { generatedAt: "desc" },
    }),
    db.studentBill.count({ where }),
  ]);

  // Fetch student info for bills
  const studentIds = [...new Set(bills.map((b) => b.studentId))];
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  // Get current enrollments for class info
  const enrollments = await db.enrollment.findMany({
    where: { studentId: { in: studentIds }, status: "ACTIVE" },
    include: {
      classArm: {
        include: {
          class: { select: { name: true } },
        },
      },
    },
  });
  const enrollmentMap = new Map(enrollments.map((e) => [e.studentId, e]));

  const data = bills.map((bill) => {
    const student = studentMap.get(bill.studentId);
    const enrollment = enrollmentMap.get(bill.studentId);
    return {
      ...bill,
      studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown",
      studentIdNumber: student?.studentId ?? "Unknown",
      className: enrollment
        ? `${enrollment.classArm.class.name} ${enrollment.classArm.name}`
        : "N/A",
    };
  });

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getStudentBillAction(billId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const bill = await db.studentBill.findUnique({
    where: { id: billId },
    include: {
      billItems: {
        include: {
          feeItem: true,
        },
      },
      payments: {
        include: {
          receipt: true,
        },
        orderBy: { receivedAt: "desc" },
      },
      feeStructure: {
        select: { id: true, name: true },
      },
    },
  });

  if (!bill) {
    return { error: "Bill not found" };
  }

  // Fetch student info
  const student = await db.student.findUnique({
    where: { id: bill.studentId },
    select: { id: true, studentId: true, firstName: true, lastName: true, boardingStatus: true },
  });

  // Get current enrollment for class info
  const enrollment = await db.enrollment.findFirst({
    where: { studentId: bill.studentId, status: "ACTIVE" },
    include: {
      classArm: {
        include: {
          class: { select: { name: true } },
        },
      },
    },
  });

  return {
    data: {
      ...bill,
      studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown",
      studentIdNumber: student?.studentId ?? "Unknown",
      boardingStatus: student?.boardingStatus ?? "DAY",
      className: enrollment
        ? `${enrollment.classArm.class.name} ${enrollment.classArm.name}`
        : "N/A",
    },
  };
}

export async function getStudentBillsAction(studentId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const bills = await db.studentBill.findMany({
    where: { studentId },
    include: {
      feeStructure: {
        select: { id: true, name: true },
      },
      _count: {
        select: { payments: true },
      },
    },
    orderBy: { generatedAt: "desc" },
  });

  // Fetch term names
  const termIds = [...new Set(bills.map((b) => b.termId))];
  const terms = await db.term.findMany({
    where: { id: { in: termIds } },
    select: { id: true, name: true },
  });
  const termMap = new Map(terms.map((t) => [t.id, t.name]));

  const data = bills.map((bill) => ({
    ...bill,
    termName: termMap.get(bill.termId) ?? "Unknown",
    paymentCount: bill._count.payments,
  }));

  return { data };
}
