#!/usr/bin/env node
// M3 on mainnet, in two phases around a real pointer re-point. Needs a running preview of
// the production build on port 4174 (npx vite preview --port 4174) and a persistent profile.
//
//   node tools/m3-mainnet.mjs before <pointer hex>   # pointer -> spa-v1: install, expect "Version 1"
//   (re-point:  ant pointer update --key site.key <spa-v2 address>)
//   node tools/m3-mainnet.mjs after  <pointer hex>   # check due -> expect "Version 2"
// Add --budget <seconds> to raise the check's time budget (default 5 s).
//
// "before" also measures a return-visit pointer check with no change. The browser profile
// lives in test-results/m3-profile, so "after" sees the site "before" installed.

import { chromium } from "@playwright/test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { hexToLabelBody } from "../src/base32.ts";

const args = process.argv.slice(2);
const budgetAt = args.indexOf("--budget"); // seconds; sessionStorage "checkBudgetMs"
const budget = budgetAt >= 0 ? Number(args.splice(budgetAt, 2)[1]) * 1000 : undefined;
const [phase, rawHex] = args;
const hex = rawHex?.toLowerCase().replace(/^0x/, "");
if (!["before", "after"].includes(phase) || !/^[0-9a-f]{64}$/.test(hex ?? "")) {
  console.error("Usage: node tools/m3-mainnet.mjs before|after <pointer address>");
  process.exit(1);
}
const origin = `http://p${hexToLabelBody(hex)}.localhost:4174`;
const profile = join(fileURLToPath(new URL("..", import.meta.url)), "test-results", "m3-profile");
const context = await chromium.launchPersistentContext(profile, { headless: true });
const page = context.pages()[0] ?? (await context.newPage());
page.on("console", (m) => m.type() === "error" && console.log(`  console.error: ${m.text()}`));
if (budget) {
  await page.addInitScript((ms) => sessionStorage.setItem("checkBudgetMs", String(ms)), budget);
  console.log(`check budget: ${budget} ms`);
}

async function version(timeout = 150_000) {
  await page.waitForSelector("#version", { timeout });
  return page.getAttribute("#version", "data-version");
}

async function expireCheck() {
  await page.evaluate(async () => {
    const cache = await caches.open("autonomi-loader-meta");
    const state = await (await cache.match("/_autonomi/state.json")).json();
    state.checkedAt = 0;
    await cache.put("/_autonomi/state.json", new Response(JSON.stringify(state)));
  });
}

async function info() {
  await page.goto(`${origin}/_autonomi/`);
  const rows = await page.$$eval("[data-view=info] tr", (trs) =>
    trs.map((tr) => `${tr.querySelector("th")?.textContent}: ${tr.querySelector("td")?.textContent}`),
  );
  for (const r of rows) console.log(`  ${r}`);
}

let ok = false;
try {
  if (phase === "before") {
    let t = Date.now();
    await page.goto(`${origin}/`);
    const v = await version();
    console.log(`cold open through the pointer: version ${v} in ${Date.now() - t} ms`);

    await expireCheck();
    t = Date.now();
    await page.reload();
    const v2 = await version();
    console.log(`due check, no change: version ${v2} in ${Date.now() - t} ms`);
    await info();
    ok = v === "1" && v2 === "1";
    console.log(ok ? "\nNow re-point the pointer to spa-v2, then run the 'after' phase." : "\nUnexpected version.");
  } else {
    await page.goto(`${origin}/`);
    const cached = await version(30_000);
    console.log(`cached site before the check: version ${cached}`);
    await expireCheck();
    const t = Date.now();
    await page.reload();
    await page.waitForFunction(() => document.querySelector("#version")?.getAttribute("data-version") === "2", null, {
      timeout: 150_000,
    });
    console.log(`due check found the new version: version 2 in ${Date.now() - t} ms`);
    await info();
    ok = true;
  }
} catch (e) {
  console.log(`FAILED: ${e.message.split("\n")[0]}`);
} finally {
  await context.close();
  process.exit(ok ? 0 : 1);
}
