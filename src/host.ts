// Hostname <-> link, loader root, path forms and portable go-links (spec 3.5, 7).

import { ADDRESS_BASE32_LENGTH, hexToLabelBody, isAddressHex, labelBodyToHex } from "./base32";

export type LinkKind = "i" | "p";

export interface SiteLink {
  kind: LinkKind;
  /** 64 lowercase hex characters. */
  address: string;
}

export type HostInfo =
  | { view: "landing"; root: string }
  | { view: "site"; root: string; link: SiteLink; label: string }
  /** A short name from this loader's directory (/_autonomi/names.json), e.g. library.<root>. */
  | { view: "name"; root: string; name: string; label: string }
  | { view: "bad-label"; root: string; label: string; reason: string };

// ---------------------------------------------------------------------------------------------
// Short names (DEMO.md 5.9). A name is 1-32 characters of a-z, 0-9 and hyphens, with no
// leading, trailing or double hyphen (which also rules out xn-- names). An address label is
// always exactly 53 characters, so a name can never be mistaken for one.

export const NAME_MAX_LENGTH = 32;
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Names the directory may never contain. `ant`, `p` and `i` would clash with the root-domain
 * path forms (/ant/<address>, /p/ant/<address>) and the label prefixes; `name` with name links.
 */
const RESERVED_NAMES = new Set([
  "www",
  "api",
  "admin",
  "mail",
  "static",
  "cdn",
  "assets",
  "loader",
  "antnet",
  "official",
  "support",
  "help",
  "login",
  "wallet",
  "pay",
  "ant",
  "p",
  "i",
  "name",
]);

export function isValidName(name: string): boolean {
  return name.length >= 1 && name.length <= NAME_MAX_LENGTH && NAME_RE.test(name);
}

export function isReservedName(name: string): boolean {
  return RESERVED_NAMES.has(name) || name.startsWith("autonomi");
}

/** A name the loader will look up: well-formed and not reserved. */
export function isUsableName(name: string): boolean {
  return isValidName(name) && !isReservedName(name);
}

export function nameOrigin(name: string, root: string, protocol: string, port: string): string {
  return `${protocol}//${name}.${root}${port ? ":" + port : ""}`;
}

const LABEL_LIKE = /^[ip][a-z0-9]+$/i;

/**
 * Work out the loader root for a hostname. An explicit root (VITE_LOADER_ROOT) wins.
 * Otherwise `localhost` is the root in development, and a first label that looks like a
 * site link is stripped.
 */
export function loaderRootFor(hostname: string, configuredRoot?: string): string {
  const host = hostname.toLowerCase();
  if (configuredRoot) return configuredRoot.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return "localhost";
  const dot = host.indexOf(".");
  if (dot > 0 && LABEL_LIKE.test(host.slice(0, dot)) && dot >= 40) return host.slice(dot + 1);
  return host;
}

export function parseLabel(label: string): SiteLink | { error: string } {
  const kind = label[0];
  if (kind !== "i" && kind !== "p") return { error: "A site label starts with i (immutable) or p (pointer)." };
  const body = label.slice(1);
  if (body.length !== ADDRESS_BASE32_LENGTH) {
    return { error: `A site label is 53 characters; this one is ${label.length}.` };
  }
  const address = labelBodyToHex(body);
  if (!address) return { error: "This label is not the canonical lowercase base32 encoding of an address." };
  return { kind, address };
}

export function linkToLabel(link: SiteLink): string {
  return link.kind + hexToLabelBody(link.address);
}

export function classifyHost(hostname: string, configuredRoot?: string): HostInfo {
  const host = hostname.toLowerCase();
  const root = loaderRootFor(host, configuredRoot);
  if (host === root) return { view: "landing", root };
  if (!host.endsWith("." + root)) {
    return { view: "bad-label", root, label: host, reason: `This host is not under ${root}.` };
  }
  const label = host.slice(0, -(root.length + 1));
  if (label.includes(".")) {
    return { view: "bad-label", root, label, reason: "A site address is a single DNS label." };
  }
  // An address label is exactly 53 characters and starts with i or p.
  if (label.length === ADDRESS_BASE32_LENGTH + 1 && (label[0] === "i" || label[0] === "p")) {
    // Browsers lowercase hostnames, so case can't make a label non-canonical; trailing bits can.
    const parsed = parseLabel(label);
    if ("error" in parsed) return { view: "bad-label", root, label, reason: parsed.error };
    return { view: "site", root, link: parsed, label };
  }
  if (isValidName(label)) {
    if (isReservedName(label)) {
      return { view: "bad-label", root, label, reason: `“${label}” is reserved and can't be a site name.` };
    }
    return { view: "name", root, name: label, label };
  }
  return {
    view: "bad-label",
    root,
    label,
    reason:
      "A site address is a 53-character label starting with i or p, or a short name " +
      "(a–z, 0–9 and single hyphens, up to 32 characters).",
  };
}

