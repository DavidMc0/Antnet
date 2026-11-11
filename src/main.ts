// Boot: choose the landing, install, update-check, info or error view (spec 3, 3.4, 3.6).

import "./ui/style.css";
import {
  CHECK_INTERVAL_MS,
  CHECK_RETRY_MS,
  MAX_AUTO_RELOADS,
  RELOAD_WINDOW_MS,
  SW_PATH,
  checkBudgetMs,
  maxArchiveBytes,
} from "./config";
import {
  type SiteLink,
  classifyHost,
  goLinkTarget,
  parseAddressInput,
  pathFormTarget,
  siteOrigin,
} from "./host";
import { NotASiteError, installArchive } from "./install";
import { createSource } from "./source";
import { type SiteSource, SourceError } from "./source/types";
import { type SiteState, type Timings, checkDue, readState, sameLink, writeState } from "./state";
import { TarError } from "./tar";
import { formatBytes } from "./ui/dom";
import { showError, showInfo, showLanding, showLoading } from "./ui/views";

const CONFIGURED_ROOT: string | undefined = import.meta.env.VITE_LOADER_ROOT || undefined;
const RELOADS_KEY = "autonomi-loader-reloads";

function rootUrl(root: string): string {
  return `${location.protocol}//${root}${location.port ? ":" + location.port : ""}/`;
}

function homeAction(root: string) {
  return { label: "Loader home", run: () => location.assign(rootUrl(root)) };
}

// ---------------------------------------------------------------------------------------------
// Reload guard (spec 3.4: hard reload). sessionStorage holds recent automatic reload times.

function recentReloads(now: number): number[] {
  try {
    const list = JSON.parse(sessionStorage.getItem(RELOADS_KEY) ?? "[]") as unknown;
    return Array.isArray(list) ? list.filter((t): t is number => typeof t === "number" && now - t < RELOAD_WINDOW_MS) : [];
  } catch {
    return [];
  }
}

function resetReloadGuard(): void {
  try {
    sessionStorage.removeItem(RELOADS_KEY);
  } catch {
    // Storage unavailable: the guard just can't count.
  }
}

/** Reload into the installed site, unless the shell keeps coming back (then show an error). */
function guardedReload(link: SiteLink, root: string): void {
  const now = Date.now();
  const recent = recentReloads(now);
  if (recent.length >= MAX_AUTO_RELOADS) {
    resetReloadGuard();
    showError(
      "The site didn't open",
      "The site is installed, but the loader's service worker isn't serving it. " +
        "This can happen when the browser blocks service workers or storage for this site.",
      [
        { label: "Try again", run: () => location.reload() },
        { label: "Site info", run: () => location.assign("/_autonomi/") },
        homeAction(root),
      ],
      link,
    );
    return;
  }
  try {
    sessionStorage.setItem(RELOADS_KEY, JSON.stringify([...recent, now]));
  } catch {
    // Without storage we can't count; reload once anyway.
  }
  location.reload();
}

// ---------------------------------------------------------------------------------------------
// Errors

function describeError(e: unknown): { title: string; message: string } {
  if (e instanceof TarError || e instanceof NotASiteError) {
    return { title: "Not a site archive", message: e.message };
  }
  if (e instanceof SourceError) {
    switch (e.code) {
      case "too-large":
        return {
          title: "This site is too large",
          message: `The archive is over the ${formatBytes(maxArchiveBytes())} limit. ${e.message}`,
        };
      case "not-found":
        return { title: "Nothing found at this address", message: e.message };
      case "not-chunk":
        return { title: "This pointer doesn't lead to a site", message: e.message };
      case "verify":
        return { title: "The download failed verification", message: e.message };
      case "aborted":
        return { title: "Cancelled", message: e.message };
      case "network":
        return { title: "Couldn't reach the Autonomi network", message: e.message };
    }
  }
  // Settings-file problems are thrown as plain Errors from parseSettings.
  if (e instanceof Error && /autonomi-site|site format/i.test(e.message)) {
    return { title: "Not a site archive", message: e.message };
  }
  return { title: "Something went wrong", message: e instanceof Error ? e.message : String(e) };
}

// ---------------------------------------------------------------------------------------------
// Service worker

async function registerWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser can't run service workers here, so the loader can't install sites.");
  }
  await navigator.serviceWorker.register(SW_PATH, { scope: "/", updateViaCache: "none" });
  await navigator.serviceWorker.ready;
}

// ---------------------------------------------------------------------------------------------
// Install

