import { PointerTracker } from "./core/pointer";
import { prefersReducedMotion } from "./core/reduced-motion";
import { createInsectRig, getInsectConfig } from "./insects/registry";
import type { InsectId } from "./insects/types";
import { InsectController } from "./motion/controller";
import { OverlayRenderer } from "./render/overlay-renderer";

export type MountOptions = {
  insect?: InsectId;
  parent?: HTMLElement;
  hideNativeCursor?: boolean;
};

const STYLE = `
html.entomon-active, html.entomon-active * {
  cursor: none !important;
}
.entomon-layer {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2147483647;
}
.entomon-layer canvas {
  display: block;
  width: 100%;
  height: 100%;
}
`;

export function mountInsectCursor(options: MountOptions = {}): () => void {
  if (!document.body) {
    let stop = () => {};
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        stop = mountInsectCursor(options);
      },
      { once: true },
    );
    return () => stop();
  }

  window.__ENTOMON_UNMOUNT__?.();

  window.__ENTOMON__ = true;

  const insect = options.insect ?? "monarch";
  const parent =
    options.parent ??
    document.body ??
    document.documentElement;
  const hideCursor = options.hideNativeCursor ?? true;

  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.appendChild(style);

  const layer = document.createElement("div");
  layer.className = "entomon-layer";
  layer.dataset.entomonRoot = "";
  const canvas = document.createElement("canvas");
  layer.appendChild(canvas);
  parent.appendChild(layer);

  if (hideCursor) document.documentElement.classList.add("entomon-active");

  const config = getInsectConfig(insect);
  const rig = createInsectRig(insect);
  const renderer = new OverlayRenderer(canvas);
  renderer.attach(rig);
  const pointer = new PointerTracker();
  pointer.attach();
  const controller = new InsectController(config, rig);

  const resize = () => {
    renderer.resize(window.innerWidth, window.innerHeight);
  };
  resize();
  controller.seed(pointer.x, pointer.y, window.innerWidth, window.innerHeight);

  let last = performance.now();
  let raf = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.045, (now - last) / 1000);
    last = now;
    controller.update(dt, pointer, window.innerWidth, window.innerHeight, prefersReducedMotion());
    renderer.render();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  window.addEventListener("resize", resize);

  const unmount = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    pointer.detach();
    renderer.dispose();
    layer.remove();
    style.remove();
    document.documentElement.classList.remove("entomon-active");
    window.__ENTOMON__ = false;
    if (window.__ENTOMON_UNMOUNT__ === unmount) window.__ENTOMON_UNMOUNT__ = undefined;
  };
  window.__ENTOMON_UNMOUNT__ = unmount;
  return unmount;
}
