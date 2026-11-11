// The Library (DEMO.md 3.5): a small shelf of public-domain books, published once with no
// hosting bill. The look is in static/style.css; this file builds the pages.

import { readFile } from "node:fs/promises";
import { BOOKS } from "./books.mjs";

export const meta = {
  title: "The Library",
  description: "Four classic books, published once and paid for once. No hosting bill, no renewal.",
};

export const settings = { notFound: "404.html" };

const content = (slug) => readFile(new URL(`content/${slug}.html`, import.meta.url), "utf8");

const text = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** "about 45 minutes" or "about 2½ hours", at an unhurried 240 words a minute. */
function readingTime(words) {
  const minutes = words / 240;
  if (minutes < 75) return `about ${Math.max(5, Math.round(minutes / 5) * 5)} minutes`;
  const halves = Math.round(minutes / 30);
  return `about ${Math.floor(halves / 2) || ""}${halves % 2 ? "½" : ""} hours`;
}

/**
 * The book's contents, from its sections: [{ id, depth, ordinal, title }].
 * A section's heading is an <hgroup> (ordinal and title) or a single <h2>–<h4>.
 */
function contents(html) {
  const items = [];
  const tag = /<(\/?)section\b[^>]*>/g;
  let depth = 0;
  for (let m; (m = tag.exec(html)); ) {
    if (m[1]) {
      depth--;
      continue;
    }
    const id = /\bid="([^"]+)"/.exec(m[0])?.[1];
    const rest = html.slice(m.index + m[0].length, m.index + m[0].length + 2000);
    const group = /^\s*(?:<header[^>]*>\s*)?<hgroup>([\s\S]*?)<\/hgroup>/.exec(rest);
    const parts = group
      ? [...group[1].matchAll(/<(h[2-6]|p)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((p) => text(p[2]))
      : [text(/^\s*(?:<header[^>]*>\s*)?<h([2-6])\b[^>]*>([\s\S]*?)<\/h\1>/.exec(rest)?.[2] ?? "")];
    const [first, ...others] = parts.filter(Boolean);
    if (id && first) {
      const numeral = /^[IVXLC]+$/.test(first);
      items.push({
        id,
        depth,
        ordinal: numeral ? first : "",
        title: numeral ? others.join(" ") || `Chapter ${first}` : [first, ...others].join(" "),
        numeralOnly: numeral && !others.length,
      });
    }
    depth++;
  }
  return items;
}

function contentsHtml(ctx, items) {
  if (items.length < 2) return "";
  const li = (it) =>
    `<li class="toc-${it.depth ? "sub" : "top"}"><a href="#${ctx.esc(it.id)}">${
      it.ordinal && !it.numeralOnly ? `<span class="toc-n">${ctx.esc(it.ordinal)}</span> ` : ""
    }<span class="toc-t">${ctx.esc(it.title)}</span></a></li>`;
  return `<nav class="contents" aria-labelledby="contents-h">
  <h2 id="contents-h">Contents</h2>
  <ol>
${items.map((it) => "    " + li(it)).join("\n")}
  </ol>
</nav>`;
}

function page(ctx, { title, body, bodyAttrs = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ctx.esc(title)}</title>
${ctx.headTags}
<link rel="stylesheet" href="/style.css">
</head>
<body ${bodyAttrs}>
<header class="masthead">
  <a class="home" href="/">The Library</a>
  ${ctx.startLink}
</header>
${body}
<footer class="colophon">
  <p class="colophon-line">Published once. Paid for once. No renewal.</p>
  ${ctx.receipt}
</footer>
</body>
</html>
`;
}

export async function build(ctx) {
  const files = new Map();
  const books = [];
  for (const b of BOOKS) {
    const html = await content(b.slug);
    books.push({ ...b, html, time: readingTime(text(html).split(" ").length) });
  }

  const shelf = books
    .map(
      (b) => `  <li class="book" data-book="${b.slug}">
    <a class="cover" href="/books/${b.slug}/">
      <span class="book-title">${ctx.esc(b.title)}</span>
      <span class="book-author">${ctx.esc(b.author)}</span>
    </a>
    <p class="book-blurb">${ctx.esc(b.blurb)}</p>
    <p class="book-meta">${b.year} · ${ctx.esc(b.time)}</p>
  </li>`,
    )
    .join("\n");

  files.set(
    "index.html",
    page(ctx, {
      title: "The Library",
      bodyAttrs: 'class="shelf-page"',
      body: `<main>
<header class="frontispiece">
  <h1>The Library</h1>
  <p class="lede">Four classic books, set for comfortable reading.</p>
</header>
<ul class="shelf">
${shelf}
</ul>
<section class="note">
  <p class="note-lead">This shelf has no server behind it.</p>
  <p>It was published to the Autonomi network once and paid for once. There is no hosting bill to renew, and nobody has to keep a machine running for these pages to stay here. Your browser fetched the whole shelf, checked every byte, and now keeps it: the books open instantly, and still open with your connection switched off.</p>
</section>
<p class="credit">The texts are the <a href="https://standardebooks.org/">Standard Ebooks</a> editions, which their editors dedicate to the public domain. Every author here died more than seventy years ago. Set in Literata.</p>
</main>`,
    }),
  );

  books.forEach((b, i) => {
    const next = books[(i + 1) % books.length];
    files.set(
      `books/${b.slug}/index.html`,
      page(ctx, {
        title: `${b.title} · The Library`,
        bodyAttrs: `class="book-page" data-book="${b.slug}"`,
        body: `<div class="progress" aria-hidden="true"></div>
<main>
<article class="book-text">
<header class="book-head">
  <p class="book-kicker">${ctx.esc(b.author)}</p>
  <h1>${ctx.esc(b.title)}</h1>
  <p class="byline">${b.year} · ${ctx.esc(b.time)}</p>
</header>
${contentsHtml(ctx, contents(b.html))}
${b.html}
</article>
<nav class="onward" aria-label="More from the shelf">
  <a class="onward-next" href="/books/${next.slug}/"><span class="onward-label">Next on the shelf</span> <span class="onward-title">${ctx.esc(next.title)}</span></a>
  <a class="onward-shelf" href="/">Back to the shelf</a>
</nav>
<p class="credit">Text from the <a href="https://standardebooks.org/ebooks/${b.source}">Standard Ebooks edition</a>, dedicated to the public domain.</p>
</main>`,
      }),
    );
  });

  files.set(
    "404.html",
    page(ctx, {
      title: "Not on this shelf · The Library",
      bodyAttrs: 'class="missing-page"',
      body: `<main>
<header class="frontispiece">
  <h1>Not on this shelf</h1>
  <p class="lede">There is no page at this address. The four books are where they always were.</p>
  <p><a class="button" href="/">Back to the Library</a></p>
</header>
</main>`,
    }),
  );

  return files;
}
