// Archive bytes -> site cache -> state switch -> old cache cleanup (spec 3.2).

import { SITE_CACHE_PREFIX, siteCacheName } from "./config";
import type { SiteLink } from "./host";
import { SETTINGS_FILE, cachePathFor, headersFor, isReservedPath, parseSettings } from "./site";
import { type Arrival, type RecordDetail, type SiteState, type Timings, writeState } from "./state";
import { readTar } from "./tar";

export class NotASiteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotASiteError";
  }
}

export interface InstallInput {
  origin: string;
  link: SiteLink;
  archive: string;
  blake3: string;
  bytes: Uint8Array;
  records?: number;
  recordList?: RecordDetail[];
  arrivals?: Arrival[];
  /** The short name this origin is, with its registration date, when opened by name. */
  name?: string;
  nameSince?: string;
  timings?: Timings;
  /** performance.now() when the whole open started, for the total timing. */
  startedAt?: number;
  now?: number;
}

/** Validate an archive without touching storage. Throws TarError / NotASiteError. */
export function inspectArchive(bytes: Uint8Array) {
  const entries = readTar(bytes);
  const byPath = new Map(entries.map((e) => [e.path, e.bytes]));
  const { settings, ignored } = parseSettings(byPath.get(SETTINGS_FILE));
  if (!byPath.has(settings.index)) {
    throw new NotASiteError(`Not a site archive: no ${settings.index} at the root`);
  }
  const reserved = entries.filter((e) => isReservedPath(e.path)).map((e) => e.path);
  for (const p of reserved) ignored.push(`file ${p}: reserved path, not served`);
  const files = entries.filter((e) => !isReservedPath(e.path));
  return { files, settings, ignored };
}

export async function installArchive(input: InstallInput): Promise<SiteState> {
  const started = performance.now();
  const { files, settings, ignored } = inspectArchive(input.bytes);

  const cacheName = siteCacheName(input.archive);
  // Start clean so a previously interrupted install of the same archive can't leave strays.
  await caches.delete(cacheName);
  const cache = await caches.open(cacheName);

  await Promise.all(
    files.map((f) =>
      cache.put(
        new URL(cachePathFor(f.path), input.origin).href,
        // Copy out of the archive buffer so each Response owns its bytes.
        new Response(f.bytes.slice(), { status: 200, headers: headersFor(f.path, f.bytes.length, settings) }),
      ),
    ),
  );

  const now = input.now ?? Date.now();
  const end = performance.now();
  const timings: Timings = { ...input.timings, installMs: Math.round(end - started) };
  if (input.startedAt !== undefined) timings.totalMs = Math.round(end - input.startedAt);
  const state: SiteState = {
    v: 1,
    link: input.link,
    ...(input.name ? { name: input.name, nameSince: input.nameSince } : {}),
    archive: input.archive,
    blake3: input.blake3,
    bytes: input.bytes.length,
    files: files.length,
    installedAt: now,
    checkedAt: now,
    settings: { index: settings.index, spa: settings.spa, notFound: settings.notFound },
    title: settings.title,
    ignored,
    records: input.records,
    declaredName: settings.name,
    recordList: input.recordList,
    arrivals: input.arrivals,
    timings,
  };
  // State last: a half-finished install is never served.
  await writeState(input.origin, state);
  await deleteOtherSiteCaches(input.archive);
  return state;
}

export async function deleteOtherSiteCaches(keepArchive: string | null): Promise<void> {
  const keep = keepArchive ? siteCacheName(keepArchive) : null;
  for (const name of await caches.keys()) {
    if (name.startsWith(SITE_CACHE_PREFIX) && name !== keep) await caches.delete(name);
  }
}
