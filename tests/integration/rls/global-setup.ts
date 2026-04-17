import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "node:child_process";
import { Client } from "pg";

/**
 * Vitest globalSetup: boot a Postgres container, apply Prisma migrations via
 * `migrate deploy` (the production path — exercises the real migration chain
 * including RLS policies), and create a non-superuser role for the tests.
 */

let container: StartedPostgreSqlContainer | undefined;

export async function setup() {
  console.log("[rls-setup] starting postgres container...");
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("sms_rls_test")
    .withUsername("rls_test")
    .withPassword("rls_test")
    .start();

  const url = container.getConnectionUri();
  process.env.DATABASE_URL = url;
  process.env.TEST_DATABASE_URL = url;

  console.log("[rls-setup] applying Prisma migrations...");
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });

  console.log("[rls-setup] creating non-superuser test role...");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    // Postgres superusers bypass RLS entirely (FORCE ROW LEVEL SECURITY does
    // not affect them), so tests must connect as a normal role. The test suite
    // `SET ROLE`s to this before running negative cases.
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rls_tenant') THEN
          CREATE ROLE rls_tenant NOLOGIN;
        END IF;
      END
      $$;
    `);
    await client.query("GRANT USAGE ON SCHEMA public TO rls_tenant");
    await client.query(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rls_tenant",
    );
    await client.query(
      "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rls_tenant",
    );
  } finally {
    await client.end();
  }

  console.log("[rls-setup] ready:", url.replace(/:[^:@]+@/, ":***@"));
}

export async function teardown() {
  if (container) {
    console.log("[rls-setup] stopping postgres container");
    await container.stop();
  }
}
