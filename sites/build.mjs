#!/usr/bin/env node
// Build the demo sites (DEMO.md) into archives ready to upload.
//
//   node sites/build.mjs                       build everything that can be built; say what's next
//   node sites/build.mjs record <site> <addr>  note the address an upload printed (0x is fine)
//
// Links between sites are never typed by hand: they come from sites/addresses.json.
// - startPointer: the address of Antnet Start's pointer, known as soon as its key exists
//   (ant pointer keygen / ant pointer address). Every content site links back to it.
// - sites.<name>: each content site's uploaded address, with the SHA-256 of the archive that
//   was uploaded, so a later change to the site is noticed before Start links to a stale copy.
// - start: every uploaded version of Start, oldest first. Start lists them as earlier versions.
//
// Archives go to publish/sites/, which is gitignored. The same inputs always give the same
// bytes, so rebuilding an unchanged site gives the same archive and the same address.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { packFiles, readDir } from "../tools/tar-writer.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "..");
const ADDRESSES = join(HERE, "addresses.json");
const OUT = join(ROOT, "publish", "sites");

/** Content sites, in upload order. Start is built last, from their addresses. */
export const CONTENT_SITES = ["library"];

/** The CSP every demo site declares: nothing from outside its own archive. */
const CSP =
  "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self'; script-src 'self'; " +
  "object-src 'none'; base-uri 'none'; form-action 'none'";

const enc = new TextEncoder();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const isHex = (s) => typeof s === "string" && /^[0-9a-f]{64}$/.test(s);

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Portable links (spec 7): resolved by whichever loader the visitor is using, even offline. */
export const goLink = {
  immutable: (address, path = "/") => `/_autonomi/go/ant/${address}${path}`,
  pointer: (address, path = "/") => `/_autonomi/go/p/ant/${address}${path}`,
};

async function loadSite(name) {
  return import(pathToFileURL(join(HERE, name, "site.mjs")).href);
}

/**
 * What a site's build() gets: links, shared markup and helpers.
 * `links.startPointer` is required; `links.sites` maps content site names to addresses.
 */
function context(links, extra = {}) {
  const startHref = goLink.pointer(links.startPointer);
  return {
    esc: escapeHtml,
    startHref,
    hrefFor(name, path) {
      const address = links.sites?.[name];
      if (!isHex(address)) throw new Error(`No address for "${name}" yet.`);
      return goLink.immutable(address, path);
    },
    /** For <head>: the shared stylesheet and the receipt script. */
    headTags: '<link rel="stylesheet" href="/antnet/antnet.css">\n<script src="/antnet/receipt.js" defer></script>',
    startLink: `<a class="antnet-start" href="${startHref}">Antnet Start</a>`,
    receipt: '<p class="antnet-receipt" data-antnet-receipt hidden></p>',
    ...extra,
  };
}

/** Files of sites/<name>/static, plus the shared pieces and the settings file. */
async function assemble(name, mod, built) {
  const files = new Map();
  for (const [path, bytes] of await readDir(join(HERE, name, "static")).catch(() => new Map())) files.set(path, bytes);
  for (const [path, value] of built) files.set(path, typeof value === "string" ? enc.encode(value) : value);
  files.set("antnet/antnet.css", await readFile(join(HERE, "shared", "antnet.css")));
  files.set("antnet/receipt.js", await readFile(join(HERE, "shared", "receipt.js")));
  const settings = {
    format: "autonomi-site/1",
    title: mod.meta.title,
    ...mod.settings,
    headers: { "/*": { "Content-Security-Policy": CSP }, ...mod.settings?.headers },
  };
  files.set(".autonomi-site.json", enc.encode(JSON.stringify(settings, null, 2) + "\n"));
  const tar = packFiles(files);
  return { name, meta: mod.meta, files, tar, sha256: sha256(tar), bytes: tar.length };
}

export async function buildContentSite(name, links) {
  const mod = await loadSite(name);
  return assemble(name, mod, await mod.build(context(links)));
}

/**
 * Build Start. `sites` is the list of content sites to show (name, meta, bytes, address);
 * `versions` the addresses of Start's earlier uploaded versions, oldest first.
 */
export async function buildStart(links, sites, versions = []) {
  const mod = await loadSite("start");
  const ctx = context(links, {
    sites: sites.map((s) => ({ ...s, href: goLink.immutable(s.address) })),
    versions: versions.map((v, i) => ({ ...v, number: i + 1, href: goLink.immutable(v.address) })),
  });
  return assemble("start", mod, await mod.build(ctx));
}

// ---------------------------------------------------------------------------------------
// Command line

async function readAddresses() {
  try {
    return JSON.parse(await readFile(ADDRESSES, "utf8"));
  } catch {
    return { startPointer: "", sites: {}, start: [] };
  }
}

