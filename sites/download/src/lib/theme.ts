/**
 * Light/dark toggle. The inline script in each page's <head> sets
 * <html data-theme> before first paint; this wires the button, remembers
 * an explicit choice, and follows the system setting until one is made.
 */
type Theme = "light" | "dark";

const KEY = "theme";
const systemLight = matchMedia("(prefers-color-scheme: light)");

function saved(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function apply(theme: Theme, button: HTMLButtonElement | null): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "light" ? "#f3f5f9" : "#0a1020",
  );
  if (button) {
    const label = `Switch to ${theme === "light" ? "dark" : "light"} mode`;
    button.setAttribute("aria-label", label);
    button.title = label;
  }
}

export function initThemeToggle(): void {
  const button = document.getElementById("theme-toggle") as HTMLButtonElement | null;
  apply(saved() ?? (systemLight.matches ? "light" : "dark"), button);

  button?.addEventListener("click", () => {
    const next: Theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
    apply(next, button);
  });

  systemLight.addEventListener("change", (e) => {
    if (!saved()) apply(e.matches ? "light" : "dark", button);
  });
}
