"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import { PERMISSIONS, denyPermission } from "@/lib/permissions";
import { z } from "zod";

// ─── Schemas ────────────────────────────────────────────────

const LOAN_TYPES = ["SALARY_ADVANCE", "PERSONAL_LOAN", "EMERGENCY_LOAN"] as const;

const createLoanSchema = z.object({
  staffId: z.string().min(1, "Staff ID is required"),
  type: z.enum(LOAN_TYPES, { message: "Loan type is required" }),
  amount: z.number().min(1, "Amount must be greater than 0"),
  interestRate: z.number().min(0).max(100).optional(),
  tenure: z.number().int().min(1, "Tenure must be at least 1 month"),
});

type CreateLoanInput = z.infer<typeof createLoanSchema>;

// ─── CRUD ───────────────────────────────────────────────────

export async function getLoansAction(filters?: {
  staffId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.LOAN_READ)) return { error: "Insufficient permissions" };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { schoolId: ctx.schoolId };
  if (filters?.staffId) where.staffId = filters.staffId;
  if (filters?.status) where.status = filters.status;

  const [loans, total] = await Promise.all([
    db.staffLoan.findMany({
      where,
      include: {
        staff: { select: { firstName: true, lastName: true, staffId: true } },
        repayments: { orderBy: { date: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.staffLoan.count({ where }),
  ]);

  return { data: loans, total, page, pageSize };
}

export async function createLoanAction(data: CreateLoanInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.LOAN_CREATE)) return { error: "Insufficient permissions" };

  const parsed = createLoanSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const staff = await db.staff.findUnique({ where: { id: parsed.data.staffId } });
  if (!staff) return { error: "Staff member not found." };

  // Check for existing active/approved loans
  const existingActive = await db.staffLoan.count({
    where: {
      staffId: parsed.data.staffId,
      status: { in: ["PENDING", "APPROVED", "ACTIVE"] },
    },
  });
  if (existingActive > 0) {
    return { error: "Staff member already has an active or pending loan. Please clear existing loans first." };
  }

  // Calculate repayment
  const rate = parsed.data.interestRate ?? 0;
  const totalRepayment = parsed.data.amount * (1 + rate / 100);
  const monthlyDeduction = totalRepayment / parsed.data.tenure;

  // Auto-generate loan number
  const loanCount = await db.staffLoan.count({ where: { schoolId: ctx.schoolId } });
  const year = new Date().getFullYear();
  const loanNumber = `LN/${year}/${String(loanCount + 1).padStart(4, "0")}`;

  const loan = await db.staffLoan.create({
    data: {
      schoolId: ctx.schoolId,
      staffId: parsed.data.staffId,
      loanNumber,
      type: parsed.data.type,
      amount: parsed.data.amount,
      interestRate: rate,
      totalRepayment,
      monthlyDeduction,
      tenure: parsed.data.tenure,
      remainingBalance: totalRepayment,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "StaffLoan",
    entityId: loan.id,
    module: "hr",
    description: `Created ${parsed.data.type} loan (${loanNumber}) for "${staff.firstName} ${staff.lastName}" — amount: ${parsed.data.amount}`,
    newData: loan,
  });

  return { data: loan };
}

export async function approveLoanAction(loanId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.LOAN_APPROVE)) return { error: "Insufficient permissions" };

  const loan = await db.staffLoan.findUnique({ where: { id: loanId } });
  if (!loan) return { error: "Loan not found." };
  if (loan.status !== "PENDING") return { error: "Only pending loans can be approved." };

  const updated = await db.staffLoan.update({
    where: { id: loanId },
    data: {
      status: "ACTIVE",
      approvedBy: ctx.session.user.id,
      approvedAt: new Date(),
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "APPROVE",
    entity: "StaffLoan",
    entityId: loanId,
    module: "hr",
    description: `Approved loan ${loan.loanNumber}`,
    previousData: loan,
    newData: updated,
  });

  return { data: updated };
}

export async function cancelLoanAction(loanId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.LOAN_APPROVE)) return { error: "Insufficient permissions" };

  const loan = await db.staffLoan.findUnique({ where: { id: loanId } });
  if (!loan) return { error: "Loan not found." };
  if (loan.status !== "PENDING") return { error: "Only pending loans can be cancelled." };

  const updated = await db.staffLoan.update({
    where: { id: loanId },
    data: { status: "CANCELLED" },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "StaffLoan",
    entityId: loanId,
    module: "hr",
    description: `Cancelled loan ${loan.loanNumber}`,
    previousData: loan,
    newData: updated,
  });

  return { data: updated };
}

export async function getLoanRepaymentsAction(loanId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.LOAN_READ)) return { error: "Insufficient permissions" };

  const repayments = await db.loanRepayment.findMany({
    where: { loanId },
    orderBy: { date: "desc" },
  });

  return { data: repayments };
}
