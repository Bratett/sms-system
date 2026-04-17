"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import {
  createAllowanceSchema,
  createDeductionSchema,
  createPayrollPeriodSchema,
  type CreateAllowanceInput,
  type CreateDeductionInput,
  type CreatePayrollPeriodInput,
} from "@/modules/hr/schemas/payroll.schema";
import { PERMISSIONS, denyPermission } from "@/lib/permissions";

// ─── Allowances ──────────────────────────────────────────────

export async function getAllowancesAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.PAYROLL_READ)) return { error: "Insufficient permissions" };

  const allowances = await db.allowance.findMany({
    where: { schoolId: ctx.schoolId },
    orderBy: { name: "asc" },
  });

  const data = allowances.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    amount: a.amount,
    status: a.status,
  }));

  return { data };
}

export async function createAllowanceAction(data: CreateAllowanceInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.PAYROLL_CREATE)) return { error: "Insufficient permissions" };

  const parsed = createAllowanceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.allowance.findUnique({
    where: {
      schoolId_name: {
        schoolId: ctx.schoolId,
        name: parsed.data.name,
      },
    },
  });

  if (existing) {
    return { error: `An allowance named "${parsed.data.name}" already exists.` };
  }

  const allowance = await db.allowance.create({
    data: {
      schoolId: ctx.schoolId,
      name: parsed.data.name,
      type: parsed.data.type,
      amount: parsed.data.amount,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "Allowance",
    entityId: allowance.id,
    module: "hr",
    description: `Created allowance "${allowance.name}" (${allowance.type}: ${allowance.amount})`,
    newData: allowance,
  });

  return { data: allowance };
}

export async function deleteAllowanceAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const existing = await db.allowance.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Allowance not found." };
  }

  await db.allowance.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "Allowance",
    entityId: id,
    module: "hr",
    description: `Deleted allowance "${existing.name}"`,
    previousData: existing,
  });

  return { success: true };
}

// ─── Deductions ──────────────────────────────────────────────

export async function getDeductionsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const deductions = await db.deduction.findMany({
    where: { schoolId: ctx.schoolId },
    orderBy: { name: "asc" },
  });

  const data = deductions.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    amount: d.amount,
    isStatutory: d.isStatutory,
    status: d.status,
  }));

  return { data };
}

export async function createDeductionAction(data: CreateDeductionInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const parsed = createDeductionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.deduction.findUnique({
    where: {
      schoolId_name: {
        schoolId: ctx.schoolId,
        name: parsed.data.name,
      },
    },
  });

  if (existing) {
    return { error: `A deduction named "${parsed.data.name}" already exists.` };
  }

  const deduction = await db.deduction.create({
    data: {
      schoolId: ctx.schoolId,
      name: parsed.data.name,
      type: parsed.data.type,
      amount: parsed.data.amount,
      isStatutory: parsed.data.isStatutory ?? false,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "Deduction",
    entityId: deduction.id,
    module: "hr",
    description: `Created deduction "${deduction.name}" (${deduction.type}: ${deduction.amount})`,
    newData: deduction,
  });

  return { data: deduction };
}

export async function deleteDeductionAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const existing = await db.deduction.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Deduction not found." };
  }

  await db.deduction.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "Deduction",
    entityId: id,
    module: "hr",
    description: `Deleted deduction "${existing.name}"`,
    previousData: existing,
  });

  return { success: true };
}

// ─── Payroll Periods ─────────────────────────────────────────

export async function getPayrollPeriodsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const periods = await db.payrollPeriod.findMany({
    where: { schoolId: ctx.schoolId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: {
      entries: {
        select: {
          netPay: true,
        },
      },
    },
  });

  const data = periods.map((p) => ({
    id: p.id,
    month: p.month,
    year: p.year,
    status: p.status,
    entriesCount: p.entries.length,
    totalNetPay: p.entries.reduce((sum, e) => sum + toNum(e.netPay), 0),
    createdAt: p.createdAt,
  }));

  return { data };
}