export function siteOrigin(link: SiteLink, root: string, protocol: string, port: string): string {
  return `${protocol}//${linkToLabel(link)}.${root}${port ? ":" + port : ""}`;
}

/**
 * Parse a link path: `/ant/<hex>[/rest]` or `/p/ant/<hex>[/rest]`. Used for the root-domain
 * path forms and, after stripping `/_autonomi/go`, for portable go-links.
 */
export function parseLinkPath(pathname: string): { link: SiteLink; rest: string } | null {
  const m = /^\/(p\/)?ant\/([0-9a-fA-F]{64})(\/.*)?$/.exec(pathname);
  if (!m) return null;
  return {
    link: { kind: m[1] ? "p" : "i", address: m[2].toLowerCase() },
    rest: m[3] ?? "/",
  };
}

/** Where a parsed link or name leads: a site by address, or a site by short name. */
export type Target = { link: SiteLink; rest: string } | { name: string; rest: string };

export function targetOrigin(target: Target, root: string, protocol: string, port: string): string {
  return "name" in target
    ? nameOrigin(target.name, root, protocol, port)
    : siteOrigin(target.link, root, protocol, port);
}

/** Parse a name path: `/name/<name>[/rest]`, the form portable name links use after the go prefix. */
export function parseNamePath(pathname: string): { name: string; rest: string } | null {
  const m = /^\/name\/([a-z0-9-]+)(\/.*)?$/.exec(pathname);
  if (!m || !isUsableName(m[1])) return null;
  return { name: m[1], rest: m[2] ?? "/" };
}

/** Parse a root-domain name path: `/<name>[/rest]`. The caller checks the name is registered. */
export function parseRootNamePath(pathname: string): { name: string; rest: string } | null {
  const m = /^\/([a-z0-9-]+)(\/.*)?$/.exec(pathname);
  if (!m || !isUsableName(m[1])) return null;
  return { name: m[1], rest: m[2] ?? "/" };
}

export const GO_PREFIX = "/_autonomi/go";

/**
 * If `url` is a portable go-link, return the absolute URL it redirects to:
 * /_autonomi/go/ant/<hex>/…, /_autonomi/go/p/ant/<hex>/… or /_autonomi/go/name/<name>/….
 */
export function goLinkTarget(url: URL, root: string): string | null {
  if (!url.pathname.startsWith(GO_PREFIX + "/")) return null;
  const path = url.pathname.slice(GO_PREFIX.length);
  const parsed: Target | null = parseNamePath(path) ?? parseLinkPath(path);
  if (!parsed) return null;
  return targetOrigin(parsed, root, url.protocol, url.port) + parsed.rest + url.search + url.hash;
}

/** If `url` is a root-domain path form, return the subdomain URL it redirects to. */
export function pathFormTarget(url: URL, root: string): string | null {
  const parsed = parseLinkPath(url.pathname);
  if (!parsed) return null;
  return siteOrigin(parsed.link, root, url.protocol, url.port) + parsed.rest + url.search + url.hash;
}

/**
 * Parse what a visitor typed into the landing page's address box: 64 hex, `ant://<hex>`,
 * a path form (with or without a host), a full site URL, or a short name.
 */
export function parseAddressInput(
  input: string,
  root: string,
  rawHexKind: LinkKind = "i",
): Target | { error: string } {
  let text = input.trim();
  if (text === "") return { error: "Enter an address." };

  if (/^web\+ant:/i.test(text)) text = text.replace(/^web\+ant:/i, "ant:");
  // The ant CLI prints addresses as 0x-prefixed hex.
  if (/^0x[0-9a-f]{64}$/i.test(text)) text = text.slice(2);
  const ant = /^ant:\/\/([0-9a-fA-F]{64})(\/.*)?$/i.exec(text);
  if (ant) return { link: { kind: "i", address: ant[1].toLowerCase() }, rest: ant[2] ?? "/" };

  if (isAddressHex(text.toLowerCase())) return { link: { kind: rawHexKind, address: text.toLowerCase() }, rest: "/" };

  // A short name on its own, such as "library".
  if (isValidName(text.toLowerCase())) {
    const name = text.toLowerCase();
    if (isReservedName(name)) return { error: `“${name}” is reserved and can't be a site name.` };
    return { name, rest: "/" };
  }

  let url: URL | null = null;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : "https://" + text.replace(/^\/+/, "x.invalid/"));
  } catch {
    url = null;
  }
  if (url) {
    const fromPath = parseLinkPath(url.pathname);
    if (fromPath) return fromPath;
    const host = url.hostname;
    const dot = host.indexOf(".");
    if (dot > 0) {
      const label = host.slice(0, dot);
      const parsed = parseLabel(label);
      if (!("error" in parsed)) return { link: parsed, rest: url.pathname || "/" };
      // A named site on this loader, such as library.<root>/books/.
      if (host.slice(dot + 1) === root && isUsableName(label)) return { name: label, rest: url.pathname || "/" };
    }
  }
  return {
    error: "Not a recognised address. Paste 64 hex characters, an ant:// link, a site link or a short name.",
  };
}
