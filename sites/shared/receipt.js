// The receipt (DEMO.md 4.1): one line saying how this page reached the visitor, in this
// visit's own numbers. It reads the record the Antnet loader wrote when it installed the
// site: Cache Storage "autonomi-loader-meta", entry /_autonomi/state.json. That record lives
// on this site's own origin, so the page can read it with the Cache API. A fetch() of the
// path wouldn't work: the loader sends reserved paths to the network.
//
// Fills every element with a data-antnet-receipt attribute and un-hides it. Without a record
// (the site wasn't opened through the loader) the elements stay hidden.
//
// Also exposes window.antnetState(), a promise of the record or null, for pages that show
// more detail (Start's "How this reached you").

(function () {
  "use strict";

  var META_CACHE = "autonomi-loader-meta";
  var STATE_PATH = "/_autonomi/state.json";

  function readState() {
    if (!("caches" in self)) return Promise.resolve(null);
    // caches.has() first: caches.open() would create an empty cache as a side effect.
    return caches
      .has(META_CACHE)
      .then(function (exists) {
        if (!exists) return null;
        return caches.open(META_CACHE).then(function (cache) {
          return cache.match(STATE_PATH);
        });
      })
      .then(function (res) {
        return res ? res.json() : null;
      })
      .catch(function () {
        return null;
      });
  }

  var statePromise = readState();
  window.antnetState = function () {
    return statePromise;
  };

  function formatBytes(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + " MB";
    if (n >= 1e3) return Math.round(n / 1e3) + " kB";
    return n + " bytes";
  }

  function shortAddress(hex) {
    return hex.slice(0, 4) + "…" + hex.slice(-4);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function fill(target, state) {
    target.textContent = "";
    target.appendChild(document.createTextNode("No server sent this page. It arrived as "));
    if (state.records) {
      // The loader counts content chunks; the DataMap that lists them is one more record.
      target.appendChild(el("strong", null, state.records + 1 + " records"));
      target.appendChild(document.createTextNode(" ("));
      target.appendChild(el("strong", null, formatBytes(state.bytes)));
      target.appendChild(document.createTextNode(")"));
    } else {
      target.appendChild(el("strong", null, formatBytes(state.bytes)));
    }
    target.appendChild(document.createTextNode(" from the Autonomi network"));
    var total = state.timings && state.timings.totalMs;
    if (total) {
      target.appendChild(document.createTextNode(" in "));
      target.appendChild(el("strong", null, (total / 1000).toFixed(1) + " s"));
    }
    target.appendChild(document.createTextNode(" and was checked in your browser. Address "));
    var code = el("code", "antnet-address", shortAddress(state.archive));
    code.title = state.archive;
    target.appendChild(code);
    target.appendChild(document.createTextNode(". "));
    var details = el("a", null, "Details");
    details.href = "/_autonomi/";
    target.appendChild(details);
    target.hidden = false;
  }

  function render() {
    var targets = document.querySelectorAll("[data-antnet-receipt]");
    if (!targets.length) return;
    statePromise.then(function (state) {
      if (!state || !state.archive) return;
      for (var i = 0; i < targets.length; i++) fill(targets[i], state);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
