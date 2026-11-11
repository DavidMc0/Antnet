// Test source: reads /_autonomi/fixtures/<address>.tar and pointers/<address>.json over HTTP.
// A fixture's address is the SHA-256 of its bytes, which this source verifies, standing in
// for the BLAKE3 check the SDK does.

import { bytesToHex } from "../base32";
import { type FetchArchiveOptions, type FetchArchiveResult, type SiteSource, SourceError } from "./types";

const BASE = "/_autonomi/fixtures/";
const FIXTURE_CHUNK = 4 * 1024 * 1024;

/** Artificial latency for exercising time budgets in tests (sessionStorage "fixtureDelay", ms). */
function delayMs(): number {
  try {
    return Number(sessionStorage.getItem("fixtureDelay") ?? 0) || 0;
  } catch {
    return 0;
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ms <= 0) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new SourceError("Cancelled", "aborted"));
      },
      { once: true },
    );
  });
}

function networkError(e: unknown, signal?: AbortSignal): SourceError {
  return new SourceError(`Request failed: ${e}`, signal?.aborted ? "aborted" : "network", { cause: e });
}

export class FixtureSource implements SiteSource {
  readonly name = "fixture";

  async connect(signal?: AbortSignal): Promise<void> {
    await sleep(delayMs(), signal);
  }

  async resolvePointer(address: string, signal?: AbortSignal): Promise<string> {
    let current = address;
    for (let hops = 0; hops < 8; hops++) {
      const res = await fetch(`${BASE}pointers/${current}.json`, { signal, cache: "no-store" }).catch((e) => {
        throw networkError(e, signal);
      });
      if (res.status === 404) throw new SourceError("Pointer not found", "not-found");
      if (!res.ok) throw new SourceError(`Pointer read failed: HTTP ${res.status}`, "network");
      const p = (await res.json()) as { kind: string; target: string };
      if (p.kind === "pointer") {
        current = p.target;
        continue;
      }
      if (p.kind !== "chunk") throw new SourceError(`Pointer target is a ${p.kind}, not a file`, "not-chunk");
      return p.target;
    }
    throw new SourceError("Pointer chain too long", "not-chunk");
  }

  async fetchArchive(address: string, opts: FetchArchiveOptions): Promise<FetchArchiveResult> {
    const url = `${BASE}${address}.tar`;
    const head = await fetch(url, { method: "HEAD", signal: opts.signal, cache: "no-store" }).catch((e) => {
      throw networkError(e, opts.signal);
    });
    // Dev servers answer unknown paths with the shell's HTML; treat that as "no file".
    if (head.status === 404 || (head.headers.get("Content-Type") ?? "").includes("html")) {
      throw new SourceError("No file at this address", "not-found");
    }
    const declared = Number(head.headers.get("Content-Length") ?? NaN);
    if (Number.isFinite(declared) && declared > opts.maxBytes) {
      throw new SourceError(`File is ${declared} bytes, over the ${opts.maxBytes}-byte limit`, "too-large");
    }
    const res = await fetch(url, { signal: opts.signal, cache: "no-store" }).catch((e) => {
      throw networkError(e, opts.signal);
    });
    if (!res.ok || !res.body) throw new SourceError(`Download failed: HTTP ${res.status}`, "network");

    const reader = res.body.getReader();
    const parts: Uint8Array[] = [];
    let done = 0;
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      done += r.value.length;
      if (done > opts.maxBytes) {
        await reader.cancel();
        throw new SourceError(`File is over the ${opts.maxBytes}-byte limit`, "too-large");
      }
      parts.push(r.value);
      opts.onProgress?.(done, Number.isFinite(declared) ? declared : undefined);
    }
    const bytes = new Uint8Array(done);
    let o = 0;
    for (const p of parts) {
      bytes.set(p, o);
      o += p.length;
    }
    const hash = bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
    if (hash !== address) throw new SourceError("Downloaded bytes do not match the address", "verify");
    return { bytes, blake3: `sha256:${hash}`, chunks: Math.max(3, Math.ceil(bytes.length / FIXTURE_CHUNK)) };
  }

  close(): void {}
}
