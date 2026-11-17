// Cinema's player (DEMO.md 3.4, 5.8). Connects to Autonomi and opens the film as soon as the
// page loads, behind the poster, so pressing play starts it quickly. The film's bytes reach
// the <video> through the loader's service worker, which carries the SDK's media bridge: the
// worker turns the player's byte-range requests into messages this page answers. ReadAhead
// (readahead.js) answers them, keeping a window ahead of the player fetched several at once.
//
// The film comes in several copies, each its own file on Autonomi, best first: 4K at 60 and
// 30 frames a second, 1080p and 720p, as many as the page lists. In Auto, the player picks and
// changes copy itself (see "Quality" below); the page's quality menu can fix one instead. With
// one copy listed, it simply plays that.
//
// States, on [data-player]'s data-state:
//   preparing  connecting and opening the film; the poster and play button show
//   waiting    play was pressed before the film was open; it starts as soon as it is
//   ready      the film is open; play starts it at once
//   playing    the browser's own controls take over
//   trouble    something failed; says what, with "Try again"

import { AutonomiClient } from "@withautonomi/ant-browser-sdk";
import { findMoov, keyframeOffset, parseMoov } from "./mp4index.js";
import { ReadAhead } from "./readahead.js";

/** sessionStorage, read safely: a private window or blocked storage just means no override. */
const stored = (key) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

// Read-ahead, in 1 MiB blocks. Before play, only the opening seconds (8 blocks, about 20 s of
// 1080p), so a visit that never plays costs little. Once playing, about 80 s of the copy
// playing, and at least 32 blocks (80 s of 1080p, three minutes of 720p): 4K needs about 80.
// At most 96 blocks, 48 on devices that say they have 4 GB or less, 20 on 2 GB or less.
// 8 blocks (about two of the film's 4 MB records) at a time, 16 for 4K: for 1080p, 16 at a
// time filled the window no faster on mainnet and slowed seeks, whose fetches queue behind
// those already running, but 4K needs over twice the rate.
// sessionStorage "cinemaReadAhead" = "ahead,parallel" fixes both for measuring; "0,1" is the
// old one-block-at-a-time behaviour.
const MEMORY_GB = navigator.deviceMemory ?? 8;
const READ_AHEAD = (() => {
  const plan = { before: 8, seconds: 80, min: 32, max: MEMORY_GB <= 2 ? 20 : MEMORY_GB <= 4 ? 48 : 96, parallel: 8, parallel4k: 16 };
  const [ahead, parallel] = (stored("cinemaReadAhead") ?? "").split(",").map(Number);
  if (Number.isInteger(ahead) && ahead >= 0 && Number.isInteger(parallel) && parallel >= 1) {
    Object.assign(plan, { before: Math.min(ahead, plan.before), fixed: ahead, parallel, parallel4k: parallel });
  }
  return plan;
})();
const MIB = 1024 * 1024;

