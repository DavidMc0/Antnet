import { describe, expect, it } from "vitest";
// @ts-expect-error: a plain .mjs script without types
import { parseRemovalsText, removalsFile } from "../../../sites/removals.mjs";
import { isListed, parseRemovalList } from "../../../sites/download/src/lib/removals";

const A = "711c7e20006ff3e0ac6c1f3063286a0c1a3e4c409642e8c526173fa60bb7078a";
const B = "52af8a181c6171f8e12896ca734cdf60839c3b324dfbeadf857226dfc7cb453b";

describe("publishing the removal list (sites/removals.mjs)", () => {
  it("reads one address per line, with comments, 0x and duplicates", () => {
    expect(parseRemovalsText(`# removed\n0x${A.toUpperCase()}  # notice, 2026-11-12\n\n${A}\n${B}\n`)).toEqual([A, B]);
  });

  it("refuses a line that isn't an address", () => {
    expect(() => parseRemovalsText(`${A}\nnot an address\n`)).toThrow(/line 2/);
  });

  it("writes a file the page reads, which finds the listed addresses only", async () => {
    const file = removalsFile([A], "2026-11-12T00:00:00Z");
    expect(file).not.toContain(A);
    const list = parseRemovalList(new TextEncoder().encode(file));
    expect(await isListed(list, A)).toBe(true);
    expect(await isListed(list, B)).toBe(false);
  });
});
