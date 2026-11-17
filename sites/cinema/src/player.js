// Cinema's player (DEMO.md 3.4, 5.8). Connects to Autonomi and opens the film as soon as the
// page loads, behind the poster, so pressing play starts it quickly. The film's bytes reach
// the <video> through the loader's service worker, which carries the SDK's media bridge: the
// worker turns the player's byte-range requests into messages this page answers. ReadAhead
// (readahead.js) answers them, keeping a window ahead of the player fetched several at once.
//
// The film comes in two copies, each its own file on Autonomi: 1080p, and 720p at under half
// the bitrate. The player starts on 720p on phones and slow connections, drops to it when the
// network can't keep up, and goes back to 1080p when it can (see "Quality" below). With one
// copy listed, it simply plays that.
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

// Read-ahead, in 1 MiB blocks. Before play, only the opening seconds (about 20 s of the 1080p
// copy), so a visit that never plays costs little; once playing, 32 blocks (about 80 s of
// 1080p, three minutes of 720p), 8 blocks (about two of the film's 4 MB records) at a time.
// 16 at a time filled the window no faster on mainnet and slowed seeks, whose fetches queue
// behind those already running. Smaller on devices that say they have little memory.
// sessionStorage "cinemaReadAhead" = "ahead,parallel" overrides it for measuring; "0,1" is
// the old one-block-at-a-time behaviour.
const READ_AHEAD = (() => {
  const small = (navigator.deviceMemory ?? 8) <= 2;
  const plan = { before: 8, playing: small ? 20 : 32, parallel: 8 };
  const [ahead, parallel] = (stored("cinemaReadAhead") ?? "").split(",").map(Number);
  if (Number.isInteger(ahead) && ahead >= 0 && Number.isInteger(parallel) && parallel >= 1) {
    Object.assign(plan, { before: Math.min(ahead, plan.before), playing: ahead, parallel });
  }
  return plan;
})();

