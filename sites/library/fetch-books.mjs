#!/usr/bin/env node
// Fetch the Library's books from Standard Ebooks and keep only the text.
//   node sites/library/fetch-books.mjs
// Standard Ebooks dedicates its editions to the public domain (CC0). We keep each book's
// body (and its dramatis personae or endnotes) and drop Standard Ebooks' own title page,
// imprint, colophon and logo, so their name and branding aren't used as ours. Each book
// page credits the edition instead. The extracted text is committed, so builds don't need
// the network.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BOOKS } from "./books.mjs";

const OUT = fileURLToPath(new URL("content/", import.meta.url));
const DROP = /\b(titlepage|halftitlepage|imprint|colophon|copyright-page)\b/;

/** Top-level <section> elements of the body, with their epub:type. */
function topSections(html) {
  const body = html.slice(html.indexOf("<body"), html.lastIndexOf("</body>"));
  const out = [];
  const tag = /<(\/?)section\b[^>]*>/g;
  let depth = 0;
  let start = -1;
  let type = "";
  for (let m; (m = tag.exec(body)); ) {
    if (!m[1]) {
      if (depth === 0) {
        start = m.index;
        type = /epub:type="([^"]*)"/.exec(m[0])?.[1] ?? "";
      }
      depth++;
    } else if (--depth === 0) {
      out.push({ type, html: body.slice(start, m.index + m[0].length) });
    }
  }
  return out;
}

await mkdir(OUT, { recursive: true });
for (const book of BOOKS) {
  const url = `https://standardebooks.org/ebooks/${book.source}/text/single-page`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const kept = topSections(await res.text()).filter((s) => !DROP.test(s.type));
  const text = kept.map((s) => s.html).join("\n");
  if (/<img\b/.test(text)) throw new Error(`${book.slug}: kept text contains an image`);
  await writeFile(join(OUT, `${book.slug}.html`), text + "\n");
  console.log(`${book.slug}: ${kept.length} sections, ${(text.length / 1024).toFixed(0)} KiB`);
}
