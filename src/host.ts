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
  | { view: "bad-label"; root: string; label: string; reason: string };

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
  // Browsers lowercase hostnames, so case can't make a label non-canonical; trailing bits can.
  const parsed = parseLabel(label);
  if ("error" in parsed) return { view: "bad-label", root, label, reason: parsed.error };
  return { view: "site", root, link: parsed, label };
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

export const GO_PREFIX = "/_autonomi/go";

/** If `url` is a portable go-link, return the absolute URL it redirects to. */
export function goLinkTarget(url: URL, root: string): string | null {
  if (!url.pathname.startsWith(GO_PREFIX + "/")) return null;
  const parsed = parseLinkPath(url.pathname.slice(GO_PREFIX.length));
  if (!parsed) return null;
  return siteOrigin(parsed.link, root, url.protocol, url.port) + parsed.rest + url.search + url.hash;
}

/** If `url` is a root-domain path form, return the subdomain URL it redirects to. */
export function pathFormTarget(url: URL, root: string): string | null {
  const parsed = parseLinkPath(url.pathname);
  if (!parsed) return null;
  return siteOrigin(parsed.link, root, url.protocol, url.port) + parsed.rest + url.search + url.hash;
}

/**
 * Parse what a visitor typed into the landing page's address box: 64 hex, `ant://<hex>`,
 * a path form (with or without a host) or a full site URL.
 */
export function parseAddressInput(
  input: string,
  root: string,
  rawHexKind: LinkKind = "i",
): { link: SiteLink; rest: string } | { error: string } {
  let text = input.trim();
  if (text === "") return { error: "Enter an address." };

  if (/^web\+ant:/i.test(text)) text = text.replace(/^web\+ant:/i, "ant:");
  // The ant CLI prints addresses as 0x-prefixed hex.
  if (/^0x[0-9a-f]{64}$/i.test(text)) text = text.slice(2);
  const ant = /^ant:\/\/([0-9a-fA-F]{64})(\/.*)?$/i.exec(text);
  if (ant) return { link: { kind: "i", address: ant[1].toLowerCase() }, rest: ant[2] ?? "/" };

  if (isAddressHex(text.toLowerCase())) return { link: { kind: rawHexKind, address: text.toLowerCase() }, rest: "/" };

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
      const parsed = parseLabel(host.slice(0, dot));
      if (!("error" in parsed)) return { link: parsed, rest: url.pathname || "/" };
    }
  }
  void root;
  return { error: "Not a recognised address. Paste 64 hex characters, an ant:// link or a site link." };
}
