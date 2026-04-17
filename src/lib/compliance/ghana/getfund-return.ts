import { db } from "@/lib/db";
import { toNum } from "@/lib/decimal";
import type {
  EmployerContext,
  StatutoryReturn,
  StatutoryReturnPeriod,
} from "./types";

/**
 * GETFund disbursement return.
 *
 * Reports per-term inflows from the `GovernmentSubsidy` table where
 * `subsidyType` is GETFund-shaped. Each row lists expected vs received
 * amounts so the auditor can tie the school's bank statement to the
 * published disbursement schedule.
 */

export interface GetFundReturnRow {
  subsidyId: string;
  name: string;
  subsidyType: string;
  termName: string | null;
  expectedAmount: number;
  receivedAmount: number;
  variance: number;
  status: string;
  [key: string]: unknown;
}

export async function generateGetFundReturn(
  schoolId: string,
  employer: EmployerContext,
  period: StatutoryReturnPeriod,
): Promise<StatutoryReturn<GetFundReturnRow>> {
  const subsidies = await db.governmentSubsidy.findMany({
    where: {
      schoolId,
      createdAt: { gte: period.from, lt: period.to },
    },
    orderBy: { createdAt: "asc" },
  });

  // GovernmentSubsidy has no inline `term` relation; resolve term names in
  // a second query and map by id.
  const termIds = [...new Set(subsidies.map((s) => s.termId).filter((x): x is string => !!x))];
  const terms = termIds.length
    ? await db.term.findMany({ where: { id: { in: termIds } }, select: { id: true, name: true } })
    : [];
  const termById = new Map(terms.map((t) => [t.id, t.name]));

  const rows: GetFundReturnRow[] = subsidies.map((s) => {
    const expected = toNum(s.expectedAmount);
    const received = toNum(s.receivedAmount);
    return {
      subsidyId: s.id,
      name: s.name,
      subsidyType: String(s.subsidyType),
      termName: s.termId ? termById.get(s.termId) ?? null : null,
      expectedAmount: expected,
      receivedAmount: received,
      variance: Math.round((received - expected) * 100) / 100,
      status: String(s.status),
    };
  });

  return {
    kind: "GH_GETFUND",
    period,
    employer,
    rows,
    totals: {
      rows: rows.length,
      expectedAmount: sum(rows, "expectedAmount"),
      receivedAmount: sum(rows, "receivedAmount"),
      variance: sum(rows, "variance"),
    },
    generatedAt: new Date(),
  };
}

function sum<T extends Record<string, unknown>>(arr: T[], key: keyof T): number {
  return Math.round(
    arr.reduce((acc, row) => acc + Number(row[key] ?? 0), 0) * 100,
  ) / 100;
}
