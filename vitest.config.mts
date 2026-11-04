import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": p("./src"),
      // `server-only` throws outside the Next.js server bundle; stub it for unit/integration tests.
      "server-only": p("./tests/stubs/server-only.ts"),
    },
  },
  test: { testTimeout: 30_000, fileParallelism: false },
});
