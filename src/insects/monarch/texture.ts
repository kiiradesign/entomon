import { BufferGeometry, CanvasTexture, SRGBColorSpace } from "three";
import { exportTextureSize, registerTextureCachePurge } from "../../render/export-quality";

export type WingKind = "fore" | "hind";
type P = [number, number];
type Vein = [P, P];

/**
 * Pattern and outlines are authored in "specimen" space (right side, x out from the body,
 * y toward the head, wings spread as if pinned). The forewing is then swept forward.
 */
const FORE_SWEEP = 0.3;

const FORE: P[] = [
  [0.0, 0.02],
  [0.08, 0.06],
  [0.3, 0.075],
  [0.55, 0.05],
  [0.75, -0.01],
  [0.88, -0.08],
  [0.96, -0.15],
  [0.995, -0.2],
  [1.0, -0.245],
  [0.97, -0.3],
  [0.9, -0.36],
  [0.8, -0.42],
  [0.68, -0.48],
  [0.56, -0.535],
  [0.48, -0.565],
  [0.44, -0.555],
  [0.3, -0.39],
  [0.14, -0.2],
  [0.04, -0.09],
  [0.01, -0.05],
];

const HIND: P[] = [
  [0.0, 0.04],
  [0.12, 0.1],
  [0.3, 0.1],
  [0.46, 0.03],
  [0.57, -0.07],
  [0.63, -0.2],
  [0.645, -0.34],
  [0.61, -0.48],
  [0.53, -0.6],
  [0.41, -0.69],
  [0.27, -0.74],
  [0.15, -0.73],
  [0.07, -0.64],
  [0.025, -0.46],
  [0.005, -0.22],
];

/** Raw outline vertex ranges that form the outer margin (where the white dot rows live). */
const MARGIN: Record<WingKind, [number, number]> = { fore: [5, 14], hind: [3, 12] };

const CELL: Record<WingKind, P[]> = {
  fore: [
    [0.03, -0.03],
    [0.4, -0.06],
    [0.5, -0.14],
    [0.47, -0.23],
    [0.38, -0.2],
    [0.25, -0.16],
    [0.03, -0.08],
  ],
  hind: [
    [0.04, -0.02],
    [0.3, -0.06],
    [0.36, -0.2],
    [0.33, -0.26],
    [0.26, -0.31],
    [0.05, -0.12],
  ],
};

const VEINS: Record<WingKind, Vein[]> = {
  fore: [
    [[0.4, -0.06], [0.62, 0.05]],
    [[0.45, -0.09], [0.82, -0.03]],
    [[0.5, -0.14], [0.995, -0.21]],
    [[0.5, -0.17], [0.96, -0.31]],
    [[0.47, -0.23], [0.85, -0.41]],
    [[0.38, -0.2], [0.71, -0.48]],
    [[0.25, -0.16], [0.58, -0.53]],
    [[0.03, -0.07], [0.45, -0.56]],
  ],
  hind: [
    [[0.04, 0.01], [0.5, 0.0]],
    [[0.3, -0.06], [0.6, -0.11]],
    [[0.33, -0.12], [0.645, -0.28]],
    [[0.36, -0.2], [0.63, -0.43]],
    [[0.33, -0.26], [0.56, -0.57]],
    [[0.26, -0.31], [0.46, -0.67]],
    [[0.17, -0.25], [0.32, -0.74]],
    [[0.05, -0.1], [0.17, -0.74]],
    [[0.03, -0.08], [0.06, -0.62]],
  ],
};

function chaikin(pts: P[], iterations: number): P[] {
  let out = pts;
  for (let k = 0; k < iterations; k++) {
    const next: P[] = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      const b = out[(i + 1) % out.length];
      next.push(
        [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
        [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75],
      );
    }
    out = next;
  }
  return out;
}

const SMOOTH = 3;
const PER_EDGE = 2 ** SMOOTH;

const foreScale = (() => {
  const c = Math.cos(FORE_SWEEP);
  const s = Math.sin(FORE_SWEEP);
  return 1 / Math.max(...FORE.map(([x, y]) => x * c - y * s));
})();

function place(kind: WingKind, [x, y]: P): P {
  if (kind === "hind") return [x, y];
  const c = Math.cos(FORE_SWEEP);
  const s = Math.sin(FORE_SWEEP);
  return [(x * c - y * s) * foreScale, (x * s + y * c) * foreScale];
}

