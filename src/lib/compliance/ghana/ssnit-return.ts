import { db } from "@/lib/db";
import { toNum } from "@/lib/decimal";
import type {
  EmployerContext,
  StatutoryReturn,
  StatutoryReturnPeriod,
} from "./types";

/**
 * SSNIT Tier 1 / Tier 2 contribution returns.
 *
 * Tier 1 is the mandatory state-administered scheme (5.5% employee + 13%
 * employer on basic salary). Tier 2 is the occupational pension (5%
 * employee, no employer split in default Ghana config).
 *
 * Both returns use the same shape: one row per employee, with contribution
 * amounts sourced from `PayrollEntry.details.deductions` rather than
 * re-calculated so what we file equals what was actually paid.
 */

export interface SsnitReturnRow {
  staffId: string;
  staffRef: string;
  staffName: string;
  ssnitNumber: string | null;
  basicSalary: number;
  employeeContribution: number;
  employerContribution: number;
  totalContribution: number;
  [key: string]: unknown;
}

interface PayrollEntryDetails {
  deductions?: Array<{ name: string; type: string; employee: number; employer?: number }>;
}

type Tier = "TIER_1" | "TIER_2";

function matchesTier(name: string, tier: Tier): boolean {
  const upper = name.toUpperCase();
  if (tier === "TIER_1") {
    return upper.includes("TIER 1") || upper.includes("TIER1") ||
      (upper.includes("SSNIT") && !upper.includes("TIER 2") && !upper.includes("TIER2"));
  }
  return upper.includes("TIER 2") || upper.includes("TIER2");
}

async function generate(
  schoolId: string,
  employer: EmployerContext,
  period: StatutoryReturnPeriod,
  tier: Tier,
): Promise<StatutoryReturn<SsnitReturnRow>> {
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
  });

  // PayrollEntry has no inline `staff` relation; resolve staff in a second
  // query and merge in memory. See paye-return.ts for the same pattern.
  const staffIds = [...new Set(entries.map((e) => e.staffId))];
  const staff = await db.staff.findMany({
    where: { id: { in: staffIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      staffId: true,
      ssnitNumber: true,
    },
  });
  const staffById = new Map(staff.map((s) => [s.id, s]));

  const rows: SsnitReturnRow[] = entries.map((e) => {
    const details = (e.details as PayrollEntryDetails | null) ?? {};
    const match = details.deductions?.find((d) => matchesTier(d.name, tier));
    const employee = match ? Number(match.employee) : 0;
    const employer2 = match ? Number(match.employer ?? 0) : 0;
    const s = staffById.get(e.staffId);
    return {
      staffId: e.staffId,
      staffRef: s?.staffId ?? e.staffId,
      staffName: s ? `${s.firstName} ${s.lastName}` : e.staffId,
      ssnitNumber: s?.ssnitNumber ?? null,
      basicSalary: toNum(e.basicSalary),
      employeeContribution: employee,
      employerContribution: employer2,
      totalContribution: Math.round((employee + employer2) * 100) / 100,
    };
  });

  return {
    kind: tier === "TIER_1" ? "GH_SSNIT_TIER1" : "GH_SSNIT_TIER2",
    period,
    employer,
    rows,
    totals: {
      employees: rows.length,
      employeeContribution: sum(rows, "employeeContribution"),
      employerContribution: sum(rows, "employerContribution"),
      totalContribution: sum(rows, "totalContribution"),
    },
    generatedAt: new Date(),
  };
}

export function generateSsnitTier1Return(
  schoolId: string,
  employer: EmployerContext,
  period: StatutoryReturnPeriod,
) {
  return generate(schoolId, employer, period, "TIER_1");
}

export function generateSsnitTier2Return(
  schoolId: string,
  employer: EmployerContext,
  period: StatutoryReturnPeriod,
) {
  return generate(schoolId, employer, period, "TIER_2");
}

function sum<T extends Record<string, unknown>>(arr: T[], key: keyof T): number {
  return Math.round(
    arr.reduce((acc, row) => acc + Number(row[key] ?? 0), 0) * 100,
  ) / 100;
}
