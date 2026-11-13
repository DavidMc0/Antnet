// The colony (DEMO.md 3.3): ants on a grid that forage and lay two scents. Searching ants lay
// "home" scent, which leads back to the nest; ants carrying food lay "food" scent, which leads
// back to the food. Each kind of ant follows the other kind's scent, so trails form between the
// nest and whatever food the visitor drops, and re-form around walls.
//
// Pure and seeded: the same world and the same number of steps give the same result. No DOM.

export const W = 192;
export const H = 120;
export const MAX_ANTS = 420;
export const START_ANTS = 70;
/** Food the nest spends on each new ant. */
export const ANT_COST = 20;
/** Steps in a colony day. At normal speed (two steps a frame) a day is about two minutes. */
export const STEPS_PER_DAY = 14_400;
/** Ants this close to the nest's centre are home. */
export const NEST_RADIUS = 3.2;
export const MAX_FOOD = 255;
/** Food a brush stroke adds to each cell it covers. */
export const FOOD_PER_PAINT = 20;
/** A small pile turns up every so often when food runs low, so an idle colony keeps foraging. */
const WINDFALL_EVERY = STEPS_PER_DAY / 6;
const WINDFALL_BELOW = 400;

const SPEED = 0.55;
const SENSE_DIST = 3.2;
const SENSE_ANGLE = 0.55;
const TURN = 0.35;
const WANDER = 0.22;
/** How fast a trail's strength falls off with the steps an ant has walked since its last event. */
const LAY_FALLOFF = 260;
const FADE_FOOD = 0.9965;
const FADE_HOME = 0.998;

export interface World {
  /** Seeded random state (mulberry32). */
  seed: number;
  step: number;
  /** When the colony was founded (ms since 1970); only shown, never used by the simulation. */
  founded: number;
  nestX: number;
  nestY: number;
  /** In the nest, not yet spent on new ants. */
  stored: number;
  /** Food brought home, all time. */
  delivered: number;
  wall: Uint8Array;
  food: Uint8Array;
  /** Scent leading to the nest, 0..1. */
  home: Float32Array;
  /** Scent leading to food, 0..1. */
  trail: Float32Array;
  ants: Ants;
}

export interface Ants {
  count: number;
  x: Float32Array;
  y: Float32Array;
  angle: Float32Array;
  carrying: Uint8Array;
  /** Steps since the ant last left the nest or picked food up. */
  since: Uint16Array;
}

export function emptyAnts(): Ants {
  return {
    count: 0,
    x: new Float32Array(MAX_ANTS),
    y: new Float32Array(MAX_ANTS),
    angle: new Float32Array(MAX_ANTS),
    carrying: new Uint8Array(MAX_ANTS),
    since: new Uint16Array(MAX_ANTS),
  };
}

/** mulberry32: a small, fast, seedable generator. Returns [0, 1). */
export function random(world: World): number {
  let t = (world.seed = (world.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const index = (x: number, y: number) => (y | 0) * W + (x | 0);
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

/** A new colony: the nest left of centre, a few piles of food and a couple of walls in the way. */
export function newWorld(seed: number, founded = 0): World {
  const world: World = {
    seed: seed | 0,
    step: 0,
    founded,
    nestX: Math.round(W * 0.28),
    nestY: Math.round(H * 0.52),
    stored: 0,
    delivered: 0,
    wall: new Uint8Array(W * H),
    food: new Uint8Array(W * H),
    home: new Float32Array(W * H),
    trail: new Float32Array(W * H),
    ants: emptyAnts(),
  };
  // A border, so ants turn at the edges rather than vanish.
  for (let x = 0; x < W; x++) world.wall[index(x, 0)] = world.wall[index(x, H - 1)] = 1;
  for (let y = 0; y < H; y++) world.wall[index(0, y)] = world.wall[index(W - 1, y)] = 1;

  // Two walls between the nest and the food, so the first trails have to bend.
  paintLine(world, W * 0.5, H * 0.18, W * 0.56, H * 0.48, 1.4, "wall");
  paintLine(world, W * 0.62, H * 0.62, W * 0.55, H * 0.9, 1.4, "wall");

  // Three piles, away from the nest.
  const piles = [
    [0.8, 0.25],
    [0.82, 0.72],
    [0.5 + random(world) * 0.08, 0.12 + random(world) * 0.06],
  ];
  for (const [px, py] of piles) paintCircle(world, px * W, py * H, 4.5, "food");

  for (let i = 0; i < START_ANTS; i++) addAnt(world);
  return world;
}

function addAnt(world: World): void {
  const a = world.ants;
  if (a.count >= MAX_ANTS) return;
  const i = a.count++;
  const angle = random(world) * Math.PI * 2;
  a.x[i] = world.nestX + Math.cos(angle) * 1.5;
  a.y[i] = world.nestY + Math.sin(angle) * 1.5;
  a.angle[i] = angle;
  a.carrying[i] = 0;
  a.since[i] = 0;
}

export type Brush = "food" | "wall" | "erase";

/** Paint a disc of food, wall or nothing. Never paints over the nest or the border. */
export function paintCircle(world: World, cx: number, cy: number, r: number, brush: Brush): void {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy > r2) continue;
      if (Math.hypot(x + 0.5 - world.nestX, y + 0.5 - world.nestY) < NEST_RADIUS + 2.5) continue;
      const i = index(x, y);
      if (brush === "wall") {
        world.wall[i] = 1;
        world.food[i] = 0;
        world.home[i] = world.trail[i] = 0;
      } else if (brush === "food") {
        if (!world.wall[i]) world.food[i] = Math.min(MAX_FOOD, world.food[i] + FOOD_PER_PAINT);
      } else {
        world.wall[i] = 0;
        world.food[i] = 0;
      }
    }
  }
  if (brush === "wall") freeTrappedAnts(world);
}

