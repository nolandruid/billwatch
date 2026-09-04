import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * End-to-end suite: hits real LEGISinfo and a real Supabase project, so it is kept out of
 * `npm test` and run explicitly via `npm run test:e2e` (see src/lib/sync.e2e.test.ts).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.e2e.test.ts"],
    // The whole point is measuring a sync that may take tens of seconds.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
