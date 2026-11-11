// The shell's views: loading screen, landing page, info page and error page.

import type { SiteLink } from "../host";
import type { NameEntry } from "../names";
import type { WarmReport } from "../warm";
import { type SiteState, sameLink } from "../state";
import { type Child, formatBytes, formatMs, formatTime, h, mount } from "./dom";

function brand(): HTMLElement {
  return h("header", { class: "brand" }, h("span", { class: "mark" }, "◆"), " Autonomi Site Loader");
}

function addressBlock(link: SiteLink): HTMLElement {
  return h(
    "p",
    { class: "address" },
    h("span", { class: "kind" }, link.kind === "p" ? "Pointer" : "Immutable"),
    " ",
    h("code", {}, link.address),
  );
}

export interface LoadingView {
  step(text: string): void;
  progress(done: number, total?: number, unit?: "bytes" | "records"): void;
}

export function showLoading(link: SiteLink, title: string): LoadingView {
  const stepEl = h("p", { class: "step", "data-testid": "step" }, "Starting…");
  const bar = h("progress", { max: "1", value: "0" });
  const detail = h("p", { class: "detail" }, "");
  mount(
    brand(),
    h("main", { class: "card", "data-view": "loading" }, h("h1", {}, title), addressBlock(link), stepEl, bar, detail),
  );
  bar.removeAttribute("value"); // indeterminate until there's progress
  return {
    step(text) {
      stepEl.textContent = text;
      bar.removeAttribute("value");
      detail.textContent = "";
    },
    progress(done, total, unit = "bytes") {
      const fmt = (n: number) => (unit === "records" ? String(n) : formatBytes(n));
      if (total) {
        bar.max = total;
        bar.value = done;
        detail.textContent = `${fmt(done)} of ${fmt(total)}${unit === "records" ? " records" : ""}`;
      } else {
        detail.textContent = unit === "records" ? `${done} records` : formatBytes(done);
      }
    },
  };
}

export function showError(
  title: string,
  message: string,
  actions: { label: string; run: () => void }[] = [],
  link?: SiteLink,
): void {
  mount(
    brand(),
    h(
      "main",
      { class: "card error", "data-view": "error" },
      h("h1", {}, title),
      link ? addressBlock(link) : null,
      h("p", { "data-testid": "error-message" }, message),
      h("div", { class: "actions" }, ...actions.map((a) => h("button", { onclick: a.run }, a.label))),
    ),
  );
}

export interface LandingOptions {
  onOpen(input: string, rawHexIsPointer: boolean): string | null;
  fixtures?: { name: string; href: string }[];
  /** The sites in this loader's name directory, as links. */
  named?: { name: string; href: string }[];
  /** A message to show under the address box, such as why the page asked for wasn't opened. */
  notice?: string;
  canRegisterHandler: boolean;
  onRegisterHandler(): void;
}

/** The address box, the web+ant handler offer and (in test builds) the fixture list. */
function addressTools(opts: LandingOptions): { form: HTMLFormElement; input: HTMLInputElement; extras: Child[] } {
  const input = h("input", {
    type: "text",
    name: "address",
    placeholder: "A site name, 64 hex characters, ant://…, or a site link",
    autocomplete: "off",
    spellcheck: "false",
    "aria-label": "Site address",
  });
  const pointer = h("input", { type: "checkbox", name: "pointer" });
  const err = h("p", { class: "form-error", role: "alert" }, opts.notice ?? "");
  const form = h(
    "form",
    {
      onsubmit: (e: Event) => {
        e.preventDefault();
        err.textContent = opts.onOpen(input.value, pointer.checked) ?? "";
      },
    },
    input,
    h("label", { class: "check" }, pointer, " A bare 64-hex address is a pointer (latest version)"),
    h("button", { type: "submit" }, "Open"),
    err,
  );

  const fixtures = opts.fixtures && opts.fixtures.length
    ? h(
        "section",
        { class: "fixtures" },
        h("h2", {}, "Test fixtures"),
        h(
          "ul",
          {},
          ...opts.fixtures.map((f) => h("li", {}, h("a", { href: f.href, "data-fixture": f.name }, f.name))),
        ),
      )
    : null;

  const handler = opts.canRegisterHandler
    ? h("p", { class: "small" }, h("button", { class: "link", onclick: opts.onRegisterHandler }, "Open web+ant: links with this loader"))
    : null;
  return { form, input, extras: [namedSites(opts.named), handler, fixtures] };
}

