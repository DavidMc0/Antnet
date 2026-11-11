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
  nameOrigin,
  parseAddressInput,
  parseRootNamePath,
  pathFormTarget,
  siteOrigin,
  targetOrigin,
} from "./host";
import { NotASiteError, deleteOtherSiteCaches, installArchive } from "./install";
import { type NameEntry, fetchNames } from "./names";
import { WARM_PATH, type WarmMessage, warmInFrame, warmReporter } from "./warm";
import { createSource } from "./source";
import { type SiteSource, SourceError } from "./source/types";
import { type SiteState, type Timings, checkDue, clearState, readState, sameLink, writeState } from "./state";
import { TarError } from "./tar";
import { formatBytes } from "./ui/dom";
import { showError, showFrontDoor, showInfo, showLanding, showLoading } from "./ui/views";

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

/** A short name and when the directory says it was registered. */
interface Named {
  name: string;
  since?: string;
}

/** Where an install reports to: the loading screen, or (warm-up) the page that embedded it. */
interface InstallUI {
  step(text: string): void;
  progress(done: number, total?: number, unit?: "bytes" | "records"): void;
  done(): void;
  fail(title: string, message: string): void;
}

/** The ordinary install: a loading screen, then a reload into the installed site. */
function pageUI(link: SiteLink, root: string, named?: Named): InstallUI {
  const view = showLoading(
    link,
    named ? `Opening ${named.name}` : link.kind === "p" ? "Opening the latest version of a site" : "Opening a site",
  );
  return {
    step: (text) => view.step(text),
    progress: (done, total, unit) => view.progress(done, total, unit),
    done() {
      // A fresh install starts a new reload budget.
      resetReloadGuard();
      guardedReload(link, root);
    },
    fail(title, message) {
      showError(title, message, [{ label: "Try again", run: () => location.reload() }, homeAction(root)], link);
    },
  };
}

async function install(link: SiteLink, root: string, named?: Named, ui: InstallUI = pageUI(link, root, named)): Promise<void> {
  const view = ui;
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
      name: named?.name,
      nameSince: named?.since,
      archive,
      blake3: result.blake3,
      bytes: result.bytes,
      records: result.chunks,
      recordList: result.recordList,
      arrivals: result.arrivals,
      timings,
      startedAt: started,
    });
  } catch (e) {
    const { title, message } = describeError(e);
    console.error("[autonomi-loader] install failed", e);
    ui.fail(title, message);
    return;
  } finally {
    source?.close();
  }
  ui.done();
}

// ---------------------------------------------------------------------------------------------
// Warm-up (DEMO.md 5.2): install in a hidden frame and report to the page that embedded it.

