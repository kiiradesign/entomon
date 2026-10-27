import {
  CanvasTexture,
  CustomBlending,
  Group,
  MaxEquation,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from "three";

type P = [number, number];

const OUTLINE_RES = 128;

/** Three box-blur passes per axis approximate a gaussian; ctx.filter isn't available in every browser. */
function blurMask(ctx: CanvasRenderingContext2D, radius: number): void {
  const { width: w, height: h } = ctx.canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const a = new Float32Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = img.data[i * 4 + 3];
  const tmp = new Float32Array(a.length);
  const r = Math.max(1, Math.round(radius));
  const pass = (src: Float32Array, dst: Float32Array, horizontal: boolean) => {
    const n = horizontal ? w : h;
    const lines = horizontal ? h : w;
    for (let l = 0; l < lines; l++) {
      const at = (k: number) => (horizontal ? l * w + k : k * w + l);
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += src[at(Math.min(n - 1, Math.max(0, k)))];
      for (let k = 0; k < n; k++) {
        dst[at(k)] = sum / (2 * r + 1);
        sum += src[at(Math.min(n - 1, k + r + 1))] - src[at(Math.max(0, k - r))];
      }
    }
  };
  for (let i = 0; i < 3; i++) {
    pass(a, tmp, true);
    pass(tmp, a, false);
  }
  // alphaMap samples the green channel, so the mask goes into rgb on an opaque canvas.
  for (let i = 0; i < a.length; i++) {
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = a[i];
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function shadowMaterial(alphaMap: CanvasTexture, opacity: number): MeshBasicMaterial {
  const mat = new MeshBasicMaterial({
    color: 0x000000,
    alphaMap,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    // Max keeps overlapping part shadows from stacking into darker patches.
    blending: CustomBlending,
    blendEquation: MaxEquation,
  });
  mat.userData.baseOpacity = opacity;
  return mat;
}

/** Blurred silhouette of a closed outline; `blur` is the gaussian sigma in model units. */
export function outlineShadow(pts: P[], blur: number, opacity: number): Mesh {
  const pad = blur * 3;
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
  minX -= pad;
  maxX += pad;
  minY -= pad;
  maxY += pad;
  const w = maxX - minX;
  const h = maxY - minY;
  const c = document.createElement("canvas");
  c.width = OUTLINE_RES;
  c.height = OUTLINE_RES;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const cx = ((x - minX) / w) * OUTLINE_RES;
    const cy = ((maxY - y) / h) * OUTLINE_RES;
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  });
  ctx.closePath();
  ctx.fill();
  blurMask(ctx, blur * (OUTLINE_RES / Math.max(w, h)));
  const geo = new PlaneGeometry(w, h);
  geo.translate((minX + maxX) / 2, (minY + maxY) / 2, 0);
  const mesh = new Mesh(geo, shadowMaterial(new CanvasTexture(c), opacity));
  mesh.renderOrder = -1;
  return mesh;
}

/** Blurred ellipse centred on the origin, for body parts. */
export function ellipseShadow(width: number, height: number, blur: number, opacity: number, res = 64): Mesh {
  const pad = blur * 3;
  const w = width + pad * 2;
  const h = height + pad * 2;
  const c = document.createElement("canvas");
  c.width = Math.max(8, Math.round((res * w) / h));
  c.height = res;
  const ctx = c.getContext("2d")!;
  const k = res / h;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(c.width / 2, res / 2, (width / 2) * k, (height / 2) * k, 0, 0, Math.PI * 2);
  ctx.fill();
  blurMask(ctx, blur * k);
  const mesh = new Mesh(new PlaneGeometry(w, h), shadowMaterial(new CanvasTexture(c), opacity));
  mesh.renderOrder = -1;
  return mesh;
}

/**
 * Flattened copy of a rig's transform chain. Parts added under `body` mirror the insect's pose and
 * are squashed onto the page plane, so wing shadows foreshorten exactly as the wings do.
 */
export class ShadowRig {
  readonly root = new Group();
  readonly heading = new Group();
  readonly pose = new Group();
  readonly inner = new Group();
  readonly body = new Group();
  private materials: MeshBasicMaterial[] = [];

  constructor(private readonly offset: { x: number; y: number }) {
    this.root.position.set(offset.x, offset.y, -1);
    this.root.scale.z = 0.001;
    this.root.add(this.heading);
    this.heading.add(this.pose);
    this.pose.add(this.inner);
    this.inner.add(this.body);
  }

  /** Call once every shadow part has been added. */
  collect(): void {
    this.materials = [];
    this.root.traverse((o) => {
      if (o instanceof Mesh) this.materials.push(o.material as MeshBasicMaterial);
    });
  }

  setLift(lift: number): void {
    this.root.position.x = this.offset.x * lift;
    this.root.position.y = this.offset.y * lift;
    const k = 1.5 - 0.5 * lift;
    for (const m of this.materials) m.opacity = (m.userData.baseOpacity as number) * k;
  }
}
