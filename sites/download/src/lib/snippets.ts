import { formatBytes } from "./format";

export type ButtonStyle = "light" | "dark" | "minimal";
export const BUTTON_STYLES: readonly ButtonStyle[] = ["light", "dark", "minimal"];

export const BUTTON_TITLE = "Free to download. Served by the Autonomi network, not this site.";
export const POWERED_BY = "Powered by Autonomi";
/** Longer names are shortened in the middle so the version and extension stay visible. */
export const MAX_LABEL_NAME = 40;

export interface SnippetOptions {
  fileName: string;
  size?: number;
  /** The file's full address. It goes in the button's hover text. */
  address?: string;
  /** Also show the full address in a line under the button, where it can be read and copied. */
  showAddress?: boolean;
}

export const ADDRESS_LABEL = "Autonomi address:";
export const ADDRESS_HINT = "The file can also be downloaded through the Autonomi app using this address.";

/**
 * Plain HTML (no script): the file's network address, so it can still be fetched
 * with the Autonomi app if the download page ever moves or goes away.
 */
export function addressLine(address: string): string {
  return (
    `<div title="${escapeHtml(ADDRESS_HINT)}" style="margin-top:4px;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;opacity:.7;overflow-wrap:anywhere">` +
    `${ADDRESS_LABEL} ${escapeHtml(address)}</div>`
  );
}

// Colours from Autonomi's public palette: navy #131c32, indigo #232a59, red #e91337, mint #97ffa0.
const BASE =
  "display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;" +
  "font:600 15px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif;text-decoration:none;white-space:nowrap";
const THEMES = {
  light: { box: "background:#ffffff;color:#131c32;border:1px solid #c5cdd7", arrow: "#e91337" },
  dark: { box: "background:#131c32;color:#ffffff;border:1px solid #232a59", arrow: "#97ffa0" },
} as const;

// The Autonomi mark, traced from the official logo. No ids or masks, so several buttons can share a page.
const LOGO =
  `<svg aria-hidden="true" focusable="false" width="11" height="11" viewBox="0 0 150 150" fill="#e91337" style="flex:none;display:block">` +
  `<path d="M4 74A73 73 0 0 1 148.5 72L136 66A72 72 0 0 0 72 20C60 19 50 22 50 32V42C49 58 30 72 4 74Z"/>` +
  `<path fill-rule="evenodd" d="M49 76C72 56 118 44 149 74A73 73 0 0 1 34 136C26 120 30 96 49 76ZM114 95C90 100 72 114 76 129C104 131 127 120 127 100C126 96 120 94 114 95Z"/>` +
  `</svg>`;

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

/** Backslash-escape characters that Markdown would treat as formatting inside link text. */
export function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_[\]<>]/g, (c) => `\\${c}`);
}

/** "a-very-long-file-name-for-my-mod-v1.2.zip" → "a-very-long-file-na…my-mod-v1.2.zip" */
export function shortenName(name: string, max = MAX_LABEL_NAME): string {
  const chars = Array.from(name);
  if (chars.length <= max) return name;
  const tail = Math.ceil((max - 1) / 2);
  const head = max - 1 - tail;
  return `${chars.slice(0, head).join("")}…${chars.slice(-tail).join("")}`;
}

/** The Light and Dark buttons credit Autonomi on a line of their own under this label. */
export function buttonLabel(fileName: string): string {
  return `Download ${shortenName(fileName)}`;
}

/** The minimal link and Markdown have no second line, so the credit goes in the label. */
export function linkLabel(fileName: string): string {
  return `${buttonLabel(fileName)} from Autonomi`;
}

const sizeLabel = (size?: number) => (size === undefined ? "" : formatBytes(size, { compact: true }));

export function htmlSnippet(style: ButtonStyle, url: string, options: SnippetOptions): string {
  const button = buttonHtml(style, url, options);
  return options.address && options.showAddress ? `<div>\n${button}\n${addressLine(options.address)}\n</div>` : button;
}

function buttonHtml(style: ButtonStyle, url: string, { fileName, size, address }: SnippetOptions): string {
  const href = escapeHtml(url);
  const sizeText = sizeLabel(size);
  // A shortened name is still readable in full on hover.
  const named = shortenName(fileName) !== fileName ? `${fileName}. ${BUTTON_TITLE}` : BUTTON_TITLE;
  const title = address ? `${named} ${ADDRESS_LABEL} ${address}` : named;
  const attrs = `href="${href}" target="_blank" rel="noopener" title="${escapeHtml(title)}"`;

  if (style === "minimal") {
    return `<a ${attrs} style="text-decoration:underline">${escapeHtml(linkLabel(fileName))}${sizeText ? ` (${sizeText})` : ""}</a>`;
  }

  const theme = THEMES[style];
  // The leading space is invisible in the flex row but keeps the text readable if styles are stripped.
  const sizeSpan = sizeText ? ` <span style="font-weight:400;opacity:.7">· ${sizeText}</span>` : "";
  // The label and size keep the first line; the credit sits under them, smaller and dimmer.
  return [
    `<a ${attrs}`,
    `   style="${BASE};${theme.box}">`,
    `  <span aria-hidden="true" style="color:${theme.arrow}">⬇</span>`,
    `  <span style="display:inline-flex;flex-direction:column;gap:4px">`,
    `    <span style="display:inline-flex;gap:8px"><span>${escapeHtml(buttonLabel(fileName))}</span>${sizeSpan}</span>`,
    `    <span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:500;line-height:1;letter-spacing:.02em">${LOGO}<span style="opacity:.6">${POWERED_BY}</span></span>`,
    `  </span>`,
    `</a>`,
  ].join("\n");
}

export function markdownSnippet(url: string, { fileName, size, address, showAddress }: SnippetOptions): string {
  const sizeText = sizeLabel(size);
  const link = `[⬇ ${escapeMarkdown(linkLabel(fileName))}${sizeText ? ` (${sizeText})` : ""}](${url})`;
  // Markdown has no hover title, so the full address goes in a code span.
  return address && showAddress ? `${link}\n\n${ADDRESS_LABEL} \`${address}\`` : link;
}
