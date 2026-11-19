import { loaderRootFor } from "../host";
import type { SiteSource } from "./types";

/**
 * Whether this loader is served by Antnet Gateway on the user's own computer: its root is
 * under `.localhost` (DEMO.md 12.10). The hosted loader never calls the gateway's endpoints.
 * Development servers use the bare `localhost` root, so they don't either.
 */
export function isLocalLoader(hostname = location.hostname): boolean {
  return loaderRootFor(hostname, import.meta.env.VITE_LOADER_ROOT || undefined).endsWith(".localhost");
}

async function browserSource(): Promise<SiteSource> {
  const { AutonomiSource } = await import("./autonomi");
  return new AutonomiSource();
}

/**
 * The source is chosen at build time, VITE_SOURCE=fixture|autonomi (default autonomi), and for
 * autonomi by where the loader runs: a local loader tries the gateway first, then WebRTC.
 */
export async function createSource(): Promise<SiteSource> {
  if (import.meta.env.VITE_SOURCE === "fixture") {
    const { FixtureSource } = await import("./fixture");
    return new FixtureSource();
  }
  if (isLocalLoader()) {
    const { GatewayFirstSource } = await import("./gateway");
    return new GatewayFirstSource(browserSource);
  }
  return browserSource();
}
