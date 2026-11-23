import baseConfig from "./vitest.config.ts";
import { defineConfig, mergeConfig } from "vitest/config";

const config = mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["**/*.integration.test.ts"],
      exclude: ["**/node_modules/**", "**/e2e/**"],
      globalSetup: ["./tests/integration-global-setup.ts"],
      setupFiles: ["./tests/integration-setup.ts"],
      fileParallelism: false,
      testTimeout: 30_000,
      hookTimeout: 30_000
    }
  })
);

if (config.test) {
  config.test.exclude = ["**/node_modules/**", "**/e2e/**"];
}

export default config;