export async function createPayrollPeriodAction(data: CreatePayrollPeriodInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const parsed = createPayrollPeriodSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  // Check for duplicate
  const existing = await db.payrollPeriod.findUnique({
    where: {
      schoolId_month_year: {
        schoolId: ctx.schoolId,
        month: parsed.data.month,
        year: parsed.data.year,
      },
    },
  });

  if (existing) {
    return {
      error: `A payroll period for ${parsed.data.month}/${parsed.data.year} already exists.`,
    };
  }

  const period = await db.payrollPeriod.create({
    data: {
      schoolId: ctx.schoolId,
      month: parsed.data.month,
      year: parsed.data.year,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "PayrollPeriod",
    entityId: period.id,
    module: "hr",
    description: `Created payroll period ${parsed.data.month}/${parsed.data.year}`,
    newData: period,
  });

  return { data: period };
}

// ─── Generate Payroll ────────────────────────────────────────

// Default salary grades (GHS)
const SALARY_GRADES: Record<string, number> = {
  "Grade 1": 1800,
  "Grade 2": 2200,
  "Grade 3": 2800,
  "Grade 4": 3500,
  "Grade 5": 4200,
  "Grade 6": 5000,
  "Grade 7": 6000,
  "Grade 8": 7500,
  "Grade 9": 9000,
  "Grade 10": 11000,
};
const DEFAULT_SALARY = 2000;

export async function generatePayrollAction(periodId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const period = await db.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { entries: true },
  });

  if (!period) {
    return { error: "Payroll period not found." };
  }

  if (period.status !== "DRAFT") {
    return { error: "Only DRAFT payroll periods can have payroll generated." };
  }

  // Remove existing entries if regenerating
  if (period.entries.length > 0) {
    await db.payrollEntry.deleteMany({
      where: { payrollPeriodId: periodId },
    });
  }

  // Get all active staff with active employments
  const activeStaff = await db.staff.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: "ACTIVE",
      deletedAt: null,
    },
    include: {
      employments: {
        where: { status: "ACTIVE" },
        take: 1,
        orderBy: { startDate: "desc" },
      },
    },
  });

  // Get active allowances and deductions
  const [allowances, deductions] = await Promise.all([
    db.allowance.findMany({
      where: { schoolId: ctx.schoolId, status: "ACTIVE" },
    }),
    db.deduction.findMany({
      where: { schoolId: ctx.schoolId, status: "ACTIVE" },
    }),
  ]);

  const errors: { staffId: string; message: string }[] = [];

  // Build entries in memory for batch insertion
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entriesToCreate: any[] = [];

  for (const staff of activeStaff) {
    const employment = staff.employments[0];
    if (!employment) {
      errors.push({
        staffId: staff.staffId,
        message: "No active employment record",
      });
      continue;
    }

    const basicSalary = employment.salaryGrade
      ? SALARY_GRADES[employment.salaryGrade] ?? DEFAULT_SALARY
      : DEFAULT_SALARY;

    const allowanceBreakdown = allowances.map((a) => ({
      name: a.name,
      amount: a.type === "PERCENTAGE" ? (basicSalary * toNum(a.amount)) / 100 : toNum(a.amount),
    }));
    const totalAllowances = allowanceBreakdown.reduce((sum, a) => sum + a.amount, 0);

    const deductionBreakdown = deductions.map((d) => ({
      name: d.name,
      amount: d.type === "PERCENTAGE" ? (basicSalary * toNum(d.amount)) / 100 : toNum(d.amount),
    }));

    // Add active loan deductions
    const activeLoans = await db.staffLoan.findMany({
      where: { staffId: staff.id, status: "ACTIVE" },
    });
    for (const loan of activeLoans) {
      const monthlyDed = toNum(loan.monthlyDeduction);
      const remaining = toNum(loan.remainingBalance);
      const deductAmount = Math.min(monthlyDed, remaining);
      if (deductAmount > 0) {
        deductionBreakdown.push({
          name: `Loan: ${loan.loanNumber}`,
          amount: deductAmount,
        });
      }
    }

    const totalDeductions = deductionBreakdown.reduce((sum, d) => sum + d.amount, 0);

    const netPay = basicSalary + totalAllowances - totalDeductions;

    entriesToCreate.push({
      payrollPeriodId: periodId,
      staffId: staff.id,
      basicSalary,
      totalAllowances,
      totalDeductions,
      netPay,
      details: {
        allowances: allowanceBreakdown,
        deductions: deductionBreakdown,
      },
    });
  }

  // Batch insert all entries at once
  let generated = 0;
  if (entriesToCreate.length > 0) {
    const result = await db.payrollEntry.createMany({
      data: entriesToCreate,
    });
    generated = result.count;
  }

  // Process loan repayments for all staff with active loans
  const allActiveLoans = await db.staffLoan.findMany({
    where: {
      staffId: { in: activeStaff.map((s) => s.id) },
      status: "ACTIVE",
    },
  });

  for (const loan of allActiveLoans) {
    const monthlyDed = toNum(loan.monthlyDeduction);
    const remaining = toNum(loan.remainingBalance);
    const deductAmount = Math.min(monthlyDed, remaining);
    if (deductAmount > 0) {
      await db.loanRepayment.create({
        data: {
          schoolId: ctx.schoolId,
          loanId: loan.id,
          payrollPeriodId: periodId,
          amount: deductAmount,
          method: "PAYROLL_DEDUCTION",
        },
      });
      const newBalance = remaining - deductAmount;
      await db.staffLoan.update({
        where: { id: loan.id },
        data: {
          remainingBalance: newBalance,
          status: newBalance <= 0 ? "FULLY_PAID" : "ACTIVE",
        },
      });
    }
  }

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "PayrollEntry",
    module: "hr",
    description: `Generated payroll for ${generated} staff members (period: ${period.month}/${period.year})`,
    metadata: { periodId, generated, errorCount: errors.length },
  });

  return { generated, errors };
}

