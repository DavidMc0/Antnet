import { describe, expect, it } from "vitest";
import { deserialise, serialise } from "../../../sites/colonysim/src/save";
import {
  dayOf,
  foodLeft,
  H,
  index,
  larder,
  MAX_ANTS,
  MIN_ANTS,
  mood,
  newWorld,
  paintCircle,
  START_ANTS,
  step,
  STEPS_PER_DAY,
  W,
  type World,
} from "../../../sites/colonysim/src/sim";

const run = (world: World, steps: number) => {
  for (let i = 0; i < steps; i++) step(world);
  return world;
};

/** The share of open cells that some ant stands on during the next `steps` steps. */
function coverage(world: World, steps: number): number {
  const seen = new Uint8Array(W * H);
  const a = world.ants;
  for (let s = 0; s < steps; s++) {
    step(world);
    for (let i = 0; i < a.count; i++) seen[index(a.x[i], a.y[i])] = 1;
  }
  let open = 0;
  let hit = 0;
  for (let i = 0; i < W * H; i++) {
    if (world.wall[i]) continue;
    open++;
    hit += seen[i];
  }
  return hit / open;
}

// Some of these run the colony for many minutes of its own time.
describe("ColonySim", { timeout: 60_000 }, () => {
  it("starts with a nest, food, ants and something in the larder", () => {
    const w = newWorld(1);
    expect(w.ants.count).toBe(START_ANTS);
    expect(foodLeft(w)).toBeGreaterThan(0);
    expect(w.stored).toBeGreaterThan(0);
    expect(dayOf(w)).toBe(1);
  });

  it("is the same every time from the same seed", () => {
    const a = run(newWorld(42), 500);
    const b = run(newWorld(42), 500);
    expect(serialise(a)).toBe(serialise(b));
    expect(serialise(run(newWorld(43), 500))).not.toBe(serialise(a));
  });

  it("finds food and brings it home, and the colony grows", () => {
    const w = run(newWorld(7), 8000);
    expect(w.delivered).toBeGreaterThan(300);
    expect(w.ants.count).toBeGreaterThan(START_ANTS);
    expect(w.ants.count).toBeLessThanOrEqual(MAX_ANTS);
  });

  // The fault this guards against: scent never faded to nothing, and ants steered by whatever
  // was strongest, however faint. After a few minutes they circled the remains of old trails,
  // walked over a tenth of the tray and left food lying. It only showed in a long run.
  it.each([2, 4])("keeps exploring and finding food in a long run (seed %i)", (seed) => {
    const w = run(newWorld(seed), 30_000);
    expect(coverage(w, 3000)).toBeGreaterThan(0.4);
    // The food the colony started with is all found, long before this.
    expect(w.delivered).toBeGreaterThan(3000);
    // A pile dropped far from the nest is found and carried off.
    w.food.fill(0);
    paintCircle(w, W * 0.9, H * 0.85, 3, "food");
    const dropped = foodLeft(w);
    run(w, 12_000);
    expect(foodLeft(w)).toBeLessThan(dropped * 0.5);
  });

  it("lets scent fade to nothing", () => {
    const w = run(newWorld(1), 2000);
    // No ants, and nothing in the larder to hatch any from.
    w.ants.count = 0;
    w.stored = 0;
    run(w, 6000);
    expect(w.trail.some((v) => v !== 0)).toBe(false);
    expect(w.home.some((v) => v !== 0)).toBe(false);
  });

  it("sends ants home when they have searched for long enough", () => {
    const w = newWorld(5);
    w.food.fill(0);
    run(w, 12_000);
    // Nobody has been out for much longer than an ant's patience plus the walk home.
    const longest = Math.max(...w.ants.since.subarray(0, w.ants.count));
    expect(longest).toBeLessThan(6000);
  });

  it("gets food home round a long wall with one gap", () => {
    const w = newWorld(9);
    w.food.fill(0);
    for (let y = 4; y < H - 4; y++) if (y < H * 0.7 || y > H * 0.8) paintCircle(w, W * 0.45, y, 1.4, "wall");
    paintCircle(w, W * 0.8, H * 0.3, 5, "food");
    run(w, 9000);
    expect(w.delivered).toBeGreaterThan(200);
  });

  it("shrinks when it starves, but never dies out", () => {
    const w = newWorld(6);
    for (let s = 0; s < 40_000; s++) {
      if (s % 200 === 0) w.food.fill(0);
      step(w);
    }
    expect(mood(w)).toBe("starving");
    expect(w.ants.count).toBe(MIN_ANTS);
  });

  it("grows when it is fed, and shrinks again when the food stops", () => {
    const w = newWorld(8);
    const feed = (s: number) => paintCircle(w, 20 + ((s * 7) % (W - 40)), 20 + ((s * 13) % (H - 40)), 3, "food");
    for (let s = 0; s < 24_000; s++) {
      if (s % 900 === 0) feed(s);
      step(w);
    }
    const fed = w.ants.count;
    expect(fed).toBeGreaterThan(START_ANTS * 3);
    expect(larder(w)).toBeGreaterThan(0.3);
    // The food stops, and what is lying about is swept away.
    w.food.fill(0);
    run(w, 40_000);
    expect(w.ants.count).toBeLessThan(fed / 2);
  });

  it("holds only so much in the larder", () => {
    const w = newWorld(1);
    w.stored = 1e6;
    w.ants.carrying[0] = 1;
    w.ants.x[0] = w.nestX;
    w.ants.y[0] = w.nestY;
    step(w);
    expect(w.delivered).toBe(1);
    expect(w.stored).toBeLessThanOrEqual(1e6);
    expect(larder(w)).toBe(1);
  });

  it("never lets an ant stand in a wall, including one painted on top of it", () => {
    const w = newWorld(3);
    for (let s = 0; s < 3000; s++) {
      step(w);
      if (s === 1000) paintCircle(w, w.ants.x[5], w.ants.y[5], 6, "wall");
      if (s % 50 === 0) {
        for (let i = 0; i < w.ants.count; i++) expect(w.wall[index(w.ants.x[i], w.ants.y[i])]).toBe(0);
      }
    }
  });

  it("keeps the nest and the border clear when painting", () => {
    const w = newWorld(1);
    paintCircle(w, w.nestX, w.nestY, 8, "wall");
    expect(w.wall[index(w.nestX, w.nestY)]).toBe(0);
    paintCircle(w, 0, 0, 5, "erase");
    expect(w.wall[index(0, 0)]).toBe(1);
    expect(w.wall.length).toBe(W * H);
  });

  it("drops a few crumbs now and then once the food has run out", () => {
    const w = newWorld(5);
    w.food.fill(0);
    run(w, STEPS_PER_DAY / 3);
    expect(foodLeft(w)).toBeGreaterThan(0);
  });

  it("counts days", () => {
    const w = newWorld(1);
    w.step = STEPS_PER_DAY * 2 + 5;
    expect(dayOf(w)).toBe(3);
  });

  it("saves and loads, and carries on exactly as before apart from rounded scents", () => {
    const w = run(newWorld(9, 1_700_000_000_000), 1200);
    const back = deserialise(serialise(w))!;
    expect(back).not.toBeNull();
    expect(back.step).toBe(w.step);
    expect(back.founded).toBe(w.founded);
    expect(back.stored).toBe(w.stored);
    expect(back.appetite).toBe(w.appetite);
    expect(back.missed).toBe(w.missed);
    expect(back.ants.count).toBe(w.ants.count);
    expect(Array.from(back.ants.x.subarray(0, w.ants.count))).toEqual(Array.from(w.ants.x.subarray(0, w.ants.count)));
    expect(Array.from(back.food)).toEqual(Array.from(w.food));
    expect(Math.abs(back.trail[100] - w.trail[100])).toBeLessThanOrEqual(1 / 255);
    // Saving again gives the same text: loading loses nothing more.
    expect(serialise(back)).toBe(serialise(deserialise(serialise(back))!));
  });

  it("starts afresh from a missing, broken, older or foreign save", () => {
    expect(deserialise(null)).toBeNull();
    expect(deserialise("not json")).toBeNull();
    expect(deserialise(JSON.stringify({ format: 99 }))).toBeNull();
    const older = JSON.parse(serialise(newWorld(1)));
    older.format = 1;
    expect(deserialise(JSON.stringify(older))).toBeNull();
    const s = JSON.parse(serialise(newWorld(1)));
    s.ants.count = MAX_ANTS + 1;
    expect(deserialise(JSON.stringify(s))).toBeNull();
  });
});
