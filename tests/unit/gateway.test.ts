import { afterEach, describe, expect, it, vi } from "vitest";
import { isLocalLoader } from "../../src/source";
import { GatewayFirstSource, GatewaySource } from "../../src/source/gateway";
import { type FetchArchiveResult, type SiteSource, SourceError } from "../../src/source/types";

const A = "a".repeat(64);
const TARGET = "AB".repeat(32);
const HASH = "c".repeat(64);
const MAX = 1000;

type Route = (url: string) => Response | Promise<Response>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const CONNECTED = () => json(200, { connected: true, antd: { reachable: true, connectedPeers: 9 } });

/** Stubs fetch with one handler per gateway endpoint; records every URL asked for. */
function gateway(routes: Partial<Record<"status" | "pointer" | "fetch", Route>>): string[] {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: string) => {
    calls.push(input);
    const name = input.replace("/_autonomi/local/", "").split(/[/?]/)[0] as "status" | "pointer" | "fetch";
    const route = routes[name];
    if (!route) throw new TypeError("Failed to fetch");
    return route(input);
  });
  return calls;
}

function archive(bytes: Uint8Array<ArrayBuffer>, headers: Record<string, string> = {}): Response {
  return new Response(bytes, {
    headers: { "x-antnet-blake3": HASH, "content-length": String(bytes.length), ...headers },
  });
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return e instanceof SourceError ? e.code : `not a SourceError: ${String(e)}`;
  }
  return "resolved";
}

/** A WebRTC stand-in that records what it was asked. */
function fakeBrowser() {
  const asked: string[] = [];
  const source: SiteSource = {
    name: "browser",
    connect: async () => void asked.push("connect"),
    resolvePointer: async (a) => (asked.push(`pointer ${a}`), "b".repeat(64)),
    fetchArchive: async (a): Promise<FetchArchiveResult> => (
      asked.push(`fetch ${a}`), { bytes: new Uint8Array([9]), blake3: "d".repeat(64), chunks: 3 }
    ),
    close: () => void asked.push("close"),
  };
  return { asked, make: async () => source };
}

afterEach(() => vi.unstubAllGlobals());

