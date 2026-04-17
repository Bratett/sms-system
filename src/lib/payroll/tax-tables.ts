/**
 * Tax calculation tables for multiple countries.
 * Extensible system for statutory deductions (tax, social security, pension).
 *
 * Source of truth: the `TaxTable` DB table. This module caches the active rows
 * in-memory on first read and exposes a sync API identical to the pre-DB
 * version. The hardcoded constants below act as a fallback when the DB is
 * empty or unreachable (CI unit tests, local-dev first run, etc.), guaranteeing
 * the same numeric output in all environments.
 *
 * To refresh the cache after a DB rate change, call `invalidateTaxCache()`.
 */

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface StatutoryDeduction {
  name: string;
  type: "tax" | "social_security" | "pension" | "other";
  employeeRate?: number;
  employerRate?: number;
  calculate: (grossSalary: number) => { employee: number; employer: number };
}

export interface CountryTaxConfig {
  country: string;
  currency: string;
  deductions: StatutoryDeduction[];
}

// ─── Ghana ──────────────────────────────────────────────────────────

const GHANA_TAX_BRACKETS: TaxBracket[] = [
  { min: 0, max: 402, rate: 0 },
  { min: 402, max: 512, rate: 5 },
  { min: 512, max: 642, rate: 10 },
  { min: 642, max: 3642, rate: 17.5 },
  { min: 3642, max: 20037, rate: 25 },
  { min: 20037, max: Infinity, rate: 30 },
];

function calcBracketTax(gross: number, brackets: TaxBracket[]): number {
  let tax = 0;
  let remaining = gross;
  for (const b of brackets) {
    const width = b.max === Infinity ? remaining : b.max - b.min;
    const taxable = Math.min(remaining, width);
    if (taxable <= 0) break;
    tax += taxable * (b.rate / 100);
    remaining -= taxable;
  }
  return Math.round(tax * 100) / 100;
}

const GHANA_CONFIG: CountryTaxConfig = {
  country: "Ghana",
  currency: "GHS",
  deductions: [
    {
      name: "PAYE (Income Tax)",
      type: "tax",
      calculate: (gross) => ({ employee: calcBracketTax(gross, GHANA_TAX_BRACKETS), employer: 0 }),
    },
    {
      name: "SSNIT (Tier 1)",
      type: "social_security",
      employeeRate: 5.5,
      employerRate: 13,
      calculate: (gross) => ({
        employee: Math.round(gross * 0.055 * 100) / 100,
        employer: Math.round(gross * 0.13 * 100) / 100,
      }),
    },
    {
      name: "SSNIT (Tier 2)",
      type: "pension",
      employeeRate: 5,
      employerRate: 0,
      calculate: (gross) => ({
        employee: Math.round(gross * 0.05 * 100) / 100,
        employer: 0,
      }),
    },
  ],
};

// ─── Nigeria ────────────────────────────────────────────────────────

const NIGERIA_CONFIG: CountryTaxConfig = {
  country: "Nigeria",
  currency: "NGN",
  deductions: [
    {
      name: "PAYE",
      type: "tax",
      calculate: (gross) => {
        const annual = gross * 12;
        let tax = 0;
        let remaining = annual;
        const brackets = [
          { limit: 300000, rate: 7 },
          { limit: 300000, rate: 11 },
          { limit: 500000, rate: 15 },
          { limit: 500000, rate: 19 },
          { limit: 1600000, rate: 21 },
          { limit: Infinity, rate: 24 },
        ];
        for (const b of brackets) {
          const taxable = Math.min(remaining, b.limit);
          if (taxable <= 0) break;
          tax += taxable * (b.rate / 100);
          remaining -= taxable;
        }
        return { employee: Math.round((tax / 12) * 100) / 100, employer: 0 };
      },
    },
    {
      name: "Pension",
      type: "pension",
      employeeRate: 8,
      employerRate: 10,
      calculate: (gross) => ({
        employee: Math.round(gross * 0.08 * 100) / 100,
        employer: Math.round(gross * 0.10 * 100) / 100,
      }),
    },
  ],
};

