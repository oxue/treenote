import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

// Single-file viewer build:
//   - Inline every JS chunk into a <script type="module">…</script>.
//   - Inline every CSS asset into a <style>…</style>.
//   - Drop the resulting one-file HTML at public/viewer-template.html, where
//     the main app can fetch('/viewer-template.html') at export time.
// We deliberately preserve <!--TREENOTE_DATA--> — the runtime export path
// substitutes the tree payload in there.
function inlineAndEmit() {
  return {
    name: 'treenote-inline-and-emit',
    enforce: 'post',
    apply: 'build',
    generateBundle(_options, bundle) {
      const fileNames = Object.keys(bundle);
      const htmlName = fileNames.find((n) => n.endsWith('.html'));
      if (!htmlName) return;
      const htmlAsset = bundle[htmlName];
      let source = htmlAsset.source;

      // Inline JS chunks.
      for (const name of fileNames) {
        const asset = bundle[name];
        if (!asset || asset.type !== 'chunk') continue;
        const escaped = asset.code.replace(/<\/script>/g, '<\\/script>');
        const re = new RegExp(`<script[^>]*src="[^"]*${escapeRegex(name)}"[^>]*></script>`);
        source = source.replace(re, `<script type="module">${escaped}</script>`);
        delete bundle[name];
      }

      // Inline CSS assets.
      for (const name of fileNames) {
        const asset = bundle[name];
        if (!asset || asset.type !== 'asset' || !name.endsWith('.css')) continue;
        const css = typeof asset.source === 'string' ? asset.source : Buffer.from(asset.source).toString('utf-8');
        const re = new RegExp(`<link[^>]*href="[^"]*${escapeRegex(name)}"[^>]*>`);
        source = source.replace(re, `<style>${css}</style>`);
        delete bundle[name];
      }

      // Write the consolidated artifact to public/.
      const outDir = resolve(__dirname, 'public');
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, 'viewer-template.html'), source);

      // Replace the bundled HTML so the throwaway dist-viewer/ also has it.
      htmlAsset.fileName = 'viewer-template.html';
      htmlAsset.source = source;
      delete bundle[htmlName];
      bundle['viewer-template.html'] = htmlAsset;
    },
  };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default defineConfig({
  plugins: [react(), inlineAndEmit()],
  root: resolve(__dirname, 'src/viewer'),
  build: {
    outDir: resolve(__dirname, 'dist-viewer'),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      input: resolve(__dirname, 'src/viewer/viewer.html'),
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true,
      },
    },
  },
});
