import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./web', import.meta.url));
const shared = fileURLToPath(new URL('./shared', import.meta.url));

export default defineConfig({
  root,
  base: './',
  plugins: [svelte()],
  resolve: { alias: { $shared: shared } },
  server: {
    port: Number(process.env.VITE_PORT ?? 5173),
    fs: { allow: [root, shared, fileURLToPath(new URL('./node_modules', import.meta.url))] },
    proxy: { '/ws': { target: `ws://localhost:${process.env.PORT ?? 8099}`, ws: true } },
  },
  build: {
    outDir: process.env.OUT_DIR ?? fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
  },
});
