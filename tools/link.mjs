#!/usr/bin/env node
// Address <-> label and URL (spec 7).
//   node tools/link.mjs i|p <64 hex> [--root loader.example]   → site URL
//   node tools/link.mjs <53-character label or site URL>       → kind and address
// A root with a port (e.g. localhost:5173) gives an http:// URL.

import { hexToLabelBody, labelBodyToHex } from "../src/base32.ts";

const args = process.argv.slice(2);
let root = process.env.LOADER_ROOT ?? "loader.example";
const rootAt = args.indexOf("--root");
if (rootAt >= 0) {
  root = args[rootAt + 1] ?? fail("--root needs a value");
  args.splice(rootAt, 2);
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const usage =
  "Usage: node tools/link.mjs i|p <64 hex> [--root host]\n       node tools/link.mjs <label or site URL>";

if (args.length === 2 && (args[0] === "i" || args[0] === "p")) {
  const hex = args[1].toLowerCase().replace(/^0x/, ""); // the ant CLI prints 0x-prefixed hex
  if (!/^[0-9a-f]{64}$/.test(hex)) fail("Address must be 64 hex characters.");
  const label = args[0] + hexToLabelBody(hex);
  const scheme = /:\d+$/.test(root) || root.startsWith("localhost") ? "http" : "https";
  console.log(`${scheme}://${label}.${root}/`);
} else if (args.length === 1) {
  let label = args[0].toLowerCase();
  try {
    label = new URL(label).hostname.split(".")[0];
  } catch {
    label = label.split(".")[0];
  }
  const kind = label[0];
  const hex = labelBodyToHex(label.slice(1));
  if ((kind !== "i" && kind !== "p") || !hex) fail("Not a canonical site label.");
  console.log(`${kind === "p" ? "pointer" : "immutable"} ${hex}`);
} else {
  fail(usage);
}
