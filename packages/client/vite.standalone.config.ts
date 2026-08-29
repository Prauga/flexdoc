import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.cjs',
  },
  build: {
    outDir: 'dist/standalone',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/standalone.tsx'),
      name: 'FlexDocStandaloneBundle',
      fileName: () => 'flexdoc.standalone.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith('.css')
            ? 'flexdoc.standalone.css'
            : 'assets/[name].[ext]',
      },
    },
    cssCodeSplit: false,
    minify: true,
    target: 'es2020',
    sourcemap: true,
  },
});
