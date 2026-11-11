import { defineConfig, devices } from "@playwright/test";

// Mainnet tests (M2+): the production build with the SDK source, on http://*.localhost:4174.
// Addresses of published test files come from the environment; see tests/e2e-mainnet/.
export default defineConfig({
  testDir: "tests/e2e-mainnet",
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [["list"]],
  timeout: 180_000,
  use: { trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npx vite preview --port 4174 --strictPort",
    url: "http://localhost:4174/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
