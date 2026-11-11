#!/usr/bin/env node
// Pack a built site folder into a deterministic ustar archive (spec 6).
//   node tools/pack.mjs <folder> <out.tar> [--nonce <text>]

import { createHash } from "node:crypto";
import { stat, writeFile } from "node:fs/promises";
import { packDir } from "./tar-writer.mjs";

const args = process.argv.slice(2);
let nonce;
const nonceAt = args.indexOf("--nonce");
if (nonceAt >= 0) {
  nonce = args[nonceAt + 1];
  if (!nonce) fail("--nonce needs a value");
  args.splice(nonceAt, 2);
}
const [dir, out] = args;
if (!dir || !out) fail("Usage: node tools/pack.mjs <folder> <out.tar> [--nonce <text>]");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const info = await stat(dir).catch(() => null);
if (!info?.isDirectory()) fail(`Not a folder: ${dir}`);
const bytes = await packDir(dir, { nonce });
await writeFile(out, bytes);
const mib = (bytes.length / 1024 / 1024).toFixed(2);
console.log(`Wrote ${out}: ${bytes.length} bytes (${mib} MiB)`);
console.log(`sha256 ${createHash("sha256").update(bytes).digest("hex")}`);
if (bytes.length > 64 * 1024 * 1024) console.warn("Warning: over the loader's 64 MiB limit.");
else if (bytes.length > 10 * 1024 * 1024) console.warn("Note: over about 10 MB, first opens will be slow.");
