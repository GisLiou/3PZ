import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// base './' so the same build runs on GitHub Pages (sub-path) and inside the Capacitor WebView
export default defineConfig({
  base: './',
  // 開發版發布在 /develop/ 並共用網站根目錄的素材，建置時設 NO_PUBLIC=1 不複製 public/
  publicDir: process.env.NO_PUBLIC ? false : 'public',
  plugins: [react()],
  resolve: { alias: { '@core': r('./src/core'), '@modules': r('./src/modules'), '@ui': r('./src/ui'), '@data': r('./src/data') } },
  build: { target: 'es2020', outDir: 'dist', assetsDir: 'js', assetsInlineLimit: 0 },
  server: { host: true },
});
