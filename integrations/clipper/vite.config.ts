import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = __dirname
const browsers = ['chrome', 'firefox', 'safari'] as const
type BrowserTarget = (typeof browsers)[number]

interface ClipperPackage {
  version: string
}

interface ExtensionManifest {
  version: string
  [key: string]: unknown
}

function getBrowserTarget(mode: string): BrowserTarget {
  return browsers.includes(mode as BrowserTarget)
    ? (mode as BrowserTarget)
    : 'chrome'
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T
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
          const packageJson = readJson<ClipperPackage>(
            resolve(root, 'package.json'),
          )
          const manifest = readJson<ExtensionManifest>(
            resolve(root, 'manifests', `${browser}.json`),
          )

          manifest.version = packageJson.version

          writeFileSync(
            resolve(outDir, 'manifest.json'),
            `${JSON.stringify(manifest, null, 2)}\n`,
          )
        },
      },
    ],
    publicDir: resolve(root, 'public'),
    root,
  }
})
