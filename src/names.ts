// The short-name directory (DEMO.md 5.9): one JSON file, served by the loader's host at
// /_autonomi/names.json on every origin. A name points to a pointer or to an archive address.
// The host controls which site a name leads to, never what a site contains: the content is
// still fetched from Autonomi by address and verified. The info page shows the whole chain.

import { isAddressHex } from "./base32";
import { type SiteLink, isUsableName } from "./host";

export const NAMES_PATH = "/_autonomi/names.json";

export interface NameEntry extends SiteLink {
  /** Date the name was registered (YYYY-MM-DD), if the directory records it. */
  since?: string;
}

export type NameDirectory = Map<string, NameEntry>;

/** Read a directory file, keeping only well-formed entries. Throws if the file itself is malformed. */
export function parseNames(raw: unknown): NameDirectory {
  const names = (raw as { names?: unknown } | null)?.names;
  if (typeof names !== "object" || names === null || Array.isArray(names)) {
    throw new Error("The name directory is not in the expected format");
  }
  const out: NameDirectory = new Map();
  for (const [name, value] of Object.entries(names as Record<string, unknown>)) {
    const e = value as { kind?: unknown; address?: unknown; since?: unknown } | null;
    if (!isUsableName(name) || !e || (e.kind !== "i" && e.kind !== "p")) continue;
    if (typeof e.address !== "string" || !isAddressHex(e.address)) continue;
    out.set(name, { kind: e.kind, address: e.address, ...(typeof e.since === "string" ? { since: e.since } : {}) });
  }
  return out;
}

/** Fetch the directory from this origin. Reserved paths always go to the host, never the site cache. */
export async function fetchNames(signal?: AbortSignal): Promise<NameDirectory> {
  const res = await fetch(NAMES_PATH, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`The name directory couldn't be read (HTTP ${res.status})`);
  if (!(res.headers.get("Content-Type") ?? "").includes("json")) {
    throw new Error("This loader has no name directory");
  }
  return parseNames(await res.json());
}
