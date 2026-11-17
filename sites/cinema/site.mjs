// Cinema (DEMO.md 3.4): one short film, streamed from its own address on Autonomi. The
// site's archive holds only the page, the poster and the Autonomi browser client; the film is
// fetched piece by piece as it plays (DEMO.md 5.8). The look is in static/style.css, the
// player in src/player.js; this file builds the page and bundles the player.

import { bundleScript } from "../shared/bundle.mjs";
import { BUTTON_CSS, downloadButtons } from "../shared/button.mjs";

export const meta = {
  title: "Cinema",
  description: "A ten-minute video, streamed straight from the network, with no video host.",
};

export const settings = {};

/**
 * The player runs the Autonomi browser client, which is WebAssembly and connects straight to
 * nodes, so this site's policy allows both (the other demo sites allow neither). The film's
 * bytes reach the <video> through the loader's worker on this origin, so media stays 'self'.
 */
export const csp =
  "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self'; " +
  "script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https: wss:; " +
  "object-src 'none'; base-uri 'none'; form-action 'none'";

/** The film: a public file on Autonomi. PROGRESS.md records how it was made and checked. */
const FILM = {
  title: "Big Buck Bunny",
  address: "b1d797857bfb241c5123164b86cb78882f78d24c0d57a5567cbc67739bf7f13c",
  bytes: 251070017,
  records: 64,
  type: "video/mp4",
  file: "big-buck-bunny-1080p.mp4",
  runtime: "10 min 35 s",
  seconds: 634.6,
  cost: "3.43 ANT",
};

/**
 * The copies of the film, best first (src/player.js, "Quality"). Each is its own public file,
 * made as PROGRESS.md records and recorded with
 * `node sites/build.mjs record file publish/media/<file> <address> --cost "<n> ANT"`; the page
 * offers the 1080p film and those recorded. `codec` and the size and frame rate let the player
 * ask the browser whether it can decode a copy smoothly; `peak` is its busiest 10 s, in Mbit/s.
 */
const COPIES = [
  { label: "4K 60 fps", prose: "4K at 60 frames a second", file: "big-buck-bunny-2160p60.mp4", width: 3840, height: 2160, fps: 60, codec: "avc1.640034", peak: 18.2 },
  { label: "4K", prose: "4K", file: "big-buck-bunny-2160p30.mp4", width: 3840, height: 2160, fps: 30, codec: "avc1.640033", peak: 16.5 },
  { label: "1080p", prose: "1080p", file: FILM.file, width: 1920, height: 1080, fps: 30, codec: "avc1.640029", peak: 6.7 },
  { label: "720p", prose: "720p", file: "big-buck-bunny-720p.mp4", width: 1280, height: 720, fps: 30, codec: "avc1.640028", peak: 1.7 },
];

const NUMBERS = ["", "one", "two", "three", "four", "five"];
const andList = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

const megabytes = (n) => `${Math.round(n / 1e6)} MB`;
const short = (address) => `${address.slice(0, 4)}…${address.slice(-4)}`;

