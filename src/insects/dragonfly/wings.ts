import { CanvasTexture, SRGBColorSpace } from "three";
import { exportTextureSize, registerTextureCachePurge } from "../../render/export-quality";
import { chaikin, outlineBounds, spanAt, type Bounds, type P } from "../../core/outline";

export type WingKind = "fore" | "hind";

/**
 * Right-side wings of a male Common Green Darner in body space (x out from the body, y toward
 * the head), traced from a dorsal specimen photo. Wingspan is ~2.05 units across both sides.
 */
const BODY_OUTLINE: Record<WingKind, P[]> = {
  fore: [
    [0.06, 0.05],
    [0.2, 0.085],
    [0.5, 0.13],
    [0.75, 0.175],
    [0.9, 0.19],
    [0.98, 0.17],
    [1.02, 0.125],
    [1.01, 0.075],
    [0.95, 0.04],
    [0.8, -0.015],
    [0.6, -0.055],
    [0.4, -0.08],
    [0.22, -0.085],
    [0.11, -0.06],
    [0.06, -0.01],
  ],
  hind: [
    [0.06, -0.085],
    [0.25, -0.125],
    [0.5, -0.15],
    [0.75, -0.165],
    [0.92, -0.205],
    [1.01, -0.255],
    [1.02, -0.305],
    [0.97, -0.355],
    [0.85, -0.395],
    [0.65, -0.425],
    [0.45, -0.435],
    [0.28, -0.435],
    [0.15, -0.415],
    [0.08, -0.365],
    [0.05, -0.265],
    [0.05, -0.155],
  ],
};

/** Hinge points on the thorax; outlines are stored relative to these. */
export const WING_ROOT: Record<WingKind, P> = { fore: [0.06, 0.02], hind: [0.06, -0.115] };

const outlineCache = new Map<WingKind, P[]>();

export function wingOutline(kind: WingKind): P[] {
  const hit = outlineCache.get(kind);
  if (hit) return hit;
  const [rx, ry] = WING_ROOT[kind];
  const pts = chaikin(BODY_OUTLINE[kind], 3).map(([x, y]): P => [x - rx, y - ry]);
  outlineCache.set(kind, pts);
  return pts;
}

export function wingBounds(kind: WingKind): Bounds {
  return outlineBounds(wingOutline(kind), 0.02);
}

