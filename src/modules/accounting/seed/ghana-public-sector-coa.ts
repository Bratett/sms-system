import type { Prisma, AccountType, BalanceSide, FundType } from "@prisma/client";

/**
 * Idempotent Ghana public-sector Chart of Accounts seeder.
 *
 * Conforms to IPSAS classification (Assets / Liabilities / Net Assets / Revenue /
 * Expenses) and adds a BUDGETARY bucket for encumbrance control (IPSAS 24).
 * Expense codes follow the Ghana Integrated Financial Management Information
 * System (GIFMIS) economic classification: Compensation of Employees,
 * Goods & Services, Subsidies & Grants, Consumption of Fixed Capital.
 *
 * Safe to call multiple times — existing categories, accounts, and funds are
 * preserved; only missing rows are created. Returns counts for diagnostics.
 */
export async function seedGhanaPublicSectorCoa(
  tx: Prisma.TransactionClient,
  schoolId: string,
): Promise<{ categoriesCreated: number; accountsCreated: number; fundsCreated: number }> {
  const categorySpec: Array<{ name: string; type: AccountType; sortOrder: number }> = [
    { name: "Assets", type: "ASSET", sortOrder: 1 },
    { name: "Liabilities", type: "LIABILITY", sortOrder: 2 },
    { name: "Net Assets / Equity", type: "EQUITY", sortOrder: 3 },
    { name: "Revenue", type: "REVENUE", sortOrder: 4 },
    { name: "Expenses", type: "EXPENSE", sortOrder: 5 },
    { name: "Budgetary Control", type: "BUDGETARY", sortOrder: 9 },
  ];

  let categoriesCreated = 0;
  const categoryIds = new Map<AccountType, string>();
  for (const spec of categorySpec) {
    const existing = await tx.accountCategory.findFirst({
      where: { schoolId, type: spec.type },
      select: { id: true },
    });
    if (existing) {
      categoryIds.set(spec.type, existing.id);
      continue;
    }
    const created = await tx.accountCategory.create({
      data: { schoolId, name: spec.name, type: spec.type, sortOrder: spec.sortOrder },
    });
    categoryIds.set(spec.type, created.id);
    categoriesCreated += 1;
  }

  type AccountSpec = {
    code: string;
    name: string;
    type: AccountType;
    normalBalance: BalanceSide;
    isContra?: boolean;
    isBudgetary?: boolean;
    description?: string;
  };

  const accounts: AccountSpec[] = [
    // Assets
    { code: "1101", name: "Cash on Hand", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1121", name: "Bank - GCB", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1122", name: "Bank - Ecobank", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1123", name: "Bank - Stanbic", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1131", name: "Mobile Money - MTN", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1132", name: "Mobile Money - Vodafone/Telecel", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1133", name: "Mobile Money - AirtelTigo", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1141", name: "Petty Cash", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1401", name: "Student Fees Receivable", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1402", name: "Allowance for Doubtful Receivables", type: "ASSET", normalBalance: "CREDIT", isContra: true, description: "Contra-asset, IPSAS 29/41 expected credit loss" },
    { code: "1410", name: "Government Grants Receivable", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1420", name: "Staff Advances", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1501", name: "Inventory - Supplies", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1701", name: "Property, Plant & Equipment", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1710", name: "Accumulated Depreciation", type: "ASSET", normalBalance: "CREDIT", isContra: true },

    // Liabilities
    { code: "2101", name: "Accounts Payable", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "2110", name: "Accrued Expenses", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "2120", name: "Salaries Payable", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "2210", name: "PAYE Payable (GRA)", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "2220", name: "SSNIT Payable", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "2230", name: "Tier 2 Pension Payable", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "2240", name: "Withholding Tax Payable", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "2250", name: "VAT Payable", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "2260", name: "NHIL Payable", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "2270", name: "GETFund Levy Payable", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "2501", name: "Deferred Inflows - Grants (IPSAS 23)", type: "LIABILITY", normalBalance: "CREDIT", description: "Conditional grants pending satisfaction of conditions" },
    { code: "2502", name: "Prepaid Fees (Advance Collections)", type: "LIABILITY", normalBalance: "CREDIT" },

    // Net Assets / Equity
    { code: "3101", name: "Accumulated Surplus / (Deficit)", type: "EQUITY", normalBalance: "CREDIT" },
    { code: "3201", name: "Reserves", type: "EQUITY", normalBalance: "CREDIT" },
    { code: "3301", name: "General Fund Balance", type: "EQUITY", normalBalance: "CREDIT" },
    { code: "3302", name: "Restricted Fund Balance", type: "EQUITY", normalBalance: "CREDIT" },
    { code: "3303", name: "Capital Fund Balance", type: "EQUITY", normalBalance: "CREDIT" },
    { code: "3900", name: "Income Summary (Year-End Close Clearing)", type: "EQUITY", normalBalance: "CREDIT", description: "Used only during fiscal year close" },

    // Revenue
    { code: "4010", name: "Tuition Fees", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "4020", name: "Boarding & Feeding Fees", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "4030", name: "PTA Dues", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "4040", name: "Examination Fees", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "4050", name: "Uniforms & Books", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "4090", name: "Other Fee Revenue", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "4210", name: "Late Payment Penalties", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "4310", name: "Government Grants - Unconditional", type: "REVENUE", normalBalance: "CREDIT", description: "Free SHS, Capitation Grant" },
    { code: "4320", name: "Government Grants - Conditional (Released)", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "4410", name: "Donor Contributions - Restricted", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "4420", name: "Donor Contributions - Unrestricted", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "4510", name: "Investment Income", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "4590", name: "Other Income", type: "REVENUE", normalBalance: "CREDIT" },

    // Expenses (GIFMIS economic classification)
    { code: "5110", name: "Salaries & Wages", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5120", name: "Allowances", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5130", name: "SSNIT - Employer Contribution", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5140", name: "Tier 2 - Employer Contribution", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5150", name: "Training & Development", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5210", name: "Utilities - Electricity", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5220", name: "Utilities - Water", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5230", name: "Utilities - Internet & Communications", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5240", name: "Teaching & Office Supplies", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5250", name: "Repairs & Maintenance", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5260", name: "Transport & Vehicle Running", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5270", name: "Feeding & Catering", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5280", name: "Stationery & Printing", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5290", name: "Insurance", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5310", name: "Bank Charges", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5410", name: "Depreciation Expense", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5810", name: "Fee Waiver Expense", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5820", name: "Scholarship Expense", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5910", name: "Bad Debt Expense", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5990", name: "Miscellaneous Expenses", type: "EXPENSE", normalBalance: "DEBIT" },

    // Budgetary (encumbrance control — excluded from proprietary statements)
    { code: "9100", name: "Encumbrances", type: "BUDGETARY", normalBalance: "DEBIT", isBudgetary: true },
    { code: "9200", name: "Reserve for Encumbrances", type: "BUDGETARY", normalBalance: "CREDIT", isBudgetary: true },
  ];

  let accountsCreated = 0;
  for (const spec of accounts) {
    const exists = await tx.account.findUnique({
      where: { schoolId_code: { schoolId, code: spec.code } },
      select: { id: true },
    });
    if (exists) continue;
    await tx.account.create({
      data: {
        schoolId,
        categoryId: categoryIds.get(spec.type)!,
        code: spec.code,
        name: spec.name,
        normalBalance: spec.normalBalance,
        description: spec.description ?? null,
        isContra: spec.isContra ?? false,
        isBudgetary: spec.isBudgetary ?? false,
        isSystemAccount: true,
      },
    });
    accountsCreated += 1;
  }

  // Seed default funds
  const fundSpec: Array<{ code: string; name: string; type: FundType; isDefault: boolean; description?: string }> = [
    { code: "GEN", name: "General Fund", type: "GENERAL", isDefault: true, description: "Default operating fund for unrestricted activity" },
    { code: "CAP", name: "Capital Fund", type: "CAPITAL", isDefault: false, description: "Funds restricted to capital acquisition" },
    { code: "RES", name: "Restricted Fund", type: "RESTRICTED", isDefault: false, description: "Donor- or grant-restricted activity" },
  ];

  let fundsCreated = 0;
  for (const spec of fundSpec) {
    const exists = await tx.fund.findUnique({
      where: { schoolId_code: { schoolId, code: spec.code } },
      select: { id: true },
    });
    if (exists) continue;
    await tx.fund.create({
      data: {
        schoolId,
        code: spec.code,
        name: spec.name,
        type: spec.type,
        isDefault: spec.isDefault,
        description: spec.description,
      },
    });
    fundsCreated += 1;
  }

  return { categoriesCreated, accountsCreated, fundsCreated };
}
