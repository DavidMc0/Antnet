#!/usr/bin/env node
// The Download Button's removal list (DEMO.md 3.6): files its page won't serve. Published by hand,
// with a funded wallet, whenever it changes. The page reads it through a pointer, so this repo
// never holds the list itself: the addresses live in publish/removals.txt, which is gitignored.
//
//   node sites/removals.mjs                   build publish/removals.json from publish/removals.txt
//   node sites/removals.mjs record <address>  note the address the upload printed; says how to move the pointer
//
// publish/removals.txt: one removed address per line (64 hex characters, 0x is fine). Anything
// after a # is a comment, for the reason and the date. The published file holds only the SHA-256
// of each address, hashed as its lowercase hex text, so a permanent public copy isn't an index of
// removed files:
//   { "v": 1, "updated": "<ISO time>", "sha256": ["<hex>", …] }
//
// The pointer: create its key once with `ant pointer keygen --output publish/removals.key`, then
// record its address (`ant pointer address --key publish/removals.key`) with
// `node sites/build.mjs record removals-pointer …`. The Download Button is built with it, so do that
// before the site is uploaded. Until a list is published, the page has nothing to refuse.

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const LIST = join(ROOT, "publish", "removals.txt");
const OUT = join(ROOT, "publish", "removals.json");
const ADDRESSES = join(ROOT, "sites", "addresses.json");
const KEY = "publish/removals.key";

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const isHex = (s) => /^[0-9a-f]{64}$/.test(s);

/** The addresses in publish/removals.txt, checked and without duplicates. */
export function parseRemovalsText(text) {
  const addresses = new Set();
  text.split(/\r?\n/).forEach((line, i) => {
    const value = line.replace(/#.*/, "").trim().toLowerCase().replace(/^0x/, "");
    if (!value) return;
    if (!isHex(value)) throw new Error(`publish/removals.txt, line ${i + 1}: "${value}" isn't a 64-character address`);
    addresses.add(value);
  });
  return [...addresses];
}

/** The file to publish: sorted hashes, so the same list always gives the same bytes but for its date. */
export function removalsFile(addresses, updated) {
  return JSON.stringify({ v: 1, updated, sha256: addresses.map((a) => sha256(a)).sort() }, null, 2) + "\n";
}

async function readAddresses() {
  return JSON.parse(await readFile(ADDRESSES, "utf8"));
}

async function build() {
  let text;
  try {
    text = await readFile(LIST, "utf8");
  } catch {
    throw new Error(`No ${LIST}. Put one removed address per line in it (with a # comment saying why), then run this again.`);
  }
  const addresses = parseRemovalsText(text);
  const updated = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const file = removalsFile(addresses, updated);
  await writeFile(OUT, file);
  const a = await readAddresses();
  console.log(`publish/removals.json: ${addresses.length} removed ${addresses.length === 1 ? "file" : "files"}, dated ${updated}.`);
  if (!isHex(a.removalsPointer ?? "")) {
    console.log("\nThe removal list has no pointer yet. Once, before the Download Button is uploaded:");
    console.log(`  ant pointer keygen --output ${KEY}      (back the key up)`);
    console.log(`  ant pointer address --key ${KEY}`);
    console.log("and record the address that prints with: node sites/build.mjs record removals-pointer, followed by it.");
  }
  console.log("\nThen, with SECRET_KEY set:");
  console.log("  ant file upload publish/removals.json --public");
  console.log("and record the address it prints with: node sites/removals.mjs record, followed by it.");
}

async function record(raw) {
  const address = raw?.toLowerCase().replace(/^0x/, "");
  if (!isHex(address ?? "")) throw new Error("Give the 64-character address the upload printed.");
  const bytes = await readFile(OUT);
  const file = JSON.parse(bytes.toString("utf8"));
  const a = await readAddresses();
  // The pointer is created with the first list and updated after that.
  const exists = a.removals?.pointerCreated === true;
  a.removals = { address, sha256: sha256(bytes), updated: file.updated, count: file.sha256.length, pointerCreated: exists };
  await writeFile(ADDRESSES, JSON.stringify(a, null, 2) + "\n");
  console.log(`Recorded the removal list: ${address} (${file.sha256.length} entries).`);
  console.log("\nNow point the Download Button at it, with SECRET_KEY set:");
  console.log(`  ant pointer ${exists ? "update" : "create"} --key ${KEY} ${address}`);
  if (!exists) console.log("\nOnce that has run, note it with: node sites/removals.mjs created");
}

async function created() {
  const a = await readAddresses();
  if (!a.removals) throw new Error("No removal list recorded yet.");
  a.removals.pointerCreated = true;
  await writeFile(ADDRESSES, JSON.stringify(a, null, 2) + "\n");
  console.log("Noted: the pointer exists, so later lists update it.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, arg] = process.argv.slice(2);
  (command === "record" ? record(arg) : command === "created" ? created() : build()).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