/** The sites in the name directory, so a visitor who knows no addresses has somewhere to go. */
function namedSites(named?: { name: string; href: string }[]): HTMLElement | null {
  if (!named?.length) return null;
  return h(
    "section",
    { class: "named", "data-testid": "named-sites" },
    h("h2", {}, "Sites on this loader"),
    h(
      "ul",
      { class: "named-list" },
      ...named.map((s) => h("li", {}, h("a", { href: s.href, "data-name": s.name }, s.name))),
    ),
  );
}

export function showLanding(opts: LandingOptions): void {
  const { form, input, extras } = addressTools(opts);
  mount(
    brand(),
    h(
      "main",
      { class: "card", "data-view": "landing" },
      h("h1", {}, "Open a site stored on Autonomi"),
      h(
        "p",
        {},
        "Every byte comes from Autonomi nodes over WebRTC and is verified in your browser. No gateway sits in the data path.",
      ),
      h(
        "p",
        { class: "small" },
        "Pick a site below, or type a site's short name (such as library), its 64-character address, or an ant:// link.",
      ),
      form,
      extras,
    ),
  );
  input.focus();
}

export interface FrontDoorOptions extends LandingOptions {
  /** What the site is called on the door: "Antnet Start". */
  siteLabel: string;
  /** Enter was pressed (or clicked). The caller decides what that means now. */
  onEnter(): void;
}

export interface FrontDoorView {
  /** Show what the fetch of the site is doing. */
  report(r: WarmReport): void;
}

/**
 * A site's front door (DEMO.md 5.1), shown on the site's own origin while it installs: the one
 * page a web server sends. Enter opens the site, at once when it has arrived.
 */
export function showFrontDoor(opts: FrontDoorOptions): FrontDoorView {
  const label = opts.siteLabel;
  const status = h("p", { class: "door-status", "data-testid": "door-status", role: "status" }, `Fetching ${label}…`);
  const bar = h("progress", { max: "1" });
  bar.removeAttribute("value");
  const enter = h("button", { type: "button", class: "door-enter", "data-testid": "enter", onclick: () => opts.onEnter() }, "Enter");
  const door = h(
    "main",
    { class: "card door", "data-view": "door", "data-door": "working" },
    h("h1", {}, "This is the last page a web server will send you."),
    h(
      "p",
      {},
      `While you read this, your browser is fetching ${label} straight from computers on the Autonomi network, ` +
        "and checking every piece of it itself.",
    ),
    h("p", {}, `${label} and the sites it links to come from the network, not from a server.`),
    h("p", {}, "The first time takes a few seconds. After that, they open at once."),
    h("div", { class: "door-progress" }, status, bar),
    h("div", { class: "actions" }, enter),
  );
  let step = `Fetching ${label}…`;

  const { form, extras } = addressTools(opts);
  mount(
    brand(),
    door,
    h(
      "section",
      { class: "card door-more" },
      h("h2", {}, "Open another site"),
      h("p", { class: "small" }, "Type a site's short name (such as library), its 64-character address, or an ant:// link."),
      form,
      extras,
    ),
  );

  return {
    report(r) {
      door.setAttribute("data-door", r.status);
      if (r.status === "ready") {
        status.textContent = `${label} is here, checked and ready.`;
        bar.max = 1;
        bar.value = 1;
        enter.focus();
        return;
      }
      if (r.status === "error") {
        status.textContent = `${label} couldn't be fetched: ${r.error ?? "error"}. ${r.step ?? ""} Enter tries again.`;
        bar.max = 1;
        bar.value = 0;
        enter.textContent = "Try again";
        return;
      }
      if (r.step !== undefined) {
        step = r.step;
        bar.removeAttribute("value");
      }
      if (r.total) {
        bar.max = r.total;
        bar.value = r.done ?? 0;
      }
      const count = r.total && r.unit === "records" ? ` ${r.done ?? 0} of ${r.total} records` : "";
      status.textContent = `${step}${count}`;
    },
  };
}

