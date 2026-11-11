#!/usr/bin/env node
// Open a loader URL in a fresh Chromium profile and log what the shell does, with timings.
//   node tools/probe.mjs <url> [--timeout <seconds>] [--headed] [--debug] [--concurrency <n>]
// --debug also prints every SDK progress event (sessionStorage "autonomiDebug").
// Prints each loading step, console errors, CSP violations, the final view, and (for a
// site that installed) the timings from its info page. Used for M2 smoke tests and M5.

import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const timeout = Number(flag("--timeout") ?? 120) * 1000;
const concurrency = flag("--concurrency");
const headed = args.includes("--headed");
const debug = args.includes("--debug");
const url = args.find((a) => !a.startsWith("--"));
if (!url) {
  console.error("Usage: node tools/probe.mjs <url> [--timeout <seconds>] [--headed]");
  process.exit(1);
}

const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(2).padStart(7)} s`;
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext();
const page = await context.newPage();

page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning" || (debug && m.type() === "debug")) console.log(`${stamp()}  console.${m.type()}: ${m.text()}`);
});
page.on("pageerror", (e) => console.log(`${stamp()}  page error: ${e.message}`));
page.on("framenavigated", (f) => {
  if (f === page.mainFrame()) console.log(`${stamp()}  navigated: ${f.url()}`);
});
await page.exposeFunction("__probeStep", (text) => console.log(`${stamp()}  step: ${text}`));
if (concurrency) await page.addInitScript((n) => sessionStorage.setItem("autonomiConcurrency", n), concurrency);
if (debug) await page.addInitScript(() => sessionStorage.setItem("autonomiDebug", "1"));
await page.addInitScript(() => {
  document.addEventListener("securitypolicyviolation", (e) =>
    console.error(`CSP violation: ${e.violatedDirective} blocked ${e.blockedURI}`),
  );
  let last = "";
  const report = () => {
    const step = document.querySelector("[data-testid=step]")?.textContent ?? "";
    const detail = document.querySelector(".detail")?.textContent ?? "";
    const text = detail ? `${step} (${detail})` : step;
    if (text && text !== last) {
      last = text;
      window.__probeStep(text);
    }
  };
  new MutationObserver(report).observe(document, { subtree: true, childList: true, characterData: true });
});

let outcome = "timeout";
try {
  await page.goto(url);
  // Done when the shell shows an error, or the page is no longer the shell (the site loaded).
  await page.waitForFunction(
    () => {
      const view = document.querySelector("[data-view]")?.getAttribute("data-view");
      if (view === "error" || view === "landing" || view === "info") return true;
      return !document.getElementById("app") && document.readyState === "complete";
    },
    null,
    { timeout, polling: 200 },
  );
  const view = await page.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? "site");
  outcome = view;
  if (view === "error") {
    const err = await page.evaluate(() => ({
      title: document.querySelector("h1")?.textContent,
      message: document.querySelector("[data-testid=error-message]")?.textContent,
    }));
    console.log(`${stamp()}  ERROR: ${err.title}\n           ${err.message}`);
  } else if (view === "site") {
    console.log(`${stamp()}  site loaded: ${await page.title()}`);
    await page.goto(new URL("/_autonomi/", page.url()).href);
    // A named site's info page reads the name directory before it renders.
    await page.waitForSelector("[data-view=info] tr", { timeout: 20_000 }).catch(() => {});
    const rows = await page.$$eval("[data-view=info] tr", (trs) =>
      trs.map((tr) => `${tr.querySelector("th")?.textContent}: ${tr.querySelector("td")?.textContent}`),
    );
    for (const r of rows) console.log(`           ${r}`);
  }
} catch (e) {
  console.log(`${stamp()}  ${e.message.split("\n")[0]}`);
} finally {
  console.log(`${stamp()}  outcome: ${outcome}`);
  await browser.close();
}
