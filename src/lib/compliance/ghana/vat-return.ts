import { db } from "@/lib/db";
import { toNum } from "@/lib/decimal";
import type {
  EmployerContext,
  StatutoryReturn,
  StatutoryReturnPeriod,
} from "./types";

/**
 * VAT / GRA tax-record return.
 *
 * Reads rows from the existing `TaxRecord` table filtered to a period.
 * Emits the schedule a GRA officer needs during a field visit: type,
 * period key, amount, due date, paid amount, paid date, status.
 */

export interface VatReturnRow {
  recordId: string;
  taxType: string;
  period: string;
  amount: number;
  paidAmount: number;
  outstanding: number;
  dueDate: Date | null;
  paidDate: Date | null;
  referenceNumber: string | null;
  status: string;
}

export async function generateVatReturn(
  schoolId: string,
  employer: EmployerContext,
  period: StatutoryReturnPeriod,
): Promise<StatutoryReturn<VatReturnRow>> {
  const records = await db.taxRecord.findMany({
    where: {
      schoolId,
      taxType: "VAT",
      createdAt: { gte: period.from, lt: period.to },
    },
    orderBy: { period: "asc" },
  });

  const rows: VatReturnRow[] = records.map((r) => {
    const amount = toNum(r.amount);
    const paid = toNum(r.paidAmount ?? 0);
    return {
      recordId: r.id,
      taxType: String(r.taxType),
      period: r.period,
      amount,
      paidAmount: paid,
      outstanding: Math.round((amount - paid) * 100) / 100,
      dueDate: r.dueDate ?? null,
      paidDate: r.paidDate ?? null,
      referenceNumber: r.referenceNumber ?? null,
      status: String(r.status),
    };
  });

  return {
    kind: "GH_VAT",
    period,
    employer,
    rows,
    totals: {
      rows: rows.length,
      amount: sum(rows, "amount"),
      paidAmount: sum(rows, "paidAmount"),
      outstanding: sum(rows, "outstanding"),
    },
    generatedAt: new Date(),
  };
}

/**
 * Consolidated GRA return — every `TaxRecord` type (PAYE, VAT, WITHHOLDING,
 * CORPORATE_TAX, SSNIT) aggregated for the period. Useful as a one-page
 * cover sheet on top of the specific PAYE/SSNIT/VAT schedules.
 */
export async function generateGraConsolidatedReturn(
  schoolId: string,
  employer: EmployerContext,
  period: StatutoryReturnPeriod,
): Promise<StatutoryReturn<VatReturnRow>> {
  const records = await db.taxRecord.findMany({
    where: { schoolId, createdAt: { gte: period.from, lt: period.to } },
    orderBy: [{ taxType: "asc" }, { period: "asc" }],
  });

  const rows: VatReturnRow[] = records.map((r) => {
    const amount = toNum(r.amount);
    const paid = toNum(r.paidAmount ?? 0);
    return {
      recordId: r.id,
      taxType: String(r.taxType),
      period: r.period,
      amount,
      paidAmount: paid,
      outstanding: Math.round((amount - paid) * 100) / 100,
      dueDate: r.dueDate ?? null,
      paidDate: r.paidDate ?? null,
      referenceNumber: r.referenceNumber ?? null,
      status: String(r.status),
    };
  });

  return {
    kind: "GH_GRA_CONSOLIDATED",
    period,
    employer,
    rows,
    totals: {
      rows: rows.length,
      amount: sum(rows, "amount"),
      paidAmount: sum(rows, "paidAmount"),
      outstanding: sum(rows, "outstanding"),
    },
    generatedAt: new Date(),
  };
}

function sum<T extends Record<string, unknown>>(arr: T[], key: keyof T): number {
  return Math.round(
    arr.reduce((acc, row) => acc + Number(row[key] ?? 0), 0) * 100,
  ) / 100;
}
