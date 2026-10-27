import {
  canvasToPngDataUrl,
  implementedCursorIds,
  renderCursorStill,
} from "./tools/cursor-still";

declare global {
  interface Window {
    __ENTOMON_CURSOR_EXPORTS__?: Record<
      string,
      { png: string; width: number; height: number }
    >;
  }
}

const root = document.getElementById("previews");
if (!root) throw new Error("#previews missing");

const exports: Record<string, { png: string; width: number; height: number }> = {};

for (const id of implementedCursorIds()) {
  const canvas = renderCursorStill(id, { outputLongEdge: 2048, supersample: 2 });
  const png = canvasToPngDataUrl(canvas);
  exports[id] = { png, width: canvas.width, height: canvas.height };
  const fig = document.createElement("figure");
  const img = document.createElement("img");
  img.src = png;
  img.alt = id;
  const cap = document.createElement("figcaption");
  cap.textContent = `${id} · ${canvas.width}×${canvas.height}px`;
  fig.append(img, cap);
  root.append(fig);
}

window.__ENTOMON_CURSOR_EXPORTS__ = exports;

if (new URLSearchParams(location.search).has("auto")) {
  console.log("ENTOMON_CURSOR_EXPORTS ready", Object.keys(exports));
}
