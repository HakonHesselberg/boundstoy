import { defineConfig } from 'astro/config';

export default defineConfig({
  base: process.env.BOUNDSTOY_ASTRO_BASE ?? '/',
  output: 'static',
  build: { inlineStylesheets: 'never' },
});
