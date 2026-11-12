// The front door (DEMO.md 5.1) and warm-up (5.2) on the fixture source.
//
// The front door runs on Start's own origin (start.<root>/_autonomi/door) while Start installs,
// with no frame, so it works the same in every browser. Start's cards still warm their sites
// in hidden frames, where the browser allows it (not WebKit, which keeps framed storage apart).

import { type Page, expect, test } from "@playwright/test";
import { ROOT_URL, nameUrl, openName } from "./helpers";

/**
 * Count the page's own requests for site content (archives and pointers) from now on.
 * Start's cards fetch the sites they list in hidden frames, as soon as Start shows; those
 * are other sites arriving, not this page being fetched again, so frames don't count.
 */
function countFetches(page: Page): () => number {
  let n = 0;
  page.context().on("request", (r) => {
    // Archives and pointer reads; the pages' own list of test sites doesn't count.
    if (!/\/_autonomi\/fixtures\/(pointers\/|[0-9a-f]{64}\.tar)/.test(r.url())) return;
    let inFrame = false;
    try {
      inFrame = r.frame() !== page.mainFrame();
    } catch {
      // A service worker's request has no frame; count it.
    }
    if (!inFrame) n++;
  });
  return () => n;
}

test("the root leads to Start's front door; Enter opens Start at once once it has arrived", async ({ page }) => {
  await page.goto(ROOT_URL);
  await expect(page.locator("[data-door]")).toBeVisible();
  expect(new URL(page.url()).hostname).toBe("start.localhost");
  await expect(page.locator("h1")).toHaveText("This is the last page a web server will send you.");
  await expect(page.locator("[data-door]")).toHaveAttribute("data-door", "ready", { timeout: 15_000 });
  await expect(page.getByTestId("door-status")).toHaveText("Antnet Start is here, checked and ready.");

  const fetches = countFetches(page);
  await page.getByTestId("enter").click();
  await expect(page.locator(".cards")).toBeVisible();
  const url = new URL(page.url());
  expect(url.hostname + url.pathname).toBe("start.localhost/");
  expect(fetches()).toBe(0);
});

test("Enter pressed early opens Start as soon as it arrives, with no second loading screen", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "Playwright's request interception doesn't reach WebKit's service worker");
  await page.context().route("**/_autonomi/fixtures/pointers/**", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  let pointerReads = 0;
  page.context().on("request", (r) => {
    if (r.url().includes("/_autonomi/fixtures/pointers/")) pointerReads++;
  });
  await page.goto(ROOT_URL);
  await expect(page.locator("[data-door]")).toHaveAttribute("data-door", "working");
  await page.getByTestId("enter").click();
  await expect(page.getByTestId("door-status")).toContainText("Opening as soon as it arrives");
  await expect(page.locator(".cards")).toBeVisible({ timeout: 20_000 });
  // One install, the door's own: Enter didn't start a second one.
  expect(pointerReads).toBe(1);
});

test("a fetch that fails says so, and Enter tries again", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "Playwright's request interception doesn't reach WebKit's service worker");
  let fail = true;
  await page.context().route("**/_autonomi/fixtures/pointers/**", (route) =>
    fail ? route.fulfill({ status: 500, body: "down" }) : route.continue(),
  );
  await page.goto(ROOT_URL);
  await expect(page.locator("[data-door]")).toHaveAttribute("data-door", "error", { timeout: 15_000 });
  await expect(page.getByTestId("door-status")).toContainText("couldn't be fetched");
  await expect(page.getByTestId("enter")).toHaveText("Try again");
  fail = false;
  await page.getByTestId("enter").click();
  await expect(page.locator("[data-door]")).toHaveAttribute("data-door", "ready", { timeout: 15_000 });
});

test("a returning visitor goes straight from the root to Start", async ({ page, browserName }) => {
  // WebKit on *.localhost: after the root's script redirect, the site's storage shows no
  // install record, so Start is fetched again. To check in Safari on the real domain.
  test.skip(browserName === "webkit", "WebKit loses the install record after a cross-host redirect on *.localhost");
  await openName(page, "start", ".cards");
  const fetches = countFetches(page);
  await page.goto(ROOT_URL);
  await expect(page.locator(".cards")).toBeVisible({ timeout: 15_000 });
  expect(new URL(page.url()).pathname).toBe("/");
  expect(fetches()).toBe(0);
});

test("?landing, or a loader without Start, shows the address page with the named sites", async ({ page }) => {
  await page.goto(`${ROOT_URL}?landing`);
  await expect(page.locator("[data-view=landing]")).toBeVisible();
  await expect(page.locator("h1")).toHaveText("Open a site stored on Autonomi");
  await expect(page.getByTestId("named-sites").locator("a")).toHaveText(["library", "cinema", "start"]);
  await page.getByTestId("named-sites").locator('a[data-name="library"]').click();
  await expect(page.locator(".shelf")).toBeVisible({ timeout: 15_000 });

  const names = await (await page.request.get(`${ROOT_URL}_autonomi/names.json`)).json();
  delete names.names.start;
  await page.context().route("**/_autonomi/names.json", (route) => route.fulfill({ json: names }));
  await page.goto(ROOT_URL);
  await expect(page.locator("[data-view=landing]")).toBeVisible();
  await expect(page.getByTestId("named-sites").locator("a")).toHaveText(["library", "cinema"]);
});

test("the front door lists the other named sites", async ({ page }) => {
  await page.goto(ROOT_URL);
  await expect(page.getByTestId("named-sites").locator("a")).toHaveText(["library", "cinema"]);
});

test("the warm path only answers pages on this loader", async ({ page, context }) => {
  // A page on another origin frames a site's warm path and says hello: no answer comes back.
  await context.route("http://elsewhere.test/", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>elsewhere</title>" }),
  );
  await page.goto("http://elsewhere.test/");
  const answered = await page.evaluate(async (src) => {
    const frame = document.createElement("iframe");
    frame.src = src;
    document.body.append(frame);
    let got = false;
    addEventListener("message", (e) => {
      if (e.source === frame.contentWindow) got = true;
    });
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 300));
      frame.contentWindow?.postMessage({ type: "antnet:hello" }, "*");
    }
    return got;
  }, nameUrl("library", "/_autonomi/warm"));
  expect(answered).toBe(false);
});