// ─── Kenya ──────────────────────────────────────────────────────────

const KENYA_CONFIG: CountryTaxConfig = {
  country: "Kenya",
  currency: "KES",
  deductions: [
    {
      name: "PAYE",
      type: "tax",
      calculate: (gross) => {
        let tax = 0;
        let remaining = gross;
        const brackets = [
          { limit: 24000, rate: 10 },
          { limit: 8333, rate: 25 },
          { limit: Infinity, rate: 30 },
        ];
        for (const b of brackets) {
          const taxable = Math.min(remaining, b.limit);
          if (taxable <= 0) break;
          tax += taxable * (b.rate / 100);
          remaining -= taxable;
        }
        return { employee: Math.max(0, Math.round((tax - 2400) * 100) / 100), employer: 0 };
      },
    },
    {
      name: "NSSF",
      type: "social_security",
      employeeRate: 6,
      employerRate: 6,
      calculate: (gross) => {
        const base = Math.min(gross, 18000);
        return {
          employee: Math.round(base * 0.06 * 100) / 100,
          employer: Math.round(base * 0.06 * 100) / 100,
        };
      },
    },
  ],
};

// ─── Registry ───────────────────────────────────────────────────────
// Fallback registry backed by the hardcoded constants. Used when the DB is
// empty or has not been warmed up.

const FALLBACK_CONFIGS = new Map<string, CountryTaxConfig>([
  ["GH", GHANA_CONFIG],
  ["NG", NIGERIA_CONFIG],
  ["KE", KENYA_CONFIG],
]);

/** Cache populated by warmupTaxConfigs(). When empty, we read from fallback. */
let DB_CONFIGS: Map<string, CountryTaxConfig> | null = null;

/**
 * Load the active tax configurations from the database into the in-memory
 * cache. Safe to call multiple times; idempotent. Server code that wants
 * DB-backed rates should await this once at boot. Callers that don't wait
 * (or where the DB is unreachable) fall back to the in-file constants.
 */
