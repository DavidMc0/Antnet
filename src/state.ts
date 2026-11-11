// The site state record in Cache Storage (spec 3.2). Readable by the shell and the service worker.

import { CHECK_INTERVAL_MS, META_CACHE, STATE_PATH } from "./config";
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
