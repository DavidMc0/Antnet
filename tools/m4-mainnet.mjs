#!/usr/bin/env node
// M4 on mainnet, against the live loader: two published sites link to each other and back,
// history works, and a portable address link keeps its path, query and fragment.
//
//   node tools/m4-mainnet.mjs [--root antnet.autonomirror.com] [--spa <address>] [--headed]
//
// Needs Start and the Library published and in the loader's names.json (sites/build.mjs).
// --spa is any published SPA archive for the portable-link check; it defaults to the M2 test
// site. Uses a fresh browser profile, so every site is fetched from the network.

import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const root = flag("--root", "antnet.autonomirror.com");
const spa = flag("--spa", "9ea63625861bd3e72a31bf54af2f2e5daf9a1a1f0a04c5f5fb43d8e281a1e9e1").toLowerCase().replace(/^0x/, "");
const WAIT = 150_000;

const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(1).padStart(6)} s`;
const browser = await chromium.launch({ headless: !args.includes("--headed") });
const context = await browser.newContext();
const page = await context.newPage();
page.on("console", (m) => m.type() === "error" && console.log(`${stamp()}  console.error: ${m.text()}`));

const results = [];
function check(what, ok, detail = "") {
  results.push(ok);
  console.log(`${stamp()}  ${ok ? "PASS" : "FAIL"}  ${what}${detail ? `  (${detail})` : ""}`);
}
const host = () => new URL(page.url()).hostname;

async function timings(origin) {
  // Same context as the test page, so it sees the site that page installed.
  const p = await context.newPage();
  await p.goto(`${origin}/_autonomi/`);
  const text = await p
    .getByTestId("timings")
    .textContent({ timeout: 20_000 })
    .catch(() => "no timings");
  await p.close();
  return text;
}

try {
  // 1. Start, by name, through its pointer.
  await page.goto(`https://start.${root}/`);
  await page.waitForSelector(".cards", { timeout: WAIT });
  check("Start opens by name", host() === `start.${root}`, await timings(`https://start.${root}`));

  // 2. Start -> Library by a portable name link.
  await page.locator('.card[data-site="library"] .card-link').click();
  await page.waitForSelector(".shelf", { timeout: WAIT });
  check("Start links to the Library", host() === `library.${root}`, await timings(`https://library.${root}`));

  // 3. Into a book, then back to Start by the header link.
  await page.getByRole("link", { name: /The Time Machine/ }).click();
  await page.waitForSelector(".book-head", { timeout: 30_000 });
  await page.locator(".antnet-start").click();
  await page.waitForSelector(".cards", { timeout: 30_000 });
  check("The Library links back to Start", host() === `start.${root}`);

  // 4. History: back to the book, the shelf and Start, then forward again.
  await page.goBack();
  const book = await page.locator(".book-head h1").textContent({ timeout: 30_000 });
  await page.goBack();
  await page.waitForSelector(".shelf", { timeout: 30_000 });
  await page.goBack();
  await page.waitForSelector(".cards", { timeout: 30_000 });
  await page.goForward();
  await page.waitForSelector(".shelf", { timeout: 30_000 });
  check("Back and forward work across the two sites", book === "The Time Machine" && host() === `library.${root}`);

  // 5. A portable address link, from a site, keeps path, query and fragment (spec 11.4, M4).
  await page.goto(`https://library.${root}/_autonomi/go/ant/${spa}/users/42?from=m4#top`);
  await page.waitForFunction(() => document.querySelector("#view")?.textContent === "User 42", null, { timeout: WAIT });
  const url = new URL(page.url());
  check(
    "A portable address link keeps its path, query and fragment",
    url.pathname + url.search + url.hash === "/users/42?from=m4#top" && url.hostname.length === 54 + root.length,
    url.pathname + url.search + url.hash,
  );

  // 6. The root-domain path form reaches the same site as the direct link.
  await page.goto(`https://${root}/ant/${spa}/users/7`);
  await page.waitForFunction(() => document.querySelector("#view")?.textContent === "User 7", null, { timeout: WAIT });
  check("The root-domain path form reaches the same site", new URL(page.url()).hostname === url.hostname);
} catch (e) {
  check(`Stopped: ${e.message.split("\n")[0]}`, false, page.url());
} finally {
  await browser.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n${failed} of ${results.length} checks failed` : `\nAll ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
