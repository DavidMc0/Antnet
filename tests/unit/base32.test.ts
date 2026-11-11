import { describe, expect, it } from "vitest";
import {
  bytesToHex,
  decodeBase32Address,
  encodeBase32,
  hexToBytes,
  hexToLabelBody,
  labelBodyToHex,
} from "../../src/base32";

const HEX = "7638ed03711612aabf27b1b3481c5f50cc9b20b28423603fa45a0029a5c76737";

describe("base32", () => {
  it("matches RFC 4648 test vectors (lowercase, no padding)", () => {
    const enc = (s: string) => encodeBase32(new TextEncoder().encode(s));
    expect(enc("")).toBe("");
    expect(enc("f")).toBe("my");
    expect(enc("fo")).toBe("mzxq");
    expect(enc("foo")).toBe("mzxw6");
    expect(enc("foob")).toBe("mzxw6yq");
    expect(enc("fooba")).toBe("mzxw6ytb");
    expect(enc("foobar")).toBe("mzxw6ytboi");
  });

  it("encodes 32 bytes as 52 characters and round-trips", () => {
    const body = hexToLabelBody(HEX);
    expect(body).toHaveLength(52);
    expect(body).toMatch(/^[a-z2-7]+$/);
    expect(labelBodyToHex(body)).toBe(HEX);
  });

  it("round-trips the edge addresses", () => {
    for (const hex of ["00".repeat(32), "ff".repeat(32), "0123456789abcdef".repeat(4)]) {
      expect(labelBodyToHex(hexToLabelBody(hex))).toBe(hex);
    }
  });

  it("rejects non-canonical encodings", () => {
    const body = hexToLabelBody(HEX);
    expect(decodeBase32Address(body.toUpperCase())).toBeNull(); // uppercase
    expect(decodeBase32Address(body.slice(0, -1))).toBeNull(); // too short
    expect(decodeBase32Address(body + "a")).toBeNull(); // too long
    expect(decodeBase32Address(body.slice(0, -1) + "1")).toBeNull(); // not in alphabet
    // The last character carries 1 data bit and 4 unused bits; set an unused bit.
    const last = "abcdefghijklmnopqrstuvwxyz234567".indexOf(body[51]);
    const tampered = body.slice(0, 51) + "abcdefghijklmnopqrstuvwxyz234567"[last | 1];
    if (tampered !== body) expect(decodeBase32Address(tampered)).toBeNull();
  });

  it("converts hex and bytes", () => {
    expect(bytesToHex(hexToBytes(HEX))).toBe(HEX);
    expect(() => hexToBytes("xyz")).toThrow();
    expect(() => hexToBytes(HEX.toUpperCase())).toThrow();
  });
});
