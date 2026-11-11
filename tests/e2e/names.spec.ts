// Short names (DEMO.md 5.9) against the fixture source and its test directory
// (public/_autonomi/names.json): start -> a pointer, library -> an archive.

import { type BrowserContext, type Page, expect, test } from "@playwright/test";
import {
  ROOT_URL,
  expireCheck,
  fixture,
  labelFor,
  nameUrl,
  openName,
  readState as readStateOrNull,
  updateNotice,
  waitForCheck,
} from "./helpers";

/** Playwright's request interception doesn't reach requests made through WebKit's service worker. */
const INTERCEPT = "request interception doesn't reach WebKit's service worker";

async function readState(page: Page) {
  const s = await readStateOrNull(page);
  if (!s) throw new Error("nothing installed");
  return s;
}

const LIBRARY = "demo: The Library";
const START_POINTER = "demo: Antnet Start";

/** Serve a different directory from now on. */
async function setDirectory(context: BrowserContext, names: Record<string, unknown>): Promise<void> {
  await context.route("**/_autonomi/names.json", (route) => route.fulfill({ json: { v: 1, names } }));
}

test("a name opens the site it points to, on the name's own origin", async ({ page }) => {
  await openName(page, "library", ".shelf");
  expect(new URL(page.url()).hostname).toBe("library.localhost");
  const state = await readState(page);
  expect(state.name).toBe("library");
  expect(state.link).toEqual({ kind: "i", address: fixture(LIBRARY).address });
});

test("a name on a pointer follows the pointer", async ({ page }) => {
  await openName(page, "start", ".cards");
  const state = await readState(page);
  expect(state.name).toBe("start");
  expect(state.link).toEqual({ kind: "p", address: fixture(START_POINTER).address });
  expect(state.archive).toBe(fixture("demo: Antnet Start (archive)").address);
});

test("the info page shows the whole chain and what the site calls itself", async ({ page }) => {
  await openName(page, "start", ".cards");
  await page.goto(nameUrl("start", "/_autonomi/"));
  const info = page.locator("[data-view=info]");
  await expect(page.getByTestId("name")).toHaveText("start");
  await expect(page.getByTestId("name-entry")).toContainText(`Pointer ${fixture(START_POINTER).address}`);
  await expect(page.getByTestId("name-entry")).toContainText("registered 2026-11-11");
  await expect(page.getByTestId("archive")).toHaveText(fixture("demo: Antnet Start (archive)").address);
  await expect(page.getByTestId("declared-name")).toHaveText("start");
  await expect(info).toContainText("public directory");
  // Where the site came from: DataMap plus three chunks.
  await expect(page.getByTestId("records").locator("table tr")).toHaveCount(5);
});

test("an unknown name gets a plain page, and nothing is installed", async ({ page }) => {
  await page.goto(nameUrl("bunny"));
  await expect(page.locator("[data-view=error] h1")).toHaveText("No site is called “bunny” here yet");
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
});

test("reserved and malformed names are never looked up", async ({ page }) => {
  let reads = 0;
  await page.context().route("**/_autonomi/names.json", (route) => {
    reads++;
    return route.continue();
  });
  for (const host of ["www", "autonomi-docs", "a--b"]) {
    await page.goto(nameUrl(host));
    await expect(page.locator("[data-view=error] h1")).toHaveText("Not a valid site address");
  }
  expect(reads).toBe(0);
});

test("a name link reaches the named site, keeping path, query and fragment", async ({ page }) => {
  await openName(page, "start", ".cards");
  await page.goto(nameUrl("start", "/_autonomi/go/name/library/books/the-time-machine/?from=start#chapter-2"));
  await expect(page.locator(".book-head h1")).toHaveText("The Time Machine", { timeout: 15_000 });
  const url = new URL(page.url());
  expect(url.hostname).toBe("library.localhost");
  expect(url.pathname + url.search + url.hash).toBe("/books/the-time-machine/?from=start#chapter-2");
});

test("an address link still works from a named site", async ({ page }) => {
  await openName(page, "library", ".shelf");
  await page.goto(nameUrl("library", `/_autonomi/go/ant/${fixture("plain").address}/docs/page.html?x=1#top`));
  await expect(page.locator("body")).toHaveAttribute("data-page", "nested", { timeout: 15_000 });
  const url = new URL(page.url());
  expect(url.hostname).toBe(`${labelFor("plain")}.localhost`);
  expect(url.pathname + url.search + url.hash).toBe("/docs/page.html?x=1#top");
});

test("the root domain opens a name by path, by ?open= and from the address box", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "WebKit on *.localhost loses the install record after a cross-host redirect (works in Safari on the live domain)");
  await page.goto(`${ROOT_URL}library/books/the-time-machine/`);
  await expect(page.locator(".book-head h1")).toHaveText("The Time Machine", { timeout: 15_000 });
  expect(new URL(page.url()).hostname).toBe("library.localhost");

  await page.goto(`${ROOT_URL}?open=library`);
  await expect(page.locator(".shelf")).toBeVisible({ timeout: 15_000 });

  await page.goto(`${ROOT_URL}?landing`);
  await page.locator("input[name=address]").fill("start");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.locator(".cards")).toBeVisible({ timeout: 15_000 });
  expect(new URL(page.url()).hostname).toBe("start.localhost");
});

