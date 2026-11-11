// The shell's views: loading screen, landing page, info page and error page.

import type { SiteLink } from "../host";
import type { SiteState } from "../state";
import { formatBytes, formatMs, formatTime, h, mount } from "./dom";

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
  canRegisterHandler: boolean;
  onRegisterHandler(): void;
}

export function showLanding(opts: LandingOptions): void {
  const input = h("input", {
    type: "text",
    name: "address",
    placeholder: "64 hex characters, ant://…, or a site link",
    autocomplete: "off",
    spellcheck: "false",
    "aria-label": "Site address",
  });
  const pointer = h("input", { type: "checkbox", name: "pointer" });
  const err = h("p", { class: "form-error", role: "alert" });
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
      form,
      opts.canRegisterHandler
        ? h("p", { class: "small" }, h("button", { class: "link", onclick: opts.onRegisterHandler }, "Open web+ant: links with this loader"))
        : null,
      fixtures,
    ),
  );
  input.focus();
}

export interface InfoOptions {
  link: SiteLink;
  label: string;
  state: SiteState | null;
  sourceName: string;
  onCheck(): void;
  /** Clears storage and re-renders the page (with a status message). */
  onClear(): Promise<void>;
  status?: string;
}

function row(name: string, value: Node | string, testid?: string): HTMLElement {
  return h("tr", {}, h("th", {}, name), h("td", testid ? { "data-testid": testid } : {}, value));
}

export function showInfo(opts: InfoOptions): void {
  const { link, state } = opts;
  const status = h("p", { class: "status", role: "status" }, opts.status ?? "");
  const t = state?.timings;
  const table = h(
    "table",
    {},
    row("Link type", link.kind === "p" ? "Pointer (latest version)" : "Immutable (this exact version)"),
    row(link.kind === "p" ? "Pointer address" : "Archive address", h("code", {}, link.address)),
    state
      ? [
          link.kind === "p" ? row("Archive in use", h("code", {}, state.archive), "archive") : null,
          state.title ? row("Title", state.title) : null,
          row("Content hash", h("code", {}, state.blake3)),
          row("Size", formatBytes(state.bytes)),
          row("Files", String(state.files), "files"),
          state.records !== undefined ? row("Records", `${state.records + 1} (${state.records} chunks + DataMap)`) : null,
          row("Installed", formatTime(state.installedAt)),
          link.kind === "p" ? row("Last checked", formatTime(state.checkedAt)) : null,
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
      h("p", { class: "small" }, "The link address is read from this page's hostname, never from stored state."),
      table,
      ignored,
      h(
        "div",
        { class: "actions" },
        link.kind === "p" && state ? h("button", { onclick: opts.onCheck }, "Check for a new version now") : null,
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
