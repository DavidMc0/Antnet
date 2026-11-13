// ColonySim (DEMO.md 3.3): an ant colony that forages and lays trails on a canvas. The visitor
// drops food and draws walls, and the colony keeps itself in the browser's storage for this
// site's own origin, so it is still there after a reload, with no account and no server.
//
// The simulation is in src/sim.ts, saving in src/save.ts, drawing in src/render.ts and the page
// in src/main.ts; this file builds the page and bundles the script. The look is in
// static/style.css, including the colony's colours (the --sim-* properties).

import { bundleScript } from "../shared/bundle.mjs";

export const meta = {
  title: "ColonySim",
  description: "An ant colony that lives in your browser. Feed it and watch it grow, draw walls, and come back tomorrow.",
};

export const settings = {};

/** The script, bundled once per run. It doesn't use the Autonomi client, so the shared policy is enough. */
let appFiles;
const app = () =>
  (appFiles ??= bundleScript({ entry: new URL("src/main.ts", import.meta.url), root: new URL(".", import.meta.url), dir: "app", name: "main" }));

const icon = (body, cls = "icon") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICON = {
  // An ant from above: three body parts, six legs, two feelers.
  ant: icon(
    '<circle cx="6.2" cy="12" r="3.2" fill="currentColor" stroke="none"/><circle cx="12.4" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="17.6" cy="12" r="2.5" fill="currentColor" stroke="none"/><path d="M11 10.6 9.2 6.4M12.4 10 12.8 5.6M13.8 10.6l2-3.8M11 13.4l-1.8 4.2M12.4 14l.4 4.4M13.8 13.4l2 3.8M19.4 10.4l2.2-2.6M19.4 13.6l2.2 2.6" stroke-width="1.7"/>',
    "icon mark",
  ),
  leaf: icon('<path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14zM5 19l8-8"/>'),
  pebble: icon('<path d="M3.5 15.5c0-3 2.2-5 5-5s5 1.6 5 4.4-2.4 4.1-5.2 4.1-4.8-1-4.8-3.5zM13 9.8c.3-2.5 2-4.3 4.3-4.3s3.7 1.7 3.7 4-1.6 4-3.9 4"/>'),
  // An eraser.
  sweep: icon('<path d="M8.5 20 4.2 15.7a2 2 0 0 1 0-2.8l8.7-8.7a2 2 0 0 1 2.8 0l4.1 4.1a2 2 0 0 1 0 2.8L11 20zM9.2 9.6l5.2 5.2M8.5 20H20"/>'),
  pause: icon('<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="2.6"/>', "icon icon-pause"),
  play: icon('<path d="M8 5.2v13.6a.5.5 0 0 0 .77.42l10.3-6.8a.5.5 0 0 0 0-.84L8.77 4.78A.5.5 0 0 0 8 5.2z" fill="currentColor" stroke="none"/>', "icon icon-play"),
  faster: icon('<path d="M4.5 6.5 11 12l-6.5 5.5M13 6.5l6.5 5.5-6.5 5.5"/>'),
  sun: icon('<circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>', "icon sky-sun"),
  moon: icon('<path d="M19.5 14.2A8 8 0 0 1 9.8 4.5a8 8 0 1 0 9.7 9.7z" fill="currentColor" stroke="none"/>', "icon sky-moon"),
  lock: icon('<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
  trail: icon('<path d="M3 17c4 0 4-10 9-10s5 10 9 10" stroke-dasharray="0.1 3.6" stroke-width="2.6"/>'),
};

export async function build(ctx) {
  const files = new Map(await app());
  files.set(
    "index.html",
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ColonySim</title>
<meta name="description" content="${ctx.esc(meta.description)}">
<meta name="theme-color" content="#c4552d">
<link rel="preload" href="/fonts/fredoka.woff2" as="font" type="font/woff2" crossorigin>
${ctx.headTags}
<link rel="stylesheet" href="/style.css">
<script type="module" src="/app/main.js"></script>
</head>
<body>
<header class="masthead">
  <a class="home" href="/">${ICON.ant}<span>ColonySim</span></a>
  ${ctx.startLink}
</header>
<main>
  <div class="intro">
    <h1>Your ant colony</h1>
    <p class="lede">Scatter some leaf and the ants will find it. Keep them fed and the colony grows. Wall the food off with pebbles and watch the trail find a way round.</p>
  </div>

  <div class="stage" data-time="morning">
    <canvas id="colony" aria-label="The ant colony, seen from above. Click or drag to place food or walls."></canvas>
    <p class="corner">
      <span class="sky" aria-hidden="true">${ICON.sun}${ICON.moon}</span>
      <span class="corner-text"><strong data-day>Day 1</strong> of your colony<span class="corner-more">. It lives in your browser, on this site's own address.</span></span>
      <span class="day-bar" aria-hidden="true"></span>
    </p>
    <p class="paused-note" aria-hidden="true">Paused</p>
    <p class="toast" data-toast role="status" hidden></p>
  </div>
  <p class="corner-under">Your colony lives in your browser, on this site's own address.</p>

  <div class="controls" role="toolbar" aria-label="Colony tools">
    <div class="tools" role="group" aria-label="What a click places">
      <button type="button" class="tool tool-food" data-brush="food" aria-pressed="true" title="Scatter leaf for the ants (F)">${ICON.leaf}<span>Food</span><kbd>F</kbd></button>
      <button type="button" class="tool tool-wall" data-brush="wall" aria-pressed="false" title="Lay a wall of pebbles (W)">${ICON.pebble}<span>Wall</span><kbd>W</kbd></button>
      <button type="button" class="tool tool-erase" data-brush="erase" aria-pressed="false" title="Sweep food and walls away (C)">${ICON.sweep}<span>Clear</span><kbd>C</kbd></button>
    </div>
    <div class="run" role="group" aria-label="Running">
      <button type="button" class="tool" data-action="pause" aria-pressed="false" title="Pause or run (space)">${ICON.pause}${ICON.play}<span data-label>Pause</span></button>
      <button type="button" class="tool" data-action="speed" aria-pressed="false" title="Four times as fast, or back to normal (.)">${ICON.faster}<span data-label>Faster</span></button>
    </div>
  </div>

  <div class="readout">
    <div class="larder" data-larder data-mood="fed">
      <p class="larder-head"><span class="larder-title">${ICON.leaf}Larder</span> <strong data-mood-label>Well fed</strong></p>
      <div class="meter" data-meter role="meter" aria-label="How full the larder is" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="meter-fill"></span><span class="meter-mark" title="Above this line, new ants hatch"></span></div>
      <p class="larder-note" data-mood-note>Enough to eat, but not enough to raise new ants.</p>
    </div>
    <div class="stats">
      <p class="stat"><span class="stat-number" data-ants>0</span> <span class="stat-label">ants</span> <span class="trend" data-trend="steady"></span></p>
      <p class="stat"><span class="stat-number" data-delivered>0</span> <span class="stat-label">pieces of leaf brought home</span></p>
      <p class="stat stat-time"><span class="stat-number" data-time-label>Morning</span> <span class="stat-label">in the colony</span></p>
      <ul class="legend" aria-label="What the trails mean">
        <li><span class="swatch swatch-trail"></span>the way to food</li>
        <li><span class="swatch swatch-home"></span>the way home</li>
      </ul>
    </div>
  </div>
  <p class="storage-warning" data-storage hidden>This browser won't let the page save, so the colony will start again next time.</p>

  <section class="about" aria-labelledby="about-h">
    <h2 id="about-h">How it works</h2>
    <div class="cards">
      <article class="card">
        <h3>${ICON.trail}Two scents</h3>
        <p>An ant looking for food leaves a faint scent that leads home. An ant carrying food leaves a stronger one that leads back to it. Each follows the other's.</p>
      </article>
      <article class="card">
        <h3>${ICON.leaf}A colony to feed</h3>
        <p>The busiest paths smell strongest, so they turn into trails, and a blocked trail re-forms round the wall. The ants eat what they bring home. Keep the larder full and the colony grows; let it run dry and it shrinks.</p>
      </article>
      <article class="card">
        <h3>${ICON.lock}Yours alone</h3>
        <p>The colony is saved every few seconds in your browser's storage for <code data-origin></code>. Every Autonomi site here has its own address, so its storage is its own: no other site can read your colony, and nothing is sent anywhere.</p>
      </article>
    </div>
    <p class="again"><button type="button" class="quiet" data-action="new">Start a new colony</button></p>
  </section>
</main>
<footer class="colophon">
  <p>${ctx.published ? `Published ${ctx.longDate(ctx.published)}.` : "Published once."} Paid for once. No renewal.</p>
  ${ctx.receipt}
</footer>
</body>
</html>
`,
  );
  return files;
}