// ---- Quality --------------------------------------------------------------------------------
// Auto plays only the copies this device suits:
//   - phones (narrow screens) only the smallest, 720p: on a phone screen more looks much the
//     same and costs over twice the data;
//   - 4K only on a screen at least 2560 pixels wide (in device pixels), where the browser says
//     it decodes it smoothly; 4K at 60 frames a second only where it also decodes it
//     efficiently (in hardware); and not on devices that say they have 2 GB or less.
// It starts on the best of them short of 4K (1080p), or the smallest on a phone, when the
// browser says the connection is slow, or data-saving is on. If the opening seconds arrive
// slower than 1.5 times that copy's bitrate by the time play is pressed, it starts on the best
// copy the rate does allow, or the smallest.
//
// While playing, it steps down one copy when what's ready ahead stays under 25 s for 3 s, or
// the video waits on the network for 3 s; not in the 15 s after starting, a seek or a switch,
// while the window fills. It steps up one when 30 s or more is ready, the network has lately
// delivered at least twice that copy's bitrate (1.25 times for 4K: see upFactor4k), and the
// wait since the last step down has passed: 1 min, doubling with each, up to 10 min. Up to
// 1080p, a rate not measured for two minutes will do; 4K needs one measured. So 4K comes, if
// at all, after a while at 1080p.
//
// A copy chosen in the quality menu stays: no steps either way.
//
// A switch throws away what the browser has buffered, so it first fetches the other copy's
// opening seconds from a point a little ahead (found in that copy's MP4 index), while this
// copy plays on from what it holds, and switches when playback reaches that point.
//
// sessionStorage "cinemaQuality" = a copy's label ("1080p", "720p", "4K", ...) plays only that
// copy, for measuring.
// "cinemaThrottle" = megabits per second caps how fast blocks arrive, to try all this on a
// fast connection; Playwright can't slow WebRTC itself. It's read on every block, so a test can
// change it mid-film.
const QUALITY = {
  phone: matchMedia("(max-width: 900px)").matches,
  slowNetwork: navigator.connection?.saveData === true || /(^|-)2g|3g/.test(navigator.connection?.effectiveType ?? ""),
  startFactor: 1.5,
  lowAheadS: 25,
  lowAheadTicks: 3,
  stallMs: 3_000,
  settleMs: 15_000,
  upAheadS: 30,
  upFactor: 2,
  /**
   * For 4K, 1.25 times its bitrate, measured at the 8 fetches at a time the copy below uses: 4K
   * fetches 16 at a time, and on mainnet 8 at a time measured 8 to 12 Mbit/s on a connection
   * that delivered about 26 with 16.
   */
  upFactor4k: 1.25,
  firstBackoffMs: 60_000,
  maxBackoffMs: 600_000,
  /** Seconds of the other copy fetched before a switch to it. */
  switchStartS: 10,
  /** Longest wait for those seconds before switching anyway. */
  switchWaitMs: 30_000,
  /** Longest wait, when play is pressed on a slow connection, for a smaller copy to open. */
  openWaitMs: 5_000,
  /** 4K only on screens at least this wide, in device pixels. */
  screen4kPx: 2560,
};
const SCREEN_PX = Math.max(screen.width, screen.height) * (devicePixelRatio || 1);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A reader whose blocks arrive no faster than sessionStorage "cinemaThrottle" allows. */
let throttleFree = 0;
function throttled(reader) {
  return {
    size: reader.size,
    close: () => reader.close(),
    async read(start, length) {
      const bytes = await reader.read(start, length);
      const mbps = Number(stored("cinemaThrottle"));
      if (mbps > 0) {
        const now = performance.now();
        throttleFree = Math.max(now, throttleFree) + (bytes.byteLength * 8) / (mbps * 1000);
        await new Promise((r) => setTimeout(r, throttleFree - now));
      }
      return bytes;
    },
  };
}

const root = document.querySelector("[data-player]");
if (root) start(root);

