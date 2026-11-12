// The download page: /f/ant/<address>?n=<name>&s=<size>. Autonomirror's download page, as an
// Antnet site (DEMO.md 3.6). The page connects to Autonomi as it opens, checks the file and the
// removal list, then fetches and verifies the file in the browser when Download is pressed.

import { getBrowserCapabilities, saveDownload, type AutonomiClient, type ProgressEvent } from "@withautonomi/ant-browser-sdk";
import {
  canStreamToDisk,
  closeClient,
  connectedClient,
  describeError,
  getClient,
  MAX_BUFFERED_DOWNLOAD_BYTES,
  tooLargeHere,
  type FriendlyError,
} from "./lib/client";
import { drawConstellation, type Constellation } from "./lib/constellation";
import { formatBytes, formatExactBytes } from "./lib/format";
import { parseDownloadPath, type DownloadParams } from "./lib/params";
import { chunkCountFromMessage, readProgress } from "./lib/progress";
import { isListed, loadRemovals, type RemovalStatus } from "./lib/removals";
import { $, applyState, bindCopy, setText } from "./lib/ui";

/** The removal list's pointer, written into the page when the site is built; empty for none. */
const REMOVALS_POINTER = document.querySelector<HTMLMetaElement>('meta[name="removals-pointer"]')?.content ?? "";

type State = "invalid" | "connecting" | "ready" | "downloading" | "done" | "blocked" | "error";

const PHONE_WARN_BYTES = 300_000_000;
const MAX_GRID_CELLS = 96;

const FEATURE_NAMES: Record<string, string> = {
  window: "a browser window",
  secureContext: "a secure (HTTPS) connection",
  webAssembly: "WebAssembly",
  webRtc: "WebRTC",
  crypto: "Web Crypto",
  blob: "Blob support",
  document: "a document",
  objectUrls: "object URLs",
  readableStream: "streams",
};

const app = $("app");
let state: State = "connecting";
let params: DownloadParams;
/** Verified size from the DataMap, once known. */
let verifiedSize: number | undefined;
let chunkTotal: number | undefined;
let controller: AbortController | null = null;
let constellation: Constellation | undefined;
/** Where to resume after an error: reconnect, re-check the file, or just re-enable the button. */
let retryAction: "connect" | "verify" | "download" = "connect";
/** The removal list, read once per page while the file is checked. */
let removals: Promise<RemovalStatus> | null = null;

function setState(next: State): void {
  state = next;
  applyState(app, next);
}

// ------------------------------------------------------------------ boot

const parsed = parseDownloadPath(location.pathname, location.search);
if (!parsed.ok) {
  setText(
    $("invalid-reason"),
    parsed.reason === "missing-address"
      ? "The link is missing an Autonomi address. Ask whoever shared it for a fresh link, or make your own button."
      : "The address in this link isn't a valid Autonomi address (64 hexadecimal characters). It may have been cut off when it was copied.",
  );
  document.title = "Invalid link · Download";
  setState("invalid");
} else {
  params = parsed.params;
  renderFileCard();
  const caps = getBrowserCapabilities();
  if (!caps.operations.download.available) {
    const missing = caps.operations.download.missing.map((f) => FEATURE_NAMES[f] ?? f);
    showBlocked(
      "Your browser can't download from Autonomi",
      `This page needs ${listJoin(missing)}, which ${missing.length === 1 ? "isn't" : "aren't"} available here. Try an up-to-date Chrome, Edge, Firefox or Safari.`,
    );
  } else {
    connect();
  }
}

function renderFileCard(): void {
  const { address, name } = params;
  document.title = `${name} · Download`;
  setText($("file-name"), name);
  const ext = /\.([a-z0-9]{1,5})$/i.exec(name)?.[1];
  setText($("file-ext"), (ext ?? "file").toUpperCase());
  $("file-ext").classList.toggle("is-long", (ext?.length ?? 4) > 3);

  setText($("address-full"), address);
  bindCopy($<HTMLButtonElement>("copy-address"), () => address);

  renderSize();
  constellation = drawConstellation($("constellation") as unknown as SVGSVGElement, address);
}

