import { Group, Mesh, OrthographicCamera, Vector3 } from "three";
import { createInsectRig, getInsectConfig, implementedInsectIds } from "../insects/registry";
import type { FlapProfile, InsectId } from "../insects/types";
import {
  purgeExportTextureCaches,
  setExportTextureScale,
} from "../render/export-quality";
import { OverlayRenderer } from "../render/overlay-renderer";

export { implementedInsectIds as implementedCursorIds };

function wingAngles(profile: FlapProfile, phase = 0.5): {
  leftFore: number;
  rightFore: number;
  leftHind: number;
  rightHind: number;
} {
  const stroke = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  const amp = profile.amplitude;
  const fore = profile.rest + amp * stroke;
  const hind = profile.rest + amp * 0.92 * (0.5 + 0.5 * Math.sin((phase - profile.hindPhaseLag) * Math.PI * 2));
  return { leftFore: fore, rightFore: fore, leftHind: hind, rightHind: hind };
}

/** Trim transparent pixels; returns a new canvas with a little padding. */
export function cropToAlpha(source: HTMLCanvasElement, pad = 24): HTMLCanvasElement {
  const { width, height } = source;
  const snap = document.createElement("canvas");
  snap.width = width;
  snap.height = height;
  const ctx = snap.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0);
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 12) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX) return source;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(source, minX, minY, w, h, 0, 0, w, h);
  return out;
}

export type StillOptions = {
  /** Longest side of the final PNG after crop (and downscale), in pixels. */
  outputLongEdge?: number;
  /** Render at this multiple of outputLongEdge, then downscale for clean edges. */
  supersample?: number;
  /** @deprecated Use outputLongEdge — kept for callers that passed size/pixelRatio. */
  size?: number;
  /** @deprecated Use supersample. */
  pixelRatio?: number;
  /** Flap phase 0..1 on the idle stroke. */
  phase?: number;
  padding?: number;
};

type ScreenBounds = { minX: number; minY: number; maxX: number; maxY: number };

/** Elevated orthographic view — not flat top-down, so wing camber and twist stay in frame. */
function setupStillCamera(camera: OrthographicCamera): void {
  camera.near = -800;
  camera.far = 800;
  camera.position.set(0, -36, 240);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
}

/** Screen pixel bounds via the active camera (includes 3D wing curvature). */
function projectedScreenBounds(
  root: Group,
  camera: OrthographicCamera,
  canvasW: number,
  canvasH: number,
): ScreenBounds {
  const v = new Vector3();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  root.updateWorldMatrix(true, true);
  camera.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!(o instanceof Mesh) || !o.visible || o.renderOrder < 0) return;
    const pos = o.geometry.getAttribute("position");
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.applyMatrix4(o.matrixWorld);
      v.project(camera);
      if (v.z > 1) continue;
      const sx = (v.x * 0.5 + 0.5) * canvasW;
      const sy = (-v.y * 0.5 + 0.5) * canvasH;
      minX = Math.min(minX, sx);
      minY = Math.min(minY, sy);
      maxX = Math.max(maxX, sx);
      maxY = Math.max(maxY, sy);
    }
  });
  return { minX, minY, maxX, maxY };
}

function centerFrameOnCanvas(
  frame: Group,
  rigRoot: Group,
  pose: () => void,
  camera: OrthographicCamera,
  canvasSize: number,
  marginFrac: number,
): void {
  const fit = canvasSize * (1 - marginFrac * 2);
  const right = new Vector3();
  const up = new Vector3();
  const wpp = (camera.right - camera.left) / canvasSize;

  const nudgeToCenter = () => {
    const b = projectedScreenBounds(frame, camera, canvasSize, canvasSize);
    const dx = canvasSize / 2 - (b.minX + b.maxX) / 2;
    const dy = canvasSize / 2 - (b.minY + b.maxY) / 2;
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    frame.position.addScaledVector(right, dx * wpp);
    frame.position.addScaledVector(up, dy * wpp);
  };

  frame.position.set(0, 0, 0);
  rigRoot.position.set(0, 0, 0);
  rigRoot.scale.setScalar(1);
  pose();
  let b = projectedScreenBounds(frame, camera, canvasSize, canvasSize);
  const maxDim = Math.max(b.maxX - b.minX, b.maxY - b.minY, 1e-6);
  rigRoot.scale.setScalar(fit / maxDim);
  pose();
  nudgeToCenter();

  b = projectedScreenBounds(frame, camera, canvasSize, canvasSize);
  const half = canvasSize / 2;
  const extent = Math.max(
    Math.abs(b.minX - half),
    Math.abs(b.maxX - half),
    Math.abs(b.minY - half),
    Math.abs(b.maxY - half),
  );
  const limit = half * (1 - marginFrac);
  if (extent > limit) {
    rigRoot.scale.multiplyScalar(limit / extent);
    frame.position.set(0, 0, 0);
    pose();
    nudgeToCenter();
  }
}

function downscaleToLongEdge(source: HTMLCanvasElement, longEdge: number): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const max = Math.max(w, h);
  if (max <= longEdge) return source;
  const s = longEdge / max;
  const out = document.createElement("canvas");
  out.width = Math.round(w * s);
  out.height = Math.round(h * s);
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

export function renderCursorStill(id: InsectId, options: StillOptions = {}): HTMLCanvasElement {
  const outputLongEdge = options.outputLongEdge ?? 2048;
  const supersample = options.supersample ?? options.pixelRatio ?? 2;
  const phase = options.phase ?? 0.55;

  setExportTextureScale(supersample >= 2 ? 2 : 1.5);

  const config = getInsectConfig(id);
  const rig = createInsectRig(id);
  const canvas = document.createElement("canvas");
  const renderer = new OverlayRenderer(canvas, { preserveDrawingBuffer: true });
  renderer.attach(rig);
  renderer.renderer.setPixelRatio(1);

  const canvasSize = 4096;
  const marginFrac = 0.12;
  const padding =
    options.padding ?? Math.max(48, Math.round(outputLongEdge * supersample * 0.04));

  rig.group.traverse((o) => {
    if (o instanceof Mesh) {
      if (o.renderOrder < 0) o.visible = false;
      else o.frustumCulled = false;
    }
  });

  const pose = () => {
    rig.setHeading(0, 0);
    rig.setBody(0);
    rig.setLift(1);
    rig.setFlap(wingAngles(config.flap.idle, phase));
  };

  renderer.resize(canvasSize, canvasSize);
  setupStillCamera(renderer.camera);
  renderer.camera.updateProjectionMatrix();

  renderer.scene.remove(rig.group);
  const frame = new Group();
  frame.add(rig.group);
  renderer.scene.add(frame);

  centerFrameOnCanvas(frame, rig.group, pose, renderer.camera, canvasSize, marginFrac);

  renderer.render();
  let cropped = cropToAlpha(canvas, padding);
  if (supersample > 1) cropped = downscaleToLongEdge(cropped, outputLongEdge);
  renderer.dispose();
  purgeExportTextureCaches();
  return cropped;
}

export function canvasToPngDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}

/** SVG wrapper so the raster can scale cleanly in design tools (still a PNG internally). */
export function canvasToSvgDataUrl(canvas: HTMLCanvasElement, title: string): string {
  const png = canvas.toDataURL("image/png");
  const w = canvas.width;
  const h = canvas.height;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}">
  <title>${title}</title>
  <image width="${w}" height="${h}" xlink:href="${png}"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
