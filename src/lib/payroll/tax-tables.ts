/**
 * Tax calculation tables for multiple countries.
 * Extensible system for statutory deductions (tax, social security, pension).
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

const TAX_CONFIGS = new Map<string, CountryTaxConfig>([
  ["GH", GHANA_CONFIG],
  ["NG", NIGERIA_CONFIG],
  ["KE", KENYA_CONFIG],
]);

export function getTaxConfig(countryCode: string): CountryTaxConfig | undefined {
  return TAX_CONFIGS.get(countryCode);
}

export function getAvailableCountries(): string[] {
  return [...TAX_CONFIGS.keys()];
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
  const config = TAX_CONFIGS.get(countryCode);
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
