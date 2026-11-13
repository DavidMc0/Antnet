// Antnet Start (DEMO.md 3.1): the hub, reached through a pointer, linking to every demo site
// by its immutable address. The look is in static/style.css; this file builds the page.

export const meta = {
  title: "Antnet Start",
  description: "A small web of sites that live on the Autonomi network.",
};

export const settings = {};

/**
 * Start fetches each listed site in a hidden frame before it is clicked (DEMO.md 5.2), so it
 * may frame other sites. Which loader domain they are on isn't known when Start is built, so
 * this allows any https site, plus localhost for local testing. Start frames only the
 * warm-up paths of the sites it lists itself.
 */
export const cspExtra = "frame-src 'self' https: http://localhost:* http://*.localhost:*";

const size = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} kB`);
const short = (address) => `${address.slice(0, 4)}…${address.slice(-4)}`;

// Inline SVG only uses presentation attributes, so it needs no inline styles (the CSP forbids them).
const svg = (body, box = "0 0 24 24", cls = "") =>
  `<svg${cls ? ` class="${cls}"` : ""} viewBox="${box}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

/** The mark: three dots in a row. An ant, and three nodes on a network. */
const MARK = `<svg class="mark" viewBox="0 0 44 18" fill="currentColor" aria-hidden="true"><circle cx="8" cy="10" r="6.5"/><circle cx="22" cy="10" r="3.6"/><circle cx="35" cy="10" r="5"/><path d="M37.5 5.5l3-4M39.5 8l4-2.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;

const ARROW = svg('<path d="M5 12h14M13 6l6 6-6 6"/>', "0 0 24 24", "arrow");

/** One glyph per site; sites not listed here get the plain dot. */
const ICONS = {
  library: svg('<path d="M12 6.6C10 5.2 7.4 4.6 4.5 4.6v13c2.9 0 5.5.6 7.5 2 2-1.4 4.6-2 7.5-2v-13c-2.9 0-5.5.6-7.5 2zM12 6.6v13"/>'),
  colonysim: svg('<circle cx="5.5" cy="12" r="3"/><circle cx="12" cy="12" r="1.9"/><circle cx="18.3" cy="12" r="2.6"/><path d="M20 9.6l1.6-2.2"/>'),
  cinema: svg('<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M10.2 9.2v5.6l4.8-2.8z"/>'),
  docs: svg('<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20zM14 3.5v4h4M9.8 12h5.4M9.8 15.5h5.4"/>'),
  default: svg('<circle cx="12" cy="12" r="3.2"/>'),
};

const STEPS = [
  ["connect", "Connect", "to the Autonomi network, straight from your browser."],
  ["find", "Find", "the latest version, by reading this site's pointer."],
  ["fetch", "Fetch", "its records from the nodes that hold them."],
  ["check", "Check", "every byte against the address."],
  ["hand", "Hand over", "to your browser, which serves the site from now on."],
];

const COMMANDS = [
  ["Pack a folder that has an index.html", "node tools/pack.mjs my-site/ my-site.tar"],
  ["Upload it. This is the one time you pay", "ant file upload my-site.tar --public"],
  // start.js replaces the host with the loader the visitor is actually using.
  ["Turn the address it prints into a link", 'node tools/link.mjs i &lt;address&gt; --root <span data-loader-root>antnet.autonomirror.com</span>'],
];

const FINE_PRINT = [
  "A first visit to each site takes several seconds while it is fetched and checked. Return visits are instant.",
  "Some networks block the kind of connection this needs. If a site won't load, try another network.",
  "These are static sites and apps. There is no server-side code.",
  "A small share of content on the network can't yet be reached from browsers.",
  "The loader still comes from an ordinary web host. The first time you open each site, the host sends the same small loader page, which then fetches the site from the network; the host never sends a site's content. The loader is small and open source, and anyone can run their own.",
  "Short names like “library” come from a directory kept by Antnet, in public. The address behind each one is shown on its info page.",
  "Antnet is an independent proof of concept, not an Autonomi Foundation product.",
];

export async function build(ctx) {
  const cards = ctx.sites
    .map(
      (s) => `    <li class="card" data-site="${ctx.esc(s.name)}">
      <a class="card-link" href="${s.href}">
        <span class="card-icon">${ICONS[s.name] ?? ICONS.default}</span>
        <span class="card-title">${ctx.esc(s.meta.title)}</span>
        <span class="card-desc">${ctx.esc(s.meta.description)}</span>
        <span class="card-meta"><code>${ctx.esc(s.name)}</code><span>${size(s.bytes)}</span><span class="card-go">Open ${ARROW}</span></span>
        <span class="card-status" data-status>Not fetched yet</span>
      </a>
    </li>`,
    )
    .join("\n");

  // What the most recently listed site cost to publish, when that was recorded.
  const lastCost = [...ctx.sites].reverse().find((s) => s.cost);

  const steps = STEPS.map(
    ([id, label, detail], i) => `    <li data-step="${id}">
      <span class="step-n">${i + 1}</span>
      <b>${label}</b>
      <span class="step-d">${detail}</span>
      <span class="t"></span>
    </li>`,
  ).join("\n");

  const versions = ctx.versions.length
    ? `<section class="versions" aria-labelledby="versions-h">
  <div class="section-head">
    <h2 id="versions-h">Earlier versions</h2>
    <p>Every version of this page ever published is still there, at its own address.</p>
  </div>
  <ul>
