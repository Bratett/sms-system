import { defineConfig } from "vitest/config";
import path from "path";

/**
 * RLS integration test config.
 *
 * Runs against a real Postgres via testcontainers. Uses Prisma migrate to apply
 * the full schema + RLS policies, then asserts cross-tenant reads return zero
 * rows. Separate from the unit config so the `@/lib/db` mock does not apply.
 *
 * Run with: npx vitest run -c vitest.rls.config.ts
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/rls/**/*.test.ts"],
    globalSetup: ["tests/integration/rls/global-setup.ts"],
    // Each test file may spin up its own pg Client; set a generous timeout
    // because Prisma migrate runs on container boot.
    testTimeout: 30_000,
    hookTimeout: 180_000,
    // Serialize: only one Postgres container per run.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