function start(root) {
  /** The copies, best first: { label, address, bytes, type, file, seconds, width, height, fps, codec, peak }. */
  let copies = JSON.parse(root.dataset.films);
  const forced = copies.find((c) => c.label === stored("cinemaQuality"));
  if (forced) copies = [forced];
  for (const c of copies) Object.assign(c, { reader: null, opening: null, stream: null, index: null, decode: null, spans: [], streamed: 0 });
  const smallest = copies.at(-1);
  const bitrate = (c) => (c.bytes * 8) / c.seconds;
  const is4k = (c) => c.height >= 2160;

  // Can this browser decode each 4K copy, smoothly, efficiently? Until it says, Auto leaves 4K
  // out. (Every browser that plays the page plays 1080p H.264.)
  for (const c of copies.filter(is4k)) {
    navigator.mediaCapabilities
      ?.decodingInfo({
        type: "file",
        video: { contentType: `video/mp4; codecs="${c.codec}"`, width: c.width, height: c.height, framerate: c.fps, bitrate: Math.round(bitrate(c)) },
      })
      .then((info) => {
        c.decode = info;
        markMenu();
      })
      .catch(() => {});
  }
  /** Whether Auto may play a copy here. */
  const suits = (c) => {
    if (QUALITY.phone) return c === smallest;
    if (!is4k(c)) return true;
    return SCREEN_PX >= QUALITY.screen4kPx && MEMORY_GB > 2 && c.decode?.smooth === true && (c.fps <= 30 || c.decode.powerEfficient === true);
  };
  /** The copies Auto may play, best first. */
  const ladder = () => copies.filter(suits);
  const below = (c) => ladder().find((x) => bitrate(x) < bitrate(c)) ?? null;
  const above = (c) => ladder().findLast((x) => bitrate(x) > bitrate(c)) ?? null;
  /** "auto", or the label of a copy chosen in the menu. */
  let choice = "auto";

  const video = root.querySelector("video");
  const playButton = root.querySelector("[data-play]");
  const statusEl = root.querySelector("[data-status]");
  const streamedEl = root.querySelector("[data-streamed]");
  const aheadEl = root.querySelector("[data-ahead]");
  const qualityEl = root.querySelector("[data-quality]");
  const menu = document.querySelector("[data-quality-menu]");
  const pick = document.querySelector("[data-quality-pick]");
  const visitEl = root.querySelector("[data-visit]");
  const trouble = root.querySelector("[data-trouble]");
  const troubleTitle = root.querySelector("[data-trouble-title]");
  const troubleText = root.querySelector("[data-trouble-text]");

  let client = null;
  /** The copy playing (or about to). */
  let current = null;
  let wantPlay = false;
  let started = false;
  let pressedAt = 0;
  const timings = {};

  const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`;
  const megabytes = (n) => (n >= 1e6 ? `${Math.round(n / 1e6)} MB` : `${Math.max(1, Math.round(n / 1e3))} kB`);
  const setState = (state) => root.setAttribute("data-state", state);
  const say = (text) => {
    statusEl.textContent = text;
  };

  // ---- Streamed so far ------------------------------------------------------------------
  // The bytes fetched from the network, for the player or ahead of it, from either copy.
  // Blocks fetched twice, after a seek back, count once.
  function addSpan(copy, start, length) {
    const spans = copy.spans;
    let a = start;
    let b = start + length;
    for (let i = spans.length - 1; i >= 0; i--) {
      const [s, e] = spans[i];
      if (s <= b && a <= e) {
        a = Math.min(a, s);
        b = Math.max(b, e);
        spans.splice(i, 1);
      }
    }
    spans.push([a, Math.min(b, copy.bytes)]);
    copy.streamed = spans.reduce((n, [s, e]) => n + (e - s), 0);
    const total = copies.reduce((n, c) => n + c.streamed, 0);
    streamedEl.textContent = megabytes(total);
    root.setAttribute("data-streamed-bytes", String(total));
  }

  // ---- Opening the copies -------------------------------------------------------------------
  // Each copy is opened once (its DataMap fetched), and gets its ReadAhead the first time it's
  // needed. A copy not playing keeps only its first block, which holds the MP4's index, so a
  // switch to it starts quickly.
  function open(copy) {
    copy.opening ??= client.openFile(copy.address).then((reader) => {
      copy.reader = throttled(reader);
      // Opened after playback started: get it ready for a switch now.
      if (started && copy !== current) standby(copy);
      return copy;
    });
    return copy.opening;
  }
  /** Blocks to read ahead of a copy while it plays: about 80 s of it, within bounds. */
  function aheadFor(copy) {
    if (READ_AHEAD.fixed !== undefined) return READ_AHEAD.fixed;
    const blocks = Math.ceil((READ_AHEAD.seconds * bitrate(copy)) / 8 / MIB);
    return Math.min(READ_AHEAD.max, Math.max(READ_AHEAD.min, blocks));
  }
  function streamOf(copy, ahead) {
    copy.stream ??= new ReadAhead(copy.reader, {
      type: copy.type,
      name: copy.file,
      ahead,
      parallel: is4k(copy) ? READ_AHEAD.parallel4k : READ_AHEAD.parallel,
      onFetched: (s, l) => addSpan(copy, s, l),
      // Until this copy has measured the network, go by what the other one found.
      rateHint: () => copies.find((c) => c !== copy && c.stream)?.stream.rate ?? null,
    });
    if (stored("cinemaDebug")) copy.stream.debug = copy.label;
    copy.stream.setAhead(ahead);
    return copy.stream;
  }

  // ---- Ready ahead ----------------------------------------------------------------------
  // Seconds of video the player has buffered plus what the read-ahead holds beyond it, at the
  // copy's average bitrate. Shown while playing, so a slow network is visible before it stalls.
  function readyAhead() {
    let buffered = 0;
    for (let i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= video.currentTime && video.currentTime <= video.buffered.end(i)) {
        buffered = video.buffered.end(i) - video.currentTime;
      }
    }
    return buffered + (current.stream.bytesAhead * 8) / bitrate(current);
  }
  function showQuality() {
    qualityEl.textContent = current.label;
    root.setAttribute("data-quality", current.label);
  }

  // ---- The quality menu -----------------------------------------------------------------------
  // Auto, or one copy fixed. A copy this browser says it can't decode is offered but marked.
  function markMenu() {
    if (!pick) return;
    for (const option of [...pick.options]) {
      const c = copies.find((x) => x.label === option.value);
      if (!c) {
        if (option.value !== "auto") option.remove();
        continue;
      }
      option.textContent = c.decode?.supported === false ? `${c.label} (not on this device)` : c.label;
      option.disabled = c.decode?.supported === false;
    }
  }
  if (menu && pick && copies.length > 1) {
    try {
      const saved = localStorage.getItem("cinemaQualityChoice");
      if (saved && copies.some((c) => c.label === saved)) choice = saved;
    } catch {
      // No storage: Auto.
    }
    pick.value = choice;
    root.setAttribute("data-quality-choice", choice);
    markMenu();
    menu.hidden = false;
    pick.addEventListener("change", async () => {
      choice = pick.value;
      root.setAttribute("data-quality-choice", choice);
      try {
        localStorage.setItem("cinemaQualityChoice", choice);
      } catch {
        // Remembered for this visit only.
      }
      lastChange = performance.now();
      const copy = copies.find((c) => c.label === choice);
      if (!current) return;
      if (!copy) {
        // Back to Auto: its rules take over from the copy playing.
        if (started) readyNeighbours();
        return;
      }
      await open(copy).catch(() => {});
      if (copy.reader) void changeTo(copy, "chosen");
    });
  }

  // ---- Switching ----------------------------------------------------------------------------
  let lastChange = 0; // the last start, seek or switch
  let lowTicks = 0;
  let upAfter = 0;
  let backoff = QUALITY.firstBackoffMs;
  let switches = 0;
  /** The copy being fetched ahead of a switch to it. */
  let pending = null;

  /** Ready a copy not playing for a switch: its first block, which holds its index. */
  function standby(copy) {
    streamOf(copy, 0);
    indexOf(copy).catch(() => {});
  }
  /** Open, and ready for a switch, the copies one step either side of the one playing. */
  function readyNeighbours() {
    if (choice !== "auto") return;
    for (const c of [above(current), below(current)]) {
      if (!c) continue;
      if (c.reader) standby(c);
      else open(c).catch((e) => console.warn(`[cinema] couldn't open the ${c.label} copy`, e));
    }
  }

  /** A copy's MP4 index, read once from the start of the file, where both copies keep it. */
  function indexOf(copy) {
    copy.index ??= (async () => {
      const at = findMoov(await copy.stream.read(0, 64 * 1024));
      if (!at) throw new Error("the index isn't at the start of the file");
      return parseMoov(await copy.stream.read(at.start, at.size));
    })();
    return copy.index;
  }

  /**
   * Switch to another copy while playing, without a long wait: pick a point this copy's
   * buffer will reach, fetch the other copy's opening seconds from there, and switch when
   * playback gets there (or stalls first). Before play, switch at once.
   */
  async function changeTo(copy, why) {
    if (pending || copy === current || !copy.reader) return;
    if (!started) return switchTo(copy, why);
    pending = copy;
    const from = current;
    from.stream.hold();
    const stream = streamOf(copy, 0);
    // At the copy's peak rate: some vary far more around their average than others.
    const startBytes = (QUALITY.switchStartS * Math.max(bitrate(copy), (copy.peak ?? 0) * 1e6)) / 8;
    let index = null;
    try {
      index = await indexOf(copy);
    } catch (e) {
      console.warn(`[cinema] the ${copy.label} copy's index couldn't be read; estimating`, e);
    }
    const deadline = performance.now() + QUALITY.switchWaitMs;
    for (let plan = 1; current === from; plan++) {
      // A point this copy's buffer will reach, as far on as it safely can (up to 20 s), to give
      // the other copy's start the most time to arrive. This copy plays on meanwhile, so a
      // later switch costs nothing. (The measured rate can be minutes old when the network has
      // just slowed down, so it doesn't set this.)
      const at = video.currentTime + Math.max(1, Math.min(readyAhead() - 2, 20));
      const offset = index ? keyframeOffset(index, at) : Math.floor((at / video.duration) * copy.bytes);
      console.info(`[cinema] fetching the ${copy.label} copy from ${at.toFixed(1)} s (${(offset / 1048576).toFixed(1)} MiB) to switch there; plan ${plan}`);
      // Audio sits beside the video in the file: start a little before the keyframe.
      let ready = null;
      // And the window after it: the copy playing fetches nothing more meanwhile, so the
      // connection is this copy's.
      stream.prefetch(offset - 128 * 1024, offset + startBytes, aheadFor(copy)).then(
        () => (ready = true),
        () => (ready = false),
      );
      while (performance.now() < deadline && current === from) {
        const stalled = video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;
        if (ready !== null && (video.paused || stalled || video.currentTime >= at - 0.3)) break;
        await sleep(200);
      }
      // Fetched late, with playback gone past what was fetched: plan again from here.
      const passed = video.currentTime > at + QUALITY.switchStartS * 0.8;
      if (!ready || !passed || plan >= 3 || performance.now() >= deadline) break;
    }
    pending = null;
    if (current === from) switchTo(copy, why);
  }

  function switchTo(copy, why) {
    if (copy === current || !copy.reader) return;
    const time = video.currentTime;
    const resume = started && !video.paused;
    current.stream?.setAhead(0);
    console.info(`[cinema] ${current.label} -> ${copy.label}: ${why}`);
    if (started && bitrate(copy) < bitrate(current) && choice === "auto") {
      upAfter = performance.now() + backoff;
      backoff = Math.min(backoff * 2, QUALITY.maxBackoffMs);
    }
    current = copy;
    switches++;
    root.setAttribute("data-switches", String(switches));
    root.setAttribute("data-switched-at", time.toFixed(1));
    lastChange = performance.now();
    lowTicks = 0;
    video.src = streamOf(copy, started ? aheadFor(copy) : READ_AHEAD.before).url;
    if (time > 0) video.addEventListener("loadedmetadata", () => (video.currentTime = time), { once: true });
    if (resume) video.play().catch(() => {});
    showQuality();
    if (started) readyNeighbours();
  }

  // Once a second while playing: show what's ready ahead, and change copy if it's called for.
  setInterval(() => {
    if (!current?.stream || !started || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const ahead = readyAhead();
    root.setAttribute("data-ahead-seconds", String(Math.round(ahead)));
    aheadEl.textContent = `${Math.round(ahead)} s`;
    aheadEl.closest(".meter-ahead").hidden = false;

    if (choice !== "auto" || pending || video.paused || performance.now() - lastChange < QUALITY.settleMs) return;
    const nearEnd = video.currentTime + ahead >= video.duration - 1;
    const down = below(current);
    lowTicks = down && ahead < QUALITY.lowAheadS && !nearEnd ? lowTicks + 1 : 0;
    if (lowTicks >= QUALITY.lowAheadTicks && down.reader) {
      void changeTo(down, `${Math.round(ahead)} s ready ahead`);
      return;
    }
    // A copy no longer suited (4K, once the browser has said it can't decode it smoothly).
    if (!suits(current) && down?.reader) {
      void changeTo(down, "not suited to this device");
      return;
    }
    const up = above(current);
    if (!up?.reader || performance.now() < upAfter || ahead < QUALITY.upAheadS) return;
    const rate = current.stream.rate;
    const enough = rate === null ? !is4k(up) : rate * 8 >= (is4k(up) ? QUALITY.upFactor4k : QUALITY.upFactor) * bitrate(up);
    if (enough) void changeTo(up, rate === null ? "plenty ready ahead" : `network at ${((rate * 8) / 1e6).toFixed(1)} Mbit/s`);
  }, 1000);

  // For tests: a "cinema-switch" event on the player, with a copy's label as its detail,
  // switches to that copy as the rules would.
  root.addEventListener("cinema-switch", (event) => {
    const copy = copies.find((c) => c.label === event.detail);
    if (copy) void changeTo(copy, "asked to");
  });

  // A long wait on the network steps down a copy straight away.
  let stallTimer;
  video.addEventListener("waiting", () => {
    clearTimeout(stallTimer);
    if (!started || choice !== "auto" || !below(current)) return;
    stallTimer = setTimeout(() => {
      const down = below(current);
      if (choice === "auto" && down?.reader && performance.now() - lastChange >= QUALITY.settleMs) {
        void changeTo(down, "waited on the network");
      }
    }, QUALITY.stallMs);
  });
  video.addEventListener("playing", () => clearTimeout(stallTimer));
  video.addEventListener("seeking", () => {
    clearTimeout(stallTimer);
    lastChange = performance.now();
  });

  // ---- This visit's numbers ---------------------------------------------------------------
  function showVisit() {
    const parts = [];
    if (timings.connect !== undefined) parts.push(`Connected in ${seconds(timings.connect)}`);
    if (timings.open !== undefined) parts.push(`video found in ${seconds(timings.open)}`);
    if (timings.first !== undefined) {
      parts.push(timings.first < 100 ? "first frame at once after play" : `first frame ${seconds(timings.first)} after play`);
    }
    if (!parts.length) return;
    visitEl.textContent = parts.join(" · ");
    visitEl.hidden = false;
  }

  // ---- Trouble ----------------------------------------------------------------------------
  function fail(title, text) {
    troubleTitle.textContent = title;
    troubleText.textContent = text;
    trouble.hidden = false;
    setState("trouble");
  }
  const reason = (e) => (e instanceof Error ? e.message : String(e));

  // ---- Connect and open, as soon as the page loads -----------------------------------------
  async function prepare() {
    trouble.hidden = true;
    setState(wantPlay ? "waiting" : "preparing");
    if (typeof RTCPeerConnection === "undefined") {
      return fail("This browser can't play the video", "It can't make the direct connections that reach the Autonomi network. Try another browser.");
    }
    if (!("serviceWorker" in navigator)) {
      return fail("This browser can't play the video here", "It needs service workers, which are switched off or unavailable in this window. A private window can cause this.");
    }
    try {
      let t = performance.now();
      if (!client) {
        say("Connecting to Autonomi…");
        client = await AutonomiClient.connect();
        timings.connect = performance.now() - t;
        showVisit();
      }
      say(wantPlay ? "Finding the video. It starts as soon as it's found…" : "Finding the video on the network…");
      t = performance.now();
      // The loader's worker carries the media bridge; without it in control, nothing can answer.
      if (!navigator.serviceWorker.controller) throw new Error("the site's service worker isn't running; reload the page");
      // The copy chosen, or Auto's start: the best short of 4K, or the smallest.
      const chosen = copies.find((c) => c.label === choice);
      const first = chosen ?? (QUALITY.phone || QUALITY.slowNetwork ? smallest : (ladder().find((c) => !is4k(c)) ?? smallest));
      // Open the smallest too, for a slow start. Play needs only one; if the first can't be
      // opened, the smallest will do.
      const other = first !== smallest ? smallest : null;
      const [a, b] = [open(first), other && open(other)];
      b?.catch((e) => console.warn(`[cinema] couldn't open the ${other.label} copy`, e));
      current = await a.catch((e) => (b ? b : Promise.reject(e)));
      timings.open = performance.now() - t;
      showVisit();
      // Widened once the video plays: until then the player's first blocks come first.
      video.src = streamOf(current, READ_AHEAD.before).url;
      showQuality();
      if (wantPlay) return play();
      setState("ready");
      say("Ready when you are");
    } catch (e) {
      console.error("[cinema] couldn't open the film", e);
      current = null;
      for (const c of copies) Object.assign(c, { opening: null, reader: null, stream: (c.stream?.close(), null) });
      fail(
        client ? "The video couldn't be found just now" : "Couldn't reach the Autonomi network",
        client
          ? `The network didn't return the video's first pieces. (${reason(e)})`
          : `Some networks block the direct connections this needs. Try again, or try another network. (${reason(e)})`,
      );
    }
  }

  // ---- Play -------------------------------------------------------------------------------
  async function play() {
    pressedAt ||= performance.now();
    // The opening seconds came in slowly: start on a copy the rate allows, or the smallest,
    // rather than stall in the first minute.
    const rate = current.stream.rate;
    if (!started && choice === "auto" && current !== smallest && rate !== null && rate * 8 < QUALITY.startFactor * bitrate(current)) {
      const fits = ladder().find((c) => bitrate(c) < bitrate(current) && rate * 8 >= QUALITY.startFactor * bitrate(c)) ?? smallest;
      // It may still be opening: it is worth a short wait.
      if (!fits.reader) await Promise.race([open(fits).catch(() => {}), sleep(QUALITY.openWaitMs)]);
      if (fits.reader) switchTo(fits, `opening seconds at ${((rate * 8) / 1e6).toFixed(1)} Mbit/s`);
    }
    say("Fetching the first pieces…");
    setState("waiting");
    try {
      await video.play();
    } catch (e) {
      // The browser wants the press and the playing closer together (Safari, mostly), or the
      // film failed to load: either way, one more press does it.
      if (e?.name === "NotAllowedError") {
        wantPlay = false;
        setState("ready");
        say("Ready. Press play to start");
      } else if (!video.error) {
        setState("ready");
        say("Ready when you are");
      }
    }
  }

  playButton.addEventListener("click", () => {
    wantPlay = true;
    pressedAt = performance.now();
    if (current?.stream) return void play();
    setState("waiting");
    if (statusEl.textContent.startsWith("Finding")) say("Finding the video. It starts as soon as it's found…");
  });
  root.querySelector("[data-retry]").addEventListener("click", () => {
    // A failure mid-film is simplest to recover from with a fresh page; before that, just try again.
    if (started) return location.reload();
    void prepare();
  });

  video.addEventListener("playing", () => {
    if (!started) {
      started = true;
      lastChange = performance.now();
      timings.first = performance.now() - pressedAt;
      current.stream.setAhead(aheadFor(current));
      // Now the copies either side may fetch their first block, ready for a switch.
      readyNeighbours();
      showVisit();
      video.controls = true;
    }
    clearTimeout(slow);
    setState("playing");
  });
  // While the film is under way, say so only when it keeps the viewer waiting.
  let slow;
  const fetching = () => {
    if (!started) return;
    clearTimeout(slow);
    slow = setTimeout(() => {
      say("Fetching this part of the video…");
      root.setAttribute("data-fetching", "");
    }, 700);
  };
  const fetched = () => {
    clearTimeout(slow);
    root.removeAttribute("data-fetching");
  };
  video.addEventListener("waiting", fetching);
  video.addEventListener("seeking", fetching);
  video.addEventListener("playing", fetched);
  video.addEventListener("canplay", fetched);
  video.addEventListener("error", () => {
    if (!current) return;
    fetched();
    const code = video.error?.code;
    fail(
      code === 4 ? "This browser can't play the video" : "The video stopped",
      code === 4
        ? "It couldn't decode the video. It is H.264, which most browsers play."
        : "The next part couldn't be fetched from the network. Trying again reloads the page.",
    );
  });

  // The streams belong to this page: let go of them when the page goes.
  addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    for (const c of copies) (c.stream ?? c.reader)?.close();
    client?.close();
  });

  // ---- The film's full address, on request --------------------------------------------------
  const toggle = document.querySelector("[data-address-toggle]");
  const full = document.querySelector("[data-address-full]");
  toggle?.addEventListener("click", () => {
    const open = full.hidden;
    full.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Hide it" : "Show all of it";
  });

  void prepare();
}
