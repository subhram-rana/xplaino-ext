import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './manifest.json';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.ico'],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        youtubePageContext: resolve(__dirname, 'src/content/utils/youtubeTranscriptPageContext.ts'),
        chromeTranslatorBridge: resolve(__dirname, 'src/content/utils/chromeTranslatorBridge.js'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Bundle page-context / bridge scripts separately without hash
          if (chunkInfo.name === 'youtubePageContext') {
            return 'src/content/utils/[name].js';
          }
          if (chunkInfo.name === 'chromeTranslatorBridge') {
            return 'src/content/utils/[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
});

