// The Download Button (DEMO.md 3.6): Autonomirror's download page and button generator, as an
// Antnet site, without uploads or payments. The code comes from github.com/DavidMc0/autonomirror
// (src/, static/*.css), changed to run under Antnet: links of the form /f/ant/<address>, a
// removal list read from Autonomi, no inline scripts. views/ holds each view's markup; this
// file puts the page together and bundles its script with the Autonomi client.

import { readFile } from "node:fs/promises";
import { bundleScript } from "../shared/bundle.mjs";

export const meta = {
  title: "Download Button",
  description: "Turn any file on Autonomi into a download button. The page and the file both come from the network.",
};

/** Every path the site has no file for serves the page, which picks its view from the address. */
export const settings = { spa: true };

/** Where buttons made with the generator send people (DEMO.md 3.6). */
export const PUBLIC_BASE = "https://download.antnet.autonomirror.com/";

/**
 * The page runs the Autonomi client (WebAssembly, direct connections to nodes). Unlike the other
 * sites it also allows inline styles: the generator previews a button exactly as it will look
 * on someone's site, and that markup carries its own style attributes, which the preview frame
 * (an srcdoc frame, which takes this page's policy) must apply. Scripts stay 'self' only.
 */
export const csp =
  "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https: wss:; " +
  "object-src 'none'; base-uri 'none'; form-action 'none'";

/** The removal list's pointer, from sites/addresses.json (`removalsPointer`); empty for none yet. */
async function removalsPointer() {
  try {
    const a = JSON.parse(await readFile(new URL("../addresses.json", import.meta.url), "utf8"));
    return /^[0-9a-f]{64}$/.test(a.removalsPointer ?? "") ? a.removalsPointer : "";
  } catch {
    return "";
  }
}

const view = (name) => readFile(new URL(`views/${name}.html`, import.meta.url), "utf8");

/** The site's script with the Autonomi client (app/main.js, its views and its WebAssembly), bundled once per run. */
let appFiles;
const app = () =>
  (appFiles ??= bundleScript({ entry: new URL("src/main.ts", import.meta.url), root: new URL(".", import.meta.url), dir: "app", name: "main" }));

export async function build(ctx) {
  const files = new Map(await app());
  const fill = (html) => html.replaceAll("{{startLink}}", ctx.startLink);
  const [generator, download, pointer] = await Promise.all([view("generator"), view("download"), removalsPointer()]);

  files.set(
    "index.html",
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Download Button</title>
<meta name="description" content="${ctx.esc(meta.description)}">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#0a1020">
<meta name="download-base" content="${PUBLIC_BASE}">
<meta name="removals-pointer" content="${pointer}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%23e91337'/%3E%3Cpath d='M16 8v12m-5-5 5 5 5-5M10 24h12' stroke='white' stroke-width='2.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<script src="/theme.js"></script>
${ctx.headTags}
<link rel="stylesheet" href="/styles.css">
<script type="module" src="/app/main.js"></script>
</head>
<body>
<div id="view"></div>

<template id="view-generator">
${fill(generator)}</template>

<template id="view-download">
${fill(download)}</template>

<div class="antnet-strip">
  ${ctx.receipt}
</div>
</body>
</html>
`,
  );
  return files;
}
