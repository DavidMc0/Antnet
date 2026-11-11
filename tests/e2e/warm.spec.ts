// Warm-up and the front door (DEMO.md 5.1, 5.2) on the fixture source.

import { type Page, expect, test } from "@playwright/test";
import { ROOT_URL, nameUrl, openName } from "./helpers";

/**
 * WebKit keeps a framed site's storage apart from a top-level visit to the same site, at least
 * on *.localhost (the tests' hosts), so warm-up can't help there. Whether Safari does the same
 * on a real domain is checked against the live loader. Playwright's request interception also
 * doesn't reach WebKit's frames.
 */
const WEBKIT_APART = "WebKit keeps framed storage apart on *.localhost";

/** Count requests for site content (archives and pointers) from now on. */
function countFetches(page: Page): () => number {
  let n = 0;
  page.context().on("request", (r) => {
    // Archives and pointer reads; the landing page's own list of test sites doesn't count.
    if (/\/_autonomi\/fixtures\/(pointers\/|[0-9a-f]{64}\.tar)/.test(r.url())) n++;
  });
  return () => n;
}

test("the front door fetches Start in the background, and Enter then opens it at once", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", WEBKIT_APART);
  await page.goto(ROOT_URL);
  await expect(page.locator("[data-door]")).toBeVisible();
  await expect(page.locator("h1")).toHaveText("This is the last page a web server will send you.");
  await expect(page.locator("[data-door]")).toHaveAttribute("data-door", "ready", { timeout: 15_000 });
  await expect(page.getByTestId("door-status")).toContainText("ready");

  const fetches = countFetches(page);
  await page.getByTestId("enter").click();
  await expect(page.locator(".cards")).toBeVisible();
  expect(new URL(page.url()).hostname).toBe("start.localhost");
  // Served by the worker the frame installed: nothing fetched from the network on Enter.
  expect(fetches()).toBe(0);
});

test("Enter works before the background fetch finishes", async ({ page }) => {
  // Hold the fixture source back, so Start can't have arrived when Enter is clicked.
  await page.context().route("**/_autonomi/fixtures/pointers/**", async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });
  await page.goto(ROOT_URL);
  await expect(page.locator("[data-door]")).toHaveAttribute("data-door", "working");
  await page.getByTestId("enter").click();
  await expect(page.locator(".cards")).toBeVisible({ timeout: 20_000 });
});

test("a background fetch that fails says so, and Enter still works", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "Playwright's request interception doesn't reach WebKit's frames");
  let fail = true;
  await page.context().route("**/_autonomi/fixtures/pointers/**", (route) =>
    fail ? route.fulfill({ status: 500, body: "down" }) : route.continue(),
  );
  await page.goto(ROOT_URL);
  await expect(page.locator("[data-door]")).toHaveAttribute("data-door", "error", { timeout: 15_000 });
  await expect(page.getByTestId("door-status")).toContainText("Enter will try again");
  fail = false;
  await page.getByTestId("enter").click();
  await expect(page.locator(".cards")).toBeVisible({ timeout: 15_000 });
});

test("without a site called start, the root shows the plain address page", async ({ page }) => {
  await page.context().route("**/_autonomi/names.json", (route) => route.fulfill({ json: { v: 1, names: {} } }));
  await page.goto(ROOT_URL);
  await expect(page.locator("[data-view=landing]")).toBeVisible();
  await expect(page.locator("[data-door]")).toHaveCount(0);
  await expect(page.locator("h1")).toHaveText("Open a site stored on Autonomi");
});

test("a site that is already installed reports ready without fetching", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", WEBKIT_APART);
  await openName(page, "start", ".cards");
  const fetches = countFetches(page);
  await page.goto(ROOT_URL);
  await expect(page.locator("[data-door]")).toHaveAttribute("data-door", "ready", { timeout: 15_000 });
  expect(fetches()).toBe(0);
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