function renderSize(): void {
  const size = verifiedSize ?? params.size;
  const sizeEl = $("file-size");
  setText(sizeEl, size === undefined ? "Size unknown" : formatBytes(size));
  sizeEl.title = size === undefined ? "" : formatExactBytes(size);

  const badge = $("size-badge");
  badge.hidden = size === undefined && verifiedSize === undefined;
  badge.classList.toggle("is-verified", verifiedSize !== undefined);
  setText(badge, verifiedSize !== undefined ? "✓ verified" : "from link");
  badge.title =
    verifiedSize !== undefined
      ? "Size read from the file's verified DataMap on the network"
      : "Size given in the link; it will be checked against the network";

  const chunks = $("chunk-meta");
  chunks.hidden = chunkTotal === undefined;
  if (chunkTotal !== undefined) setText(chunks, `${chunkTotal} encrypted chunk${chunkTotal === 1 ? "" : "s"}`);

  setText($("download-meta"), size === undefined ? "" : `· ${formatBytes(size, { compact: true })}`);
}

// ------------------------------------------------------------------ connect + verify

function onConnectProgress(e: ProgressEvent): void {
  if (state !== "connecting") return;
  if (e.phase === "initializing") setStatus("connecting", "Connecting to the Autonomi network…", "Starting the Autonomi engine in your browser");
  else if (e.phase === "connecting") setStatus("connecting", "Connecting to the Autonomi network…", `${e.message}…`);
}

async function connect(): Promise<void> {
  setState("connecting");
  setStatus("connecting", "Connecting to the Autonomi network…", "The first connection can take a few seconds.");
  setButton("connecting");
  try {
    const client = await getClient(onConnectProgress);
    if (state !== "connecting") return;
    // Read the removal list alongside the file check. It never holds the file back for long:
    // without it after REMOVALS_BUDGET_MS, the page carries on (it never fails closed).
    removals ??= loadRemovals(client, REMOVALS_POINTER).then((status) => {
      app.dataset.removals = status.state;
      void refuseIfListed(status);
      return status;
    });
    setState("ready");
    setButton("ready");
    void verify(client);
  } catch (err) {
    showError(describeError(err), "connect");
  }
}

/** Read the verified size from the DataMap without downloading the file. */
async function verify(client: AutonomiClient): Promise<void> {
  setStatus("checking", "Connected", "Finding the file on the network…");
  let reader;
  try {
    reader = await client.openFile(params.address, {
      onProgress: (e) => {
        const n = chunkCountFromMessage(e.message);
        if (n !== undefined) chunkTotal = n;
      },
    });
  } catch (err) {
    // A download already started takes precedence over a failed pre-check.
    if (state === "ready") showError(describeError(err), "verify");
    return;
  }
  verifiedSize = reader.size;
  reader.close();
  renderSize();
  if (state !== "ready") return;

  if (tooLargeHere(verifiedSize)) {
    showTooLarge(verifiedSize);
    return;
  }
  // Streamed saves don't hold the file in memory.
  $("memory-warning").hidden = !(!canStreamToDisk() && isPhone() && verifiedSize > PHONE_WARN_BYTES);
  setStatus("ready", "Ready to download", "Found the file and verified its DataMap.");
}

// ------------------------------------------------------------------ the removal list

/** Whether this file is on the list. Waits for the list; false if there is none or it can't be read. */
async function listed(): Promise<boolean> {
  const status = await (removals ?? Promise.resolve<RemovalStatus>({ state: "none" }));
  return status.state === "loaded" && (await isListed(status.list, params.address));
}

