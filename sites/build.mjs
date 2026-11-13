#!/usr/bin/env node
// Build the demo sites (DEMO.md) into archives ready to upload, and the short-name directory.
//
//   node sites/build.mjs                          build every site; say what to do next
//   node sites/build.mjs record <site> <address>  note the address an upload printed (0x is fine)
//        [--cost "<what it cost>"]                 optionally, what the upload cost
//   node sites/build.mjs record start-pointer <address>
//   node sites/build.mjs record removals-pointer <address>   the Download Button's removal list
//   node sites/build.mjs record file <path> <address>          a file a site offers to download (an EPUB)
//
// Sites link to each other by short name (/_autonomi/go/name/<name>/), so no archive contains
// another site's address and they can be built and uploaded in any order. The addresses live
// in sites/addresses.json:
// - startPointer: the address of Antnet Start's pointer (ant pointer address --key …).
// - sites.<name>: each content site's uploaded address, with the SHA-256 and publish date of
//   the archive that was uploaded, so a later change to the site is noticed.
// - start: every uploaded version of Start, oldest first. Start lists them as earlier versions.
// From those, this script writes names.json at the repository root: the directory the loader
// serves at /_autonomi/names.json. Deploy the loader after it changes.
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
const NAMES = join(ROOT, "names.json");
const OUT = join(ROOT, "publish", "sites");

/** Content sites, in the order Start lists them. Start itself is built from their sizes. */
export const CONTENT_SITES = ["library", "colonysim", "cinema", "download"];

/** The CSP every demo site declares: nothing from outside its own archive. */
const CSP =
  "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self'; script-src 'self'; " +
  "object-src 'none'; base-uri 'none'; form-action 'none'";

const enc = new TextEncoder();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const isHex = (s) => typeof s === "string" && /^[0-9a-f]{64}$/.test(s);
const today = () => new Date().toISOString().slice(0, 10);

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** "2026-11-14" -> "14 November 2026". */
export function longDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1];
  return `${d} ${month} ${y}`;
}

/** Portable links (spec 7, DEMO.md 5.9): resolved by whichever loader the visitor is using. */
export const goLink = {
  name: (name, path = "/") => `/_autonomi/go/name/${name}${path}`,
  immutable: (address, path = "/") => `/_autonomi/go/ant/${address}${path}`,
};

async function loadSite(name) {
  return import(pathToFileURL(join(HERE, name, "site.mjs")).href);
}

/** Files uploaded for the sites to offer as downloads, by file name: { address, bytes }. */
async function uploadedFiles() {
  try {
    return JSON.parse(await readFile(ADDRESSES, "utf8")).files ?? {};
  } catch {
    return {};
  }
}

/** What a site's build() gets: links, shared markup and helpers. */
function context(extra = {}) {
  const startHref = goLink.name("start");
  return {
    esc: escapeHtml,
    longDate,
    startHref,
    /** A link to another demo site, by its short name. */
    hrefFor: (name, path) => goLink.name(name, path),
    /** For <head>, before the site's own stylesheet: the shared stylesheet and the receipt script. */
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
    // The site names itself. Only its publisher can put this here, which is what proves a
    // claim to the short name (DEMO.md 5.9).
    name,
    title: mod.meta.title,
    ...mod.settings,
    // A site may add directives to the shared policy (Start adds frame-src for warm-up), or
    // state its whole policy when it needs to loosen one (Cinema runs the Autonomi client).
    headers: { "/*": { "Content-Security-Policy": mod.csp ?? (mod.cspExtra ? `${CSP}; ${mod.cspExtra}` : CSP) }, ...mod.settings?.headers },
  };
  files.set(".autonomi-site.json", enc.encode(JSON.stringify(settings, null, 2) + "\n"));
  const tar = packFiles(files);
  return { name, meta: mod.meta, files, tar, sha256: sha256(tar), bytes: tar.length };
}

/** Build a content site. `published` is its publish date (YYYY-MM-DD), shown on the site. */
export async function buildContentSite(name, { published }) {
  const mod = await loadSite(name);
  return assemble(name, mod, await mod.build(context({ published, files: await uploadedFiles() })));
}

