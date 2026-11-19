import { describe, expect, it } from "vitest";
import {
  classifyHost,
  goLinkTarget,
  linkToLabel,
  loaderRootFor,
  parseAddressInput,
  appLink,
  parseLabel,
  pathFormTarget,
} from "../../src/host";
import { hexToLabelBody } from "../../src/base32";

const HEX = "7638ed03711612aabf27b1b3481c5f50cc9b20b28423603fa45a0029a5c76737";
const BODY = hexToLabelBody(HEX);

describe("labels", () => {
  it("round-trips a label to its address", () => {
    for (const kind of ["i", "p"] as const) {
      const label = linkToLabel({ kind, address: HEX });
      expect(label).toHaveLength(53);
      expect(parseLabel(label)).toEqual({ kind, address: HEX });
    }
  });

  it("rejects bad kinds, lengths and encodings", () => {
    expect(parseLabel("x" + BODY)).toHaveProperty("error");
    expect(parseLabel("i" + BODY.slice(1))).toHaveProperty("error");
    expect(parseLabel("i" + BODY + "a")).toHaveProperty("error");
    expect(parseLabel("i" + BODY.slice(0, 51) + "8")).toHaveProperty("error");
  });
});

describe("classifyHost", () => {
  it("treats localhost as the root in development", () => {
    expect(loaderRootFor("localhost")).toBe("localhost");
    expect(classifyHost("localhost")).toEqual({ view: "landing", root: "localhost" });
    expect(classifyHost(`i${BODY}.localhost`)).toMatchObject({ view: "site", link: { kind: "i", address: HEX } });
  });

  it("uses a configured root", () => {
    expect(classifyHost("loader.example", "loader.example").view).toBe("landing");
    expect(classifyHost(`p${BODY}.loader.example`, "loader.example")).toMatchObject({
      view: "site",
      root: "loader.example",
      link: { kind: "p", address: HEX },
    });
    expect(classifyHost("other.example", "loader.example").view).toBe("bad-label");
  });

  it("infers the root from a site label when none is configured", () => {
    expect(loaderRootFor(`i${BODY}.loader.example`)).toBe("loader.example");
    expect(loaderRootFor("www.loader.example")).toBe("www.loader.example");
  });

  it("shows an error for non-canonical or wrong-length labels", () => {
    expect(classifyHost(`i${BODY.slice(1)}.localhost`).view).toBe("bad-label");
    expect(classifyHost(`i${BODY.slice(0, 51)}8.localhost`).view).toBe("bad-label");
    expect(classifyHost(`a.i${BODY}.localhost`).view).toBe("bad-label");
    // One character too long for a label, and far too long for a short name.
    expect(classifyHost(`i${BODY}a.localhost`).view).toBe("bad-label");
  });
});

describe("path forms and go-links", () => {
  it("redirects root path forms to the subdomain, keeping path, query and fragment", () => {
    const url = new URL(`http://localhost:5173/ant/${HEX}/docs/a.html?x=1#top`);
    expect(pathFormTarget(url, "localhost")).toBe(`http://i${BODY}.localhost:5173/docs/a.html?x=1#top`);
    const p = new URL(`https://loader.example/p/ant/${HEX.toUpperCase()}`);
    expect(pathFormTarget(p, "loader.example")).toBe(`https://p${BODY}.loader.example/`);
    expect(pathFormTarget(new URL("https://loader.example/ant/abc"), "loader.example")).toBeNull();
  });

  it("resolves portable go-links", () => {
    const url = new URL(`https://iaaaa.loader.example/_autonomi/go/p/ant/${HEX}/a/b?q=1#f`);
    expect(goLinkTarget(url, "loader.example")).toBe(`https://p${BODY}.loader.example/a/b?q=1#f`);
    expect(goLinkTarget(new URL("https://x.loader.example/_autonomi/go/nope"), "loader.example")).toBeNull();
    expect(goLinkTarget(new URL(`https://x.loader.example/ant/${HEX}`), "loader.example")).toBeNull();
  });
});

