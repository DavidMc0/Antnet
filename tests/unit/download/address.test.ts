import { describe, expect, it } from "vitest";
import { extractAddress, hexCount, isAddress } from "../../../sites/download/src/lib/address";

const A = "711c7e20006ff3e0ac6c1f3063286a0c1a3e4c409642e8c526173fa60bb7078a";

describe("extractAddress", () => {
  it.each([
    ["bare", A],
    ["surrounding whitespace", `  ${A}\n`],
    ["0x prefix", `0x${A}`],
    ["upper case", A.toUpperCase()],
    ["inside a link", `https://example.com/d/?a=${A}&n=x.zip`],
    ["inside a sentence", `the address is ${A}, enjoy`],
    ["split by spaces", `${A.slice(0, 32)} ${A.slice(32)}`],
    ["split across lines", `${A.slice(0, 20)}\n${A.slice(20, 44)}\n${A.slice(44)}`],
    ["0x prefix with spaces", `0x ${A.slice(0, 32)} ${A.slice(32)}`],
  ])("accepts %s", (_, input) => {
    expect(extractAddress(input)).toBe(A);
  });

  it.each([
    ["empty", ""],
    ["63 chars", A.slice(1)],
    ["65 chars", A + "a"],
    ["66 chars", A + "ab"],
    ["non-hex", A.slice(0, 63) + "g"],
  ])("rejects %s", (_, input) => {
    expect(extractAddress(input)).toBeNull();
  });

  it("takes the first of two addresses", () => {
    const B = "f".repeat(64);
    expect(extractAddress(`${A} ${B}`)).toBe(A);
  });
});

describe("hexCount", () => {
  it("counts partial input", () => {
    expect(hexCount("")).toBe(0);
    expect(hexCount("0x" + A.slice(0, 10))).toBe(10);
    expect(hexCount(A.slice(0, 20) + " " + A.slice(20, 30))).toBe(30);
  });
  it("is 64 once an address is found", () => {
    expect(hexCount(`see https://x.test/?a=${A}`)).toBe(64);
  });
});

describe("isAddress", () => {
  it("validates strictly", () => {
    expect(isAddress(A)).toBe(true);
    expect(isAddress(A.toUpperCase())).toBe(false);
    expect(isAddress(` ${A}`)).toBe(false);
  });
});
