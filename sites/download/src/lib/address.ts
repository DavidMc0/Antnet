/** A public file's DataMap address: 64 lowercase hex characters. */
export const ADDRESS_RE = /^[0-9a-f]{64}$/;
const HEX_RUN_64 = /(?<![0-9a-f])[0-9a-f]{64}(?![0-9a-f])/;

export function isAddress(value: string): boolean {
  return ADDRESS_RE.test(value);
}

/**
 * Pull the first standalone 64-hex run out of pasted text: a bare address, one
 * prefixed with `0x`, one inside a link, or one broken up by spaces/newlines.
 */
export function extractAddress(input: string): string | null {
  const text = input.toLowerCase();
  const direct = text.match(HEX_RUN_64);
  if (direct) return direct[0];
  // Addresses copied across line breaks or grouped with spaces.
  const collapsed = text.replace(/\s+/g, "").replace(/^0x/, "");
  return collapsed.match(HEX_RUN_64)?.[0] ?? null;
}

/** Hex characters typed so far, for the live "n of 64" counter. */
export function hexCount(input: string): number {
  if (extractAddress(input)) return 64;
  const cleaned = input.toLowerCase().replace(/\s+/g, "").replace(/^0x/, "");
  return (cleaned.match(/[0-9a-f]/g) ?? []).length;
}
