// Short names (DEMO.md 5.9) against the fixture source and its test directory
// (public/_autonomi/names.json): start -> a pointer, library -> an archive.

import { type BrowserContext, type Page, expect, test } from "@playwright/test";
import { ROOT_URL, fixture, labelFor, nameUrl, openName } from "./helpers";

const LIBRARY = "demo: The Library";
const START_POINTER = "demo: Antnet Start";

type State = {
  link: { kind: string; address: string };
  name?: string;
  archive: string;
  checkedAt: number;
  lastCheck?: { outcome: string };
};

async function readState(page: Page): Promise<State> {
  return page.evaluate(async () => {
    const res = await (await caches.open("autonomi-loader-meta")).match("/_autonomi/state.json");
    return res!.json();
  });
}

/** Make the installed site's update check due, by moving checkedAt into the past. */
async function expireCheck(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const cache = await caches.open("autonomi-loader-meta");
    const state = await (await cache.match("/_autonomi/state.json"))!.json();
    state.checkedAt = 0;
    await cache.put(
      "/_autonomi/state.json",
      new Response(JSON.stringify(state), { headers: { "Content-Type": "application/json" } }),
    );
  });
}

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

test("the root domain opens a name by path, by ?open= and from the address box", async ({ page }) => {
  await page.goto(`${ROOT_URL}library/books/the-time-machine/`);
  await expect(page.locator(".book-head h1")).toHaveText("The Time Machine", { timeout: 15_000 });
  expect(new URL(page.url()).hostname).toBe("library.localhost");

  await page.goto(`${ROOT_URL}?open=library`);
  await expect(page.locator(".shelf")).toBeVisible({ timeout: 15_000 });

  await page.goto(ROOT_URL);
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

test("a due check on a name with a fixed address records the check and keeps the site", async ({ page }) => {
  await openName(page, "library", ".shelf");
  await expireCheck(page);
  await page.reload();
  await expect(page.locator(".shelf")).toBeVisible({ timeout: 15_000 });
  const state = await readState(page);
  expect(state.lastCheck?.outcome).toBe("no change");
  expect(Date.now() - state.checkedAt).toBeLessThan(60_000);
});

test("a changed directory entry is picked up by the next due check", async ({ page, context }) => {
  await openName(page, "library", ".shelf");
  // The name now points at the plain fixture site.
  await setDirectory(context, { library: { kind: "i", address: fixture("plain").address, since: "2026-11-12" } });

  // Not due yet: still the Library.
  await page.reload();
  await expect(page.locator(".shelf")).toBeVisible();

  await expireCheck(page);
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-page", "home", { timeout: 15_000 });
  expect(new URL(page.url()).hostname).toBe("library.localhost");
  const state = await readState(page);
  expect(state.name).toBe("library");
  expect(state.link.address).toBe(fixture("plain").address);
  // The old archive's cache is gone.
  const names = await page.evaluate(() => caches.keys());
  expect(names.filter((n) => n.startsWith("site-v1-"))).toEqual([`site-v1-${fixture("plain").address}`]);
});

test("a name removed from the directory stops being served at its next due check", async ({ page, context }) => {
  await openName(page, "library", ".shelf");
  await setDirectory(context, {});
  await expireCheck(page);
  await page.reload();
  await expect(page.locator("[data-view=error] h1")).toHaveText("No site is called “library” here yet", {
    timeout: 15_000,
  });
  const names = await page.evaluate(() => caches.keys());
  expect(names.filter((n) => n.startsWith("site-v1-"))).toEqual([]);
});

test("a due check falls back to the installed site when the directory can't be read", async ({ page, context }) => {
  await openName(page, "library", ".shelf");
  await context.route("**/_autonomi/names.json", (route) => route.fulfill({ status: 500, body: "down" }));
  await expireCheck(page);
  await page.reload();
  await expect(page.locator(".shelf")).toBeVisible({ timeout: 15_000 });
  const state = await readState(page);
  expect(state.lastCheck?.outcome).toMatch(/^failed/);
  // Due again in about 10 minutes, not a full hour.
  const dueIn = state.checkedAt + 60 * 60 * 1000 - Date.now();
  expect(dueIn).toBeGreaterThan(9 * 60 * 1000);
  expect(dueIn).toBeLessThan(11 * 60 * 1000);
});

test("a named pointer site still checks its pointer", async ({ page, context }) => {
  await openName(page, "start", ".cards");
  // Re-point Start's pointer at the plain fixture site.
  const pointerFile = `/_autonomi/fixtures/pointers/${fixture(START_POINTER).address}.json`;
  await context.route(`**${pointerFile}`, (route) =>
    route.fulfill({ json: { kind: "chunk", target: fixture("plain").address } }),
  );
  await expireCheck(page);
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-page", "home", { timeout: 15_000 });
  const state = await readState(page);
  expect(state.name).toBe("start");
  expect(state.archive).toBe(fixture("plain").address);
  expect(state.lastCheck?.outcome).toBe("new version installed");
});