export interface InfoOptions {
  /** The link in use: from the hostname, or for a named site what the name resolves to. Null if unknown. */
  link: SiteLink | null;
  /** Set on a named site: the name and what the directory says now. */
  name?: { name: string; entry: NameEntry | null | "unreadable" };
  label: string;
  state: SiteState | null;
  sourceName: string;
  /** Runs a check and re-renders the page with the outcome. */
  onCheck(): Promise<void>;
  /** Clears storage and re-renders the page (with a status message). */
  onClear(): Promise<void>;
  status?: string;
}

function row(name: string, value: Node | string, testid?: string): HTMLElement {
  return h("tr", {}, h("th", {}, name), h("td", testid ? { "data-testid": testid } : {}, value));
}

/** "Pointer ddab…, registered 2026-11-14", or why there is nothing to show. */
function entryText(entry: NameEntry | null | "unreadable"): Node | string {
  if (entry === "unreadable") return "The directory couldn't be read just now";
  if (!entry) return "Not registered";
  return h(
    "span",
    {},
    entry.kind === "p" ? "Pointer " : "Archive ",
    h("code", {}, entry.address),
    entry.since ? `, registered ${entry.since}` : "",
  );
}

/** The records an installed site arrived as, and the nodes that served them (DEMO.md 4.5). */
function recordsSection(state: SiteState): HTMLElement | null {
  const list = state.recordList;
  if (!list?.length) return null;
  const arrivals = state.arrivals ?? [];
  const nodes = new Set([...list, ...arrivals].map((r) => r.node).filter((n): n is string => !!n));
  const known = Math.max(list.filter((r) => r.node).length, arrivals.filter((a) => a.node).length + (list[0]?.node ? 1 : 0));
  const summary =
    known >= list.length
      ? `This site arrived as ${list.length} records from ${nodes.size} ${nodes.size === 1 ? "computer" : "computers"} on the Autonomi network.`
      : `This site arrived as ${list.length} records. The client named the serving node for ${known} of them; ` +
        "the rest will be listed once the SDK reports them.";
  const short = (s?: string) => (s ? (s.length > 20 ? `${s.slice(0, 8)}…${s.slice(-6)}` : s) : "—");
  return h(
    "section",
    { "data-testid": "records" },
    h("h2", {}, "Where this site came from"),
    h("p", { class: "small" }, summary),
    h(
      "table",
      { class: "records" },
      h("tr", {}, h("th", {}, "Record"), h("th", {}, "Size"), h("th", {}, "Address"), h("th", {}, "Served by")),
      ...list.map((r) =>
        h(
          "tr",
          {},
          h("td", {}, r.kind === "datamap" ? "DataMap" : `Chunk ${(r.index ?? 0) + 1}`),
          h("td", {}, r.bytes !== undefined ? formatBytes(r.bytes) : "—"),
          h("td", {}, h("code", { title: r.address ?? "" }, short(r.address))),
          h("td", {}, h("code", { title: r.node ?? "" }, short(r.node))),
        ),
      ),
    ),
    arrivals.length
      ? h("p", { class: "small" }, `Chunks arrived ${arrivals.map((a) => formatMs(a.ms)).join(", ")} after the download began.`)
      : null,
  );
}

