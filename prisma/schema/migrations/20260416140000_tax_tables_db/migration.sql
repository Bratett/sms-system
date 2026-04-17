-- Move payroll statutory tables (PAYE, SSNIT, Pension, NSSF) into the database.
-- Reference data shared across tenants; no RLS policy (no schoolId).
-- Seeds the three currently supported countries (GH, NG, KE) with the same
-- values as src/lib/payroll/tax-tables.ts at time of this migration.

CREATE TYPE "TaxDeductionType" AS ENUM ('INCOME_TAX', 'SOCIAL_SECURITY', 'PENSION', 'OTHER');

CREATE TABLE "TaxTable" (
    "id"             TEXT NOT NULL,
    "country"        TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "type"           "TaxDeductionType" NOT NULL,
    "orderIndex"     INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom"  TIMESTAMP(3) NOT NULL,
    "effectiveTo"    TIMESTAMP(3),
    "employeeRate"   DECIMAL(8,4),
    "employerRate"   DECIMAL(8,4),
    "ceilingAmount"  DECIMAL(18,2),
    "brackets"       JSONB,
    "annualized"     BOOLEAN NOT NULL DEFAULT FALSE,
    "relief"         DECIMAL(18,2),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxTable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaxTable_country_name_effectiveFrom_key" ON "TaxTable"("country", "name", "effectiveFrom");
CREATE INDEX "TaxTable_country_effectiveFrom_idx" ON "TaxTable"("country", "effectiveFrom");

-- ─── Seed: Ghana ────────────────────────────────────────────────────
INSERT INTO "TaxTable" (id, country, name, type, "orderIndex", "effectiveFrom", brackets, "updatedAt") VALUES
  ('tax_gh_paye_v1', 'GH', 'PAYE (Income Tax)', 'INCOME_TAX', 0, '2020-01-01',
   '[
      {"min": 0,     "max": 402,      "rate": 0},
      {"min": 402,   "max": 512,      "rate": 5},
      {"min": 512,   "max": 642,      "rate": 10},
      {"min": 642,   "max": 3642,     "rate": 17.5},
      {"min": 3642,  "max": 20037,    "rate": 25},
      {"min": 20037, "max": null,     "rate": 30}
    ]'::jsonb,
   NOW()),
  ('tax_gh_ssnit1_v1', 'GH', 'SSNIT (Tier 1)', 'SOCIAL_SECURITY', 1, '2020-01-01', NULL, NOW()),
  ('tax_gh_ssnit2_v1', 'GH', 'SSNIT (Tier 2)', 'PENSION',         2, '2020-01-01', NULL, NOW());

UPDATE "TaxTable" SET "employeeRate" = 5.5, "employerRate" = 13  WHERE id = 'tax_gh_ssnit1_v1';
UPDATE "TaxTable" SET "employeeRate" = 5,   "employerRate" = 0   WHERE id = 'tax_gh_ssnit2_v1';

-- ─── Seed: Nigeria ──────────────────────────────────────────────────
-- PAYE brackets are "widths" (limit), not absolute min/max — encoded here
-- faithfully to the original constants.
INSERT INTO "TaxTable" (id, country, name, type, "orderIndex", "effectiveFrom", brackets, annualized, "updatedAt") VALUES
  ('tax_ng_paye_v1', 'NG', 'PAYE', 'INCOME_TAX', 0, '2020-01-01',
   '[
      {"limit": 300000,  "rate": 7},
      {"limit": 300000,  "rate": 11},
      {"limit": 500000,  "rate": 15},
      {"limit": 500000,  "rate": 19},
      {"limit": 1600000, "rate": 21},
      {"limit": null,    "rate": 24}
    ]'::jsonb,
   TRUE, NOW()),
  ('tax_ng_pension_v1', 'NG', 'Pension', 'PENSION', 1, '2020-01-01', NULL, FALSE, NOW());

UPDATE "TaxTable" SET "employeeRate" = 8, "employerRate" = 10 WHERE id = 'tax_ng_pension_v1';

-- ─── Seed: Kenya ────────────────────────────────────────────────────
INSERT INTO "TaxTable" (id, country, name, type, "orderIndex", "effectiveFrom", brackets, relief, "updatedAt") VALUES
  ('tax_ke_paye_v1', 'KE', 'PAYE', 'INCOME_TAX', 0, '2020-01-01',
   '[
      {"limit": 24000, "rate": 10},
      {"limit": 8333,  "rate": 25},
      {"limit": null,  "rate": 30}
    ]'::jsonb,
   2400, NOW()),
  ('tax_ke_nssf_v1', 'KE', 'NSSF', 'SOCIAL_SECURITY', 1, '2020-01-01', NULL, NULL, NOW());

UPDATE "TaxTable"
  SET "employeeRate" = 6, "employerRate" = 6, "ceilingAmount" = 18000
  WHERE id = 'tax_ke_nssf_v1';
