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

/** The parts of an install, so a view can follow it without reading the step text. */
export type InstallStage = "connect" | "find" | "fetch" | "install";

export interface DoorReport extends WarmReport {
  stage?: InstallStage;
  /** With "ready": the record of what was just installed, for this visit's numbers. */
  state?: SiteState | null;
}

export interface FrontDoorView {
  /** Show what the fetch of the site is doing. */
  report(r: DoorReport): void;
  /** Enter was pressed before the site arrived: say it opens as soon as it does. */
  entered(): void;
}

const SOURCE_URL = "https://github.com/DavidMc0/Antnet";

/** Inline SVG from markup. Presentation attributes only, so the shell's CSP allows it. */
function svg(markup: string): Element {
  const t = document.createElement("template");
  t.innerHTML = markup;
  return t.content.firstElementChild!;
}

/** The mark Antnet Start uses: three dots in a row. An ant, and three nodes on a network. */
const MARK =
  '<svg class="door-mark" viewBox="0 0 44 18" fill="currentColor" aria-hidden="true"><circle cx="8" cy="10" r="6.5"/><circle cx="22" cy="10" r="3.6"/><circle cx="35" cy="10" r="5"/><path d="M37.5 5.5l3-4M39.5 8l4-2.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
const TICK =
  '<svg class="door-tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 12.5l4.2 4.2L18.5 7.5"/></svg>';
const ARROW =
  '<svg class="door-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

function doorBrand(): HTMLElement {
  return h("span", { class: "door-brand" }, svg(MARK), h("span", {}, "antnet"));
}