/** Once the list has arrived, refuse a listed file before anyone presses Download. */
async function refuseIfListed(status: RemovalStatus): Promise<void> {
  if (status.state !== "loaded" || !(await isListed(status.list, params.address))) return;
  if (state === "ready" || state === "error") showRemoved();
}

function showRemoved(): void {
  controller?.abort();
  showBlocked(
    "This file isn't available here",
    "It has been removed from this download page, for example after a copyright notice or a report of harmful content. This page and its buttons won't serve it.",
  );
}

function isPhone(): boolean {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return (memory !== undefined && memory <= 4) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

// ------------------------------------------------------------------ download

$("download-btn").addEventListener("click", startDownload);
$("again-btn").addEventListener("click", startDownload);
$("retry-btn").addEventListener("click", retry);
$("cancel-btn").addEventListener("click", () => controller?.abort());
bindCopy($<HTMLButtonElement>("copy-hash"), () => $("done-hash").textContent ?? "");

async function startDownload(): Promise<void> {
  const client = connectedClient();
  if (!client || state === "downloading") return;
  controller = new AbortController();
  const { signal } = controller;
  const started = performance.now();
  $("cancelled-note").hidden = true;
  setState("downloading");
  resetProgress();
  const onProgress = (e: ProgressEvent) => renderProgress(e, started);
  try {
    if (canStreamToDisk()) {
      // Ask where to save first, while the click still counts as a user action: nothing may be
      // awaited before the save window opens. Choosing a place doesn't create the file yet.
      const handle = await chooseDestination(params.name);
      if (await waitForList()) return showRemoved();
      const saved = await client.streamAndSave(params.address, { suggestedName: params.name, signal, onProgress, fileHandle: handle });
      verifiedSize = saved.bytesWritten;
      renderSize();
      showDone(saved.hash, "file-picker", saved.name, saved.bytesWritten, performance.now() - started);
    } else {
      // Browsers without a save window hold the file in memory, so the list is checked before
      // the finished file is handed to the browser's downloads.
      const download = await client.download(params.address, { signal, onProgress });
      if (await waitForList()) return showRemoved();
      const save = await saveDownload(download, { suggestedName: params.name, useFilePicker: false, signal });
      verifiedSize = download.bytes.byteLength;
      chunkTotal = download.file.chunks.length || chunkTotal;
      renderSize();
      showDone(download.hash, save.method, save.name, download.bytes.byteLength, performance.now() - started);
    }
  } catch (err) {
    if (state === "blocked") return;
    // Clicked before the size check finished, on a file too large to hold in memory.
    const size = verifiedSize ?? params.size;
    if (size !== undefined && tooLargeHere(size)) {
      showTooLarge(size);
      return;
    }
    const info = describeError(err);
    if (info.cancelled) {
      setState("ready");
      setButton("ready");
      $("cancelled-note").hidden = false;
      return;
    }
    showError(info, info.connection || info.code === "CLIENT_CLOSED" ? "connect" : "download");
  } finally {
    controller = null;
  }
}

/** The browser's save window (Chrome and Edge). Cancelling it rejects with an AbortError. */
function chooseDestination(suggestedName: string): Promise<FileSystemFileHandle> {
  const w = window as unknown as { showSaveFilePicker(o: { suggestedName: string }): Promise<FileSystemFileHandle> };
  return w.showSaveFilePicker({ suggestedName });
}

/** Wait for the removal list if it hasn't arrived yet, saying so. True if this file is on it. */
async function waitForList(): Promise<boolean> {
  let pending = true;
  const note = setTimeout(() => {
    if (!pending) return;
    setText($("progress-title"), "Checking the list of removed files…");
    setText($("progress-message"), "This page doesn't serve files that have been removed from it.");
  }, 300);
  try {
    return await listed();
  } finally {
    pending = false;
    clearTimeout(note);
  }
}

function resetProgress(): void {
  setText($("progress-title"), "Finding the file…");
  setText($("progress-percent"), "");
  setText($("progress-message"), "Starting…");
  $("progress-bar").classList.add("is-indeterminate");
  $("progress-bar").removeAttribute("aria-valuenow");
  $("bar-fill").style.width = "0%";
  buildGrid(chunkTotal);
}

let gridTotal = 0;
function buildGrid(total: number | undefined): void {
  const grid = $("chunk-grid");
  gridTotal = total ?? 0;
  const cells = Math.min(gridTotal, MAX_GRID_CELLS);
  grid.hidden = cells === 0;
  // The chunk grid replaces the plain bar once the chunk count is known.
  $("progress-bar").hidden = cells > 0;
  grid.classList.toggle("is-dense", cells > 24);
  grid.replaceChildren(...Array.from({ length: cells }, () => document.createElement("span")));
  grid.style.setProperty("--cols", String(Math.min(cells, 24)));
}

function paintGrid(completed: number): void {
  const cells = $("chunk-grid").children;
  if (!cells.length) return;
  const lit = Math.round((completed / gridTotal) * cells.length);
  for (let i = 0; i < cells.length; i++) cells[i].classList.toggle("on", i < lit);
}

function renderProgress(e: ProgressEvent, started: number): void {
  // "complete" messages use the SDK's generated file name; the done state follows anyway.
  if (state !== "downloading" || e.status !== "running" || e.phase === "complete") return;
  const p = readProgress(e);
  const bar = $("progress-bar");

  // A streamed save reports its progress as bytes saved, handled below with the other byte counts.
  if (e.phase === "saving" && p.unit !== "bytes") {
    setText($("progress-title"), "Saving…");
    setText($("progress-message"), e.message.startsWith("Choosing") ? "Choose where to save the file" : "Writing the file");
    return;
  }

  if (p.fraction === undefined || p.total === undefined || p.completed === undefined) {
    // Opening messages name the SDK's generated file name, not the one in the link.
    if (e.phase === "opening") {
      setText($("progress-title"), "Finding the file…");
      setText($("progress-message"), "Reading its DataMap from the network");
    } else setText($("progress-message"), p.message);
    return;
  }

  if (p.unit === "records") {
    if (p.total !== gridTotal) buildGrid(p.total);
    paintGrid(p.completed);
    if (p.completed > 0) constellation?.spark();
    setText($("progress-title"), "Fetching chunks");
    setText($("progress-message"), `Fetched ${p.completed} of ${p.total} chunk${p.total === 1 ? "" : "s"}`);
  } else {
    // Streamed saves only report bytes, so light the chunk grid in proportion.
    if (gridTotal > 0) paintGrid(p.fraction * gridTotal);
    if (e.phase === "saving") setText($("progress-title"), "Downloading and saving");
    setText($("progress-message"), `${formatBytes(p.completed)} of ${formatBytes(p.total)}`);
  }

  const pct = Math.round(p.fraction * 100);
  bar.classList.remove("is-indeterminate");
  bar.setAttribute("aria-valuenow", String(pct));
  $("bar-fill").style.width = `${pct}%`;
  const size = verifiedSize ?? params.size;
  const secs = (performance.now() - started) / 1000;
  const rate = size && secs > 1 && p.fraction > 0 ? ` · ${formatBytes((size * p.fraction) / secs, { compact: true })}/s` : "";
  setText($("progress-percent"), `${pct}%${rate}`);
}

function showDone(hash: string, method: "file-picker" | "download", savedName: string, bytes: number, ms: number): void {
  setText($("done-hash"), hash);
  setText(
    $("done-saved"),
    method === "file-picker" ? `${savedName}, where you chose` : `${savedName}, in your browser's downloads`,
  );
  setText($("done-size"), `${formatBytes(bytes)} in ${(ms / 1000).toFixed(1)} s`);
  $("done-size").title = formatExactBytes(bytes);
  setState("done");
}

// ------------------------------------------------------------------ status / errors

function setStatus(kind: "connecting" | "checking" | "ready", title: string, detail: string): void {
  const indicator = $("status-indicator");
  indicator.className = `status-indicator is-${kind}`;
  indicator.replaceChildren(kind === "ready" ? dot() : spinner());
  setText($("status-title"), title);
  setText($("status-detail"), detail);
}

function setButton(mode: "connecting" | "ready"): void {
  const btn = $<HTMLButtonElement>("download-btn");
  btn.disabled = mode !== "ready";
  $("download-spinner").hidden = mode === "ready";
  setText($("download-label"), mode === "ready" ? "Download" : "Connecting…");
}

function showBlocked(title: string, text: string, appLink = false): void {
  setText($("blocked-title"), title);
  setText($("blocked-text"), text);
  $("blocked-app").hidden = !appLink;
  setState("blocked");
}

function showTooLarge(size: number): void {
  showBlocked(
    "This file is too large for this browser",
    `It's ${formatBytes(size)}. This browser can download files up to ${formatBytes(MAX_BUFFERED_DOWNLOAD_BYTES)} from Autonomi. Open this page in Chrome or Edge on a computer, which can save larger files straight to disk, or download it with the Autonomi App using the file's address (copy it above).`,
    true,
  );
}

function showError(info: FriendlyError, action: typeof retryAction): void {
  retryAction = action;
  const copy = errorCopy(info, action);
  setText($("error-title"), copy.title);
  setText($("error-text"), copy.text);
  setText($("error-code"), info.code);
  $("error-code").title = info.message;
  $("error-network").hidden = !(action === "connect" || info.connection);
  setText($("retry-btn"), action === "connect" ? "Reconnect" : "Try again");
  setState("error");
}

function errorCopy(info: FriendlyError, action: typeof retryAction): { title: string; text: string } {
  if (action === "connect") {
    return { title: "Couldn't reach the Autonomi network", text: "Your browser couldn't connect to any Autonomi nodes." };
  }
  // Once the file has been found, a streamed read failure is a missing chunk, not a bad address.
  const code = action === "download" && verifiedSize !== undefined && info.code === "OPEN_FILE_FAILED" ? "DOWNLOAD_FAILED" : info.code;
  switch (code) {
    case "OPEN_FILE_FAILED":
    case "LOOKUP_FAILED":
      return {
        title: "Couldn't find this file on the network",
        text: "The address may be mistyped, or it may point to an archive (folder) or private file rather than a public file. It can also be a temporary network problem.",
      };
    case "DOWNLOAD_FAILED":
      return { title: "The download didn't finish", text: "Some chunks couldn't be fetched or verified. This is often temporary, so try again." };
    case "SAVE_FAILED":
      // streamAndSave throws this before any download when the browser won't open the save window.
      if (/save picker|save destination/i.test(info.message)) {
        return { title: "The save window didn't open", text: "Your browser didn't let this page ask where to save the file. Click Download again." };
      }
      return { title: "The file couldn't be saved", text: "It downloaded, but your browser couldn't write it. Check you have space and permission to save there." };
    default:
      return { title: "Something went wrong", text: info.message };
  }
}

async function retry(): Promise<void> {
  if (retryAction === "connect") {
    closeClient();
    return connect();
  }
  const client = connectedClient();
  if (!client) return connect();
  if (retryAction === "download") return startDownload(); // still a user gesture
  setState("ready");
  setButton("ready");
  void verify(client);
}

function spinner(): HTMLElement {
  const s = document.createElement("span");
  s.className = "spinner";
  return s;
}
function dot(): HTMLElement {
  const s = document.createElement("span");
  s.className = "status-dot";
  return s;
}
function listJoin(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

// ------------------------------------------------------------------ lifecycle

window.addEventListener("pagehide", () => {
  controller?.abort();
  closeClient();
});
window.addEventListener("pageshow", (e) => {
  // Restored from the back/forward cache after pagehide closed the client.
  if (e.persisted && parsed.ok && state !== "blocked") connect();
});
