// Warm-up (DEMO.md 5.2): install a site before the visitor clicks it.
//
// A page on the loader (the front door, or a site such as Start) embeds a hidden frame at
// <site>/_autonomi/warm. In that frame the shell installs the site as usual but doesn't
// reload into it; it reports progress to the page that embedded it. When the visitor then
// opens the site, the service worker already has it, so it appears at once.
//
// Messages, both ways through postMessage:
//   parent -> frame  { type: "antnet:hello" }   asks for the latest report; sent until answered
//   frame  -> parent { type: "antnet:warm", site, status, step?, done?, total?, unit?, error? }
// The frame only answers a parent on this loader (its root domain or a site under it), and
// only the window that embedded it. The parent only listens to the frame it created.
//
// Why it can work: every site is a subdomain of the loader's registrable domain, so a frame
// and a later top-level visit to the same site share storage. If a browser keeps framed
// storage apart anyway, the warm-up just doesn't help there; nothing breaks.

export const WARM_PATH = "/_autonomi/warm";

export type WarmStatus = "working" | "ready" | "error";

export interface WarmReport {
  status: WarmStatus;
  /** The current step, in words, or the error message. */
  step?: string;
  done?: number;
  total?: number;
  unit?: "bytes" | "records";
  /** A short error title, when status is "error". */
  error?: string;
}

export interface WarmMessage extends WarmReport {
  type: "antnet:warm";
  /** The host that was warmed. */
  site: string;
}

/** Whether `origin` is this loader: the root itself or a site under it, same scheme and port. */
export function isLoaderOrigin(origin: string, root: string, protocol: string, port: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== protocol || url.port !== port) return false;
  const host = url.hostname.toLowerCase();
  return host === root || host.endsWith("." + root);
}

// ---------------------------------------------------------------------------------------------
// Frame side

export interface WarmReporter {
  update(report: Partial<WarmReport>): void;
}

/**
 * Report this frame's progress to the loader page that embedded it. Keeps the latest report
 * and sends it on every hello, so a parent that asks late still gets the outcome.
 */
export function warmReporter(root: string): WarmReporter {
  let latest: WarmReport = { status: "working", step: "Starting…" };
  let parent: { win: Window; origin: string } | null = null;

  const send = () => {
    if (!parent) return;
    const msg: WarmMessage = { type: "antnet:warm", site: location.host, ...latest };
    parent.win.postMessage(msg, parent.origin);
  };

  addEventListener("message", (e: MessageEvent) => {
    if (e.source !== window.parent || window.parent === window) return;
    if ((e.data as { type?: unknown } | null)?.type !== "antnet:hello") return;
    if (!isLoaderOrigin(e.origin, root, location.protocol, location.port)) return;
    parent = { win: e.source as Window, origin: e.origin };
    send();
  });

  return {
    update(report) {
      // A new step clears the previous step's counts.
      latest = report.step !== undefined && report.done === undefined ? { ...latest, done: undefined, total: undefined, unit: undefined } : latest;
      latest = { ...latest, ...report };
      send();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Parent side (used by the loader's own pages; demo sites carry the same few lines in plain JS)

/**
 * Warm a site in a hidden frame. `url` is the site's warm path, directly or through a portable
 * link. Calls `onReport` for each report; returns a function that removes the frame.
 */
export function warmInFrame(url: string, onReport: (report: WarmMessage) => void): () => void {
  const frame = document.createElement("iframe");
  frame.className = "warm-frame";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.title = "Fetching a site in the background";
  frame.src = url;

  let answered = false;
  const onMessage = (e: MessageEvent) => {
    if (e.source !== frame.contentWindow) return;
    const data = e.data as WarmMessage | null;
    if (data?.type !== "antnet:warm") return;
    answered = true;
    onReport(data);
  };
  addEventListener("message", onMessage);

  // The frame may redirect (a portable link) and its script starts a moment after load, so
  // keep saying hello until it answers. The hello carries nothing, so "*" is safe.
  const hello = () => frame.contentWindow?.postMessage({ type: "antnet:hello" }, "*");
  frame.addEventListener("load", hello);
  const timer = setInterval(() => (answered ? clearInterval(timer) : hello()), 500);

  document.body.append(frame);
  return () => {
    clearInterval(timer);
    removeEventListener("message", onMessage);
    frame.remove();
  };
}
