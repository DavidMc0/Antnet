// Fixed loader settings shared by the shell and the service worker.

export const SW_PATH = "/autonomi-loader-sw.js";
export const RESERVED_PREFIX = "/_autonomi/";
export const META_CACHE = "autonomi-loader-meta";
export const STATE_PATH = "/_autonomi/state.json";
export const SITE_CACHE_PREFIX = "site-v1-";

/** Largest archive the loader will download (spec 5.1). */
export const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;

/**
 * The limit in force. sessionStorage "maxArchiveBytes" can only lower it, so tests can check
 * the refusal against a small published archive; a page can at most stop itself installing.
 */
export function maxArchiveBytes(): number {
  try {
    const v = Number(sessionStorage.getItem("maxArchiveBytes"));
    if (Number.isSafeInteger(v) && v > 0 && v < MAX_ARCHIVE_BYTES) return v;
  } catch {
    // No storage: use the fixed limit.
  }
  return MAX_ARCHIVE_BYTES;
}

/** How often a pointer link is re-checked on navigation (spec 3.4). */
export const CHECK_INTERVAL_MS = 60 * 60 * 1000;
/** Time budget for an update check: connect plus pointer read. */
export const CHECK_BUDGET_MS = 5_000;

/**
 * The budget in force. sessionStorage "checkBudgetMs" (1 s to 60 s) overrides it, for
 * measuring checks on mainnet, where the first pointer read on a new connection takes
 * 9–20 s with SDK 0.1.5. A page can only make its own visitor wait longer.
 */
export function checkBudgetMs(): number {
  try {
    const v = Number(sessionStorage.getItem("checkBudgetMs"));
    if (Number.isSafeInteger(v) && v >= 1_000 && v <= 60_000) return v;
  } catch {
    // No storage: use the default.
  }
  return CHECK_BUDGET_MS;
}
/** After a failed check, the next one is due after this long. */
export const CHECK_RETRY_MS = 10 * 60 * 1000;

/**
 * Automatic reloads allowed within RELOAD_WINDOW_MS before the shell shows an error.
 * A real loop bounces back to the shell within a second or two, so the window is short
 * enough that a visitor's own repeated hard reloads don't trip it.
 */
export const MAX_AUTO_RELOADS = 2;
export const RELOAD_WINDOW_MS = 5_000;

export function siteCacheName(archive: string): string {
  return SITE_CACHE_PREFIX + archive;
}
