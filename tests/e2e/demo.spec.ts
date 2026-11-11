// The demo sites (sites/, DEMO.md) on the fixture source: Start reached through its pointer,
// links to the Library and back by portable links, history, the receipt, and browsing offline.
// This is also milestone M4's "two sites link to each other and back; history works".

import { expect, test } from "@playwright/test";
import { fixture, install, labelFor, siteUrl } from "./helpers";

const START = "demo: Antnet Start";
const LIBRARY = "demo: The Library";

test("Start lists the Library, shows its receipt and this visit's timings", async ({ page }) => {
  await install(page, START, ".cards");
  await expect(page.locator(".card-title")).toHaveText(["The Library"]);
  const receipt = page.locator(".receipt-main");
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText("No server sent this page");
  await expect(receipt).toContainText(/\d+ (kB|MB|bytes)/);
  await expect(page.locator(".journey")).toBeVisible();
  await expect(page.locator('[data-step="find"] .t')).not.toBeEmpty();
});

test("Start and the Library link to each other, and history works", async ({ page }) => {
  await install(page, START, ".cards");

  // Start -> Library, by a portable immutable link.
  await page.locator(".card-link").first().click();
  await expect(page.locator(".shelf .book")).toHaveCount(4, { timeout: 15_000 });
  expect(new URL(page.url()).hostname).toBe(`${labelFor(LIBRARY)}.localhost`);
  await expect(page.locator("[data-antnet-receipt]")).toBeVisible();

  // Into a book, which carries its credit.
  await page.getByRole("link", { name: /The Time Machine/ }).click();
  await expect(page.locator(".book-head h1")).toHaveText("The Time Machine");
  await expect(page.locator(".credit")).toContainText("public domain");

  // Library -> Start, by the portable pointer link in the header.
  await page.locator(".antnet-start").click();
  await expect(page.locator(".cards")).toBeVisible({ timeout: 15_000 });
  expect(new URL(page.url()).hostname).toBe(`${labelFor(START)}.localhost`);

  // Back through the history: the book, then the shelf, then Start.
  await page.goBack();
  await expect(page.locator(".book-head h1")).toHaveText("The Time Machine");
  await page.goBack();
  await expect(page.locator(".shelf")).toBeVisible();
  await page.goBack();
  await expect(page.locator(".cards")).toBeVisible();
  await page.goForward();
  await expect(page.locator(".shelf")).toBeVisible();
});

test("after one visit to each, the tour works offline", async ({ page, context }) => {
  await install(page, START, ".cards");
  await page.locator(".card-link").first().click();
  await expect(page.locator(".shelf")).toBeVisible({ timeout: 15_000 });

  await context.setOffline(true);
  await page.locator(".antnet-start").click();
  await expect(page.locator(".cards")).toBeVisible();
  await page.locator(".card-link").first().click();
  await expect(page.locator(".shelf")).toBeVisible();
  await page.getByRole("link", { name: /A Study in Scarlet/ }).click();
  await expect(page.locator(".book-head h1")).toHaveText("A Study in Scarlet");
  await context.setOffline(false);
});

test("the Library's archive is a single small file set under the record limit", async ({ request }) => {
  const res = await request.get(`http://localhost:4173/_autonomi/fixtures/${fixture(LIBRARY).address}.tar`);
  expect(res.ok()).toBe(true);
  expect((await res.body()).length).toBeLessThan(12 * 1024 * 1024);
});

test("a missing book page shows the Library's own 404", async ({ page }) => {
  await install(page, LIBRARY, ".shelf");
  const res = await page.goto(siteUrl(LIBRARY, "/books/no-such-book/"));
  expect(res?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Not on this shelf");
});
