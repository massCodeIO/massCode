import path from 'path'
import vuePlugin from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Icons from 'unplugin-icons/vite'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import IconsResolver from 'unplugin-icons/resolver'

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
    emptyOutDir: true,
    target: 'esnext'
  },
  plugins: [
    vuePlugin(),
    AutoImport({
      dts: `${pathSrc}/types/auto-imports.d.ts`
    }),
    Components({
      dts: `${pathSrc}/types/components.d.ts`,
      dirs: [`${pathSrc}/components`],
      resolvers: [
        IconsResolver({
          prefix: '',
          customCollections: ['unicons']
        })
      ]
    }),
    Icons({
      customCollections: {
        unicons: FileSystemIconLoader(
          './node_modules/@iconscout/unicons/svg/line'
        )
      }
    })
  ],
  resolve: {
    alias: {
      '@': pathSrc
    }
  }
})
