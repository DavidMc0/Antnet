// Start's "How this page reached you": this visit's own timings for each step, from the
// loader's record (window.antnetState, from /antnet/receipt.js). Hidden without a record.

(function () {
  "use strict";

  function seconds(ms) {
    return ms == null ? "" : (ms / 1000).toFixed(ms < 1000 ? 2 : 1) + " s";
  }

  function set(step, text) {
    var el = document.querySelector('[data-step="' + step + '"] .t');
    if (el && text) el.textContent = text;
  }

  function show(state) {
    var section = document.querySelector(".journey");
    if (!section || !state || !state.timings) return;
    var t = state.timings;
    set("connect", seconds(t.connectMs));
    set("find", t.resolveMs != null ? seconds(t.resolveMs) : "");
    var records = state.records ? state.records + " records, " : "";
    set("fetch", records + seconds(t.downloadMs));
    // Mainnet records a BLAKE3 hex hash; the local test source records "sha256:<hex>".
    var hash = String(state.blake3 || "");
    var algo = hash.indexOf(":") > 0 ? hash.slice(0, hash.indexOf(":")).toUpperCase() : "BLAKE3";
    hash = hash.slice(hash.indexOf(":") + 1);
    if (hash) set("check", algo + " " + hash.slice(0, 8) + "…");
    set("hand", seconds(t.installMs));
    section.hidden = false;
  }

  function init() {
    if (typeof window.antnetState === "function") window.antnetState().then(show);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
