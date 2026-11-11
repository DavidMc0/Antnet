// Short names (DEMO.md 5.9): the rules, hosts, links and the directory file.

import { describe, expect, it } from "vitest";
import { hexToLabelBody } from "../../src/base32";
import {
  classifyHost,
  goLinkTarget,
  isReservedName,
  isUsableName,
  isValidName,
  parseAddressInput,
  parseRootNamePath,
} from "../../src/host";
import { parseNames } from "../../src/names";
import { parseSettings } from "../../src/site";
import { type SiteState, checkDue } from "../../src/state";

const HEX = "7638ed03711612aabf27b1b3481c5f50cc9b20b28423603fa45a0029a5c76737";
const BODY = hexToLabelBody(HEX);

describe("name rules", () => {
  it("accepts lowercase letters, digits and single hyphens, 1 to 32 characters", () => {
    for (const name of ["a", "library", "start", "my-site", "site2", "9lives", "a".repeat(32), "a-b-c"]) {
      expect(isValidName(name), name).toBe(true);
    }
  });

  it("rejects uppercase, other characters, bad hyphens and long names", () => {
    for (const name of ["", "Library", "my_site", "my.site", "-a", "a-", "a--b", "xn--bcher-kva", "café", "a".repeat(33), "i" + BODY]) {
      expect(isValidName(name), name).toBe(false);
    }
  });

  it("reserves system names, the path-form words and anything starting autonomi", () => {
    for (const name of ["www", "admin", "antnet", "ant", "p", "i", "name", "autonomi", "autonomi-docs"]) {
      expect(isReservedName(name), name).toBe(true);
      expect(isUsableName(name), name).toBe(false);
    }
    expect(isUsableName("library")).toBe(true);
  });
});

describe("name hosts", () => {
  it("classifies a short name, and never mistakes a label for one", () => {
    expect(classifyHost("library.localhost")).toEqual({ view: "name", root: "localhost", name: "library", label: "library" });
    expect(classifyHost("start.loader.example", "loader.example")).toMatchObject({ view: "name", name: "start" });
    expect(classifyHost(`i${BODY}.localhost`).view).toBe("site");
    // Short labels that start with i or p are names, not broken address labels.
    expect(classifyHost("ipfs.localhost")).toMatchObject({ view: "name", name: "ipfs" });
  });

  it("refuses reserved and malformed names", () => {
    expect(classifyHost("www.localhost").view).toBe("bad-label");
    expect(classifyHost("autonomi.localhost").view).toBe("bad-label");
    expect(classifyHost("a--b.localhost").view).toBe("bad-label");
    expect(classifyHost("xn--bcher-kva.localhost").view).toBe("bad-label");
    expect(classifyHost(`${"a".repeat(33)}.localhost`).view).toBe("bad-label");
  });
});

describe("name links", () => {
  it("resolves portable name links, keeping path, query and fragment", () => {
    const url = new URL(`https://i${BODY}.loader.example/_autonomi/go/name/library/books/x/?q=1#top`);
    expect(goLinkTarget(url, "loader.example")).toBe("https://library.loader.example/books/x/?q=1#top");
    const dev = new URL("http://start.localhost:4173/_autonomi/go/name/library");
    expect(goLinkTarget(dev, "localhost")).toBe("http://library.localhost:4173/");
  });

  it("ignores name links to reserved or malformed names", () => {
    for (const name of ["www", "Library", "a--b", "autonomi"]) {
      expect(goLinkTarget(new URL(`https://x.loader.example/_autonomi/go/name/${name}/`), "loader.example")).toBeNull();
    }
  });

  it("still resolves address links, which come second", () => {
    const url = new URL(`https://library.loader.example/_autonomi/go/ant/${HEX}/a?b=1#c`);
    expect(goLinkTarget(url, "loader.example")).toBe(`https://i${BODY}.loader.example/a?b=1#c`);
  });

  it("reads root-domain name paths, but not the address path forms", () => {
    expect(parseRootNamePath("/library")).toEqual({ name: "library", rest: "/" });
    expect(parseRootNamePath("/library/books/")).toEqual({ name: "library", rest: "/books/" });
    expect(parseRootNamePath("/")).toBeNull();
    expect(parseRootNamePath(`/ant/${HEX}`)).toBeNull();
    expect(parseRootNamePath(`/p/ant/${HEX}`)).toBeNull();
    expect(parseRootNamePath("/favicon.ico")).toBeNull();
  });

  it("accepts a name, or a named site's URL on this loader, in the address box", () => {
    expect(parseAddressInput("library", "loader.example")).toEqual({ name: "library", rest: "/" });
    expect(parseAddressInput(" Library ", "loader.example")).toEqual({ name: "library", rest: "/" });
    expect(parseAddressInput("https://library.loader.example/books/", "loader.example")).toEqual({
      name: "library",
      rest: "/books/",
    });
    expect(parseAddressInput("www", "loader.example")).toHaveProperty("error");
    // A named site on some other loader isn't ours to resolve.
    expect(parseAddressInput("https://library.other.example/", "loader.example")).toHaveProperty("error");
  });
});

describe("the directory file", () => {
  it("keeps well-formed entries and drops the rest", () => {
    const dir = parseNames({
      v: 1,
      names: {
        start: { kind: "p", address: HEX, since: "2026-11-14" },
        library: { kind: "i", address: HEX },
        www: { kind: "i", address: HEX },
        Bad: { kind: "i", address: HEX },
        short: { kind: "i", address: "abc" },
        odd: { kind: "x", address: HEX },
        empty: null,
      },
    });
    expect([...dir.keys()]).toEqual(["start", "library"]);
    expect(dir.get("start")).toEqual({ kind: "p", address: HEX, since: "2026-11-14" });
    expect(dir.get("library")).toEqual({ kind: "i", address: HEX });
  });

  it("rejects a file that isn't a directory", () => {
    expect(() => parseNames(null)).toThrow();
    expect(() => parseNames({ names: [] })).toThrow();
    expect(() => parseNames({})).toThrow();
  });
});

describe("names in site settings and state", () => {
  const enc = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));

  it("reads the name a site gives itself, and notes an invalid one", () => {
    expect(parseSettings(enc({ name: "library" })).settings.name).toBe("library");
    const bad = parseSettings(enc({ name: "Not A Name" }));
    expect(bad.settings.name).toBeUndefined();
    expect(bad.ignored.join(" ")).toContain("name");
  });

  it("checks a named site even when its name points to a fixed address", () => {
    const base = { v: 1, archive: HEX, checkedAt: 0, settings: {} } as unknown as SiteState;
    const hour = 60 * 60 * 1000;
    expect(checkDue({ ...base, link: { kind: "i", address: HEX } }, hour)).toBe(false);
    expect(checkDue({ ...base, link: { kind: "i", address: HEX }, name: "library" }, hour)).toBe(true);
    expect(checkDue({ ...base, link: { kind: "p", address: HEX } }, hour)).toBe(true);
    expect(checkDue({ ...base, link: { kind: "i", address: HEX }, name: "library" }, hour - 1)).toBe(false);
  });
});
