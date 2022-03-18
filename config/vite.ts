import path from 'path'
import vuePlugin from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

const pathSrc = path.resolve(__dirname, '../../src/renderer')
const pathOut = path.resolve(__dirname, '../renderer')

export default defineConfig({
  root: pathSrc,
  publicDir: 'public',
  server: {
    port: 8080,
    open: false
  },
  build: {
    outDir: pathOut,
    emptyOutDir: true
  },
  plugins: [
    vuePlugin(),
    AutoImport({
      dts: `${pathSrc}/types/auto-imports.d.ts`
    }),
    Components({
      dts: `${pathSrc}/types/components.d.ts`,
      dirs: [`${pathSrc}/components`]
    })
  ],
  resolve: {
    alias: {
      '@': pathSrc
    }
  }
})
