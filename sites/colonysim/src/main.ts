// ColonySim's page: runs the colony, draws it, takes the visitor's food and walls, and saves it
// in this site's own storage every few seconds and when the page is hidden.

import { dayProgress, readPalette, Renderer, timeOfDay, type Hover, type TimeOfDay } from "./render";
import { forget, load, save } from "./save";
import { dayOf, H, newWorld, paintCircle, paintLine, step, W, type Brush, type World } from "./sim";

const STEPS_PER_FRAME = 2;
const SAVE_EVERY_MS = 5000;
const BRUSH_SIZE: Record<Brush, number> = { food: 3, wall: 1.3, erase: 3 };
const TIME_LABEL: Record<TimeOfDay, string> = { morning: "Morning", afternoon: "Afternoon", dusk: "Dusk", night: "Night", dawn: "Dawn" };

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const canvas = $<HTMLCanvasElement>("#colony");
const stage = $(".stage");

const restored = load();
let world: World = restored ?? newWorld((Math.random() * 2 ** 32) | 0, Date.now());
let paused = false;
let speed = 1;
let brush: Brush = "food";
let dirty = !restored;
let hover: Hover | null = null;

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
  renderer.draw(world, hover, now);
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

// ------------------------------------------------------------------ the day, the time and the counts

const count = new Intl.NumberFormat("en");
let shownDay = dayOf(world);

function status() {
  const day = dayOf(world);
  $("[data-day]").textContent = `Day ${day}`;
  $("[data-ants]").textContent = count.format(world.ants.count);
  $("[data-delivered]").textContent = count.format(world.delivered);
  const time = timeOfDay(world.step);
  stage.dataset.time = time;
  $("[data-time-label]").textContent = TIME_LABEL[time];
  stage.style.setProperty("--day", dayProgress(world.step).toFixed(3));
  if (day > shownDay) announce(`Day ${day}`);
  shownDay = day;
}
setInterval(status, 250);

/** A banner across the tray for a moment, when a new day begins. */
function announce(text: string) {
  const toast = $("[data-toast]");
  toast.textContent = text;
  toast.hidden = false;
  toast.classList.remove("is-showing");
  void toast.offsetWidth; // Restart the animation.
  toast.classList.add("is-showing");
}
$("[data-toast]").addEventListener("animationend", (e) => ((e.currentTarget as HTMLElement).hidden = true));

// ------------------------------------------------------------------ drawing with the pointer

let drawing: { x: number; y: number } | null = null;
const cellAt = (e: PointerEvent) => {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
};
const hoverAt = (p: { x: number; y: number }): Hover => ({ ...p, r: BRUSH_SIZE[brush], brush });

canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  canvas.setPointerCapture(e.pointerId);
  drawing = cellAt(e);
  hover = hoverAt(drawing);
  paintCircle(world, drawing.x, drawing.y, BRUSH_SIZE[brush], brush);
  dirty = true;
});
canvas.addEventListener("pointermove", (e) => {
  const p = cellAt(e);
  // A finger has no hover: the ring shows only while it is drawing.
  if (drawing || e.pointerType !== "touch") hover = hoverAt(p);
  if (!drawing) return;
  paintLine(world, drawing.x, drawing.y, p.x, p.y, BRUSH_SIZE[brush], brush);
  drawing = p;
  dirty = true;
});
const stop = (e: PointerEvent) => {
  if (drawing) saveNow();
  drawing = null;
  if (e.pointerType === "touch") hover = null;
};
canvas.addEventListener("pointerup", stop);
canvas.addEventListener("pointercancel", stop);
canvas.addEventListener("pointerleave", () => {
  if (!drawing) hover = null;
});

// ------------------------------------------------------------------ controls

function setBrush(next: Brush) {
  brush = next;
  for (const b of document.querySelectorAll<HTMLButtonElement>("button[data-brush]")) {
    b.setAttribute("aria-pressed", String(b.dataset.brush === brush));
  }
  canvas.dataset.brush = brush;
  if (hover) hover = hoverAt(hover);
}
for (const b of document.querySelectorAll<HTMLButtonElement>("button[data-brush]")) {
  b.addEventListener("click", () => setBrush(b.dataset.brush as Brush));
}

const label = (button: HTMLElement, text: string) => (button.querySelector("[data-label]")!.textContent = text);

const pauseBtn = $<HTMLButtonElement>("[data-action=pause]");
function togglePause() {
  paused = !paused;
  label(pauseBtn, paused ? "Run" : "Pause");
  pauseBtn.setAttribute("aria-pressed", String(paused));
  stage.toggleAttribute("data-paused", paused);
}
pauseBtn.addEventListener("click", togglePause);

const speedBtn = $<HTMLButtonElement>("[data-action=speed]");
function toggleSpeed() {
  speed = speed === 1 ? 4 : 1;
  label(speedBtn, speed === 1 ? "Faster" : "Normal speed");
  speedBtn.setAttribute("aria-pressed", String(speed !== 1));
}
speedBtn.addEventListener("click", toggleSpeed);

$("[data-action=new]").addEventListener("click", () => {
  if (!confirm("Start a new colony? This one will be gone.")) return;
  forget();
  world = newWorld((Math.random() * 2 ** 32) | 0, Date.now());
  shownDay = 1;
  dirty = true;
  saveNow();
  status();
});

// Keys: F, W and C pick what a click places; space pauses; the full stop changes speed.
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  const target = e.target as HTMLElement;
  if (target.closest("input, textarea, select, [contenteditable]")) return;
  const key = e.key.toLowerCase();
  if (key === "f") setBrush("food");
  else if (key === "w") setBrush("wall");
  else if (key === "c") setBrush("erase");
  else if (key === ".") toggleSpeed();
  else if (key === " " && !target.closest("button, a")) {
    e.preventDefault();
    togglePause();
  }
});

$("[data-origin]").textContent = location.host;
setBrush("food");
status();
if (restored) document.body.dataset.restored = "";
requestAnimationFrame(frame);
