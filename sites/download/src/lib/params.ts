import { isAddress } from "./address";

export const MAX_NAME_LENGTH = 200;

export interface DownloadParams {
  address: string;
  name: string;
  /** False when `n` was missing or sanitised to nothing, so `name` is the generated default. */
  nameProvided: boolean;
  size?: number;
}

export type ParseResult =
  | { ok: true; params: DownloadParams }
  | { ok: false; reason: "missing-address" | "invalid-address" };

export function defaultName(address: string): string {
  return `autonomi-${address.slice(0, 8)}.bin`;
}

/**
 * Make a file name safe to display and save: drop path/reserved characters,
 * control and bidi-override characters, trim, and cap the length.
 */
export function sanitizeName(raw: string): string {
  const cleaned = raw
    .normalize("NFC")
    .replace(/[/\:*?"<>|]/g, "")
    // C0/C1 controls and bidi overrides (which can disguise extensions, e.g. "exe.txt").
    .replace(/[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g, "")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "");
  return Array.from(cleaned).slice(0, MAX_NAME_LENGTH).join("").trim();
}

export function parseSize(raw: string | null): number | undefined {
  if (!raw || !/^\d{1,16}$/.test(raw)) return undefined;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : undefined;
}

/**
 * Parse an old-style link's query (`/d/?a=<address>&n=<name>&s=<size>`), the form Autonomirror
 * used before the Antnet version. Kept so old links can be moved to the new form.
 */
export function parseDownloadParams(search: string | URLSearchParams): ParseResult {
  const q = typeof search === "string" ? new URLSearchParams(search) : search;
  return parseParts((q.get("a") ?? "").trim(), q);
}

/** The path every download link starts with: `/f/ant/<address>`. */
export const DOWNLOAD_PREFIX = "/f/ant/";

/**
 * Parse a download link on this site: `/f/ant/<address>?n=<name>&s=<size>`. The address is in
 * the path, so the link reads as a file's place on the network; the name and size ride along.
 */
export function parseDownloadPath(pathname: string, search: string | URLSearchParams): ParseResult {
  const q = typeof search === "string" ? new URLSearchParams(search) : search;
  const rest = pathname.startsWith(DOWNLOAD_PREFIX) ? pathname.slice(DOWNLOAD_PREFIX.length) : "";
  // A trailing slash is harmless; anything after the address isn't part of the link.
  const raw = decodeURIComponent(rest.split("/")[0] ?? "").trim();
  return parseParts(raw.toLowerCase(), q);
}

function parseParts(rawAddress: string, q: URLSearchParams): ParseResult {
  if (!rawAddress) return { ok: false, reason: "missing-address" };
  if (!isAddress(rawAddress)) return { ok: false, reason: "invalid-address" };
  const name = sanitizeName(q.get("n") ?? "");
  return {
    ok: true,
    params: {
      address: rawAddress,
      name: name || defaultName(rawAddress),
      nameProvided: name.length > 0,
      size: parseSize(q.get("s")),
    },
  };
}

/**
 * Stricter than encodeURIComponent: also encodes ( ) ' ! * so the URL
 * survives inside Markdown links and HTML attributes untouched.
 */
export function encodeParam(value: string): string {
  return encodeURIComponent(value).replace(/[()'!*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** `siteBase` is the absolute URL of the site root, ending in "/". */
export function buildDownloadUrl(
  siteBase: string,
  p: { address: string; name?: string; size?: number },
): string {
  const parts: string[] = [];
  const name = p.name ? sanitizeName(p.name) : "";
  if (name) parts.push(`n=${encodeParam(name)}`);
  if (p.size !== undefined && Number.isSafeInteger(p.size) && p.size >= 0) parts.push(`s=${p.size}`);
  return `${withSlash(siteBase)}f/ant/${p.address}${parts.length ? `?${parts.join("&")}` : ""}`;
}

/** A path on this site for a download link, keeping the name and size (for moving old links). */
export function downloadPath(p: DownloadParams): string {
  const url = new URL(buildDownloadUrl("https://x/", { address: p.address, name: p.nameProvided ? p.name : "", size: p.size }));
  return url.pathname + url.search;
}

export function buildGeneratorUrl(siteBase: string, p: { address: string; name?: string }): string {
  const parts = [`a=${p.address}`];
  if (p.name) parts.push(`n=${encodeParam(sanitizeName(p.name))}`);
  return `${withSlash(siteBase)}?${parts.join("&")}`;
}

/**
 * Absolute site root for links that leave this site (embed snippets). The page carries it in
 * <meta name="download-base">, set when the site is built (https://download.antnet.autonomirror.com/),
 * so buttons point at the Antnet address wherever the generator was opened. Without it, the
 * current origin.
 */
export function siteBaseUrl(configured?: string | null, origin: string = location.origin): string {
  return withSlash((configured || origin).replace(/\/+$/, ""));
}

const withSlash = (s: string) => (s.endsWith("/") ? s : `${s}/`);
