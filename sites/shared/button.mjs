// A download button made by the Download Button's own generator code (DEMO.md 3.6), for a demo
// site to embed: Cinema's film, the Library's EPUBs. It is the generator's exact markup, so the
// demo shows a real embed in use.
//
// The generator's buttons carry inline styles, so they paste into any site. The demo sites'
// policy forbids inline styles (style-src 'self'), so each style attribute becomes a class here,
// with its rule in a small stylesheet the site ships. The button looks exactly as the generator
// makes it, and the site's policy stays as strict as it was.

import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const SNIPPETS = fileURLToPath(new URL("../download/src/lib/snippets.ts", import.meta.url));
let snippets;
const load = async () => (snippets ??= (await runnerImport(SNIPPETS)).module);

/** The stylesheet each embedding site ships, and links from pages that show a button. */
export const BUTTON_CSS = "download-button.css";

/**
 * Buttons for one site. `add` returns a button's markup; `css()` the stylesheet for every
 * button added so far. Identical styles share a class, so the stylesheet stays small.
 */
export function downloadButtons() {
  const classes = new Map(); // declarations -> class name
  return {
    /**
     * @param {object} o
     * @param {"light" | "dark" | "minimal"} o.style the generator's button style
     * @param {string} o.href   where it leads: a portable link to the download page on this loader
     * @param {string} o.fileName
     * @param {number} [o.size]
     * @param {string} [o.address] the file's address, for the button's hover text
     */
    async add({ style, href, fileName, size, address }) {
      const { htmlSnippet } = await load();
      const html = htmlSnippet(style, href, { fileName, size, address });
      // Every style attribute in the snippet holds plain declarations and no double quotes.
      const markup = html.replace(/\sstyle="([^"]*)"/g, (_, declarations) => {
        let name = classes.get(declarations);
        if (!name) classes.set(declarations, (name = `dlb-${classes.size + 1}`));
        return ` class="${name}"`;
      });
      return `<span class="dl-embed">${markup}</span>`;
    },
    /** The rules, scoped under .dl-embed so the site's own link styles don't reach in. */
    css() {
      const rules = [...classes].map(([declarations, name]) => `.dl-embed .${name} { ${declarations}; }`);
      return (
        "/* Download buttons made by the Download Button's generator (sites/shared/button.mjs).\n" +
        "   The generator writes these as inline styles; this site's policy forbids those. */\n" +
        ".dl-embed { display: inline-block; }\n" +
        rules.join("\n") +
        "\n"
      );
    },
  };
}
