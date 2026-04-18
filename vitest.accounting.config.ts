import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Accounting integration test config.
 *
 * Runs against the local Postgres referenced by DATABASE_URL. Uses the real
 * Prisma client (not the @/lib/db mock). The database must already have the
 * Ghana public-sector COA seeded (via `npx tsx prisma/seed/index.ts`) so the
 * ledger can resolve account codes.
 *
 * Run with: npx vitest run -c vitest.accounting.config.ts
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/accounting/**/*.test.ts"],
    testTimeout: 30_000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
