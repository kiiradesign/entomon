/** Multiplier for procedural wing/body canvas textures during still export. */
let textureScale = 1;

export function setExportTextureScale(scale: number): void {
  textureScale = Math.max(1, scale);
}

export function exportTextureScale(): number {
  return textureScale;
}

export function exportTextureSize(base = 1024): number {
  return Math.min(4096, Math.round(base * textureScale));
}

const purgeHooks: Array<() => void> = [];

export function registerTextureCachePurge(fn: () => void): void {
  purgeHooks.push(fn);
}

export function purgeExportTextureCaches(): void {
  textureScale = 1;
  for (const fn of purgeHooks) fn();
}