const outlineCache = new Map<WingKind, P[]>();

export function wingOutline(kind: WingKind): P[] {
  const hit = outlineCache.get(kind);
  if (hit) return hit;
  const raw = kind === "fore" ? FORE : HIND;
  const pts = chaikin(raw, SMOOTH).map((p) => place(kind, p));
  outlineCache.set(kind, pts);
  return pts;
}

export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

export function wingBounds(pts: P[], span: number, pad = 0.03): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x * span);
    maxX = Math.max(maxX, x * span);
    minY = Math.min(minY, y * span);
    maxY = Math.max(maxY, y * span);
  }
  const p = pad * span;
  return { minX: minX - p, maxX: maxX + p, minY: minY - p, maxY: maxY + p };
}

/** UV v grows with y so the canvas top row (flipY) lands on the head-side edge. */
export function applyWingUVs(geo: BufferGeometry, b: Bounds): void {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const dx = b.maxX - b.minX;
  const dy = b.maxY - b.minY;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - b.minX) / dx, (pos.getY(i) - b.minY) / dy);
  }
  uv.needsUpdate = true;
}

const INK = "#100a07";
const WHITE = "#f7f3ea";
const SPOT_ORANGE = "#f08a32";

function paintWing(kind: WingKind): HTMLCanvasElement {
  const size = exportTextureSize(1024);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const pts = wingOutline(kind);
  const b = wingBounds(pts, 1);
  const sx = size / (b.maxX - b.minX);
  const sy = size / (b.maxY - b.minY);
  const unit = (sx + sy) * 0.5;
  const px = ([x, y]: P): P => [(x - b.minX) * sx, (b.maxY - y) * sy];
  const q = (p: P): P => px(place(kind, p));
  const rot = kind === "fore" ? FORE_SWEEP : 0;

  const polyline = (path: P[], close: boolean) => {
    ctx.beginPath();
    path.forEach((p, i) => {
      const [cx, cy] = px(p);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    if (close) ctx.closePath();
  };

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  polyline(pts, true);
  ctx.clip();

  const [gx, gy] = q(kind === "fore" ? [0.35, -0.22] : [0.25, -0.32]);
  const base = ctx.createRadialGradient(gx, gy, 0, gx, gy, unit * 0.7);
  if (kind === "fore") {
    base.addColorStop(0, "#ee7424");
    base.addColorStop(0.55, "#e0601a");
    base.addColorStop(1, "#c54a10");
  } else {
    base.addColorStop(0, "#f69c42");
    base.addColorStop(0.55, "#ee8028");
    base.addColorStop(1, "#d8641a");
  }
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  let seed = kind === "fore" ? 7 : 13;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = rand() > 0.5 ? "rgba(255,200,130,0.07)" : "rgba(110,36,0,0.08)";
    ctx.fillRect(rand() * size, rand() * size, 3 + rand() * 4, 2 + rand() * 2);
  }

  const [rx, ry] = q([0, -0.02]);
  const root = ctx.createRadialGradient(rx, ry, 0, rx, ry, unit * 0.16);
  root.addColorStop(0, "rgba(16,10,7,0.95)");
  root.addColorStop(1, "rgba(16,10,7,0)");
  ctx.fillStyle = root;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const veinW = unit * (kind === "fore" ? 0.014 : 0.017);
  for (const [s, e] of VEINS[kind]) {
    const dx = e[0] - s[0];
    const dy = e[1] - s[1];
    const len = Math.hypot(dx, dy);
    const bow = 0.05 * len;
    const c: P = [(s[0] + e[0]) / 2 - (dy / len) * bow, (s[1] + e[1]) / 2 + (dx / len) * bow];
    const segs = 8;
    let prev = q(s);
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const u = 1 - t;
      const pt = q([
        u * u * s[0] + 2 * u * t * c[0] + t * t * e[0],
        u * u * s[1] + 2 * u * t * c[1] + t * t * e[1],
      ]);
      ctx.lineWidth = veinW * (1 + 1.6 * t ** 1.6);
      ctx.beginPath();
      ctx.moveTo(prev[0], prev[1]);
      ctx.lineTo(pt[0], pt[1]);
      ctx.stroke();
      prev = pt;
    }
  }

  ctx.lineWidth = veinW * 1.15;
  polyline(
    CELL[kind].map((p) => place(kind, p)),
    true,
  );
  ctx.stroke();

  if (kind === "fore") {
    const apexIdx = 8 * PER_EDGE;
    ctx.lineWidth = unit * 0.09;
    polyline(pts.slice(0, apexIdx), false);
    ctx.stroke();

    polyline(
      (
        [
          [0.48, 0.14],
          [1.15, 0.14],
          [1.15, -0.42],
          [0.9, -0.42],
          [0.86, -0.31],
          [0.78, -0.21],
          [0.66, -0.12],
          [0.53, -0.05],
          [0.48, -0.02],
        ] as P[]
      ).map((p) => place(kind, p)),
      true,
    );
    ctx.fill();
  } else {
    const [kx, ky] = q([0.25, -0.47]);
    ctx.beginPath();
    ctx.ellipse(kx, ky, unit * 0.026, unit * 0.018, -1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const band = unit * (kind === "fore" ? 0.072 : 0.085);
  ctx.lineWidth = band * 2;
  polyline(pts, true);
  ctx.stroke();

  const spot = (p: P, rx: number, ry: number, angle: number, color: string) => {
    const [cx, cy] = q(p);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, unit * rx, unit * ry, -(angle + rot), 0, Math.PI * 2);
    ctx.fill();
  };

  if (kind === "fore") {
    spot([0.68, -0.075], 0.03, 0.017, -0.4, SPOT_ORANGE);
    spot([0.76, -0.115], 0.029, 0.016, -0.5, SPOT_ORANGE);
    spot([0.825, -0.165], 0.026, 0.015, -0.65, SPOT_ORANGE);
    spot([0.875, -0.23], 0.022, 0.013, -0.85, SPOT_ORANGE);
    spot([0.905, -0.3], 0.017, 0.011, -1.1, SPOT_ORANGE);
    spot([0.86, -0.37], 0.012, 0.009, 0, SPOT_ORANGE);
    spot([0.92, -0.17], 0.011, 0.009, 0, SPOT_ORANGE);
    spot([0.6, -0.005], 0.019, 0.011, -0.1, WHITE);
    spot([0.69, -0.03], 0.017, 0.01, -0.25, WHITE);
    spot([0.77, -0.065], 0.014, 0.009, -0.4, WHITE);
    spot([0.84, -0.11], 0.011, 0.008, -0.6, WHITE);
  }

  let ccx = 0;
  let ccy = 0;
  const cpts = pts.map(px);
  for (const [x, y] of cpts) {
    ccx += x;
    ccy += y;
  }
  ccx /= cpts.length;
  ccy /= cpts.length;

  const [m0, m1] = MARGIN[kind];
  const walkDots = (step: number, offset: number, inset: number, radius: number) => {
    ctx.fillStyle = WHITE;
    let travelled = 0;
    let next = offset;
    for (let i = 0; i < cpts.length; i++) {
      const a = cpts[i];
      const c = cpts[(i + 1) % cpts.length];
      const segLen = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const edge = i / PER_EDGE;
      while (next <= travelled + segLen) {
        const t = (next - travelled) / Math.max(segLen, 1e-6);
        next += step;
        if (edge < m0 || edge > m1) continue;
        const x = a[0] + (c[0] - a[0]) * t;
        const y = a[1] + (c[1] - a[1]) * t;
        let nx = -(c[1] - a[1]);
        let ny = c[0] - a[0];
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl;
        ny /= nl;
        if (nx * (ccx - x) + ny * (ccy - y) < 0) {
          nx = -nx;
          ny = -ny;
        }
        ctx.beginPath();
        ctx.arc(x + nx * inset, y + ny * inset, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      travelled += segLen;
    }
  };
  walkDots(band * 0.62, 0, band * 0.3, band * 0.12);
  walkDots(band * 1.35, band * 0.4, band * 0.7, band * 0.17);

  ctx.restore();
  return canvas;
}

const cache = new Map<WingKind, CanvasTexture>();

export function monarchWingTexture(kind: WingKind): CanvasTexture {
  const hit = cache.get(kind);
  if (hit) return hit;
  const tex = new CanvasTexture(paintWing(kind));
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  cache.set(kind, tex);
  return tex;
}

registerTextureCachePurge(() => {
  for (const tex of cache.values()) tex.dispose();
  cache.clear();
});
