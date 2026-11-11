import { describe, expect, it } from "vitest";
import { TarError, normaliseEntryPath, readTar } from "../../src/tar";
import { type TarEntry, concat, header, writeTar } from "../../tools/tar-writer.mjs";

const enc = new TextEncoder();
const dec = new TextDecoder();
const file = (path: string, text = path): TarEntry => ({ path, bytes: enc.encode(text) });
const END = new Uint8Array(1024);

describe("readTar", () => {
  it("reads regular files and skips directory entries", () => {
    const tar = writeTar([file("index.html", "<h1>hi</h1>"), { path: "docs", type: "5" }, file("docs/a.html")]);
    const files = readTar(tar);
    expect(files.map((f) => f.path)).toEqual(["index.html", "docs/a.html"]);
    expect(dec.decode(files[0].bytes)).toBe("<h1>hi</h1>");
  });

  it("strips a leading ./ and accepts the root directory entry", () => {
    const tar = writeTar([{ path: "./", type: "5" }, file("./index.html")]);
    expect(readTar(tar).map((f) => f.path)).toEqual(["index.html"]);
  });

  it("handles long paths via the prefix field and pax headers", () => {
    const viaPrefix = "a/".repeat(60) + "index.html";
    const viaPax = "b".repeat(300) + ".html";
    const files = readTar(writeTar([file(viaPrefix), file(viaPax), file("index.html")]));
    expect(files.map((f) => f.path)).toEqual([viaPrefix, viaPax, "index.html"]);
  });

  it("handles empty files and sizes that are exact block multiples", () => {
    const files = readTar(writeTar([file("empty.txt", ""), file("block.bin", "x".repeat(512)), file("index.html")]));
    expect(files.map((f) => f.bytes.length)).toEqual([0, 512, 10]);
  });

  it("ignores harmless pax keys (such as the pack nonce) but rejects unknown ones", () => {
    const ok = writeTar([{ ...file("index.html"), pax: { comment: "autonomi-nonce=1", mtime: "0" } }]);
    expect(readTar(ok)).toHaveLength(1);
    const bad = writeTar([{ ...file("index.html"), pax: { "SCHILY.xattr.user.x": "1" } }]);
    expect(() => readTar(bad)).toThrow(/Unsupported extended header key/);
  });

  const rejects: [string, TarEntry[], RegExp][] = [
    ["..", [file("index.html"), file("../evil.html")], /\.\./],
    ["a nested ..", [file("index.html"), file("a/../../evil.html")], /\.\./],
    ["an absolute path", [file("index.html"), file("/etc/passwd")], /Absolute path/],
    ["a backslash", [file("index.html"), file("a\\b.html")], /backslash/],
    ["a symlink", [file("index.html"), { path: "l", type: "2", linkname: "/etc/passwd" }], /Symbolic link/],
    ["a hard link", [file("index.html"), { path: "l", type: "1", linkname: "index.html" }], /Hard link/],
    ["a device", [file("index.html"), { path: "d", type: "3" }], /Device/],
    ["a FIFO", [file("index.html"), { path: "f", type: "6" }], /FIFO/],
    ["a GNU long name", [file("index.html"), { path: "././@LongLink", type: "L" }], /Unsupported entry type/],
    ["a pax global header", [file("index.html"), { path: "g", type: "g" }], /Unsupported entry type/],
    ["a duplicate", [file("index.html"), file("index.html")], /Duplicate/],
    ["a duplicate after ./", [file("index.html"), file("./index.html")], /Duplicate/],
    ["a file used as a directory", [file("index.html"), file("a"), file("a/b")], /File used as a directory/],
    ["an empty segment", [file("index.html"), file("a//b")], /empty/],
  ];
  for (const [what, entries, message] of rejects) {
    it(`rejects ${what}`, () => {
      expect(() => readTar(writeTar(entries))).toThrow(TarError);
      expect(() => readTar(writeTar(entries))).toThrow(message);
    });
  }

  it("rejects data that isn't a ustar archive", () => {
    expect(() => readTar(new Uint8Array(4096).fill(7))).toThrow(/no ustar header/);
    expect(() => readTar(new Uint8Array(10))).toThrow(TarError);
    const noMagic = concat([header({ name: "index.html", magic: "nope\0\0" }), END]);
    expect(() => readTar(noMagic)).toThrow(TarError);
  });

  it("rejects a bad checksum", () => {
    const tar = writeTar([file("index.html")]);
    tar[0] = "j".charCodeAt(0);
    expect(() => readTar(tar)).toThrow(/checksum/);
  });

  it("rejects an entry that runs past the end", () => {
    const tar = concat([header({ name: "index.html", size: 100_000 }), new Uint8Array(512)]);
    expect(() => readTar(tar)).toThrow(/past end/);
  });

  it("caps the entry count", () => {
    const tar = writeTar(Array.from({ length: 6 }, (_, i) => file(`f${i}`)));
    expect(() => readTar(tar, { maxEntries: 5 })).toThrow(/More than 5 entries/);
    expect(readTar(tar, { maxEntries: 6 })).toHaveLength(6);
  });
});

describe("normaliseEntryPath", () => {
  it("normalises directories and rejects empty file paths", () => {
    expect(normaliseEntryPath("./a/b/", true)).toBe("a/b");
    expect(normaliseEntryPath(".", true)).toBe("");
    expect(() => normaliseEntryPath("./", false)).toThrow(TarError);
    expect(() => normaliseEntryPath("a/./b", false)).toThrow(TarError);
  });
});
