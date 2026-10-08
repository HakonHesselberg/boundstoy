import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 4321, strictPort: true },
  preview: { host: '127.0.0.1', port: 4321, strictPort: true },
});
