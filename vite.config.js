import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    // Keep the dev-server watcher out of build output; open handles there
    // make electron-builder's win-unpacked.tmp -> win-unpacked rename fail (EPERM).
    watch: { ignored: ['**/release/**', '**/dist/**'] },
  },
});
