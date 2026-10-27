import type { BufferGeometry } from "three";

export type P = [number, number];
export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

/** Corner-cutting smoothing; keeps the overall silhouette while rounding vertices. */
export function chaikin(pts: P[], iterations: number): P[] {
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

export function outlineBounds(pts: P[], pad = 0): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad };
}

/** UV v grows with y so the canvas top row (flipY) lands on the max-y edge. */
export function applyPlanarUVs(geo: BufferGeometry, b: Bounds): void {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const dx = b.maxX - b.minX;
  const dy = b.maxY - b.minY;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - b.minX) / dx, (pos.getY(i) - b.minY) / dy);
  }
  uv.needsUpdate = true;
}

/** Lowest and highest y where the closed outline crosses the vertical line at x. */
export function spanAt(pts: P[], x: number): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) continue;
    const y = a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  return lo <= hi ? [lo, hi] : null;
}
