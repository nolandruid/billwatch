import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/** Live production checks (`npm run health`), kept out of the regular test run. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["health/**/*.check.ts"],
    testTimeout: 30_000,
  },
});
