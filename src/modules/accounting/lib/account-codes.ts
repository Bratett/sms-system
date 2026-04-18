/**
 * Canonical Ghana public-sector / IPSAS-aligned account codes used across the system.
 * Keep in sync with src/modules/accounting/seed/ghana-public-sector-coa.ts.
 *
 * Call sites should NEVER stringly-type account codes — import from here.
 */

export const ACCOUNTS = {
  // ── Assets (1xxx) ──────────────────────────────────────────────
  CASH_ON_HAND: "1101",
  BANK_GCB: "1121",
  BANK_ECOBANK: "1122",
  BANK_STANBIC: "1123",
  MOMO_MTN: "1131",
  MOMO_VODAFONE: "1132",
  MOMO_AIRTELTIGO: "1133",
  PETTY_CASH: "1141",
  FEES_RECEIVABLE: "1401",
  ALLOWANCE_DOUBTFUL_RECEIVABLES: "1402", // contra-asset
  GRANTS_RECEIVABLE: "1410",
  STAFF_ADVANCES: "1420",
  INVENTORY_SUPPLIES: "1501",
  PPE: "1701",
  ACCUMULATED_DEPRECIATION: "1710", // contra-asset

  // ── Liabilities (2xxx) ─────────────────────────────────────────
  ACCOUNTS_PAYABLE: "2101",
  ACCRUED_EXPENSES: "2110",
  SALARIES_PAYABLE: "2120",
  PAYE_PAYABLE: "2210",
  SSNIT_PAYABLE: "2220",
  TIER2_PAYABLE: "2230",
  WITHHOLDING_TAX_PAYABLE: "2240",
  VAT_PAYABLE: "2250",
  NHIL_PAYABLE: "2260",
  GETFUND_PAYABLE: "2270",
  DEFERRED_GRANTS: "2501", // IPSAS 23 — conditional grants
  PREPAID_FEES: "2502", // fees collected in advance

  // ── Net Assets / Equity (3xxx) ─────────────────────────────────
  ACCUMULATED_SURPLUS: "3101",
  RESERVES: "3201",
  FUND_BALANCE_GENERAL: "3301",
  FUND_BALANCE_RESTRICTED: "3302",
  FUND_BALANCE_CAPITAL: "3303",
  INCOME_SUMMARY: "3900", // clearing account used only during year-end close

  // ── Revenue (4xxx) ─────────────────────────────────────────────
  FEE_REVENUE_TUITION: "4010",
  FEE_REVENUE_BOARDING: "4020",
  FEE_REVENUE_PTA: "4030",
  FEE_REVENUE_EXAM: "4040",
  FEE_REVENUE_UNIFORM: "4050",
  FEE_REVENUE_OTHER: "4090",
  PENALTY_REVENUE: "4210",
  GRANT_REVENUE_UNCONDITIONAL: "4310",
  GRANT_REVENUE_CONDITIONAL: "4320",
  DONOR_REVENUE_RESTRICTED: "4410",
  DONOR_REVENUE_UNRESTRICTED: "4420",
  INVESTMENT_INCOME: "4510",
  OTHER_INCOME: "4590",

  // ── Expenses (5xxx) ────────────────────────────────────────────
  EXPENSE_SALARIES: "5110",
  EXPENSE_ALLOWANCES: "5120",
  EXPENSE_SSNIT_EMPLOYER: "5130",
  EXPENSE_TIER2_EMPLOYER: "5140",
  EXPENSE_TRAINING: "5150",
  EXPENSE_UTILITIES_ELECTRICITY: "5210",
  EXPENSE_UTILITIES_WATER: "5220",
  EXPENSE_UTILITIES_INTERNET: "5230",
  EXPENSE_SUPPLIES: "5240",
  EXPENSE_REPAIRS: "5250",
  EXPENSE_TRANSPORT: "5260",
  EXPENSE_FEEDING: "5270",
  EXPENSE_STATIONERY: "5280",
  EXPENSE_INSURANCE: "5290",
  EXPENSE_BANK_CHARGES: "5310",
  EXPENSE_DEPRECIATION: "5410",
  EXPENSE_FEE_WAIVER: "5810",
  EXPENSE_SCHOLARSHIP: "5820",
  EXPENSE_BAD_DEBT: "5910",
  EXPENSE_MISC: "5990",

  // ── Budgetary (9xxx) ───────────────────────────────────────────
  ENCUMBRANCES: "9100",
  RESERVE_FOR_ENCUMBRANCES: "9200",
} as const;

export type AccountCode = (typeof ACCOUNTS)[keyof typeof ACCOUNTS];

/**
 * Map operational payment methods to the Cash/Bank/MoMo account code to debit
 * when cash is received (or credit when cash is disbursed).
 */
export function accountCodeForPaymentMethod(method: string): AccountCode {
  switch (method) {
    case "CASH":
      return ACCOUNTS.CASH_ON_HAND;
    case "BANK_TRANSFER":
    case "CHEQUE":
      return ACCOUNTS.BANK_GCB;
    case "MOBILE_MONEY":
      return ACCOUNTS.MOMO_MTN;
    default:
      return ACCOUNTS.CASH_ON_HAND;
  }
}

/**
 * Heuristic mapping from fee item name → revenue account code. Falls back to
 * generic tuition revenue if no match. Schools can extend this by adding a
 * `revenueAccountCode` column on FeeItem later.
 */
export function feeRevenueAccountCode(feeItemName: string): AccountCode {
  const n = feeItemName.toLowerCase();
  if (n.includes("boarding") || n.includes("hostel") || n.includes("feeding")) return ACCOUNTS.FEE_REVENUE_BOARDING;
  if (n.includes("pta")) return ACCOUNTS.FEE_REVENUE_PTA;
  if (n.includes("exam") || n.includes("waec") || n.includes("beace")) return ACCOUNTS.FEE_REVENUE_EXAM;
  if (n.includes("uniform") || n.includes("book")) return ACCOUNTS.FEE_REVENUE_UNIFORM;
  if (n.includes("tuition") || n.includes("school fee") || n.includes("academic")) return ACCOUNTS.FEE_REVENUE_TUITION;
  return ACCOUNTS.FEE_REVENUE_OTHER;
}
