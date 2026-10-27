import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "copy-inject-public",
      closeBundle() {
        mkdirSync(resolve(__dirname, "public"), { recursive: true });
        copyFileSync(
          resolve(__dirname, "extension/dist/inject.js"),
          resolve(__dirname, "public/inject.js"),
        );
      },
    },
  ],
  build: {
    emptyOutDir: true,
    outDir: "extension/dist",
    lib: {
      entry: resolve(__dirname, "src/inject.ts"),
      name: "Entomon",
      formats: ["iife"],
      fileName: () => "inject.js",
    },
  },
});
