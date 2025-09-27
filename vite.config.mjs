import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

const root = path.resolve(__dirname)
const rootSrc = path.resolve(__dirname, 'src')
const rootRenderer = path.resolve(__dirname, 'src/renderer')

export default defineConfig({
  root: rootRenderer,
  base: './',
  plugins: [
    vue(),
    tailwindcss(),
    AutoImport({
      imports: ['vue'],
    }),
    Components({
      dirs: [`${rootRenderer}/components`],
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
      '@': rootRenderer,
      '~': rootSrc,
    },
  },
  define: {
    'process.env': {},
    'process': {},
  },
  server: {
    watch: {
      ignored: [
        `${root}/src/main/i18n/locales/**/*`,
        `${root}/scripts/**/*`,
        `${root}/build/**/*`,
        `${root}/src/main/**/*`,
      ],
    },
  },
})
