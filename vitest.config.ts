import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // RLS integration tests need a real Postgres via testcontainers; they run
    // under a dedicated config: `npm run test:rls` / `vitest.rls.config.ts`.
    exclude: ["tests/integration/rls/**", "node_modules/**"],
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
