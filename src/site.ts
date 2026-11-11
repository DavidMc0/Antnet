// Site settings, path resolution (spec 5.2), response headers and MIME types (spec 5.3).

import { isValidName } from "./host";

export interface SiteSettings {
  index: string;
  notFound: string;
  spa: boolean;
  title?: string;
  /** The short name the site claims for itself. */
  name?: string;
  /** Pattern ("/exact", "/*" or "/dir/*") -> allowed header name -> value. */
  headers: Record<string, Record<string, string>>;
}

export const SETTINGS_FILE = ".autonomi-site.json";

export const DEFAULT_SETTINGS: SiteSettings = {
  index: "index.html",
  notFound: "404.html",
  spa: false,
  headers: {},
};

export const ALLOWED_HEADERS = [
  "Content-Security-Policy",
  "Permissions-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Embedder-Policy",
  "Cross-Origin-Resource-Policy",
];
const ALLOWED_LOWER = new Map(ALLOWED_HEADERS.map((h) => [h.toLowerCase(), h]));

export interface ParsedSettings {
  settings: SiteSettings;
  /** Human-readable notes about ignored fields, shown on the info page. */
  ignored: string[];
}

function isPlainFileName(v: unknown): v is string {
  return typeof v === "string" && v !== "" && !v.startsWith("/") && !v.split("/").some((s) => s === ".." || s === "");
}

