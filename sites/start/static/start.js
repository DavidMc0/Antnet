// Start's live parts, all read from the loader's record of this visit (window.antnetState,
// from /antnet/receipt.js). Without a record each part stays as built, or hidden.
// - The name line: what the short name in the address bar stands for.
// - "How this page reached you": this visit's timings for each step.
// - "Where this page came from": the records the page arrived as and the nodes that served them.
// - The publish command: the loader the visitor is actually using.

(function () {
  "use strict";

  function $(selector) {
    return document.querySelector(selector);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function seconds(ms) {
    return ms == null ? "" : (ms / 1000).toFixed(ms < 1000 ? 2 : 1) + " s";
  }

  function bytes(n) {
    if (n == null) return "";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + " MB";
    if (n >= 1e3) return Math.round(n / 1e3) + " kB";
    return n + " bytes";
  }

  function shorten(s, head, tail) {
    return s.length > head + tail + 1 ? s.slice(0, head) + "…" + s.slice(-tail) : s;
  }

  // ---- The publish command: this loader's own root, not a fixed one ----------------------

  function showLoaderRoot() {
    var target = $("[data-loader-root]");
    if (!target) return;
    // A site's host is <label or name>.<loader root>.
    var host = location.host;
    var dot = host.indexOf(".");
    if (dot > 0) target.textContent = host.slice(dot + 1);
  }

  // ---- The name line -------------------------------------------------------------------

  function showName(state) {
    if (!state.name || !state.link) return;
    var note = $('[data-note="name"]');
    var plain = $('[data-note="address"]');
    if (!note) return;
    $("[data-name]").textContent = state.name;
    $("[data-address-short]").textContent = shorten(state.link.address, 4, 4);
    var fullEl = $("[data-address-full]");
    fullEl.textContent = (state.link.kind === "p" ? "Pointer " : "Archive ") + state.link.address;
    var toggle = note.querySelector(".address-toggle");
    toggle.addEventListener("click", function () {
      var open = fullEl.hidden;
      fullEl.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
    });
    note.hidden = false;
    if (plain) plain.hidden = true;
  }

  // ---- How this page reached you --------------------------------------------------------

  function setStep(step, text) {
    var target = $('[data-step="' + step + '"] .t');
    if (target && text) target.textContent = text;
  }

  function showJourney(state) {
    var section = $(".journey");
    if (!section || !state.timings) return;
    var t = state.timings;
    setStep("connect", seconds(t.connectMs));
    setStep("find", t.resolveMs != null ? seconds(t.resolveMs) : "");
    setStep("fetch", (state.records ? state.records + 1 + " records, " : "") + seconds(t.downloadMs));
    // Mainnet records a BLAKE3 hex hash; the local test source records "sha256:<hex>".
    var hash = String(state.blake3 || "");
    var algo = hash.indexOf(":") > 0 ? hash.slice(0, hash.indexOf(":")).toUpperCase() : "BLAKE3";
    hash = hash.slice(hash.indexOf(":") + 1);
    if (hash) setStep("check", algo + " " + hash.slice(0, 8) + "…");
    setStep("hand", seconds(t.installMs));
    section.hidden = false;
  }

  // ---- Where this page came from --------------------------------------------------------

  function showOrigin(state) {
    var section = $(".origin");
    var list = state.recordList;
    if (!section || !list || !list.length) return;
    var arrivals = state.arrivals || [];

    // The client reports the DataMap's node on the record itself, and (in newer versions)
    // each chunk's node in arrival order, which doesn't say which chunk it was.
    var nodes = {};
    var known = 0;
    list.forEach(function (r) {
      if (r.node) {
        nodes[r.node] = true;
        known++;
      }
    });
    var chunkNodes = arrivals.filter(function (a) {
      return a.node;
    });
    chunkNodes.forEach(function (a) {
      nodes[a.node] = true;
    });
    if (chunkNodes.length && known <= 1) known = (list[0].node ? 1 : 0) + chunkNodes.length;
    var computers = Object.keys(nodes).length;

    var lead = section.querySelector('[data-origin="lead"]');
    var sub = section.querySelector('[data-origin="sub"]');
    if (known >= list.length) {
      lead.textContent =
        "This page came from " + computers + (computers === 1 ? " computer" : " computers") + " on the Autonomi network.";
      sub.textContent = "It arrived as " + list.length + " records. Your browser checked each one against its address.";
    } else {
      lead.textContent = "This page arrived as " + list.length + " records from the Autonomi network.";
      sub.textContent =
        "Your browser checked each one against its address. The client named the node that served " +
        known +
        " of them; the rest will be listed here once it reports them.";
    }

    var ul = section.querySelector('[data-origin="records"]');
    ul.textContent = "";
    list.forEach(function (r) {
      var li = el("li", "record");
      li.appendChild(el("span", "record-kind", r.kind === "datamap" ? "DataMap" : "Chunk " + ((r.index || 0) + 1)));
      li.appendChild(el("span", "record-size", bytes(r.bytes)));
      var node = el("span", "record-node");
      if (r.node) {
        node.appendChild(el("span", "record-label", "served by node "));
        var code = el("code", null, shorten(r.node, 8, 6));
        code.title = r.node;
        node.appendChild(code);
      } else {
        node.textContent = "node not reported yet";
        node.className += " record-unknown";
      }
      li.appendChild(node);
      ul.appendChild(li);
    });

    var arrived = section.querySelector('[data-origin="arrivals"]');
    if (arrivals.length) {
      arrived.textContent =
        "The chunks arrived " +
        arrivals
          .map(function (a) {
            return seconds(a.ms);
          })
          .join(", ") +
        " after the download began.";
    } else {
      arrived.hidden = true;
    }
    section.hidden = false;
  }

  // ---- Warm-up: fetch each listed site before it is clicked (DEMO.md 5.2) ------------------
  // Each card's site is opened in a hidden frame at its warm-up path, one at a time in card
  // order. The frame installs the site and reports back; it only answers pages on the same
  // loader. If the browser keeps framed storage apart, the cards just say "Ready" without it
  // helping, and a click shows the normal loading screen.

  var WARM_LIMIT_MS = 120000;

  function warmCards() {
    var cards = [].slice.call(document.querySelectorAll(".card[data-site]"));
    var i = 0;

    function next() {
      if (i >= cards.length) return;
      var card = cards[i++];
      var link = card.querySelector(".card-link");
      var status = card.querySelector("[data-status]");
      if (!link || !status) return next();

      // The card links to the site by a portable link; its warm-up path is under it.
      var url = link.getAttribute("href").replace(/\/$/, "") + "/_autonomi/warm";
      var frame = el("iframe", "warm-frame");
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      frame.title = "Fetching " + card.getAttribute("data-site") + " in the background";
      frame.src = url;
      card.setAttribute("data-warm", "working");
      status.textContent = "Arriving…";

      var answered = false;
      var finished = false;
      var timer;
      var limit;

      function finish(state, text) {
        if (finished) return;
        finished = true;
        clearInterval(timer);
        clearTimeout(limit);
        removeEventListener("message", onMessage);
        frame.remove();
        card.setAttribute("data-warm", state);
        status.textContent = text;
        next();
      }

      function onMessage(e) {
        if (e.source !== frame.contentWindow || !e.data || e.data.type !== "antnet:warm") return;
        answered = true;
        var r = e.data;
        if (r.status === "ready") return finish("ready", "Ready");
        if (r.status === "error") return finish("idle", "Not fetched yet");
        status.textContent =
          "Arriving…" + (r.total && r.unit === "records" ? " " + (r.done || 0) + " of " + r.total + " records" : "");
      }

      function hello() {
        if (frame.contentWindow) frame.contentWindow.postMessage({ type: "antnet:hello" }, "*");
      }

      addEventListener("message", onMessage);
      frame.addEventListener("load", hello);
      timer = setInterval(function () {
        if (answered) clearInterval(timer);
        else hello();
      }, 500);
      limit = setTimeout(function () {
        finish("idle", "Not fetched yet");
      }, WARM_LIMIT_MS);
      document.body.appendChild(frame);
    }

    next();
  }

  function init() {
    showLoaderRoot();
    warmCards();
    if (typeof window.antnetState !== "function") return;
    window.antnetState().then(function (state) {
      if (!state) return;
      showName(state);
      showJourney(state);
      showOrigin(state);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
