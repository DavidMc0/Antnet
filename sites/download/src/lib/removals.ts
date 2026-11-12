// The removal list (DEMO.md 3.6): files this page won't hand out, such as ones named in a
// copyright notice, or malware. It doesn't remove anything from Autonomi; it stops this page,
// and buttons pointing at it, from serving those files.
//
// The list lives on Autonomi, so the page, the file and the list all come from the network.
// A pointer that only Autonomirror's key can move leads to the newest copy, a small JSON file:
//   { "v": 1, "updated": "2026-11-12T12:00:00Z", "sha256": ["<hex>", …] }
// Each entry is the SHA-256 of a removed address, written as 64 lowercase hex characters and
// hashed as text, so a permanent public copy isn't an index of removed files.
//
// It never fails closed: if the list can't be read, every file stays available. Only a file
// that is on the list is refused.

import type { AutonomiClient } from "@withautonomi/ant-browser-sdk";

export interface RemovalList {
  /** SHA-256 hashes of removed addresses. */
  hashes: ReadonlySet<string>;
  /** When the list was published, as written in it. */
  updated?: string;
}

/** What the page knows about the list so far. */
export type RemovalStatus =
  | { state: "none" } // no list is configured for this page
  | { state: "loading" }
  | { state: "loaded"; list: RemovalList }
  | { state: "unavailable"; reason: string };

/** How long to wait for the list before carrying on without it. */
export const REMOVALS_BUDGET_MS = 45_000;

const HEX64 = /^[0-9a-f]{64}$/;

/** SHA-256 of a removed address, as the list holds it. */
export async function addressHash(address: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address.toLowerCase()));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Read a published list. Throws on anything that isn't one. */
export function parseRemovalList(bytes: Uint8Array): RemovalList {
  const data = JSON.parse(new TextDecoder().decode(bytes)) as { v?: unknown; updated?: unknown; sha256?: unknown };
  if (data?.v !== 1 || !Array.isArray(data.sha256)) throw new Error("Not a removal list (expected v 1 with a sha256 array)");
  const hashes = new Set<string>();
  for (const h of data.sha256) {
    if (typeof h === "string" && HEX64.test(h)) hashes.add(h);
  }
  return { hashes, updated: typeof data.updated === "string" ? data.updated : undefined };
}

/** Whether an address is on a list. */
export async function isListed(list: RemovalList, address: string): Promise<boolean> {
  return list.hashes.has(await addressHash(address));
}

/**
 * Fetch the newest list: read the pointer, then the file it leads to. Gives up after
 * REMOVALS_BUDGET_MS. An empty `pointer` means no list is configured.
 */
export function loadRemovals(client: AutonomiClient, pointer: string): Promise<RemovalStatus> {
  if (!HEX64.test(pointer)) return Promise.resolve({ state: "none" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOVALS_BUDGET_MS);
  return (async (): Promise<RemovalStatus> => {
    try {
      const { target } = await client.resolvePointer(pointer, { signal: controller.signal });
      const file = await client.download(target, { signal: controller.signal });
      return { state: "loaded", list: parseRemovalList(file.bytes) };
    } catch (err) {
      const reason = controller.signal.aborted ? "timed out" : err instanceof Error ? err.message : String(err);
      // Never fail closed: without the list, files stay available.
      console.warn("[download] the removal list couldn't be read; carrying on without it:", reason);
      return { state: "unavailable", reason };
    } finally {
      clearTimeout(timer);
    }
  })();
}
