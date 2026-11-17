import { defineConfig } from 'vite';

// Relatieve paden: de build in dist/ werkt op elke statische host
// (GitHub Pages, itch.io, schoolserver) en zelfs vanuit een submap.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 900 },
});
