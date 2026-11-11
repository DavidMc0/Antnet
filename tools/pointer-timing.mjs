#!/usr/bin/env node
// Time the SDK's pointer reads in a real browser: getPointer vs resolvePointer.
// Needs the dev server: npx vite --port 5180 --strictPort
//   node tools/pointer-timing.mjs <pointer hex> [rounds] [wait ms after connect]

import { chromium } from "@playwright/test";

const hex = process.argv[2]?.toLowerCase().replace(/^0x/, "");
const rounds = Number(process.argv[3] ?? 3);
const wait = Number(process.argv[4] ?? 0); // ms to idle after connect before the first read
if (!/^[0-9a-f]{64}$/.test(hex ?? "")) {
  console.error("Usage: node tools/pointer-timing.mjs <pointer hex> [rounds]");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => console.log(`  ${m.text()}`));
await page.goto("http://localhost:5180/_autonomi/");
await page.evaluate(
  async ({ hex, rounds, wait }) => {
    const { AutonomiClient } = await import("/@id/@withautonomi/ant-browser-sdk");
    let t = performance.now();
    const client = await AutonomiClient.connect();
    console.log(`connect ${(performance.now() - t).toFixed(0)} ms`);
    if (wait) {
      await new Promise((r) => setTimeout(r, wait));
      console.log(`waited ${wait} ms`);
    }
    for (let i = 0; i < rounds; i++) {
      for (const op of ["getPointer", "resolvePointer"]) {
        t = performance.now();
        try {
          const r = await client[op](hex);
          console.log(`${op.padEnd(15)} ${(performance.now() - t).toFixed(0).padStart(6)} ms  -> ${r?.target ?? r}`);
        } catch (e) {
          console.log(`${op.padEnd(15)} ${(performance.now() - t).toFixed(0).padStart(6)} ms  FAILED ${e.message}`);
        }
      }
    }
    client.close?.();
  },
  { hex, rounds, wait },
);
await browser.close();
