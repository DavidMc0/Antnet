// Drawing the colony: a tray of sunlit sand seen from above. Walls are rows of pebbles, food is
// scattered leaf, the nest is a mound with a dark way in, and the ants have bodies and legs.
// The colony keeps its own clock: the last third of each colony day is night, when the sand goes
// moonlit blue and the scent trails glow.
//
// Every colour comes from a CSS custom property on the canvas (the --sim-* properties in
// static/style.css), so the palette lives in the stylesheet.

import { H, NEST_RADIUS, STEPS_PER_DAY, W, type Brush, type World } from "./sim";

type RGB = [number, number, number];

export interface Palette {
  ground: RGB;
  speck: RGB;
  stone: RGB;
  stoneLight: RGB;
  leaf: RGB;
  leafLight: RGB;
  trail: RGB;
  home: RGB;
  ant: RGB;
  antNight: RGB;
  mound: RGB;
  hole: RGB;
  night: RGB;
  ember: RGB;
}

const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;

/** Any CSS colour as RGB, using the browser's own parser. */
function rgb(css: string): RGB {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

export function readPalette(el: Element): Palette {
  const css = getComputedStyle(el);
  const v = (name: string) => rgb(css.getPropertyValue(name).trim());
  return {
    ground: v("--sim-ground"),
    speck: v("--sim-speck"),
    stone: v("--sim-stone"),
    stoneLight: v("--sim-stone-light"),
    leaf: v("--sim-leaf"),
    leafLight: v("--sim-leaf-light"),
    trail: v("--sim-trail"),
    home: v("--sim-home"),
    ant: v("--sim-ant"),
    antNight: v("--sim-ant-night"),
    mound: v("--sim-mound"),
    hole: v("--sim-hole"),
    night: v("--sim-night"),
    ember: v("--sim-ember"),
  };
}

const rgba = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** A steady pseudo-random number in [0, 1) for a cell or an ant, so textures don't shimmer. */
function hash(n: number): number {
  n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d);
  n = Math.imul(n ^ (n >>> 12), 0x297a2d39);
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
}

/** How far through its day the colony is, 0..1. */
export const dayProgress = (step: number) => (step % STEPS_PER_DAY) / STEPS_PER_DAY;

/** 0 by day, 1 at night. Dusk falls from 0.62 to 0.70 of the day; dawn is its last twelfth. */
export function nightness(step: number): number {
  const p = dayProgress(step);
  return Math.min(smooth((p - 0.62) / 0.08), 1 - smooth((p - 0.92) / 0.08));
}

export type TimeOfDay = "morning" | "afternoon" | "dusk" | "night" | "dawn";

export function timeOfDay(step: number): TimeOfDay {
  const p = dayProgress(step);
  if (p < 0.3) return "morning";
  if (p < 0.62) return "afternoon";
  if (p < 0.7) return "dusk";
  if (p < 0.92) return "night";
  return "dawn";
}

/** Where the visitor's pointer is, in cells, and what a click would place. */
export interface Hover {
  x: number;
  y: number;
  r: number;
  brush: Brush;
}

/**
 * Where to draw each ant: the page runs the colony at a few steps a second and draws many
 * frames between them, so it passes positions part-way from the last step to this one.
 */
export interface Pose {
  x: Float32Array;
  y: Float32Array;
  angle: Float32Array;
  /** Steps so far, with the fraction of the one in progress: drives the legs. */
  time: number;
}

