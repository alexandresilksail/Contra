import { defineConfig } from 'vite';

// base: './' => the built dist/ folder can be dropped into ANY static host
// (Nginx / IIS / GitHub Pages / Cloudflare Pages / Vercel) without changes.
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: true,
    host: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as any);
