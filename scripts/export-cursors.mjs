/**
 * Headless export: npm run dev in another terminal, or this script starts vite briefly.
 * Writes PNG + SVG (embedded raster) to assets/cursor-stills/.
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "assets/cursor-stills");
const port = 5173;
const url = `http://127.0.0.1:${port}/export-cursors.html?auto=1`;

function waitForServer(ms = 20000) {
  return fetch(url).then(
    () => true,
    async () => {
      await new Promise((r) => setTimeout(r, 400));
      if (ms <= 0) throw new Error("Dev server not reachable. Run npm run dev first.");
      return waitForServer(ms - 400);
    },
  );
}

async function maybeStartDev() {
  try {
    await fetch(`http://127.0.0.1:${port}/`);
    return null;
  } catch {
    const child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForServer();
    return child;
  }
}

async function runPlaywrightExport() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__ENTOMON_CURSOR_EXPORTS__);
  const data = await page.evaluate(() => window.__ENTOMON_CURSOR_EXPORTS__);
  await browser.close();
  return data;
}

function pngFromDataUrl(dataUrl) {
  const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(b64, "base64");
}

function svgFromPng(dataUrl, title, w, h) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}">
  <title>${title}</title>
  <image width="${w}" height="${h}" xlink:href="${dataUrl}"/>
</svg>`;
  return Buffer.from(svg, "utf8");
}

async function main() {
  await mkdir(outDir, { recursive: true });
  let dev = null;
  try {
    dev = await maybeStartDev();
    const exports = await runPlaywrightExport();
    for (const [id, { png, width, height }] of Object.entries(exports)) {
      const label = id.replace(/-/g, " ");
      await writeFile(join(outDir, `${id}.png`), pngFromDataUrl(png));
      await writeFile(join(outDir, `${id}.svg`), svgFromPng(png, `Entomon ${label} cursor`, width, height));
    }
    console.log(`Wrote ${Object.keys(exports).length} cursor(s) to assets/cursor-stills/`);
  } finally {
    if (dev) dev.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
