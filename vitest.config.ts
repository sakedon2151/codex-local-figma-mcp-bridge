import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
      exclude: ["dist/**", "REFERENCE/**"]
    }
  },
  resolve: {
    alias: {
      "@shared": new URL("./src/shared", import.meta.url).pathname,
      "@bridge": new URL("./src/bridge", import.meta.url).pathname,
      "@mcp": new URL("./src/mcp", import.meta.url).pathname,
      "@plugin": new URL("./src/plugin", import.meta.url).pathname
    }
  }
});