// The same units as the receipt on Antnet Start, so the door and Start agree.
function doorBytes(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} kB`;
  return `${n} bytes`;
}
function doorSeconds(ms: number | undefined): string {
  return ms === undefined ? "" : `${(ms / 1000).toFixed(ms < 1000 ? 2 : 1)} s`;
}

/** The five nodes on the door's trail: the same five steps Antnet Start shows afterwards. */
const TRAIL: [id: string, label: string, detail: string][] = [
  ["connect", "Connect", "to the network"],
  ["find", "Find", "the latest version"],
  ["fetch", "Fetch", "its records"],
  ["check", "Check", "every byte"],
  ["hand", "Hand over", "to your browser"],
];
const CHECK = 3;
const HAND = 4;
const STAGE_NODE: Record<InstallStage, number> = { connect: 0, find: 1, fetch: 2, install: HAND };

const BENEFITS: [title: string, text: string][] = [
  [
    "No server in the middle",
    "A site arrives as records from independent computers. Your browser checks every byte against the site's address, so nothing in between can change what you see.",
  ],
  [
    "Opens from an ordinary link",
    "There is nothing to install. A normal link in a normal browser is enough, and a site you have visited before opens at once.",
  ],
  [
    "Paid for once",
    "A site is paid for when it is uploaded. There is no hosting bill, and nothing to renew.",
  ],
];

/**
 * A site's front door (DEMO.md 5.1), shown on the site's own origin while it installs: the one
 * page a web server sends. Enter opens the site, at once when it has arrived.
 */
export function showFrontDoor(opts: FrontDoorOptions): FrontDoorView {
  const label = opts.siteLabel;
  const HINT = "A first visit usually takes 10 to 30 seconds. After that, it opens at once.";

  const kicker = h("span", { class: "door-live-kicker" }, `Arriving now · ${label}`);
  const clock = h("span", { class: "door-clock", "aria-hidden": "true" }, "");
  const times: HTMLElement[] = [];
  const nodes = TRAIL.map(([id, name, detail], i) => {
    const time = h("span", { class: "door-node-t" }, "");
    times.push(time);
    return h(
      "li",
      { "data-node": id, "data-state": i === 0 ? "active" : "pending" },
      h("span", { class: "door-node" }, h("span", { class: "door-node-n" }, String(i + 1)), svg(TICK)),
      h("b", {}, name),
      h("span", { class: "door-node-d" }, detail),
      time,
    );
  });
  const status = h("p", { class: "door-status", "data-testid": "door-status", role: "status" }, "Starting…");
  const detail = h("p", { class: "door-detail", "data-testid": "door-detail" }, HINT);
  const enterLabel = h("span", {}, "Enter");
  const enter = h(
    "button",
    { type: "button", class: "door-enter", "data-testid": "enter", onclick: () => opts.onEnter() },
    enterLabel,
    svg(ARROW),
  );

  const door = h(
    "main",
    { class: "door", "data-view": "door", "data-door": "working" },
    h(
      "section",
      { class: "door-hero" },
      h("p", { class: "door-kicker" }, "The front door"),
      h("h1", {}, "This is the last page a web server will send you."),
      h(
        "p",
        { class: "door-lede" },
        "From here on, sites come straight from Autonomi, a network of independent computers. " +
          "Your browser fetches each one itself, and checks every piece before showing it.",
      ),
    ),
    h(
      "section",
      { class: "door-live", "aria-label": `${label}, arriving from the network` },
      h("div", { class: "door-live-head" }, kicker, clock),
      h("ol", { class: "door-trail" }, ...nodes),
      h("div", { class: "door-live-foot" }, h("div", { class: "door-live-text" }, status, detail), enter),
    ),
    h(
      "section",
      { class: "door-benefits", "aria-labelledby": "door-benefits-h" },
      h("h2", { id: "door-benefits-h" }, "What changes on the other side"),
      h("ul", {}, ...BENEFITS.map(([title, text]) => h("li", {}, h("h3", {}, title), h("p", {}, text)))),
    ),
  );

  const { form, extras } = addressTools(opts);
  const [named, ...tools] = extras;
  door.append(
    h(
      "section",
      { class: "door-more", "aria-labelledby": "door-more-h" },
      h(
        "div",
        { class: "door-more-head" },
        h("h2", { id: "door-more-h" }, "Going somewhere else?"),
        h("p", {}, "Type a site's short name (such as library), its 64-character address, or an ant:// link."),
      ),
      h("div", { class: "door-more-body" }, named, form, tools),
    ),
    h(
      "p",
      { class: "door-fine" },
      "This first page is the loader. It is small and open source, and it comes from an ordinary web host; " +
        "anyone can run their own. Antnet is an independent proof of concept, not an Autonomi Foundation product.",
    ),
  );

  mount(
    h(
      "header",
      { class: "door-top" },
      doorBrand(),
      h("a", { class: "door-top-link", href: SOURCE_URL, target: "_blank", rel: "noopener" }, "Source"),
    ),
    door,
    h(
      "footer",
      { class: "door-foot" },
      doorBrand(),
      h("span", {}, "An independent proof of concept. ", h("a", { href: SOURCE_URL, target: "_blank", rel: "noopener" }, "Source")),
    ),
  );
  document.documentElement.setAttribute("data-page", "door");
  document.title = `Antnet · ${label}`;

  // Where the install has got to: nodes before `current` are done, `current` is under way.
  let current = 0;
  let stageAt = performance.now();
  let message = "Starting…";
  let early = false;
  const began = stageAt;
  const timer = setInterval(() => {
    clock.textContent = `${Math.floor((performance.now() - began) / 1000)} s`;
  }, 1000);

  const paint = (last: "active" | "done" | "error") =>
    nodes.forEach((n, i) => n.setAttribute("data-state", i < current ? "done" : i === current ? last : "pending"));
  const advance = (to: number) => {
    if (to <= current) return;
    const now = performance.now();
    // Checking has no time of its own: each record is checked as it arrives.
    if (current !== CHECK) times[current].textContent = doorSeconds(now - stageAt);
    stageAt = now;
    current = to;
    paint("active");
  };
  const show = () => {
    status.textContent = early ? "Opening as soon as it arrives…" : message;
    detail.textContent = early ? message : HINT;
  };

  return {
    entered() {
      early = true;
      door.setAttribute("data-entered", "");
      enterLabel.textContent = "Opening when ready";
      show();
    },
    report(r) {
      door.setAttribute("data-door", r.status);
      if (r.status === "ready") {
        clearInterval(timer);
        const s = r.state;
        const t = s?.timings;
        current = TRAIL.length;
        paint("done");
        if (t) {
          times[0].textContent = doorSeconds(t.connectMs);
          times[1].textContent = doorSeconds(t.resolveMs);
          times[2].textContent = doorSeconds(t.downloadMs);
          times[HAND].textContent = doorSeconds(t.installMs);
        }
        const total = doorSeconds(t?.totalMs ?? performance.now() - began);
        kicker.textContent = `Arrived · ${label}`;
        clock.textContent = total;
        status.textContent = `${label} is here, checked and ready.`;
        detail.setAttribute("data-kind", "summary");
        const facts = s
          ? [
              s.records !== undefined ? `${s.records + 1} records` : null,
              doorBytes(s.bytes),
              `arrived in ${total}`,
              "every byte checked in your browser",
            ]
          : ["Fetched from the network and checked in your browser."];
        // Spans, so the facts wrap as units; the spaces between them are for screen readers and copying.
        detail.replaceChildren(...facts.filter((f): f is string => !!f).flatMap((f) => [h("span", {}, f), " "]));
        enterLabel.textContent = `Enter ${label}`;
        document.title = `Ready · ${label}`;
        enter.focus({ preventScroll: true });
        return;
      }
      if (r.status === "error") {
        clearInterval(timer);
        paint("error");
        kicker.textContent = `Not fetched · ${label}`;
        status.textContent = `${label} couldn't be fetched.`;
        detail.setAttribute("data-kind", "error");
        detail.textContent = [r.error, r.step].filter(Boolean).join(". ");
        enterLabel.textContent = "Try again";
        return;
      }
      if (r.stage) {
        advance(STAGE_NODE[r.stage]);
        message =
          r.stage === "connect"
            ? "Connecting to the Autonomi network, straight from your browser…"
            : r.stage === "find"
              ? `Finding the latest version of ${label}…`
              : r.stage === "fetch"
                ? `Fetching ${label} from the computers that hold it…`
                : "Handing over to your browser…";
      } else if (r.step !== undefined) {
        message = r.step;
      }
      if (r.total && current <= CHECK) {
        const done = r.done ?? 0;
        if (done >= r.total) {
          advance(CHECK);
          message = "Checking every byte against the address…";
        } else if (r.unit === "records") {
          message = `Fetching ${label}: ${done} of ${r.total} records`;
        }
      }
      show();
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
