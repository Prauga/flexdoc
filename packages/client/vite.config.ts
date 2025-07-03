import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.cjs',
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'FlexDoc',
      fileName: (format) => {
        if (format === 'es') return 'flexdoc.es.js';
        if (format === 'umd') return 'flexdoc.umd.cjs';
        return `flexdoc.${format}.js`;
      },
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
        assetFileNames: `assets/[name].[ext]`,
        format: 'esm',
      },
    },
    cssCodeSplit: true,
    minify: true,
    target: 'esnext',
    sourcemap: true,
  },
});
