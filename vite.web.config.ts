import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds the browser repair tool into ONE self-contained HTML file
// (dist-web/index.html) — everything inlined, so it works either hosted at a
// URL or double-clicked as a local file. Nothing is uploaded at runtime.
export default defineConfig({
  root: 'src/web',
  plugins: [viteSingleFile()],
  server: { port: 5173, strictPort: true },
  build: {
    outDir: '../../dist-web',
    emptyOutDir: true,
  },
});
