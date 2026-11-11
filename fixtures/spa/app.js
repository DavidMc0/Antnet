// A tiny client-side router: the route is whatever path the page was loaded at.
function render() {
  const view = document.getElementById("view");
  const path = location.pathname;
  const user = /^\/users\/(\d+)$/.exec(path);
  view.textContent = path === "/" ? "Home" : user ? `User ${user[1]}` : `Route ${path}`;
  document.body.dataset.route = path;
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-link]");
  if (!a) return;
  e.preventDefault();
  history.pushState(null, "", a.getAttribute("href"));
  render();
});
addEventListener("popstate", render);
render();
