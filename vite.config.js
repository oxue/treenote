import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.ELECTRON ? './' : '/',
  // The viewer template lives in public/ and contains an inlined bundle. We
  // don't want Vite's dep optimizer/scanner to crawl it (the inlined JS
  // contains string literals like `<script type="module">` that confuse
  // esbuild's HTML scanner). It's served as a static asset only.
  optimizeDeps: {
    entries: ['index.html', 'src/**/*.{js,jsx}'],
  },
});
