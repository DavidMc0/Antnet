// The Library (DEMO.md 3.5): a small shelf of public-domain books, published once with no
// hosting bill. Plain structure for now; the look comes in the design pass.

import { readFile } from "node:fs/promises";
import { BOOKS } from "./books.mjs";

export const meta = {
  title: "The Library",
  description: "Four classic books, published once and paid for once. No hosting bill, no renewal.",
};

export const settings = { notFound: "404.html" };

const content = (slug) => readFile(new URL(`content/${slug}.html`, import.meta.url), "utf8");

function page(ctx, { title, body, bodyClass = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ctx.esc(title)}</title>
<link rel="stylesheet" href="/style.css">
${ctx.headTags}
</head>
<body class="${bodyClass}">
<header class="masthead">
  <a class="home" href="/">The Library</a>
  ${ctx.startLink}
</header>
${body}
<footer class="colophon">
  ${ctx.receipt}
</footer>
</body>
</html>
`;
}

export async function build(ctx) {
  const files = new Map();

  const shelf = BOOKS.map(
    (b) => `  <li class="book">
    <a href="/books/${b.slug}/">
      <span class="book-title">${ctx.esc(b.title)}</span>
      <span class="book-author">${ctx.esc(b.author)}, ${b.year}</span>
    </a>
    <p class="book-blurb">${ctx.esc(b.blurb)}</p>
  </li>`,
  ).join("\n");

  files.set(
    "index.html",
    page(ctx, {
      title: "The Library",
      bodyClass: "shelf-page",
      body: `<main>
<h1>The Library</h1>
<p class="lede">Four classic books. This shelf has no server behind it: it was published to the Autonomi network once, paid for once, and has no hosting bill to renew.</p>
<ul class="shelf">
${shelf}
</ul>
<p class="credit">The texts are the <a href="https://standardebooks.org/">Standard Ebooks</a> editions, which their editors dedicate to the public domain. Every author here died more than seventy years ago.</p>
</main>`,
    }),
  );

  for (const b of BOOKS) {
    files.set(
      `books/${b.slug}/index.html`,
      page(ctx, {
        title: `${b.title} · The Library`,
        bodyClass: "book-page",
        body: `<main>
<article class="book-text">
<header class="book-head">
  <h1>${ctx.esc(b.title)}</h1>
  <p class="byline">${ctx.esc(b.author)}, ${b.year}</p>
</header>
${await content(b.slug)}
</article>
<p class="credit">Text from the <a href="https://standardebooks.org/ebooks/${b.source}">Standard Ebooks edition</a>, dedicated to the public domain. <a href="/">Back to the shelf</a>.</p>
</main>`,
      }),
    );
  }

  files.set(
    "404.html",
    page(ctx, {
      title: "Not on this shelf · The Library",
      body: `<main>
<h1>Not on this shelf</h1>
<p><a href="/">Back to the Library</a></p>
</main>`,
    }),
  );

  return files;
}
