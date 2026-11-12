// The Download Button (DEMO.md 3.6) on the fixture loader. Its files are on Autonomi mainnet,
// so the tests that run by default only check what needs no network: which view each address
// shows, old links, the button generator's output, and the site's policy. Set DOWNLOAD_LIVE=1
// to also fetch a small file from mainnet and check its hash.

import { type Page, expect, test } from "@playwright/test";
import { nameUrl, openName } from "./helpers";

// A sample from try.autonomi.com, as on Autonomirror's generator.
const LUCKY = "711c7e20006ff3e0ac6c1f3063286a0c1a3e4c409642e8c526173fa60bb7078a";

/** Collect the page's security-policy errors. */
function policyErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy/i.test(m.text())) errors.push(m.text());
  });
  return errors;
}

test("the site's root is the button generator, and its buttons point at the Antnet address", async ({ page }) => {
  const errors = policyErrors(page);
  await openName(page, "download", ".gen");
  await expect(page.locator(".gen-title")).toHaveText("Autonomi Download Button");
  // Uploads and payments aren't part of the Antnet version.
  await expect(page.locator("#source-upload, .source-tabs")).toHaveCount(0);
  await expect(page.locator(".antnet-start")).toHaveAttribute("href", "/_autonomi/go/name/start/");
  // The preview shows a button for an example file, styled as it will be on someone's site.
  const preview = page.frameLocator("#preview");
  const button = preview.locator("a").first();
  await expect(button).toHaveAttribute("href", /^https:\/\/download\.antnet\.autonomirror\.com\/f\/ant\/[0-9a-f]{64}\?n=/);
  expect(await button.evaluate((a) => getComputedStyle(a).display)).toBe("inline-flex");
  expect(errors).toEqual([]);
});

test("a download link shows the file it names, with its address", async ({ page }) => {
  const errors = policyErrors(page);
  await openName(page, "download", ".file-card", `/f/ant/${LUCKY}?n=lucky.jpg&s=138931`);
  await expect(page.locator("#file-name")).toHaveText("lucky.jpg");
  await expect(page.locator("#file-ext")).toHaveText("JPG");
  await expect(page.locator("#file-size")).toHaveText("138.9 KB");
  await expect(page.locator("#address-full")).toHaveText(LUCKY);
  await expect(page.locator(".direct-line")).toContainText("This page and this file both come from the Autonomi network");
  await expect(page).toHaveTitle("lucky.jpg · Download");
  expect(errors).toEqual([]);
});

test("a broken download link says what is wrong with it", async ({ page }) => {
  await openName(page, "download", ".invalid-card", `/f/ant/${LUCKY.slice(2)}?n=x.zip`);
  await expect(page.locator(".invalid-card")).toBeVisible();
  await expect(page.locator("#invalid-reason")).toContainText("isn't a valid Autonomi address");
});

test("an old /d/?a= link moves to the new form, keeping the name and size", async ({ page }) => {
  await openName(page, "download", ".file-card", `/d/?a=${LUCKY}&n=lucky.jpg&s=138931`);
  const url = new URL(page.url());
  expect(url.pathname + url.search).toBe(`/f/ant/${LUCKY}?n=lucky.jpg&s=138931`);
  await expect(page.locator("#file-name")).toHaveText("lucky.jpg");
});

test("the generator opens pre-filled from ?a=&n=", async ({ page }) => {
  await openName(page, "download", ".gen", `/?a=${LUCKY}&n=lucky.jpg`);
  await expect(page.locator("#address")).toHaveValue(LUCKY);
  await expect(page.locator("#name")).toHaveValue("lucky.jpg");
});

test("a file downloads from mainnet in the browser and its hash is shown", async ({ page, context }) => {
  test.skip(!process.env.DOWNLOAD_LIVE, "set DOWNLOAD_LIVE=1 to fetch a file from Autonomi mainnet");
  test.setTimeout(180_000);
  // Stand in for the save window (Playwright can't answer it): save into the site's private storage.
  await context.addInitScript(() => {
    (window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker = async (o: { suggestedName: string }) =>
      (await navigator.storage.getDirectory()).getFileHandle(o.suggestedName, { create: true });
  });
  await openName(page, "download", ".file-card", `/f/ant/${LUCKY}?n=lucky.jpg`);
  const button = page.locator("#download-btn");
  await expect(button).toBeEnabled({ timeout: 90_000 });
  await expect(page.locator("#size-badge")).toHaveText("✓ verified", { timeout: 90_000 });
  await button.click();
  await expect(page.locator("#app")).toHaveAttribute("data-state", "done", { timeout: 120_000 });
  await expect(page.locator("#done-hash")).toHaveText(/^[0-9a-f]{64}$/);
  await expect(page.locator("#done-size")).toContainText("138.9 KB");
  // The page read the removal list, or knew there wasn't one, and the file wasn't on it.
  await expect(page.locator("#app")).toHaveAttribute("data-removals", /none|loaded|unavailable/);
  await page.goto(nameUrl("download", "/_autonomi/"));
  await expect(page.locator("[data-view=info]")).toContainText("Download Button");
});
