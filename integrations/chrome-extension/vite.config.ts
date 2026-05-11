import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = __dirname

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: resolve(root, 'dist'),
    rollupOptions: {
      input: {
        background: resolve(root, 'src/background.ts'),
        popup: resolve(root, 'popup.html'),
      },
      output: {
        assetFileNames: 'assets/[name][extname]',
        chunkFileNames: 'assets/[name].js',
        entryFileNames: '[name].js',
      },
    },
  },
  publicDir: resolve(root, 'public'),
  root,
})
