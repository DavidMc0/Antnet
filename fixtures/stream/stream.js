// The page side of the SDK's media bridge, in miniature, with this site's own clip standing in
// for a file on Autonomi. The protocol is the SDK's (internal/media.js in 0.1.5):
//   worker -> page  { type: "autonomi-file-range", sessionId, start, length }, with a port
//   page -> worker  { ok: true, bytes: ArrayBuffer } on that port, or { ok: false, error }
//   page -> worker  { type: "autonomi-stream-awake" } every 10 s while a stream is open
(async function () {
  "use strict";
  var bytes = new Uint8Array(await (await fetch("/clip.webm")).arrayBuffer());
  var session = Array.from(crypto.getRandomValues(new Uint8Array(16)), function (b) {
    return b.toString(16).padStart(2, "0");
  }).join("");
  window.rangesServed = 0;

  navigator.serviceWorker.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.type !== "autonomi-file-range" || data.sessionId !== session) return;
    var port = event.ports[0];
    var part = bytes.slice(data.start, data.start + data.length);
    window.rangesServed++;
    port.postMessage({ ok: true, bytes: part.buffer }, [part.buffer]);
  });
  setInterval(function () {
    if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: "autonomi-stream-awake" });
  }, 10000);

  window.streamUrl =
    "/__autonomi_stream/" + session + "/file?size=" + bytes.length + "&type=video%2Fwebm&name=clip.webm";
  window.clipBytes = bytes;
  document.getElementById("clip").src = window.streamUrl;
  document.body.setAttribute("data-ready", "");
})();