async function saveAddresses(a) {
  await writeFile(ADDRESSES, JSON.stringify(a, null, 2) + "\n");
}

const hex = (s) => s?.toLowerCase().replace(/^0x/, "");

async function main(args) {
  const addresses = await readAddresses();
  addresses.sites ??= {};
  addresses.start ??= [];

  if (args[0] === "record") {
    const [, name, raw] = args;
    const address = hex(raw);
    if (!isHex(address)) throw new Error("Usage: node sites/build.mjs record <site> <64-hex address>");
    if (name === "start-pointer") {
      addresses.startPointer = address;
    } else if (name === "start") {
      // The archive just uploaded lists the versions recorded before it.
      const built = await buildStartFromAddresses(addresses, addresses.start);
      addresses.start.push({ address, sha256: built.sha256, date: new Date().toISOString().slice(0, 10) });
    } else if (CONTENT_SITES.includes(name)) {
      if (!isHex(addresses.startPointer)) throw new Error("Record the start pointer first.");
      const built = await buildContentSite(name, linksFrom(addresses));
      addresses.sites[name] = { address, sha256: built.sha256 };
    } else {
      throw new Error(`Unknown site "${name}". Sites: start-pointer, ${CONTENT_SITES.join(", ")}, start.`);
    }
    await saveAddresses(addresses);
    console.log(`Recorded ${name}: ${address}`);
    return;
  }

  if (!isHex(addresses.startPointer)) {
    console.log("No start pointer yet. Create Start's key and record its address first:");
    console.log("  ant pointer keygen --output publish/start.key");
    console.log("  ant pointer address --key publish/start.key");
    console.log("  node sites/build.mjs record start-pointer <address>");
    return;
  }

  await mkdir(OUT, { recursive: true });
  const links = linksFrom(addresses);
  const todo = [];
  for (const name of CONTENT_SITES) {
    const built = await buildContentSite(name, links);
    await writeFile(join(OUT, `${name}.tar`), built.tar);
    const rec = addresses.sites[name];
    const status = !rec
      ? "not uploaded yet"
      : rec.sha256 === built.sha256
        ? `uploaded at ${rec.address}`
        : "CHANGED since it was uploaded; upload again";
    if (!rec || rec.sha256 !== built.sha256) todo.push(name);
    console.log(`${name.padEnd(10)} ${kb(built.bytes)}  ${status}`);
  }

  if (todo.length) {
    console.log("\nUpload these, then record each address:");
    for (const name of todo) {
      console.log(`  ant file upload publish/sites/${name}.tar --public`);
      console.log(`  node sites/build.mjs record ${name} <address>`);
    }
    console.log("\nStart is built once every content site is uploaded.");
    return;
  }

  // Up to date if rebuilding the latest version (which lists the versions before it) gives
  // the archive that was uploaded. Otherwise build a new version listing all of them.
  const latest = addresses.start.at(-1);
  if (latest) {
    const current = await buildStartFromAddresses(addresses, addresses.start.slice(0, -1));
    if (current.sha256 === latest.sha256) {
      await writeFile(join(OUT, "start.tar"), current.tar);
      console.log(`start      ${kb(current.bytes)}  uploaded at ${latest.address} (version ${addresses.start.length})`);
      return;
    }
  }
  const start = await buildStartFromAddresses(addresses, addresses.start);
  await writeFile(join(OUT, "start.tar"), start.tar);
  console.log(`start      ${kb(start.bytes)}  new version ${addresses.start.length + 1}, ready to upload`);
  console.log("\nUpload it, record it, then point the pointer at it:");
  console.log("  ant file upload publish/sites/start.tar --public");
  console.log("  node sites/build.mjs record start <address>");
  console.log(
    addresses.start.length
      ? "  ant pointer update --key publish/start.key <address>"
      : "  ant pointer create --key publish/start.key <address>",
  );
}

function linksFrom(addresses) {
  return {
    startPointer: addresses.startPointer,
    sites: Object.fromEntries(Object.entries(addresses.sites).map(([n, r]) => [n, r.address])),
  };
}

async function buildStartFromAddresses(addresses, versions) {
  const links = linksFrom(addresses);
  const sites = [];
  for (const name of CONTENT_SITES) {
    const rec = addresses.sites[name];
    if (!rec) throw new Error(`${name} isn't uploaded yet.`);
    const built = await buildContentSite(name, links);
    sites.push({ name, meta: built.meta, bytes: built.bytes, address: rec.address });
  }
  return buildStart(links, sites, versions);
}

const kb = (n) => `${(n / 1024).toFixed(0).padStart(6)} KiB`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
