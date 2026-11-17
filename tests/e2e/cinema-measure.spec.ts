// Measures Cinema's streaming from Autonomi mainnet, with and without read-ahead (PROGRESS.md,
// "Cinema read-ahead"). Opt in with CINEMA_MEASURE=1; each mode plays for PLAY_S seconds of
// wall-clock time, then seeks to the middle. CINEMA_MODES picks the modes, as
// "name=ahead,parallel;..." (sessionStorage cinemaReadAhead; "0,1" is one block at a time).
// Results print as one JSON line per mode.

import { expect, test } from "@playwright/test";
import { nameUrl } from "./helpers";

const PLAY_S = Number(process.env.CINEMA_PLAY_S ?? 90);
const MODES = (process.env.CINEMA_MODES ?? "serial=0,1;readahead=default")
  .split(";")
  .map((m) => m.split("="))
  .map(([name, value]) => ({ name, value }));

for (const mode of MODES) {
  test(`measure Cinema streaming: ${mode.name}`, async ({ page }) => {
    test.skip(!process.env.CINEMA_MEASURE, "set CINEMA_MEASURE=1 to measure streaming from Autonomi mainnet");
    test.setTimeout((PLAY_S + 240) * 1000);
    if (mode.value !== "default") {
      await page.addInitScript((v) => sessionStorage.setItem("cinemaReadAhead", v), mode.value);
    }
    // Count stalls from the page: time between "waiting" and the next "playing".
    await page.addInitScript(() => {
      const w = window as unknown as { stalls: number[]; stallStart: number };
      w.stalls = [];
      w.stallStart = 0;
      document.addEventListener(
        "waiting",
        () => {
          if (!w.stallStart) w.stallStart = performance.now();
        },
        true,
      );
      document.addEventListener(
        "playing",
        () => {
          if (w.stallStart) w.stalls.push(performance.now() - w.stallStart);
          w.stallStart = 0;
        },
        true,
      );
    });
    const t0 = Date.now();
    await page.goto(nameUrl("cinema"));
    const player = page.locator("[data-player]");
    await expect(player).toHaveAttribute("data-state", "ready", { timeout: 120_000 });
    const readyS = (Date.now() - t0) / 1000;
    await page.locator("[data-play]").click();
    await expect(player).toHaveAttribute("data-state", "playing", { timeout: 60_000 });
    const visit = await page.locator("[data-visit]").textContent();
    // The first "playing" ends the start-up wait, not a stall.
    await page.evaluate(() => ((window as unknown as { stalls: number[] }).stalls = []));

    const ahead: number[] = [];
    for (let s = 0; s < PLAY_S; s += 5) {
      await page.waitForTimeout(5000);
      ahead.push(Number(await player.getAttribute("data-ahead-seconds")));
    }
    const played = await page.evaluate(() => document.querySelector("video")!.currentTime);
    const stalls = await page.evaluate(() => {
      const w = window as unknown as { stalls: number[]; stallStart: number };
      return w.stallStart ? [...w.stalls, performance.now() - w.stallStart] : w.stalls;
    });
    const streamedMB = Number(await player.getAttribute("data-streamed-bytes")) / 1e6;

    // Seek to the middle; time until the video plays on from there.
    const seekT = Date.now();
    await page.evaluate(() => {
      const v = document.querySelector("video")!;
      v.currentTime = v.duration / 2;
    });
    let seekS: number | null = null;
    try {
      await expect
        .poll(() => page.evaluate(() => { const v = document.querySelector("video")!; return v.currentTime - v.duration / 2; }), { timeout: 90_000, intervals: [250] })
        .toBeGreaterThan(0.5);
      seekS = (Date.now() - seekT) / 1000;
    } catch {
      // Recorded as null: the seek took over 90 s.
    }

    console.log(
      JSON.stringify({
        mode: mode.name,
        readyS,
        visit,
        wallS: PLAY_S,
        playedS: Math.round(played * 10) / 10,
        stallCount: stalls.length,
        stallS: Math.round(stalls.reduce((a, b) => a + b, 0) / 100) / 10,
        longestStallS: Math.round(Math.max(0, ...stalls) / 100) / 10,
        streamedMB: Math.round(streamedMB),
        aheadS: ahead,
        seekS,
      }),
    );
  });
}

