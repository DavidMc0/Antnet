#!/usr/bin/env node
// Check background update checks (DEMO.md 5.3) on the live loader: install a site in a fresh
// profile, make its check due, reload, and confirm the page is served at once while the check
// runs afterwards and is recorded.
//
//   node tools/checks-live.mjs [--root antnet.autonomirror.com] [--sites start,library] [--browsers chromium,firefox]

import { chromium, firefox, webkit } from "@playwright/test";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const root = flag("--root", "antnet.autonomirror.com");
const sites = flag("--sites", "start,library").split(",");
const engines = { chromium, firefox, webkit };
const browsers = flag("--browsers", "chromium,firefox").split(",");
const READY = { start: ".cards", library: ".shelf" };

const state = (page) =>
  page.evaluate(async () => {
    const res = await (await caches.open("autonomi-loader-meta")).match("/_autonomi/state.json");
    return res ? res.json() : null;
  });

async function run(engine, site) {
  const tag = `[${engine} ${site}]`;
  const browser = await engines[engine].launch();
  const page = await (await browser.newContext()).newPage();
  try {
    let t = Date.now();
    await page.goto(`https://${site}.${root}/`);
    await page.waitForSelector(READY[site], { timeout: 150_000 });
    console.log(`${tag} installed in ${((Date.now() - t) / 1000).toFixed(1)} s`);
    const script = await page.evaluate(() => document.head.firstElementChild?.getAttribute("src"));
    console.log(`${tag} loader script first in <head>: ${script === "/_autonomi/check.js" ? "yes" : `no (${script})`}`);

    // Make the check due, then reload.
    await page.evaluate(async () => {
      const cache = await caches.open("autonomi-loader-meta");
      const s = await (await cache.match("/_autonomi/state.json")).json();
      s.checkedAt = 0;
      await cache.put("/_autonomi/state.json", new Response(JSON.stringify(s), { headers: { "Content-Type": "application/json" } }));
    });
    t = Date.now();
    await page.reload();
    await page.waitForSelector(READY[site], { timeout: 30_000 });
    const shown = Date.now() - t;
    console.log(`${tag} with a check due, the page showed in ${shown} ms`);

    // Wait for the background check to record its outcome.
    const deadline = Date.now() + 90_000;
    let s = await state(page);
    while ((!s?.lastCheck || s.lastCheck.at < t) && Date.now() < deadline) {
      await page.waitForTimeout(1000);
      s = await state(page);
    }
    const ok = s?.lastCheck && s.lastCheck.at >= t;
    console.log(
      `${tag} background check: ${ok ? `${s.lastCheck.outcome} in ${(s.lastCheck.ms / 1000).toFixed(1)} s` : "no outcome within 90 s"}` +
        `; notice shown: ${(await page.locator("antnet-notice").count()) > 0 ? "yes" : "no"}`,
    );
    return ok && shown < 3000 ? null : `${tag} failed`;
  } catch (e) {
    return `${tag} ${e.message.split("\n")[0]}`;
  } finally {
    await browser.close();
  }
}

const jobs = browsers.flatMap((b) => sites.map((s) => run(b, s)));
const problems = (await Promise.all(jobs)).filter(Boolean);
console.log(problems.length ? `\n${problems.join("\n")}` : "\nAll background checks behaved as expected.");
