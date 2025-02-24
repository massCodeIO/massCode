import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

const pathSrc = path.resolve(__dirname, 'src/renderer')
const rootSrc = path.resolve(__dirname, 'src')

export default defineConfig({
  root: pathSrc,
  base: './',
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue'],
    }),
    Components({
      dirs: [`${pathSrc}/components`],
      extensions: ['vue'],
      dts: true,
      directoryAsNamespace: true,
      collapseSamePrefixes: true,
    }),
  ],
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
