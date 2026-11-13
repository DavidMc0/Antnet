// Saving the colony in the browser (DEMO.md 3.3: "the colony saves itself as it runs"). It goes
// in localStorage, which belongs to this site's own origin, so it stays with this site's address
// and no other site can read it. Scents are rounded to 1/255, which can't be seen.

import { emptyAnts, H, MAX_ANTS, W, type World } from "./sim";

export const SAVE_KEY = "colonysim:v1";
const FORMAT = 1;

interface Saved {
  format: number;
  w: number;
  h: number;
  seed: number;
  step: number;
  founded: number;
  nestX: number;
  nestY: number;
  stored: number;
  delivered: number;
  wall: string;
  food: string;
  home: string;
  trail: string;
  ants: { count: number; x: string; y: string; angle: string; carrying: string; since: string };
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(text: string): Uint8Array {
  const s = atob(text);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

const bytesOf = (view: ArrayBufferView) => new Uint8Array(view.buffer, view.byteOffset, view.byteLength);

function quantise(field: Float32Array): Uint8Array {
  const out = new Uint8Array(field.length);
  for (let i = 0; i < field.length; i++) out[i] = Math.round(Math.min(1, field[i]) * 255);
  return out;
}

function unquantise(bytes: Uint8Array): Float32Array {
  const out = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] / 255;
  return out;
}

export function serialise(world: World): string {
  const a = world.ants;
  const n = a.count;
  const saved: Saved = {
    format: FORMAT,
    w: W,
    h: H,
    seed: world.seed,
    step: world.step,
    founded: world.founded,
    nestX: world.nestX,
    nestY: world.nestY,
    stored: world.stored,
    delivered: world.delivered,
    wall: toBase64(world.wall),
    food: toBase64(world.food),
    home: toBase64(quantise(world.home)),
    trail: toBase64(quantise(world.trail)),
    ants: {
      count: n,
      x: toBase64(bytesOf(a.x.subarray(0, n))),
      y: toBase64(bytesOf(a.y.subarray(0, n))),
      angle: toBase64(bytesOf(a.angle.subarray(0, n))),
      carrying: toBase64(a.carrying.subarray(0, n)),
      since: toBase64(bytesOf(a.since.subarray(0, n))),
    },
  };
  return JSON.stringify(saved);
}

/** The saved colony, or null if there is none or it can't be read (then a new one starts). */
export function deserialise(text: string | null): World | null {
  if (!text) return null;
  try {
    const s = JSON.parse(text) as Saved;
    if (s.format !== FORMAT || s.w !== W || s.h !== H) return null;
    const cells = W * H;
    const wall = fromBase64(s.wall);
    const food = fromBase64(s.food);
    const home = unquantise(fromBase64(s.home));
    const trail = unquantise(fromBase64(s.trail));
    if (wall.length !== cells || food.length !== cells || home.length !== cells || trail.length !== cells) return null;

    const n = s.ants.count;
    if (!Number.isInteger(n) || n < 0 || n > MAX_ANTS) return null;
    const ants = emptyAnts();
    ants.count = n;
    const f32 = (t: string) => new Float32Array(fromBase64(t).slice().buffer);
    const x = f32(s.ants.x);
    const y = f32(s.ants.y);
    const angle = f32(s.ants.angle);
    const carrying = fromBase64(s.ants.carrying);
    const since = new Uint16Array(fromBase64(s.ants.since).slice().buffer);
    if (x.length !== n || y.length !== n || angle.length !== n || carrying.length !== n || since.length !== n) return null;
    ants.x.set(x);
    ants.y.set(y);
    ants.angle.set(angle);
    ants.carrying.set(carrying);
    ants.since.set(since);

    return {
      seed: s.seed | 0,
      step: s.step,
      founded: s.founded,
      nestX: s.nestX,
      nestY: s.nestY,
      stored: s.stored,
      delivered: s.delivered,
      wall,
      food,
      home,
      trail,
      ants,
    };
  } catch {
    return null;
  }
}

/** localStorage can be missing or full (private windows, blocked storage); the colony still runs. */
export function load(): World | null {
  try {
    return deserialise(localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

export function save(world: World): boolean {
  try {
    localStorage.setItem(SAVE_KEY, serialise(world));
    return true;
  } catch {
    return false;
  }
}

export function forget(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to remove.
  }
}
