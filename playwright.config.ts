import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL?.trim() || "http://localhost:3000";
const reuseServer = process.env.E2E_REUSE_SERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["json", { outputFile: "test-results/playwright-results.json" }]],
  outputDir: "test-results/artifacts",
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  ...(reuseServer ? {} : {
    webServer: {
      command: "npm run dev",
      url: `${baseURL}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  }),
});
