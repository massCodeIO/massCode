import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

const root = import.meta.dirname
const repository = path.resolve(root, '..')
const renderer = path.join(repository, 'src/renderer')
const mocks = [
  '@/composables/ai/useAi',
  '@/electron',
  '@/utils',
  '@/router',
  '@/composables/useTheme',
  '@/composables/useCopyToClipboard',
  '@/ipc/listeners/deepLinks',
  '@/composables/spaces/http/useHttpRunner',
  '@/composables/spaces/http/useHttpRuntime',
]

export default defineConfig({
  root,
  cacheDir: `${repository}/node_modules/.vite-playground`,
  define: { 'process.env': {}, 'process': {} },
  plugins: [
    vue(),
    tailwindcss(),
    AutoImport({ imports: ['vue'], dts: false }),
    Components({
      dirs: [`${renderer}/components`],
      extensions: ['vue'],
      dts: false,
      directoryAsNamespace: true,
      collapseSamePrefixes: true,
    }),
  ],
  resolve: {
    alias: [
      ...mocks.map(find => ({
        find: new RegExp(`^${find}$`),
        replacement: `${root}/examples/ai/mocks.ts`,
      })),
      { find: '@', replacement: renderer },
      { find: '~', replacement: `${repository}/src` },
    ],
  },
  build: { outDir: `${repository}/dist/playground`, emptyOutDir: true },
  server: {
    host: '127.0.0.1',
    port: 5193,
    strictPort: true,
    fs: { allow: [repository] },
  },
})
