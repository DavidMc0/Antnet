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

/** Open a fixture site and wait until the installed site (not the shell) is showing. */
export async function install(page: Page, name: string, ready: string, path = "/"): Promise<void> {
  await page.goto(siteUrl(name, path));
  await expect(page.locator(ready)).toBeAttached({ timeout: 15_000 });
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
