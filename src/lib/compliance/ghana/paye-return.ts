import { db } from "@/lib/db";
import { toNum } from "@/lib/decimal";
import type {
  EmployerContext,
  StatutoryReturn,
  StatutoryReturnPeriod,
} from "./types";

/**
 * PAYE (Pay-As-You-Earn income tax) return.
 *
 * Aggregates per-employee PAYE figures from the `PayrollEntry.details` JSON
 * blob produced by `calculatePayslipAction`. Each row lists one employee so
 * the GRA can reconcile remittances against individual TIN/SSNIT numbers.
 *
 * Structure matches GRA IRIS PAYE schedule: TIN, Name, Basic, Allowances,
 * Gross, Tax Relief, Taxable, PAYE, Net.
 */

export interface PayeReturnRow {
  staffId: string;
  staffRef: string;
  staffName: string;
  tin: string | null;
  ssnitNumber: string | null;
  basicSalary: number;
  allowances: number;
  grossSalary: number;
  reliefs: number;
  taxableIncome: number;
  paye: number;
  netPay: number;
}

interface PayrollEntryDetails {
  deductions?: Array<{ name: string; type: string; employee: number }>;
  allowances?: Array<{ name: string; amount: number }>;
  reliefs?: number;
}

export async function generatePayeReturn(
  schoolId: string,
  employer: EmployerContext,
  period: StatutoryReturnPeriod,
): Promise<StatutoryReturn<PayeReturnRow>> {
  const entries = await db.payrollEntry.findMany({
    where: {
      schoolId,
      payrollPeriod: {
        AND: [
          { year: period.from.getUTCFullYear() },
          { month: period.from.getUTCMonth() + 1 },
        ],
      },
    },
    include: {
      staff: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          staffId: true,
          tinNumber: true,
          ssnitNumber: true,
        },
      },
    },
  });

  const rows: PayeReturnRow[] = entries.map((e) => {
    const details = (e.details as PayrollEntryDetails | null) ?? {};
    const payeDeduction = details.deductions?.find(
      (d) =>
        d.type === "tax" ||
        d.name.toUpperCase().includes("PAYE") ||
        d.name.toUpperCase().includes("INCOME TAX"),
    );
    const paye = payeDeduction ? Number(payeDeduction.employee) : 0;
    const basic = toNum(e.basicSalary);
    const allowances = toNum(e.totalAllowances);
    const gross = basic + allowances;
    const reliefs = details.reliefs ?? 0;
    const taxable = Math.max(0, gross - reliefs);

    return {
      staffId: e.staffId,
      staffRef: e.staff.staffId,
      staffName: `${e.staff.firstName} ${e.staff.lastName}`,
      tin: e.staff.tinNumber,
      ssnitNumber: e.staff.ssnitNumber,
      basicSalary: basic,
      allowances,
      grossSalary: gross,
      reliefs,
      taxableIncome: taxable,
      paye,
      netPay: toNum(e.netPay),
    };
  });

  const totals = {
    employees: rows.length,
    basicSalary: sum(rows, "basicSalary"),
    allowances: sum(rows, "allowances"),
    grossSalary: sum(rows, "grossSalary"),
    taxableIncome: sum(rows, "taxableIncome"),
    paye: sum(rows, "paye"),
    netPay: sum(rows, "netPay"),
  };

  return {
    kind: "GH_PAYE",
    period,
    employer,
    rows,
    totals,
    generatedAt: new Date(),
  };
}

function sum<T extends Record<string, unknown>>(arr: T[], key: keyof T): number {
  return Math.round(
    arr.reduce((acc, row) => acc + Number(row[key] ?? 0), 0) * 100,
  ) / 100;
}
