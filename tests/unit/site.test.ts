import { describe, expect, it } from "vitest";
import { NotASiteError, inspectArchive } from "../../src/install";
import {
  DEFAULT_SETTINGS,
  cachePathFor,
  headersFor,
  isReservedPath,
  mimeType,
  parseRange,
  parseSettings,
  resolvePath,
} from "../../src/site";
import { writeTar } from "../../tools/tar-writer.mjs";

const enc = new TextEncoder();
const json = (v: unknown) => enc.encode(JSON.stringify(v));

describe("parseSettings", () => {
  it("uses defaults when the file is absent", () => {
    expect(parseSettings(undefined)).toEqual({ settings: { ...DEFAULT_SETTINGS, headers: {} }, ignored: [] });
  });

  it("reads every field and keeps only allowed headers", () => {
    const { settings, ignored } = parseSettings(
      json({
        format: "autonomi-site/1",
        index: "main.html",
        notFound: "errors/404.html",
        spa: true,
        title: "T",
        headers: {
          "/*": { "content-security-policy": "default-src 'self'", "X-Frame-Options": "DENY" },
          "/api/*": { "Cross-Origin-Resource-Policy": "same-origin" },
          "/a*b": { "Permissions-Policy": "camera=()" },
          "/x": { "Permissions-Policy": "a\nb" },
        },
      }),
    );
    expect(settings).toMatchObject({ index: "main.html", notFound: "errors/404.html", spa: true, title: "T" });
    expect(settings.headers).toEqual({
      "/*": { "Content-Security-Policy": "default-src 'self'" },
      "/api/*": { "Cross-Origin-Resource-Policy": "same-origin" },
    });
    expect(ignored).toHaveLength(3);
    expect(ignored.join("\n")).toMatch(/X-Frame-Options/);
  });

  it("ignores invalid field values and rejects bad JSON or an unknown format", () => {
    const { settings, ignored } = parseSettings(json({ index: "../x.html", notFound: "/abs", spa: "yes" }));
    expect(settings).toMatchObject({ index: "index.html", notFound: "404.html", spa: false });
    expect(ignored).toHaveLength(3);
    expect(() => parseSettings(enc.encode("{"))).toThrow(/not valid JSON/);
    expect(() => parseSettings(json([1]))).toThrow(/JSON object/);
    expect(() => parseSettings(json({ format: "autonomi-site/2" }))).toThrow(/Unsupported site format/);
  });
});