export function showInfo(opts: InfoOptions): void {
  const { link, state, name } = opts;
  const status = h("p", { class: "status", role: "status" }, opts.status ?? "");
  const t = state?.timings;
  const moved = name && state && name.entry && name.entry !== "unreadable" && !sameLink(name.entry, state.link);
  const canChange = link?.kind === "p" || !!name;
  const table = h(
    "table",
    {},
    name
      ? [
          row("Short name", name.name, "name"),
          row("Directory entry", entryText(name.entry), "name-entry"),
          moved ? row("Note", "The directory now points somewhere else. The next check installs it.") : null,
        ]
      : null,
    link
      ? [
          row("Link type", link.kind === "p" ? "Pointer (latest version)" : "Immutable (this exact version)"),
          row(link.kind === "p" ? "Pointer address" : "Archive address", h("code", {}, link.address)),
        ]
      : null,
    state
      ? [
          link?.kind === "p" ? row("Archive in use", h("code", {}, state.archive), "archive") : null,
          state.title ? row("Title", state.title) : null,
          state.declaredName ? row("Site calls itself", state.declaredName, "declared-name") : null,
          row("Content hash", h("code", {}, state.blake3)),
          row("Size", formatBytes(state.bytes)),
          row("Files", String(state.files), "files"),
          state.records !== undefined ? row("Records", `${state.records + 1} (${state.records} chunks + DataMap)`) : null,
          row("Installed", formatTime(state.installedAt)),
          canChange ? row("Last checked", formatTime(state.checkedAt)) : null,
          canChange
            ? row(
                "Updates",
                "Checked in the background, at most once an hour. For this, the loader adds one small " +
                  "script of its own to this site's pages (/_autonomi/check.js).",
                "updates",
              )
            : null,
          row(
            "Install timings",
            `connect ${formatMs(t?.connectMs)} · resolve ${formatMs(t?.resolveMs)} · download ${formatMs(
              t?.downloadMs,
            )} · install ${formatMs(t?.installMs)} · total ${formatMs(t?.totalMs)}`,
            "timings",
          ),
          state.lastCheck
            ? row("Last update check", `${state.lastCheck.outcome} in ${formatMs(state.lastCheck.ms)} (${formatTime(state.lastCheck.at)})`)
            : null,
          row("Source", opts.sourceName),
        ]
      : row("Installed", "Nothing installed on this origin yet"),
  );

  const ignored =
    state?.ignored && state.ignored.length
      ? h("section", {}, h("h2", {}, "Ignored by the loader"), h("ul", { "data-testid": "ignored" }, ...state.ignored.map((i) => h("li", {}, i))))
      : null;

  mount(
    brand(),
    h(
      "main",
      { class: "card", "data-view": "info" },
      h("h1", {}, "What's installed here"),
      h(
        "p",
        { class: "small" },
        name
          ? "The name is read from this page's hostname and looked up in this loader's public directory " +
              "(/_autonomi/names.json). The directory decides which site a name leads to. It can't change " +
              "what a site contains: that is still fetched by address and checked in your browser."
          : "The link address is read from this page's hostname, never from stored state.",
      ),
      table,
      state ? recordsSection(state) : null,
      ignored,
      h(
        "div",
        { class: "actions" },
        canChange && state
          ? h(
              "button",
              {
                onclick: (e: Event) => {
                  (e.currentTarget as HTMLButtonElement).disabled = true;
                  status.textContent = "Checking… (reading a pointer can take 20 seconds)";
                  opts.onCheck().catch((err) => (status.textContent = `Couldn't check: ${err}`));
                },
              },
              "Check for a new version now",
            )
          : null,
        h(
          "button",
          {
            onclick: () => {
              status.textContent = "Clearing…";
              opts.onClear().catch((e) => (status.textContent = `Couldn't clear: ${e}`));
            },
          },
          "Clear this site's data",
        ),
        h("a", { class: "button", href: "/" }, "Open the site"),
      ),
      status,
    ),
  );
}
