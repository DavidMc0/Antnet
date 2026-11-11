#!/usr/bin/env node
// Build the fixture source's files (spec 11.2): public/_autonomi/fixtures/
//   <sha256>.tar            one archive per fixture; the address is the SHA-256 of its bytes
//   pointers/<addr>.json    { kind, target } for pointer fixtures
//   index.json              name -> { kind, address, listed? } for the landing page and tests

import { createHash } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { packDir, writeTar } from "./tar-writer.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "fixtures");
const OUT = join(ROOT, "public", "_autonomi", "fixtures");

const enc = new TextEncoder();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const index = {};

await rm(OUT, { recursive: true, force: true });
await mkdir(join(OUT, "pointers"), { recursive: true });

async function addArchive(name, bytes, listed = true) {
  const address = sha256(bytes);
  await writeFile(join(OUT, `${address}.tar`), bytes);
  index[name] = { kind: "i", address, ...(listed ? {} : { listed: false }) };
  return address;
}

async function addPointer(name, kind, target, listed = true) {
  const address = sha256(enc.encode(`fixture-pointer:${name}`));
  await writeFile(join(OUT, "pointers", `${address}.json`), JSON.stringify({ kind, target }) + "\n");
  index[name] = { kind: "p", address, ...(listed ? {} : { listed: false }) };
  return address;
}

// 1. Sample sites from fixtures/<name>/.
const sites = {};
for (const d of await readdir(SRC, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  sites[d.name] = await addArchive(d.name, await packDir(join(SRC, d.name)));
}

// 2. Pointers: one to the SPA, a two-hop chain to the plain site, one to a non-file target.
if (sites.spa) await addPointer("spa (pointer)", "chunk", sites.spa);
if (sites.plain) {
  const inner = await addPointer("plain (pointer, inner)", "chunk", sites.plain, false);
  await addPointer("plain (pointer chain)", "pointer", inner);
}
await addPointer("pointer-not-chunk", "graph_entry", "00".repeat(32), false);
await addPointer("pointer-to-missing", "chunk", "ee".repeat(32), false);

// 3. Hostile and broken archives (spec 5.1). None of these may install anything.
const html = enc.encode("<!doctype html><title>bad</title><p>Should never be served.</p>\n");
const bad = {
  "bad-dotdot": [{ path: "index.html", bytes: html }, { path: "../evil.html", bytes: html }],
  "bad-absolute": [{ path: "index.html", bytes: html }, { path: "/etc/evil.html", bytes: html }],
  "bad-symlink": [{ path: "index.html", bytes: html }, { path: "link", type: "2", linkname: "/etc/passwd" }],
  "bad-hardlink": [{ path: "index.html", bytes: html }, { path: "copy.html", type: "1", linkname: "index.html" }],
  "bad-duplicate": [{ path: "index.html", bytes: html }, { path: "index.html", bytes: html }],
  "bad-no-index": [{ path: "readme.txt", bytes: enc.encode("No index.html here.\n") }],
  "bad-settings": [{ path: "index.html", bytes: html }, { path: ".autonomi-site.json", bytes: enc.encode("{not json") }],
};
for (const [name, entries] of Object.entries(bad)) await addArchive(name, writeTar(entries), false);

// Not a tar at all: deterministic pseudo-random bytes.
const noise = new Uint8Array(4096);
for (let i = 0, seed = enc.encode("not-a-tar"); i < noise.length; i += 32) {
  seed = createHash("sha256").update(seed).digest();
  noise.set(seed.subarray(0, Math.min(32, noise.length - i)), i);
}
await addArchive("not-a-tar", noise, false);

// An address with no file behind it.
index["missing"] = { kind: "i", address: "ab".repeat(32), listed: false };

await writeFile(join(OUT, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(`Fixtures written to ${OUT}`);
for (const [name, f] of Object.entries(index)) console.log(`  ${f.kind} ${f.address}  ${name}`);
