// The Download Button site has one page for every address, since the loader serves the same
// page (index.html) for any path it has no file for. This picks the view from the address:
//   /f/ant/<address>?n=&s=   the download page
//   /d/?a=<address>&n=&s=    Autonomirror's older link form: moved to the one above
//   anything else            the button generator
// Each view is a <template> in the page, with its own stylesheet and script, loaded only when
// it is the one shown.

import { DOWNLOAD_PREFIX, downloadPath, parseDownloadParams } from "./lib/params";
import { initThemeToggle } from "./lib/theme";

type View = "download" | "generator";

function pick(): View | null {
  const path = location.pathname;
  if (path.startsWith(DOWNLOAD_PREFIX) || path === "/f/ant" || path === "/f/" || path === "/f") return "download";
  if (path === "/d" || path === "/d/" || path === "/d/index.html") {
    const old = parseDownloadParams(location.search);
    // Old links keep working: the same file, at its address on this site. A broken old link
    // goes to the download view, which says what is wrong with it.
    location.replace(old.ok ? downloadPath(old.params) : DOWNLOAD_PREFIX);
    return null;
  }
  return "generator";
}

/** Load a view's stylesheet, so the view never shows unstyled. */
function stylesheet(href: string): Promise<void> {
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    // A missing stylesheet shouldn't stop the page working.
    link.onerror = () => resolve();
    document.head.append(link);
  });
}

async function show(view: View): Promise<void> {
  document.documentElement.dataset.view = view;
  const template = document.getElementById(`view-${view}`) as HTMLTemplateElement;
  await stylesheet(`/${view}.css`);
  document.getElementById("view")!.replaceChildren(template.content.cloneNode(true));
  // The other view isn't needed again on this page.
  document.querySelectorAll("template[id^=view-]").forEach((t) => t.remove());
  initThemeToggle();
  if (view === "download") await import("./download");
  else await import("./generator");
}

const view = pick();
if (view) void show(view);