export function parseSettings(bytes: Uint8Array | undefined): ParsedSettings {
  const settings: SiteSettings = { ...DEFAULT_SETTINGS, headers: {} };
  const ignored: string[] = [];
  if (!bytes) return { settings, ignored };

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error(`${SETTINGS_FILE} is not valid JSON`);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${SETTINGS_FILE} must be a JSON object`);
  }
  const o = raw as Record<string, unknown>;

  if (o.format !== undefined && o.format !== "autonomi-site/1") {
    throw new Error(`Unsupported site format ${JSON.stringify(o.format)}`);
  }
  if (o.index !== undefined) {
    if (isPlainFileName(o.index)) settings.index = o.index;
    else ignored.push(`index: ${JSON.stringify(o.index)} is not a valid file name`);
  }
  if (o.notFound !== undefined) {
    if (isPlainFileName(o.notFound)) settings.notFound = o.notFound;
    else ignored.push(`notFound: ${JSON.stringify(o.notFound)} is not a valid file name`);
  }
  if (o.spa !== undefined) {
    if (typeof o.spa === "boolean") settings.spa = o.spa;
    else ignored.push("spa: not a boolean");
  }
  if (typeof o.title === "string") settings.title = o.title.slice(0, 200);
  // The short name the site claims for itself (DEMO.md 5.9). It proves a name claim, because
  // only the publisher can put it in the archive; it doesn't give the site that name.
  if (o.name !== undefined) {
    if (typeof o.name === "string" && isValidName(o.name)) settings.name = o.name;
    else ignored.push(`name: ${JSON.stringify(o.name)} is not a valid short name`);
  }

  if (o.headers !== undefined) {
    if (typeof o.headers !== "object" || o.headers === null || Array.isArray(o.headers)) {
      ignored.push("headers: not an object");
    } else {
      for (const [pattern, hdrs] of Object.entries(o.headers as Record<string, unknown>)) {
        if (!isValidPattern(pattern)) {
          ignored.push(`headers ${JSON.stringify(pattern)}: unsupported path pattern`);
          continue;
        }
        if (typeof hdrs !== "object" || hdrs === null || Array.isArray(hdrs)) {
          ignored.push(`headers ${JSON.stringify(pattern)}: not an object`);
          continue;
        }
        for (const [name, value] of Object.entries(hdrs as Record<string, unknown>)) {
          const canonical = ALLOWED_LOWER.get(name.toLowerCase());
          if (!canonical) {
            ignored.push(`header ${JSON.stringify(name)} on ${pattern}: not on the allowed list`);
            continue;
          }
          if (typeof value !== "string" || /[\r\n]/.test(value)) {
            ignored.push(`header ${canonical} on ${pattern}: value must be a single-line string`);
            continue;
          }
          (settings.headers[pattern] ??= {})[canonical] = value;
        }
      }
    }
  }
  return { settings, ignored };
}

function isValidPattern(p: string): boolean {
  if (!p.startsWith("/")) return false;
  if (p === "/*") return true;
  const star = p.indexOf("*");
  if (star < 0) return true; // exact path
  return star === p.length - 1 && p.endsWith("/*") && !p.slice(0, -2).includes("*");
}

/** Does a pattern match a site path (without leading "/")? */
export function patternMatches(pattern: string, path: string): boolean {
  const full = "/" + path;
  if (pattern === "/*") return true;
  if (pattern.endsWith("/*")) return full.startsWith(pattern.slice(0, -1));
  return full === pattern;
}

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  cjs: "text/javascript; charset=utf-8",
  json: "application/json",
  map: "application/json",
  webmanifest: "application/manifest+json",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  xml: "application/xml",
  rss: "application/rss+xml",
  atom: "application/atom+xml",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  bmp: "image/bmp",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/opus",
  wav: "audio/wav",
  flac: "audio/flac",
  wasm: "application/wasm",
  pdf: "application/pdf",
  zip: "application/zip",
  vtt: "text/vtt; charset=utf-8",
};

export function mimeType(path: string): string {
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  if (dot <= slash + 1) return "application/octet-stream";
  return MIME[path.slice(dot + 1).toLowerCase()] ?? "application/octet-stream";
}

/** Headers stored with a file in the site cache. */
export function headersFor(path: string, size: number, settings: SiteSettings): Headers {
  const h = new Headers();
  h.set("Content-Type", mimeType(path));
  h.set("Content-Length", String(size));
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Accept-Ranges", "bytes");
  // Less specific patterns first, so an exact path overrides a directory, which overrides "/*".
  const patterns = Object.keys(settings.headers).sort((a, b) => specificity(a) - specificity(b));
  for (const pattern of patterns) {
    if (!patternMatches(pattern, path)) continue;
    for (const [name, value] of Object.entries(settings.headers[pattern])) h.set(name, value);
  }
  return h;
}

function specificity(pattern: string): number {
  if (pattern === "/*") return 0;
  if (pattern.endsWith("/*")) return pattern.length;
  return 1_000_000;
}

/** Reserved for the loader: `_autonomi/…` and the service worker script (path without leading "/"). */
export function isReservedPath(path: string): boolean {
  return path === "_autonomi" || path.startsWith("_autonomi/") || path === "autonomi-loader-sw.js";
}

/** The cache key (an absolute URL path) for a site file path. */
export function cachePathFor(path: string): string {
  return "/" + path.split("/").map(encodeURIComponent).join("/");
}

export type Resolution =
  | { kind: "file"; path: string; status: 200 | 404 }
  | { kind: "redirect"; status: 308; location: string }
  | { kind: "text"; status: 400 | 404; body: string };

/** Resolve a request path against the installed files (spec 5.2). */
export async function resolvePath(
  pathname: string,
  search: string,
  isNavigation: boolean,
  settings: Pick<SiteSettings, "index" | "notFound" | "spa">,
  has: (path: string) => boolean | Promise<boolean>,
): Promise<Resolution> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { kind: "text", status: 400, body: "Bad request: malformed path" };
  }
  if (decoded.includes("\0")) return { kind: "text", status: 400, body: "Bad request: NUL in path" };
  let path = decoded.replace(/^\/+/, "");

  if (path === "" || path.endsWith("/")) path += settings.index;
  if (!isReservedPath(path) && (await has(path))) return { kind: "file", path, status: 200 };

  if (!decoded.endsWith("/") && path !== "" && (await has(`${path}/${settings.index}`))) {
    return { kind: "redirect", status: 308, location: pathname + "/" + search };
  }
  if (settings.spa && isNavigation && (await has(settings.index))) {
    return { kind: "file", path: settings.index, status: 200 };
  }
  if (await has(settings.notFound)) return { kind: "file", path: settings.notFound, status: 404 };
  return { kind: "text", status: 404, body: "Not found" };
}

/** Parse a single-range `Range` header. Returns null to ignore it, "invalid" for 416. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | "invalid" | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null; // multiple ranges or other units: serve the whole file
  const [, a, b] = m;
  if (a === "" && b === "") return "invalid";
  let start: number;
  let end: number;
  if (a === "") {
    const suffix = Number(b);
    if (suffix === 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(a);
    end = b === "" ? size - 1 : Math.min(Number(b), size - 1);
  }
  if (start >= size || start > end) return "invalid";
  return { start, end };
}
