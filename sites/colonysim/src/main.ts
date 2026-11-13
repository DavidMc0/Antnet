// ColonySim's page: runs the colony, draws it, takes the visitor's food and walls, and saves it
// in this site's own storage every few seconds and when the page is hidden.

import { readPalette, Renderer } from "./render";
import { forget, load, save } from "./save";
import { dayOf, H, newWorld, paintCircle, paintLine, step, W, type Brush, type World } from "./sim";

const STEPS_PER_FRAME = 2;
const SAVE_EVERY_MS = 5000;
const BRUSH_SIZE: Record<Brush, number> = { food: 3, wall: 1.3, erase: 3 };

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const canvas = $<HTMLCanvasElement>("#colony");

const restored = load();
let world: World = restored ?? newWorld((Math.random() * 2 ** 32) | 0, Date.now());
let paused = false;
let speed = 1;
let brush: Brush = "food";
let dirty = !restored;

const renderer = new Renderer(canvas, readPalette(canvas));
const scheme = matchMedia("(prefers-color-scheme: dark)");
scheme.addEventListener("change", () => (renderer.palette = readPalette(canvas)));

// ------------------------------------------------------------------ the loop

let last = performance.now();
function frame(now: number) {
  // After a hidden tab, don't try to catch up: the colony only runs while it is watched.
  const frames = Math.min(3, Math.max(1, Math.round((now - last) / (1000 / 60))));
  last = now;
  if (!paused) {
    for (let i = 0; i < STEPS_PER_FRAME * speed * frames; i++) step(world);
    dirty = true;
  }
  renderer.resize();
  renderer.draw(world);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ saving

function saveNow() {
  if (!dirty) return;
  const ok = save(world);
  dirty = !ok;
  $("[data-storage]").hidden = ok;
}
setInterval(saveNow, SAVE_EVERY_MS);
addEventListener("pagehide", saveNow);
document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && saveNow());

// ------------------------------------------------------------------ the line in the corner

function status() {
  const day = dayOf(world);
  $("[data-day]").textContent = `Day ${day}`;
  $("[data-ants]").textContent = String(world.ants.count);
  $("[data-delivered]").textContent = String(world.delivered);
}
setInterval(status, 500);

// ------------------------------------------------------------------ drawing with the pointer

let drawing: { x: number; y: number } | null = null;
const cellAt = (e: PointerEvent) => {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
};

canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  canvas.setPointerCapture(e.pointerId);
  drawing = cellAt(e);
  paintCircle(world, drawing.x, drawing.y, BRUSH_SIZE[brush], brush);
  dirty = true;
});
canvas.addEventListener("pointermove", (e) => {
  if (!drawing) return;
  const p = cellAt(e);
  paintLine(world, drawing.x, drawing.y, p.x, p.y, BRUSH_SIZE[brush], brush);
  drawing = p;
  dirty = true;
});
const stop = () => {
  if (drawing) saveNow();
  drawing = null;
};
canvas.addEventListener("pointerup", stop);
canvas.addEventListener("pointercancel", stop);

// ------------------------------------------------------------------ controls

function setBrush(next: Brush) {
  brush = next;
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-brush]")) {
    b.setAttribute("aria-pressed", String(b.dataset.brush === brush));
  }
  canvas.dataset.brush = brush;
}
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-brush]")) {
  b.addEventListener("click", () => setBrush(b.dataset.brush as Brush));
}

const pauseBtn = $<HTMLButtonElement>("[data-action=pause]");
pauseBtn.addEventListener("click", () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "Run" : "Pause";
  pauseBtn.setAttribute("aria-pressed", String(paused));
});

const speedBtn = $<HTMLButtonElement>("[data-action=speed]");
speedBtn.addEventListener("click", () => {
  speed = speed === 1 ? 4 : 1;
  speedBtn.textContent = speed === 1 ? "Faster" : "Normal speed";
  speedBtn.setAttribute("aria-pressed", String(speed !== 1));
});

$("[data-action=new]").addEventListener("click", () => {
  if (!confirm("Start a new colony? This one will be gone.")) return;
  forget();
  world = newWorld((Math.random() * 2 ** 32) | 0, Date.now());
  dirty = true;
  saveNow();
  status();
});

$("[data-origin]").textContent = location.host;
setBrush("food");
status();
if (restored) document.body.dataset.restored = "";
requestAnimationFrame(frame);
