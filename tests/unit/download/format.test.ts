import { describe, expect, it } from "vitest";
import { formatAnt, formatBytes, formatExactBytes } from "../../../sites/download/src/lib/format";

describe("formatBytes", () => {
  it.each([
    [0, "0 bytes"],
    [1, "1 byte"],
    [574, "574 bytes"],
    [999, "999 bytes"],
    [1000, "1 KB"],
    [138_931, "138.9 KB"],
    [312_400_000, "312.4 MB"],
    [999_960, "1 MB"],
    [1_000_000_000, "1 GB"],
    [3_200_000_000, "3.2 GB"],
  ])("%d → %s", (n, s) => expect(formatBytes(n)).toBe(s));

  it.each([
    [312_400_000, "312 MB"],
    [11_572_127, "12 MB"],
    [3_249_000_000, "3.2 GB"],
    [574, "574 bytes"],
  ])("compact %d → %s", (n, s) => expect(formatBytes(n, { compact: true })).toBe(s));

  it("ignores invalid input", () => {
    expect(formatBytes(-1)).toBe("");
    expect(formatBytes(NaN)).toBe("");
  });

  it("formats exact bytes", () => {
    expect(formatExactBytes(67_108_864)).toBe("67,108,864 bytes");
  });
});

describe("formatAnt", () => {
  it.each([
    ["0", "0 ANT"],
    ["1250000000000000000", "1.25 ANT"],
    ["1000000000000000000", "1 ANT"],
    ["12345600000000000000000", "12,345.6 ANT"],
    ["4200000000000000", "0.0042 ANT"],
    ["4210000000000000", "0.0043 ANT"],
    ["1234567890000", "0.0000013 ANT"],
    ["999999000000000000", "1 ANT"],
    ["1", "0.000000000000000001 ANT"],
  ])("%s atto → %s", (atto, text) => {
    expect(formatAnt(atto)).toBe(text);
  });

  it("takes bigints", () => {
    expect(formatAnt(5n * 10n ** 17n)).toBe("0.5 ANT");
  });
});