// ─── Approve Payroll ─────────────────────────────────────────

export async function approvePayrollAction(periodId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const period = await db.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { _count: { select: { entries: true } } },
  });

  if (!period) {
    return { error: "Payroll period not found." };
  }

  if (period.status !== "DRAFT") {
    return { error: "Only DRAFT payroll periods can be approved." };
  }

  if (period._count.entries === 0) {
    return { error: "Cannot approve a payroll period with no entries. Generate payroll first." };
  }

  const updated = await db.payrollPeriod.update({
    where: { id: periodId },
    data: { status: "APPROVED" },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "PayrollPeriod",
    entityId: periodId,
    module: "hr",
    description: `Approved payroll period ${period.month}/${period.year}`,
    previousData: period,
    newData: updated,
  });

  // Notify all staff with payroll entries in this period
  const entries = await db.payrollEntry.findMany({
    where: { payrollPeriodId: periodId },
    select: { staffId: true },
  });
  const staffIds = [...new Set(entries.map((e) => e.staffId))];
  const staffWithUsers = await db.staff.findMany({
    where: { id: { in: staffIds }, userId: { not: null }, deletedAt: null },
    select: { userId: true, firstName: true, lastName: true },
  });

  if (staffWithUsers.length > 0) {
    const userIds = staffWithUsers.map((s) => s.userId!);
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const recipients = staffWithUsers
      .map((s) => {
        const user = userMap.get(s.userId!);
        return user
          ? { userId: user.id, email: user.email ?? undefined, name: `${s.firstName} ${s.lastName}` }
          : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    dispatch({
      event: NOTIFICATION_EVENTS.PAYROLL_APPROVED,
      title: "Payroll Approved",
      message: `Payroll for ${period.month}/${period.year} has been approved. Your payslip is now available.`,
      recipients,
      schoolId: ctx.schoolId,
    }).catch(() => {});
  }

  return { data: updated };
}

// ─── Payroll Entries ─────────────────────────────────────────

export async function getPayrollEntriesAction(periodId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const entries = await db.payrollEntry.findMany({
    where: { payrollPeriodId: periodId },
    orderBy: { createdAt: "asc" },
  });

  // Get staff info
  const staffIds = [...new Set(entries.map((e) => e.staffId))];
  const staffRecords =
    staffIds.length > 0
      ? await db.staff.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, staffId: true, firstName: true, lastName: true },
        })
      : [];
  const staffMap = new Map(staffRecords.map((s) => [s.id, s]));

  const data = entries.map((e) => {
    const staff = staffMap.get(e.staffId);
    return {
      id: e.id,
      staffId: e.staffId,
      staffName: staff ? `${staff.firstName} ${staff.lastName}` : "Unknown",
      staffStaffId: staff?.staffId ?? "",
      basicSalary: e.basicSalary,
      totalAllowances: e.totalAllowances,
      totalDeductions: e.totalDeductions,
      netPay: e.netPay,
      details: e.details as {
        allowances: { name: string; amount: number }[];
        deductions: { name: string; amount: number }[];
      } | null,
    };
  });

  return { data };
}
