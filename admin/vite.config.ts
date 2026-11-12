import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('element-plus') || id.includes('@element-plus')) return 'ui-element';
          if (id.includes('/vue@') || id.includes('vue-router') || id.includes('pinia')) return 'vue-core';
          if (id.includes('echarts') || id.includes('zrender')) return 'charts';
          if (id.includes('exceljs')) return 'excel';
          return 'vendor';
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
});