// Switching between the 1080p and 720p copies (src/player.js, "Quality"). Plays at full speed,
// then caps the bandwidth (sessionStorage cinemaThrottle, CINEMA_THROTTLE Mbit/s, default 2)
// until the player drops to 720p, and lifts the cap until it goes back to 1080p. Checks the
// film carries on from where it was. CINEMA_LIFT=1 lifts the cap as soon as it drops, for a
// stand-in "720p" copy that is really the 1080p file, which the cap can't feed.
test("Cinema drops to 720p when the network can't keep up, and goes back", async ({ page }) => {
  test.skip(!process.env.CINEMA_MEASURE, "set CINEMA_MEASURE=1 to measure streaming from Autonomi mainnet");
  test.setTimeout(600_000);
  page.on("console", (m) => {
    if (m.text().startsWith("[cinema]") && !/ (asks|block) /.test(m.text())) console.log(m.text());
  });
  // Stalls while playing: each "waiting" until the next "playing", in seconds of wall time.
  await page.addInitScript(() => {
    const w = window as unknown as { stalls: [number, number][]; since: number };
    w.stalls = [];
    w.since = 0;
    document.addEventListener("waiting", () => (w.since ||= performance.now()), true);
    document.addEventListener(
      "playing",
      () => {
        if (w.since) w.stalls.push([Math.round(w.since / 100) / 10, Math.round((performance.now() - w.since) / 100) / 10]);
        w.since = 0;
      },
      true,
    );
  });
  const videoState = () =>
    page.evaluate(() => {
      const v = document.querySelector("video")!;
      const p = document.querySelector("[data-player]")!;
      return { t: v.currentTime, paused: v.paused, ready: v.readyState, network: v.networkState, error: v.error?.code, state: p.getAttribute("data-state"), ahead: p.getAttribute("data-ahead-seconds") };
    });
  await page.goto(nameUrl("cinema"));
  const player = page.locator("[data-player]");
  const films = JSON.parse((await player.getAttribute("data-films")) ?? "[]");
  test.skip(films.length < 2, "Cinema lists one copy of the film; record the 720p copy first");
  await expect(player).toHaveAttribute("data-state", "ready", { timeout: 120_000 });
  await page.locator("[data-play]").click();
  await expect(player).toHaveAttribute("data-state", "playing", { timeout: 60_000 });
  await expect(player).toHaveAttribute("data-quality", "1080p");
  const time = () => page.evaluate(() => document.querySelector("video")!.currentTime);
  const t0 = Date.now();
  await page.waitForTimeout(20_000);

  await page.evaluate((v) => sessionStorage.setItem("cinemaThrottle", v), process.env.CINEMA_THROTTLE ?? "2");
  await expect(player).toHaveAttribute("data-quality", "720p", { timeout: 300_000 });
  const downAt = Number(await player.getAttribute("data-switched-at"));
  const downWall = (Date.now() - t0) / 1000;
  if (process.env.CINEMA_LIFT) await page.evaluate(() => sessionStorage.removeItem("cinemaThrottle"));
  await expect.poll(time, { timeout: 60_000 }).toBeGreaterThan(downAt + 2);
  // It carried on from where it was, not from the start.
  expect(downAt).toBeGreaterThan(15);

  const held = (Date.now() - t0) / 1000;
  await page.evaluate(() => sessionStorage.removeItem("cinemaThrottle"));
  await expect(player).toHaveAttribute("data-quality", "1080p", { timeout: 300_000 });
  const upAt = Number(await player.getAttribute("data-switched-at"));
  const upWall = (Date.now() - t0) / 1000;
  try {
    await expect.poll(time, { timeout: 60_000 }).toBeGreaterThan(upAt + 2);
  } catch (e) {
    console.log("after the switch up:", JSON.stringify(await videoState()));
    throw e;
  }
  const stalls = await page.evaluate(() => (window as unknown as { stalls: [number, number][] }).stalls.slice(1));
  console.log(JSON.stringify({ stallsAfterStart: stalls, heldUntilWall: held, downAtFilmS: Math.round(downAt), downWall, upAtFilmS: Math.round(upAt), upWall, switches: await player.getAttribute("data-switches") }));
});

// Where Cinema starts: 720p on a phone-width screen, and on a desktop whose opening seconds
// arrive slowly (capped at 2 Mbit/s, under 1.5 times 1080p's bitrate); otherwise 1080p.
for (const [name, width, throttle, expected] of [
  ["a phone", 375, "", "720p"],
  ["a slow desktop", 1280, "2", "720p"],
  ["a fast desktop", 1280, "", "1080p"],
] as const) {
  test(`Cinema starts on ${expected} on ${name}`, async ({ page }) => {
    test.skip(!process.env.CINEMA_MEASURE, "set CINEMA_MEASURE=1 to measure streaming from Autonomi mainnet");
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 800 });
    if (throttle) await page.addInitScript((v) => sessionStorage.setItem("cinemaThrottle", v), throttle);
    await page.goto(nameUrl("cinema"));
    const player = page.locator("[data-player]");
    test.skip(JSON.parse((await player.getAttribute("data-films")) ?? "[]").length < 2, "Cinema lists one copy of the film");
    await expect(player).toHaveAttribute("data-state", "ready", { timeout: 120_000 });
    // Let the opening seconds arrive, as they would while a visitor reads the page.
    await page.waitForTimeout(8_000);
    await page.locator("[data-play]").click();
    await expect(player).toHaveAttribute("data-state", "playing", { timeout: 90_000 });
    await expect(player).toHaveAttribute("data-quality", expected);
  });
}