function since(t: number): number {
  return Math.round(performance.now() - t);
}

async function install(link: SiteLink, root: string): Promise<void> {
  const view = showLoading(link, link.kind === "p" ? "Opening the latest version of a site" : "Opening a site");
  const started = performance.now();
  const timings: Timings = {};
  let source: SiteSource | null = null;
  try {
    source = await createSource();

    view.step("Connecting to the Autonomi network…");
    let t = performance.now();
    await source.connect?.();
    timings.connectMs = since(t);

    let archive = link.address;
    if (link.kind === "p") {
      view.step("Finding the latest version…");
      t = performance.now();
      archive = await source.resolvePointer(link.address);
      timings.resolveMs = since(t);
    }

    view.step("Downloading the site…");
    t = performance.now();
    const result = await source.fetchArchive(archive, {
      maxBytes: maxArchiveBytes(),
      onProgress: (done, total, unit) => view.progress(done, total, unit),
    });
    timings.downloadMs = since(t);

    view.step("Installing…");
    await installArchive({
      origin: location.origin,
      link,
      archive,
      blake3: result.blake3,
      bytes: result.bytes,
      records: result.chunks,
      timings,
      startedAt: started,
    });
  } catch (e) {
    const { title, message } = describeError(e);
    console.error("[autonomi-loader] install failed", e);
    showError(title, message, [{ label: "Try again", run: () => location.reload() }, homeAction(root)], link);
    return;
  } finally {
    source?.close();
  }
  // A fresh install starts a new reload budget.
  resetReloadGuard();
  guardedReload(link, root);
}

// ---------------------------------------------------------------------------------------------
// Update check (spec 3.4)

class BudgetError extends Error {}

function withBudget<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      ctrl.abort();
      reject(new BudgetError(`No answer within ${ms / 1000} s`));
    }, ms);
    run(ctrl.signal).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function updateCheck(state: SiteState, link: SiteLink, root: string): Promise<void> {
  const view = showLoading(link, "Checking for a new version…");
  view.step("Reading the pointer…");
  const started = performance.now();
  const now = Date.now();
  let source: SiteSource | null = null;
  let outcome: string;
  let checkedAt = now;
  try {
    source = await createSource();
    const s = source;
    let connectMs: number | undefined;
    let resolveMs: number | undefined;
    const target = await withBudget(checkBudgetMs(), async (signal) => {
      let t = performance.now();
      await s.connect?.(signal);
      connectMs = since(t);
      t = performance.now();
      const found = await s.resolvePointer(link.address, signal);
      resolveMs = since(t);
      return found;
    });
    const checkMs = since(started);
    if (target === state.archive) {
      outcome = "no change";
    } else {
      view.step("Downloading the new version…");
      const timings: Timings = { connectMs, resolveMs };
      let t = performance.now();
      const result = await s.fetchArchive(target, {
        maxBytes: maxArchiveBytes(),
        onProgress: (done, total, unit) => view.progress(done, total, unit),
      });
      timings.downloadMs = since(t);
      view.step("Installing…");
      const installed = await installArchive({
        origin: location.origin,
        link,
        archive: target,
        blake3: result.blake3,
        bytes: result.bytes,
        records: result.chunks,
        timings,
        startedAt: started,
      });
      installed.lastCheck = { at: now, ms: checkMs, outcome: "new version installed" };
      await writeState(location.origin, installed);
      resetReloadGuard();
      guardedReload(link, root);
      return;
    }
  } catch (e) {
    console.warn("[autonomi-loader] update check failed", e);
    outcome = e instanceof BudgetError ? "timed out" : `failed: ${describeError(e).message}`;
    // Next check is due after CHECK_RETRY_MS rather than a full interval.
    checkedAt = now - CHECK_INTERVAL_MS + CHECK_RETRY_MS;
  } finally {
    source?.close();
  }
  await writeState(location.origin, {
    ...state,
    checkedAt,
    lastCheck: { at: now, ms: since(started), outcome },
  });
  guardedReload(link, root);
}

// ---------------------------------------------------------------------------------------------
// Info page (spec 3.6)

