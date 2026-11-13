// Milestone M3 against the fixture source: pointer update checks (spec 3.4), which since
// 11 November 2026 run in the background (DEMO.md 5.3). A due check never holds the page:
// the installed site is served at once, the loader's script in the page checks afterwards
// in a hidden same-origin frame, and a new version brings a notice offering a reload.

import { expect, test } from "@playwright/test";
import { expireCheck, fixture, install, readState, siteUrl, updateNotice, waitForCheck } from "./helpers";

/** Playwright's request interception doesn't reach requests made through WebKit's service worker. */
const INTERCEPT = "request interception doesn't reach WebKit's service worker";

const POINTER = "spa (pointer)";

test("a due check with no new version runs in the background and records it", async ({ page }) => {
  await install(page, POINTER, "#view");
  await expireCheck(page);
  const since = Date.now();
  await page.reload();
  await expect(page.locator("#view")).toHaveText("Home");
  const state = await waitForCheck(page, since);
  expect(state?.lastCheck?.outcome).toBe("no change");
  expect(state?.archive).toBe(fixture("spa").address);
  expect(Date.now() - (state?.checkedAt ?? 0)).toBeLessThan(60_000);
  await expect(updateNotice(page)).toHaveCount(0);
});

test("a re-pointed pointer is installed in the background, and the page offers a reload", async ({ page, context, browserName }) => {
  test.skip(browserName === "webkit", INTERCEPT);
  await install(page, POINTER, "#view");
  // Re-point: the pointer now targets the plain site's archive.
  const pointerFile = `/_autonomi/fixtures/pointers/${fixture(POINTER).address}.json`;
  await context.route(`**${pointerFile}`, (route) =>
    route.fulfill({ json: { kind: "chunk", target: fixture("plain").address } }),
  );
  // Not due yet: the old version, and no notice.
  await page.reload();
  await expect(page.locator("#view")).toHaveText("Home");

  await expireCheck(page);
  const since = Date.now();
  await page.reload();
  // The installed version is served at once; the check runs afterwards.
  await expect(page.locator("#view")).toHaveText("Home");
  const state = await waitForCheck(page, since);
  expect(state?.lastCheck?.outcome).toBe("new version installed");
  expect(state?.archive).toBe(fixture("plain").address);

  const notice = updateNotice(page);
  await expect(notice).toHaveAttribute("data-antnet-notice", "update");
  await expect(notice.getByRole("status")).toContainText("A newer version of this page is available.");
  await notice.getByRole("button", { name: "Reload" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-page", "home", { timeout: 15_000 });
  // The old archive's cache is gone.
  const names = await page.evaluate(() => caches.keys());
  expect(names.filter((n) => n.startsWith("site-v1-"))).toEqual([`site-v1-${fixture("plain").address}`]);
});

test("a slow check never holds the page, and gives up within its budget", async ({ page }) => {
  await install(page, POINTER, "#view");
  await expireCheck(page);
  // A short budget keeps the test fast; the fixture source waits past it in connect().
  await page.evaluate(() => {
    sessionStorage.setItem("checkBudgetMs", "3000");
    sessionStorage.setItem("fixtureDelay", "8000");
  });
  const since = Date.now();
  await page.reload();
  await expect(page.locator("#view")).toHaveText("Home");
  expect(Date.now() - since).toBeLessThan(2_500);
  const state = await waitForCheck(page, since);
  expect(state?.lastCheck?.outcome).toBe("timed out");
  // Next check due in about 10 minutes, not a full hour.
  const dueIn = (state?.checkedAt ?? 0) + 60 * 60 * 1000 - Date.now();
  expect(dueIn).toBeGreaterThan(9 * 60 * 1000);
  expect(dueIn).toBeLessThan(11 * 60 * 1000);
});

test("a failed check keeps the installed site and says so", async ({ page, context, browserName }) => {
  test.skip(browserName === "webkit", INTERCEPT);
  await install(page, POINTER, "#view");
  await context.route("**/_autonomi/fixtures/pointers/**", (route) => route.fulfill({ status: 500, body: "down" }));
  await expireCheck(page);
  const since = Date.now();
  await page.reload();
  await expect(page.locator("#view")).toHaveText("Home");
  expect((await waitForCheck(page, since))?.lastCheck?.outcome).toMatch(/^failed/);
  await expect(updateNotice(page)).toHaveCount(0);
});

test("an expired check with the network offline serves the cached site", async ({ page, context }) => {
  await install(page, POINTER, "#view");
  await expireCheck(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#view")).toHaveText("Home", { timeout: 15_000 });
  await context.setOffline(false);
});

test("immutable links never check, and get no loader script", async ({ page, context }) => {
  let pointerReads = 0;
  await context.route("**/_autonomi/fixtures/pointers/**", (route) => {
    pointerReads++;
    return route.continue();
  });
  await install(page, "spa", "#view");
  await expireCheck(page);
  await page.reload();
  await expect(page.locator("#view")).toHaveText("Home");
  await page.waitForTimeout(2000);
  expect(pointerReads).toBe(0);
  expect(await page.locator('script[src="/_autonomi/check.js"]').count()).toBe(0);
});

test("pointer sites get the loader's check script, first in <head>", async ({ page }) => {
  await install(page, POINTER, "#view");
  const first = await page.evaluate(() => document.head.firstElementChild?.getAttribute("src"));
  expect(first).toBe("/_autonomi/check.js");
  // In the page, the script is the worker's own.
  const type = await page.evaluate(async () => (await fetch("/_autonomi/check.js")).headers.get("Content-Type"));
  expect(type).toContain("javascript");
});

test("the info page's check-now action runs a check there and then", async ({ page }) => {
  await install(page, POINTER, "#view");
  await page.goto(siteUrl(POINTER, "/_autonomi/"));
  await page.getByRole("button", { name: "Check for a new version now" }).click();
  await expect(page.locator(".status")).toContainText("Checked: no change.", { timeout: 15_000 });
  await expect(page.getByTestId("updates")).toContainText("/_autonomi/check.js");
});

test("the info page's clear action removes the site", async ({ page }) => {
  await install(page, POINTER, "#view");
  await page.goto(siteUrl(POINTER, "/_autonomi/"));
  await page.getByRole("button", { name: "Clear this site's data" }).click();
  await expect(page.locator(".status")).toContainText("Cleared");
  const left = await page.evaluate(async () => ({
    caches: await caches.keys(),
    workers: (await navigator.serviceWorker.getRegistrations()).length,
  }));
  expect(left).toEqual({ caches: [], workers: 0 });
  expect(await readState(page)).toBeNull();
});
