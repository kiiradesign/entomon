import { CanvasTexture, SRGBColorSpace } from "three";
import { chaikin, outlineBounds, type Bounds, type P } from "../../core/outline";
import { exportTextureSize, registerTextureCachePurge } from "../../render/export-quality";

export type WingKind = "fore" | "hind";

/**
 * Right-side outlines in wing units (half wingspan ≈ 1), both measured from the forewing root:
 * x out from the body, y toward the head. Traced from a spread Actias luna — a broad, round-tipped
 * forewing carrying most of the area, and a smaller hindwing that narrows into a long, slim tail.
 */
const FORE_RAW: P[] = [
  [0.02, 0.0],
  [0.2, 0.05],
  [0.45, 0.065],
  [0.7, 0.025],
  [0.88, -0.04],
  [0.975, -0.12],
  [0.99, -0.2],
  [0.9, -0.33],
  [0.75, -0.43],
  [0.56, -0.5],
  [0.44, -0.5],
  [0.3, -0.41],
  [0.15, -0.26],
  [0.04, -0.1],
];
/** Raw FORE_RAW vertices from the root to the apex: the leading edge the maroon costa follows. */
const COSTA_TO = 5;

/** Compact lobe that pinches in sharply to a slim tail with a flared spoon tip. */
const HIND_RAW: P[] = [
  [0.02, -0.05],
  [0.2, -0.1],
  [0.4, -0.19],
  [0.54, -0.31],
  [0.57, -0.45],
  [0.5, -0.59],
  [0.36, -0.69],
  [0.22, -0.74],
  [0.14, -0.78],
  [0.105, -0.9],
  [0.095, -1.04],
  [0.11, -1.16],
  [0.15, -1.25],
  [0.2, -1.3],
  [0.16, -1.35],
  [0.095, -1.29],
  [0.065, -1.17],
  [0.052, -1.0],
  [0.046, -0.82],
  [0.036, -0.6],
  [0.025, -0.3],
];

const SMOOTH = 3;
const outlines: Record<WingKind, P[]> = {
  fore: chaikin(FORE_RAW, SMOOTH),
  hind: chaikin(HIND_RAW, SMOOTH),
};

export const wingOutline = (kind: WingKind): P[] => outlines[kind];
export const wingBounds = (kind: WingKind): Bounds => outlineBounds(outlines[kind], 0.03);

/** Below this y the hindwing is tail, which trails the wingbeat instead of moving rigidly. */
export const TAIL_FROM_Y = -0.7;