/**
 * Build Start. `sites` is the list of content sites to show (name, meta, bytes, cost?);
 * `versions` the addresses of Start's earlier uploaded versions, oldest first.
 */
export async function buildStart(sites, versions = []) {
  const mod = await loadSite("start");
  const ctx = context({
    sites: sites.map((s) => ({ ...s, href: goLink.name(s.name) })),
    versions: versions.map((v, i) => ({ ...v, number: i + 1, href: goLink.immutable(v.address) })),
  });
  return assemble("start", mod, await mod.build(ctx));
}

/** The directory file's content for a set of entries: { name: { kind, address, since } }. */
export function namesFile(names, updated) {
  return JSON.stringify({ v: 1, updated, names }, null, 2) + "\n";
}

// ---------------------------------------------------------------------------------------
// Command line

async function readAddresses() {
  let a = {};
  try {
    a = JSON.parse(await readFile(ADDRESSES, "utf8"));
  } catch {
    // First run.
  }
  return { startPointer: "", ...a, sites: a.sites ?? {}, start: a.start ?? [] };
}

const saveAddresses = (a) => writeFile(ADDRESSES, JSON.stringify(a, null, 2) + "\n");
const hex = (s) => s?.toLowerCase().replace(/^0x/, "");
const kb = (n) => `${(n / 1024).toFixed(0).padStart(6)} KiB`;

/** The archive and details of the last build of a site, as written to publish/sites/. */
async function lastBuild(name) {
  try {
    const info = JSON.parse(await readFile(join(OUT, `${name}.json`), "utf8"));
    const tar = await readFile(join(OUT, `${name}.tar`));
    return sha256(tar) === info.sha256 ? info : null;
  } catch {
    return null;
  }
}

async function writeBuild(built, extra = {}) {
  await writeFile(join(OUT, `${built.name}.tar`), built.tar);
  await writeFile(join(OUT, `${built.name}.json`), JSON.stringify({ sha256: built.sha256, ...extra }, null, 2) + "\n");
}

function startSites(addresses, builds) {
  return CONTENT_SITES.map((name) => ({
    name,
    meta: builds[name].meta,
    bytes: builds[name].bytes,
    cost: addresses.sites[name]?.cost,
  }));
}

/** Write names.json from what has been uploaded. Returns true if the file changed. */
async function writeNames(addresses) {
  const names = {};
  // Start's name needs its pointer to exist, which it does once a version has been uploaded.
  if (isHex(addresses.startPointer) && addresses.start.length) {
    names.start = { kind: "p", address: addresses.startPointer, since: addresses.start[0].date };
  }
  for (const name of CONTENT_SITES) {
    const rec = addresses.sites[name];
    if (rec?.address) names[name] = { kind: "i", address: rec.address, since: rec.since ?? rec.published };
  }
  let old = null;
  try {
    old = JSON.parse(await readFile(NAMES, "utf8"));
  } catch {
    // No directory yet.
  }
  if (old && JSON.stringify(old.names) === JSON.stringify(names)) return false;
  await writeFile(NAMES, namesFile(names, new Date().toISOString().replace(/\.\d+Z$/, "Z")));
  return true;
}

