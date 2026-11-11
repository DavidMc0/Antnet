#!/usr/bin/env node
// Check warm-up on the live loader in Chromium, Firefox and WebKit (DEMO.md 5.2):
// open the front door in a fresh profile, wait until it says Start is ready, click Enter, and
// see whether Start appears at once from what the frame installed, or loads again.
//
//   node tools/warm-live.mjs [--root antnet.autonomirror.com] [--browsers chromium,firefox,webkit]

import { chromium, firefox, webkit } from "@playwright/test";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const root = flag("--root", "antnet.autonomirror.com");
const engines = { chromium, firefox, webkit };
const which = flag("--browsers", "chromium,firefox,webkit").split(",");

async function run(name) {
  const browser = await engines[name].launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const t0 = Date.now();
  const s = () => `${((Date.now() - t0) / 1000).toFixed(1)} s`;
  try {
    await page.goto(`https://${root}/`);
    await page.waitForSelector("[data-door]", { timeout: 30_000 });
    await page.waitForFunction(() => document.querySelector("[data-door]")?.getAttribute("data-door") !== "working", null, {
      timeout: 150_000,
    });
    const door = await page.getAttribute("[data-door]", "data-door");
    const status = await page.textContent("[data-testid=door-status]");
    console.log(`[${name}] ${s()}  front door: ${door} (${status})`);
    if (door !== "ready") return `${name}: the background fetch didn't finish (${status})`;

    // Watch for the loader's loading screen on the way into Start.
    let sawLoading = false;
    page.on("framenavigated", async (f) => {
      if (f !== page.mainFrame()) return;
      const view = await f.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view")).catch(() => null);
      if (view === "loading") sawLoading = true;
    });
    const clicked = Date.now();
    await page.click("[data-testid=enter]");
    await page.waitForSelector(".cards", { timeout: 150_000 });
    const openMs = Date.now() - clicked;
    const installedAt = await page.evaluate(async () => {
      const res = await (await caches.open("autonomi-loader-meta")).match("/_autonomi/state.json");
      return res ? (await res.json()).installedAt : null;
    });
    const warmed = installedAt !== null && installedAt < clicked && !sawLoading;
    console.log(
      `[${name}] ${s()}  Enter -> Start in ${openMs} ms; installed ${installedAt && installedAt < clicked ? "before" : "after"} the click` +
        `${sawLoading ? "; loading screen shown" : ""}  => ${warmed ? "WARMED" : "NOT WARMED"}`,
    );
    return warmed ? null : `${name}: Start was fetched again after Enter`;
  } catch (e) {
    return `${name}: ${e.message.split("\n")[0]}`;
  } finally {
    await browser.close();
  }
}

const results = await Promise.all(which.map(run));
const problems = results.filter(Boolean);
console.log(problems.length ? `\n${problems.join("\n")}` : "\nWarm-up worked in every browser tried.");
