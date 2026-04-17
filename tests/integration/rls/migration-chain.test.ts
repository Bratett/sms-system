import { describe, expect, it } from "vitest";
import { Client } from "pg";

/**
 * Migration-chain guardrail.
 *
 * The RLS globalSetup runs `prisma migrate deploy` against a fresh Postgres.
 * If the chain had a broken step, the whole suite would fail to boot. This
 * test documents that contract explicitly and adds a few shape assertions:
 *
 *  1. _prisma_migrations has an entry per migration folder, all with
 *     finished_at NOT NULL (i.e. no half-applied steps).
 *  2. Every previously-missing table from the known history gap now exists.
 *  3. Every RLS-protected table (sample) actually has FORCE ROW LEVEL SECURITY
 *     enabled and at least one policy.
 *
 * If a future migration reintroduces a gap, this file fails loudly with the
 * bad migration name.
 */

const PREVIOUSLY_MISSING_TABLES = [
  "BoardingIncident",
  "SickBayAdmission",
  "MedicationLog",
  "BoardingVisitor",
  "BedTransfer",
  "HostelInspection",
  "MaintenanceRequest",
  "StoreTransfer",
  "StoreTransferItem",
  "Requisition",
  "RequisitionItem",
  "StockTake",
  "StockTakeItem",
  "AssetAudit",
  "AssetAuditItem",
] as const;

const RLS_SAMPLE_TABLES = [
  "AcademicYear",
  "Exeat",
  "Payment",
  "MedicationLog",
  "WorkflowInstance",
  "ExeatOtp",
  "ExeatMovement",
  "CommunicationCampaign",
  // NotificationTemplate uses a lenient policy that permits null-schoolId
  // rows; still RLS-enforced and counted in pg_policies.
  "NotificationTemplate",
  "TeacherLicence",
  "DocumentTemplate",
  "DocumentInstance",
  "DocumentSignLink",
  "DunningPolicy",
  "DunningStage",
  "DunningRun",
  "DunningCase",
  "DunningEvent",
  "SupplierInvoice",
  "SupplierInvoiceItem",
  "MatchToleranceSetting",
  "ThreeWayMatch",
  "ItemBankQuestion",
  "ItemBankChoice",
  "ItemBankTag",
  "ItemBankQuestionTag",
  "ItemBankPaper",
  "ItemBankPaperQuestion",
  "ItemBankSubmission",
  "ItemBankResponse",
] as const;

describe("migration chain guardrail", () => {
  it("all migrations listed in _prisma_migrations are fully applied", async () => {
    const url = process.env.DATABASE_URL;
    expect(url, "DATABASE_URL must be set by globalSetup").toBeTruthy();

    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const { rows } = await client.query<{
        migration_name: string;
        finished_at: Date | null;
        rolled_back_at: Date | null;
      }>(
        `SELECT migration_name, finished_at, rolled_back_at
         FROM _prisma_migrations
         ORDER BY started_at ASC`,
      );

      // Must have at least the count we check in at time of writing; new
      // migrations are fine, but zero migrations is a red flag.
      expect(rows.length).toBeGreaterThanOrEqual(8);

      const broken = rows.filter(
        (r) => r.finished_at === null || r.rolled_back_at !== null,
      );
      if (broken.length > 0) {
        throw new Error(
          `Unfinished or rolled-back migrations detected:\n${broken
            .map((r) => `  - ${r.migration_name}`)
            .join("\n")}`,
        );
      }
    } finally {
      await client.end();
    }
  });

  it("previously-missing boarding/inventory tables all exist", async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      for (const table of PREVIOUSLY_MISSING_TABLES) {
        const { rows } = await client.query<{ exists: boolean }>(
          `SELECT to_regclass($1) IS NOT NULL AS exists`,
          [`public."${table}"`],
        );
        expect(rows[0]?.exists, `Table "${table}" missing`).toBe(true);
      }
    } finally {
      await client.end();
    }
  });

  it("sampled tenant-scoped tables have RLS enabled with a policy", async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      for (const table of RLS_SAMPLE_TABLES) {
        const rls = await client.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
          `SELECT relrowsecurity, relforcerowsecurity
           FROM pg_class
           WHERE relname = $1 AND relnamespace = 'public'::regnamespace`,
          [table],
        );
        expect(rls.rows[0]?.relrowsecurity, `${table} RLS not enabled`).toBe(true);
        expect(
          rls.rows[0]?.relforcerowsecurity,
          `${table} RLS not forced (would be bypassed by owner)`,
        ).toBe(true);

        const policies = await client.query<{ policyname: string }>(
          `SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = $1`,
          [table],
        );
        expect(
          policies.rows.length,
          `${table} has no RLS policy — tenant isolation silently broken`,
        ).toBeGreaterThan(0);
      }
    } finally {
      await client.end();
    }
  });
});