export async function warmupTaxConfigs(): Promise<void> {
  // Dynamic import to keep this module usable in unit tests that mock `@/lib/db`
  // and also in environments without a DB (CI guards).
  const { db } = await import("@/lib/db");
  const now = new Date();
  try {
    const rows = await db.taxTable.findMany({
      where: {
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: [{ country: "asc" }, { orderIndex: "asc" }],
    });
    if (rows.length === 0) {
      DB_CONFIGS = null; // keep using fallback
      return;
    }
    const next = new Map<string, CountryTaxConfig>();
    for (const row of rows) {
      const country = row.country;
      const cfg = next.get(country) ?? {
        country,
        currency: country === "GH" ? "GHS" : country === "NG" ? "NGN" : country === "KE" ? "KES" : country,
        deductions: [],
      };
      cfg.deductions.push(rowToDeduction(row));
      next.set(country, cfg);
    }
    DB_CONFIGS = next;
  } catch (err) {
    // DB unreachable — stay on fallback without throwing.
    console.warn("[tax-tables] DB warmup failed, using hardcoded fallback:", err);
    DB_CONFIGS = null;
  }
}

export function invalidateTaxCache(): void {
  DB_CONFIGS = null;
}

type TaxTableRow = {
  country: string;
  name: string;
  type: "INCOME_TAX" | "SOCIAL_SECURITY" | "PENSION" | "OTHER";
  employeeRate: { toString(): string } | null;
  employerRate: { toString(): string } | null;
  ceilingAmount: { toString(): string } | null;
  brackets: unknown;
  annualized: boolean;
  relief: { toString(): string } | null;
};

function rowToDeduction(row: TaxTableRow): StatutoryDeduction {
  const typeMap: Record<TaxTableRow["type"], StatutoryDeduction["type"]> = {
    INCOME_TAX: "tax",
    SOCIAL_SECURITY: "social_security",
    PENSION: "pension",
    OTHER: "other",
  };
  const eeRate = row.employeeRate !== null ? Number(row.employeeRate) : undefined;
  const erRate = row.employerRate !== null ? Number(row.employerRate) : undefined;
  const ceiling = row.ceilingAmount !== null ? Number(row.ceilingAmount) : undefined;
  const relief = row.relief !== null ? Number(row.relief) : undefined;
  const brackets = row.brackets as
    | Array<{ min?: number; max?: number | null; limit?: number | null; rate: number }>
    | null;

  // Flat-rate deductions with a ceiling (NSSF) or without (SSNIT, Pension).
  if (brackets === null) {
    return {
      name: row.name,
      type: typeMap[row.type],
      employeeRate: eeRate,
      employerRate: erRate,
      calculate: (gross) => {
        const base = ceiling !== undefined ? Math.min(gross, ceiling) : gross;
        return {
          employee: eeRate ? Math.round(base * (eeRate / 100) * 100) / 100 : 0,
          employer: erRate ? Math.round(base * (erRate / 100) * 100) / 100 : 0,
        };
      },
    };
  }

  // Bracket-based deduction. Two shapes are supported:
  //   - width-style: [{limit, rate}] (Nigeria, Kenya)
  //   - absolute:    [{min, max, rate}] (Ghana)
  return {
    name: row.name,
    type: typeMap[row.type],
    calculate: (gross) => {
      const incomeForTax = row.annualized ? gross * 12 : gross;
      let tax = 0;
      let remaining = incomeForTax;
      for (const b of brackets) {
        const isWidth = "limit" in b;
        const width = isWidth
          ? b.limit === null || b.limit === undefined
            ? remaining
            : b.limit
          : b.max === null || b.max === undefined
            ? remaining
            : (b.max ?? 0) - (b.min ?? 0);
        const taxable = Math.min(remaining, width);
        if (taxable <= 0) break;
        tax += taxable * (b.rate / 100);
        remaining -= taxable;
      }
      if (row.annualized) tax = tax / 12;
      if (relief !== undefined) tax = Math.max(0, tax - relief);
      return { employee: Math.round(tax * 100) / 100, employer: 0 };
    },
  };
}

export function getTaxConfig(countryCode: string): CountryTaxConfig | undefined {
  if (DB_CONFIGS?.has(countryCode)) return DB_CONFIGS.get(countryCode);
  return FALLBACK_CONFIGS.get(countryCode);
}

export function getAvailableCountries(): string[] {
  if (DB_CONFIGS && DB_CONFIGS.size > 0) return [...DB_CONFIGS.keys()];
  return [...FALLBACK_CONFIGS.keys()];
}

export function calculateStatutoryDeductions(
  countryCode: string,
  grossSalary: number,
): {
  deductions: Array<{ name: string; type: string; employee: number; employer: number }>;
  totalEmployee: number;
  totalEmployer: number;
  netSalary: number;
} {
  const config = getTaxConfig(countryCode);
  if (!config) {
    return { deductions: [], totalEmployee: 0, totalEmployer: 0, netSalary: grossSalary };
  }

  const deductions = config.deductions.map((d) => {
    const amounts = d.calculate(grossSalary);
    return { name: d.name, type: d.type, ...amounts };
  });

  const totalEmployee = deductions.reduce((s, d) => s + d.employee, 0);
  const totalEmployer = deductions.reduce((s, d) => s + d.employer, 0);

  return {
    deductions,
    totalEmployee: Math.round(totalEmployee * 100) / 100,
    totalEmployer: Math.round(totalEmployer * 100) / 100,
    netSalary: Math.round((grossSalary - totalEmployee) * 100) / 100,
  };
}
