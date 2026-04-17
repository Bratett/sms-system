import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

/**
 * RLS negative tests.
 *
 * Proves that cross-tenant reads return zero rows when `app.current_school_id`
 * is set to a different school. Uses a single test database seeded with two
 * schools and one row per representative table in each.
 *
 * Run with: npx vitest run -c vitest.rls.config.ts
 *
 * NOTE: connections to pg need their own session variable set. Prisma's
 * `withTenant` helper does this inside a transaction; these tests use raw pg
 * so we SET LOCAL inside a transaction too.
 */

const SCHOOL_A = { id: "rls-school-a", name: "RLS School A" };
const SCHOOL_B = { id: "rls-school-b", name: "RLS School B" };

// Reusable client created in beforeAll against the container's DATABASE_URL.
let client: Client;

async function withTenant<T>(
  schoolId: string,
  fn: (c: Client) => Promise<T>,
): Promise<T> {
  await client.query("BEGIN");
  try {
    // SET LOCAL does not accept parameters for the value, so use set_config()
    // with is_local=true which is the functional equivalent.
    await client.query("SELECT set_config('app.current_school_id', $1, true)", [
      schoolId,
    ]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

/** Seed minimal rows for a school (runs as superuser, bypassing RLS). */
async function seedSchool(
  school: { id: string; name: string },
): Promise<void> {
  await client.query(
    `INSERT INTO "School" (id, name, type, category, "createdAt", "updatedAt")
     VALUES ($1, $2, 'DAY_BOARDING', 'PUBLIC', NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [school.id, school.name],
  );
}

beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set (globalSetup must run first)");
  client = new Client({ connectionString: url });
  await client.connect();

  // Seed as the superuser (bypasses RLS). After seeding, SET ROLE to the
  // non-superuser `rls_tenant` role so the actual negative tests run under
  // enforced RLS policies.
  await seedSchool(SCHOOL_A);
  await seedSchool(SCHOOL_B);

  await client.query(
    `INSERT INTO "AcademicYear" (id, "schoolId", name, "startDate", "endDate", status, "isCurrent", "createdAt", "updatedAt")
     VALUES ('ay-a', $1, '2026/27', '2026-09-01', '2027-07-31', 'ACTIVE', true, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [SCHOOL_A.id],
  );
  await client.query(
    `INSERT INTO "AcademicYear" (id, "schoolId", name, "startDate", "endDate", status, "isCurrent", "createdAt", "updatedAt")
     VALUES ('ay-b', $1, '2026/27', '2026-09-01', '2027-07-31', 'ACTIVE', true, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [SCHOOL_B.id],
  );

  // Downgrade to non-superuser role so RLS policies are enforced.
  await client.query("SET ROLE rls_tenant");

  const whoami = await client.query<{
    current_user: string;
    usesuper: boolean;
  }>(
    "SELECT current_user, (SELECT usesuper FROM pg_user WHERE usename = current_user) AS usesuper",
  );
  // eslint-disable-next-line no-console
  console.log("[rls-test] running as", whoami.rows[0]);
}, 60_000);

afterAll(async () => {
  await client?.end();
});

describe("RLS tenant isolation", () => {
  it("each school sees its own AcademicYear rows", async () => {
    const a = await withTenant(SCHOOL_A.id, (c) =>
      c.query<{ id: string }>(`SELECT id FROM "AcademicYear"`),
    );
    const b = await withTenant(SCHOOL_B.id, (c) =>
      c.query<{ id: string }>(`SELECT id FROM "AcademicYear"`),
    );

    expect(a.rows.map((r) => r.id)).toEqual(["ay-a"]);
    expect(b.rows.map((r) => r.id)).toEqual(["ay-b"]);
  });

  it("a session scoped to school A cannot see school B's rows", async () => {
    const res = await withTenant(SCHOOL_A.id, (c) =>
      c.query<{ id: string }>(`SELECT id FROM "AcademicYear" WHERE id = 'ay-b'`),
    );
    expect(res.rows).toHaveLength(0);
  });

  it("a session with no tenant set sees zero tenant-scoped rows", async () => {
    // No SET LOCAL — current_setting returns empty string; the USING clause
    // compares schoolId to '' and filters everything out.
    const res = await client.query<{ id: string }>(
      `SELECT id FROM "AcademicYear"`,
    );
    expect(res.rows).toHaveLength(0);
  });

  it("INSERT with a mismatched schoolId is blocked by WITH CHECK", async () => {
    await expect(
      withTenant(SCHOOL_A.id, (c) =>
        c.query(
          `INSERT INTO "AcademicYear" (id, "schoolId", name, "startDate", "endDate", status, "isCurrent", "createdAt", "updatedAt")
           VALUES ('ay-cross', $1, 'X', '2026-09-01', '2027-07-31', 'ACTIVE', false, NOW(), NOW())`,
          [SCHOOL_B.id], // Wrong school for this session
        ),
      ),
    ).rejects.toThrow(/row-level security|policy|violates/i);
  });

  it("UPDATE targeting another school's row silently matches zero rows", async () => {
    const res = await withTenant(SCHOOL_A.id, (c) =>
      c.query(
        `UPDATE "AcademicYear" SET name = 'hacked' WHERE id = 'ay-b'`,
      ),
    );
    expect(res.rowCount).toBe(0);

    // Verify b's row is still intact when viewed by its own tenant.
    const verify = await withTenant(SCHOOL_B.id, (c) =>
      c.query<{ name: string }>(`SELECT name FROM "AcademicYear" WHERE id = 'ay-b'`),
    );
    expect(verify.rows[0]?.name).toBe("2026/27");
  });

  it("DELETE targeting another school's row removes nothing", async () => {
    const res = await withTenant(SCHOOL_A.id, (c) =>
      c.query(`DELETE FROM "AcademicYear" WHERE id = 'ay-b'`),
    );
    expect(res.rowCount).toBe(0);
  });
});
