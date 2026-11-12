/** Small DOM helpers shared by both pages. Text only goes in via textContent. */

export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

export function setText(el: HTMLElement, text: string): void {
  el.textContent = text;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API unavailable or denied: fall back to a hidden selection.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

/** Wire a button to copy `getText()`, flashing "Copied" in its label. */
export function bindCopy(button: HTMLButtonElement, getText: () => string): void {
  const label = button.dataset.copyLabel ?? button.textContent ?? "Copy";
  let timer: number | undefined;
  button.addEventListener("click", async () => {
    const ok = await copyText(getText());
    button.textContent = ok ? "Copied ✓" : "Copy failed";
    button.classList.toggle("is-copied", ok);
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      button.textContent = label;
      button.classList.remove("is-copied");
    }, 1600);
  });
}

/**
 * Show elements whose `data-show` lists `state`, and hide ones whose
 * `data-hide` does, within `root`.
 */
export function applyState(root: HTMLElement, state: string): void {
  root.dataset.state = state;
  root.querySelectorAll<HTMLElement>("[data-show]").forEach((el) => {
    el.hidden = !el.dataset.show!.split(/\s+/).includes(state);
  });
  root.querySelectorAll<HTMLElement>("[data-hide]").forEach((el) => {
    el.hidden = el.dataset.hide!.split(/\s+/).includes(state);
  });
}

/** Deterministic PRNG so decorative layouts are stable per address. */
export function seededRandom(seedHex: string): () => number {
  let s = parseInt(seedHex.slice(0, 8) || "1", 16) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x100000000;
  };
}