const svg = (body, cls) =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${body}</svg>`;
const PLAY = svg('<path d="M8.2 5.3v13.4a.6.6 0 0 0 .92.5l10.4-6.7a.6.6 0 0 0 0-1L9.12 4.8a.6.6 0 0 0-.92.5z"/>', "play-icon");

/** The player script with the Autonomi client (player/player.js and its WebAssembly), bundled once per run. */
let playerFiles;
const player = () =>
  (playerFiles ??= bundleScript({ entry: new URL("src/player.js", import.meta.url), root: new URL(".", import.meta.url), dir: "player", licences: true }));

/** "How it reaches your screen", first point: what is stored, and what it cost. */
function howStored(films) {
  if (films.length === 1) {
    return [
      "The video has its own address",
      `It is one ${megabytes(FILM.bytes)} file on the Autonomi network, stored as ${FILM.records} records. It was uploaded once, for ${FILM.cost}, and nothing more is paid however many people watch.`,
    ];
  }
  const costs = films.map((f) => Number.parseFloat(f.cost));
  const total = costs.every(Number.isFinite) ? `, for ${costs.reduce((a, b) => a + b, 0).toFixed(2)} ANT in all` : "";
  return [
    "Each quality has its own address",
    `The video is ${NUMBERS[films.length] ?? films.length} files on the Autonomi network, one for each quality: ${andList(films.map((f) => `${megabytes(f.bytes)} in ${f.prose}`))}. Each was uploaded once${total}, and nothing more is paid however many people watch.`,
  ];
}

const HOW = [
  [
    "Fetched as you watch",
    "Your browser asks the network only for the part you are watching, a piece at a time, and checks each piece before it plays. Skip ahead and it fetches from there.",
  ],
  [
    "Your browser is the player",
    "This page carries its own Autonomi client, which holds the connections while the video plays. Keep the tab open: close it and the stream stops, as on any website.",
  ],
];

const FINE_PRINT = [
  "The first frame takes a few seconds, while your browser finds the video on the network.",
  "Skipping far ahead can take ten seconds or more: that part has to be found and fetched first.",
  "Some networks block the kind of connection this needs. If the video won't start, try another network.",
];

export async function build(ctx) {
  const files = new Map(await player());

  // "Download this film": a button made by the Download Button's generator (DEMO.md 3.6), leading
  // to the download page on this loader, which is itself on Autonomi.
  const buttons = downloadButtons();
  const filmButton = await buttons.add({
    style: "dark",
    href: ctx.hrefFor("download", `/f/ant/${FILM.address}?n=${encodeURIComponent(FILM.file)}&s=${FILM.bytes}`),
    fileName: FILM.file,
    size: FILM.bytes,
    address: FILM.address,
  });
  files.set(BUTTON_CSS, buttons.css());

  // The copies the player may play, best first: the 1080p film and those recorded.
  const films = COPIES.flatMap((c) => {
    const at = c.file === FILM.file ? { address: FILM.address, bytes: FILM.bytes, cost: FILM.cost } : ctx.files?.[c.file];
    return at ? [{ ...c, ...at, type: FILM.type, seconds: FILM.seconds }] : [];
  });
  const has = (label) => films.some((f) => f.label === label);
  const has4k = films.some((f) => f.height === 2160);
  // What the player needs, and no more (no costs or prose).
  const playerFilms = films.map(({ label, address, bytes, type, file, seconds, width, height, fps, codec, peak }) => ({
    label, address, bytes, type, file, seconds, width, height, fps, codec, peak,
  }));
  const menu =
    films.length > 1
      ? `<p class="quality-pick" data-quality-menu hidden><label for="quality">Quality</label> <select id="quality" data-quality-pick><option value="auto">Auto</option>${films
          .map((f) => `<option value="${ctx.esc(f.label)}">${ctx.esc(f.label)}</option>`)
          .join("")}</select></p>`
      : "";

  const how = [howStored(films), ...HOW].map(
    ([title, text], i) => `    <li>
      <span class="how-n">${i + 1}</span>
      <h3>${ctx.esc(title)}</h3>
      <p>${ctx.esc(text)}</p>
    </li>`,
  ).join("\n");

  files.set(
    "index.html",
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cinema · ${ctx.esc(FILM.title)}</title>
${ctx.headTags}
<link rel="stylesheet" href="/style.css">
<link rel="stylesheet" href="/${BUTTON_CSS}">
<script type="module" src="/player/player.js"></script>
</head>
<body>
<header class="marquee">
  <a class="sign" href="/" aria-label="Cinema"><span class="sign-text">Cinema</span></a>
  ${ctx.startLink}
</header>

<main>
<section class="feature" aria-labelledby="film-h">
  <p class="now">Now showing</p>
  <h1 id="film-h">${ctx.esc(FILM.title)}</h1>
  <p class="billing">2008 <span aria-hidden="true">·</span> ${ctx.esc(FILM.runtime)} <span aria-hidden="true">·</span> ${has4k ? "Up to 4K" : "1080p"} <span aria-hidden="true">·</span> Blender Foundation</p>

  <!-- The screen. player.js connects and opens the film as soon as the page loads, behind the
       poster, so pressing play starts it quickly. The film's details are here, not in the script. -->
  <div class="screen" data-player data-state="preparing"
       data-films="${ctx.esc(JSON.stringify(playerFilms))}">
    <div class="frame">
      <video class="film" playsinline preload="metadata" poster="/poster.webp" aria-label="${ctx.esc(FILM.title)}"></video>
      <button class="play" type="button" data-play aria-label="Play ${ctx.esc(FILM.title)}">${PLAY}</button>
      <p class="status" role="status"><span class="status-dot" aria-hidden="true"></span><span data-status>Connecting to Autonomi…</span></p>
      <div class="trouble" data-trouble hidden>
        <p class="trouble-title" data-trouble-title></p>
        <p class="trouble-text" data-trouble-text></p>
        <button class="retry" type="button" data-retry>Try again</button>
      </div>
    </div>
    <div class="readout">
      <p class="meter">Streamed so far: <strong data-streamed>nothing yet</strong> <span class="meter-of">from the Autonomi network</span><span class="meter-ahead" hidden><span class="meter-sep"> · </span><strong data-ahead></strong> ready ahead, in <strong data-quality></strong></span></p>
      ${menu}
      <p class="visit" data-visit hidden></p>
    </div>
  </div>
</section>

<section class="claim" aria-labelledby="claim-h">
  <h2 id="claim-h">No video host.</h2>
  <p>This video streams from Autonomi nodes, and its publisher pays nothing more however many people watch.</p>
</section>

<section class="take-home" aria-labelledby="take-home-h">
  <h2 id="take-home-h">Take a copy home</h2>
  <p>This button was made with the <a href="${ctx.hrefFor("download")}">Download Button</a>, and pasted in as any website would. It leads to a download page that is on Autonomi too, and your browser checks every piece of the video as it saves it.</p>
  <div class="take-home-button">${filmButton}</div>
  <p class="take-home-note">Chrome and Edge save it straight to disk; other browsers hold it in memory first.</p>
</section>

<section class="how" aria-labelledby="how-h">
  <h2 id="how-h">How it reaches your screen</h2>
  <ol>
${how}
  </ol>
  <p class="address">The video's address on the network: <code title="${FILM.address}">${short(FILM.address)}</code> <button class="address-toggle" type="button" data-address-toggle aria-expanded="false">Show all of it</button><code class="address-full" data-address-full hidden>${FILM.address}</code></p>
</section>

<section class="small-print" aria-labelledby="print-h">
  <h2 id="print-h">Before the lights go down</h2>
  <ul>
${FINE_PRINT.map((line) => `    <li>${ctx.esc(line)}</li>`).join("\n")}
  </ul>
</section>
</main>

<footer class="credits">
  <p class="credit-film"><cite>${ctx.esc(FILM.title)}</cite> © 2008 Blender Foundation, <a href="https://www.bigbuckbunny.org/">bigbuckbunny.org</a>, shown under <a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>. The 5.1 soundtrack was left out; nothing else was changed.${has("720p") ? " The 720p copy was re-encoded from it." : ""}${has4k ? " The 4K copies are Blender's own 2160p releases, likewise without the 5.1 soundtrack." : ""}</p>
  <p class="credit-site">${ctx.published ? `This page was published ${ctx.longDate(ctx.published)}.` : "This page was published once."} Paid for once. No renewal.</p>
  ${ctx.receipt}
</footer>
</body>
</html>
`,
  );

  return files;
}
