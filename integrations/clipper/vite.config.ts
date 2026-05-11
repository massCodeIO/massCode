import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = __dirname
const browsers = ['chrome', 'firefox', 'safari'] as const
type BrowserTarget = (typeof browsers)[number]

function getBrowserTarget(mode: string): BrowserTarget {
  return browsers.includes(mode as BrowserTarget)
    ? (mode as BrowserTarget)
    : 'chrome'
}

export default defineConfig(({ mode }) => {
  const browser = getBrowserTarget(mode)
  const outDir = resolve(root, 'dist', browser)

  return {
    build: {
      emptyOutDir: true,
      outDir,
      rollupOptions: {
        input: {
          background: resolve(root, 'src/background.ts'),
          pageExtractor: resolve(root, 'src/pageExtractor.ts'),
          popup: resolve(root, 'popup.html'),
        },
        output: {
          assetFileNames: 'assets/[name][extname]',
          chunkFileNames: 'assets/[name].js',
          entryFileNames: '[name].js',
        },
      },
    },
    plugins: [
      {
        name: 'clipper-browser-manifest',
        writeBundle() {
          mkdirSync(outDir, { recursive: true })
          copyFileSync(
            resolve(root, 'manifests', `${browser}.json`),
            resolve(outDir, 'manifest.json'),
          )
        },
      },
    ],
    publicDir: resolve(root, 'public'),
    root,
  }
})
