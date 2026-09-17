import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5178,
    watch: {
      // Scratch directories hold browser profiles and frame dumps; watching
      // them makes the dev server crash on locked files.
      ignored: ['**/.tmp/**', '**/.npm-cache/**'],
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4178,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
});