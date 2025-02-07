import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const pathSrc = path.resolve(__dirname, 'src/renderer')
const rootSrc = path.resolve(__dirname, 'src')

export default defineConfig({
  root: pathSrc,
  base: './',
  plugins: [vue()],
  build: {
    outDir: path.resolve(__dirname, 'build/renderer'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': pathSrc,
      '~': rootSrc,
    },
  },
})
