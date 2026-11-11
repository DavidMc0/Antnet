// Milestone M3 behaviour against the fixture source: pointer update checks (spec 3.4).

import { type Page, expect, test } from "@playwright/test";
import { fixture, install, siteUrl } from "./helpers";

const POINTER = "spa (pointer)";

/** Make the installed site's pointer check due, by moving checkedAt into the past. */
async function expireCheck(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const cache = await caches.open("autonomi-loader-meta");
    const res = await cache.match("/_autonomi/state.json");
    if (!res) throw new Error("nothing installed");
    const state = await res.json();
    state.checkedAt = 0;
    await cache.put(
      "/_autonomi/state.json",
      new Response(JSON.stringify(state), { headers: { "Content-Type": "application/json" } }),
    );
  });
}

async function readState(page: Page): Promise<{ archive: string; checkedAt: number; lastCheck?: { outcome: string } }> {
  return page.evaluate(async () => {
    const res = await (await caches.open("autonomi-loader-meta")).match("/_autonomi/state.json");
    return res!.json();
  });
}

test("a due check with no new version records the check and serves the cached site", async ({ page }) => {
  await install(page, POINTER, "#view");
  await expireCheck(page);
  await page.reload();
  await expect(page.locator("#view")).toHaveText("Home", { timeout: 15_000 });
  const state = await readState(page);
  expect(state.archive).toBe(fixture("spa").address);
  expect(state.lastCheck?.outcome).toBe("no change");
  expect(Date.now() - state.checkedAt).toBeLessThan(60_000);
});

test("a re-pointed pointer installs the new version on the next due check", async ({ page, context }) => {
  await install(page, POINTER, "#view");
  // Re-point: the pointer now targets the plain site's archive.
  const pointerFile = `/_autonomi/fixtures/pointers/${fixture(POINTER).address}.json`;
  await context.route(`**${pointerFile}`, (route) =>
    route.fulfill({ json: { kind: "chunk", target: fixture("plain").address } }),
  );
  // Not due yet: still the old version, and no pointer read.
  await page.reload();
  await expect(page.locator("#view")).toHaveText("Home");

  await expireCheck(page);
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-page", "home", { timeout: 15_000 });
  const state = await readState(page);
  expect(state.archive).toBe(fixture("plain").address);
  expect(state.lastCheck?.outcome).toBe("new version installed");
  // The old archive's cache is gone.
  const names = await page.evaluate(() => caches.keys());
  expect(names.filter((n) => n.startsWith("site-v1-"))).toEqual([`site-v1-${fixture("plain").address}`]);
});

test("a slow check falls back to the cached site within the budget", async ({ page }) => {
  await install(page, POINTER, "#view");
  await expireCheck(page);
  // A short budget keeps the test fast; the fixture source waits past it in connect().
  await page.evaluate(() => {
    sessionStorage.setItem("checkBudgetMs", "3000");
    sessionStorage.setItem("fixtureDelay", "8000");
  });
  const started = Date.now();
  await page.reload();
  await expect(page.locator("#view")).toHaveText("Home", { timeout: 15_000 });
  const elapsed = Date.now() - started;
  expect(elapsed).toBeLessThan(5_500);
  const state = await readState(page);
  expect(state.lastCheck?.outcome).toBe("timed out");
  // Next check due in about 10 minutes, not a full hour.
  const dueIn = state.checkedAt + 60 * 60 * 1000 - Date.now();
  expect(dueIn).toBeGreaterThan(9 * 60 * 1000);
  expect(dueIn).toBeLessThan(11 * 60 * 1000);
});

test("a failed check falls back to the cached site", async ({ page, context }) => {
  await install(page, POINTER, "#view");
  await context.route("**/_autonomi/fixtures/pointers/**", (route) => route.fulfill({ status: 500, body: "down" }));
  await expireCheck(page);
  await page.reload();
  await expect(page.locator("#view")).toHaveText("Home", { timeout: 15_000 });
  expect((await readState(page)).lastCheck?.outcome).toMatch(/^failed/);
});

test("an expired check with the network offline serves the cached site", async ({ page, context }) => {
  await install(page, POINTER, "#view");
  await expireCheck(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#view")).toHaveText("Home", { timeout: 15_000 });
  await context.setOffline(false);
});

test("immutable links never check", async ({ page, context }) => {
  let pointerReads = 0;
  await context.route("**/_autonomi/fixtures/pointers/**", (route) => {
    pointerReads++;
    return route.continue();
  });
  await install(page, "spa", "#view");
  await expireCheck(page);
  await page.reload();
  await expect(page.locator("#view")).toHaveText("Home");
  expect(pointerReads).toBe(0);
});

test("the info page's check-now action runs a check", async ({ page }) => {
  await install(page, POINTER, "#view");
  await page.goto(siteUrl(POINTER, "/_autonomi/"));
  await page.getByRole("button", { name: "Check for a new version now" }).click();
  await expect(page.locator("#view")).toHaveText("Home", { timeout: 15_000 });
  await page.goto(siteUrl(POINTER, "/_autonomi/"));
  await expect(page.locator("[data-view=info]")).toContainText("no change");
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
});
