/// <reference lib="webworker" />
// The loader's service worker (spec 3.3). Serves the installed site from Cache Storage and
// never talks to Autonomi. Built as one self-contained classic script.

import { CHECK_INTERVAL_MS, DOOR_PATH, RESERVED_PREFIX, SW_PATH, siteCacheName } from "./config";
import { classifyHost, goLinkTarget } from "./host";
import { cachePathFor, parseRange, resolvePath } from "./site";
import { checkDue, readState } from "./state";

declare const self: ServiceWorkerGlobalScope;
declare const __LOADER_ROOT__: string;
declare const __DEV_PASSTHROUGH__: boolean;

const DEV_PREFIXES = ["/@vite/", "/@fs/", "/@id/", "/src/", "/node_modules/", "/__vite"];

self.addEventListener("install", () => {
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Rule 1: only same-origin GET and HEAD.
  if (url.origin !== self.location.origin) return;
  if (req.method !== "GET" && req.method !== "HEAD") return;

  // Rule 2: reserved paths go to the network, except portable go-links, and a site's front
  // door when the site is already installed: then straight into the site, without the shell.
  if (url.pathname.startsWith(RESERVED_PREFIX) || url.pathname === SW_PATH) {
    if (url.pathname.startsWith("/_autonomi/go/")) {
      const host = classifyHost(url.hostname, __LOADER_ROOT__ || undefined);
      const target = goLinkTarget(url, host.root);
      if (target) event.respondWith(Response.redirect(target, 302));
    } else if (url.pathname === DOOR_PATH && req.mode === "navigate") {
      event.respondWith(
        readState(self.location.origin).then((state) =>
          state ? Response.redirect(new URL("/", url.origin).href, 302) : fetch(req),
        ),
      );
    }
    return;
  }
  if (__DEV_PASSTHROUGH__ && DEV_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  event.respondWith(handle(req, url));
});

async function handle(req: Request, url: URL): Promise<Response> {
  const state = await readState(self.location.origin);

  // Rule 3: nothing installed; the host returns the shell, which installs the site.
  if (!state) return fetch(req);

  // Rule 4: a pointer link whose check is due lets one navigation through to the shell.
  if (req.mode === "navigate" && checkDue(state, Date.now(), CHECK_INTERVAL_MS)) {
    try {
      return await fetch(req);
    } catch {
      // Offline: fall through to the cached site.
    }
  }

  // Rule 5: serve from the site cache.
  const cache = await caches.open(siteCacheName(state.archive));
  const lookup = (path: string) => new URL(cachePathFor(path), url.origin).href;
  const resolution = await resolvePath(
    url.pathname,
    url.search,
    req.mode === "navigate",
    state.settings,
    async (path) => (await cache.match(lookup(path))) !== undefined,
  );

  switch (resolution.kind) {
    case "redirect":
      return new Response(null, { status: 308, headers: { Location: resolution.location } });
    case "text":
      return new Response(req.method === "HEAD" ? null : resolution.body, {
        status: resolution.status,
        headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
      });
    case "file": {
      const cached = await cache.match(lookup(resolution.path));
      if (!cached) return new Response("Not found", { status: 404 });
      return respondWithFile(req, cached, resolution.status);
    }
  }
}

async function respondWithFile(req: Request, cached: Response, status: number): Promise<Response> {
  const headers = new Headers(cached.headers);
  const blob = await cached.blob();
  const range = status === 200 ? parseRange(req.headers.get("Range"), blob.size) : null;

  if (range === "invalid") {
    headers.set("Content-Range", `bytes */${blob.size}`);
    headers.delete("Content-Length");
    return new Response(null, { status: 416, headers });
  }
  if (range) {
    const part = blob.slice(range.start, range.end + 1);
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${blob.size}`);
    headers.set("Content-Length", String(part.size));
    return new Response(req.method === "HEAD" ? null : part, { status: 206, headers });
  }
  return new Response(req.method === "HEAD" ? null : blob, { status, headers });
}
