import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        statistics: resolve(__dirname, 'statistics.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true
  }
});

