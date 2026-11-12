import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { addressHash, isListed, parseRemovalList } from "../../../sites/download/src/lib/removals";

const A = "711c7e20006ff3e0ac6c1f3063286a0c1a3e4c409642e8c526173fa60bb7078a";
const B = "52af8a181c6171f8e12896ca734cdf60839c3b324dfbeadf857226dfc7cb453b";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const file = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));

describe("removal list", () => {
  it("hashes an address as its lowercase hex text, as sites/removals.mjs does", async () => {
    expect(await addressHash(A)).toBe(sha(A));
    expect(await addressHash(A.toUpperCase())).toBe(sha(A));
  });

  it("finds a listed address and only that one", async () => {
    const list = parseRemovalList(file({ v: 1, updated: "2026-11-12T00:00:00Z", sha256: [sha(A)] }));
    expect(list.updated).toBe("2026-11-12T00:00:00Z");
    expect(await isListed(list, A)).toBe(true);
    expect(await isListed(list, B)).toBe(false);
  });

  it("ignores entries that aren't hashes", async () => {
    const list = parseRemovalList(file({ v: 1, sha256: [A.slice(2), 42, sha(B).toUpperCase(), sha(B)] }));
    expect(list.hashes.size).toBe(1);
    expect(await isListed(list, B)).toBe(true);
  });

  it.each([{}, { v: 2, sha256: [] }, { v: 1, sha256: "x" }])("refuses %j as a list", (v) => {
    expect(() => parseRemovalList(file(v))).toThrow();
  });
});