const MAROON = "#7c2f3e";
function paintWing(kind: WingKind): HTMLCanvasElement {
  const b = wingBounds(kind);
  const longEdge = exportTextureSize(1024);
  const s = longEdge / Math.max(b.maxX - b.minX, b.maxY - b.minY);
  const w = Math.round((b.maxX - b.minX) * s);
  const h = Math.round((b.maxY - b.minY) * s);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const px = ([x, y]: P): P => [(x - b.minX) * s, (b.maxY - y) * s];
  const pts = outlines[kind];

  const trace = (path: P[], close = true) => {
    ctx.beginPath();
    path.forEach((p, i) => {
      const [cx, cy] = px(p);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    if (close) ctx.closePath();
  };

  trace(pts);
  ctx.save();
  ctx.clip();

  // Sage-mint ground, yellower and brighter toward the furry wing base.
  const [rx, ry] = px(kind === "fore" ? [0, 0] : [0, -0.1]);
  const reach = (kind === "fore" ? 1.0 : 1.3) * s;
  const base = ctx.createRadialGradient(rx, ry, 0, rx, ry, reach);
  base.addColorStop(0, "#d8efb4");
  base.addColorStop(0.25, "#bfe0a4");
  base.addColorStop(0.6, "#a3c8a0");
  base.addColorStop(1, "#93b89e");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  let seed = kind === "fore" ? 11 : 29;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 3200; i++) {
    ctx.fillStyle = rand() > 0.5 ? "rgba(240, 255, 220, 0.07)" : "rgba(40, 80, 60, 0.06)";
    ctx.fillRect(rand() * w, rand() * h, 2 + rand() * 4, 1.5 + rand() * 2);
  }

  // Pale fur at the root.
  const fur = ctx.createRadialGradient(rx, ry, 0, rx, ry, 0.26 * s);
  fur.addColorStop(0, "rgba(246, 246, 222, 0.95)");
  fur.addColorStop(0.5, "rgba(236, 244, 204, 0.5)");
  fur.addColorStop(1, "rgba(230, 240, 200, 0)");
  ctx.fillStyle = fur;
  ctx.fillRect(0, 0, w, h);

  // A brighter lime flush along the inner forewing, as in the photographs.
  if (kind === "fore") {
    const [fx, fy] = px([0.22, -0.2]);
    const flush = ctx.createRadialGradient(fx, fy, 0, fx, fy, 0.3 * s);
    flush.addColorStop(0, "rgba(196, 232, 140, 0.55)");
    flush.addColorStop(1, "rgba(196, 232, 140, 0)");
    ctx.fillStyle = flush;
    ctx.fillRect(0, 0, w, h);
  }

  // Fine pale veins fanning from the root to the margin (and down the tail).
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(226, 236, 196, 0.4)";
  ctx.lineWidth = 0.005 * s;
  const veins: [P, P, P][] =
    kind === "fore"
      ? [
          [[0.04, -0.01], [0.5, -0.02], [0.95, -0.14]],
          [[0.05, -0.03], [0.5, -0.12], [0.9, -0.3]],
          [[0.05, -0.05], [0.45, -0.2], [0.74, -0.42]],
          [[0.05, -0.07], [0.35, -0.25], [0.56, -0.48]],
          [[0.04, -0.09], [0.22, -0.25], [0.38, -0.45]],
        ]
      : [
          [[0.04, -0.08], [0.3, -0.22], [0.55, -0.4]],
          [[0.04, -0.1], [0.3, -0.34], [0.46, -0.6]],
          [[0.04, -0.12], [0.22, -0.45], [0.3, -0.7]],
          [[0.04, -0.14], [0.1, -0.7], [0.12, -1.22]],
        ];
  for (const [a, c, e] of veins) {
    ctx.beginPath();
    ctx.moveTo(...px(a));
    ctx.quadraticCurveTo(...px(c), ...px(e));
    ctx.stroke();
  }

  if (kind === "fore") {
    // The forewing eyespot hangs off the costa on a short maroon stroke.
    ctx.strokeStyle = MAROON;
    ctx.lineWidth = 0.014 * s;
    ctx.beginPath();
    ctx.moveTo(...px([0.4, 0.05]));
    ctx.quadraticCurveTo(...px([0.42, -0.02]), ...px([0.47, -0.06]));
    ctx.stroke();
  }

  // Eyespot: ochre ring, maroon rim, a dark crescent bar over a pale window.
  const eyespot = (c: P, r: number, stretch: number, angle: number) => {
    const [cx, cy] = px(c);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(1, stretch);
    const R = r * s;
    ctx.fillStyle = MAROON;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d9b45a";
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.82, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#eef0dc";
    ctx.beginPath();
    ctx.arc(0, R * 0.08, R * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2c1a1e";
    ctx.lineWidth = R * 0.16;
    ctx.beginPath();
    ctx.arc(0, R * 0.08, R * 0.5, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.restore();
  };
  if (kind === "fore") eyespot([0.48, -0.085], 0.038, 1.2, 0.4);
  else eyespot([0.24, -0.44], 0.042, 1.1, 0);

  // Narrow yellowish outer margin, rosier along the tail.
  ctx.restore();
  trace(pts);
  ctx.save();
  ctx.clip();
  const margin = ctx.createLinearGradient(0, 0, 0, h);
  margin.addColorStop(0, "#e4dc8e");
  margin.addColorStop(kind === "hind" ? 0.55 : 1, "#d8d692");
  if (kind === "hind") margin.addColorStop(1, "#d79a86");
  trace(pts);
  ctx.strokeStyle = margin;
  ctx.lineWidth = 0.022 * s;
  ctx.stroke();
  if (kind === "fore") {
    // Maroon costa forms the leading edge itself, thinning toward the apex.
    const edge = pts.slice(0, COSTA_TO * 2 ** SMOOTH + 1);
    ctx.lineCap = "round";
    ctx.strokeStyle = MAROON;
    for (let i = 1; i < edge.length; i++) {
      const t = i / edge.length;
      ctx.lineWidth = (0.075 - 0.035 * t) * s;
      ctx.beginPath();
      ctx.moveTo(...px(edge[i - 1]));
      ctx.lineTo(...px(edge[i]));
      ctx.stroke();
    }
  }
  ctx.restore();
  return canvas;
}

const cache = new Map<WingKind, CanvasTexture>();

export function lunaWingTexture(kind: WingKind): CanvasTexture {
  const hit = cache.get(kind);
  if (hit) return hit;
  const tex = new CanvasTexture(paintWing(kind));
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  cache.set(kind, tex);
  return tex;
}

/** Bipectinate (feathery) antenna: a central shaft with combs either side, on a transparent canvas. */
export const ANTENNA_OUTLINE: P[] = chaikin(
  [
    [0, 0],
    [0.045, 0.06],
    [0.05, 0.16],
    [0.03, 0.24],
    [0, 0.27],
    [-0.03, 0.24],
    [-0.05, 0.16],
    [-0.045, 0.06],
  ],
  2,
);
export const antennaBounds = (): Bounds => outlineBounds(ANTENNA_OUTLINE, 0.004);

let antennaTex: CanvasTexture | null = null;

export function antennaTexture(): CanvasTexture {
  if (antennaTex) return antennaTex;
  const b = antennaBounds();
  const H = exportTextureSize(512);
  const s = H / (b.maxY - b.minY);
  const W = Math.round((b.maxX - b.minX) * s);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const px = ([x, y]: P): P => [(x - b.minX) * s, (b.maxY - y) * s];
  ctx.beginPath();
  ANTENNA_OUTLINE.forEach((p, i) => (i ? ctx.lineTo(...px(p)) : ctx.moveTo(...px(p))));
  ctx.closePath();
  ctx.clip();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#c9a250";
  ctx.lineWidth = 0.005 * s;
  for (let y = 0.02; y < 0.27; y += 0.011) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(...px([0, y]));
      ctx.lineTo(...px([side * 0.06, y + 0.035]));
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "#8a6430";
  ctx.lineWidth = 0.009 * s;
  ctx.beginPath();
  ctx.moveTo(...px([0, 0]));
  ctx.lineTo(...px([0, 0.27]));
  ctx.stroke();
  antennaTex = new CanvasTexture(canvas);
  antennaTex.colorSpace = SRGBColorSpace;
  antennaTex.anisotropy = 8;
  return antennaTex;
}

registerTextureCachePurge(() => {
  for (const tex of cache.values()) tex.dispose();
  cache.clear();
  antennaTex?.dispose();
  antennaTex = null;
});
