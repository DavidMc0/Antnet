// Cinema (DEMO.md 3.4) on the fixture loader. The site's archive is local, but its film is on
// Autonomi mainnet, so the tests that run by default only check what needs no network: the
// page, its policy, and that the player script starts. Set CINEMA_LIVE=1 to also stream the
// film from mainnet through the loader's worker.

import { expect, test } from "@playwright/test";
import { nameUrl, openName } from "./helpers";

test("Cinema shows the poster, the film's billing, and the way back to Start", async ({ page }) => {
  const policyErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy/i.test(m.text())) policyErrors.push(m.text());
  });
  await openName(page, "cinema", "[data-player]");
  await expect(page.locator("h1")).toHaveText("Big Buck Bunny");
  await expect(page.locator(".claim h2")).toHaveText("No video host.");
  await expect(page.locator("video")).toHaveAttribute("poster", "/poster.webp");
  await expect(page.locator("[data-play]")).toBeVisible();
  await expect(page.locator(".antnet-start")).toHaveAttribute("href", "/_autonomi/go/name/start/");
  await expect(page.locator(".credits")).toContainText("Blender Foundation");
  await expect(page.locator(".credits")).toContainText("CC BY 3.0");
  // The player script ran: it loaded as a module under the site's own policy.
  await expect(page.locator("[data-streamed]")).toHaveText("nothing yet");
  await expect(page.locator("[data-player]")).toHaveAttribute("data-state", /preparing|ready|trouble/);
  // The poster comes from the site's own archive, through the worker.
  expect(await page.evaluate(async () => (await fetch("/poster.webp")).headers.get("Content-Type"))).toBe("image/webp");
  expect(policyErrors).toEqual([]);
});

test("the film's full address shows on request", async ({ page }) => {
  await openName(page, "cinema", "[data-player]");
  const full = page.locator("[data-address-full]");
  await expect(full).toBeHidden();
  await page.locator("[data-address-toggle]").click();
  await expect(full).toHaveText(/^[0-9a-f]{64}$/);
});

test("pressing play before the film is open waits for it", async ({ page, context, browserName }) => {
  test.skip(browserName === "webkit", "Playwright's Windows WebKit has no WebRTC, so Cinema says it can't play there");
  // Hold the client's WebAssembly back, so the film can't be open yet when play is pressed.
  await context.route("**/player/*.wasm", async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.continue().catch(() => {});
  });
  await openName(page, "cinema", "[data-player]");
  await page.locator("[data-play]").click();
  await expect(page.locator("[data-player]")).toHaveAttribute("data-state", "waiting");
});

test("the film streams from mainnet: plays, counts what it streamed, and seeks", async ({ page }) => {
  test.skip(!process.env.CINEMA_LIVE, "set CINEMA_LIVE=1 to stream the film from Autonomi mainnet");
  test.setTimeout(180_000);
  await openName(page, "cinema", "[data-player]");
  const player = page.locator("[data-player]");
  await expect(player).toHaveAttribute("data-state", "ready", { timeout: 90_000 });
  await page.locator("[data-play]").click();
  await expect(player).toHaveAttribute("data-state", "playing", { timeout: 60_000 });
  await expect(page.locator("[data-visit]")).toContainText("first frame");
  await expect.poll(() => page.evaluate(() => document.querySelector("video")!.currentTime), { timeout: 30_000 }).toBeGreaterThan(3);
  expect(Number(await player.getAttribute("data-streamed-bytes"))).toBeGreaterThan(1_000_000);
  await page.evaluate(() => {
    const v = document.querySelector("video")!;
    v.currentTime = v.duration / 2;
  });
  await expect
    .poll(() => page.evaluate(() => { const v = document.querySelector("video")!; return v.currentTime - v.duration / 2; }), { timeout: 90_000 })
    .toBeGreaterThan(1);
  await page.goto(nameUrl("cinema", "/_autonomi/"));
  await expect(page.getByTestId("streams")).toContainText("big-buck-bunny-1080p.mp4");
});
