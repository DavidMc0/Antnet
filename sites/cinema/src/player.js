// Cinema's player (DEMO.md 3.4, 5.8). Connects to Autonomi and opens the film as soon as the
// page loads, behind the poster, so pressing play starts it quickly. The film's bytes reach
// the <video> through the loader's service worker, which carries the SDK's media bridge: the
// worker turns the player's byte-range requests into messages this page answers. ReadAhead
// (readahead.js) answers them, keeping a window ahead of the player fetched several at once.
//
// States, on [data-player]'s data-state:
//   preparing  connecting and opening the film; the poster and play button show
//   waiting    play was pressed before the film was open; it starts as soon as it is
//   ready      the film is open; play starts it at once
//   playing    the browser's own controls take over
//   trouble    something failed; says what, with "Try again"

import { AutonomiClient } from "@withautonomi/ant-browser-sdk";
import { ReadAhead } from "./readahead.js";

// Read-ahead, in 1 MiB blocks. Before play, only the opening seconds (about 20 s of this film),
// so a visit that never plays costs little; once playing, about 80 s, 8 blocks (about two of
// the film's 4 MB records) at a time. 16 at a time filled the window no faster on mainnet and
// slowed seeks, whose fetches queue behind those already running. Smaller on devices that
// say they have little memory.
// sessionStorage "cinemaReadAhead" = "ahead,parallel" overrides it for measuring; "0,1" is
// the old one-block-at-a-time behaviour.
const READ_AHEAD = (() => {
  const small = (navigator.deviceMemory ?? 8) <= 2;
  const plan = { before: 8, playing: small ? 20 : 32, parallel: 8 };
  try {
    const [ahead, parallel] = (sessionStorage.getItem("cinemaReadAhead") ?? "").split(",").map(Number);
    if (Number.isInteger(ahead) && ahead >= 0 && Number.isInteger(parallel) && parallel >= 1) {
      Object.assign(plan, { before: Math.min(ahead, plan.before), playing: ahead, parallel });
    }
  } catch {
    // No storage: keep the defaults.
  }
  return plan;
})();

const root = document.querySelector("[data-player]");
if (root) start(root);

function start(root) {
  const film = {
    address: root.dataset.address,
    bytes: Number(root.dataset.bytes),
    type: root.dataset.type,
    file: root.dataset.file,
  };
  const video = root.querySelector("video");
  const playButton = root.querySelector("[data-play]");
  const statusEl = root.querySelector("[data-status]");
  const streamedEl = root.querySelector("[data-streamed]");
  const aheadEl = root.querySelector("[data-ahead]");
  const visitEl = root.querySelector("[data-visit]");
  const trouble = root.querySelector("[data-trouble]");
  const troubleTitle = root.querySelector("[data-trouble-title]");
  const troubleText = root.querySelector("[data-trouble-text]");

  let client = null;
  let source = null;
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
  // The bytes fetched from the network, for the player or ahead of it. Blocks fetched twice,
  // after a seek back, count once.
  const spans = [];
  function addSpan(start, length) {
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
    spans.push([a, Math.min(b, film.bytes)]);
    const total = spans.reduce((n, [s, e]) => n + (e - s), 0);
    streamedEl.textContent = megabytes(total);
    root.setAttribute("data-streamed-bytes", String(total));
  }

  // ---- Ready ahead ----------------------------------------------------------------------
  // Seconds of video the player has buffered plus what the read-ahead holds beyond it, at the
  // film's average bitrate. Shown while playing, so a slow network is visible before it stalls.
  function showAhead() {
    if (!source || !started || !Number.isFinite(video.duration) || video.duration <= 0) return;
    let buffered = 0;
    for (let i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= video.currentTime && video.currentTime <= video.buffered.end(i)) {
        buffered = video.buffered.end(i) - video.currentTime;
      }
    }
    const seconds = Math.round(buffered + source.bytesAhead / (film.bytes / video.duration));
    root.setAttribute("data-ahead-seconds", String(seconds));
    aheadEl.textContent = `${seconds} s`;
    aheadEl.parentElement.hidden = false;
  }
  setInterval(showAhead, 1000);

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
      const reader = await client.openFile(film.address);
      timings.open = performance.now() - t;
      showVisit();
      // The network stores the bytes, not what they are: tell the player it's an MP4.
      source = new ReadAhead(reader, {
        type: film.type,
        name: film.file,
        // Widened once the video plays: until then the player's first blocks come first.
        ahead: READ_AHEAD.before,
        parallel: READ_AHEAD.parallel,
        onFetched: addSpan,
      });
      video.src = source.url;
      if (wantPlay) return play();
      setState("ready");
      say("Ready when you are");
    } catch (e) {
      console.error("[cinema] couldn't open the film", e);
      source?.close();
      source = null;
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
    if (source) return void play();
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
      timings.first = performance.now() - pressedAt;
      source?.setAhead(READ_AHEAD.playing);
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
    if (!source) return;
    fetched();
    const code = video.error?.code;
    fail(
      code === 4 ? "This browser can't play the video" : "The video stopped",
      code === 4
        ? "It couldn't decode the video. It is H.264 with MP3 sound, which most browsers play."
        : "The next part couldn't be fetched from the network. Trying again reloads the page.",
    );
  });

  // The stream belongs to this page: let go of it when the page goes.
  addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    source?.close();
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
