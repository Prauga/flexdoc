import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'FlexDoc',
      fileName: (format) => `flexdoc.${format}.js`,
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
        // This ensures CSS is extracted to a separate file
        assetFileNames: 'assets/[name][extname]',
      },
    },
    // This extracts CSS to a separate file
    cssCodeSplit: true,
    // This ensures CSS is minified
    minify: true,
  },
});