/** Paint along a line, as a dragged pointer does. */
export function paintLine(world: World, x0: number, y0: number, x1: number, y1: number, r: number, brush: Brush): void {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(0.5, r * 0.5)));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    paintCircle(world, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, brush);
  }
}

/** Ants under a new wall go home, rather than being stuck inside it. */
function freeTrappedAnts(world: World): void {
  const a = world.ants;
  for (let i = 0; i < a.count; i++) {
    if (!world.wall[index(a.x[i], a.y[i])]) continue;
    a.x[i] = world.nestX;
    a.y[i] = world.nestY;
    a.carrying[i] = 0;
    a.since[i] = 0;
  }
}

/** What an ant smells at a point: food (or the nest) itself counts as the strongest scent. */
function smell(world: World, x: number, y: number, carrying: boolean): number {
  if (!inside(x, y)) return -1;
  const i = index(x, y);
  if (world.wall[i]) return -1;
  if (carrying) {
    return Math.hypot(x - world.nestX, y - world.nestY) < NEST_RADIUS + 1 ? 10 : world.home[i];
  }
  return world.food[i] ? 10 : world.trail[i];
}

/** One step of the whole colony. */
export function step(world: World): void {
  const a = world.ants;
  for (let i = 0; i < a.count; i++) moveAnt(world, i);

  const n = W * H;
  for (let i = 0; i < n; i++) {
    world.trail[i] *= FADE_FOOD;
    world.home[i] *= FADE_HOME;
  }

  if (world.step % WINDFALL_EVERY === WINDFALL_EVERY - 1 && foodLeft(world) < WINDFALL_BELOW) windfall(world);

  while (world.stored >= ANT_COST && a.count < MAX_ANTS) {
    world.stored -= ANT_COST;
    addAnt(world);
  }
  world.step++;
}

/** A small pile somewhere open, not too close to the nest. */
function windfall(world: World): void {
  for (let tries = 0; tries < 40; tries++) {
    const x = 8 + random(world) * (W - 16);
    const y = 8 + random(world) * (H - 16);
    if (Math.hypot(x - world.nestX, y - world.nestY) < 40 || world.wall[index(x, y)]) continue;
    paintCircle(world, x, y, 3, "food");
    paintCircle(world, x, y, 2, "food");
    return;
  }
}

function moveAnt(world: World, i: number): void {
  const a = world.ants;
  const carrying = a.carrying[i] === 1;
  let angle = a.angle[i];
  const x = a.x[i];
  const y = a.y[i];

  // Close to home with food: walk straight in.
  const toNest = Math.hypot(world.nestX - x, world.nestY - y);
  if (carrying && toNest < 10) {
    angle = Math.atan2(world.nestY - y, world.nestX - x);
  } else {
    const ahead = smell(world, x + Math.cos(angle) * SENSE_DIST, y + Math.sin(angle) * SENSE_DIST, carrying);
    const left = smell(world, x + Math.cos(angle - SENSE_ANGLE) * SENSE_DIST, y + Math.sin(angle - SENSE_ANGLE) * SENSE_DIST, carrying);
    const right = smell(world, x + Math.cos(angle + SENSE_ANGLE) * SENSE_DIST, y + Math.sin(angle + SENSE_ANGLE) * SENSE_DIST, carrying);
    if (left > ahead && left > right) angle -= TURN;
    else if (right > ahead && right > left) angle += TURN;
    else if (ahead < 0) angle += (random(world) < 0.5 ? -1 : 1) * TURN * 2;
    angle += (random(world) - 0.5) * 2 * WANDER;
  }

  const nx = x + Math.cos(angle) * SPEED;
  const ny = y + Math.sin(angle) * SPEED;
  if (!inside(nx, ny) || world.wall[index(nx, ny)]) {
    // Blocked: turn away by a random amount and try again next step.
    angle += Math.PI * (0.5 + random(world));
  } else {
    a.x[i] = nx;
    a.y[i] = ny;
  }
  a.angle[i] = angle;

  // Lay scent where the ant is, strongest close to where it set out from.
  const cell = index(a.x[i], a.y[i]);
  const since = a.since[i];
  const strength = Math.exp(-since / LAY_FALLOFF);
  if (carrying) {
    if (world.trail[cell] < strength) world.trail[cell] = strength;
  } else if (world.home[cell] < strength) {
    world.home[cell] = strength;
  }
  if (since < 65535) a.since[i] = since + 1;

  // Events: pick food up, or bring it home.
  if (!carrying && world.food[cell]) {
    world.food[cell]--;
    a.carrying[i] = 1;
    a.since[i] = 0;
    a.angle[i] = angle + Math.PI;
  } else if (carrying && Math.hypot(a.x[i] - world.nestX, a.y[i] - world.nestY) < NEST_RADIUS) {
    a.carrying[i] = 0;
    a.since[i] = 0;
    a.angle[i] = angle + Math.PI;
    world.stored++;
    world.delivered++;
  }
}

/** Day 1 is the colony's first day. */
export const dayOf = (world: World) => 1 + Math.floor(world.step / STEPS_PER_DAY);

/** Food still lying about. */
export function foodLeft(world: World): number {
  let total = 0;
  for (let i = 0; i < world.food.length; i++) total += world.food[i];
  return total;
}
