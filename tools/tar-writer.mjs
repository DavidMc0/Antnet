// Deterministic ustar writer shared by pack.mjs and build-fixtures.mjs.
// Fixed mtime, uid/gid 0, no user names, modes 0644 (files) and 0755 (directories).

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const BLOCK = 512;
const enc = new TextEncoder();

function writeString(block, offset, length, text) {
  const bytes = enc.encode(text);
  if (bytes.length > length) throw new Error(`Field too long (${bytes.length} > ${length}): ${text}`);
  block.set(bytes, offset);
}

function writeOctal(block, offset, length, value) {
  // length-1 octal digits, then NUL.
  writeString(block, offset, length, value.toString(8).padStart(length - 1, "0") + "\0");
}

/** Split a path into ustar prefix/name fields, or return null if it doesn't fit. */
function splitPath(path) {
  const bytes = enc.encode(path);
  if (bytes.length <= 100) return { prefix: "", name: path };
  for (let i = path.length - 1; i > 0; i--) {
    if (path[i] !== "/") continue;
    const prefix = path.slice(0, i);
    const name = path.slice(i + 1);
    if (enc.encode(prefix).length <= 155 && enc.encode(name).length <= 100 && name !== "") return { prefix, name };
  }
  return null;
}

/**
 * One raw header block. `fields` may override anything, so build-fixtures can craft
 * hostile archives: { name, prefix, type, size, linkname, mode, magic }.
 */
export function header(fields) {
  const block = new Uint8Array(BLOCK);
  const type = fields.type ?? "0";
  writeString(block, 0, 100, fields.name ?? "");
  writeOctal(block, 100, 8, fields.mode ?? (type === "5" ? 0o755 : 0o644));
  writeOctal(block, 108, 8, 0); // uid
  writeOctal(block, 116, 8, 0); // gid
  writeOctal(block, 124, 12, fields.size ?? 0);
  writeOctal(block, 136, 12, fields.mtime ?? 0);
  block[156] = type.charCodeAt(0);
  writeString(block, 157, 100, fields.linkname ?? "");
  writeString(block, 257, 6, fields.magic ?? "ustar\0");
  writeString(block, 263, 2, "00");
  writeString(block, 345, 155, fields.prefix ?? "");
  // Checksum: sum of all bytes with the checksum field as spaces.
  block.fill(0x20, 148, 156);
  let sum = 0;
  for (const b of block) sum += b;
  writeString(block, 148, 8, sum.toString(8).padStart(6, "0") + "\0 ");
  return block;
}

function paxRecord(key, value) {
  const body = ` ${key}=${value}\n`;
  const n = enc.encode(body).length;
  // The length field counts its own digits.
  let len = n + 1;
  while (n + String(len).length !== len) len = n + String(len).length;
  return `${len}${body}`;
}

function padded(bytes) {
  const out = new Uint8Array(Math.ceil(bytes.length / BLOCK) * BLOCK);
  out.set(bytes);
  return out;
}

/**
 * Write entries in the given order.
 * entry: { path, bytes?, type?: "0"|"2"|"5"|..., linkname?, pax?: Record<string,string> }
 */
export function writeTar(entries) {
  const blocks = [];
  for (const e of entries) {
    const type = e.type ?? "0";
    const data = type === "0" ? (e.bytes ?? new Uint8Array()) : new Uint8Array();
    const pax = { ...(e.pax ?? {}) };
    let split = splitPath(e.path);
    if (!split) {
      pax.path = e.path;
      split = { prefix: "", name: e.path.slice(-100).replace(/^\/+/, "") };
    }
    const paxText = Object.entries(pax).map(([k, v]) => paxRecord(k, v)).join("");
    if (paxText) {
      const paxBytes = enc.encode(paxText);
      blocks.push(header({ name: "PaxHeader", type: "x", size: paxBytes.length }), padded(paxBytes));
    }
    blocks.push(header({ ...split, type, size: data.length, linkname: e.linkname }));
    if (data.length) blocks.push(padded(data));
  }
  blocks.push(new Uint8Array(BLOCK * 2));
  return concat(blocks);
}

export function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Byte-wise path comparison, so the order doesn't depend on locale. */
function compareBytes(a, b) {
  const x = enc.encode(a);
  const y = enc.encode(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
  return x.length - y.length;
}

/** List regular files under `dir` as site paths ("a/b.html"). Skips symlinks and dotfiles other than the settings file. */
export async function listFiles(dir, base = "") {
  const out = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${d.name}` : d.name;
    if (d.name.startsWith(".") && rel !== ".autonomi-site.json") continue;
    if (d.isDirectory()) out.push(...(await listFiles(join(dir, d.name), rel)));
    else if (d.isFile()) out.push(rel);
  }
  return out;
}

/** Read a folder into a map of site path -> bytes (see listFiles for what is skipped). */
export async function readDir(dir) {
  const files = new Map();
  for (const path of await listFiles(dir)) files.set(path, new Uint8Array(await readFile(join(dir, path))));
  return files;
}

/** Pack a map of site path -> bytes deterministically: files only, sorted by path. */
export function packFiles(files, { nonce } = {}) {
  const entries = [...files.keys()].sort(compareBytes).map((path) => ({ path, bytes: files.get(path) }));
  // A nonce changes the archive's bytes (and so its address) without changing the site.
  if (nonce && entries.length) entries[0].pax = { comment: `autonomi-nonce=${nonce}` };
  return writeTar(entries);
}

/** Pack a folder into a deterministic archive. */
export async function packDir(dir, options = {}) {
  return packFiles(await readDir(dir), options);
}
