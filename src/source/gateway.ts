// Antnet Gateway on the user's own computer (DEMO.md 12.10): the loader's reads go to the
// gateway's /_autonomi/local/ endpoints on this origin, which pass them to a local antd. The
// native client fetches and checks every chunk, so the browser only receives the result.

import { type FetchArchiveOptions, type FetchArchiveResult, type SiteSource, SourceError, type SourceErrorCode } from "./types";

export const GATEWAY_PREFIX = "/_autonomi/local/";
/** How long the status call may take before the gateway counts as absent. */
const STATUS_TIMEOUT_MS = 3000;

export interface GatewayStatus {
  connected: boolean;
  gateway?: { name?: string; version?: string };
  antd?: { reachable?: boolean; version?: string; network?: string; connectedPeers?: number };
}

/** Is a local gateway answering with antd connected? Never throws. */
export async function gatewayStatus(signal?: AbortSignal): Promise<GatewayStatus | null> {
  const timeout = AbortSignal.timeout(STATUS_TIMEOUT_MS);
  try {
    const res = await fetch(GATEWAY_PREFIX + "status", {
      cache: "no-store",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as GatewayStatus;
    return typeof body?.connected === "boolean" ? body : null;
  } catch {
    return null;
  }
}

/** The gateway's error codes, as the loader's. Anything unknown is a network failure. */
function codeFor(error: unknown): SourceErrorCode {
  switch (error) {
    case "not-found":
      return "not-found";
    case "too-large":
      return "too-large";
    default:
      return "network";
  }
}

async function failure(res: Response): Promise<SourceError> {
  let code: unknown;
  let message = `The gateway answered ${res.status}`;
  try {
    const body = (await res.json()) as { error?: unknown; message?: unknown };
    code = body.error;
    if (typeof body.message === "string" && body.message) message = `${String(code)}: ${body.message}`;
  } catch {
    // Not the gateway's JSON: keep the status.
  }
  return new SourceError(message, codeFor(code));
}

function wrap(e: unknown, signal?: AbortSignal): SourceError {
  if (e instanceof SourceError) return e;
  if (signal?.aborted || (e instanceof Error && e.name === "AbortError")) {
    return new SourceError("Cancelled", "aborted", { cause: e });
  }
  return new SourceError(`The gateway didn't answer: ${e instanceof Error ? e.message : String(e)}`, "network", { cause: e });
}

const HEX64 = /^[0-9a-f]{64}$/;

export class GatewaySource implements SiteSource {
  readonly name = "gateway";

  async connect(signal?: AbortSignal): Promise<void> {
    const status = await gatewayStatus(signal);
    if (signal?.aborted) throw new SourceError("Cancelled", "aborted");
    if (!status) throw new SourceError("No Antnet Gateway is answering on this computer", "network");
    if (!status.connected) throw new SourceError("antd isn't connected to the Autonomi network", "network");
  }

  async resolvePointer(address: string, signal?: AbortSignal): Promise<string> {
    let body: { kind?: unknown; kindTag?: unknown; target?: unknown };
    try {
      const res = await fetch(GATEWAY_PREFIX + "pointer/" + address, { cache: "no-store", signal });
      if (!res.ok) throw await failure(res);
      body = await res.json();
    } catch (e) {
      throw wrap(e, signal);
    }
    if (body.kind !== "chunk") {
      throw new SourceError(`Pointer target is a ${String(body.kind)} (kind ${String(body.kindTag)}), not a file`, "not-chunk");
    }
    const target = typeof body.target === "string" ? body.target.toLowerCase() : "";
    if (!HEX64.test(target)) throw new SourceError("The gateway sent a malformed pointer target", "network");
    return target;
  }

  async fetchArchive(address: string, opts: FetchArchiveOptions): Promise<FetchArchiveResult> {
    const { signal } = opts;
    try {
      const url = `${GATEWAY_PREFIX}fetch/${address}?max=${opts.maxBytes}`;
      const res = await fetch(url, { cache: "no-store", signal });
      if (!res.ok) throw await failure(res);
      const blake3 = (res.headers.get("x-antnet-blake3") ?? "").toLowerCase();
      if (!HEX64.test(blake3)) throw new SourceError("The gateway sent no content hash", "network");
      const total = Number(res.headers.get("content-length")) || undefined;
      const bytes = await readAll(res, opts.maxBytes, (done) => opts.onProgress?.(done, total, "bytes"));
      if (total !== undefined && bytes.length !== total) {
        throw new SourceError(`The gateway sent ${bytes.length} of ${total} bytes`, "network");
      }
      return { bytes, blake3, via: "gateway" };
    } catch (e) {
      throw wrap(e, signal);
    }
  }

  close(): void {
    // Nothing held open: each call is one request.
  }
}

/**
 * The body, with progress as it arrives. The gateway only starts sending once antd has the
 * whole file, so this mostly shows the copy from the gateway, not the download.
 */
async function readAll(res: Response, maxBytes: number, onProgress: (done: number) => void): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let done = 0;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    done += value.length;
    if (done > maxBytes) {
      await reader.cancel();
      throw new SourceError(`The archive is over ${maxBytes} bytes`, "too-large");
    }
    parts.push(value);
    onProgress(done);
  }
  const out = new Uint8Array(done);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/**
 * The gateway first, then the browser's own WebRTC client (DEMO.md 12.10, "The shell tries the
 * app first"). A gateway that is absent, has no connected antd or fails with a network error
 * hands over to WebRTC for the rest of this source's life. Answers that settle the question
 * (not found, too large, not a file) are passed on as they are: the native client reaches more
 * of the network than the browser does, so WebRTC wouldn't do better.
 */
export class GatewayFirstSource implements SiteSource {
  readonly name = "gateway-first";
  private readonly gateway = new GatewaySource();
  private browser: SiteSource | null = null;
  private gatewayUp: Promise<boolean> | null = null;

  constructor(private readonly makeBrowser: () => Promise<SiteSource>) {}

  /** Checks the gateway once; connects WebRTC only if the gateway isn't usable. */
  async connect(signal?: AbortSignal): Promise<void> {
    if (await this.useGateway(signal)) return;
    const browser = await this.getBrowser();
    await browser.connect?.(signal);
  }

  resolvePointer(address: string, signal?: AbortSignal): Promise<string> {
    return this.either(
      () => this.gateway.resolvePointer(address, signal),
      (b) => b.resolvePointer(address, signal),
      signal,
    );
  }

  fetchArchive(address: string, opts: FetchArchiveOptions): Promise<FetchArchiveResult> {
    return this.either(
      () => this.gateway.fetchArchive(address, opts),
      async (b) => ({ ...(await b.fetchArchive(address, opts)), via: "browser" as const }),
      opts.signal,
    );
  }

  close(): void {
    this.gateway.close();
    this.browser?.close();
    this.browser = null;
  }

  private useGateway(signal?: AbortSignal): Promise<boolean> {
    this.gatewayUp ??= this.gateway.connect(signal).then(
      () => true,
      (e) => {
        console.info("[autonomi-loader] Antnet Gateway not used:", e instanceof Error ? e.message : e);
        return false;
      },
    );
    return this.gatewayUp;
  }

  private async getBrowser(): Promise<SiteSource> {
    this.browser ??= await this.makeBrowser();
    return this.browser;
  }

  private async either<T>(viaGateway: () => Promise<T>, viaBrowser: (b: SiteSource) => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (await this.useGateway(signal)) {
      try {
        return await viaGateway();
      } catch (e) {
        if (!(e instanceof SourceError) || e.code !== "network") throw e;
        console.warn("[autonomi-loader] Antnet Gateway failed; using WebRTC from now on:", e.message);
        this.gatewayUp = Promise.resolve(false);
      }
    }
    const browser = await this.getBrowser();
    await browser.connect?.(signal);
    return viaBrowser(browser);
  }
}
