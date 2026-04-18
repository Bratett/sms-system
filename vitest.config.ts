import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // RLS + accounting integration tests need a real Postgres/seeded DB; they
    // run under dedicated configs (`npm run test:rls`,
    // `vitest.accounting.config.ts`).
    exclude: [
      "tests/integration/rls/**",
      "tests/integration/accounting/**",
      "node_modules/**",
    ],
    setupFiles: ["tests/unit/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/modules/**/actions/**", "src/lib/**"],
      exclude: ["src/lib/navigation.ts", "src/lib/constants.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
