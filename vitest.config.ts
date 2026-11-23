import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.join(root, "apps/web/src"),
      "@studybuddy/core": path.join(root, "packages/core/src/index.ts"),
      "@studybuddy/db": path.join(root, "packages/db/src/index.ts"),
      "@studybuddy/ai": path.join(root, "packages/ai/src/index.ts"),
      "@studybuddy/storage": path.join(root, "packages/storage/src/index.ts"),
      "@studybuddy/test-fixtures": path.join(root, "packages/test-fixtures/src/index.ts")
    }
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.ts", "**/e2e/**"],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
