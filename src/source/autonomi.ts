// SDK-backed source: AutonomiClient over WebRTC to mainnet (bundled seeds, no wallet needed).

import { AutonomiClient, AutonomiError, type ProgressEvent } from "@withautonomi/ant-browser-sdk";
import type { Arrival, RecordDetail } from "../state";
import { type FetchArchiveOptions, type FetchArchiveResult, type SiteSource, SourceError } from "./types";

/** Every message in the cause chain, for matching the core's error text. */
function messages(e: unknown): string {
  const parts: string[] = [];
  for (let c: unknown = e, depth = 0; c && depth < 6; c = (c as { cause?: unknown }).cause, depth++) {
    const text = c instanceof Error ? c.message : String(c);
    // Wrapped errors often end with their cause's message; keep each piece once.
    if (!parts.some((p) => p.includes(text))) parts.push(text);
  }
  return parts.join(" | ");
}

function wrap(e: unknown, signal?: AbortSignal): SourceError {
  if (e instanceof SourceError) return e;
  const code = e instanceof AutonomiError ? e.code : "";
  const text = messages(e);
  const message = code ? `${code}: ${text}` : text;
  if (signal?.aborted || (e instanceof Error && e.name === "AbortError")) {
    return new SourceError("Cancelled", "aborted", { cause: e });
  }
  if (/download memory budget/i.test(text)) return new SourceError(message, "too-large", { cause: e });
  if (/not found|ChunkNotFound/i.test(text)) return new SourceError(message, "not-found", { cause: e });
  return new SourceError(message, "network", { cause: e });
}

/** sessionStorage "autonomiDebug" logs every SDK progress event, for diagnosing slow opens. */
function debugListener(): ((ev: ProgressEvent) => void) | undefined {
  try {
    if (!sessionStorage.getItem("autonomiDebug")) return undefined;
  } catch {
    return undefined;
  }
  const t0 = performance.now();
  return (ev) => {
    const at = ((performance.now() - t0) / 1000).toFixed(2);
    const count = ev.completed !== undefined ? ` ${ev.completed}/${ev.total ?? "?"} ${ev.unit ?? ""}` : "";
    console.debug(`[sdk ${at}s] ${ev.operation}/${ev.phase} ${ev.status}${count}: ${ev.message}`);
  };
}

/** sessionStorage "autonomiConcurrency" (1–256) overrides the SDK's "auto", for measurements. */
function experimentalConcurrency(): number | "auto" {
  try {
    const n = Number(sessionStorage.getItem("autonomiConcurrency"));
    if (Number.isInteger(n) && n >= 1 && n <= 256) return n;
  } catch {
    // Default below.
  }
  return "auto";
}

export class AutonomiSource implements SiteSource {
  readonly name = "autonomi";
  private client: AutonomiClient | null = null;
  private connecting: Promise<AutonomiClient> | null = null;
  private closed = false;

  async connect(signal?: AbortSignal): Promise<void> {
    await this.getClient(signal);
  }

  private getClient(signal?: AbortSignal): Promise<AutonomiClient> {
    if (this.closed) return Promise.reject(new SourceError("Source closed", "aborted"));
    if (this.client) return Promise.resolve(this.client);
    if (!this.connecting) {
      const pending = AutonomiClient.connect({ signal, onProgress: debugListener() }).then((c) => {
        // close() was called while connecting: don't leave a live client behind.
        if (this.closed) {
          c.close();
          throw new SourceError("Source closed", "aborted");
        }
        return (this.client = c);
      });
      this.connecting = pending;
      pending.catch(() => {
        if (this.connecting === pending) this.connecting = null;
      });
    }
    const pending = this.connecting;
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new SourceError("Cancelled", "aborted"));
      signal?.addEventListener("abort", () => reject(new SourceError("Cancelled", "aborted")), { once: true });
      pending.then(resolve, (e) => reject(wrap(e, signal)));
    });
  }

  async resolvePointer(address: string, signal?: AbortSignal): Promise<string> {
    const client = await this.getClient(signal);
    let target;
    try {
      target = await client.resolvePointer(address, { signal });
    } catch (e) {
      throw wrap(e, signal);
    }
    if (target.kind !== "chunk") {
      throw new SourceError(`Pointer target is a ${target.kind} (kind ${target.kindTag}), not a file`, "not-chunk");
    }
    return target.target.toLowerCase();
  }

  async fetchArchive(address: string, opts: FetchArchiveOptions): Promise<FetchArchiveResult> {
    const client = await this.getClient(opts.signal);
    const started = performance.now();
    const at = () => Math.round(performance.now() - started);
    const arrivals: Arrival[] = [];
    let dataMapMs: number | undefined;
    const onProgress = (ev: ProgressEvent) => {
      if (ev.status !== "running" || ev.phase !== "downloading") return;
      if (ev.completed !== undefined && (ev.unit === "bytes" || ev.unit === "records")) {
        opts.onProgress?.(ev.completed, ev.total, ev.unit);
        return;
      }
      if (/Verified public DataMap/.test(ev.message)) dataMapMs ??= at();
      // SDK 0.1.5 reports chunk progress only in the message text: "Downloaded chunk 2/3".
      // Clients built from ant-client #249 onwards add the serving node:
      // "Downloaded chunk 3/147 from <peer> after 1 attempts".
      const m = /Downloaded chunk (\d+)\/(\d+)(?: from (\S+))?/.exec(ev.message);
      if (m) {
        const n = Number(m[1]);
        // "0/3" only announces the total; each later count is one more chunk arriving.
        if (n > 0 && n > arrivals.length) arrivals.push({ ms: at(), ...(m[3] ? { node: m[3] } : {}) });
        opts.onProgress?.(n, Number(m[2]), "records");
      }
    };
    try {
      const result = await client.download(address, {
        maxMemoryBytes: opts.maxBytes,
        concurrency: experimentalConcurrency(),
        signal: opts.signal,
        onProgress,
      });
      const recordList: RecordDetail[] = [
        {
          kind: "datamap",
          address,
          bytes: result.file.dataMapSize,
          ...(result.dataMapNode?.peerId ? { node: result.dataMapNode.peerId } : {}),
          ...(dataMapMs !== undefined ? { ms: dataMapMs } : {}),
        },
        ...result.file.chunks.map(
          (c): RecordDetail => ({ kind: "chunk", index: c.index, address: c.dstHash, bytes: c.srcSize }),
        ),
      ];
      return { bytes: result.bytes, blake3: result.hash, chunks: result.file.chunks.length, recordList, arrivals };
    } catch (e) {
      throw wrap(e, opts.signal);
    }
  }

  close(): void {
    this.closed = true;
    this.client?.close();
    this.client = null;
    this.connecting = null;
  }
}
