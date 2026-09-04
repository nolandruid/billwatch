import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The e2e suite hits real LEGISinfo + Supabase; run it via `npm run test:e2e`.
    exclude: ["src/**/*.e2e.test.ts", "**/node_modules/**"],
  },
});
