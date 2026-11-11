// Canonical RFC 4648 base32, lowercase, no padding: 32 bytes <-> 52 characters (spec section 7).

const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

export const ADDRESS_BYTES = 32;
export const ADDRESS_HEX_LENGTH = 64;
export const ADDRESS_BASE32_LENGTH = 52;

const HEX_RE = /^[0-9a-f]{64}$/;

export function isAddressHex(value: string): boolean {
  return HEX_RE.test(value);
}

export function hexToBytes(hex: string): Uint8Array {
  if (!isAddressHex(hex)) throw new Error("Expected 64 lowercase hex characters");
  const out = new Uint8Array(ADDRESS_BYTES);
  for (let i = 0; i < ADDRESS_BYTES; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

export function encodeBase32(bytes: Uint8Array): string {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const b of bytes) {
    buffer = (buffer << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
}

/**
 * Decode a 52-character label body to 32 bytes. Returns null unless the input is the
 * canonical encoding: lowercase alphabet only, exact length, unused trailing bits zero.
 */
export function decodeBase32Address(text: string): Uint8Array | null {
  if (text.length !== ADDRESS_BASE32_LENGTH) return null;
  const out = new Uint8Array(ADDRESS_BYTES);
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (const ch of text) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    buffer = (buffer << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out[o++] = (buffer >>> (bits - 8)) & 0xff;
      bits -= 8;
      buffer &= (1 << bits) - 1;
    }
  }
  // 52 * 5 = 260 bits = 256 + 4 unused bits, which must be zero.
  if (o !== ADDRESS_BYTES || buffer !== 0) return null;
  return out;
}

export function hexToLabelBody(hex: string): string {
  return encodeBase32(hexToBytes(hex));
}

export function labelBodyToHex(body: string): string | null {
  const bytes = decodeBase32Address(body);
  return bytes ? bytesToHex(bytes) : null;
}
