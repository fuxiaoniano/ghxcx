import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // The legacy API-domain deployment uses /website/. The standalone website
  // domain sets WEBSITE_BASE_PATH=/ so the same build works at its root.
  base: process.env.WEBSITE_BASE_PATH || '/website/',
  plugins: [vue()],
  server: { port: 5174, proxy: { '/api': 'http://localhost:3000', '/landing': 'http://localhost:3000', '/uploads': 'http://localhost:3000' } },
  build: { sourcemap: true }
});
