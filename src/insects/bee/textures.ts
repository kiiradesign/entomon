import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";
import { chaikin, outlineBounds, type Bounds, type P } from "../../core/outline";
import { exportTextureSize, registerTextureCachePurge } from "../../render/export-quality";

export type WingKind = "fore" | "hind";

/**
 * Right-side wings relative to their hinge: x out from the body, y toward the head. Bumblebee
 * wings are small for the body; the hindwing hooks onto the forewing so both beat as one.
 */
const WING_RAW: Record<WingKind, P[]> = {
  fore: [
    [0.0, 0.02],
    [0.15, 0.06],
    [0.4, 0.075],
    [0.62, 0.055],
    [0.78, 0.005],
    [0.86, -0.06],
    [0.83, -0.13],
    [0.7, -0.18],
    [0.5, -0.2],
    [0.3, -0.17],
    [0.12, -0.1],
    [0.02, -0.04],
  ],
  hind: [
    [0.0, 0.0],
    [0.15, 0.015],
    [0.35, 0.005],
    [0.5, -0.035],
    [0.56, -0.1],
    [0.49, -0.155],
    [0.3, -0.165],
    [0.12, -0.11],
    [0.02, -0.04],
  ],
};

const outlines: Record<WingKind, P[]> = {
  fore: chaikin(WING_RAW.fore, 3),
  hind: chaikin(WING_RAW.hind, 3),
};

export const wingOutline = (kind: WingKind): P[] => outlines[kind];
export const wingBounds = (kind: WingKind): Bounds => outlineBounds(outlines[kind], 0.02);

const wingCache = new Map<WingKind, CanvasTexture>();

/** Pale, faintly amber membrane with the bee's dense basal veins, light enough to show on a dark page. */
export function wingTexture(kind: WingKind): CanvasTexture {
  const hit = wingCache.get(kind);
  if (hit) return hit;
  const b = wingBounds(kind);
  const longEdge = exportTextureSize(512);
  const s = longEdge / Math.max(b.maxX - b.minX, b.maxY - b.minY);
  const w = Math.round((b.maxX - b.minX) * s);
  const h = Math.round((b.maxY - b.minY) * s);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const px = ([x, y]: P): P => [(x - b.minX) * s, (b.maxY - y) * s];
  const trace = () => {
    ctx.beginPath();
    outlines[kind].forEach((p, i) => (i ? ctx.lineTo(...px(p)) : ctx.moveTo(...px(p))));
    ctx.closePath();
  };

  trace();
  ctx.save();
  ctx.clip();
  const [rx, ry] = px([0, 0]);
  const membrane = ctx.createRadialGradient(rx, ry, 0, rx, ry, 0.9 * s);
  membrane.addColorStop(0, "rgba(236, 220, 190, 0.42)");
  membrane.addColorStop(0.55, "rgba(222, 214, 200, 0.26)");
  membrane.addColorStop(1, "rgba(206, 204, 200, 0.3)");
  ctx.fillStyle = membrane;
  ctx.fillRect(0, 0, w, h);

  // Thin-film sheen across the outer membrane.
  const sheen = ctx.createLinearGradient(...px([0.3, 0.05]), ...px([0.8, -0.18]));
  sheen.addColorStop(0, "rgba(160, 200, 255, 0)");
  sheen.addColorStop(0.5, "rgba(190, 170, 255, 0.12)");
  sheen.addColorStop(1, "rgba(255, 210, 170, 0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(120, 88, 58, 0.85)";
  const vein = (pts: P[], width: number) => {
    ctx.lineWidth = width * s;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(...px(p)) : ctx.moveTo(...px(p))));
    ctx.stroke();
  };
  if (kind === "fore") {
    vein([[0, 0.02], [0.3, 0.06], [0.5, 0.06]], 0.016);
    vein([[0.02, -0.01], [0.3, 0.0], [0.5, 0.0], [0.6, -0.04]], 0.009);
    vein([[0.02, -0.04], [0.25, -0.1], [0.45, -0.12]], 0.008);
    vein([[0.5, 0.06], [0.52, -0.02], [0.45, -0.12], [0.5, -0.19]], 0.007);
    vein([[0.6, -0.04], [0.58, -0.12]], 0.006);
    vein([[0.3, 0.0], [0.28, -0.1]], 0.006);
    // Dark pterostigma on the leading edge.
    ctx.fillStyle = "rgba(96, 66, 42, 0.9)";
    ctx.beginPath();
    ctx.ellipse(...px([0.52, 0.06]), 0.045 * s, 0.014 * s, -0.15, 0, Math.PI * 2);
    ctx.fill();
  } else {
    vein([[0, 0.0], [0.25, 0.01], [0.38, -0.005]], 0.011);
    vein([[0.02, -0.03], [0.22, -0.07], [0.3, -0.1]], 0.007);
  }
  ctx.restore();

  trace();
  ctx.strokeStyle = "rgba(150, 120, 90, 0.6)";
  ctx.lineWidth = 0.008 * s;
  ctx.stroke();

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  wingCache.set(kind, tex);
  return tex;
}

/** Fur colours, lightened toward the hair tips so black fur still reads against a dark page. */
export const FUR = {
  black: "#352e28",
  yellow: "#f4c432",
  white: "#f6f1e4",
} as const;

/**
 * Bands down a sphere from its +y pole (0) to its −y pole (1). The sphere UV puts the pole at the
 * canvas top, so each band is a horizontal stripe.
 */
export function bandTexture(bands: [number, string][]): CanvasTexture {
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  // Soft edges between bands, as fur colours blend where they meet.
  for (let i = 0; i < bands.length; i++) {
    const [at, color] = bands[i];
    const next = bands[i + 1]?.[0] ?? 1;
    grad.addColorStop(Math.min(1, at + 0.015), color);
    grad.addColorStop(Math.max(0, next - 0.015), color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 8, H);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

let hairTex: CanvasTexture | null = null;

/**
 * Per-texel hair heights for shell fur: a shell at height f keeps texels whose value exceeds f,
 * so stacked shells thin out into individual tufts at the tips.
 */
export function hairTexture(): CanvasTexture {
  if (hairTex) return hairTex;
  const W = 256;
  const H = 256;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  let seed = 41;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < W * H; i++) {
    const v = Math.round(255 * rand() ** 0.7);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  hairTex = new CanvasTexture(canvas);
  hairTex.generateMipmaps = false;
  hairTex.minFilter = LinearFilter;
  hairTex.magFilter = LinearFilter;
  return hairTex;
}

registerTextureCachePurge(() => {
  for (const tex of wingCache.values()) tex.dispose();
  wingCache.clear();
});
