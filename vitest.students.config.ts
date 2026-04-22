import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Students integration test config.
 *
 * Runs against the local Postgres referenced by DATABASE_URL using the real
 * Prisma client. The database must be seeded (`npm run db:seed`) so that a
 * `default-school` row plus an active academic year exist.
 *
 * Run with: npx vitest run -c vitest.students.config.ts
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/students/**/*.test.ts"],
    setupFiles: ["tests/integration/students/setup.ts"],
    testTimeout: 60_000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