function paintWing(kind: WingKind): HTMLCanvasElement {
  const texW = exportTextureSize(1024);
  const pts = wingOutline(kind);
  const b = wingBounds(kind);
  const sx = texW / (b.maxX - b.minX);
  const texH = Math.max(128, Math.round((b.maxY - b.minY) * sx));
  const sy = texH / (b.maxY - b.minY);
  const canvas = document.createElement("canvas");
  canvas.width = texW;
  canvas.height = texH;
  const ctx = canvas.getContext("2d")!;
  const px = (x: number, y: number): P => [(x - b.minX) * sx, (b.maxY - y) * sy];

  let seed = kind === "fore" ? 11 : 29;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const outlinePath = () => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const [cx, cy] = px(x, y);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.closePath();
  };

  ctx.save();
  outlinePath();
  ctx.clip();

  ctx.fillStyle = "rgba(240, 222, 178, 0.16)";
  ctx.fillRect(0, 0, texW, texH);
  const xs = pts.map(([x]) => x);
  const x0 = Math.min(...xs) + 0.004;
  const x1 = Math.max(...xs) - 0.004;
  const len = x1 - x0;
  const [ax, ay] = px(x0 + len * 0.55, kind === "fore" ? -0.01 : -0.17);
  const amber = ctx.createRadialGradient(ax, ay, 0, ax, ay, len * 0.6 * sx);
  amber.addColorStop(0, "rgba(222, 176, 82, 0.34)");
  amber.addColorStop(0.7, "rgba(222, 176, 82, 0.16)");
  amber.addColorStop(1, "rgba(222, 176, 82, 0.06)");
  ctx.fillStyle = amber;
  ctx.fillRect(0, 0, texW, texH);

  const [bx, by] = px(0, 0);
  const base = ctx.createRadialGradient(bx, by, 0, bx, by, 0.12 * sx);
  base.addColorStop(0, "rgba(150, 100, 40, 0.35)");
  base.addColorStop(1, "rgba(150, 100, 40, 0)");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, texW, texH);

  /** Fraction across the chord (0 = leading edge, 1 = trailing edge) where each main vein runs. */
  const fractions = kind === "fore" ? [0.08, 0.16, 0.3, 0.46, 0.62, 0.78] : [0.07, 0.14, 0.26, 0.4, 0.55, 0.7, 0.84];
  /** Posterior veins sweep back to the trailing edge before the tip, like the cubital and anal veins. */
  const veinEnd = (f: number) => x0 + len * (1 - 0.55 * f ** 1.4);
  const smooth = (a: number, c: number, v: number) => {
    const t = Math.min(1, Math.max(0, (v - a) / (c - a)));
    return t * t * (3 - 2 * t);
  };
  const veinY = (f: number, x: number): number | null => {
    const s = spanAt(pts, x);
    if (!s) return null;
    const end = veinEnd(f);
    const eff = f + (1 - f) * smooth(end - len * 0.3, end, x);
    return s[1] - (s[1] - s[0]) * eff;
  };

  const lines = [0, ...fractions, 1];
  const step = 0.006;
  for (let k = 0; k < lines.length - 1; k++) {
    const fa = lines[k];
    const fb = lines[k + 1];
    let x = x0 + 0.01 + rand() * 0.01;
    while (x < x1 - 0.004) {
      const ya = veinY(fa, x);
      const yb = veinY(fb, x + (rand() - 0.5) * 0.006);
      if (ya === null || yb === null) break;
      const gap = Math.abs(ya - yb);
      if (gap < 0.003) break;
      const rows = Math.max(1, Math.round(gap / 0.03));
      ctx.strokeStyle = "rgba(96, 62, 30, 0.42)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let r = 0; r < rows; r++) {
        const t0 = r / rows;
        const t1 = (r + 1) / rows;
        const jx = (rand() - 0.5) * 0.008;
        const [cx0, cy0] = px(x + jx, ya + (yb - ya) * t0);
        const [cx1, cy1] = px(x + jx + (rand() - 0.5) * 0.006, ya + (yb - ya) * t1);
        ctx.moveTo(cx0, cy0);
        ctx.lineTo(cx1, cy1);
      }
      ctx.stroke();
      if (rows > 1) {
        ctx.beginPath();
        for (let r = 1; r < rows; r++) {
          const t = r / rows + (rand() - 0.5) * 0.12 / rows;
          const [cx0, cy0] = px(x, ya + (yb - ya) * t);
          const nx = x + 0.02;
          const na = veinY(fa, nx);
          const nb = veinY(fb, nx);
          if (na === null || nb === null) continue;
          const [cx1, cy1] = px(nx, na + (nb - na) * t);
          ctx.moveTo(cx0, cy0);
          ctx.lineTo(cx1, cy1);
        }
        ctx.stroke();
      }
      x += Math.min(0.03, Math.max(0.012, gap * 0.45)) + rand() * 0.008 + step;
    }
  }

  for (const f of fractions) {
    ctx.strokeStyle = f < 0.2 ? "rgba(96, 56, 28, 0.8)" : "rgba(78, 52, 30, 0.68)";
    ctx.lineWidth = f < 0.2 ? 3 : 2.2;
    ctx.beginPath();
    let started = false;
    for (let x = x0 + 0.004; x <= Math.min(x1, veinEnd(f)); x += 0.006) {
      const y = veinY(f, x);
      if (y === null) continue;
      const [cx, cy] = px(x, y);
      if (!started) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
      started = true;
    }
    ctx.stroke();
  }

  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "rgba(84, 58, 34, 0.6)";
  outlinePath();
  ctx.stroke();

  const leading: P[] = [];
  for (let x = x0; x <= x1; x += 0.004) {
    const s = spanAt(pts, x);
    if (s) leading.push([x, s[1]]);
  }
  ctx.strokeStyle = "#8a4824";
  ctx.lineWidth = 7;
  ctx.beginPath();
  leading.forEach(([x, y], i) => {
    const [cx, cy] = px(x, y);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  });
  ctx.stroke();

  const nodus = x0 + len * (kind === "fore" ? 0.47 : 0.36);
  const ns = spanAt(pts, nodus);
  if (ns) {
    const [cx, cy] = px(nodus, ns[1] - 0.012);
    ctx.fillStyle = "rgba(60, 34, 18, 0.85)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, 6, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const stigma0 = x0 + len * 0.76;
  const stigma1 = x0 + len * 0.83;
  ctx.beginPath();
  for (let x = stigma0; x <= stigma1; x += 0.003) {
    const s = spanAt(pts, x);
    if (!s) continue;
    const [cx, cy] = px(x, s[1] - 0.004);
    if (x === stigma0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  for (let x = stigma1; x >= stigma0; x -= 0.003) {
    const s = spanAt(pts, x);
    if (!s) continue;
    const [cx, cy] = px(x, s[1] - 0.026);
    ctx.lineTo(cx, cy);
  }
  ctx.closePath();
  ctx.fillStyle = "#a8743e";
  ctx.fill();
  ctx.strokeStyle = "#5a3418";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
  return canvas;
}

const cache = new Map<WingKind, CanvasTexture>();

export function dragonflyWingTexture(kind: WingKind): CanvasTexture {
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