${ctx.versions
  .map(
    (v) =>
      `    <li><a href="${v.href}">Version ${v.number}</a><span>${ctx.esc(v.date)}</span><code title="${v.address}">${short(v.address)}</code></li>`,
  )
  .join("\n")}
  </ul>
</section>`
    : "";

  const index = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Antnet Start</title>
${ctx.headTags}
<link rel="stylesheet" href="/style.css">
<script src="/start.js" defer></script>
</head>
<body>
<header class="top">
  <span class="brand">${MARK}<span>antnet</span></span>
  <a class="top-link" href="/_autonomi/">This visit</a>
</header>

<main>
<section class="hero">
  <h1>Antnet Start</h1>
  <p class="claim"><span class="claim-a">This site wasn't sent by a web server.</span> <span class="claim-b">Your browser fetched it directly from Autonomi nodes and checked every piece itself.</span></p>
  <p class="tagline">A small web of sites that live on the Autonomi network.</p>
  ${ctx.receipt.replace('class="antnet-receipt"', 'class="antnet-receipt receipt-main"')}
  <!-- Opened by its full address, the long name in the address bar is the story. Opened by
       short name, start.js swaps in the line about what the name stands for. -->
  <p class="address-note" data-note="address">${svg('<path d="M12 19V5M6 11l6-6 6 6"/>', "0 0 24 24", "up")}<span>That long name in the address bar is this site's address on the network. It is also how your browser knows nothing was changed.</span></p>
  <p class="address-note" data-note="name" hidden>${svg('<path d="M12 19V5M6 11l6-6 6 6"/>', "0 0 24 24", "up")}<span><code data-name></code> is a short name for this site's address on the network, <button type="button" class="address-toggle" aria-expanded="false" title="Show the full address"><code data-address-short></code></button>. That address is also how your browser knows nothing was changed.<code class="address-full" data-address-full hidden></code></span></p>
</section>

<section class="directory" aria-labelledby="directory-h">
  <div class="section-head">
    <h2 id="directory-h">Sites</h2>
    <p>Each one is its own website, with its own address and its own look. While you read, this page fetches them from the network, one at a time, where your browser allows it.</p>
  </div>
  <ul class="cards">
${cards}
  </ul>
</section>

<section class="journey" aria-labelledby="journey-h" hidden>
  <div class="section-head">
    <h2 id="journey-h">How this page reached you</h2>
    <p>Five steps, timed on this visit. <a href="/_autonomi/">Full details</a></p>
  </div>
  <ol class="steps">
${steps}
  </ol>
</section>

<!-- Where this page came from (DEMO.md 4.5). start.js fills it from the loader's record of
     this visit; without a record it stays hidden. -->
<section class="origin" aria-labelledby="origin-h" hidden>
  <h2 id="origin-h">Where this page came from</h2>
  <p class="origin-lead" data-origin="lead"></p>
  <p class="origin-sub" data-origin="sub"></p>
  <ul class="records" data-origin="records"></ul>
  <p class="origin-sub" data-origin="arrivals"></p>
  <p class="origin-tip">${svg('<path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13.5 6l-3 12"/>')}<span>Check it yourself: open your browser's developer tools and reload. In the Network tab, every file of this site is marked as served by the service worker, from your browser's own storage. None was requested from a web server: the site arrived over direct connections to the nodes.</span></p>
</section>

${versions}

<section class="publish" aria-labelledby="publish-h">
  <div class="publish-text">
    <h2 id="publish-h">What would you put here?</h2>
    <p>Any folder with an <code>index.html</code> can be a site. You pay once, when you upload, and there is nothing to renew.</p>
${lastCost ? `    <p>The last site published here, ${ctx.esc(lastCost.meta.title)}, cost ${ctx.esc(lastCost.cost)}.</p>\n` : ""}    <p>The tools are in the <a href="https://github.com/DavidMc0/Antnet">Antnet repository</a>.</p>
  </div>
  <ol class="commands">
${COMMANDS.map(([what, cmd]) => `    <li><span class="cmd-what">${what}</span><code>${cmd}</code></li>`).join("\n")}
  </ol>
</section>

<section class="fineprint" aria-labelledby="fine-h">
  <h2 id="fine-h">Fine print</h2>
  <ul>
${FINE_PRINT.map((line) => `    <li>${ctx.esc(line)}</li>`).join("\n")}
  </ul>
</section>
</main>

<footer class="foot">
  <span class="brand">${MARK}<span>antnet</span></span>
  <span>An independent proof of concept. <a href="https://github.com/DavidMc0/Antnet">Source</a></span>
</footer>
</body>
</html>
`;

  return new Map([["index.html", index]]);
}
