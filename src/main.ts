// Boot: choose the landing, install, update-check, info or error view (spec 3, 3.4, 3.6).

import "./ui/style.css";
import {
  CHECK_INTERVAL_MS,
  CHECK_PATH,
  CHECK_RETRY_MS,
  MAX_AUTO_RELOADS,
  RELOAD_WINDOW_MS,
  DOOR_PATH,
  SW_PATH,
  backgroundBudgetMs,
  maxArchiveBytes,
} from "./config";
import {
  type HostInfo,
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
import { WARM_PATH, warmReporter } from "./warm";
import { createSource } from "./source";
import { type SiteSource, SourceError } from "./source/types";
import { type SiteState, type Timings, checkDue, clearState, readState, sameLink, writeState } from "./state";
import { TarError } from "./tar";
import { formatBytes } from "./ui/dom";
import { type LandingOptions, showError, showFrontDoor, showInfo, showLanding, showLoading } from "./ui/views";


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

/** What an update check found. */
interface CheckResult {
  outcome: string;
  /** A new version was installed. */
  changed: boolean;
  /** The site's name was removed from the directory; the site is no longer installed. */
  removed: boolean;
}

/**
 * One update check, with no UI (DEMO.md 5.3). For a named site, re-read the directory first
 * (a quick request to the host): a changed entry installs what it now points to, a removed
 * name uninstalls the site. Then, for a pointer, read the pointer within the time budget and
 * install the new archive if it moved. Records the outcome in the state record either way.
 */
async function checkForUpdate(state: SiteState, budgetMs: number): Promise<CheckResult> {
  const started = performance.now();
  const now = Date.now();
  let current = state;
  const record = async (outcome: string, checkedAt = now): Promise<CheckResult> => {
    await writeState(location.origin, { ...current, checkedAt, lastCheck: { at: now, ms: since(started), outcome } });
    return { outcome, changed: false, removed: false };
  };
  // After a failure the next check is due after CHECK_RETRY_MS rather than a full interval.
  const failed = (outcome: string) => record(outcome, now - CHECK_INTERVAL_MS + CHECK_RETRY_MS);
  const installed = async (): Promise<CheckResult> => {
    const fresh = await readState(location.origin);
    if (fresh) {
      await writeState(location.origin, { ...fresh, lastCheck: { at: now, ms: since(started), outcome: "new version installed" } });
    }
    return { outcome: "new version installed", changed: true, removed: false };
  };

  if (state.name) {
    let entry: NameEntry | undefined;
    try {
      entry = (await fetchNames()).get(state.name);
    } catch (e) {
      console.warn("[autonomi-loader] name check failed", e);
      return failed(`failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!entry) {
      // The name was removed from the directory: stop serving what it used to lead to.
      await deleteOtherSiteCaches(null);
      await clearState(location.origin);
      return { outcome: "name removed", changed: false, removed: true };
    }
    current = { ...state, nameSince: entry.since };
    if (!sameLink(entry, state.link)) {
      // The name leads somewhere else now: install that, whatever kind of link it is.
      const ok = await new Promise<string | null>((resolve) => {
        void install({ kind: entry.kind, address: entry.address }, location.hostname, { name: state.name!, since: entry.since }, {
          step: () => {},
          progress: () => {},
          done: () => resolve(null),
          fail: (title, message) => resolve(`${title}: ${message}`),
        });
      });
      return ok === null ? installed() : failed(`failed: ${ok}`);
    }
    if (state.link.kind === "i") return record("no change");
  }

  let source: SiteSource | null = null;
  try {
    source = await createSource();
    const s = source;
    let connectMs: number | undefined;
    let resolveMs: number | undefined;
    const target = await withBudget(budgetMs, async (signal) => {
      let t = performance.now();
      await s.connect?.(signal);
      connectMs = since(t);
      t = performance.now();
      const found = await s.resolvePointer(state.link.address, signal);
      resolveMs = since(t);
      return found;
    });
    if (target === state.archive) return record("no change");
    const timings: Timings = { connectMs, resolveMs };
    const t = performance.now();
    const result = await s.fetchArchive(target, { maxBytes: maxArchiveBytes() });
    timings.downloadMs = since(t);
    await installArchive({
      origin: location.origin,
      link: state.link,
      name: current.name,
      nameSince: current.nameSince,
      archive: target,
      blake3: result.blake3,
      bytes: result.bytes,
      records: result.chunks,
      recordList: result.recordList,
      arrivals: result.arrivals,
      timings,
      startedAt: started,
    });
    return installed();
  } catch (e) {
    console.warn("[autonomi-loader] update check failed", e);
    return failed(e instanceof BudgetError ? "timed out" : `failed: ${describeError(e).message}`);
  } finally {
    source?.close();
  }
}

/**
 * The background check (DEMO.md 5.3), at /_autonomi/check in a hidden frame on the site's own
 * origin. The loader's script in the site's pages (/_autonomi/check.js, added by the service
 * worker) opens it once the page has loaded. Being same-origin, it shares the site's storage
 * in every browser. It reports to the page, which offers a reload when there is a new version.
 */
async function backgroundCheck(): Promise<void> {
  const post = (status: string, outcome?: string) => {
    if (window.parent !== window) window.parent.postMessage({ type: "antnet:check", status, outcome }, location.origin);
  };
  const state = await readState(location.origin);
  if (!state) return post("not-installed");
  if (!checkDue(state, Date.now())) return post("not-due");
  const r = await checkForUpdate(state, backgroundBudgetMs());
  post(r.removed ? "removed" : r.changed ? "updated" : "no-change", r.outcome);
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
    // Installed, yet the host answered (a hard reload, or the worker wasn't in control yet):
    // one ordinary reload hands over to the worker. Updates are checked in the background.
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
      if (!state) return;
      const r = await checkForUpdate(state, backgroundBudgetMs());
      const what = r.removed
        ? "The name has been removed from the directory, so this site is no longer installed here."
        : r.changed
          ? "A new version was found and installed. Open the site to see it."
          : `Checked: ${r.outcome}.`;
      await info(ident, label, what);
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

/** What the address box, the handler offer and the site lists need, on any loader page. */
function landingOptions(root: string, fixtures?: { name: string; href: string }[], notice?: string): LandingOptions {
  return {
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
        navigator.registerProtocolHandler("web+ant", `${rootUrl(root)}?open=%s`);
      } catch (e) {
        console.warn("[autonomi-loader] registerProtocolHandler failed", e);
      }
    },
  };
}

/** The named sites, as links on this loader. Empty when there is no directory. */
async function namedSites(root: string): Promise<{ names: string[]; named: { name: string; href: string }[] }> {
  let names: string[] = [];
  try {
    names = [...(await fetchNames()).keys()];
  } catch {
    // No directory: no list of sites.
  }
  return { names, named: names.map((name) => ({ name, href: nameOrigin(name, root, location.protocol, location.port) + "/" })) };
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

  const { names, named } = await namedSites(root);

  // The front door (DEMO.md 5.1): the bare root goes to Start's own front door, which fetches
  // Start while the visitor reads. ?landing (or a loader without Start) shows the address page.
  if (url.pathname === "/" && !url.search && !notice && names.includes(START_NAME)) {
    location.replace(nameOrigin(START_NAME, root, location.protocol, location.port) + DOOR_PATH);
    return;
  }
  showLanding({ ...landingOptions(root, await loadFixtures(root), notice), named });
}

/** The site the bare root leads to, through its front door. */
const START_NAME = "start";

/**
 * A site's front door (DEMO.md 5.1), at <site>/_autonomi/door: the story of what is about to
 * happen, shown while the site installs on its own origin. No frame is involved, so it works
 * the same in every browser. Enter opens the site, at once once it has arrived; pressed early,
 * it opens the site as soon as it arrives. The door replaces itself in the history, so Back
 * from the site doesn't return to it.
 */
async function door(host: Extract<HostInfo, { view: "site" | "name" }>): Promise<void> {
  const { root } = host;
  const enterSite = () => location.replace("/");
  try {
    await registerWorker();
  } catch (e) {
    showError("The loader can't run here", e instanceof Error ? e.message : String(e), [homeAction(root)]);
    return;
  }

  // Already here: straight in.
  const state = await readState(location.origin);
  const here = host.view === "name" ? state?.name === host.name : !!state && !state.name && sameLink(state.link, host.link);
  if (here) return enterSite();

  let link: SiteLink;
  let named: Named | undefined;
  if (host.view === "name") {
    let entry: NameEntry | undefined;
    try {
      entry = (await fetchNames()).get(host.name);
    } catch (e) {
      showError("The name directory couldn't be read", e instanceof Error ? e.message : String(e), [
        { label: "Try again", run: () => location.reload() },
        homeAction(root),
      ]);
      return;
    }
    if (!entry) return unknownName(host.name, root);
    link = { kind: entry.kind, address: entry.address };
    named = { name: host.name, since: entry.since };
  } else {
    link = host.link;
  }

  const sites = await namedSites(root);
  let ready = false;
  let entered = false;
  let failed = false;
  const view = showFrontDoor({
    ...landingOptions(root, await loadFixtures(root)),
    named: sites.named.filter((s) => s.name !== named?.name),
    siteLabel: named?.name === START_NAME ? "Antnet Start" : (named?.name ?? "this site"),
    onEnter() {
      if (failed) return location.reload();
      if (ready) return enterSite();
      entered = true;
      view.report({ status: "working", step: "Opening as soon as it arrives…" });
    },
  });

  await install(link, root, named, {
    step: (text) => view.report({ status: "working", step: text }),
    progress: (done, total, unit) => view.report({ status: "working", done, total, unit }),
    done() {
      ready = true;
      resetReloadGuard();
      if (entered) return enterSite();
      view.report({ status: "ready" });
    },
    fail(title, message) {
      failed = true;
      view.report({ status: "error", error: title, step: message });
    },
  });
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
  if (url.pathname === DOOR_PATH) return door(host);
  if (url.pathname === CHECK_PATH) return backgroundCheck();
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
  // Installed and current, yet the host answered: a hard reload, or the worker wasn't
  // controlling this page yet. One ordinary reload hands over to the worker.
  guardedReload(link, root);
}

boot().catch((e) => {
  console.error("[autonomi-loader] boot failed", e);
  showError("Something went wrong", e instanceof Error ? e.message : String(e));
});