describe("parseAddressInput", () => {
  const ok = (input: string, kind: "i" | "p" = "i") => parseAddressInput(input, "localhost", kind);
  it("accepts hex, ant:// links, path forms and site URLs", () => {
    expect(ok(HEX)).toEqual({ link: { kind: "i", address: HEX }, rest: "/" });
    expect(ok(` ${HEX.toUpperCase()} `, "p")).toEqual({ link: { kind: "p", address: HEX }, rest: "/" });
    expect(ok(`0x${HEX}`)).toEqual({ link: { kind: "i", address: HEX }, rest: "/" });
    expect(ok(`ant://${HEX}/x`)).toEqual({ link: { kind: "i", address: HEX }, rest: "/x" });
    expect(ok(`web+ant://${HEX}`)).toEqual({ link: { kind: "i", address: HEX }, rest: "/" });
    // The pointer form, the app's name hint, and deep links (DEMO.md 5.11).
    expect(ok(`ant://p/${HEX}`)).toEqual({ link: { kind: "p", address: HEX }, rest: "/" });
    expect(ok(`ANT://P/${HEX.toUpperCase()}/`)).toEqual({ link: { kind: "p", address: HEX }, rest: "/" });
    expect(ok(`ant://p/${HEX}?name=start`)).toEqual({ link: { kind: "p", address: HEX }, rest: "/" });
    expect(ok(`ant://${HEX}/f/ant/x?n=a.mp4&name=cinema&s=9#t`)).toEqual({
      link: { kind: "i", address: HEX },
      rest: "/f/ant/x?n=a.mp4&s=9#t",
    });
    expect(ok(`ant://${HEX}/x?names=1`)).toEqual({ link: { kind: "i", address: HEX }, rest: "/x?names=1" });
    expect(ok(`loader.example/p/ant/${HEX}`)).toEqual({ link: { kind: "p", address: HEX }, rest: "/" });
    expect(ok(`/ant/${HEX}/y`)).toEqual({ link: { kind: "i", address: HEX }, rest: "/y" });
    expect(ok(`https://p${BODY}.loader.example/z`)).toEqual({ link: { kind: "p", address: HEX }, rest: "/z" });
  });
  it("rejects anything else", () => {
    expect(ok("")).toHaveProperty("error");
    expect(ok("hello world")).toHaveProperty("error");
    expect(ok(HEX.slice(1))).toHaveProperty("error");
  });
});

describe("appLink", () => {
  const P = { kind: "p" as const, address: HEX };
  const I = { kind: "i" as const, address: HEX };

  it("carries the resolved address, the page and a name hint (DEMO.md 5.11)", () => {
    expect(appLink(I)).toBe(`ant://${HEX}`);
    expect(appLink(P)).toBe(`ant://p/${HEX}`);
    expect(appLink(P, { path: "/", name: "start" })).toBe(`ant://p/${HEX}/?name=start`);
    expect(appLink(I, { path: "/f/ant/x", search: "?n=a%20b.mp4&s=9", hash: "#t" })).toBe(
      `ant://${HEX}/f/ant/x?n=a%20b.mp4&s=9#t`,
    );
    expect(appLink(I, { path: "/", hash: "#top" })).toBe(`ant://${HEX}/#top`);
  });

  it("round-trips through the address box the app hands it to", () => {
    const cases: [typeof P | typeof I, Parameters<typeof appLink>[1], string][] = [
      [P, { name: "start" }, "/"],
      [I, { path: "/books/a.html", search: "?page=2", hash: "#ch3", name: "library" }, "/books/a.html?page=2#ch3"],
      [P, { path: "/f/ant/x", search: "?n=a%20b.mp4&s=9" }, "/f/ant/x?n=a%20b.mp4&s=9"],
    ];
    for (const [link, where, rest] of cases) {
      expect(parseAddressInput(appLink(link, where), "antnet.localhost")).toEqual({ link, rest });
    }
  });
});
