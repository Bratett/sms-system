"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import { PERMISSIONS, denyPermission } from "@/lib/permissions";
import { calculateStatutoryDeductions, getAvailableCountries } from "@/lib/payroll/tax-tables";
import { generateCSVBankFile, type PayrollEntry } from "@/lib/payroll/bank-file";

export async function calculatePayslipAction(staffId: string, data: {
  grossSalary: number;
  countryCode: string;
  additionalAllowances?: Array<{ name: string; amount: number }>;
  additionalDeductions?: Array<{ name: string; amount: number }>;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.PAYROLL_READ)) return { error: "Insufficient permissions" };

  const staff = await db.staff.findUnique({
    where: { id: staffId },
    select: { id: true, staffId: true, firstName: true, lastName: true },
  });
  if (!staff) return { error: "Staff member not found" };

  const statutory = calculateStatutoryDeductions(data.countryCode, data.grossSalary);
  const totalAllowances = (data.additionalAllowances ?? []).reduce((s, a) => s + a.amount, 0);
  const totalAdditionalDeductions = (data.additionalDeductions ?? []).reduce((s, d) => s + d.amount, 0);
  const grossWithAllowances = data.grossSalary + totalAllowances;
  const totalDeductions = statutory.totalEmployee + totalAdditionalDeductions;
  const netPay = grossWithAllowances - totalDeductions;

  return {
    data: {
      staff: { id: staff.id, staffId: staff.staffId, name: `${staff.firstName} ${staff.lastName}` },
      grossSalary: data.grossSalary,
      allowances: data.additionalAllowances ?? [],
      totalAllowances,
      grossWithAllowances,
      statutoryDeductions: statutory.deductions,
      additionalDeductions: data.additionalDeductions ?? [],
      totalStatutoryEmployee: statutory.totalEmployee,
      totalStatutoryEmployer: statutory.totalEmployer,
      totalDeductions,
      netPay: Math.round(netPay * 100) / 100,
    },
  };
}

export async function generateBankFileAction(data: {
  payrollPeriodId: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.PAYROLL_READ)) return { error: "Insufficient permissions" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const period = await db.payrollPeriod.findUnique({ where: { id: data.payrollPeriodId } });
  if (!period) return { error: "Payroll period not found" };

  const entries = await db.payrollEntry.findMany({
    where: { payrollPeriodId: data.payrollPeriodId },
  });

  if (entries.length === 0) return { error: "No payroll entries found" };

  // Lookup staff details for each entry
  const staffIds = [...new Set(entries.map((e) => e.staffId))];
  const staffList = await db.staff.findMany({
    where: { id: { in: staffIds } },
    select: { id: true, staffId: true, firstName: true, lastName: true },
  });
  const staffMap = new Map(staffList.map((s) => [s.id, s]));

  const payrollEntries: PayrollEntry[] = entries.map((e) => {
    const staff = staffMap.get(e.staffId);
    return {
      staffId: staff?.staffId ?? e.staffId,
      staffName: staff ? `${staff.firstName} ${staff.lastName}` : "Unknown",
      bankName: "Bank",
      accountNumber: "0000000000",
      netPay: toNum(e.netPay),
      reference: `SAL-${period.month}-${period.year}-${staff?.staffId ?? e.staffId}`,
    };
  });

  const today = new Date().toISOString().split("T")[0];
  const periodName = `${period.month}-${period.year}`;

  const result = generateCSVBankFile(payrollEntries, {
    schoolName: school.name,
    payrollPeriod: periodName,
    date: today,
  });

  await audit({
    userId: session.user.id!,
    action: "EXPORT",
    entity: "PayrollPeriod",
    entityId: data.payrollPeriodId,
    module: "hr",
    description: `Generated bank file for ${periodName}: ${result.recordCount} records, total ${result.totalAmount.toFixed(2)}`,
  });

  return { data: result };
}

export async function getAvailableTaxCountriesAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.PAYROLL_READ)) return { error: "Insufficient permissions" };
  return { data: getAvailableCountries() };
}
