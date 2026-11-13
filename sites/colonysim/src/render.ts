// Drawing the colony. Every colour comes from a CSS custom property on the canvas (--sim-ground,
// --sim-wall, --sim-food, --sim-trail, --sim-home, --sim-ant, --sim-carry, --sim-nest), so the look
// lives in style.css and changes with the colour scheme.

import { H, W, type World } from "./sim";

type RGB = [number, number, number];

export interface Palette {
  ground: RGB;
  wall: RGB;
  food: RGB;
  trail: RGB;
  home: RGB;
  ant: string;
  carry: string;
  nest: string;
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
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    ground: rgb(v("--sim-ground")),
    wall: rgb(v("--sim-wall")),
    food: rgb(v("--sim-food")),
    trail: rgb(v("--sim-trail")),
    home: rgb(v("--sim-home")),
    ant: v("--sim-ant"),
    carry: v("--sim-carry"),
    nest: v("--sim-nest"),
  };
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  /** One pixel per cell: scents, drawn smoothed. */
  private readonly scentLayer = new OffscreenCanvas(W, H);
  private readonly scentImage = new ImageData(W, H);
  /** One pixel per cell: food and walls, drawn crisp. */
  private readonly solidLayer = new OffscreenCanvas(W, H);
  private readonly solidImage = new ImageData(W, H);

  constructor(
    private readonly canvas: HTMLCanvasElement,
    public palette: Palette,
  ) {
    this.ctx = canvas.getContext("2d")!;
  }

  /** Match the canvas's pixels to its size on screen. */
  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(this.canvas.clientWidth * dpr);
    const height = Math.round(width * (H / W));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  draw(world: World): void {
    const { palette: p, ctx, canvas } = this;
    const scent = this.scentImage.data;
    const solid = this.solidImage.data;
    const [gr, gg, gb] = p.ground;
    const [tr, tg, tb] = p.trail;
    const [hr, hg, hb] = p.home;

    for (let i = 0, o = 0; i < W * H; i++, o += 4) {
      // Scents over the ground: food trails strong, the way home faint.
      const t = Math.min(1, world.trail[i] * 1.6);
      const h = Math.min(1, world.home[i]) * 0.35;
      let r = gr + (hr - gr) * h;
      let g = gg + (hg - gg) * h;
      let b = gb + (hb - gb) * h;
      r += (tr - r) * t;
      g += (tg - g) * t;
      b += (tb - b) * t;
      scent[o] = r;
      scent[o + 1] = g;
      scent[o + 2] = b;
      scent[o + 3] = 255;

      if (world.wall[i]) {
        solid[o] = p.wall[0];
        solid[o + 1] = p.wall[1];
        solid[o + 2] = p.wall[2];
        solid[o + 3] = 255;
      } else if (world.food[i]) {
        solid[o] = p.food[0];
        solid[o + 1] = p.food[1];
        solid[o + 2] = p.food[2];
        solid[o + 3] = 110 + Math.min(145, world.food[i]);
      } else {
        solid[o + 3] = 0;
      }
    }
    this.scentLayer.getContext("2d")!.putImageData(this.scentImage, 0, 0);
    this.solidLayer.getContext("2d")!.putImageData(this.solidImage, 0, 0);

    const scale = canvas.width / W;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.scentLayer, 0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.solidLayer, 0, 0, canvas.width, canvas.height);

    // The nest.
    ctx.fillStyle = p.nest;
    ctx.beginPath();
    ctx.arc(world.nestX * scale, world.nestY * scale, 3.2 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Ants: a short stroke along their heading; a dot of food at the front when carrying.
    const a = world.ants;
    const len = Math.max(1.5, scale * 0.75);
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1, scale * 0.45);
    ctx.strokeStyle = p.ant;
    ctx.beginPath();
    for (let i = 0; i < a.count; i++) {
      const x = a.x[i] * scale;
      const y = a.y[i] * scale;
      const dx = Math.cos(a.angle[i]) * len;
      const dy = Math.sin(a.angle[i]) * len;
      ctx.moveTo(x - dx, y - dy);
      ctx.lineTo(x + dx, y + dy);
    }
    ctx.stroke();
    ctx.fillStyle = p.carry;
    ctx.beginPath();
    for (let i = 0; i < a.count; i++) {
      if (!a.carrying[i]) continue;
      const x = a.x[i] * scale + Math.cos(a.angle[i]) * len;
      const y = a.y[i] * scale + Math.sin(a.angle[i]) * len;
      ctx.moveTo(x + scale * 0.4, y);
      ctx.arc(x, y, Math.max(1, scale * 0.4), 0, Math.PI * 2);
    }
    ctx.fill();
  }
}
