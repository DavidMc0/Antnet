// Milestone M2 against mainnet: npm run test:mainnet
// Set the addresses of the published files from publish/README.md:
//   ANT_SPA_V1     spa-v1.tar        ANT_NOT_SITE   not-a-site.txt

import { expect, test } from "@playwright/test";
import { hexToLabelBody } from "../../src/base32";

const PORT = 4174;
const hexEnv = (name: string) => process.env[name]?.toLowerCase().replace(/^0x/, "");
const SPA = hexEnv("ANT_SPA_V1");
const NOT_SITE = hexEnv("ANT_NOT_SITE");

const site = (kind: "i" | "p", hex: string, path = "/") =>
  `http://${kind}${hexToLabelBody(hex)}.localhost:${PORT}${path}`;
const errorTitle = (page: import("@playwright/test").Page) => page.locator("[data-view=error] h1");

test("a published SPA opens from mainnet by its i… link, with timings recorded", async ({ page }) => {
  test.skip(!SPA, "set ANT_SPA_V1");
  const started = Date.now();
  await page.goto(site("i", SPA!, "/users/42"));
  await expect(page.locator("#view")).toHaveText("User 42", { timeout: 150_000 });
  await expect(page.locator("#version")).toHaveAttribute("data-version", "1");
  console.log(`cold open: ${Date.now() - started} ms`);

  // Warm open: served by the worker.
  const warm = Date.now();
  await page.goto(site("i", SPA!, "/settings/profile"));
  await expect(page.locator("#view")).toHaveText("Route /settings/profile");
  console.log(`warm open: ${Date.now() - warm} ms`);

  await page.goto(site("i", SPA!, "/_autonomi/"));
  const timings = await page.getByTestId("timings").textContent();
  console.log(`timings: ${timings}`);
  expect(timings).toMatch(/total \d/);
  await expect(page.locator("[data-view=info]")).toContainText("Records");
});

test("an address that isn't a tar shows “Not a site archive”", async ({ page }) => {
  test.skip(!NOT_SITE, "set ANT_NOT_SITE");
  await page.goto(site("i", NOT_SITE!));
  await expect(errorTitle(page)).toHaveText("Not a site archive", { timeout: 150_000 });
});

test("an archive over the size limit is refused before download", async ({ page }) => {
  test.skip(!SPA, "set ANT_SPA_V1");
  // The override can only lower the limit; 1000 bytes is below the SPA archive's size.
  await page.addInitScript(() => sessionStorage.setItem("maxArchiveBytes", "1000"));
  await page.goto(site("i", SPA!));
  await expect(errorTitle(page)).toHaveText("This site is too large", { timeout: 150_000 });
  await expect(page.getByTestId("error-message")).toContainText("memory budget");
});

test("an address with nothing behind it shows “Nothing found”", async ({ page }) => {
  await page.goto(site("i", "ab".repeat(32)));
  await expect(errorTitle(page)).toHaveText("Nothing found at this address", { timeout: 150_000 });
});
