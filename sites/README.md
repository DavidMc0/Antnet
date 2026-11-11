# Demo sites

The linked sites from [DEMO.md](../DEMO.md). Each site is built into one archive and uploaded to Autonomi. Antnet
Start is the hub: it is reached through a pointer and links to every other site.

```
sites/
  build.mjs          builds every site; keeps track of uploads in addresses.json
  addresses.json     Start's pointer, each uploaded site's address, Start's versions (created on first record)
  shared/            pieces every site includes: receipt.js, antnet.css
  start/             Antnet Start: site.mjs builds index.html; static/ is copied as-is
  library/           The Library: site.mjs, static/, books.mjs, content/ (the book texts)
```

## Working on a site locally

```sh
npm run fixtures   # rebuilds the test fixtures, including every demo site
npm run dev        # http://localhost:5173/, which lists "demo: Antnet Start" and "demo: The Library"
npm run test:e2e   # all browser tests, including tests/e2e/demo.spec.ts
```

The demo sites are linked locally exactly as on mainnet, only with test addresses. After changing a site, run
`npm run fixtures` again and reload. A site is installed once per origin, so to see changes use the site's info page
(`/_autonomi/`), then **Clear this site's data**, or use a fresh browser profile.

## The look of each site

- **Antnet Start** is calm and confident:
  - cool paper, deep green ink and one accent;
  - Instrument Sans for text, with JetBrains Mono for every number and address, so each claim reads like a
    measurement;
  - a mark of three dots in a row (an ant, and three nodes on a network), repeated in the five-step trail.
- **The Library** is bookish:
  - cream paper, with Literata throughout;
  - each book has one cloth colour, used for its cover on the shelf and its title page;
  - chapters open with a raised initial and a first line in small capitals;
  - each book has a contents list and a reading time, both built from the text.

Fonts are bundled in each site's `static/fonts/`, with their licence files (SIL Open Font License). They are the
Latin subsets from the Fontsource packages.

In each page's `<head>`, `ctx.headTags` comes **before** the site's own stylesheet, so the site's CSS can restyle
the shared receipt and Start link.

## Rules for the design pass

The look of each site is free to change. These parts are load-bearing:

- **No inline styles or scripts, and nothing from outside the archive.** Every site declares
  `default-src 'self'` (see `CSP` in `build.mjs`). That means:
  - no `style="…"` attributes and no `<style>` or `<script>` blocks;
  - no web fonts, images or scripts from other hosts.

  Put fonts, images and scripts in the site's `static/` folder. That is also what makes the offline moment work.
- **Keep `ctx.headTags`, `ctx.startLink` and `ctx.receipt`** in every page. They are:
  - `headTags`: the shared stylesheet and the receipt script;
  - `startLink`: the link back to Start;
  - `receipt`: the line that fills in with this visit's numbers.

  Restyle them from the site's own CSS (`.antnet-start`, `.antnet-receipt`); don't remove them.
- **Links to other sites come from `ctx`:** `ctx.startHref` and `ctx.hrefFor(name)`. On Start, the `href` of each
  entry in `ctx.sites` is the link to that site. These are portable `/_autonomi/go/…` links, which work on any
  loader domain and offline. Never write a site's address or a loader domain into a page by hand.
- **Light and dark themes,** following `prefers-color-scheme`.
- **Each archive under 12 MiB,** so it stays four network records. `node sites/build.mjs` prints the sizes.
- **Start's elements that tests or scripts rely on:**
  - `.cards` and `.card-link`;
  - `.receipt-main`;
  - `.journey`, with its `data-step` items and `.t` spans, filled by `static/start.js`.

  The Library's are `.shelf`, `.book` and `.book-head`. Rename any of these only together with
  `tests/e2e/demo.spec.ts`.
- **The Library's credit lines stay:** each book credits its Standard Ebooks edition. Don't use Standard Ebooks' name
  or logo as branding.

## Publishing (mainnet)

Run `node sites/build.mjs`. It builds what it can into `publish/sites/` and prints the next commands:
1. **Record Start's pointer address.** This needs a key from `ant pointer keygen`.
2. **Upload each content site** and record its address.
3. **Build Start**, upload it, record it, then create or update the pointer.

If a site changes after it was uploaded, the build says so, before Start can link to a stale copy.
