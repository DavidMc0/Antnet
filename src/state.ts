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

export interface SiteState {
  v: 1;
  link: SiteLink;
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

export function checkDue(state: SiteState, now: number, interval = CHECK_INTERVAL_MS): boolean {
  return state.link.kind === "p" && now - state.checkedAt >= interval;
}