async function warm(host: Extract<ReturnType<typeof classifyHost>, { view: "site" | "name" }>): Promise<void> {
  // Listen for the parent's hello before anything asynchronous.
  const reporter = warmReporter(host.root);
  showLoading(host.view === "site" ? host.link : { kind: "i", address: "0".repeat(64) }, "Fetching in the background");
  const fail = (error: string, step: string) => reporter.update({ status: "error", error, step });
  try {
    await registerWorker();
  } catch (e) {
    return fail("The loader can't run here", e instanceof Error ? e.message : String(e));
  }
  const state = await readState(location.origin);

  let link: SiteLink;
  let named: Named | undefined;
  if (host.view === "name") {
    if (state && state.name === host.name) return reporter.update({ status: "ready", step: "Already here" });
    let entry: NameEntry | undefined;
    try {
      entry = (await fetchNames()).get(host.name);
    } catch (e) {
      return fail("The name directory couldn't be read", e instanceof Error ? e.message : String(e));
    }
    if (!entry) return fail(`No site is called “${host.name}” here yet`, "");
    link = { kind: entry.kind, address: entry.address };
    named = { name: host.name, since: entry.since };
  } else {
    link = host.link;
    if (state && !state.name && sameLink(state.link, link)) return reporter.update({ status: "ready", step: "Already here" });
  }

  await install(link, host.root, named, {
    step: (text) => reporter.update({ step: text }),
    progress: (done, total, unit) => reporter.update({ done, total, unit }),
    done: () => reporter.update({ status: "ready", step: "Ready" }),
    fail: (title, message) => fail(title, message),
  });
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
        name: state.name,
        nameSince: state.nameSince,
        archive: target,
        blake3: result.blake3,
        bytes: result.bytes,
        records: result.chunks,
        recordList: result.recordList,
        arrivals: result.arrivals,
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
// Short names (DEMO.md 5.9)

function unknownName(name: string, root: string): void {
  showError(
    `No site is called “${name}” here yet`,
    "Short names come from this loader's public directory, and this one isn't in it. " +
      "Check the spelling, or open the site by its full address.",
    [homeAction(root)],
  );
}

/** Open a named site: use what is installed, or look the name up and install what it points to. */
async function openByName(name: string, state: SiteState | null, root: string): Promise<void> {
  if (state && state.name === name) {
    if (checkDue(state, Date.now())) return nameCheck(state, name, root);
    // Installed and current, yet the host answered: one ordinary reload hands over to the worker.
    return guardedReload(state.link, root);
  }
  let entry: NameEntry | undefined;
  try {
    entry = (await fetchNames()).get(name);
  } catch (e) {
    showError("The name directory couldn't be read", e instanceof Error ? e.message : String(e), [
      { label: "Try again", run: () => location.reload() },
      homeAction(root),
    ]);
    return;
  }
  if (!entry) return unknownName(name, root);
  return install({ kind: entry.kind, address: entry.address }, root, { name, since: entry.since });
}

/**
 * A due check on a named site. Re-read the directory first (an ordinary request to the host,
 * so it is quick): if the name now points somewhere else, install that. Otherwise carry on
 * with the pointer check, or for a fixed address just record that the check ran.
 */
async function nameCheck(state: SiteState, name: string, root: string): Promise<void> {
  const view = showLoading(state.link, "Checking for a new version…");
  view.step("Reading the name directory…");
  const started = performance.now();
  const now = Date.now();
  let entry: NameEntry | undefined;
  try {
    entry = (await fetchNames()).get(name);
  } catch (e) {
    console.warn("[autonomi-loader] name check failed", e);
    await writeState(location.origin, {
      ...state,
      checkedAt: now - CHECK_INTERVAL_MS + CHECK_RETRY_MS,
      lastCheck: { at: now, ms: since(started), outcome: `failed: ${e instanceof Error ? e.message : String(e)}` },
    });
    return guardedReload(state.link, root);
  }
  if (!entry) {
    // The name was removed from the directory: stop serving what it used to lead to.
    await deleteOtherSiteCaches(null);
    await clearState(location.origin);
    return unknownName(name, root);
  }
  if (!sameLink(entry, state.link)) {
    return install({ kind: entry.kind, address: entry.address }, root, { name, since: entry.since });
  }
  const current: SiteState = { ...state, nameSince: entry.since };
  if (state.link.kind === "p") return updateCheck(current, state.link, root);
  await writeState(location.origin, {
    ...current,
    checkedAt: now,
    lastCheck: { at: now, ms: since(started), outcome: "no change" },
  });
  guardedReload(state.link, root);
}

// ---------------------------------------------------------------------------------------------
// Info page (spec 3.6)

type Ident = { link: SiteLink } | { name: string };

async function info(ident: Ident, label: string, status?: string): Promise<void> {
  const stored = await readState(location.origin);
  const source = import.meta.env.VITE_SOURCE === "fixture" ? "fixture (test files over HTTP)" : "Autonomi mainnet";
  let state: SiteState | null;
  let link: SiteLink | null;
  let name: { name: string; entry: NameEntry | null | "unreadable" } | undefined;
  if ("name" in ident) {
    state = stored && stored.name === ident.name ? stored : null;
    let entry: NameEntry | null | "unreadable";
    try {
      entry = (await fetchNames()).get(ident.name) ?? null;
    } catch {
      entry = "unreadable";
    }
    name = { name: ident.name, entry };
    link = state?.link ?? (entry && entry !== "unreadable" ? { kind: entry.kind, address: entry.address } : null);
  } else {
    state = stored && !stored.name && sameLink(stored.link, ident.link) ? stored : null;
    link = ident.link;
  }
  showInfo({
    link,
    name,
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
      await info(ident, label, "Cleared. Opening the site will download it again.");
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Landing page (root domain)

interface FixtureIndex {
  /** `name` is set on fixtures that have a short name in the test directory. */
  [name: string]: { kind: "i" | "p"; address: string; listed?: boolean; name?: string };
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
        href:
          (f.name
            ? nameOrigin(f.name, root, location.protocol, location.port)
            : siteOrigin({ kind: f.kind, address: f.address }, root, location.protocol, location.port)) + "/",
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

  // <root>/<name>[/path] goes to the named site, when the directory has that name.
  let notice: string | undefined;
  const byName = parseRootNamePath(url.pathname);
  if (byName) {
    try {
      if ((await fetchNames()).has(byName.name)) {
        location.replace(
          nameOrigin(byName.name, root, location.protocol, location.port) + byName.rest + url.search + url.hash,
        );
        return;
      }
      notice = `No site is called “${byName.name}” here yet.`;
    } catch {
      notice = "The name directory couldn't be read, so this path wasn't opened.";
    }
  }

  const open = url.searchParams.get("open");
  if (open !== null) {
    const parsed = parseAddressInput(open, root);
    if (!("error" in parsed)) {
      location.replace(targetOrigin(parsed, root, location.protocol, location.port) + parsed.rest);
      return;
    }
  }

  const options = (fixtures?: { name: string; href: string }[]) => ({
    onOpen(input: string, rawHexIsPointer: boolean): string | null {
      const parsed = parseAddressInput(input, root, rawHexIsPointer ? "p" : "i");
      if ("error" in parsed) return parsed.error;
      location.assign(targetOrigin(parsed, root, location.protocol, location.port) + parsed.rest);
      return null;
    },
    fixtures,
    notice,
    canRegisterHandler: typeof navigator.registerProtocolHandler === "function",
    onRegisterHandler() {
      try {
        navigator.registerProtocolHandler("web+ant", `${location.origin}/?open=%s`);
      } catch (e) {
        console.warn("[autonomi-loader] registerProtocolHandler failed", e);
      }
    },
  });

  // The front door (DEMO.md 5.1), when this loader has a site called "start": it fetches Start
  // in the background while the visitor reads. Otherwise the plain address page.
  let names: string[] = [];
  try {
    names = [...(await fetchNames()).keys()];
  } catch {
    // No directory: no list of sites, and the plain landing page.
  }
  const named = names.map((name) => ({ name, href: nameOrigin(name, root, location.protocol, location.port) + "/" }));
  const fixtures = await loadFixtures(root);
  if (!names.includes(START_NAME)) {
    showLanding({ ...options(fixtures), named });
    return;
  }

  const startUrl = nameOrigin(START_NAME, root, location.protocol, location.port) + "/";
  const door = showFrontDoor({ ...options(fixtures), named, startHref: startUrl });
  let stop: (() => void) | null = null;
  stop = warmInFrame(startUrl.replace(/\/$/, WARM_PATH), (report: WarmMessage) => {
    door.report(report);
    // Done either way: the frame has nothing more to say.
    if (report.status !== "working") stop?.();
  });
}

/** The site the front door fetches in the background and opens with Enter. */
const START_NAME = "start";

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

  const { label, root } = host;
  const ident: Ident = host.view === "name" ? { name: host.name } : { link: host.link };
  const shownLink = host.view === "site" ? host.link : undefined;

  // Portable links, when the worker isn't active yet (spec 3.5).
  const go = goLinkTarget(url, root);
  if (go) {
    location.replace(go);
    return;
  }
  if (url.pathname === "/_autonomi" || url.pathname === "/_autonomi/") return info(ident, label);
  if (url.pathname === WARM_PATH) return warm(host);
  if (url.pathname.startsWith("/_autonomi/")) {
    showError("Not found", "This path belongs to the loader and has nothing here.", [homeAction(root)], shownLink);
    return;
  }

  try {
    await registerWorker();
  } catch (e) {
    showError("The loader can't run here", e instanceof Error ? e.message : String(e), [homeAction(root)], shownLink);
    return;
  }

  const state = await readState(location.origin);
  if (host.view === "name") return openByName(host.name, state, root);

  const link = host.link;
  if (!state || state.name || !sameLink(state.link, link)) return install(link, root);
  if (checkDue(state, Date.now())) return updateCheck(state, link, root);
  // Installed and current, yet the host answered: a hard reload, or the worker wasn't
  // controlling this page yet. One ordinary reload hands over to the worker.
  guardedReload(link, root);
}

boot().catch((e) => {
  console.error("[autonomi-loader] boot failed", e);
  showError("Something went wrong", e instanceof Error ? e.message : String(e));
});