// ---- Quality --------------------------------------------------------------------------------
// Phones (narrow screens) start on 720p and stay there: on a phone screen 1080p looks much the
// same and costs over twice the data. Elsewhere 1080p, unless the browser says the connection
// is slow or data-saving is on, or the opening seconds arrive slower than 1.5 times 1080p's
// bitrate by the time play is pressed.
//
// While playing, it drops to 720p when what's ready ahead stays under 25 s for 3 s, or the
// video waits on the network for 3 s; not in the 15 s after starting, a seek or a switch,
// while the window fills. It goes back up when 30 s or more is ready, the network has lately
// delivered at least twice 1080p's bitrate (or hasn't been measured for two minutes), and the
// wait since the last drop has passed: 1 min, doubling with each drop, up to 10 min.
//
// A switch throws away what the browser has buffered, so it first fetches the other copy's
// opening seconds from a point a little ahead (found in that copy's MP4 index), while this
// copy plays on from what it holds, and switches when playback reaches that point.
//
// sessionStorage "cinemaQuality" = "1080p" or "720p" plays only that copy, for measuring.
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
  firstBackoffMs: 60_000,
  maxBackoffMs: 600_000,
  /** Seconds of the other copy fetched before a switch to it. */
  switchStartS: 6,
  /** Longest wait for those seconds before switching anyway. */
  switchWaitMs: 30_000,
  /** Longest wait, when play is pressed on a slow connection, for the 720p copy to open. */
  openWaitMs: 5_000,
};

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
  /** The copies, best first: { label, address, bytes, type, file, seconds }. */
  let copies = JSON.parse(root.dataset.films);
  const forced = copies.find((c) => c.label === stored("cinemaQuality"));
  if (forced) copies = [forced];
  for (const c of copies) Object.assign(c, { reader: null, opening: null, stream: null, index: null, spans: [], streamed: 0 });
  const high = copies[0];
  const low = copies.length > 1 ? copies.at(-1) : null;
  const bitrate = (c) => (c.bytes * 8) / c.seconds;

  const video = root.querySelector("video");
  const playButton = root.querySelector("[data-play]");
  const statusEl = root.querySelector("[data-status]");
  const streamedEl = root.querySelector("[data-streamed]");
  const aheadEl = root.querySelector("[data-ahead]");
  const qualityEl = root.querySelector("[data-quality]");
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
  function streamOf(copy, ahead) {
    copy.stream ??= new ReadAhead(copy.reader, {
      type: copy.type,
      name: copy.file,
      ahead,
      parallel: READ_AHEAD.parallel,
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
    // 1080p varies more around its average than 720p does: allow it twice as much.
    const startBytes = (QUALITY.switchStartS * bitrate(copy) * (copy === high ? 2 : 1.2)) / 8;
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
      stream.prefetch(offset - 128 * 1024, offset + startBytes, READ_AHEAD.playing).then(
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
    if (copy === low) {
      upAfter = performance.now() + backoff;
      backoff = Math.min(backoff * 2, QUALITY.maxBackoffMs);
    }
    current = copy;
    switches++;
    root.setAttribute("data-switches", String(switches));
    root.setAttribute("data-switched-at", time.toFixed(1));
    lastChange = performance.now();
    lowTicks = 0;
    video.src = streamOf(copy, started ? READ_AHEAD.playing : READ_AHEAD.before).url;
    if (time > 0) video.addEventListener("loadedmetadata", () => (video.currentTime = time), { once: true });
    if (resume) video.play().catch(() => {});
    showQuality();
  }

  // Once a second while playing: show what's ready ahead, and change copy if it's called for.
  setInterval(() => {
    if (!current?.stream || !started || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const ahead = readyAhead();
    root.setAttribute("data-ahead-seconds", String(Math.round(ahead)));
    aheadEl.textContent = `${Math.round(ahead)} s`;
    aheadEl.closest(".meter-ahead").hidden = false;

    if (!low || pending || video.paused || performance.now() - lastChange < QUALITY.settleMs) return;
    const nearEnd = video.currentTime + ahead >= video.duration - 1;
    if (current === high && low.reader) {
      lowTicks = ahead < QUALITY.lowAheadS && !nearEnd ? lowTicks + 1 : 0;
      if (lowTicks >= QUALITY.lowAheadTicks) void changeTo(low, `${Math.round(ahead)} s ready ahead`);
    } else if (current === low && high.reader && !QUALITY.phone && performance.now() >= upAfter) {
      const rate = low.stream.rate;
      if (ahead >= QUALITY.upAheadS && (rate === null || rate * 8 >= QUALITY.upFactor * bitrate(high))) {
        void changeTo(high, rate === null ? "plenty ready ahead" : `network at ${((rate * 8) / 1e6).toFixed(1)} Mbit/s`);
      }
    }
  }, 1000);

  // For tests: a "cinema-switch" event on the player, with a copy's label as its detail,
  // switches to that copy as the rules would.
  root.addEventListener("cinema-switch", (event) => {
    const copy = copies.find((c) => c.label === event.detail);
    if (copy) void changeTo(copy, "asked to");
  });

  // A long wait on the network while playing 1080p drops to 720p straight away.
  let stallTimer;
  video.addEventListener("waiting", () => {
    clearTimeout(stallTimer);
    if (!started || !low || current !== high) return;
    stallTimer = setTimeout(() => {
      if (current === high && low.reader && performance.now() - lastChange >= QUALITY.settleMs) {
        void changeTo(low, "waited on the network");
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
      const first = low && (QUALITY.phone || QUALITY.slowNetwork) ? low : high;
      const other = copies.find((c) => c !== first);
      // Open both at once. Play needs only one; if the first can't be opened, the other will do.
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
    // The opening seconds came in slowly: start on 720p rather than stall in the first minute.
    const rate = current.stream.rate;
    if (!started && current === high && low && rate !== null && rate * 8 < QUALITY.startFactor * bitrate(high)) {
      // The 720p copy may still be opening: it is worth a short wait.
      if (!low.reader) await Promise.race([low.opening?.catch(() => {}), sleep(QUALITY.openWaitMs)]);
      if (low.reader) switchTo(low, `opening seconds at ${((rate * 8) / 1e6).toFixed(1)} Mbit/s`);
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
      current.stream.setAhead(READ_AHEAD.playing);
      // Now the other copy may fetch its first block, ready for a switch.
      for (const c of copies) if (c !== current && c.reader) standby(c);
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
