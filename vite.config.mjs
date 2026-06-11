import fs from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

const root = path.resolve(__dirname)
const rootSrc = path.resolve(__dirname, 'src')
const rootRenderer = path.resolve(__dirname, 'src/renderer')
const excalidrawFontsDir = path.join(
  fs.realpathSync(path.resolve(__dirname, 'node_modules/@excalidraw/excalidraw')),
  'dist/prod/fonts',
)

// Self-hosts Excalidraw fonts so drawings work offline:
// serves them at /fonts in dev and copies them next to index.html on build.
function excalidrawFonts() {
  return {
    name: 'masscode:excalidraw-fonts',
    configureServer(server) {
      server.middlewares.use('/fonts', (req, res, next) => {
        const requestPath = decodeURIComponent(
          (req.url || '').split('?')[0],
        ).replace(/^\/+/, '')
        const filePath = path.join(excalidrawFontsDir, requestPath)

        if (
          !filePath.startsWith(excalidrawFontsDir)
          || !fs.existsSync(filePath)
          || !fs.statSync(filePath).isFile()
        ) {
          next()
          return
        }

        res.setHeader('Content-Type', 'font/woff2')
        fs.createReadStream(filePath).pipe(res)
      })
    },
    writeBundle() {
      fs.cpSync(
        excalidrawFontsDir,
        path.resolve(__dirname, 'build/renderer/fonts'),
        { recursive: true },
      )
    },
  }
}

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
    excalidrawFonts(),
  ],
  build: {
    outDir: path.resolve(__dirname, 'build/renderer'),
    emptyOutDir: true,
    target: 'es2022',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
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
    port: Number(process.env.DEV_PORT) || 5177,
    strictPort: true,
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
