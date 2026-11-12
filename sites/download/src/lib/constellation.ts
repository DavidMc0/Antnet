import { seededRandom } from "./ui";

const SVG_NS = "http://www.w3.org/2000/svg";
const W = 600;
const H = 170;
const CX = W / 2;
const CY = H / 2;

export interface Constellation {
  /** Flash a route from a random node to the file, e.g. when a chunk arrives. */
  spark(): void;
}

/**
 * Decorative node field behind the file badge. Layout is seeded from the
 * address so each file gets a stable picture; state styling lives in CSS
 * (keyed off main[data-state]).
 */
export function drawConstellation(svg: SVGSVGElement, seed: string, nodeCount = 34, routeCount = 7): Constellation {
  const rand = seededRandom(seed);
  const nodes: { x: number; y: number }[] = [];
  let guard = 0;
  while (nodes.length < nodeCount && guard++ < 2000) {
    const x = 16 + rand() * (W - 32);
    const y = 12 + rand() * (H - 24);
    // Keep clear of the badge in the middle, and of each other.
    if (Math.hypot((x - CX) / 1.6, y - CY) < 58) continue;
    if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 34)) continue;
    nodes.push({ x, y });
  }

  const mesh = el("g", { class: "c-mesh" });
  const routes = el("g", { class: "c-routes" });
  const dots = el("g", { class: "c-nodes" });

  // Faint mesh: each node to its two nearest neighbours.
  const seen = new Set<string>();
  nodes.forEach((a, i) => {
    nodes
      .map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
      .filter((o) => o.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2)
      .forEach(({ j }) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) return;
        seen.add(key);
        mesh.append(el("line", { x1: a.x, y1: a.y, x2: nodes[j].x, y2: nodes[j].y }));
      });
  });

  // Routes: the nearest few nodes to the file.
  const holders = nodes
    .map((n, i) => ({ i, d: Math.hypot((n.x - CX) / 1.4, n.y - CY) }))
    .sort((p, q) => p.d - q.d)
    .slice(0, routeCount)
    .map((o) => o.i);
  const routeEls = holders.map((i, k) => {
    const n = nodes[i];
    const path = el("path", {
      d: `M${n.x.toFixed(1)} ${n.y.toFixed(1)} Q ${((n.x + CX) / 2).toFixed(1)} ${(CY + (n.y - CY) * 0.2 - 14).toFixed(1)} ${CX} ${CY}`,
      style: `--d:${(k * 0.23).toFixed(2)}s`,
    });
    routes.append(path);
    return path;
  });

  nodes.forEach((n, i) => {
    const holder = holders.includes(i);
    dots.append(
      el("circle", {
        cx: n.x.toFixed(1),
        cy: n.y.toFixed(1),
        r: holder ? 3.4 : 2 + rand() * 1.2,
        class: holder ? "is-holder" : "",
        style: `--d:${(rand() * 2.4).toFixed(2)}s`,
      }),
    );
  });

  svg.replaceChildren(mesh, routes, dots);

  return {
    spark() {
      const path = routeEls[Math.floor(Math.random() * routeEls.length)];
      if (!path) return;
      path.classList.remove("spark");
      // Force reflow so the animation restarts.
      void path.getBoundingClientRect();
      path.classList.add("spark");
    },
  };
}

function el(tag: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== "") node.setAttribute(k, String(v));
  return node;
}
