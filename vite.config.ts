import { defineConfig } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Office add-ins must be served over HTTPS. `npx office-addin-dev-certs install`
// writes a trusted localhost cert here; if it's absent we fall back to HTTP so
// `vite build` still works in CI (which never serves).
const certDir = join(homedir(), '.office-addin-dev-certs');
const keyPath = join(certDir, 'localhost.key');
const certPath = join(certDir, 'localhost.crt');
const https =
  existsSync(keyPath) && existsSync(certPath)
    ? { key: readFileSync(keyPath), cert: readFileSync(certPath) }
    : undefined;

export default defineConfig({
  // The task pane is the app root, so its files serve at https://localhost:3000/.
  root: 'src/taskpane',
  publicDir: 'public',
  server: { port: 3000, strictPort: true, https },
  preview: { port: 3000, strictPort: true, https },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: join(process.cwd(), 'src/taskpane/taskpane.html'),
    },
  },
});
