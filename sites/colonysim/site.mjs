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
  description: "An ant colony that lives in your browser. Drop food, draw walls, and come back tomorrow.",
};

export const settings = {};

/** The script, bundled once per run. It doesn't use the Autonomi client, so the shared policy is enough. */
let appFiles;
const app = () =>
  (appFiles ??= bundleScript({ entry: new URL("src/main.ts", import.meta.url), root: new URL(".", import.meta.url), dir: "app", name: "main" }));

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
${ctx.headTags}
<link rel="stylesheet" href="/style.css">
<script type="module" src="/app/main.js"></script>
</head>
<body>
<header class="masthead">
  <a class="home" href="/">ColonySim</a>
  ${ctx.startLink}
</header>
<main>
  <h1>Your ant colony</h1>
  <p class="lede">Drop food and watch the ants find it. Draw walls and watch the trails re-form around them.</p>

  <div class="stage">
    <canvas id="colony" aria-label="The ant colony. Click or drag to place food or walls."></canvas>
    <p class="corner"><strong data-day>Day 1</strong> of your colony. It lives in your browser, on this site's own address.</p>
  </div>

  <div class="controls" role="toolbar" aria-label="Colony tools">
    <div class="tools" role="group" aria-label="What a click places">
      <button type="button" data-brush="food" aria-pressed="true">Food</button>
      <button type="button" data-brush="wall" aria-pressed="false">Wall</button>
      <button type="button" data-brush="erase" aria-pressed="false">Clear</button>
    </div>
    <div class="run" role="group" aria-label="Running">
      <button type="button" data-action="pause" aria-pressed="false">Pause</button>
      <button type="button" data-action="speed" aria-pressed="false">Faster</button>
    </div>
  </div>

  <p class="stats"><span data-ants>0</span> ants · <span data-delivered>0</span> crumbs brought home</p>
  <p class="storage-warning" data-storage hidden>This browser won't let the page save, so the colony will start again next time.</p>

  <section class="about">
    <h2>How it works</h2>
    <p>Ants looking for food leave a faint scent that leads home. Ants carrying food leave a stronger one that leads back to it. Each follows the other's scent, so the busiest paths become trails, and a trail fades once its food runs out.</p>
    <p>The colony is saved every few seconds in your browser's storage for <code data-origin></code>. Every Autonomi site here has its own address, so its storage is its own: no other site can read your colony, and nothing is sent anywhere.</p>
    <p><button type="button" class="quiet" data-action="new">Start a new colony</button></p>
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
