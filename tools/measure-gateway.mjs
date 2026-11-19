#!/usr/bin/env node
// Cold opens of the demo sites through Antnet Gateway (the local loader, reading through antd)
// and through WebRTC (the hosted loader), for DEMO.md 12.14 step 2. Every open uses a new
// browser context, so the browser holds nothing. The two paths alternate, so changes in the
// network affect both. Timings come from the loader's own record of the install.
//
// Needs antd and the gateway running: antnet-gateway --loader dist-local
//   node tools/measure-gateway.mjs [--runs 10] [--sites start,cinema,library,colonysim,download]
//                                  [--browser chromium] [--out measurements.jsonl]
//
// antd keeps a chunk cache (64 chunks by default), so only each site's first gateway open is
// cold there; later ones may be served from antd's memory. Both are reported. For cold opens
// every time, start antd with --chunk-cache-capacity 1.

import { appendFileSync } from "node:fs";
import { chromium, firefox, webkit } from "@playwright/test";

const opt = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const RUNS = Number(opt("runs", "10"));
const SITES = opt("sites", "start,cinema,library,colonysim,download").split(",");
const BROWSER = { chromium, firefox, webkit }[opt("browser", "chromium")];
const OUT = opt("out", "");
const TIMEOUT_MS = 180_000;

const PATHS = {
  gateway: (name) => `http://${name}.antnet.localhost:47114/`,
  webrtc: (name) => `https://${name}.antnet.autonomirror.com/`,
};

/** Waits in the page until the loader has written the site's state, or shows an error. */
async function waitForInstall(page) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const r = await page.evaluate(async () => {
        if (await caches.has("autonomi-loader-meta")) {
          const res = await (await caches.open("autonomi-loader-meta")).match("/_autonomi/state.json");
          if (res) return { state: await res.json() };
        }
        const text = document.body?.innerText ?? "";
        if (/Couldn't|Nothing found|can't be opened|failed/i.test(text) && /Autonomi Site Loader/.test(document.title)) {
          return { error: text.replace(/\s+/g, " ").slice(0, 200) };
        }
        return null;
      });
      if (r) return r;
    } catch {
      // The page navigated while we looked: look again.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return { error: "timed out" };
}

async function open(browser, path, name) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const t0 = Date.now();
  try {
    await page.goto(PATHS[path](name), { timeout: TIMEOUT_MS });
    const r = await waitForInstall(page);
    const wallMs = Date.now() - t0;
    if (r.error) return { ok: false, wallMs, error: r.error };
    const s = r.state;
    return {
      ok: true,
      wallMs,
      via: s.via ?? "browser",
      archive: s.archive,
      bytes: s.bytes,
      blake3: s.blake3,
      ...s.timings,
    };
  } catch (e) {
    return { ok: false, wallMs: Date.now() - t0, error: String(e).split("\n")[0] };
  } finally {
    await context.close();
  }
}

const browser = await BROWSER.launch();
const results = [];
const seenGateway = new Set();
console.log(`${RUNS} runs × ${SITES.length} sites × 2 paths, ${opt("browser", "chromium")}`);
for (let run = 1; run <= RUNS; run++) {
  for (const name of SITES) {
    const order = run % 2 ? ["gateway", "webrtc"] : ["webrtc", "gateway"];
    for (const path of order) {
      const r = await open(browser, path, name);
      const coldAntd = path === "gateway" ? !seenGateway.has(name) : undefined;
      if (path === "gateway") seenGateway.add(name);
      const row = { at: new Date().toISOString(), run, site: name, path, coldAntd, ...r };
      results.push(row);
      if (OUT) appendFileSync(OUT, JSON.stringify(row) + "\n");
      const what = r.ok
        ? `${(r.wallMs / 1000).toFixed(1)} s (via ${r.via}; download ${((r.downloadMs ?? 0) / 1000).toFixed(1)} s)`
        : `FAILED after ${(r.wallMs / 1000).toFixed(1)} s: ${r.error}`;
      console.log(`run ${run} ${name.padEnd(9)} ${path.padEnd(7)} ${what}`);
    }
  }
}
await browser.close();

// Summary: medians and ranges per site and path, with failures and wrong paths counted.
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};
const sec = (ms) => (Number.isFinite(ms) ? (ms / 1000).toFixed(1) : "–");
console.log("\n| Site | Path | Opens | Failed | Median open | Fastest | Slowest | Median download | First gateway open |");
console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const name of SITES) {
  for (const path of ["gateway", "webrtc"]) {
    const rows = results.filter((r) => r.site === name && r.path === path);
    const ok = rows.filter((r) => r.ok);
    const wrongPath = ok.filter((r) => (path === "gateway") !== (r.via === "gateway")).length;
    const walls = ok.map((r) => r.wallMs);
    const first = rows.find((r) => r.coldAntd);
    console.log(
      `| ${name} | ${path}${wrongPath ? ` (${wrongPath} via other path)` : ""} | ${rows.length} | ${rows.length - ok.length} | ${sec(median(walls))} s | ${sec(Math.min(...walls))} s | ${sec(Math.max(...walls))} s | ${sec(median(ok.map((r) => r.downloadMs ?? NaN)))} s | ${path === "gateway" && first ? (first.ok ? `${sec(first.wallMs)} s` : "failed") : ""} |`,
    );
  }
}
