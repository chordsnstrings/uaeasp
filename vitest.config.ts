import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scraper/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    // DB-backed tests mutate shared tables — keep them sequential.
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
