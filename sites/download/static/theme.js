// Apply the saved or system theme before first paint, to avoid a flash. Loaded from <head> as a
// file: the site's policy allows no inline scripts. Autonomirror's theme toggle does the rest.
(function () {
  var saved;
  try {
    saved = localStorage.getItem("theme");
  } catch (e) {
    // Storage blocked: follow the system setting.
  }
  var theme =
    saved === "light" || saved === "dark" ? saved : matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  var color = document.querySelector('meta[name="theme-color"]');
  if (color) color.setAttribute("content", theme === "light" ? "#f3f5f9" : "#0a1020");
})();
