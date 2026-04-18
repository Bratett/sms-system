/**
 * Finance Module Seed Script
 *
 * Seeds default data for the enterprise financial module:
 * - Chart of Accounts (Ghana public-sector / IPSAS / GIFMIS-aligned)
 *   Delegates to src/modules/accounting/seed/ghana-public-sector-coa.ts
 *   so account codes stay in sync with the ledger helpers (which look up
 *   accounts by code — see src/modules/accounting/lib/account-codes.ts).
 * - Expense Categories
 * - Asset Categories
 * - Default Funds (General/Capital/Restricted) — seeded by the COA seeder.
 *
 * Run: npx tsx prisma/seed-finance.ts
 */

import { PrismaClient } from "@prisma/client";
import { seedGhanaPublicSectorCoa } from "../src/modules/accounting/seed/ghana-public-sector-coa";

const db = new PrismaClient();

async function main() {
  console.log("Starting finance module seed...\n");

  const school = await db.school.findFirst();
  if (!school) {
    console.error("No school found. Please create a school first.");
    process.exit(1);
  }
  console.log(`School: ${school.name} (${school.id})\n`);

  // ─── 1. Chart of Accounts + Funds ─────────────────────────────────
  console.log("Seeding Ghana Public-Sector Chart of Accounts + default Funds...");
  const coaResult = await db.$transaction((tx) => seedGhanaPublicSectorCoa(tx, school.id));
  console.log(
    `  ${coaResult.categoriesCreated} new categories, ${coaResult.accountsCreated} new accounts, ${coaResult.fundsCreated} new funds.\n`,
  );

  // ─── 2. Expense Categories ─────────────────────────────────────
  const existingExpenseCategories = await db.expenseCategory.count({ where: { schoolId: school.id } });
  if (existingExpenseCategories > 0) {
    console.log(`Expense Categories: Already seeded (${existingExpenseCategories} categories). Skipping.`);
  } else {
    console.log("Seeding Expense Categories...");

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
