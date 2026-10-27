import { defineConfig } from "vite";
import { wikiPreview } from "./vite.wiki";

export default defineConfig({
  plugins: [wikiPreview()],
  server: {
    port: 5173,
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
  preview: {
    port: 4173,
    cors: true,
  },
});
