// The demo sites (sites/, DEMO.md) on the fixture source, reached by short name as on the live
// loader: Start through its pointer, links to the Library and back by portable name links,
// history, the receipt, and where the page came from.
// This is also milestone M4's "two sites link to each other and back; history works".

import { expect, test } from "@playwright/test";
import { fixture, nameUrl, openName } from "./helpers";

const START_POINTER = "demo: Antnet Start";
const LIBRARY = "demo: The Library";

test("Start says where it came from: the claim, the receipt, this visit's timings", async ({ page }) => {
  await openName(page, "start", ".cards");
  await expect(page.locator(".claim")).toContainText("wasn't sent by a web server");
  await expect(page.locator(".card-title")).toHaveText(["The Library", "ColonySim", "Cinema", "Download Button"]);
  const receipt = page.locator(".receipt-main");
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText("No server sent this page");
  await expect(receipt).toContainText(/\d+ (kB|MB|bytes)/);
  await expect(page.locator(".journey")).toBeVisible();
  await expect(page.locator('[data-step="find"] .t')).not.toBeEmpty();
});

test("Start explains its short name and shows the full address on click", async ({ page }) => {
  await openName(page, "start", ".cards");
  const note = page.locator('[data-note="name"]');
  await expect(note).toBeVisible();
  await expect(note.locator("[data-name]")).toHaveText("start");
  await expect(page.locator('[data-note="address"]')).toBeHidden();
  const full = note.locator("[data-address-full]");
  await expect(full).toBeHidden();
  await note.locator(".address-toggle").click();
  await expect(full).toHaveText(`Pointer ${fixture(START_POINTER).address}`);
});

test("Start lists the records the page arrived as, and the nodes that served them", async ({ page }) => {
  await openName(page, "start", ".cards");
  const origin = page.locator(".origin");
  await expect(origin).toBeVisible();
  // The fixture source names its one "node" for every record, so the count is known.
  await expect(origin.locator(".origin-lead")).toHaveText("This page came from 1 computer on the Autonomi network.");
  await expect(origin.locator(".record")).toHaveCount(4);
  await expect(origin.locator(".record").first()).toContainText("DataMap");
  await expect(origin.locator(".record").nth(1)).toContainText("Chunk 1");
  await expect(origin.locator(".origin-tip")).toContainText("developer tools");
});

test("Start fetches each listed site in the background; opening it then needs no network", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "WebKit keeps framed storage apart on *.localhost (see warm.spec.ts)");
  await openName(page, "start", ".cards");
  const card = page.locator('.card[data-site="library"]');
  await expect(card).toHaveAttribute("data-warm", "ready", { timeout: 15_000 });
  await expect(card.locator("[data-status]")).toHaveText("Ready");

  let fetches = 0;
  // Only the Library's own: the other cards may still be warming in the background.
  page.context().on("request", (r) => {
    if (new URL(r.url()).hostname.startsWith("library.") && /\/_autonomi\/fixtures\/(pointers\/|[0-9a-f]{64}\.tar)/.test(r.url())) fetches++;
  });
  await card.locator(".card-link").click();
  await expect(page.locator(".shelf")).toBeVisible();
  expect(fetches).toBe(0);
});

test("the publish command names the loader in use", async ({ page }) => {
  await openName(page, "start", ".cards");
  await expect(page.locator("[data-loader-root]")).toHaveText("localhost:4173");
});

test("Start and the Library link to each other by name, and history works", async ({ page }) => {
  await openName(page, "start", ".cards");

  // Start -> Library, by a portable name link.
  await expect(page.locator(".card-link").first()).toHaveAttribute("href", "/_autonomi/go/name/library/");
  await page.locator(".card-link").first().click();
  await expect(page.locator(".shelf .book")).toHaveCount(4, { timeout: 15_000 });
  expect(new URL(page.url()).hostname).toBe("library.localhost");
  await expect(page.locator("[data-antnet-receipt]")).toBeVisible();
  await expect(page.locator(".colophon-line")).toContainText("Published 11 November 2026.");

  // Into a book, which carries its credit.
  await page.getByRole("link", { name: /The Time Machine/ }).click();
  await expect(page.locator(".book-head h1")).toHaveText("The Time Machine");
  await expect(page.locator(".credit")).toContainText("public domain");

  // Library -> Start, by the portable name link in the header.
  await expect(page.locator(".antnet-start")).toHaveAttribute("href", "/_autonomi/go/name/start/");
  await page.locator(".antnet-start").click();
  await expect(page.locator(".cards")).toBeVisible({ timeout: 15_000 });
  expect(new URL(page.url()).hostname).toBe("start.localhost");

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

test("installed sites and the links between them need no network", async ({ page, context }) => {
  await openName(page, "start", ".cards");
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

test("the Library's archive is far under the four-record limit", async ({ request }) => {
  const res = await request.get(`http://localhost:4173/_autonomi/fixtures/${fixture(LIBRARY).address}.tar`);
  expect(res.ok()).toBe(true);
  expect((await res.body()).length).toBeLessThan(12 * 1024 * 1024);
});

test("a missing book page shows the Library's own 404", async ({ page }) => {
  await openName(page, "library", ".shelf");
  const res = await page.goto(nameUrl("library", "/books/no-such-book/"));
  expect(res?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Not on this shelf");
});

test("ColonySim runs, saves itself and is still there after a reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await openName(page, "colonysim", "#colony");
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("colonysim:v1") ?? "null")?.step ?? 0);
  await expect.poll(saved, { timeout: 15_000 }).toBeGreaterThan(0);

  // Draw a wall across the middle; it is saved with the colony.
  const box = (await page.locator("#colony").boundingBox())!;
  await page.getByRole("button", { name: "Wall" }).click();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.7, { steps: 8 });
  await page.mouse.up();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("colonysim:v1")!));

  await page.reload();
  await expect(page.locator("#colony")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-restored", "");
  await expect.poll(saved, { timeout: 15_000 }).toBeGreaterThan(before.step);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("colonysim:v1")!));
  expect(after.founded).toBe(before.founded);
  expect(after.wall).toBe(before.wall);
  await expect(page.locator("[data-day]")).toHaveText("Day 1");
  expect(errors).toEqual([]);
});
