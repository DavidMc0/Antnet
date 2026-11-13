// ColonySim's page: runs the colony, draws it, takes the visitor's food and walls, and saves it
// in this site's own storage every few seconds and when the page is hidden.

import { dayProgress, readPalette, Renderer, timeOfDay, type Hover, type Pose, type TimeOfDay } from "./render";
import { forget, load, save } from "./save";
import {
  dayOf,
  GROWS_AT,
  H,
  larder,
  MAX_ANTS,
  mood,
  newWorld,
  paintCircle,
  paintLine,
  step,
  STEPS_PER_SECOND,
  W,
  type Brush,
  type Mood,
  type World,
} from "./sim";

const FASTER = 4;
const SAVE_EVERY_MS = 5000;
const BRUSH_SIZE: Record<Brush, number> = { food: 3, wall: 1.3, erase: 3 };
const TIME_LABEL: Record<TimeOfDay, string> = { morning: "Morning", afternoon: "Afternoon", dusk: "Dusk", night: "Night", dawn: "Dawn" };
const MOOD: Record<Mood, [label: string, note: string]> = {
  starving: ["Starving", "The larder is empty and the colony is shrinking. Drop some food!"],
  hungry: ["Hungry", "The larder is running low. They could do with some food."],
  fed: ["Well fed", "Enough to eat, but not enough to raise new ants."],
  growing: ["Growing", "Plenty in the larder, so new ants are hatching."],
};

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

// The colony runs by the clock, not by the screen: the same pace on a 60 Hz and a 144 Hz display.
// Between steps the ants are drawn part-way from where they were to where they are.
const before = { x: new Float32Array(MAX_ANTS), y: new Float32Array(MAX_ANTS), angle: new Float32Array(MAX_ANTS), count: 0 };
const pose: Pose = { x: new Float32Array(MAX_ANTS), y: new Float32Array(MAX_ANTS), angle: new Float32Array(MAX_ANTS), time: 0 };

function remember() {
  const a = world.ants;
  before.x.set(a.x);
  before.y.set(a.y);
  before.angle.set(a.angle);
  before.count = a.count;
}

/** Fill `pose` with each ant `part` of the way (0..1) from its place before the last step to its place now. */
function settle(part: number) {
  const a = world.ants;
  for (let i = 0; i < a.count; i++) {
    const dx = a.x[i] - before.x[i];
    const dy = a.y[i] - before.y[i];
    // A new ant, or one moved by more than a step (sent home from under a new wall), isn't slid into place.
    if (i >= before.count || dx * dx + dy * dy > 4) {
      pose.x[i] = a.x[i];
      pose.y[i] = a.y[i];
      pose.angle[i] = a.angle[i];
      continue;
    }
    pose.x[i] = before.x[i] + dx * part;
    pose.y[i] = before.y[i] + dy * part;
    let turn = (a.angle[i] - before.angle[i]) % (Math.PI * 2);
    if (turn > Math.PI) turn -= Math.PI * 2;
    else if (turn < -Math.PI) turn += Math.PI * 2;
    pose.angle[i] = before.angle[i] + turn * part;
  }
  pose.time = world.step - 1 + part;
}

let last = performance.now();
let owed = 1; // Steps due, with the fraction of the next one.
function frame(now: number) {
  // After a hidden tab, don't try to catch up: the colony only runs while it is watched.
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused) {
    owed += elapsed * STEPS_PER_SECOND * speed;
    let due = Math.min(16, Math.floor(owed));
    owed -= Math.floor(owed);
    while (due-- > 0) {
      remember();
      step(world);
      dirty = true;
    }
  }
  settle(owed);
  renderer.resize();
  renderer.draw(world, pose, hover, now);
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
window.addEventListener("pagehide", saveNow);
document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && saveNow());

// ------------------------------------------------------------------ the day, the larder and the counts

const count = new Intl.NumberFormat("en");
let shownDay = dayOf(world);
let shownMood: Mood | null = null;
/** The number of ants every second for the last few, to say whether the colony is growing or shrinking. */
let recent: number[] = [];

function status() {
  const day = dayOf(world);
  $("[data-day]").textContent = `Day ${day}`;
  $("[data-ants]").textContent = count.format(world.ants.count);
  $("[data-delivered]").textContent = count.format(world.delivered);
  const time = timeOfDay(world.step);
  stage.dataset.time = time;
  $("[data-time-label]").textContent = TIME_LABEL[time];
  stage.style.setProperty("--day", dayProgress(world.step).toFixed(3));

  const now = mood(world);
  const full = world.ants.count >= MAX_ANTS && now === "fed" && larder(world) >= GROWS_AT;
  const [label, note] = MOOD[now];
  $("[data-larder]").dataset.mood = now;
  document.body.dataset.mood = now;
  $("[data-mood-label]").textContent = full ? "Thriving" : label;
  $("[data-mood-note]").textContent = full ? `The nest is full: ${MAX_ANTS} ants, and plenty to eat.` : note;
  const meter = $("[data-meter]");
  meter.style.setProperty("--full", larder(world).toFixed(3));
  meter.setAttribute("aria-valuenow", String(Math.round(larder(world) * 100)));

  if (day > shownDay) announce(`Day ${day}`);
  else if (now === "starving" && shownMood && shownMood !== "starving") announce("The larder is empty!");
  shownDay = day;
  shownMood = now;
}
setInterval(status, 250);

function trend() {
  if (!paused) recent.push(world.ants.count);
  if (recent.length > 10) recent.shift();
  const change = recent.length > 1 ? recent[recent.length - 1] - recent[0] : 0;
  const el = $("[data-trend]");
  el.dataset.trend = change > 0 ? "up" : change < 0 ? "down" : "steady";
  el.textContent = change > 0 ? "growing" : change < 0 ? "shrinking" : "";
}
setInterval(trend, 1000);

/** A banner across the tray for a moment: a new day, or the larder running out. */
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
const hoverAt = (p: { x: number; y: number }): Hover => ({ x: p.x, y: p.y, r: BRUSH_SIZE[brush], brush });

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
  speed = speed === 1 ? FASTER : 1;
  label(speedBtn, speed === 1 ? "Faster" : "Normal speed");
  speedBtn.setAttribute("aria-pressed", String(speed !== 1));
}
speedBtn.addEventListener("click", toggleSpeed);

$("[data-action=new]").addEventListener("click", () => {
  if (!confirm("Start a new colony? This one will be gone.")) return;
  forget();
  world = newWorld((Math.random() * 2 ** 32) | 0, Date.now());
  remember();
  shownDay = 1;
  shownMood = null;
  recent = [];
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
remember();
status();
if (restored) document.body.dataset.restored = "";
requestAnimationFrame(frame);
