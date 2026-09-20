import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { flexDocBuildInfo } from './build-metadata';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['js-yaml'],
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    __FLEXDOC_BUILD_INFO__: JSON.stringify(flexDocBuildInfo),
  },
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