describe("isLocalLoader", () => {
  it("is true only under a .localhost root", () => {
    expect(isLocalLoader("start.antnet.localhost")).toBe(false); // no configured root: the root is "localhost"
    expect(isLocalLoader("antnet.autonomirror.com")).toBe(false);
    expect(isLocalLoader("localhost")).toBe(false);
    vi.stubEnv("VITE_LOADER_ROOT", "antnet.localhost");
    try {
      expect(isLocalLoader("start.antnet.localhost")).toBe(true);
      expect(isLocalLoader("antnet.localhost")).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
    vi.stubEnv("VITE_LOADER_ROOT", "antnet.autonomirror.com");
    try {
      expect(isLocalLoader("start.antnet.autonomirror.com")).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("GatewaySource", () => {
  it("connects only when antd is connected", async () => {
    gateway({ status: CONNECTED });
    await expect(new GatewaySource().connect()).resolves.toBeUndefined();
    gateway({ status: () => json(200, { connected: false, antd: { reachable: false } }) });
    expect(await codeOf(new GatewaySource().connect())).toBe("network");
    gateway({});
    expect(await codeOf(new GatewaySource().connect())).toBe("network");
    gateway({ status: () => new Response("<html>", { status: 200 }) });
    expect(await codeOf(new GatewaySource().connect())).toBe("network");
  });

  it("resolves pointers to a lowercase archive address", async () => {
    const calls = gateway({ pointer: () => json(200, { kind: "chunk", kindTag: 0, target: TARGET }) });
    expect(await new GatewaySource().resolvePointer(A)).toBe(TARGET.toLowerCase());
    expect(calls).toEqual([`/_autonomi/local/pointer/${A}`]);
  });

  it("refuses pointers to things other than files", async () => {
    gateway({ pointer: () => json(200, { kind: "pointer", kindTag: 1, target: TARGET }) });
    expect(await codeOf(new GatewaySource().resolvePointer(A))).toBe("not-chunk");
    gateway({ pointer: () => json(200, { kind: "chunk", kindTag: 0, target: "zz" }) });
    expect(await codeOf(new GatewaySource().resolvePointer(A))).toBe("network");
  });

  it("maps the gateway's errors to the loader's", async () => {
    gateway({ pointer: () => json(404, { error: "not-found", message: "pointer not found" }) });
    expect(await codeOf(new GatewaySource().resolvePointer(A))).toBe("not-found");
    gateway({ pointer: () => json(503, { error: "antd-unreachable", message: "x" }) });
    expect(await codeOf(new GatewaySource().resolvePointer(A))).toBe("network");
    gateway({ fetch: () => json(413, { error: "too-large", message: "x" }) });
    expect(await codeOf(new GatewaySource().fetchArchive(A, { maxBytes: MAX }))).toBe("too-large");
    gateway({ fetch: () => new Response("Bad gateway", { status: 502 }) });
    expect(await codeOf(new GatewaySource().fetchArchive(A, { maxBytes: MAX }))).toBe("network");
    gateway({});
    expect(await codeOf(new GatewaySource().fetchArchive(A, { maxBytes: MAX }))).toBe("network");
  });

  it("fetches an archive with its hash, the limit passed on, and progress", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const calls = gateway({ fetch: () => archive(bytes) });
    const progress: unknown[] = [];
    const r = await new GatewaySource().fetchArchive(A, { maxBytes: MAX, onProgress: (...a) => progress.push(a) });
    expect(r.bytes).toEqual(bytes);
    expect(r.blake3).toBe(HASH);
    expect(r.via).toBe("gateway");
    expect(r.chunks).toBeUndefined();
    expect(calls).toEqual([`/_autonomi/local/fetch/${A}?max=${MAX}`]);
    expect(progress.at(-1)).toEqual([5, 5, "bytes"]);
  });

  it("refuses an archive with no hash, too many bytes or too few", async () => {
    gateway({ fetch: () => archive(new Uint8Array(5), { "x-antnet-blake3": "" }) });
    expect(await codeOf(new GatewaySource().fetchArchive(A, { maxBytes: MAX }))).toBe("network");
    gateway({ fetch: () => archive(new Uint8Array(5)) });
    expect(await codeOf(new GatewaySource().fetchArchive(A, { maxBytes: 4 }))).toBe("too-large");
    gateway({ fetch: () => archive(new Uint8Array(5), { "content-length": "9" }) });
    expect(await codeOf(new GatewaySource().fetchArchive(A, { maxBytes: MAX }))).toBe("network");
  });

  it("reports cancelling as aborted", async () => {
    const stop = new AbortController();
    stop.abort();
    vi.stubGlobal("fetch", async () => {
      throw new DOMException("Aborted", "AbortError");
    });
    expect(await codeOf(new GatewaySource().fetchArchive(A, { maxBytes: MAX, signal: stop.signal }))).toBe("aborted");
  });
});

describe("GatewayFirstSource", () => {
  it("uses only the gateway when it is connected", async () => {
    const browser = fakeBrowser();
    gateway({
      status: CONNECTED,
      pointer: () => json(200, { kind: "chunk", kindTag: 0, target: TARGET }),
      fetch: () => archive(new Uint8Array([7])),
    });
    const s = new GatewayFirstSource(browser.make);
    await s.connect();
    expect(await s.resolvePointer(A)).toBe(TARGET.toLowerCase());
    expect((await s.fetchArchive(A, { maxBytes: MAX })).via).toBe("gateway");
    s.close();
    expect(browser.asked).toEqual([]);
  });

  it("uses WebRTC when no gateway is connected, and says so", async () => {
    const browser = fakeBrowser();
    const calls = gateway({ status: () => json(200, { connected: false }) });
    const s = new GatewayFirstSource(browser.make);
    await s.connect();
    const r = await s.fetchArchive(A, { maxBytes: MAX });
    expect(r.via).toBe("browser");
    expect(r.chunks).toBe(3);
    expect(browser.asked).toEqual(["connect", "connect", `fetch ${A}`]);
    // The status is asked once, then the gateway is left alone.
    expect(calls).toEqual(["/_autonomi/local/status"]);
  });

  it("falls back to WebRTC when the gateway fails, and stays there", async () => {
    const browser = fakeBrowser();
    const calls = gateway({
      status: CONNECTED,
      pointer: () => json(502, { error: "network", message: "antd answered 500" }),
      fetch: () => archive(new Uint8Array([7])),
    });
    const s = new GatewayFirstSource(browser.make);
    await s.connect();
    expect(await s.resolvePointer(A)).toBe("b".repeat(64));
    expect((await s.fetchArchive(A, { maxBytes: MAX })).via).toBe("browser");
    expect(calls).toEqual(["/_autonomi/local/status", `/_autonomi/local/pointer/${A}`]);
  });

  it("passes on answers that settle the question, without asking WebRTC", async () => {
    const browser = fakeBrowser();
    gateway({
      status: CONNECTED,
      pointer: () => json(404, { error: "not-found", message: "no such pointer" }),
      fetch: () => json(413, { error: "too-large", message: "x" }),
    });
    const s = new GatewayFirstSource(browser.make);
    expect(await codeOf(s.resolvePointer(A))).toBe("not-found");
    expect(await codeOf(s.fetchArchive(A, { maxBytes: MAX }))).toBe("too-large");
    expect(browser.asked).toEqual([]);
  });
});
