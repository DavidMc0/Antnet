import type { SiteSource } from "./types";

/** The source is chosen at build time: VITE_SOURCE=fixture|autonomi (default autonomi). */
export async function createSource(): Promise<SiteSource> {
  if (import.meta.env.VITE_SOURCE === "fixture") {
    const { FixtureSource } = await import("./fixture");
    return new FixtureSource();
  }
  const { AutonomiSource } = await import("./autonomi");
  return new AutonomiSource();
}
