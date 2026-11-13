import { describe, expect, it } from "vitest";
import { deserialise, serialise } from "../../../sites/colonysim/src/save";
import { dayOf, foodLeft, H, index, MAX_ANTS, newWorld, paintCircle, START_ANTS, step, STEPS_PER_DAY, W } from "../../../sites/colonysim/src/sim";

const run = (world: ReturnType<typeof newWorld>, steps: number) => {
  for (let i = 0; i < steps; i++) step(world);
  return world;
};

describe("ColonySim", () => {
  it("starts with a nest, food and ants", () => {
    const w = newWorld(1);
    expect(w.ants.count).toBe(START_ANTS);
    expect(foodLeft(w)).toBeGreaterThan(0);
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
    expect(w.delivered).toBeGreaterThan(30);
    expect(w.ants.count).toBeGreaterThan(START_ANTS);
    expect(w.ants.count).toBeLessThanOrEqual(MAX_ANTS);
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

  it("drops a small pile of food now and then once the colony has run out", () => {
    const w = newWorld(5);
    w.food.fill(0);
    run(w, STEPS_PER_DAY / 6);
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
    expect(back.ants.count).toBe(w.ants.count);
    expect(Array.from(back.ants.x.subarray(0, w.ants.count))).toEqual(Array.from(w.ants.x.subarray(0, w.ants.count)));
    expect(Array.from(back.food)).toEqual(Array.from(w.food));
    expect(Math.abs(back.trail[100] - w.trail[100])).toBeLessThanOrEqual(1 / 255);
    // Saving again gives the same text: loading loses nothing more.
    expect(serialise(back)).toBe(serialise(deserialise(serialise(back))!));
  });

  it("starts afresh from a missing, broken or foreign save", () => {
    expect(deserialise(null)).toBeNull();
    expect(deserialise("not json")).toBeNull();
    expect(deserialise(JSON.stringify({ format: 2 }))).toBeNull();
    const s = JSON.parse(serialise(newWorld(1)));
    s.ants.count = MAX_ANTS + 1;
    expect(deserialise(JSON.stringify(s))).toBeNull();
  });
});
