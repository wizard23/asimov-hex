import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'test/**/*.test.ts', 'test/**/*.spec.ts'],
    exclude: ['**/docs/**', '**/public/**', '**/shell/**', '**/node_modules/**', '**/dist/**'],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        statistics: resolve(__dirname, 'statistics.html'),
        timeline: resolve(__dirname, 'timeline.html'),
        tileEditor: resolve(__dirname, 'tile-editor.html'),
        markdownViewer: resolve(__dirname, 'markdown-viewer.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true
  }
});
