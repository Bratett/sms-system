/**
 * Finance Module Seed Script
 *
 * Seeds default data for the enterprise financial module:
 * - Chart of Accounts (Ghana-standard)
 * - Expense Categories
 * - Asset Categories
 *
 * Run: npx tsx prisma/seed-finance.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Starting finance module seed...\n");

  // Find the school
  const school = await db.school.findFirst();
  if (!school) {
    console.error("No school found. Please create a school first.");
    process.exit(1);
  }
  console.log(`School: ${school.name} (${school.id})\n`);

  // ─── 1. Chart of Accounts ──────────────────────────────────────
  const existingCategories = await db.accountCategory.count({ where: { schoolId: school.id } });
  if (existingCategories > 0) {
    console.log(`Chart of Accounts: Already seeded (${existingCategories} categories). Skipping.`);
  } else {
    console.log("Seeding Chart of Accounts (Ghana-standard)...");

    const chartOfAccounts = [
      {
        name: "Assets", type: "ASSET" as const, sortOrder: 1, accounts: [
          { code: "1000", name: "Cash on Hand", normalBalance: "DEBIT" as const },
          { code: "1010", name: "Bank - GCB", normalBalance: "DEBIT" as const },
          { code: "1020", name: "Bank - Ecobank", normalBalance: "DEBIT" as const },
          { code: "1030", name: "Mobile Money Accounts", normalBalance: "DEBIT" as const },
          { code: "1040", name: "Bank - Stanbic", normalBalance: "DEBIT" as const },
          { code: "1100", name: "Accounts Receivable - Fees", normalBalance: "DEBIT" as const },
          { code: "1110", name: "Accounts Receivable - Government", normalBalance: "DEBIT" as const },
          { code: "1200", name: "Prepaid Expenses", normalBalance: "DEBIT" as const },
          { code: "1300", name: "Inventory - Supplies", normalBalance: "DEBIT" as const },
          { code: "1310", name: "Inventory - Food Stores", normalBalance: "DEBIT" as const },
          { code: "1500", name: "Fixed Assets - Furniture", normalBalance: "DEBIT" as const },
          { code: "1510", name: "Fixed Assets - ICT Equipment", normalBalance: "DEBIT" as const },
          { code: "1520", name: "Fixed Assets - Vehicles", normalBalance: "DEBIT" as const },
          { code: "1530", name: "Fixed Assets - Buildings", normalBalance: "DEBIT" as const },
          { code: "1540", name: "Fixed Assets - Lab Equipment", normalBalance: "DEBIT" as const },
          { code: "1600", name: "Accumulated Depreciation", normalBalance: "CREDIT" as const },
        ],
      },
      {
        name: "Liabilities", type: "LIABILITY" as const, sortOrder: 2, accounts: [
          { code: "2000", name: "Accounts Payable", normalBalance: "CREDIT" as const },
          { code: "2010", name: "Accounts Payable - Suppliers", normalBalance: "CREDIT" as const },
          { code: "2100", name: "Salaries Payable", normalBalance: "CREDIT" as const },
          { code: "2200", name: "SSNIT Payable", normalBalance: "CREDIT" as const },
          { code: "2210", name: "Tier 2 Pension Payable", normalBalance: "CREDIT" as const },
          { code: "2300", name: "Tax Payable - PAYE", normalBalance: "CREDIT" as const },
          { code: "2310", name: "Tax Payable - WHT", normalBalance: "CREDIT" as const },
          { code: "2400", name: "Fees Received in Advance", normalBalance: "CREDIT" as const },
          { code: "2500", name: "Government Subsidy Payable", normalBalance: "CREDIT" as const },
          { code: "2600", name: "Accrued Expenses", normalBalance: "CREDIT" as const },
        ],
      },
      {
        name: "Equity", type: "EQUITY" as const, sortOrder: 3, accounts: [
          { code: "3000", name: "School Fund Balance", normalBalance: "CREDIT" as const },
          { code: "3100", name: "Retained Surplus", normalBalance: "CREDIT" as const },
          { code: "3200", name: "Capital Reserves", normalBalance: "CREDIT" as const },
        ],
      },
      {
        name: "Revenue", type: "REVENUE" as const, sortOrder: 4, accounts: [
          { code: "4000", name: "Tuition Fees", normalBalance: "CREDIT" as const },
          { code: "4010", name: "Boarding Fees", normalBalance: "CREDIT" as const },
          { code: "4020", name: "PTA Dues", normalBalance: "CREDIT" as const },
          { code: "4030", name: "Examination Fees", normalBalance: "CREDIT" as const },
          { code: "4040", name: "Extracurricular Fees", normalBalance: "CREDIT" as const },
          { code: "4050", name: "Admission Fees", normalBalance: "CREDIT" as const },
          { code: "4100", name: "Government Subsidies - Free SHS", normalBalance: "CREDIT" as const },
          { code: "4110", name: "Capitation Grants", normalBalance: "CREDIT" as const },
          { code: "4120", name: "Government Placement Grants", normalBalance: "CREDIT" as const },
          { code: "4200", name: "Donations & Grants", normalBalance: "CREDIT" as const },
          { code: "4210", name: "Alumni Contributions", normalBalance: "CREDIT" as const },
          { code: "4300", name: "Interest Income", normalBalance: "CREDIT" as const },
          { code: "4400", name: "Rental Income", normalBalance: "CREDIT" as const },
          { code: "4900", name: "Other Income", normalBalance: "CREDIT" as const },
        ],
      },
      {
        name: "Expenses", type: "EXPENSE" as const, sortOrder: 5, accounts: [
          { code: "5000", name: "Salaries & Wages - Teaching Staff", normalBalance: "DEBIT" as const },
          { code: "5010", name: "Salaries & Wages - Non-Teaching Staff", normalBalance: "DEBIT" as const },
          { code: "5020", name: "SSNIT Contributions (Employer)", normalBalance: "DEBIT" as const },
          { code: "5030", name: "Tier 2 Pension (Employer)", normalBalance: "DEBIT" as const },
          { code: "5100", name: "Teaching Materials & Textbooks", normalBalance: "DEBIT" as const },
          { code: "5110", name: "Laboratory Supplies", normalBalance: "DEBIT" as const },
          { code: "5120", name: "Library Resources", normalBalance: "DEBIT" as const },
          { code: "5200", name: "Utilities - Electricity (ECG)", normalBalance: "DEBIT" as const },
          { code: "5210", name: "Utilities - Water (GWCL)", normalBalance: "DEBIT" as const },
          { code: "5220", name: "Internet & Communication", normalBalance: "DEBIT" as const },
          { code: "5300", name: "Feeding & Catering", normalBalance: "DEBIT" as const },
          { code: "5310", name: "Kitchen Supplies", normalBalance: "DEBIT" as const },
          { code: "5400", name: "Maintenance & Repairs - Buildings", normalBalance: "DEBIT" as const },
          { code: "5410", name: "Maintenance & Repairs - Equipment", normalBalance: "DEBIT" as const },
          { code: "5420", name: "Maintenance & Repairs - Vehicles", normalBalance: "DEBIT" as const },
          { code: "5500", name: "Transport & Travel", normalBalance: "DEBIT" as const },
          { code: "5510", name: "Vehicle Fuel", normalBalance: "DEBIT" as const },
          { code: "5600", name: "Stationery & Office Supplies", normalBalance: "DEBIT" as const },
          { code: "5610", name: "Printing & Photocopying", normalBalance: "DEBIT" as const },
          { code: "5700", name: "Depreciation Expense", normalBalance: "DEBIT" as const },
          { code: "5800", name: "Insurance", normalBalance: "DEBIT" as const },
          { code: "5810", name: "Security Services", normalBalance: "DEBIT" as const },
          { code: "5820", name: "Cleaning & Sanitation", normalBalance: "DEBIT" as const },
          { code: "5900", name: "Bank Charges & Fees", normalBalance: "DEBIT" as const },
          { code: "5910", name: "Professional & Legal Fees", normalBalance: "DEBIT" as const },
          { code: "5920", name: "Training & Development", normalBalance: "DEBIT" as const },
          { code: "5930", name: "Sports & Cocurricular", normalBalance: "DEBIT" as const },
          { code: "5940", name: "Examination Expenses", normalBalance: "DEBIT" as const },
          { code: "5950", name: "Miscellaneous Expenses", normalBalance: "DEBIT" as const },
        ],
      },
    ];

    let accountCount = 0;
    for (const cat of chartOfAccounts) {
      const category = await db.accountCategory.create({
        data: { schoolId: school.id, name: cat.name, type: cat.type, sortOrder: cat.sortOrder },
      });
      for (const acc of cat.accounts) {
        await db.account.create({
          data: {
            schoolId: school.id,
            categoryId: category.id,
            code: acc.code,
            name: acc.name,
            normalBalance: acc.normalBalance,
            isSystemAccount: true,
          },
        });
        accountCount++;
      }
    }
    console.log(`  Created 5 categories with ${accountCount} accounts.`);
  }

  // ─── 2. Expense Categories ─────────────────────────────────────
  const existingExpenseCategories = await db.expenseCategory.count({ where: { schoolId: school.id } });
  if (existingExpenseCategories > 0) {
    console.log(`\nExpense Categories: Already seeded (${existingExpenseCategories} categories). Skipping.`);
  } else {
    console.log("\nSeeding Expense Categories...");

    const expenseCategories = [
      {
        name: "Personnel", code: "PER", children: [
          { name: "Teaching Staff Salaries", code: "PER-TS" },
          { name: "Non-Teaching Staff Salaries", code: "PER-NTS" },
          { name: "Allowances & Overtime", code: "PER-ALW" },
          { name: "SSNIT & Pension", code: "PER-SSN" },
        ],
      },
      {
        name: "Academic", code: "ACA", children: [
          { name: "Textbooks & Teaching Aids", code: "ACA-TXT" },
          { name: "Laboratory Supplies", code: "ACA-LAB" },
          { name: "Library Books & Resources", code: "ACA-LIB" },
          { name: "Examination Costs", code: "ACA-EXM" },
          { name: "ICT & Digital Resources", code: "ACA-ICT" },
        ],
      },
      {
        name: "Utilities", code: "UTL", children: [
          { name: "Electricity (ECG)", code: "UTL-ECG" },
          { name: "Water (GWCL)", code: "UTL-WAT" },
          { name: "Internet & Telephone", code: "UTL-NET" },
        ],
      },
      {
        name: "Feeding & Catering", code: "FED", children: [
          { name: "Food Supplies", code: "FED-FOD" },
          { name: "Kitchen Equipment", code: "FED-KIT" },
          { name: "Catering Services", code: "FED-CAT" },
        ],
      },
      {
        name: "Maintenance & Repairs", code: "MNT", children: [
          { name: "Building Maintenance", code: "MNT-BLD" },
          { name: "Equipment Repairs", code: "MNT-EQP" },
          { name: "Vehicle Maintenance", code: "MNT-VEH" },
          { name: "Grounds & Landscaping", code: "MNT-GRD" },
        ],
      },
      {
        name: "Transport", code: "TRN", children: [
          { name: "Fuel", code: "TRN-FUL" },
          { name: "Vehicle Insurance", code: "TRN-INS" },
          { name: "Staff Travel", code: "TRN-TRV" },
        ],
      },
      {
        name: "Administration", code: "ADM", children: [
          { name: "Stationery & Office Supplies", code: "ADM-STN" },
          { name: "Printing & Photocopying", code: "ADM-PRT" },
          { name: "Postage & Communication", code: "ADM-PST" },
          { name: "Professional & Legal Fees", code: "ADM-PRO" },
          { name: "Bank Charges", code: "ADM-BNK" },
        ],
      },
      {
        name: "Student Welfare", code: "SWF", children: [
          { name: "Sports & Cocurricular", code: "SWF-SPR" },
          { name: "Medical & First Aid", code: "SWF-MED" },
          { name: "Counseling Services", code: "SWF-CSL" },
          { name: "Awards & Prizes", code: "SWF-AWD" },
        ],
      },
      {
        name: "Security & Safety", code: "SEC", children: [
          { name: "Security Services", code: "SEC-SRV" },
          { name: "Safety Equipment", code: "SEC-EQP" },
          { name: "Insurance Premiums", code: "SEC-INS" },
        ],
      },
      {
        name: "Capital & Development", code: "CAP", children: [
          { name: "Building Projects", code: "CAP-BLD" },
          { name: "Equipment Purchases", code: "CAP-EQP" },
          { name: "ICT Infrastructure", code: "CAP-ICT" },
        ],
      },
    ];

    let catCount = 0;
    for (const cat of expenseCategories) {
      const parent = await db.expenseCategory.create({
        data: { schoolId: school.id, name: cat.name, code: cat.code },
      });
      catCount++;
      for (const child of cat.children) {
        await db.expenseCategory.create({
          data: { schoolId: school.id, name: child.name, code: child.code, parentId: parent.id },
        });
        catCount++;
      }
    }
    console.log(`  Created ${catCount} expense categories (${expenseCategories.length} parent + ${catCount - expenseCategories.length} children).`);
  }

  // ─── 3. Asset Categories ───────────────────────────────────────
  const existingAssetCategories = await db.assetCategory.count({ where: { schoolId: school.id } });
  if (existingAssetCategories > 0) {
    console.log(`\nAsset Categories: Already seeded (${existingAssetCategories} categories). Skipping.`);
  } else {
    console.log("\nSeeding Asset Categories...");

    const assetCategories = [
      { name: "Furniture & Fittings", code: "FUR", defaultUsefulLife: 10, defaultDepreciationMethod: "STRAIGHT_LINE" as const },
      { name: "ICT Equipment", code: "ICT", defaultUsefulLife: 5, defaultDepreciationMethod: "REDUCING_BALANCE" as const },
      { name: "Vehicles", code: "VEH", defaultUsefulLife: 8, defaultDepreciationMethod: "REDUCING_BALANCE" as const },
      { name: "Buildings & Structures", code: "BLD", defaultUsefulLife: 40, defaultDepreciationMethod: "STRAIGHT_LINE" as const },
      { name: "Laboratory Equipment", code: "LAB", defaultUsefulLife: 7, defaultDepreciationMethod: "STRAIGHT_LINE" as const },
      { name: "Sports Equipment", code: "SPT", defaultUsefulLife: 5, defaultDepreciationMethod: "STRAIGHT_LINE" as const },
      { name: "Kitchen & Catering Equipment", code: "KIT", defaultUsefulLife: 8, defaultDepreciationMethod: "STRAIGHT_LINE" as const },
      { name: "Electrical & Plumbing", code: "ELP", defaultUsefulLife: 10, defaultDepreciationMethod: "STRAIGHT_LINE" as const },
      { name: "Musical Instruments", code: "MUS", defaultUsefulLife: 10, defaultDepreciationMethod: "STRAIGHT_LINE" as const },
      { name: "Office Equipment", code: "OFC", defaultUsefulLife: 7, defaultDepreciationMethod: "STRAIGHT_LINE" as const },
      { name: "Library Resources", code: "LIB", defaultUsefulLife: 10, defaultDepreciationMethod: "STRAIGHT_LINE" as const },
      { name: "Land", code: "LND", defaultUsefulLife: null, defaultDepreciationMethod: "NONE" as const },
    ];

    for (const cat of assetCategories) {
      await db.assetCategory.create({
        data: { schoolId: school.id, ...cat },
      });
    }
    console.log(`  Created ${assetCategories.length} asset categories.`);
  }

  console.log("\nFinance module seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
