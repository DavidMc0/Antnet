// Cinema's player (DEMO.md 3.4, 5.8). Connects to Autonomi and opens the film as soon as the
// page loads, behind the poster, so pressing play starts it quickly. The film's bytes reach
// the <video> through the loader's service worker, which carries the SDK's media bridge: the
// worker turns the player's byte-range requests into reads by this page's own client.
//
// States, on [data-player]'s data-state:
//   preparing  connecting and opening the film; the poster and play button show
//   waiting    play was pressed before the film was open; it starts as soon as it is
//   ready      the film is open; play starts it at once
//   playing    the browser's own controls take over
//   trouble    something failed; says what, with "Try again"

import { AutonomiClient } from "@withautonomi/ant-browser-sdk";

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
  // The worker asks this page for each block the player needs (the SDK answers it). Listening
  // to the same requests gives the bytes handed to the player. Blocks asked for twice, after
  // a seek back, count once.
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
  navigator.serviceWorker?.addEventListener("message", (event) => {
    const d = event.data;
    if (d?.type !== "autonomi-file-range" || !source) return;
    if (!source.url.includes(`/${d.sessionId}/`)) return;
    if (Number.isSafeInteger(d.start) && Number.isSafeInteger(d.length)) addSpan(d.start, d.length);
  });

  // ---- This visit's numbers ---------------------------------------------------------------
  function showVisit() {
    const parts = [];
    if (timings.connect !== undefined) parts.push(`Connected in ${seconds(timings.connect)}`);
    if (timings.open !== undefined) parts.push(`film found in ${seconds(timings.open)}`);
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
      return fail("This browser can't play the film", "It can't make the direct connections that reach the Autonomi network. Try another browser.");
    }
    if (!("serviceWorker" in navigator)) {
      return fail("This browser can't play the film here", "It needs service workers, which are switched off or unavailable in this window. A private window can cause this.");
    }
    try {
      let t = performance.now();
      if (!client) {
        say("Connecting to Autonomi…");
        client = await AutonomiClient.connect();
        timings.connect = performance.now() - t;
        showVisit();
      }
      say(wantPlay ? "Finding the film. It starts as soon as it's found…" : "Finding the film on the network…");
      t = performance.now();
      source = await client.createMediaSource(film.address, {
        serviceWorkerUrl: "/autonomi-loader-sw.js",
        // From a bare address the client can't tell this is a video; read its start and end now.
        primePlayback: true,
      });
      timings.open = performance.now() - t;
      showVisit();
      // The network stores the bytes, not what they are: tell the player it's an MP4.
      const url = new URL(source.url);
      url.searchParams.set("type", film.type);
      url.searchParams.set("name", film.file);
      video.src = url.href;
      if (wantPlay) return play();
      setState("ready");
      say("Ready when you are");
    } catch (e) {
      console.error("[cinema] couldn't open the film", e);
      source?.close();
      source = null;
      fail(
        client ? "The film couldn't be found just now" : "Couldn't reach the Autonomi network",
        client
          ? `The network didn't return the film's first pieces. (${reason(e)})`
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
    if (statusEl.textContent.startsWith("Finding")) say("Finding the film. It starts as soon as it's found…");
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
      say("Fetching this part of the film…");
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
      code === 4 ? "This browser can't play the film" : "The film stopped",
      code === 4
        ? "It couldn't decode the video. The film is H.264 with MP3 sound, which most browsers play."
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