test("a root path that isn't a registered name stays on the landing page and says so", async ({ page }) => {
  await page.goto(`${ROOT_URL}bunny`);
  await expect(page.locator("[data-view=landing]")).toBeVisible();
  await expect(page.locator(".form-error")).toHaveText("No site is called “bunny” here yet.");
});

// Due checks on named sites run in the background (DEMO.md 5.3): the installed site is served
// at once, the directory is re-read afterwards, and a change brings a notice.

test("a due check on a name with a fixed address runs in the background and keeps the site", async ({ page }) => {
  await openName(page, "library", ".shelf");
  await expireCheck(page);
  const since = Date.now();
  await page.reload();
  await expect(page.locator(".shelf")).toBeVisible();
  const state = await waitForCheck(page, since);
  expect(state?.lastCheck?.outcome).toBe("no change");
  expect(Date.now() - (state?.checkedAt ?? 0)).toBeLessThan(60_000);
  await expect(updateNotice(page)).toHaveCount(0);
});

test("a changed directory entry is picked up by the next due check", async ({ page, context, browserName }) => {
  test.skip(browserName === "webkit", INTERCEPT);
  await openName(page, "library", ".shelf");
  // The name now points at the plain fixture site.
  await setDirectory(context, { library: { kind: "i", address: fixture("plain").address, since: "2026-11-12" } });

  // Not due yet: still the Library.
  await page.reload();
  await expect(page.locator(".shelf")).toBeVisible();

  await expireCheck(page);
  const since = Date.now();
  await page.reload();
  // Still the Library at first; the new site is installed in the background.
  await expect(page.locator(".shelf")).toBeVisible();
  expect((await waitForCheck(page, since))?.lastCheck?.outcome).toBe("new version installed");
  await updateNotice(page).getByRole("button", { name: "Reload" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-page", "home", { timeout: 15_000 });
  expect(new URL(page.url()).hostname).toBe("library.localhost");
  const state = await readState(page);
  expect(state.name).toBe("library");
  expect(state.link.address).toBe(fixture("plain").address);
  // The old archive's cache is gone.
  const names = await page.evaluate(() => caches.keys());
  expect(names.filter((n) => n.startsWith("site-v1-"))).toEqual([`site-v1-${fixture("plain").address}`]);
});

test("a name removed from the directory stops being served after its next due check", async ({ page, context, browserName }) => {
  test.skip(browserName === "webkit", INTERCEPT);
  await openName(page, "library", ".shelf");
  await setDirectory(context, {});
  await expireCheck(page);
  const since = Date.now();
  await page.reload();
  await expect(page.locator(".shelf")).toBeVisible();
  // The check uninstalls the site and says so; the page already open stays readable.
  expect(await waitForCheck(page, since)).toBeNull();
  await expect(updateNotice(page)).toHaveAttribute("data-antnet-notice", "removed");
  const names = await page.evaluate(() => caches.keys());
  expect(names.filter((n) => n.startsWith("site-v1-"))).toEqual([]);
  // The next visit finds no such name.
  await page.reload();
  await expect(page.locator("[data-view=error] h1")).toHaveText("No site is called “library” here yet", {
    timeout: 15_000,
  });
});

test("a due check keeps the installed site when the directory can't be read", async ({ page, context, browserName }) => {
  test.skip(browserName === "webkit", INTERCEPT);
  await openName(page, "library", ".shelf");
  await context.route("**/_autonomi/names.json", (route) => route.fulfill({ status: 500, body: "down" }));
  await expireCheck(page);
  const since = Date.now();
  await page.reload();
  await expect(page.locator(".shelf")).toBeVisible();
  const state = await waitForCheck(page, since);
  expect(state?.lastCheck?.outcome).toMatch(/^failed/);
  // Due again in about 10 minutes, not a full hour.
  const dueIn = (state?.checkedAt ?? 0) + 60 * 60 * 1000 - Date.now();
  expect(dueIn).toBeGreaterThan(9 * 60 * 1000);
  expect(dueIn).toBeLessThan(11 * 60 * 1000);
});

test("a named pointer site still checks its pointer", async ({ page, context, browserName }) => {
  test.skip(browserName === "webkit", INTERCEPT);
  await openName(page, "start", ".cards");
  // Re-point Start's pointer at the plain fixture site.
  const pointerFile = `/_autonomi/fixtures/pointers/${fixture(START_POINTER).address}.json`;
  await context.route(`**${pointerFile}`, (route) =>
    route.fulfill({ json: { kind: "chunk", target: fixture("plain").address } }),
  );
  await expireCheck(page);
  const since = Date.now();
  await page.reload();
  await expect(page.locator(".cards")).toBeVisible();
  expect((await waitForCheck(page, since))?.lastCheck?.outcome).toBe("new version installed");
  await updateNotice(page).getByRole("button", { name: "Reload" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-page", "home", { timeout: 15_000 });
  const state = await readState(page);
  expect(state.name).toBe("start");
  expect(state.archive).toBe(fixture("plain").address);
});
