// The loader's script in a site's pages (DEMO.md 5.3), served at /_autonomi/check.js by the
// service worker and added to the HTML of pointer and named sites. It is loader code, not
// the publisher's; the info page says so.
//
// Once the page has loaded, it opens /_autonomi/check in a hidden frame on the site's own
// origin. The shell there checks for a new version if one is due (at most hourly), installs
// it, and reports back. If a new version arrived, a small notice offers a reload.
// Plain ES5 with no dependencies: it runs in whatever page the site has.

(function () {
  "use strict";
  if (window.top !== window || window.__antnetCheck) return;
  window.__antnetCheck = true;

  var START_DELAY_MS = 1000;

  function start() {
    var frame = document.createElement("iframe");
    frame.src = "/_autonomi/check";
    frame.title = "Checking for a newer version";
    frame.tabIndex = -1;
    frame.setAttribute("aria-hidden", "true");
    // CSSOM, not a style attribute, so a site policy of style-src 'self' allows it.
    frame.style.cssText =
      "position:absolute;left:-10000px;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none";

    function onMessage(e) {
      if (e.origin !== location.origin || e.source !== frame.contentWindow) return;
      if (!e.data || e.data.type !== "antnet:check") return;
      removeEventListener("message", onMessage);
      frame.remove();
      if (e.data.status === "updated") notice("A newer version of this page is available.", "Reload");
      else if (e.data.status === "removed") notice("This site's name has been removed from the directory.", "");
    }

    addEventListener("message", onMessage);
    (document.body || document.documentElement).appendChild(frame);
  }

  /** A small notice in its own shadow DOM, so the site's styles can't change it. */
  function notice(text, action) {
    var host = document.createElement("antnet-notice");
    host.setAttribute("data-antnet-notice", action ? "update" : "removed");
    var root = host.attachShadow({ mode: "open" });
    var box = document.createElement("div");
    box.setAttribute("role", "status");
    box.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:calc(100vw - 32px);" +
      "display:flex;align-items:center;gap:12px;padding:12px 14px 12px 16px;border-radius:10px;" +
      "background:#10241e;color:#eaf3ef;box-shadow:0 10px 30px rgba(0,0,0,.25);" +
      "font:500 14px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif;";
    var label = document.createElement("span");
    label.textContent = text;
    box.appendChild(label);

    var buttonStyle =
      "font:inherit;cursor:pointer;border-radius:7px;padding:6px 12px;border:1px solid #7fe0b8;";
    if (action) {
      var reload = document.createElement("button");
      reload.type = "button";
      reload.textContent = action;
      reload.style.cssText = buttonStyle + "background:#7fe0b8;color:#10241e;";
      reload.addEventListener("click", function () {
        location.reload();
      });
      box.appendChild(reload);
    }
    var close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Dismiss");
    close.style.cssText = buttonStyle + "background:transparent;color:#eaf3ef;border-color:transparent;padding:4px 8px;";
    close.addEventListener("click", function () {
      host.remove();
    });
    box.appendChild(close);

    root.appendChild(box);
    document.documentElement.appendChild(host);
  }

  if (document.readyState === "complete") setTimeout(start, START_DELAY_MS);
  else
    addEventListener("load", function () {
      setTimeout(start, START_DELAY_MS);
    });
})();
