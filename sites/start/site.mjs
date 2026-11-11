// Antnet Start (DEMO.md 3.1): the hub, reached through a pointer, linking to every demo site
// by its immutable address. Plain structure for now; the look comes in the design pass.

export const meta = {
  title: "Antnet Start",
  description: "A small web of sites that live on the Autonomi network.",
};

export const settings = {};

const size = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} kB`);

export async function build(ctx) {
  const cards = ctx.sites
    .map(
      (s) => `    <li class="card" data-site="${ctx.esc(s.name)}">
      <a class="card-link" href="${s.href}">
        <span class="card-title">${ctx.esc(s.meta.title)}</span>
        <span class="card-desc">${ctx.esc(s.meta.description)}</span>
        <span class="card-meta">${size(s.bytes)} · <code title="${s.address}">${s.address.slice(0, 4)}…${s.address.slice(-4)}</code></span>
      </a>
    </li>`,
    )
    .join("\n");

  const versions = ctx.versions.length
    ? `<section class="versions" aria-labelledby="versions-h">
  <h2 id="versions-h">Earlier versions</h2>
  <p>Every version of this page ever published is still there, at its own address.</p>
  <ul>
${ctx.versions
  .map((v) => `    <li><a href="${v.href}">Version ${v.number}</a>, ${ctx.esc(v.date)} · <code title="${v.address}">${v.address.slice(0, 4)}…${v.address.slice(-4)}</code></li>`)
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
<link rel="stylesheet" href="/style.css">
${ctx.headTags}
<script src="/start.js" defer></script>
</head>
<body>
<main>
<header class="intro">
  <h1>Antnet Start</h1>
  <p class="tagline">A small web of sites that live on the Autonomi network.</p>
  <p class="address-note">That long name in the address bar is this site's address on the network. It is also how your browser knows nothing was changed.</p>
  ${ctx.receipt.replace('class="antnet-receipt"', 'class="antnet-receipt receipt-main"')}
</header>

<section class="directory" aria-labelledby="directory-h">
  <h2 id="directory-h">Sites</h2>
  <ul class="cards">
${cards}
  </ul>
</section>

<section class="journey" aria-labelledby="journey-h" hidden>
  <h2 id="journey-h">How this page reached you</h2>
  <ol class="steps">
    <li data-step="connect"><b>Connect</b> to the Autonomi network from your browser. <span class="t"></span></li>
    <li data-step="find"><b>Find</b> the latest version, by reading this site's pointer. <span class="t"></span></li>
    <li data-step="fetch"><b>Fetch</b> its records from the nodes that hold them. <span class="t"></span></li>
    <li data-step="check"><b>Check</b> every byte against the address. <span class="t"></span></li>
    <li data-step="hand"><b>Hand over</b> to your browser, which serves the site from now on. <span class="t"></span></li>
  </ol>
  <p><a href="/_autonomi/">Full details for this visit</a></p>
</section>

<section class="try" aria-labelledby="try-h">
  <h2 id="try-h">Try this</h2>
  <p>Open each site once. Then turn off your wifi and keep browsing: everything you've seen still works, because the sites are now on your device, checked and complete.</p>
</section>

${versions}

<section class="publish" aria-labelledby="publish-h">
  <h2 id="publish-h">Publish your own</h2>
  <p>Any folder with an <code>index.html</code> can be a site. Three commands:</p>
<pre><code>node tools/pack.mjs my-site/ my-site.tar
ant file upload my-site.tar --public
node tools/link.mjs i &lt;address&gt; --root antnet.autonomirror.com</code></pre>
  <p>The tools are in the <a href="https://github.com/DavidMc0/Antnet">Antnet repository</a>. You pay once, when you upload.</p>
</section>

<section class="fineprint" aria-labelledby="fine-h">
  <h2 id="fine-h">Fine print</h2>
  <ul>
    <li>A first visit to each site takes several seconds while it is fetched and checked. Return visits are instant.</li>
    <li>Some networks block the kind of connection this needs. If a site won't load, try another network.</li>
    <li>These are static sites and apps. There is no server-side code.</li>
    <li>A small share of content on the network can't yet be reached from browsers.</li>
    <li>The first page (the loader) still comes from an ordinary web host. It is small and open source, and anyone can run their own.</li>
    <li>Antnet is an independent proof of concept, not an Autonomi Foundation product.</li>
  </ul>
</section>
</main>
</body>
</html>
`;

  return new Map([["index.html", index]]);
}
