import { describe, expect, it } from "vitest";
import {
  buildDownloadUrl,
  buildGeneratorUrl,
  defaultName,
  downloadPath,
  parseDownloadParams,
  parseDownloadPath,
  sanitizeName,
  siteBaseUrl,
} from "../../../sites/download/src/lib/params";

const A = "711c7e20006ff3e0ac6c1f3063286a0c1a3e4c409642e8c526173fa60bb7078a";
const BASE = "https://example.github.io/autonomirror/";

describe("sanitizeName", () => {
  it.each([
    ["my-mod-v1.2.zip", "my-mod-v1.2.zip"],
    ["../../etc/passwd", "etcpasswd"],
    ['a/b\c:d*e?f"g<h>i|j.txt', "abcdefghij.txt"],
    ["  spaced name.pdf  ", "spaced name.pdf"],
    ["tab\there\n.txt", "tabhere.txt"],
    ["evil‮txt.exe", "eviltxt.exe"],
    ["trailing dots...", "trailing dots"],
    [".hidden", "hidden"],
    ["Mandelbrot zoom.mp4", "Mandelbrot zoom.mp4"],
    ["日本語 (final).zip", "日本語 (final).zip"],
    ["///", ""],
  ])("%j → %j", (input, out) => expect(sanitizeName(input)).toBe(out));

  it("caps at 200 characters without splitting surrogate pairs", () => {
    expect(sanitizeName("x".repeat(500))).toHaveLength(200);
    const emoji = sanitizeName("😀".repeat(300));
    expect(Array.from(emoji)).toHaveLength(200);
  });
});

describe("parseDownloadParams", () => {
  it("parses a full link", () => {
    expect(parseDownloadParams(`?a=${A}&n=lucky.jpg&s=138931`)).toEqual({
      ok: true,
      params: { address: A, name: "lucky.jpg", nameProvided: true, size: 138931 },
    });
  });

  it("defaults the name and ignores a bad size", () => {
    const r = parseDownloadParams(`?a=${A}&s=12abc`);
    expect(r).toEqual({ ok: true, params: { address: A, name: defaultName(A), nameProvided: false, size: undefined } });
    expect(defaultName(A)).toBe("autonomi-711c7e20.bin");
  });

  it("treats a name that sanitises to nothing as missing", () => {
    const r = parseDownloadParams(`?a=${A}&n=%2F%2F`);
    expect(r.ok && r.params.nameProvided).toBe(false);
  });

  it.each([
    ["", "missing-address"],
    ["?n=x.zip", "missing-address"],
    [`?a=${A.toUpperCase()}`, "invalid-address"],
    [`?a=${A.slice(1)}`, "invalid-address"],
    [`?a=${A}<script>`, "invalid-address"],
  ])("rejects %j", (search, reason) => {
    expect(parseDownloadParams(search)).toEqual({ ok: false, reason });
  });
});

describe("buildDownloadUrl", () => {
  it("puts the address in the path, as /f/ant/<address>", () => {
    expect(buildDownloadUrl(BASE, { address: A, name: "lucky.jpg", size: 138931 })).toBe(
      `${BASE}f/ant/${A}?n=lucky.jpg&s=138931`,
    );
  });

  it("encodes characters that would break Markdown or HTML", () => {
    const url = buildDownloadUrl(BASE, { address: A, name: "Mod (v2) & 'extras'!.zip" });
    expect(url).toBe(`${BASE}f/ant/${A}?n=Mod%20%28v2%29%20%26%20%27extras%27%21.zip`);
    expect(url).not.toMatch(/[ ()'!]/);
  });

  it.each(["Mandelbrot zoom.mp4", "日本語 (final).zip", "a+b=c#d?.tar.gz", "😀.png"])(
    "round-trips %j",
    (name) => {
      const url = new URL(buildDownloadUrl(BASE, { address: A, name, size: 42 }));
      const r = parseDownloadPath(url.pathname.slice(new URL(BASE).pathname.length - 1), url.search);
      expect(r).toEqual({ ok: true, params: { address: A, name: sanitizeName(name), nameProvided: true, size: 42 } });
    },
  );

  it("omits empty name and size, and adds a missing trailing slash", () => {
    expect(buildDownloadUrl("https://x.test", { address: A, name: "" })).toBe(`https://x.test/f/ant/${A}`);
  });

  it("builds a pre-filled generator link", () => {
    expect(buildGeneratorUrl(BASE, { address: A, name: "a b.zip" })).toBe(`${BASE}?a=${A}&n=a%20b.zip`);
  });
});

describe("parseDownloadPath", () => {
  it("reads the address from the path and the name and size from the query", () => {
    expect(parseDownloadPath(`/f/ant/${A}`, "?n=lucky.jpg&s=138931")).toEqual({
      ok: true,
      params: { address: A, name: "lucky.jpg", nameProvided: true, size: 138931 },
    });
  });
  it("accepts a trailing slash and capital letters", () => {
    const r = parseDownloadPath(`/f/ant/${A.toUpperCase()}/`, "");
    expect(r).toEqual({ ok: true, params: { address: A, name: defaultName(A), nameProvided: false, size: undefined } });
  });
  it.each([
    ["/f/ant/", "missing-address"],
    ["/f/", "missing-address"],
    [`/f/ant/${A.slice(1)}`, "invalid-address"],
    [`/f/ant/${A}0`, "invalid-address"],
    ["/f/ant/%3Cscript%3E", "invalid-address"],
  ])("rejects %j", (path, reason) => {
    expect(parseDownloadPath(path, "")).toEqual({ ok: false, reason });
  });
});

describe("downloadPath", () => {
  it("moves an old /d/?a= link to the new form, keeping its name and size", () => {
    const old = parseDownloadParams(`?a=${A}&n=a%20b.zip&s=42`);
    expect(old.ok && downloadPath(old.params)).toBe(`/f/ant/${A}?n=a%20b.zip&s=42`);
  });
  it("leaves out a name the link didn't have", () => {
    const old = parseDownloadParams(`?a=${A}`);
    expect(old.ok && downloadPath(old.params)).toBe(`/f/ant/${A}`);
  });
});

describe("siteBaseUrl", () => {
  it("uses the base the page was built with", () => {
    expect(siteBaseUrl("https://download.antnet.autonomirror.com", "http://localhost:5173")).toBe(
      "https://download.antnet.autonomirror.com/",
    );
  });
  it("falls back to the page's own origin", () => {
    expect(siteBaseUrl("", "http://download.localhost:5173")).toBe("http://download.localhost:5173/");
  });
});
