import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  base: '/website/',
  plugins: [vue()],
  server: { port: 5174, proxy: { '/api': 'http://localhost:3000', '/landing': 'http://localhost:3000', '/uploads': 'http://localhost:3000' } },
  build: { sourcemap: true }
});
