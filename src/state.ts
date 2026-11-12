// The site state record in Cache Storage (spec 3.2). Readable by the shell and the service worker.

import { CHECK_INTERVAL_MS, META_CACHE, STATE_PATH, STREAMS_PATH } from "./config";
import type { SiteLink } from "./host";
import type { SiteSettings } from "./site";

export interface Timings {
  connectMs?: number;
  resolveMs?: number;
  downloadMs?: number;
  installMs?: number;
  totalMs?: number;
}

/** One network record of an installed archive, for "Where this page came from". */
export interface RecordDetail {
  kind: "datamap" | "chunk";
  /** Chunk position in the file, from 0. */
  index?: number;
  /** Size in bytes (for a chunk, of the plaintext it holds). */
  bytes?: number;
  /** The record's network address. */
  address?: string;
  /** Peer ID of the node that served it, when the client reports it. */
  node?: string;
  /** Milliseconds from the start of the download until it arrived, when known for this record. */
  ms?: number;
}

/** When the nth chunk arrived. The client reports arrival order, not which chunk each was. */
export interface Arrival {
  ms: number;
  node?: string;
}

export interface SiteState {
  v: 1;
  /** The link the site was installed from. For a named site, what the name resolved to. */
  link: SiteLink;
  /** The short name this origin is, when the site was opened by name. */
  name?: string;
  /** When the directory says the name was registered. */
  nameSince?: string;
  archive: string;
  blake3: string;
  bytes: number;
  files: number;
  installedAt: number;
  checkedAt: number;
  settings: Pick<SiteSettings, "index" | "spa" | "notFound">;
  /** Extras shown on the info page. */
  title?: string;
  ignored?: string[];
  records?: number;
  /** The name the site gives itself in its settings file, if any. */
  declaredName?: string;
  recordList?: RecordDetail[];
  arrivals?: Arrival[];
  timings?: Timings;
  lastCheck?: { at: number; ms: number; outcome: string };
}

function stateUrl(origin: string): string {
  return new URL(STATE_PATH, origin).href;
}

export async function readState(origin: string): Promise<SiteState | null> {
  try {
    // caches.open() would create the cache; reading must leave storage untouched.
    if (!(await caches.has(META_CACHE))) return null;
    const cache = await caches.open(META_CACHE);
    const res = await cache.match(stateUrl(origin));
    if (!res) return null;
    const s = (await res.json()) as SiteState;
    if (s?.v !== 1 || typeof s.archive !== "string" || !s.link || !s.settings) return null;
    return s;
  } catch {
    return null;
  }
}

export async function writeState(origin: string, state: SiteState): Promise<void> {
  const cache = await caches.open(META_CACHE);
  await cache.put(
    stateUrl(origin),
    new Response(JSON.stringify(state), { headers: { "Content-Type": "application/json" } }),
  );
}

export async function clearState(origin: string): Promise<void> {
  const cache = await caches.open(META_CACHE);
  await cache.delete(stateUrl(origin));
}

/**
 * A file a site streamed from Autonomi through the media bridge (DEMO.md 5.8), as the worker
 * saw it. The stream URL carries the file's name, size and type, but not its address: the
 * site's page opened the file and reads it, and the worker only relays byte ranges.
 */
export interface StreamRecord {
  name: string;
  size: number;
  type: string;
  firstAt: number;
  lastAt: number;
}

/** How many streamed files the record keeps, most recent first. */
const MAX_STREAM_RECORDS = 20;

export async function readStreams(origin: string): Promise<StreamRecord[]> {
  try {
    if (!(await caches.has(META_CACHE))) return [];
    const res = await (await caches.open(META_CACHE)).match(new URL(STREAMS_PATH, origin).href);
    const list = res ? ((await res.json()) as unknown) : [];
    return Array.isArray(list) ? (list as StreamRecord[]) : [];
  } catch {
    return [];
  }
}

/** Note that a file was streamed now. The same name and size count as the same file. */
export async function recordStream(origin: string, file: { name: string; size: number; type: string }, now = Date.now()): Promise<void> {
  const list = await readStreams(origin);
  const same = list.find((s) => s.name === file.name && s.size === file.size);
  const entry: StreamRecord = { ...file, firstAt: same?.firstAt ?? now, lastAt: now };
  const next = [entry, ...list.filter((s) => s !== same)].slice(0, MAX_STREAM_RECORDS);
  await (await caches.open(META_CACHE)).put(
    new URL(STREAMS_PATH, origin).href,
    new Response(JSON.stringify(next), { headers: { "Content-Type": "application/json" } }),
  );
}

export function sameLink(a: SiteLink, b: SiteLink): boolean {
  return a.kind === b.kind && a.address === b.address;
}

/**
 * Whether a navigation should go through the shell for an update check. Pointer links can
 * move, and so can a name's directory entry; a plain immutable link never changes.
 */
export function checkDue(state: SiteState, now: number, interval = CHECK_INTERVAL_MS): boolean {
  return (state.link.kind === "p" || state.name !== undefined) && now - state.checkedAt >= interval;
}
