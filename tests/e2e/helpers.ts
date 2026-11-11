import { readFileSync } from "node:fs";
import { type Page, expect } from "@playwright/test";
import { hexToLabelBody } from "../../src/base32";

export const PORT = 4173;

type Fixture = { kind: "i" | "p"; address: string };
const index = JSON.parse(
  readFileSync(new URL("../../public/_autonomi/fixtures/index.json", import.meta.url), "utf8"),
) as Record<string, Fixture>;

export function fixture(name: string): Fixture {
  const f = index[name];
  if (!f) throw new Error(`No fixture named ${name}; run npm run fixtures`);
  return f;
}

export function labelFor(name: string): string {
  const f = fixture(name);
  return f.kind + hexToLabelBody(f.address);
}

export function siteUrl(name: string, path = "/"): string {
  return `http://${labelFor(name)}.localhost:${PORT}${path}`;
}

export const ROOT_URL = `http://localhost:${PORT}/`;

/** A site reached by short name, from the test directory the fixtures build writes. */
export function nameUrl(name: string, path = "/"): string {
  return `http://${name}.localhost:${PORT}${path}`;
}

/** Open a named site and wait until the installed site (not the shell) is showing. */
export async function openName(page: Page, name: string, ready: string, path = "/"): Promise<void> {
  await page.goto(nameUrl(name, path));
  await expect(page.locator(ready)).toBeAttached({ timeout: 15_000 });
}

/** Open a fixture site and wait until the installed site (not the shell) is showing. */
export async function install(page: Page, name: string, ready: string, path = "/"): Promise<void> {
  await page.goto(siteUrl(name, path));
  await expect(page.locator(ready)).toBeAttached({ timeout: 15_000 });
}

export type StateRecord = {
  link: { kind: string; address: string };
  name?: string;
  archive: string;
  checkedAt: number;
  lastCheck?: { at: number; outcome: string };
};

/** The site's state record, read from inside the page; null if nothing is installed. */
export async function readState(page: Page): Promise<StateRecord | null> {
  return page.evaluate(async () => {
    if (!(await caches.has("autonomi-loader-meta"))) return null;
    const res = await (await caches.open("autonomi-loader-meta")).match("/_autonomi/state.json");
    return res ? res.json() : null;
  });
}

/** Make the installed site's update check due, by moving checkedAt into the past. */
export async function expireCheck(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const cache = await caches.open("autonomi-loader-meta");
    const res = await cache.match("/_autonomi/state.json");
    if (!res) throw new Error("nothing installed");
    const state = await res.json();
    state.checkedAt = 0;
    await cache.put(
      "/_autonomi/state.json",
      new Response(JSON.stringify(state), { headers: { "Content-Type": "application/json" } }),
    );
  });
}

/** Wait for the background check (DEMO.md 5.3) to record an outcome after `since`. */
export async function waitForCheck(page: Page, since: number, timeout = 15_000): Promise<StateRecord | null> {
  let state: StateRecord | null = null;
  await expect
    .poll(
      async () => {
        state = await readState(page);
        return state === null ? "uninstalled" : (state.lastCheck && state.lastCheck.at >= since ? state.lastCheck.outcome : "");
      },
      { timeout },
    )
    .not.toBe("");
  return state;
}

/** The loader's update notice, drawn in an open shadow root. */
export function updateNotice(page: Page) {
  return page.locator("antnet-notice");
}

/** Cache names and whether a state record exists, read from inside the page. */
export async function storage(page: Page): Promise<{ caches: string[]; state: boolean }> {
  return page.evaluate(async () => {
    const names = await caches.keys();
    const meta = names.includes("autonomi-loader-meta") ? await caches.open("autonomi-loader-meta") : null;
    const state = meta ? (await meta.match("/_autonomi/state.json")) !== undefined : false;
    return { caches: names, state };
  });
}
