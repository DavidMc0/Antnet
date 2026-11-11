// The fixture e2e tests in Firefox and WebKit (Safari's engine), for cross-browser checks:
//   npx playwright test -c playwright.browsers.config.ts [file]
// Needs: npx playwright install firefox webkit. The main config runs Chromium only.

import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  projects: [
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