async function info(link: SiteLink, label: string, status?: string): Promise<void> {
  const stored = await readState(location.origin);
  const state = stored && sameLink(stored.link, link) ? stored : null;
  const source = import.meta.env.VITE_SOURCE === "fixture" ? "fixture (test files over HTTP)" : "Autonomi mainnet";
  showInfo({
    link,
    label,
    state,
    sourceName: source,
    status,
    onCheck: async () => {
      if (state) await writeState(location.origin, { ...state, checkedAt: 0 });
      resetReloadGuard();
      location.assign("/");
    },
    onClear: async () => {
      for (const name of await caches.keys()) await caches.delete(name);
      const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
      await Promise.all(regs.map((r) => r.unregister()));
      resetReloadGuard();
      await info(link, label, "Cleared. Opening the site will download it again.");
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Landing page (root domain)

interface FixtureIndex {
  [name: string]: { kind: "i" | "p"; address: string; listed?: boolean };
}

async function loadFixtures(root: string): Promise<{ name: string; href: string }[] | undefined> {
  if (import.meta.env.VITE_SOURCE !== "fixture") return undefined;
  try {
    const res = await fetch("/_autonomi/fixtures/index.json", { cache: "no-store" });
    if (!res.ok || !(res.headers.get("Content-Type") ?? "").includes("json")) return undefined;
    const index = (await res.json()) as FixtureIndex;
    return Object.entries(index)
      .filter(([, f]) => f.listed !== false)
      .map(([name, f]) => ({
        name,
        href: siteOrigin({ kind: f.kind, address: f.address }, root, location.protocol, location.port) + "/",
      }));
  } catch {
    return undefined;
  }
}

async function landing(url: URL, root: string): Promise<void> {
  const formTarget = pathFormTarget(url, root);
  if (formTarget) {
    location.replace(formTarget);
    return;
  }

  const open = url.searchParams.get("open");
  if (open !== null) {
    const parsed = parseAddressInput(open, root);
    if ("link" in parsed) {
      location.replace(siteOrigin(parsed.link, root, location.protocol, location.port) + parsed.rest);
      return;
    }
  }

  const options = (fixtures?: { name: string; href: string }[]) => ({
    onOpen(input: string, rawHexIsPointer: boolean): string | null {
      const parsed = parseAddressInput(input, root, rawHexIsPointer ? "p" : "i");
      if ("error" in parsed) return parsed.error;
      location.assign(siteOrigin(parsed.link, root, location.protocol, location.port) + parsed.rest);
      return null;
    },
    fixtures,
    canRegisterHandler: typeof navigator.registerProtocolHandler === "function",
    onRegisterHandler() {
      try {
        navigator.registerProtocolHandler("web+ant", `${location.origin}/?open=%s`);
      } catch (e) {
        console.warn("[autonomi-loader] registerProtocolHandler failed", e);
      }
    },
  });

  showLanding(options());
  const fixtures = await loadFixtures(root);
  if (fixtures?.length) {
    // Re-render with the list, keeping whatever was typed.
    const typed = document.querySelector<HTMLInputElement>("input[name=address]")?.value ?? "";
    showLanding(options(fixtures));
    const input = document.querySelector<HTMLInputElement>("input[name=address]");
    if (input) input.value = typed;
  }
}

// ---------------------------------------------------------------------------------------------
// Boot

async function boot(): Promise<void> {
  const url = new URL(location.href);
  const host = classifyHost(location.hostname, CONFIGURED_ROOT);

  if (host.view === "landing") return landing(url, host.root);

  if (host.view === "bad-label") {
    showError("Not a valid site address", host.reason, [homeAction(host.root)]);
    return;
  }

  const { link, label, root } = host;

  // Portable links, when the worker isn't active yet (spec 3.5).
  const go = goLinkTarget(url, root);
  if (go) {
    location.replace(go);
    return;
  }
  if (url.pathname === "/_autonomi" || url.pathname === "/_autonomi/") return info(link, label);
  if (url.pathname.startsWith("/_autonomi/")) {
    showError("Not found", "This path belongs to the loader and has nothing here.", [homeAction(root)], link);
    return;
  }

  try {
    await registerWorker();
  } catch (e) {
    showError("The loader can't run here", e instanceof Error ? e.message : String(e), [homeAction(root)], link);
    return;
  }

  const state = await readState(location.origin);
  if (!state || !sameLink(state.link, link)) return install(link, root);
  if (checkDue(state, Date.now())) return updateCheck(state, link, root);
  // Installed and current, yet the host answered: a hard reload, or the worker wasn't
  // controlling this page yet. One ordinary reload hands over to the worker.
  guardedReload(link, root);
}

boot().catch((e) => {
  console.error("[autonomi-loader] boot failed", e);
  showError("Something went wrong", e instanceof Error ? e.message : String(e));
});