async function record(addresses, args) {
  const costAt = args.indexOf("--cost");
  const cost = costAt >= 0 ? args.splice(costAt, 2)[1] : undefined;
  const [, name, raw] = args;

  if (name === "file") {
    // A file a site offers to download, such as one of the Library's EPUBs: recorded by name,
    // with its size, so the site can build its download button.
    const path = args[2];
    const fileAddress = hex(args[3]);
    if (!path || !isHex(fileAddress)) throw new Error("Usage: node sites/build.mjs record file <path> <64-hex address>");
    const bytes = (await readFile(path)).length;
    const key = path.split(/[\\/]/).at(-1);
    addresses.files = { ...addresses.files, [key]: { address: fileAddress, bytes } };
    await saveAddresses(addresses);
    console.log(`Recorded ${key}: ${fileAddress} (${bytes} bytes)`);
    return;
  }

  const address = hex(raw);
  if (!isHex(address)) throw new Error("Usage: node sites/build.mjs record <site> <64-hex address> [--cost \"…\"]");
  if (name === "start-pointer") {
    addresses.startPointer = address;
  } else if (name === "removals-pointer") {
    // Built into the Download Button, which reads its removal list through it (DEMO.md 3.6).
    addresses.removalsPointer = address;
  } else if (name === "start" || CONTENT_SITES.includes(name)) {
    // Record what was built last (the archive in publish/sites/), not a fresh build, so the
    // recorded hash and date are those of the file that was uploaded.
    const built = await lastBuild(name);
    if (!built) throw new Error(`No build of ${name} in publish/sites/. Run "node sites/build.mjs" first, then upload that file.`);
    if (name === "start") {
      addresses.start.push({ address, sha256: built.sha256, date: today(), ...(cost ? { cost } : {}) });
    } else {
      const since = addresses.sites[name]?.since ?? today();
      addresses.sites[name] = { address, sha256: built.sha256, published: built.published, since, ...(cost ? { cost } : {}) };
    }
  } else {
    throw new Error(`Unknown site "${name}". Sites: start-pointer, removals-pointer, ${CONTENT_SITES.join(", ")}, start.`);
  }
  await saveAddresses(addresses);
  console.log(`Recorded ${name}: ${address}`);
  if (await writeNames(addresses)) console.log("names.json updated. Deploy the loader so the name works: .\\deploy\\deploy.ps1 -Server …");
}

async function main(args) {
  const addresses = await readAddresses();
  if (args[0] === "record") return record(addresses, args);

  await mkdir(OUT, { recursive: true });
  const builds = {};
  const upload = [];

  for (const name of CONTENT_SITES) {
    const rec = addresses.sites[name];
    // An uploaded site keeps its publish date, so an unchanged site rebuilds to the same bytes.
    let published = rec?.published;
    let built = rec ? await buildContentSite(name, { published }) : null;
    let status;
    if (built && built.sha256 === rec.sha256) {
      status = `uploaded at ${rec.address}`;
    } else {
      published = today();
      built = await buildContentSite(name, { published });
      status = rec ? "CHANGED since it was uploaded; upload again" : "not uploaded yet";
      upload.push(name);
    }
    await writeBuild(built, { published });
    builds[name] = built;
    console.log(`${name.padEnd(10)} ${kb(built.bytes)}  ${status}`);
  }

  // Start is up to date if rebuilding its latest version (which lists the versions before
  // it) gives the archive that was uploaded. Otherwise this is a new version.
  const sites = startSites(addresses, builds);
  const latest = addresses.start.at(-1);
  let start = latest ? await buildStart(sites, addresses.start.slice(0, -1)) : null;
  const startCurrent = start !== null && start.sha256 === latest.sha256;
  if (!startCurrent) start = await buildStart(sites, addresses.start);
  await writeBuild(start);
  console.log(
    `${"start".padEnd(10)} ${kb(start.bytes)}  ` +
      (startCurrent
        ? `uploaded at ${latest.address} (version ${addresses.start.length})`
        : `version ${addresses.start.length + 1}, ${latest ? "changed; upload again" : "not uploaded yet"}`),
  );

  if (await writeNames(addresses)) console.log("\nnames.json updated. Deploy the loader so the names work.");

  const next = [];
  for (const name of upload) {
    next.push(`ant file upload publish/sites/${name}.tar --public`, `node sites/build.mjs record ${name} <address>`);
  }
  if (!startCurrent) {
    if (!isHex(addresses.startPointer)) {
      next.push(
        "ant pointer keygen --output publish/start.key      (once; back the key up)",
        "ant pointer address --key publish/start.key",
        "node sites/build.mjs record start-pointer <address>",
      );
    }
    next.push(
      "ant file upload publish/sites/start.tar --public",
      "node sites/build.mjs record start <address>",
      `ant pointer ${addresses.start.length ? "update" : "create"} --key publish/start.key <address>`,
    );
  }
  if (next.length) {
    console.log("\nNext:");
    for (const line of next) console.log(`  ${line}`);
    console.log("Then deploy the loader, so names.json reaches the host.");
  } else {
    console.log("\nEverything is uploaded.");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
