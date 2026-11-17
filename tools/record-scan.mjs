#!/usr/bin/env node
// Can a browser fetch every record of a public file? Reads one byte from the middle of each
// of its data records through the browser SDK (as Cinema's player does), several at a time,
// and reports those that are slow or never arrive. A record the CLI fetches but the browser
// can't stops a stream at that point (PROGRESS.md, "Cinema in 4K").
// Self-encryption splits a file into equal chunks, so record i spans about
// [i * size / n, (i + 1) * size / n); n is the data chunk count the CLI printed on upload.
// Needs the dev server: npx cross-env VITE_SOURCE=autonomi vite --port 5180 --strictPort
//   node tools/record-scan.mjs <address> <data chunks> [<address> <data chunks> ...]
// Each read waits up to 90 s (the SDK retries a missing record after 15 and 45 s).

import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const files = [];
for (let i = 0; i < args.length; i += 2) {
  const address = args[i]?.toLowerCase().replace(/^0x/, "");
  const chunks = Number(args[i + 1]);
  if (!/^[0-9a-f]{64}$/.test(address ?? "") || !Number.isInteger(chunks) || chunks < 1) {
    console.error("Usage: node tools/record-scan.mjs <address> <data chunks> [<address> <data chunks> ...]");
    process.exit(1);
  }
  files.push({ address, chunks });
}

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => console.log(m.text()));
await page.goto("http://localhost:5180/_autonomi/");
for (const file of files) {
  await page.evaluate(async ({ address, chunks }) => {
    const { AutonomiClient } = await import("/@id/@withautonomi/ant-browser-sdk");
    const PARALLEL = 8;
    const TIMEOUT_MS = 90_000;
    const client = await AutonomiClient.connect();
    const reader = await client.openFile(address);
    const started = performance.now();
    const results = new Array(chunks);
    let next = 0;
    async function worker() {
      while (next < chunks) {
        const i = next++;
        const at = Math.floor(((i + 0.5) * reader.size) / chunks);
        const t = performance.now();
        const outcome = await Promise.race([
          reader.read(at, 1).then(
            () => "ok",
            (e) => `failed: ${e instanceof Error ? e.message : e}`,
          ),
          new Promise((r) => setTimeout(() => r("no answer in 90 s"), TIMEOUT_MS)),
        ]);
        results[i] = { i, at, ms: performance.now() - t, outcome };
      }
    }
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    const bad = results.filter((r) => r.outcome !== "ok");
    const slow = results.filter((r) => r.outcome === "ok" && r.ms > 10_000);
    const mib = (n) => (n / 1048576).toFixed(1);
    console.log(`${address.slice(0, 8)}…: ${chunks} records, ${chunks - bad.length} fetched, in ${((performance.now() - started) / 1000).toFixed(0)} s`);
    for (const r of bad) console.log(`  record ${r.i} (byte ${r.at}, ${mib(r.at)} MiB): ${r.outcome}`);
    for (const r of slow) console.log(`  record ${r.i} (${mib(r.at)} MiB): slow, ${(r.ms / 1000).toFixed(1)} s`);
    reader.close();
    client.close();
  }, file);
}
await browser.close();