describe("headersFor", () => {
  const { settings } = parseSettings(
    json({
      headers: {
        "/*": { "Content-Security-Policy": "all" },
        "/docs/*": { "Content-Security-Policy": "docs" },
        "/docs/a.html": { "Content-Security-Policy": "exact" },
      },
    }),
  );
  it("sets the fixed headers and picks the most specific pattern", () => {
    const h = headersFor("index.html", 12, settings);
    expect(h.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(h.get("Content-Length")).toBe("12");
    expect(h.get("X-Content-Type-Options")).toBe("nosniff");
    expect(h.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(h.get("Content-Security-Policy")).toBe("all");
    expect(headersFor("docs/b.html", 1, settings).get("Content-Security-Policy")).toBe("docs");
    expect(headersFor("docs/a.html", 1, settings).get("Content-Security-Policy")).toBe("exact");
  });
  it("maps MIME types by extension", () => {
    expect(mimeType("a/b.CSS")).toBe("text/css; charset=utf-8");
    expect(mimeType("clip.webm")).toBe("video/webm");
    expect(mimeType("Makefile")).toBe("application/octet-stream");
    expect(mimeType(".hidden")).toBe("application/octet-stream");
    expect(mimeType("a.unknownext")).toBe("application/octet-stream");
  });
});

describe("resolvePath (spec 5.2)", () => {
  const files = new Set(["index.html", "404.html", "docs/page.html", "about/index.html", "a b/c.html", "100%.txt"]);
  const has = (p: string) => files.has(p);
  const plain = { index: "index.html", notFound: "404.html", spa: false };
  const spa = { ...plain, spa: true };
  const r = (path: string, nav = true, settings = plain, search = "") => resolvePath(path, search, nav, settings, has);

  it("serves the index for / and directories", async () => {
    expect(await r("/")).toEqual({ kind: "file", path: "index.html", status: 200 });
    expect(await r("/about/")).toEqual({ kind: "file", path: "about/index.html", status: 200 });
  });
  it("serves nested files and decodes percent-escapes", async () => {
    expect(await r("/docs/page.html")).toEqual({ kind: "file", path: "docs/page.html", status: 200 });
    expect(await r("/a%20b/c.html")).toEqual({ kind: "file", path: "a b/c.html", status: 200 });
    expect(await r("/100%25.txt")).toEqual({ kind: "file", path: "100%.txt", status: 200 });
  });
  it("redirects a directory without a trailing slash, keeping the query", async () => {
    expect(await r("/about", true, plain, "?x=1")).toEqual({ kind: "redirect", status: 308, location: "/about/?x=1" });
  });
  it("serves the notFound page with 404, or plain text without one", async () => {
    expect(await r("/missing")).toEqual({ kind: "file", path: "404.html", status: 404 });
    const none = { ...plain, notFound: "nope.html" };
    expect(await r("/missing", true, none)).toMatchObject({ kind: "text", status: 404 });
  });
  it("serves the SPA index for navigations only", async () => {
    expect(await r("/users/42", true, spa)).toEqual({ kind: "file", path: "index.html", status: 200 });
    expect(await r("/users/42.js", false, spa)).toEqual({ kind: "file", path: "404.html", status: 404 });
    expect(await r("/docs/page.html", true, spa)).toEqual({ kind: "file", path: "docs/page.html", status: 200 });
  });
  it("rejects malformed paths and NUL with 400", async () => {
    expect(await r("/%E0%A4%A")).toMatchObject({ kind: "text", status: 400 });
    expect(await r("/a%00b")).toMatchObject({ kind: "text", status: 400 });
  });
  it("never serves reserved paths", async () => {
    const reserved = new Set(["index.html", "_autonomi/secret.txt", "autonomi-loader-sw.js"]);
    const hasR = (p: string) => reserved.has(p);
    expect(await resolvePath("/_autonomi/secret.txt", "", false, plain, hasR)).toMatchObject({ status: 404 });
    expect(await resolvePath("/autonomi-loader-sw.js", "", false, plain, hasR)).toMatchObject({ status: 404 });
  });
});

describe("parseRange", () => {
  it("parses single ranges and clamps the end", () => {
    expect(parseRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=900-", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=500-5000", 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange("bytes=-5000", 1000)).toEqual({ start: 0, end: 999 });
  });
  it("returns invalid for unsatisfiable ranges and null to ignore others", () => {
    expect(parseRange("bytes=1000-", 1000)).toBe("invalid");
    expect(parseRange("bytes=5-1", 1000)).toBe("invalid");
    expect(parseRange("bytes=-0", 1000)).toBe("invalid");
    expect(parseRange("bytes=-", 1000)).toBe("invalid");
    expect(parseRange(null, 1000)).toBeNull();
    expect(parseRange("bytes=0-1,5-6", 1000)).toBeNull();
    expect(parseRange("items=0-1", 1000)).toBeNull();
  });
});

describe("reserved paths and cache keys", () => {
  it("recognises reserved paths", () => {
    expect(isReservedPath("_autonomi")).toBe(true);
    expect(isReservedPath("_autonomi/x")).toBe(true);
    expect(isReservedPath("autonomi-loader-sw.js")).toBe(true);
    expect(isReservedPath("_autonomix/y")).toBe(false);
    expect(isReservedPath("docs/autonomi-loader-sw.js")).toBe(false);
  });
  it("reserves the media bridge's paths, which it answers before the site (DEMO.md 5.8)", () => {
    expect(isReservedPath("__autonomi_stream/abc/file")).toBe(true);
    expect(isReservedPath("media/__autonomi_stream/x")).toBe(true);
    expect(isReservedPath("__autonomi_stream")).toBe(false);
    expect(isReservedPath("my__autonomi_stream/x")).toBe(false);
  });
  it("percent-encodes each segment of a cache key", () => {
    expect(cachePathFor("a b/c?.html")).toBe("/a%20b/c%3F.html");
  });
});

describe("inspectArchive", () => {
  const f = (path: string, text = "x") => ({ path, bytes: enc.encode(text) });
  it("returns servable files and lists reserved ones as ignored", () => {
    const { files, ignored } = inspectArchive(
      writeTar([f("index.html"), f("_autonomi/secret.txt"), f("autonomi-loader-sw.js")]),
    );
    expect(files.map((x) => x.path)).toEqual(["index.html"]);
    expect(ignored).toHaveLength(2);
  });
  it("requires the index file", () => {
    expect(() => inspectArchive(writeTar([f("readme.txt")]))).toThrow(NotASiteError);
    const custom = writeTar([f("main.html"), { path: ".autonomi-site.json", bytes: json({ index: "main.html" }) }]);
    expect(inspectArchive(custom).settings.index).toBe("main.html");
  });
});