const layer = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  /** One pixel per cell: both scents, see-through where there is none. Drawn smoothed. */
  private readonly scent = layer(W, H);
  private readonly scentCtx = this.scent.getContext("2d")!;
  private readonly scentImage = new ImageData(W, H);
  /** The scents at twice the size and slightly blurred, so trails have soft edges, not steps. */
  private readonly soft = layer(W * 2, H * 2);
  private readonly softCtx = this.soft.getContext("2d")!;
  /** The scents at a quarter of the size: stretched back up, it is their glow at night. */
  private readonly bloom = layer(W / 4, H / 4);
  private readonly bloomCtx = this.bloom.getContext("2d")!;
  /** The sand, at the canvas's own size. Redrawn only when the canvas changes size. */
  private ground = layer(1, 1);
  /** Pebbles and the nest, at the canvas's own size. Redrawn only when the walls change. */
  private solid = layer(1, 1);
  private wallSum = -1;
  private readonly foodCells = new Int32Array(W * H);
  private readonly stillness = matchMedia("(prefers-reduced-motion: reduce)");
  private pal: Palette;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    palette: Palette,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.pal = palette;
  }

  set palette(p: Palette) {
    this.pal = p;
    this.canvas.width = 0; // Forces the sand and the pebbles to be redrawn in the new colours.
  }

  /** Match the canvas's pixels to its size on screen. */
  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(this.canvas.clientWidth * dpr);
    if (!width) return;
    const height = Math.round(width * (H / W));
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.ground = this.drawGround(width, height);
    this.wallSum = -1;
  }

  // ---------------------------------------------------------------- the still layers

  /** Sand: an even colour, broad lighter and darker patches, grains, and shade towards the rim. */
  private drawGround(width: number, height: number): HTMLCanvasElement {
    const c = layer(width, height);
    const g = c.getContext("2d")!;
    const p = this.pal;
    g.fillStyle = rgba(p.ground);
    g.fillRect(0, 0, width, height);

    let n = 1;
    const rnd = () => hash(n++);
    for (let i = 0; i < 22; i++) {
      const x = rnd() * width;
      const y = rnd() * height;
      const r = (0.12 + rnd() * 0.22) * width;
      const patch = g.createRadialGradient(x, y, 0, x, y, r);
      const light = rnd() < 0.5;
      patch.addColorStop(0, light ? "rgba(255,250,235,0.16)" : rgba(p.speck, 0.07));
      patch.addColorStop(1, light ? "rgba(255,250,235,0)" : rgba(p.speck, 0));
      g.fillStyle = patch;
      g.fillRect(0, 0, width, height);
    }

    const unit = width / W;
    const grains = Math.round((width * height) / 120);
    for (let i = 0; i < grains; i++) {
      const x = rnd() * width;
      const y = rnd() * height;
      const r = unit * (0.07 + rnd() * 0.16);
      g.fillStyle = rnd() < 0.62 ? rgba(p.speck, 0.1 + rnd() * 0.16) : `rgba(255,252,240,${0.25 + rnd() * 0.3})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }

    const rim = g.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, width * 0.62);
    rim.addColorStop(0, rgba(p.speck, 0));
    rim.addColorStop(1, rgba(p.speck, 0.2));
    g.fillStyle = rim;
    g.fillRect(0, 0, width, height);
    return c;
  }

  /** The nest's mound and every pebble. The border wall isn't drawn: the tray's rim stands for it. */
  private drawSolid(world: World): HTMLCanvasElement {
    const { width, height } = this.canvas;
    const c = layer(width, height);
    const g = c.getContext("2d")!;
    const p = this.pal;
    const s = width / W;

    // The mound: darker, damper sand thrown up around the way in.
    const nx = world.nestX * s;
    const ny = world.nestY * s;
    const mound = g.createRadialGradient(nx, ny, s * 1.5, nx, ny, s * 7.5);
    mound.addColorStop(0, rgba(p.mound, 0.75));
    mound.addColorStop(0.55, rgba(p.mound, 0.32));
    mound.addColorStop(1, rgba(p.mound, 0));
    g.fillStyle = mound;
    g.beginPath();
    g.arc(nx, ny, s * 7.5, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 70; i++) {
      const a = hash(i * 3 + 11) * Math.PI * 2;
      const d = s * (NEST_RADIUS - 0.4 + hash(i * 3 + 12) ** 1.6 * 4.2);
      g.fillStyle = hash(i * 3 + 13) < 0.5 ? rgba(p.mound, 0.85) : rgba(mix(p.mound, p.ground, 0.55), 0.9);
      g.beginPath();
      g.arc(nx + Math.cos(a) * d, ny + Math.sin(a) * d, s * (0.22 + hash(i + 400) * 0.3), 0, Math.PI * 2);
      g.fill();
    }
    const hole = g.createRadialGradient(nx - s * 0.4, ny - s * 0.5, s * 0.2, nx, ny, s * 2.3);
    hole.addColorStop(0, rgba(p.hole));
    hole.addColorStop(0.8, rgba(mix(p.hole, p.mound, 0.25)));
    hole.addColorStop(1, rgba(p.mound));
    g.fillStyle = hole;
    g.beginPath();
    g.arc(nx, ny, s * 2.3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255,245,225,0.28)";
    g.lineWidth = Math.max(1, s * 0.22);
    g.beginPath();
    g.arc(nx, ny, s * 2.35, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();

    // Pebbles: one to a wall cell, each a little off-centre and of its own size.
    const cells: number[] = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) if (world.wall[y * W + x]) cells.push(y * W + x);
    }
    const pebble = (i: number) => {
      const r = s * (0.66 + hash(i * 7 + 3) * 0.34);
      return {
        x: ((i % W) + 0.5 + (hash(i * 7 + 1) - 0.5) * 0.5) * s,
        y: (Math.floor(i / W) + 0.5 + (hash(i * 7 + 2) - 0.5) * 0.5) * s,
        r,
      };
    };
    const pass = (fill: string, pick: (i: number) => boolean, dx: number, dy: number, k: number) => {
      g.fillStyle = fill;
      g.beginPath();
      for (const i of cells) {
        if (!pick(i)) continue;
        const b = pebble(i);
        const x = b.x + b.r * dx;
        const y = b.y + b.r * dy;
        g.moveTo(x + b.r * k, y);
        g.arc(x, y, b.r * k, 0, Math.PI * 2);
      }
      g.fill();
    };
    const all = () => true;
    pass("rgba(52,30,14,0.3)", all, 0.3, 0.42, 1.08);
    pass(rgba(mix(p.stone, [0, 0, 0], 0.22)), all, 0, 0.1, 1.02);
    pass(rgba(p.stone), (i) => hash(i * 7 + 4) < 0.55, 0, 0, 1);
    pass(rgba(mix(p.stone, p.stoneLight, 0.4)), (i) => hash(i * 7 + 4) >= 0.55, 0, 0, 1);
    pass(rgba(p.stoneLight, 0.55), all, -0.26, -0.3, 0.46);
    return c;
  }

  // ---------------------------------------------------------------- each frame

  draw(world: World, pose: Pose, hover: Hover | null, now: number): void {
    const { pal: p, ctx, canvas } = this;
    if (!canvas.width) return;
    const scale = canvas.width / W;
    const night = nightness(world.step);

    // One pass over the cells: build the scent picture, note where food lies, and notice new walls.
    const px = this.scentImage.data;
    const food = this.foodCells;
    let foodCount = 0;
    let wallSum = 0;
    const [tr, tg, tb] = p.trail;
    const [hr, hg, hb] = p.home;
    for (let i = 0, o = 0; i < W * H; i++, o += 4) {
      const t = Math.min(1, world.trail[i] * 1.2);
      const h = Math.min(1, world.home[i]) * 0.5;
      const sum = t + h;
      if (sum > 0.004) {
        px[o] = (tr * t + hr * h) / sum;
        px[o + 1] = (tg * t + hg * h) / sum;
        px[o + 2] = (tb * t + hb * h) / sum;
        px[o + 3] = 255 * (1 - (1 - t * 0.95) * (1 - h * 0.75));
      } else {
        px[o + 3] = 0;
      }
      if (world.food[i]) food[foodCount++] = i;
      if (world.wall[i]) wallSum += (i % 8191) + 1;
    }
    this.scentCtx.putImageData(this.scentImage, 0, 0);
    const soft = this.softCtx;
    soft.clearRect(0, 0, this.soft.width, this.soft.height);
    soft.imageSmoothingEnabled = true;
    if ("filter" in soft) soft.filter = "blur(1.3px)";
    soft.drawImage(this.scent, 0, 0, this.soft.width, this.soft.height);
    if (wallSum !== this.wallSum || this.solid.width !== canvas.width) {
      this.solid = this.drawSolid(world);
      this.wallSum = wallSum;
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(this.ground, 0, 0);
    ctx.drawImage(this.soft, 0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.solid, 0, 0);
    this.drawFood(world, foodCount, scale);

    if (night > 0.004) {
      // Moonlight: everything so far goes blue and dim, then the scents are added back as light.
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = night * 0.86;
      ctx.fillStyle = rgba(p.night);
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      this.bloomCtx.clearRect(0, 0, this.bloom.width, this.bloom.height);
      this.bloomCtx.drawImage(this.scent, 0, 0, this.bloom.width, this.bloom.height);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = night * 0.85;
      ctx.drawImage(this.soft, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = night;
      ctx.drawImage(this.bloom, 0, 0, canvas.width, canvas.height);

      // A warm light from the way in.
      const nx = world.nestX * scale;
      const ny = world.nestY * scale;
      const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, scale * 11);
      glow.addColorStop(0, rgba(p.ember, 0.75));
      glow.addColorStop(0.3, rgba(p.ember, 0.28));
      glow.addColorStop(1, rgba(p.ember, 0));
      ctx.globalAlpha = night;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(nx, ny, scale * 11, 0, Math.PI * 2);
      ctx.fill();

      if (!this.stillness.matches) this.drawFireflies(night, now, scale);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    this.drawAnts(world, pose, scale, night);
    if (hover) this.drawHover(hover, scale, night);
  }

  /** Leaf: one to three torn pieces per cell, more where there is more to carry off. */
  private drawFood(world: World, count: number, scale: number): void {
    const { ctx, pal: p } = this;
    const food = this.foodCells;
    for (let shade = 0; shade < 3; shade++) {
      ctx.fillStyle = shade === 0 ? rgba(mix(p.leaf, [0, 0, 0], 0.28), 0.5) : rgba(shade === 1 ? p.leaf : p.leafLight);
      ctx.beginPath();
      for (let k = 0; k < count; k++) {
        const i = food[k];
        const amount = world.food[i];
        const pieces = amount > 60 ? 3 : amount > 20 ? 2 : 1;
        for (let j = 0; j < pieces; j++) {
          const id = i * 5 + j;
          // The shadow pass draws every piece; the two greens share them between themselves.
          if (shade !== 0 && (hash(id + 9) < 0.5 ? 1 : 2) !== shade) continue;
          const x = ((i % W) + 0.5 + (hash(id) - 0.5) * 0.9) * scale + (shade === 0 ? scale * 0.12 : 0);
          const y = (Math.floor(i / W) + 0.5 + (hash(id + 1) - 0.5) * 0.9) * scale + (shade === 0 ? scale * 0.16 : 0);
          const r = scale * (0.3 + hash(id + 2) * 0.22);
          ctx.moveTo(x + r * 1.5, y);
          ctx.ellipse(x, y, r * 1.5, r * 0.9, hash(id + 3) * Math.PI, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    }
  }

  /** Ants: three body parts, six legs that step as they walk, and a piece of leaf held high. */
  private drawAnts(world: World, pose: Pose, scale: number, night: number): void {
    const { ctx, pal: p } = this;
    const a = world.ants;
    const { x: px, y: py, angle: pa } = pose;
    const u = Math.max(1.05, scale * 0.34);
    const body = rgba(mix(p.ant, p.antNight, night));
    const gait = pose.time * 1.1;

    if (night < 0.6) {
      ctx.fillStyle = `rgba(40,20,8,${0.2 * (1 - night)})`;
      ctx.beginPath();
      for (let i = 0; i < a.count; i++) {
        const c = Math.cos(pa[i]);
        const s = Math.sin(pa[i]);
        const x = px[i] * scale + u * 0.6;
        const y = py[i] * scale + u * 0.9;
        ctx.moveTo(x - c * 1.9 * u + u * 1.3, y - s * 1.9 * u);
        ctx.arc(x - c * 1.9 * u, y - s * 1.9 * u, u * 1.3, 0, Math.PI * 2);
        ctx.moveTo(x + c * 1.6 * u + u, y + s * 1.6 * u);
        ctx.arc(x + c * 1.6 * u, y + s * 1.6 * u, u, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    if (u >= 1.25) {
      ctx.strokeStyle = body;
      ctx.lineWidth = Math.max(0.7, u * 0.3);
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i < a.count; i++) {
        const angle = pa[i];
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const x = px[i] * scale;
        const y = py[i] * scale;
        for (let k = -1; k <= 1; k++) {
          const bx = x + c * k * 0.55 * u;
          const by = y + s * k * 0.55 * u;
          const swing = Math.sin(gait + i * 1.7 + k * 2.1) * 0.38;
          for (let side = -1; side <= 1; side += 2) {
            const dir = angle + side * (Math.PI / 2 - k * 0.5) + swing * side * (k === 0 ? -1 : 1);
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + Math.cos(dir) * 2.3 * u, by + Math.sin(dir) * 2.3 * u);
          }
        }
        // Feelers.
        const hx = x + c * 1.65 * u;
        const hy = y + s * 1.65 * u;
        const feel = Math.sin(gait * 0.6 + i) * 0.2;
        for (let side = -1; side <= 1; side += 2) {
          ctx.moveTo(hx, hy);
          ctx.lineTo(hx + Math.cos(angle + side * (0.55 + feel)) * 1.9 * u, hy + Math.sin(angle + side * (0.55 + feel)) * 1.9 * u);
        }
      }
      ctx.stroke();
    }

    ctx.fillStyle = body;
    ctx.beginPath();
    for (let i = 0; i < a.count; i++) {
      const c = Math.cos(pa[i]);
      const s = Math.sin(pa[i]);
      const x = px[i] * scale;
      const y = py[i] * scale;
      ctx.moveTo(x - c * 1.95 * u + u * 1.3, y - s * 1.95 * u);
      ctx.arc(x - c * 1.95 * u, y - s * 1.95 * u, u * 1.3, 0, Math.PI * 2);
      ctx.moveTo(x + u * 0.85, y);
      ctx.arc(x, y, u * 0.85, 0, Math.PI * 2);
      ctx.moveTo(x + c * 1.65 * u + u * 0.98, y + s * 1.65 * u);
      ctx.arc(x + c * 1.65 * u, y + s * 1.65 * u, u * 0.98, 0, Math.PI * 2);
    }
    ctx.fill();

    // What they carry, in two greens so a busy trail flickers.
    for (let shade = 0; shade < 2; shade++) {
      ctx.fillStyle = rgba(mix(shade ? p.leafLight : p.leaf, [235, 255, 190], night * 0.35));
      ctx.beginPath();
      for (let i = shade; i < a.count; i += 2) {
        if (!a.carrying[i]) continue;
        const angle = pa[i];
        const x = px[i] * scale + Math.cos(angle) * 3 * u;
        const y = py[i] * scale + Math.sin(angle) * 3 * u;
        ctx.moveTo(x + u * 2, y);
        ctx.ellipse(x, y, u * 2, u * 1.2, angle + 0.9 + hash(i) * 0.8, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  /** A few fireflies over the tray at night. Only for show: they aren't part of the colony. */
  private drawFireflies(night: number, now: number, scale: number): void {
    const { ctx, canvas } = this;
    const t = now / 1000;
    for (let i = 0; i < 16; i++) {
      const x = (hash(i * 9 + 1) + Math.sin(t * (0.05 + hash(i * 9 + 2) * 0.06) + i) * 0.08) * canvas.width;
      const y = (hash(i * 9 + 3) + Math.cos(t * (0.06 + hash(i * 9 + 4) * 0.05) + i * 2) * 0.1) * canvas.height;
      const blink = Math.max(0, Math.sin(t * (0.7 + hash(i * 9 + 5)) + i * 3)) ** 2 * smooth((night - 0.3) / 0.5);
      if (blink < 0.02) continue;
      const r = scale * 2.4;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r);
      halo.addColorStop(0, "rgba(226,255,150,0.95)");
      halo.addColorStop(0.16, "rgba(206,255,130,0.5)");
      halo.addColorStop(0.45, "rgba(190,255,120,0.12)");
      halo.addColorStop(1, "rgba(190,255,120,0)");
      ctx.globalAlpha = blink;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** A ring the size of the brush, where the pointer is. */
  private drawHover(hover: Hover, scale: number, night: number): void {
    const { ctx, pal: p } = this;
    const colour = hover.brush === "food" ? p.leaf : hover.brush === "wall" ? p.stone : p.ant;
    const shown = mix(colour, [255, 255, 255], night * 0.6);
    const x = hover.x * scale;
    const y = hover.y * scale;
    const r = Math.max(4, hover.r * scale);
    ctx.fillStyle = rgba(shown, 0.16);
    ctx.strokeStyle = rgba(shown, 0.9);
    ctx.lineWidth = Math.max(1.5, scale * 0.3);
    ctx.setLineDash(hover.brush === "erase" ? [r * 0.5, r * 0.35] : []);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
