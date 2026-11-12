// Media streamed from Autonomi through the loader's worker (DEMO.md 5.8). The worker carries
// the SDK's media bridge; the stream fixture's page answers its range requests as the SDK's
// page side does, with its own clip standing in for a file on the network.

import { expect, test } from "@playwright/test";
import { install, siteUrl } from "./helpers";

test("a stream URL plays and seeks through the loader's worker", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "Playwright's Windows WebKit can't decode the WebM clip (video error 4)");
  await install(page, "stream", "body[data-ready]");
  const result = await page.evaluate(async () => {
    const v = document.getElementById("clip") as HTMLVideoElement;
    const until = (ev: string, ok: () => boolean) =>
      new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`timed out waiting for ${ev}`)), 10_000);
        const h = () => {
          if (ok()) {
            clearTimeout(t);
            v.removeEventListener(ev, h);
            resolve();
          }
        };
        v.addEventListener(ev, h);
        v.addEventListener("error", () => reject(new Error(`video error ${v.error?.code}`)));
        h();
      });
    await until("loadedmetadata", () => v.readyState >= 1);
    await v.play();
    await until("timeupdate", () => v.currentTime > 0.2);
    const target = v.duration / 2;
    v.currentTime = target;
    await until("seeked", () => !v.seeking && v.currentTime >= target - 0.1);
    return { duration: v.duration, at: v.currentTime, ranges: (window as unknown as { rangesServed: number }).rangesServed };
  });
  expect(result.duration).toBeGreaterThan(0);
  expect(result.at).toBeGreaterThan(0);
  expect(result.ranges).toBeGreaterThan(0);
});

test("the bridge answers byte ranges with the right bytes and safe headers", async ({ page }) => {
  await install(page, "stream", "body[data-ready]");
  const r = await page.evaluate(async () => {
    const w = window as unknown as { streamUrl: string; clipBytes: Uint8Array };
    const res = await fetch(w.streamUrl, { headers: { Range: "bytes=1000-1999" } });
    const got = new Uint8Array(await res.arrayBuffer());
    const want = w.clipBytes.slice(1000, 2000);
    const tail = await fetch(w.streamUrl, { headers: { Range: "bytes=-100" } });
    const bad = await fetch(w.streamUrl, { headers: { Range: `bytes=${w.clipBytes.length + 5}-` } });
    return {
      status: res.status,
      same: got.length === want.length && got.every((b, i) => b === want[i]),
      range: res.headers.get("Content-Range"),
      type: res.headers.get("Content-Type"),
      csp: res.headers.get("Content-Security-Policy"),
      nosniff: res.headers.get("X-Content-Type-Options"),
      size: w.clipBytes.length,
      tail: tail.status,
      tailLength: (await tail.arrayBuffer()).byteLength,
      bad: bad.status,
    };
  });
  expect(r.status).toBe(206);
  expect(r.same).toBe(true);
  expect(r.range).toBe(`bytes 1000-1999/${r.size}`);
  expect(r.type).toBe("video/webm");
  expect(r.csp).toContain("sandbox");
  expect(r.nosniff).toBe("nosniff");
  expect(r.tail).toBe(206);
  expect(r.tailLength).toBe(100);
  expect(r.bad).toBe(416);
});

test("the info page lists what the site streamed", async ({ page }) => {
  await install(page, "stream", "body[data-ready]");
  // One range request is enough for the worker to note the stream, whatever the codec.
  await page.evaluate(async () => {
    const res = await fetch((window as unknown as { streamUrl: string }).streamUrl, { headers: { Range: "bytes=0-99" } });
    await res.arrayBuffer();
  });
  await page.goto(siteUrl("stream", "/_autonomi/"));
  const streams = page.getByTestId("streams");
  await expect(streams).toContainText("Streamed from Autonomi");
  await expect(streams).toContainText("clip.webm");
  await expect(streams).toContainText("video/webm");
});
