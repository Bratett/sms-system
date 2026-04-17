import { afterAll, describe, expect, it } from "vitest";
import {
  calculateStatutoryDeductions,
  getAvailableCountries,
  invalidateTaxCache,
  warmupTaxConfigs,
} from "@/lib/payroll/tax-tables";
import { prismaMock } from "../setup";

/**
 * Golden-file parity test. Locks in the exact numeric output of the current
 * in-file tax tables so a DB-backed refactor can prove byte-identical results.
 *
 * If any value here changes, either the tax rules genuinely changed (update
 * the expected value with a code-review-visible diff) or the DB rows have
 * drifted from the hardcoded fallback (which should be reconciled).
 */

type Expected = {
  country: string;
  gross: number;
  employee: number;
  employer: number;
  net: number;
};

// Derived by running the current implementation; these lock current behaviour.
// Source of the rules lives in src/lib/payroll/tax-tables.ts.
const EXPECTED: Expected[] = [
  // Ghana — PAYE (6 brackets) + SSNIT T1 (5.5% ee / 13% er) + SSNIT T2 (5% ee)
  { country: "GH", gross: 400, employee: 42, employer: 52, net: 358 },
  { country: "GH", gross: 1000, employee: 186.15, employer: 130, net: 813.85 },
  { country: "GH", gross: 5000, employee: 1408, employer: 650, net: 3592 },
  { country: "GH", gross: 25000, employee: 8756.15, employer: 3250, net: 16243.85 },
  // Nigeria — PAYE (annualized, 6 brackets) + Pension (8% ee / 10% er)
  { country: "NG", gross: 50000, employee: 8500, employer: 5000, net: 41500 },
  { country: "NG", gross: 200000, employee: 48666.67, employer: 20000, net: 151333.33 },
  // Kenya — PAYE (3 brackets, relief 2400) + NSSF (6% ee/er on ≤18,000 base)
  { country: "KE", gross: 20000, employee: 1080, employer: 1080, net: 18920 },
  { country: "KE", gross: 60000, employee: 11463.35, employer: 1080, net: 48536.65 },
];

describe("payroll/tax-tables parity", () => {
  it("exposes the three supported countries", () => {
    expect(new Set(getAvailableCountries())).toEqual(new Set(["GH", "NG", "KE"]));
  });

  it.each(EXPECTED)(
    "$country gross=$gross → ee=$employee er=$employer net=$net",
    ({ country, gross, employee, employer, net }) => {
      const r = calculateStatutoryDeductions(country, gross);
      expect(r.totalEmployee).toBeCloseTo(employee, 2);
      expect(r.totalEmployer).toBeCloseTo(employer, 2);
      expect(r.netSalary).toBeCloseTo(net, 2);
    },
  );

  it("returns gross unchanged for an unknown country code", () => {
    const r = calculateStatutoryDeductions("ZZ", 1000);
    expect(r.deductions).toHaveLength(0);
    expect(r.netSalary).toBe(1000);
  });
});

/**
 * Same parity expectations, but with the cache warmed up from the mocked DB.
 * This is the "DB read path" — it must produce byte-identical numbers to the
 * fallback path so the migration is provably safe.
 */
describe("payroll/tax-tables parity — DB-backed", () => {
  afterAll(() => {
    invalidateTaxCache();
  });

  it("warming up from mocked DB rows produces identical output", async () => {
    // Seed rows matching the migration's seed.
    prismaMock.taxTable.findMany.mockResolvedValue([
      {
        country: "GH",
        name: "PAYE (Income Tax)",
        type: "INCOME_TAX",
        employeeRate: null,
        employerRate: null,
        ceilingAmount: null,
        brackets: [
          { min: 0, max: 402, rate: 0 },
          { min: 402, max: 512, rate: 5 },
          { min: 512, max: 642, rate: 10 },
          { min: 642, max: 3642, rate: 17.5 },
          { min: 3642, max: 20037, rate: 25 },
          { min: 20037, max: null, rate: 30 },
        ],
        annualized: false,
        relief: null,
      },
      {
        country: "GH",
        name: "SSNIT (Tier 1)",
        type: "SOCIAL_SECURITY",
        employeeRate: 5.5,
        employerRate: 13,
        ceilingAmount: null,
        brackets: null,
        annualized: false,
        relief: null,
      },
      {
        country: "GH",
        name: "SSNIT (Tier 2)",
        type: "PENSION",
        employeeRate: 5,
        employerRate: 0,
        ceilingAmount: null,
        brackets: null,
        annualized: false,
        relief: null,
      },
    ] as never);

    await warmupTaxConfigs();

    // Same cases as the fallback path; must match byte-for-byte.
    const gh400 = calculateStatutoryDeductions("GH", 400);
    expect(gh400.totalEmployee).toBeCloseTo(42, 2);
    expect(gh400.totalEmployer).toBeCloseTo(52, 2);
    expect(gh400.netSalary).toBeCloseTo(358, 2);

    const gh5000 = calculateStatutoryDeductions("GH", 5000);
    expect(gh5000.totalEmployee).toBeCloseTo(1408, 2);
    expect(gh5000.totalEmployer).toBeCloseTo(650, 2);
    expect(gh5000.netSalary).toBeCloseTo(3592, 2);
  });
});
